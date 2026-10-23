import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type ThrottlerStorage,
  ThrottlerStorageService,
} from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { RedisHealthService } from "./redis-health.service";

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly fallback = new ThrottlerStorageService();
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly prefix: string;
  private degraded = false;

  constructor(config: ConfigService, private readonly redis: RedisHealthService) {
    this.prefix = `${config.get<string>("REDIS_KEY_PREFIX", "sfhyl")}:throttle:`;
  }

  async increment(
    key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis.isEnabled()) {
      const record = await this.redis.incrementRateLimit(
        `${this.prefix}${throttlerName}:${key}`, ttl, limit, blockDuration,
      );
      if (record) {
        this.degraded = false;
        return record;
      }
      if (!this.degraded) {
        this.logger.warn("Redis rate limiting is degraded; using per-process counters until reconnection.");
        this.degraded = true;
      }
    }
    return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
