// SPDX-License-Identifier: MIT
// MediLedger Nigeria — Claims Processor
// Automates insurance claims lifecycle with 3-party multi-signature (patient + provider + HMO).
pragma solidity ^0.8.20;

contract ClaimsProcessor {
    address public nhiaAdmin;
    uint256 public totalClaims;
    uint256 public totalApproved;
    uint256 public totalRejected;
    uint256 public totalValueProcessedNgn; // Stored × 100 (kobo)

    enum ClaimStatus {
        Draft,
        Submitted,
        ProviderSigned,
        PatientSigned,
        HMOReview,
        Approved,
        Rejected,
        Paid,
        Disputed
    }

    struct Claim {
        bytes32 claimId;
        bytes32 patientHash;       // keccak256(nhia_id + salt)
        bytes32 providerHash;      // keccak256(facility_id + salt)
        bytes32 hmoHash;           // keccak256(hmo_id + salt)
        bytes32 nhiaProgramId;
        uint32  serviceDate;       // Unix date (day precision)
        bytes32 icd10CodesHash;    // keccak256(sorted ICD-10 array)
        uint256 totalAmountNgn;    // × 100 kobo
        uint256 approvedAmountNgn;
        ClaimStatus status;
        bytes32 patientSigHash;    // keccak256(patient_signature)
        bytes32 providerSigHash;   // keccak256(provider_signature)
        bytes32 hmoSigHash;        // keccak256(hmo_signature)
        uint256 submittedAt;
        uint256 processedAt;
        bytes32 rejectionReasonHash;
    }

    mapping(bytes32 => Claim)    public claims;
    mapping(bytes32 => bytes32[]) public patientClaims;   // patientHash → claimIds
    mapping(bytes32 => bytes32[]) public providerClaims;
    mapping(bytes32 => bytes32[]) public hmoClaims;

    // ─── Events ───────────────────────────────────────────────────────
    event ClaimSubmitted(
        bytes32 indexed claimId,
        bytes32 indexed patientHash,
        bytes32 indexed hmoHash,
        uint256 amount,
        uint256 submittedAt
    );
    event ClaimSigned(bytes32 indexed claimId, string role);
    event ClaimApproved(bytes32 indexed claimId, uint256 approvedAmount, uint256 processedAt);
    event ClaimRejected(bytes32 indexed claimId, bytes32 reasonHash);
    event ClaimPaid(bytes32 indexed claimId, uint256 paidAt);
    event ClaimDisputed(bytes32 indexed claimId, uint256 disputedAt);

    modifier onlyNHIA() {
        require(msg.sender == nhiaAdmin, "Unauthorized");
        _;
    }

    constructor(address _nhiaAdmin) {
        require(_nhiaAdmin != address(0), "Invalid admin address");
        nhiaAdmin = _nhiaAdmin;
    }

    function submitClaim(
        bytes32 claimId,
        bytes32 patientHash,
        bytes32 providerHash,
        bytes32 hmoHash,
        bytes32 nhiaProgramId,
        uint32  serviceDate,
        bytes32 icd10CodesHash,
        uint256 totalAmountNgn
    ) external onlyNHIA {
        require(claims[claimId].claimId == bytes32(0), "Claim already exists");
        require(totalAmountNgn > 0, "Amount must be positive");

        claims[claimId] = Claim({
            claimId: claimId,
            patientHash: patientHash,
            providerHash: providerHash,
            hmoHash: hmoHash,
            nhiaProgramId: nhiaProgramId,
            serviceDate: serviceDate,
            icd10CodesHash: icd10CodesHash,
            totalAmountNgn: totalAmountNgn,
            approvedAmountNgn: 0,
            status: ClaimStatus.Submitted,
            patientSigHash: bytes32(0),
            providerSigHash: bytes32(0),
            hmoSigHash: bytes32(0),
            submittedAt: block.timestamp,
            processedAt: 0,
            rejectionReasonHash: bytes32(0)
        });

        patientClaims[patientHash].push(claimId);
        providerClaims[providerHash].push(claimId);
        hmoClaims[hmoHash].push(claimId);
        totalClaims++;

        emit ClaimSubmitted(claimId, patientHash, hmoHash, totalAmountNgn, block.timestamp);
    }

    function signClaim(
        bytes32 claimId,
        bytes32 sigHash,
        string calldata role
    ) external onlyNHIA {
        Claim storage c = claims[claimId];
        require(c.claimId != bytes32(0), "Claim not found");
        require(c.status != ClaimStatus.Rejected, "Claim rejected");
        require(c.status != ClaimStatus.Paid, "Claim already paid");

        bytes32 roleHash = keccak256(bytes(role));
        if (roleHash == keccak256("provider")) {
            require(c.providerSigHash == bytes32(0), "Provider already signed");
            c.providerSigHash = sigHash;
            c.status = ClaimStatus.ProviderSigned;
        } else if (roleHash == keccak256("patient")) {
            require(c.patientSigHash == bytes32(0), "Patient already signed");
            c.patientSigHash = sigHash;
            c.status = ClaimStatus.PatientSigned;
        } else if (roleHash == keccak256("hmo")) {
            require(c.hmoSigHash == bytes32(0), "HMO already signed");
            c.hmoSigHash = sigHash;
            c.status = ClaimStatus.HMOReview;
        } else {
            revert("Invalid role");
        }

        // Auto-approve when all 3 signatures present
        if (
            c.providerSigHash != bytes32(0) &&
            c.patientSigHash != bytes32(0) &&
            c.hmoSigHash != bytes32(0)
        ) {
            c.status = ClaimStatus.Approved;
            if (c.approvedAmountNgn == 0) c.approvedAmountNgn = c.totalAmountNgn;
            c.processedAt = block.timestamp;
            totalApproved++;
            totalValueProcessedNgn += c.approvedAmountNgn;
            emit ClaimApproved(claimId, c.approvedAmountNgn, block.timestamp);
        }

        emit ClaimSigned(claimId, role);
    }

    /// @notice HMO sets approved amount before signing (may differ from total)
    function setApprovedAmount(bytes32 claimId, uint256 approvedAmountNgn) external onlyNHIA {
        Claim storage c = claims[claimId];
        require(c.claimId != bytes32(0), "Claim not found");
        require(c.status == ClaimStatus.HMOReview || c.status == ClaimStatus.PatientSigned, "Wrong status");
        require(approvedAmountNgn <= c.totalAmountNgn, "Approved exceeds total");
        c.approvedAmountNgn = approvedAmountNgn;
    }

    function rejectClaim(bytes32 claimId, bytes32 reasonHash) external onlyNHIA {
        Claim storage c = claims[claimId];
        require(c.claimId != bytes32(0), "Claim not found");
        require(c.status != ClaimStatus.Approved && c.status != ClaimStatus.Paid, "Cannot reject");
        c.status = ClaimStatus.Rejected;
        c.rejectionReasonHash = reasonHash;
        c.processedAt = block.timestamp;
        totalRejected++;
        emit ClaimRejected(claimId, reasonHash);
    }

    function markPaid(bytes32 claimId) external onlyNHIA {
        require(claims[claimId].claimId != bytes32(0), "Claim not found");
        require(claims[claimId].status == ClaimStatus.Approved, "Not approved");
        claims[claimId].status = ClaimStatus.Paid;
        emit ClaimPaid(claimId, block.timestamp);
    }

    function disputeClaim(bytes32 claimId) external onlyNHIA {
        Claim storage c = claims[claimId];
        require(c.status != ClaimStatus.Paid, "Cannot dispute paid claim");
        c.status = ClaimStatus.Disputed;
        emit ClaimDisputed(claimId, block.timestamp);
    }

    function getClaimStatus(bytes32 claimId)
        external
        view
        returns (ClaimStatus status, uint256 approvedAmount, uint256 processedAt)
    {
        Claim storage c = claims[claimId];
        return (c.status, c.approvedAmountNgn, c.processedAt);
    }

    function getPatientClaimIds(bytes32 patientHash)
        external
        view
        returns (bytes32[] memory)
    {
        return patientClaims[patientHash];
    }
}
