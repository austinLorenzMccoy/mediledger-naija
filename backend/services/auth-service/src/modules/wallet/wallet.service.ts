import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import Redis from 'ioredis';

const { PublicKey } = require('@hashgraph/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MIRROR_NODE_BASE =
  process.env.HEDERA_NETWORK === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com/api/v1'
    : 'https://testnet.mirrornode.hedera.com/api/v1';

const PUBLIC_KEY_CACHE_TTL = 86400; // 24 hours — keys rarely change

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
    });
    this.redis.connect().catch((e) => this.logger.error('Redis connect failed:', e));
  }

  generateChallenge(): string {
    return `mediledger-auth:${randomBytes(32).toString('hex')}`;
  }

  async verifyAndIssueToken(
    accountId: string,
    challenge: string,
    signature: string,
  ): Promise<{ token: string }> {
    // 1. Resolve public key — try Supabase vault first, fallback to mirror node
    const publicKeyHex = await this.resolvePublicKey(accountId);

    // 2. Verify ED25519 signature using Hedera SDK
    const publicKey = PublicKey.fromString(publicKeyHex);
    const messageBytes = Buffer.from(challenge, 'utf-8');
    const sigBytes = Buffer.from(signature, 'hex');
    const isValid: boolean = publicKey.verify(messageBytes, sigBytes);

    if (!isValid) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    // 3. Find the patient by hedera_account_id
    const { data: patient, error } = await supabase
      .from('patients')
      .select('user_id')
      .eq('hedera_account_id', accountId)
      .single();

    if (error || !patient) {
      throw new UnauthorizedException('Hedera account not registered');
    }

    // 4. Issue Supabase magic link token for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${accountId.replace(/\./g, '-')}@hedera.mediledger.ng`,
    });

    if (sessionError || !sessionData) {
      throw new UnauthorizedException('Failed to issue session token');
    }

    const actionUrl = new URL(sessionData.properties.action_link);
    const token = actionUrl.searchParams.get('token') ?? '';
    return { token };
  }

  private async resolvePublicKey(accountId: string): Promise<string> {
    const cacheKey = `pubkey:${accountId}`;

    // Check Redis cache first
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return cached;

    // Fetch from Hedera mirror node
    const res = await fetch(`${MIRROR_NODE_BASE}/accounts/${accountId}`);
    if (!res.ok) {
      throw new UnauthorizedException(`Cannot resolve public key for ${accountId}`);
    }

    const data = await res.json();
    const publicKeyHex: string = data?.key?.key;
    if (!publicKeyHex) {
      throw new UnauthorizedException(`No public key found for ${accountId}`);
    }

    // Cache for 24h
    await this.redis.setex(cacheKey, PUBLIC_KEY_CACHE_TTL, publicKeyHex).catch(() => {});
    return publicKeyHex;
  }

  // Invalidate public key cache when a patient updates their vault key
  async invalidatePublicKeyCache(accountId: string): Promise<void> {
    await this.redis.del(`pubkey:${accountId}`).catch(() => {});
  }

  // HCS audit helper — hashes the actor identifier for privacy
  hashIdentifier(value: string, salt: string): string {
    return createHash('sha256').update(`${value}:${salt}`).digest('hex');
  }
}
