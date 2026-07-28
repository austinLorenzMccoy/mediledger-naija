// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VaultIntegrityVerifier.sol";

interface IConsentRegistry {
    function grantConsent(
        bytes32 consentId,
        bytes32 patientHash,
        bytes32 requesterHash,
        uint8   requesterType,
        bytes32 scopeHash,
        uint256 validFrom,
        uint256 validUntil,
        uint96  monthlyPaymentHeal
    ) external;
}

/**
 * VaultAwareConsentRegistry
 *
 * Optional Phase-2 wrapper around ConsentRegistry.sol that requires a valid
 * Groth16 vault integrity proof before granting consent.
 *
 * Deployment order:
 *   1. Deploy VaultIntegrityVerifier
 *   2. Deploy ConsentRegistry
 *   3. Deploy VaultAwareConsentRegistry(verifier, consentRegistry)
 *   4. ConsentRegistry.transferAdmin(vaultAwareConsentRegistry)  // so grantConsent succeeds
 *
 * After step 4, only grantConsentWithProof can create consents (via this wrapper).
 * ConsentRegistry.sol itself is unchanged.
 */
contract VaultAwareConsentRegistry {
    VaultIntegrityVerifier public immutable verifier;
    IConsentRegistry       public immutable consentRegistry;
    address                public            nhiaAdmin;

    /// Minimum age of a proof timestamp is not enforced; max age is (seconds).
    /// 0 = disabled (accept any positive timestamp that the circuit already requires).
    uint256 public maxProofAgeSeconds;

    event ConsentGrantedWithProof(
        bytes32 indexed consentId,
        bytes32 indexed patientHash,
        uint256         vaultCommitment,
        uint256         recordRoot,
        uint256         timestamp
    );
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event MaxProofAgeUpdated(uint256 maxProofAgeSeconds);

    modifier onlyNHIA() {
        require(msg.sender == nhiaAdmin, "Caller is not NHIA admin");
        _;
    }

    constructor(address _verifier, address _registry) {
        require(_verifier != address(0) && _registry != address(0), "Zero address");
        verifier        = VaultIntegrityVerifier(_verifier);
        consentRegistry = IConsentRegistry(_registry);
        nhiaAdmin       = msg.sender;
        maxProofAgeSeconds = 7 days;
    }

    /**
     * Grant consent only if the patient's vault proof is valid.
     * publicSignals = [vaultCommitment, recordRoot, timestamp]
     *
     * Requires this contract to be nhiaAdmin on ConsentRegistry (see deployment notes).
     */
    function grantConsentWithProof(
        uint[2]    calldata proofA,
        uint[2][2] calldata proofB,
        uint[2]    calldata proofC,
        uint[3]    calldata publicSignals, // [vaultCommitment, recordRoot, timestamp]
        bytes32 consentId,
        bytes32 patientHash,
        bytes32 requesterHash,
        uint8   requesterType,
        bytes32 scopeHash,
        uint256 validFrom,
        uint256 validUntil,
        uint96  monthlyPaymentHeal
    ) external onlyNHIA {
        require(
            verifier.verifyProof(proofA, proofB, proofC, publicSignals),
            "Invalid vault integrity proof"
        );

        // Optional freshness check against block.timestamp
        if (maxProofAgeSeconds > 0) {
            uint256 proofTs = publicSignals[2];
            require(proofTs <= block.timestamp + 5 minutes, "Proof timestamp in future");
            require(block.timestamp - proofTs <= maxProofAgeSeconds, "Proof too old");
        }

        consentRegistry.grantConsent(
            consentId,
            patientHash,
            requesterHash,
            requesterType,
            scopeHash,
            validFrom,
            validUntil,
            monthlyPaymentHeal
        );

        emit ConsentGrantedWithProof(
            consentId,
            patientHash,
            publicSignals[0],
            publicSignals[1],
            publicSignals[2]
        );
    }

    function setMaxProofAge(uint256 seconds_) external onlyNHIA {
        maxProofAgeSeconds = seconds_;
        emit MaxProofAgeUpdated(seconds_);
    }

    function transferAdmin(address newAdmin) external onlyNHIA {
        require(newAdmin != address(0), "Zero address");
        address old = nhiaAdmin;
        nhiaAdmin = newAdmin;
        emit AdminTransferred(old, newAdmin);
    }
}
