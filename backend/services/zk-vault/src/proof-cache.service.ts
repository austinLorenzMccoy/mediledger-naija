import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ProofCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProofCacheService.name);
  private redis: Redis;

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) =>
      this.logger.error('Redis connect failed:', e),
    );
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key).catch(() => null);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
