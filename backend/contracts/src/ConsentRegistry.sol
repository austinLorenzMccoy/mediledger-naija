// SPDX-License-Identifier: MIT
// Hedera Smart Contract Service (HSCS) — Solidity 0.8.20
// MediLedger Nigeria — Consent Registry
// Stores consent grants/revocations as immutable events. Raw patient data never on-chain.
pragma solidity ^0.8.20;

contract ConsentRegistry {
    // ─── State Variables ──────────────────────────────────────────────
    address public nhiaAdmin;
    address public nhiaGovernance; // Timelock contract for admin changes
    uint256 public totalConsents;
    uint256 public activeConsents;

    struct Consent {
        bytes32 consentId;       // keccak256(uuid from backend DB)
        bytes32 patientHash;     // keccak256(nhia_id + salt)
        bytes32 requesterHash;   // keccak256(facility_id + salt)
        uint8   requesterType;   // 0=provider, 1=hmo, 2=researcher, 3=emergency
        bytes32 scopeHash;       // keccak256(JSON.stringify(data_scope))
        uint256 validFrom;       // Unix timestamp
        uint256 validUntil;      // Unix timestamp
        uint96  monthlyPaymentHeal; // HEAL tokens × 10^4 (4 decimal places)
        uint8   status;          // 0=active, 1=expired, 2=revoked
        uint256 createdAt;
        uint256 revokedAt;       // 0 if not revoked
    }

    mapping(bytes32 => Consent)   public consents;         // consentId → Consent
    mapping(bytes32 => bytes32[]) public patientConsents;  // patientHash → consentIds[]
    mapping(bytes32 => bytes32[]) public requesterConsents; // requesterHash → consentIds[]

    // ─── Events ───────────────────────────────────────────────────────
    event ConsentGranted(
        bytes32 indexed consentId,
        bytes32 indexed patientHash,
        bytes32 indexed requesterHash,
        uint256 validUntil,
        uint96 monthlyPaymentHeal
    );
    event ConsentRevoked(bytes32 indexed consentId, bytes32 indexed patientHash, uint256 revokedAt);
    event ConsentExpired(bytes32 indexed consentId, uint256 expiredAt);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyNHIA() {
        require(msg.sender == nhiaAdmin, "Unauthorized: NHIA only");
        _;
    }

    modifier validConsent(bytes32 id) {
        require(consents[id].consentId != bytes32(0), "Consent not found");
        require(consents[id].status == 0, "Consent not active");
        require(block.timestamp <= consents[id].validUntil, "Consent expired");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _nhiaAdmin, address _governance) {
        require(_nhiaAdmin != address(0), "Invalid admin address");
        nhiaAdmin = _nhiaAdmin;
        nhiaGovernance = _governance;
    }

    // ─── Core Functions ───────────────────────────────────────────────

    /// @notice Register a new patient-granted consent
    /// @dev Only callable by NHIA-verified backend service
    function grantConsent(
        bytes32 consentId,
        bytes32 patientHash,
        bytes32 requesterHash,
        uint8   requesterType,
        bytes32 scopeHash,
        uint256 validFrom,
        uint256 validUntil,
        uint96  monthlyPaymentHeal
    ) external onlyNHIA {
        require(consents[consentId].consentId == bytes32(0), "Consent ID already exists");
        require(validUntil > block.timestamp, "Invalid expiry");
        require(validFrom <= validUntil, "Invalid date range");
        require(requesterType <= 3, "Invalid requester type");

        consents[consentId] = Consent({
            consentId: consentId,
            patientHash: patientHash,
            requesterHash: requesterHash,
            requesterType: requesterType,
            scopeHash: scopeHash,
            validFrom: validFrom,
            validUntil: validUntil,
            monthlyPaymentHeal: monthlyPaymentHeal,
            status: 0,
            createdAt: block.timestamp,
            revokedAt: 0
        });

        patientConsents[patientHash].push(consentId);
        requesterConsents[requesterHash].push(consentId);
        totalConsents++;
        activeConsents++;

        emit ConsentGranted(consentId, patientHash, requesterHash, validUntil, monthlyPaymentHeal);
    }

    /// @notice Revoke an active consent
    function revokeConsent(bytes32 consentId) external onlyNHIA validConsent(consentId) {
        consents[consentId].status = 2;
        consents[consentId].revokedAt = block.timestamp;
        activeConsents--;
        emit ConsentRevoked(consentId, consents[consentId].patientHash, block.timestamp);
    }

    /// @notice Check if requester has active consent for patient
    function hasActiveConsent(bytes32 patientHash, bytes32 requesterHash)
        external
        view
        returns (bool hasConsent, bytes32 activeConsentId)
    {
        bytes32[] storage cIds = patientConsents[patientHash];
        for (uint i = 0; i < cIds.length; i++) {
            Consent storage c = consents[cIds[i]];
            if (
                c.requesterHash == requesterHash &&
                c.status == 0 &&
                block.timestamp >= c.validFrom &&
                block.timestamp <= c.validUntil
            ) {
                return (true, cIds[i]);
            }
        }
        return (false, bytes32(0));
    }

    /// @notice Batch expire consents past validUntil (called by backend cron)
    function expireConsents(bytes32[] calldata ids) external onlyNHIA {
        for (uint i = 0; i < ids.length; i++) {
            Consent storage c = consents[ids[i]];
            if (c.status == 0 && block.timestamp > c.validUntil) {
                c.status = 1;
                activeConsents--;
                emit ConsentExpired(ids[i], block.timestamp);
            }
        }
    }

    /// @notice Get all consent IDs for a patient (for dashboard queries)
    function getPatientConsentIds(bytes32 patientHash)
        external
        view
        returns (bytes32[] memory)
    {
        return patientConsents[patientHash];
    }

    /// @notice Transfer admin — only via governance timelock
    function transferAdmin(address newAdmin) external {
        require(msg.sender == nhiaGovernance, "Only governance can transfer admin");
        require(newAdmin != address(0), "Invalid address");
        emit AdminTransferred(nhiaAdmin, newAdmin);
        nhiaAdmin = newAdmin;
    }
}
