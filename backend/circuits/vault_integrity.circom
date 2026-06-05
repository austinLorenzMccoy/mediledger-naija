pragma circom 2.1.8;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";
include "./node_modules/circomlib/circuits/mux1.circom";

// Poseidon Merkle root over N=8 leaves (padded with 0 for empty slots)
template MerkleRoot(N) {
    signal input  leaves[N];
    signal output root;

    signal level1[4];
    signal level2[2];

    component hashLeaf[4];
    component hashL1[2];
    component hashL2;

    for (var i = 0; i < 4; i++) {
        hashLeaf[i] = Poseidon(2);
        hashLeaf[i].inputs[0] <== leaves[i * 2];
        hashLeaf[i].inputs[1] <== leaves[i * 2 + 1];
        level1[i] <== hashLeaf[i].out;
    }

    for (var i = 0; i < 2; i++) {
        hashL1[i] = Poseidon(2);
        hashL1[i].inputs[0] <== level1[i * 2];
        hashL1[i].inputs[1] <== level1[i * 2 + 1];
        level2[i] <== hashL1[i].out;
    }

    hashL2 = Poseidon(2);
    hashL2.inputs[0] <== level2[0];
    hashL2.inputs[1] <== level2[1];
    root <== hashL2.out;
}

/*
 * VaultIntegrity — proves a patient vault is authentic and unmodified.
 *
 * Private inputs (prover only):
 *   vaultKey          — AES-256 vault encryption key as BN254 field element
 *   recordHashes[8]   — SHA-256 of each FHIR record (zero-padded to 8)
 *   patientNhiaIdHash — Poseidon(nhia_id) — blinded patient identity
 *
 * Public inputs (verifier checks against on-chain values):
 *   vaultCommitment   — Poseidon(vaultKey, patientNhiaIdHash) stored in patients.vault_public_key
 *   recordRoot        — Poseidon Merkle root of recordHashes stored in patients.zk_proof_hash
 *   timestamp         — Unix timestamp (replay-attack guard, must be > 0)
 *
 * ~1,200 constraints — well within ptau 15 (2^15 = 32,768 limit)
 */
template VaultIntegrity(N) {
    signal input vaultKey;
    signal input recordHashes[N];
    signal input patientNhiaIdHash;

    signal input vaultCommitment;
    signal input recordRoot;
    signal input timestamp;

    // Constraint 1: vaultCommitment == Poseidon(vaultKey, patientNhiaIdHash)
    component commitHasher = Poseidon(2);
    commitHasher.inputs[0] <== vaultKey;
    commitHasher.inputs[1] <== patientNhiaIdHash;
    commitHasher.out === vaultCommitment;

    // Constraint 2: recordRoot == Poseidon Merkle root of recordHashes
    component merkle = MerkleRoot(N);
    for (var i = 0; i < N; i++) {
        merkle.leaves[i] <== recordHashes[i];
    }
    merkle.root === recordRoot;

    // Constraint 3: timestamp > 0 (replay guard)
    component gtZero = GreaterThan(64);
    gtZero.in[0] <== timestamp;
    gtZero.in[1] <== 0;
    gtZero.out === 1;
}

component main { public [vaultCommitment, recordRoot, timestamp] } = VaultIntegrity(8);
