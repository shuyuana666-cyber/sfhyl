import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";
import { RATE_LIMIT_SCRIPT } from "./redis-rate-limit.script";

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly enabled: boolean;
  private readonly client: Redis | null;
  private readonly logger = new Logger(RedisHealthService.name);
  private connecting: Promise<Redis> | null = null;
  private degraded = false;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>("REDIS_ENABLED", false);
    this.client = this.enabled
      ? new Redis({
          host: config.get<string>("REDIS_HOST", "127.0.0.1"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get<string>("REDIS_PASSWORD") || undefined,
          username: config.get<string>("REDIS_USERNAME") || undefined,
          db: config.get<number>("REDIS_DB", 0),
          tls: config.get<boolean>("REDIS_TLS", false) ? {} : undefined,
          lazyConnect: true,
          connectTimeout: 1500,
          commandTimeout: 1500,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;
    this.client?.on("error", () => {
      if (!this.degraded) this.logger.warn("Redis connection interrupted; cache reads will use the database.");
      this.degraded = true;
    });
    this.client?.on("ready", () => { this.degraded = false; });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async bumpGeneration(key: string): Promise<void> {
    try {
      const client = await this.connectedClient();
      if (client) await client.incr(key);
    } catch {
      // A Redis outage only disables the cache acceleration.
    }
  }

  async check(): Promise<"up" | "disabled"> {
    const client = await this.connectedClient();
    if (!client) return "disabled";
    const response = await client.ping();
    if (response !== "PONG") throw new Error("Redis PING did not return PONG.");
    return "up";
  }

  async read(key: string): Promise<string | null> {
    try {
      const client = await this.connectedClient();
      return client ? await client.get(key) : null;
    } catch {
      return null;
    }
  }

  async write(
    key: string,
    value: string,
    ttlSeconds: number,
    tagKey: string,
  ): Promise<void> {
    try {
      const client = await this.connectedClient();
      if (!client) return;
      await client
        .multi()
        .set(key, value, "EX", ttlSeconds)
        .sadd(tagKey, key)
        .expire(tagKey, Math.max(ttlSeconds * 2, 300))
        .exec();
    } catch {
      // Redis is an optional acceleration layer; database reads remain authoritative.
    }
  }

  async invalidateTag(tagKey: string): Promise<void> {
    try {
      const client = await this.connectedClient();
      if (!client) return;
      const keys = await client.smembers(tagKey);
      const transaction = client.multi();
      if (keys.length) transaction.del(...keys);
      transaction.del(tagKey);
      await transaction.exec();
    } catch {
      // Cached entries have short TTLs and expire naturally if Redis is unavailable.
    }
  }

  async incrementRateLimit(
    key: string, ttl: number, limit: number, blockDuration: number,
  ): Promise<ThrottlerStorageRecord | null> {
    try {
      const client = await this.connectedClient();
      if (!client) return null;
      const result = await client.eval(RATE_LIMIT_SCRIPT, 1, key, ttl, limit, blockDuration);
      if (!Array.isArray(result) || result.length !== 4 || !result.every(Number.isFinite)) return null;
      const values = result as number[];
      return {
        totalHits: values[0]!, timeToExpire: values[1]!,
        isBlocked: values[2] === 1, timeToBlockExpire: values[3]!,
      };
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    if (this.client.status === "ready") await this.client.quit().catch(() => this.client?.disconnect());
    else this.client.disconnect();
  }

  private async connectedClient(): Promise<Redis | null> {
    if (!this.client) return null;
    if (this.connecting) return this.connecting;
    if (this.client.status === "wait") {
      const client = this.client;
      this.connecting = client.connect().then(() => client);
      try { return await this.connecting; }
      finally { this.connecting = null; }
    }
    return this.client;
  }
}
