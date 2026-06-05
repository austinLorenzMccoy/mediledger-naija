import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Emergency data is the minimal critical subset for ER care
interface EmergencyProfile {
  nhia_id: string;
  full_name: string;
  blood_type: string;
  date_of_birth: string;
  emergency_tag_active: boolean;
  cached_at: string;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour TTL — refreshed on patient profile updates
const EMERGENCY_CACHE_PREFIX = 'emergency:';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      // Lazy connect — service starts even if Redis is momentarily unavailable
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => this.logger.error('Redis connect failed:', e));
  }

  async getEmergencyData(
    nhiaId: string,
    providerId: string,
    hospitalName: string,
  ): Promise<EmergencyProfile> {
    const cacheKey = `${EMERGENCY_CACHE_PREFIX}${nhiaId}`;

    // 1. Try Redis hot cache first (target: sub-300ms)
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.log(`Cache HIT for emergency data: ${nhiaId}`);
      const profile = JSON.parse(cached) as EmergencyProfile;
      this.triggerAccessAlert(nhiaId, providerId, hospitalName); // fire-and-forget
      return profile;
    }

    // 2. Cache MISS — fallback to Supabase (still fast but > 300ms target)
    this.logger.warn(`Cache MISS for emergency data: ${nhiaId} — falling back to Supabase`);
    const profile = await this.fetchFromSupabase(nhiaId);

    // Re-warm cache
    await this.redis
      .setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(profile))
      .catch(() => {});

    this.triggerAccessAlert(nhiaId, providerId, hospitalName);
    return profile;
  }

  async warmPatientCache(nhiaId: string): Promise<{ warmed: boolean }> {
    try {
      const profile = await this.fetchFromSupabase(nhiaId);
      const cacheKey = `${EMERGENCY_CACHE_PREFIX}${nhiaId}`;
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(profile));
      this.logger.log(`Cache warmed for ${nhiaId}`);
      return { warmed: true };
    } catch {
      return { warmed: false };
    }
  }

  private async fetchFromSupabase(nhiaId: string): Promise<EmergencyProfile> {
    const { data, error } = await supabase
      .from('patients')
      .select('nhia_id, full_name, blood_type, date_of_birth, emergency_tag_active')
      .eq('nhia_id', nhiaId)
      .eq('emergency_tag_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException(`No emergency profile found for NHIA ID: ${nhiaId}`);
    }

    return { ...data, cached_at: new Date().toISOString() };
  }

  private triggerAccessAlert(nhiaId: string, providerId: string, hospitalName: string) {
    // Fire-and-forget: alert patient via Edge Function (non-blocking, post-response)
    fetch(`${process.env.SUPABASE_URL}/functions/v1/emergency-access-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'x-internal-key': process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        patient_nhia_id: nhiaId,
        provider_name: providerId,
        hospital_name: hospitalName,
        accessed_at: new Date().toISOString(),
      }),
    }).catch(() => {}); // Non-blocking — never delay emergency data delivery
  }
}
