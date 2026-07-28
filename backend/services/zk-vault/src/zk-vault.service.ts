import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import * as snarkjs from 'snarkjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildPoseidon } from 'circomlibjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProofCacheService } from './proof-cache.service';
import { SealVaultDto } from './dto/seal-vault.dto';
import { ConditionProofDto } from './dto/condition-proof.dto';
import { ConsentScopeDto } from './dto/consent-scope.dto';

const CIRCUITS_DIR = path.resolve(
  process.env.CIRCUITS_DIR ?? path.join(__dirname, '..', '..', '..', '..', 'circuits'),
);

export interface VaultProofCacheEntry {
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
  private supabase: SupabaseClient | null = null;

  private readonly vaultWasm = path.join(CIRCUITS_DIR, 'build', 'vault_integrity_js', 'vault_integrity.wasm');
  private readonly vaultZkey = path.join(CIRCUITS_DIR, 'keys', 'vault_integrity.zkey');
  private readonly vaultVkey = this.loadJson(path.join(CIRCUITS_DIR, 'keys', 'verification_key_vault_integrity.json'));

  private readonly condWasm  = path.join(CIRCUITS_DIR, 'build', 'condition_proof_js', 'condition_proof.wasm');
  private readonly condZkey  = path.join(CIRCUITS_DIR, 'keys', 'condition_proof.zkey');
  private readonly condVkey  = this.loadJson(path.join(CIRCUITS_DIR, 'keys', 'verification_key_condition_proof.json'));

  private readonly scopeWasm = path.join(CIRCUITS_DIR, 'build', 'consent_scope_js', 'consent_scope.wasm');
  private readonly scopeZkey = path.join(CIRCUITS_DIR, 'keys', 'consent_scope.zkey');
  private readonly scopeVkey = this.loadJson(path.join(CIRCUITS_DIR, 'keys', 'verification_key_consent_scope.json'));

  constructor(private readonly cache: ProofCacheService) {}

