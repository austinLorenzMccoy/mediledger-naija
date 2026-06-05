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
 * Optional wrapper around the existing ConsentRegistry.sol that adds a
 * Groth16 vault integrity proof gate: consent can only be granted if the
 * patient's vault proof is valid on-chain at the moment of granting.
 *
 * Deploy after VaultIntegrityVerifier.sol. ConsentRegistry.sol is UNCHANGED.
 * Either contract can be used independently — this is Phase 2 hardening.
 *
 * Hedera HSCS deployment:
 *   npx hardhat run scripts/deploy-verifier.js --network hedera_testnet
 */
contract VaultAwareConsentRegistry {
    VaultIntegrityVerifier public immutable verifier;
    IConsentRegistry       public immutable consentRegistry;
    address                public            nhiaAdmin;

    event ConsentGrantedWithProof(
        bytes32 indexed consentId,
        bytes32 indexed patientHash,
        uint256         vaultCommitment,
        uint256         recordRoot,
        uint256         timestamp
    );

    modifier onlyNHIA() {
        require(msg.sender == nhiaAdmin, "Caller is not NHIA admin");
        _;
    }

    constructor(address _verifier, address _registry) {
        verifier        = VaultIntegrityVerifier(_verifier);
        consentRegistry = IConsentRegistry(_registry);
        nhiaAdmin       = msg.sender;
    }

    /**
     * Grant consent only if the patient's vault proof is valid.
     * publicSignals = [vaultCommitment, recordRoot, timestamp]
     */
    function grantConsentWithProof(
        // Groth16 proof components
        uint[2]    calldata proofA,
        uint[2][2] calldata proofB,
        uint[2]    calldata proofC,
        uint[3]    calldata publicSignals, // [vaultCommitment, recordRoot, timestamp]
        // Standard ConsentRegistry params
        bytes32 consentId,
        bytes32 patientHash,
        bytes32 requesterHash,
        uint8   requesterType,
        bytes32 scopeHash,
        uint256 validFrom,
        uint256 validUntil,
        uint96  monthlyPaymentHeal
    ) external {
        require(
            verifier.verifyProof(proofA, proofB, proofC, publicSignals),
            "Invalid vault integrity proof"
        );

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
            publicSignals[0], // vaultCommitment
            publicSignals[1], // recordRoot
            publicSignals[2]  // timestamp
        );
    }

    function transferAdmin(address newAdmin) external onlyNHIA {
        nhiaAdmin = newAdmin;
    }
}
