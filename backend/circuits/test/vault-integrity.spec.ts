import { wasm as wasmTester } from 'circom_tester';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import * as path from 'path';
import * as fs from 'fs';
import { strict as assert } from 'assert';

// Replicates the circuit's MerkleRoot(8) logic in JS for public input generation
function computeMerkleRoot(poseidon: any, leaves: bigint[]): bigint {
  let level = [...leaves];
  while (level.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const h = poseidon([level[i], level[i + 1] ?? 0n]);
      next.push(poseidon.F.toObject(h));
    }
    level = next;
  }
  return level[0];
}

describe('VaultIntegrity Circuit', function () {
  this.timeout(180_000); // proof generation takes ~30s on first run

  let poseidon: any;
  let circuit: any;

  const CIRCUIT_PATH = path.join(__dirname, '../vault_integrity.circom');
  const WASM_PATH    = path.join(__dirname, '../build/vault_integrity_js/vault_integrity.wasm');
  const ZKEY_PATH    = path.join(__dirname, '../keys/vault_integrity.zkey');
  const VKEY_PATH    = path.join(__dirname, '../keys/verification_key_vault_integrity.json');

  const vaultKey         = 12345678901234567890n;
  const patientNhiaIdHash = 99887766554433221100n;
  const recordHashes     = [111n, 222n, 333n, 444n, 0n, 0n, 0n, 0n];
  const timestamp        = 1_700_000_000n;

  let vaultCommitment: bigint;
  let recordRoot: bigint;
  let validInput: Record<string, string | string[]>;

  before(async () => {
    poseidon = await buildPoseidon();
    circuit  = await wasmTester(CIRCUIT_PATH);

    vaultCommitment = poseidon.F.toObject(poseidon([vaultKey, patientNhiaIdHash]));
    recordRoot      = computeMerkleRoot(poseidon, recordHashes);

    validInput = {
      vaultKey:           vaultKey.toString(),
      recordHashes:       recordHashes.map(h => h.toString()),
      patientNhiaIdHash:  patientNhiaIdHash.toString(),
      vaultCommitment:    vaultCommitment.toString(),
      recordRoot:         recordRoot.toString(),
      timestamp:          timestamp.toString(),
    };
  });

  it('generates valid witness for correct inputs', async () => {
    const witness = await circuit.calculateWitness(validInput);
    await circuit.checkConstraints(witness);
  });

  it('rejects wrong vaultKey (commitment mismatch)', async () => {
    const bad = { ...validInput, vaultKey: '9999' };
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('rejects tampered recordHash (root mismatch)', async () => {
    const tamperedHashes = [...recordHashes];
    tamperedHashes[0] = 999_999n;
    const bad = {
      ...validInput,
      recordHashes: tamperedHashes.map(h => h.toString()),
    };
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('rejects timestamp = 0', async () => {
    const bad = { ...validInput, timestamp: '0' };
    await assert.rejects(circuit.calculateWitness(bad));
  });

  it('produces a valid Groth16 proof (end-to-end)', async function () {
    if (!fs.existsSync(ZKEY_PATH)) {
      this.skip(); // Skip if trusted setup hasn't been run yet
    }
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      validInput, WASM_PATH, ZKEY_PATH,
    );
    const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf-8'));
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    assert.strictEqual(valid, true);
  });

  it('rejects invalid proof during verification', async function () {
    if (!fs.existsSync(ZKEY_PATH)) {
      this.skip();
    }
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      validInput, WASM_PATH, ZKEY_PATH,
    );
    // Tamper with a public signal
    const badSignals = [...publicSignals];
    badSignals[0] = '0';
    const vkey  = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf-8'));
    const valid = await snarkjs.groth16.verify(vkey, badSignals, proof);
    assert.strictEqual(valid, false);
  });
});