  async onModuleInit() {
    this.poseidon = await buildPoseidon();
    this.logger.log('Poseidon hash function initialized');
    this.logger.log(`Circuits directory: ${CIRCUITS_DIR}`);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            // Avoid realtime WebSocket requirement on Node < 22
            realtime: { params: { eventsPerSecond: 0 } },
          },
        );
        this.logger.log('Supabase admin client ready (seal → patients update enabled)');
      } catch (e: any) {
        this.logger.warn(`Supabase client init failed: ${e?.message ?? e} — seal will cache only`);
        this.supabase = null;
      }
    } else {
      this.logger.warn('SUPABASE_* not set — seal will cache proofs only (no DB write)');
    }

    this.assertArtifacts();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async sealVault(dto: SealVaultDto): Promise<{
    proofHash: string;
    vaultCommitment: string;
    recordRoot: string;
    publicSignals: string[];
    dbUpdated: boolean;
  }> {
    if (!dto.recordHashes?.length) {
      throw new BadRequestException('recordHashes must contain at least one hash');
    }
    if (dto.recordHashes.length > 8) {
      throw new BadRequestException('Maximum 8 record hashes per vault seal (N=8 circuit)');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(dto.vaultKeyHex)) {
      throw new BadRequestException('vaultKeyHex must be 64 hex chars (AES-256 key)');
    }

    const vaultKeyField   = this.aesKeyToField(dto.vaultKeyHex);
    const nhiaIdField     = this.nhiaIdToField(dto.nhiaId);
    const vaultCommitment = this.poseidonHash(vaultKeyField, nhiaIdField);

    const paddedHashes = dto.recordHashes.map((h) => this.recordHashToField(h));
    while (paddedHashes.length < 8) paddedHashes.push(0n);

    const recordRoot = this.computeMerkleRoot(paddedHashes);
    const timestamp  = BigInt(Math.floor(Date.now() / 1000));

    const input = {
      vaultKey:          vaultKeyField.toString(),
      recordHashes:      paddedHashes.map((h) => h.toString()),
      patientNhiaIdHash: nhiaIdField.toString(),
      vaultCommitment:   vaultCommitment.toString(),
      recordRoot:        recordRoot.toString(),
      timestamp:         timestamp.toString(),
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

    await this.cache.set(`vault:proof:${dto.nhiaId}`, entry, 86_400);

    const dbUpdated = await this.persistVaultSeal(
      dto.nhiaId,
      vaultCommitment.toString(),
      proofHash,
    );

    await this.logHcsAudit('VAULT_SEALED', dto.nhiaId, proofHash, {
      vaultCommitment: vaultCommitment.toString(),
      recordRoot: recordRoot.toString(),
    });

    this.logger.log(
      `Vault sealed for ${dto.nhiaId} | proof: ${proofHash.slice(0, 16)}… | db=${dbUpdated}`,
    );

    return {
      proofHash,
      vaultCommitment: vaultCommitment.toString(),
      recordRoot: recordRoot.toString(),
      publicSignals,
      dbUpdated,
    };
  }

  async getVaultProof(nhiaId: string): Promise<VaultProofCacheEntry> {
    const cached = await this.cache.get<VaultProofCacheEntry>(`vault:proof:${nhiaId}`);
    if (cached) return cached;
    throw new NotFoundException(
      `No proof found for ${nhiaId}. Call POST /zk/seal-vault after record upload.`,
    );
  }

  async verifyVaultProof(proof: object, publicSignals: string[]): Promise<boolean> {
    if (!this.vaultVkey || Object.keys(this.vaultVkey).length === 0) {
      throw new BadRequestException('Vault verification key missing — run setup-circuits.sh');
    }
    const valid = await snarkjs.groth16.verify(this.vaultVkey, publicSignals, proof);
    this.logger.debug(`Vault proof verification: ${valid}`);
    return valid;
  }

  async proveCondition(dto: ConditionProofDto): Promise<{
    proof: object;
    publicSignals: string[];
    valid: boolean;
  }> {
    const vaultKeyField   = this.aesKeyToField(dto.vaultKeyHex);
    const nhiaIdField     = this.nhiaIdToField(dto.nhiaId);
    const vaultCommitment = this.poseidonHash(vaultKeyField, nhiaIdField);
    const recordHashField = this.recordHashToField(dto.recordHash);

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

    let valid = true;
    if (this.condVkey && Object.keys(this.condVkey).length > 0) {
      valid = await snarkjs.groth16.verify(this.condVkey, publicSignals, proof);
    }

    const cacheKey = `emergency:proof:${dto.nhiaId}:${dto.conditionCode}`;
    await this.cache.set(cacheKey, { proof, publicSignals, valid }, 172_800);

    return { proof, publicSignals, valid };
  }

  async getConditionProof(nhiaId: string, conditionCode: number) {
    const cached = await this.cache.get(`emergency:proof:${nhiaId}:${conditionCode}`);
    if (!cached) {
      throw new NotFoundException(
        `No condition proof for ${nhiaId}/${conditionCode}. Call POST /zk/prove-condition first.`,
      );
    }
    return cached;
  }

  async proveConsentScope(dto: ConsentScopeDto): Promise<{
    proof: object;
    publicSignals: string[];
    valid: boolean;
  }> {
    const nhiaIdField = this.nhiaIdToField(dto.nhiaId);
    const consentIdField = this.stringToField(dto.consentId);
    const scopeHashField = this.hexOrStringToField(dto.scopeHash);

    const padded = dto.scopeItems.map((n) => BigInt(n));
    while (padded.length < 10) padded.push(0n);

    const input = {
      scopeItems:        padded.map((n) => n.toString()),
      consentId:         consentIdField.toString(),
      patientNhiaIdHash: nhiaIdField.toString(),
      requestedType:     dto.requestedType.toString(),
      scopeHash:         scopeHashField.toString(),
      consentIdPublic:   consentIdField.toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input, this.scopeWasm, this.scopeZkey,
    );

    let valid = true;
    if (this.scopeVkey && Object.keys(this.scopeVkey).length > 0) {
      valid = await snarkjs.groth16.verify(this.scopeVkey, publicSignals, proof);
    }

    await this.cache.set(
      `consent:scope:${dto.consentId}:${dto.requestedType}`,
      { proof, publicSignals, valid },
      86_400,
    );

    return { proof, publicSignals, valid };
  }

  async health() {
    const artifactsOk =
      fs.existsSync(this.vaultWasm) &&
      fs.existsSync(this.vaultZkey) &&
      Object.keys(this.vaultVkey || {}).length > 0;

    return {
      status: artifactsOk ? 'ok' : 'degraded',
      service: 'zk-vault-service',
      circuitsDir: CIRCUITS_DIR,
      artifacts: {
        vaultWasm: fs.existsSync(this.vaultWasm),
        vaultZkey: fs.existsSync(this.vaultZkey),
        vaultVkey: Object.keys(this.vaultVkey || {}).length > 0,
        condWasm: fs.existsSync(this.condWasm),
        scopeWasm: fs.existsSync(this.scopeWasm),
      },
      supabase: !!this.supabase,
      redis: true,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async persistVaultSeal(
    nhiaId: string,
    vaultCommitment: string,
    proofHash: string,
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // Prefer RPC from migration 008 (clearer errors)
      const { error: rpcError } = await this.supabase.rpc('update_patient_vault_seal', {
        p_nhia_id: nhiaId,
        p_vault_commitment: vaultCommitment,
        p_zk_proof_hash: proofHash,
      });

      if (!rpcError) return true;

      // Fallback: direct update (works if patients row exists)
      this.logger.warn(`RPC update_patient_vault_seal failed (${rpcError.message}) — trying direct update`);
      const { data, error } = await this.supabase
        .from('patients')
        .update({
          vault_public_key: vaultCommitment,
          zk_proof_hash: proofHash,
        })
        .eq('nhia_id', nhiaId)
        .select('id');

      if (error) {
        this.logger.warn(`DB vault seal update failed for ${nhiaId}: ${error.message}`);
        return false;
      }
      if (!data?.length) {
        this.logger.warn(`No patient row for ${nhiaId} — seal cached only`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`persistVaultSeal error: ${e?.message ?? e}`);
      return false;
    }
  }

  private async logHcsAudit(
    action: string,
    nhiaId: string,
    payloadHash: string,
    extra?: Record<string, string>,
  ): Promise<void> {
    if (!this.supabase) return;
    try {
      const actor = crypto.createHash('sha256').update(nhiaId).digest('hex').slice(0, 16);
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ action, nhiaId, payloadHash, ...extra }))
        .digest('hex');
      await this.supabase.from('hcs_audit_log').insert({
        topic: 'mediledger.audit.main',
        action,
        actor_id: actor,
        payload_hash: hash,
      });
    } catch (e: any) {
      this.logger.warn(`HCS audit insert failed: ${e?.message ?? e}`);
    }
  }

  private assertArtifacts() {
    const missing: string[] = [];
    for (const p of [this.vaultWasm, this.vaultZkey, this.condWasm, this.condZkey, this.scopeWasm, this.scopeZkey]) {
      if (!fs.existsSync(p)) missing.push(p);
    }
    if (missing.length) {
      this.logger.warn(`Missing circuit artifacts (${missing.length}). Run: cd circuits && bash scripts/setup-circuits.sh`);
      missing.slice(0, 3).forEach((m) => this.logger.warn(`  missing: ${m}`));
    }
  }

  private poseidonHash(a: bigint, b: bigint): bigint {
    return this.poseidon.F.toObject(this.poseidon([a, b]));
  }

  private nhiaIdToField(nhiaId: string): bigint {
    const hash = crypto.createHash('sha256').update(nhiaId).digest();
    return BigInt('0x' + hash.slice(0, 31).toString('hex'));
  }

  private stringToField(s: string): bigint {
    const hash = crypto.createHash('sha256').update(s).digest();
    return BigInt('0x' + hash.slice(0, 31).toString('hex'));
  }

  private hexOrStringToField(value: string): bigint {
    const cleaned = value.startsWith('0x') ? value.slice(2) : value;
    if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length >= 8) {
      // Take 31 bytes max to stay in BN254 field
      const hex = cleaned.slice(0, 62);
      return BigInt('0x' + hex);
    }
    return this.stringToField(value);
  }

  private aesKeyToField(aesKeyHex: string): bigint {
    const buf = Buffer.from(aesKeyHex, 'hex');
    const lo  = BigInt('0x' + buf.slice(0, 16).toString('hex'));
    const hi  = BigInt('0x' + buf.slice(16).toString('hex'));
    return this.poseidonHash(lo, hi);
  }

  private recordHashToField(sha256Hex: string): bigint {
    const cleaned = sha256Hex.startsWith('0x') ? sha256Hex.slice(2) : sha256Hex;
    if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
      throw new BadRequestException(`Invalid record hash (expected hex): ${sha256Hex.slice(0, 16)}…`);
    }
    return BigInt('0x' + cleaned.slice(0, 62));
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
