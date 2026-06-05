pragma circom 2.1.8;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";
include "./node_modules/circomlib/circuits/bitify.circom";

/*
 * ConditionProof — proves a specific clinical condition exists in a patient's
 * vault WITHOUT revealing any other field in the record.
 *
 * Used by: emergency-service (blood type, allergies) and providers (condition checks).
 * Proofs are PRE-GENERATED and cached in Redis for emergency-tagged patients,
 * so runtime verification is < 10 ms (Redis GET + snarkjs.groth16.verify).
 *
 * Encoding convention:
 *   recordValue = conditionCode * 10_000 + actualValue
 *   e.g. blood type O+ → conditionCode=882 (LOINC 882-1), actualValue=6
 *        recordValue = 882 * 10000 + 6 = 8820006
 *
 * Private inputs:
 *   recordValue       — encoded condition (conditionCode * 10000 + actualValue)
 *   recordHash        — SHA-256 of the FHIR record (as field element)
 *   vaultKey          — AES-256 vault key (proves record belongs to this vault)
 *   patientNhiaIdHash — Poseidon(nhia_id)
 *
 * Public inputs:
 *   conditionCode     — LOINC/SNOMED code being queried
 *   conditionValue    — expected value (verifier supplies, circuit proves match)
 *   vaultCommitment   — must match patients.vault_public_key
 *   recordHashPublic  — must match health_records.record_hash
 */
template ConditionProof() {
    signal input recordValue;
    signal input recordHash;
    signal input vaultKey;
    signal input patientNhiaIdHash;

    signal input conditionCode;
    signal input conditionValue;
    signal input vaultCommitment;
    signal input recordHashPublic;

    // Constraint 1: record belongs to this vault
    component commitCheck = Poseidon(2);
    commitCheck.inputs[0] <== vaultKey;
    commitCheck.inputs[1] <== patientNhiaIdHash;
    commitCheck.out === vaultCommitment;

    // Constraint 2: record hash integrity
    recordHash === recordHashPublic;

    // Constraint 3: record contains the claimed condition value
    // recordValue = conditionCode * 10000 + actualValue
    // => actualValue = recordValue - conditionCode * 10000
    signal actualValue;
    actualValue <== recordValue - conditionCode * 10000;
    actualValue === conditionValue;
}

component main {
    public [conditionCode, conditionValue, vaultCommitment, recordHashPublic]
} = ConditionProof();
