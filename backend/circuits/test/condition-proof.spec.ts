import { wasm as wasmTester } from 'circom_tester';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import * as path from 'path';
import * as fs from 'fs';
import { strict as assert } from 'assert';

describe('ConditionProof Circuit', function () {
  this.timeout(180_000);

  let poseidon: any;
  let circuit: any;

  const CIRCUIT_PATH = path.join(__dirname, '../condition_proof.circom');
  const WASM_PATH    = path.join(__dirname, '../build/condition_proof_js/condition_proof.wasm');
  const ZKEY_PATH    = path.join(__dirname, '../keys/condition_proof.zkey');
  const VKEY_PATH    = path.join(__dirname, '../keys/verification_key_condition_proof.json');

  // Blood type O+ → LOINC 882-1, value code 6
  const CONDITION_CODE  = 882n;
  const CONDITION_VALUE = 6n;
  const RECORD_VALUE    = CONDITION_CODE * 10_000n + CONDITION_VALUE; // 8820006

  const vaultKey          = 12345678901234567890n;
  const patientNhiaIdHash = 99887766554433221100n;
  const recordHash        = 111222333444555n; // simulated SHA-256-as-field-element

  let vaultCommitment: bigint;
  let validInput: Record<string, string>;

  before(async () => {
    poseidon = await buildPoseidon();
    circuit  = await wasmTester(CIRCUIT_PATH);
    vaultCommitment = poseidon.F.toObject(poseidon([vaultKey, patientNhiaIdHash]));

    validInput = {
      recordValue:       RECORD_VALUE.toString(),
      recordHash:        recordHash.toString(),
      vaultKey:          vaultKey.toString(),
      patientNhiaIdHash: patientNhiaIdHash.toString(),
      conditionCode:     CONDITION_CODE.toString(),
      conditionValue:    CONDITION_VALUE.toString(),
      vaultCommitment:   vaultCommitment.toString(),
      recordHashPublic:  recordHash.toString(),
    };
  });

  it('generates valid witness for correct blood-type proof', async () => {
    const witness = await circuit.calculateWitness(validInput);
    await circuit.checkConstraints(witness);
  });

  it('rejects wrong conditionValue (O+ vs A+)', async () => {
    const bad = { ...validInput, conditionValue: '1' }; // 1 = A+
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('rejects tampered recordHash (record integrity check)', async () => {
    const bad = { ...validInput, recordHashPublic: '999' };
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('rejects wrong vaultKey (record does not belong to vault)', async () => {
    const bad = { ...validInput, vaultKey: '9999' };
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('produces a valid Groth16 proof for blood-type query (end-to-end)', async function () {
    if (!fs.existsSync(ZKEY_PATH)) this.skip();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      validInput, WASM_PATH, ZKEY_PATH,
    );
    const vkey  = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf-8'));
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    assert.strictEqual(valid, true);
  });
});
