#!/usr/bin/env node
/**
 * Offline ZK integration test (no Nest, no Redis required for prove/verify).
 * Optionally hits a running zk-vault HTTP API if ZK_VAULT_URL + INTERNAL_API_KEY set.
 *
 * Usage:
 *   cd backend/services/zk-vault && npm run test:integration
 *   # or from repo root:
 *   node backend/services/zk-vault/scripts/test-zk-flow.js
 *
 * Env (optional HTTP stage):
 *   ZK_VAULT_URL=http://localhost:3012
 *   INTERNAL_API_KEY=...
 *   CIRCUITS_DIR=../../circuits   (relative to this package)
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function main() {
  const snarkjs = require('snarkjs');
  const { buildPoseidon } = require('circomlibjs');

  const defaultCircuits = path.join(__dirname, '..', '..', '..', 'circuits');
  let CIRCUITS_DIR = path.resolve(process.env.CIRCUITS_DIR || defaultCircuits);
  // Docker env sets CIRCUITS_DIR=/circuits — fall back when that path is absent locally
  if (!fs.existsSync(path.join(CIRCUITS_DIR, 'keys', 'vault_integrity.zkey'))) {
    CIRCUITS_DIR = path.resolve(defaultCircuits);
  }

  const vaultWasm = path.join(CIRCUITS_DIR, 'build', 'vault_integrity_js', 'vault_integrity.wasm');
  const vaultZkey = path.join(CIRCUITS_DIR, 'keys', 'vault_integrity.zkey');
  const vaultVkey = path.join(CIRCUITS_DIR, 'keys', 'verification_key_vault_integrity.json');
  const condWasm = path.join(CIRCUITS_DIR, 'build', 'condition_proof_js', 'condition_proof.wasm');
  const condZkey = path.join(CIRCUITS_DIR, 'keys', 'condition_proof.zkey');
  const condVkey = path.join(CIRCUITS_DIR, 'keys', 'verification_key_condition_proof.json');
  const scopeWasm = path.join(CIRCUITS_DIR, 'build', 'consent_scope_js', 'consent_scope.wasm');
  const scopeZkey = path.join(CIRCUITS_DIR, 'keys', 'consent_scope.zkey');
  const scopeVkey = path.join(CIRCUITS_DIR, 'keys', 'verification_key_consent_scope.json');

  for (const f of [vaultWasm, vaultZkey, vaultVkey, condWasm, condZkey, scopeWasm, scopeZkey]) {
    if (!fs.existsSync(f)) {
      console.error('Missing artifact:', f);
      console.error('Run: cd backend/circuits && bash scripts/setup-circuits.sh');
      process.exit(1);
    }
  }

  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const hash2 = (a, b) => F.toObject(poseidon([a, b]));

  const nhiaId = 'NHIA-TEST-001';
  const vaultKeyHex = crypto.randomBytes(32).toString('hex');
  const recordHashes = [
    crypto.createHash('sha256').update('fhir-record-1').digest('hex'),
    crypto.createHash('sha256').update('fhir-record-2').digest('hex'),
  ];

  // Match service field encoding
  const nhiaField = BigInt(
    '0x' + crypto.createHash('sha256').update(nhiaId).digest().slice(0, 31).toString('hex'),
  );
  const keyBuf = Buffer.from(vaultKeyHex, 'hex');
  const lo = BigInt('0x' + keyBuf.slice(0, 16).toString('hex'));
  const hi = BigInt('0x' + keyBuf.slice(16).toString('hex'));
  const vaultKeyField = hash2(lo, hi);
  const vaultCommitment = hash2(vaultKeyField, nhiaField);

  const leaves = recordHashes.map((h) => BigInt('0x' + h.slice(0, 62)));
  while (leaves.length < 8) leaves.push(0n);
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hash2(level[i], level[i + 1] ?? 0n));
    }
    level = next;
  }
  const recordRoot = level[0];
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  console.log('── 1. VaultIntegrity fullProve + verify ──');
  const vaultInput = {
    vaultKey: vaultKeyField.toString(),
    recordHashes: leaves.map(String),
    patientNhiaIdHash: nhiaField.toString(),
    vaultCommitment: vaultCommitment.toString(),
    recordRoot: recordRoot.toString(),
    timestamp: timestamp.toString(),
  };
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(vaultInput, vaultWasm, vaultZkey);
  const proveMs = Date.now() - t0;
  const vkey = JSON.parse(fs.readFileSync(vaultVkey, 'utf8'));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  console.log(`   prove ${proveMs}ms | verify=${ok} | commitment=${vaultCommitment.toString().slice(0, 20)}…`);
  if (!ok) throw new Error('Vault proof failed verification');

  console.log('── 2. ConditionProof (blood type O+) ──');
  const CONDITION_CODE = 882n;
  const CONDITION_VALUE = 6n;
  const recordValue = CONDITION_CODE * 10000n + CONDITION_VALUE;
  const recordHash = leaves[0];
  const condInput = {
    recordValue: recordValue.toString(),
    recordHash: recordHash.toString(),
    vaultKey: vaultKeyField.toString(),
    patientNhiaIdHash: nhiaField.toString(),
    conditionCode: CONDITION_CODE.toString(),
    conditionValue: CONDITION_VALUE.toString(),
    vaultCommitment: vaultCommitment.toString(),
    recordHashPublic: recordHash.toString(),
  };
  const { proof: cProof, publicSignals: cSignals } = await snarkjs.groth16.fullProve(
    condInput, condWasm, condZkey,
  );
  const cVkey = JSON.parse(fs.readFileSync(condVkey, 'utf8'));
  const cOk = await snarkjs.groth16.verify(cVkey, cSignals, cProof);
  console.log(`   condition verify=${cOk}`);
  if (!cOk) throw new Error('Condition proof failed');

  console.log('── 3. ConsentScopeProof (requestedType in scope) ──');
  const scopeItems = [1n, 2n, 3n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]; // 1=lab
  const consentIdField = BigInt(
    '0x' + crypto.createHash('sha256').update('consent-uuid-1').digest().slice(0, 31).toString('hex'),
  );
  const scopeHash = BigInt(
    '0x' + crypto.createHash('sha256').update('scope-json').digest().slice(0, 31).toString('hex'),
  );
  const scopeInput = {
    scopeItems: scopeItems.map(String),
    consentId: consentIdField.toString(),
    patientNhiaIdHash: nhiaField.toString(),
    requestedType: '1',
    scopeHash: scopeHash.toString(),
    consentIdPublic: consentIdField.toString(),
  };
  const { proof: sProof, publicSignals: sSignals } = await snarkjs.groth16.fullProve(
    scopeInput, scopeWasm, scopeZkey,
  );
  const sVkey = JSON.parse(fs.readFileSync(scopeVkey, 'utf8'));
  const sOk = await snarkjs.groth16.verify(sVkey, sSignals, sProof);
  console.log(`   consent-scope verify=${sOk}`);
  if (!sOk) throw new Error('Consent scope proof failed');

  // Optional HTTP API stage
  const base = process.env.ZK_VAULT_URL;
  const key = process.env.INTERNAL_API_KEY;
  if (base && key) {
    console.log(`── 4. HTTP API against ${base} ──`);
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-key': key,
    };

    const health = await fetch(`${base}/api/v1/zk/health`).then((r) => r.json());
    console.log('   health:', health.status, health.artifacts);

    const seal = await fetch(`${base}/api/v1/zk/seal-vault`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nhiaId,
        vaultKeyHex,
        recordHashes,
      }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(`seal-vault ${r.status}: ${JSON.stringify(body)}`);
      return body;
    });
    console.log('   seal:', {
      proofHash: seal.proofHash?.slice(0, 16),
      dbUpdated: seal.dbUpdated,
    });

    const got = await fetch(`${base}/api/v1/zk/proof/${encodeURIComponent(nhiaId)}`, {
      headers,
    }).then((r) => r.json());

    const verify = await fetch(`${base}/api/v1/zk/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ proof: got.proof, publicSignals: got.publicSignals }),
    }).then((r) => r.json());
    console.log('   http verify:', verify);
    if (!verify.valid) throw new Error('HTTP verify returned valid=false');
  } else {
    console.log('── 4. HTTP stage skipped (set ZK_VAULT_URL + INTERNAL_API_KEY) ──');
  }

  console.log('\n✓ All ZK integration checks passed');
  // snarkjs leaves worker handles open — force clean exit
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
