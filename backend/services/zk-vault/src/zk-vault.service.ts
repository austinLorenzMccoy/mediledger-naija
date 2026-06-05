import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as snarkjs from 'snarkjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildPoseidon } from 'circomlibjs';
import { ProofCacheService } from './proof-cache.service';
import { SealVaultDto } from './dto/seal-vault.dto';
import { ConditionProofDto } from './dto/condition-proof.dto';

const CIRCUITS_DIR = path.resolve(
  process.env.CIRCUITS_DIR ?? path.join(__dirname, '..', '..', '..', '..', 'circuits'),
);

interface VaultProofCacheEntry {
  proof: object;
  publicSignals: string[];
  proofHash: string;
  vaultCommitment: string;
  recordRoot: string;
  generatedAt: string;
}

@Injectable()
export class ZkVaultService implements OnModuleInit {
  private readonly logger = new Logger(ZkVaultService.name);
  private poseidon: any;

  // Circuit artifacts — loaded once at startup
  private readonly vaultWasm = path.join(CIRCUITS_DIR, 'build', 'vault_integrity_js', 'vault_integrity.wasm');
  private readonly vaultZkey = path.join(CIRCUITS_DIR, 'keys', 'vault_integrity.zkey');
  private readonly vaultVkey = this.loadJson(path.join(CIRCUITS_DIR, 'keys', 'verification_key_vault_integrity.json'));

  private readonly condWasm  = path.join(CIRCUITS_DIR, 'build', 'condition_proof_js', 'condition_proof.wasm');
  private readonly condZkey  = path.join(CIRCUITS_DIR, 'keys', 'condition_proof.zkey');

  constructor(private readonly cache: ProofCacheService) {}

  async onModuleInit() {
    this.poseidon = await buildPoseidon();
    this.logger.log('Poseidon hash function initialized');
    this.logger.log(`Circuits directory: ${CIRCUITS_DIR}`);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async sealVault(dto: SealVaultDto): Promise<{
    proofHash: string;
    vaultCommitment: string;
    recordRoot: string;
  }> {
    const vaultKeyField    = this.aesKeyToField(dto.vaultKeyHex);
    const nhiaIdField      = this.nhiaIdToField(dto.nhiaId);
    const vaultCommitment  = this.poseidonHash(vaultKeyField, nhiaIdField);

    // Pad record hashes to N=8
    const paddedHashes = dto.recordHashes.map(h => this.recordHashToField(h));
    while (paddedHashes.length < 8) paddedHashes.push(0n);

    const recordRoot = this.computeMerkleRoot(paddedHashes);
    const timestamp  = BigInt(Math.floor(Date.now() / 1000));

    const input = {
      vaultKey:           vaultKeyField.toString(),
      recordHashes:       paddedHashes.map(h => h.toString()),
      patientNhiaIdHash:  nhiaIdField.toString(),
      vaultCommitment:    vaultCommitment.toString(),
      recordRoot:         recordRoot.toString(),
      timestamp:          timestamp.toString(),
    };

    this.logger.debug(`Generating vault proof for ${dto.nhiaId}...`);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input, this.vaultWasm, this.vaultZkey,
    );

    const proofHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(proof))
      .digest('hex');

    const entry: VaultProofCacheEntry = {
      proof,
      publicSignals,
      proofHash,
      vaultCommitment: vaultCommitment.toString(),
      recordRoot:      recordRoot.toString(),
      generatedAt:     new Date().toISOString(),
    };

    // 24-hour cache — refreshed on every record upload
    await this.cache.set(`vault:proof:${dto.nhiaId}`, entry, 86_400);

    this.logger.log(`Vault sealed for ${dto.nhiaId} | proof: ${proofHash.slice(0, 16)}…`);
    return { proofHash, vaultCommitment: vaultCommitment.toString(), recordRoot: recordRoot.toString() };
  }

  async getVaultProof(nhiaId: string): Promise<VaultProofCacheEntry> {
    const cached = await this.cache.get<VaultProofCacheEntry>(`vault:proof:${nhiaId}`);
    if (cached) return cached;
    throw new NotFoundException(
      `No proof found for ${nhiaId}. The vault must be sealed (record upload) before inference.`,
    );
  }

  async verifyVaultProof(proof: object, publicSignals: string[]): Promise<boolean> {
    const valid = await snarkjs.groth16.verify(this.vaultVkey, publicSignals, proof);
    this.logger.debug(`Vault proof verification: ${valid}`);
    return valid;
  }

  async proveCondition(dto: ConditionProofDto): Promise<{
    proof: object;
    publicSignals: string[];
    valid: boolean;
  }> {
    const vaultKeyField    = this.aesKeyToField(dto.vaultKeyHex);
    const nhiaIdField      = this.nhiaIdToField(dto.nhiaId);
    const vaultCommitment  = this.poseidonHash(vaultKeyField, nhiaIdField);
    const recordHashField  = this.recordHashToField(dto.recordHash);

    const input = {
      recordValue:       BigInt(dto.recordValue).toString(),
      recordHash:        recordHashField.toString(),
      vaultKey:          vaultKeyField.toString(),
      patientNhiaIdHash: nhiaIdField.toString(),
      conditionCode:     dto.conditionCode.toString(),
      conditionValue:    dto.conditionValue.toString(),
      vaultCommitment:   vaultCommitment.toString(),
      recordHashPublic:  recordHashField.toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input, this.condWasm, this.condZkey,
    );

    // Cache condition proof for emergency fast-path (48h — longer than vault proof)
    const cacheKey = `emergency:proof:${dto.nhiaId}:${dto.conditionCode}`;
    await this.cache.set(cacheKey, { proof, publicSignals }, 172_800);

    return { proof, publicSignals, valid: true };
  }

  async getConditionProof(nhiaId: string, conditionCode: number) {
    return this.cache.get(`emergency:proof:${nhiaId}:${conditionCode}`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private poseidonHash(a: bigint, b: bigint): bigint {
    return this.poseidon.F.toObject(this.poseidon([a, b]));
  }

  private nhiaIdToField(nhiaId: string): bigint {
    const hash = crypto.createHash('sha256').update(nhiaId).digest();
    return BigInt('0x' + hash.slice(0, 31).toString('hex'));
  }

  private aesKeyToField(aesKeyHex: string): bigint {
    const buf = Buffer.from(aesKeyHex, 'hex');
    const lo  = BigInt('0x' + buf.slice(0, 16).toString('hex'));
    const hi  = BigInt('0x' + buf.slice(16).toString('hex'));
    return this.poseidonHash(lo, hi);
  }

  private recordHashToField(sha256Hex: string): bigint {
    return BigInt('0x' + sha256Hex.slice(0, 62)); // 31 bytes < BN254 prime
  }

  private computeMerkleRoot(leaves: bigint[]): bigint {
    let level = [...leaves];
    while (level.length > 1) {
      const next: bigint[] = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(this.poseidonHash(level[i], level[i + 1] ?? 0n));
      }
      level = next;
    }
    return level[0];
  }

  private loadJson(filePath: string): object {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      this.logger.warn(`Verification key not found at ${filePath} — run trusted setup first.`);
      return {};
    }
  }
}
