// SPDX-License-Identifier: MIT
// MediLedger Nigeria — Enrollment Verifier
// Real-time NHIA program enrollment verification. Hashed identifiers only — no raw patient data.
pragma solidity ^0.8.20;

contract EnrollmentVerifier {
    address public nhiaAdmin;
    uint256 public totalEnrollments;

    enum EnrollmentStatus { Active, Expired, Suspended, Terminated }

    struct Enrollment {
        bytes32 enrollmentId;
        bytes32 patientHash;      // keccak256(nhia_id + salt)
        bytes32 programId;        // NHIA program identifier (BHCPF, NHIS, etc.)
        bytes32 hmoHash;          // keccak256(hmo_id + salt)
        uint256 validFrom;
        uint256 validUntil;
        EnrollmentStatus status;
        bytes32 deactivationReason; // 0 if active
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(bytes32 => Enrollment)   public enrollments;        // enrollmentId → Enrollment
    mapping(bytes32 => bytes32[])    public patientEnrollments; // patientHash → enrollmentIds[]

    // ─── Events ───────────────────────────────────────────────────────
    event EnrollmentRegistered(
        bytes32 indexed enrollmentId,
        bytes32 indexed patientHash,
        bytes32 indexed programId,
        uint256 validUntil
    );
    event EnrollmentUpdated(bytes32 indexed enrollmentId, uint256 newValidUntil, bytes32 newHmoHash);
    event EnrollmentDeactivated(bytes32 indexed enrollmentId, EnrollmentStatus newStatus, bytes32 reason);

    modifier onlyNHIA() {
        require(msg.sender == nhiaAdmin, "Unauthorized: NHIA only");
        _;
    }

    constructor(address _nhiaAdmin) {
        require(_nhiaAdmin != address(0), "Invalid admin address");
        nhiaAdmin = _nhiaAdmin;
    }

    /// @notice Register new NHIA enrollment record
    function registerEnrollment(
        bytes32 enrollmentId,
        bytes32 patientHash,
        bytes32 programId,
        bytes32 hmoHash,
        uint256 validFrom,
        uint256 validUntil
    ) external onlyNHIA {
        require(enrollments[enrollmentId].enrollmentId == bytes32(0), "Enrollment already exists");
        require(validUntil > block.timestamp, "Invalid expiry");
        require(validFrom <= validUntil, "Invalid date range");

        enrollments[enrollmentId] = Enrollment({
            enrollmentId: enrollmentId,
            patientHash: patientHash,
            programId: programId,
            hmoHash: hmoHash,
            validFrom: validFrom,
            validUntil: validUntil,
            status: EnrollmentStatus.Active,
            deactivationReason: bytes32(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        patientEnrollments[patientHash].push(enrollmentId);
        totalEnrollments++;

        emit EnrollmentRegistered(enrollmentId, patientHash, programId, validUntil);
    }

    /// @notice Update enrollment expiry or HMO assignment
    function updateEnrollment(
        bytes32 enrollmentId,
        uint256 newValidUntil,
        bytes32 newHmoHash
    ) external onlyNHIA {
        Enrollment storage e = enrollments[enrollmentId];
        require(e.enrollmentId != bytes32(0), "Enrollment not found");
        require(e.status == EnrollmentStatus.Active, "Enrollment not active");
        require(newValidUntil > block.timestamp, "Invalid new expiry");

        if (newValidUntil != 0) e.validUntil = newValidUntil;
        if (newHmoHash != bytes32(0)) e.hmoHash = newHmoHash;
        e.updatedAt = block.timestamp;

        emit EnrollmentUpdated(enrollmentId, newValidUntil, newHmoHash);
    }

    /// @notice Deactivate enrollment (non-payment, fraud, voluntary withdrawal)
    function deactivateEnrollment(
        bytes32 enrollmentId,
        EnrollmentStatus newStatus,
        bytes32 reason
    ) external onlyNHIA {
        Enrollment storage e = enrollments[enrollmentId];
        require(e.enrollmentId != bytes32(0), "Enrollment not found");
        require(newStatus != EnrollmentStatus.Active, "Use updateEnrollment to reactivate");

        e.status = newStatus;
        e.deactivationReason = reason;
        e.updatedAt = block.timestamp;

        emit EnrollmentDeactivated(enrollmentId, newStatus, reason);
    }

    /// @notice Real-time enrollment verification — called by providers before service delivery
    /// @return isActive True if patient has active enrollment
    /// @return programId The active NHIA program
    /// @return hmoHash The assigned HMO (hashed)
    /// @return validUntil Enrollment expiry timestamp
    function hasActiveEnrollment(bytes32 patientHash)
        external
        view
        returns (
            bool isActive,
            bytes32 programId,
            bytes32 hmoHash,
            uint256 validUntil
        )
    {
        bytes32[] storage eIds = patientEnrollments[patientHash];
        for (uint i = 0; i < eIds.length; i++) {
            Enrollment storage e = enrollments[eIds[i]];
            if (
                e.status == EnrollmentStatus.Active &&
                block.timestamp >= e.validFrom &&
                block.timestamp <= e.validUntil
            ) {
                return (true, e.programId, e.hmoHash, e.validUntil);
            }
        }
        return (false, bytes32(0), bytes32(0), 0);
    }

    /// @notice Full enrollment details for authorized queries
    function getEnrollmentDetails(bytes32 enrollmentId)
        external
        view
        returns (Enrollment memory)
    {
        require(enrollments[enrollmentId].enrollmentId != bytes32(0), "Not found");
        return enrollments[enrollmentId];
    }

    /// @notice Batch verify up to 100 patients in one call (HMO batch eligibility check)
    function batchVerify(bytes32[] calldata patientHashes)
        external
        view
        returns (bool[] memory results, bytes32[] memory programs)
    {
        require(patientHashes.length <= 100, "Max 100 patients per batch");
        results = new bool[](patientHashes.length);
        programs = new bytes32[](patientHashes.length);

        for (uint i = 0; i < patientHashes.length; i++) {
            (bool active, bytes32 prog, , ) = this.hasActiveEnrollment(patientHashes[i]);
            results[i] = active;
            programs[i] = prog;
        }
    }
}
