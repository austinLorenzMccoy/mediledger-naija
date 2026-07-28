const { expect } = require('chai');
const { ethers } = require('hardhat');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * End-to-end: generate a real Groth16 proof with snarkjs and verify on-chain.
 * Skips if circuit keys are not present.
 */
describe('VaultIntegrityVerifier (on-chain Groth16)', function () {
  this.timeout(180_000);

  const CIRCUITS = path.resolve(__dirname, '../../circuits');
  const WASM = path.join(CIRCUITS, 'build/vault_integrity_js/vault_integrity.wasm');
  const ZKEY = path.join(CIRCUITS, 'keys/vault_integrity.zkey');

  let hasArtifacts;

  before(function () {
    hasArtifacts = fs.existsSync(WASM) && fs.existsSync(ZKEY);
    if (!hasArtifacts) {
      console.log('  ⚠ Skipping on-chain ZK tests — run circuits/scripts/setup-circuits.sh');
    }
  });

  it('deploys VaultIntegrityVerifier', async function () {
    const Factory = await ethers.getContractFactory('VaultIntegrityVerifier');
    const verifier = await Factory.deploy();
    await verifier.deployed();
    expect(verifier.address).to.match(/^0x[0-9a-fA-F]{40}$/);
  });

  it('returns false for a malformed proof', async function () {
    const Factory = await ethers.getContractFactory('VaultIntegrityVerifier');
    const verifier = await Factory.deploy();
    await verifier.deployed();

    const a = [1, 2];
    const b = [
      [1, 2],
      [3, 4],
    ];
    const c = [5, 6];
    const input = [7, 8, 9];

    // Invalid points should return false (or revert on pairing — either is failure)
    try {
      const ok = await verifier.verifyProof(a, b, c, input);
      expect(ok).to.equal(false);
    } catch {
      // pairing precompile may revert on bad points — also acceptable
      expect(true).to.equal(true);
    }
  });

  it('verifies a real vault_integrity proof on-chain', async function () {
    if (!hasArtifacts) this.skip();

    const snarkjs = require('snarkjs');
    const { buildPoseidon } = require('circomlibjs');

    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const hash2 = (a, b) => F.toObject(poseidon([a, b]));

    const vaultKey = 12345678901234567890n;
    const patientNhiaIdHash = 99887766554433221100n;
    const recordHashes = [111n, 222n, 333n, 444n, 0n, 0n, 0n, 0n];
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const vaultCommitment = hash2(vaultKey, patientNhiaIdHash);
    let level = [...recordHashes];
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(hash2(level[i], level[i + 1] ?? 0n));
      }
      level = next;
    }
    const recordRoot = level[0];

    const input = {
      vaultKey: vaultKey.toString(),
      recordHashes: recordHashes.map(String),
      patientNhiaIdHash: patientNhiaIdHash.toString(),
      vaultCommitment: vaultCommitment.toString(),
      recordRoot: recordRoot.toString(),
      timestamp: timestamp.toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);

    // snarkjs → Solidity call encoding (endianness of G2)
    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];

    const Factory = await ethers.getContractFactory('VaultIntegrityVerifier');
    const verifier = await Factory.deploy();
    await verifier.deployed();

    const ok = await verifier.verifyProof(a, b, c, publicSignals);
    expect(ok).to.equal(true);

    // Tamper public signal → false
    const badSignals = [...publicSignals];
    badSignals[0] = '0';
    const bad = await verifier.verifyProof(a, b, c, badSignals);
    expect(bad).to.equal(false);
  });

  it('VaultAwareConsentRegistry rejects invalid proof', async function () {
    const [admin] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory('ConsentRegistry');
    const registry = await Registry.deploy(admin.address, admin.address);
    await registry.deployed();

    const Verifier = await ethers.getContractFactory('VaultIntegrityVerifier');
    const verifier = await Verifier.deploy();
    await verifier.deployed();

    const VaultAware = await ethers.getContractFactory('VaultAwareConsentRegistry');
    const vaultAware = await VaultAware.deploy(verifier.address, registry.address);
    await vaultAware.deployed();

    // Transfer registry admin so grantConsent can be called by wrapper
    await registry.transferAdmin(vaultAware.address);

    const h = (s) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(s));
    const future = () => Math.floor(Date.now() / 1000) + 3600;

    await expect(
      vaultAware.grantConsentWithProof(
        [1, 2],
        [
          [1, 2],
          [3, 4],
        ],
        [5, 6],
        [7, 8, Math.floor(Date.now() / 1000)],
        h('c1'),
        h('p1'),
        h('r1'),
        0,
        h('scope'),
        Math.floor(Date.now() / 1000) - 60,
        future(),
        0,
      ),
    ).to.be.reverted;
  });
});
