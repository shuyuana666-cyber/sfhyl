import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { toJsonSafe } from "../../common/utils/serialize";
import { RedisHealthService } from "./redis-health.service";

const MAX_MEMORY_ENTRIES = 256;

interface MemoryEntry {
  expiresAt: number;
  value: unknown;
}

@Injectable()
export class PublicCacheService {
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private generation = 0;
  private readonly prefix: string;
  private readonly tagKey: string;
  private readonly generationKey: string;
  private readonly defaultTtl: number;

  constructor(
    config: ConfigService,
    private readonly redis: RedisHealthService,
  ) {
    this.prefix = `${config.get<string>("REDIS_KEY_PREFIX", "sfhyl")}:public:v1:`;
    this.tagKey = `${this.prefix}tag:all`;
    this.generationKey = `${this.prefix}generation`;
    this.defaultTtl = config.get<number>("PUBLIC_CACHE_TTL_SECONDS", 120);
  }

  fingerprint(value: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(toJsonSafe(value)))
      .digest("hex")
      .slice(0, 24);
  }

  async remember<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds = this.defaultTtl,
  ): Promise<T> {
    const generation = this.generation;
    // A shared generation makes cache keys change on every instance after an
    // update. An in-flight load may finish later, but can only fill its old key.
    const distributed = this.redis.isEnabled();
    const sharedGeneration = distributed
      ? (await this.redis.read(this.generationKey)) ?? "0"
      : "";
    const cacheKey = `${this.prefix}${sharedGeneration}:${key}`;
    const inFlightKey = `${generation}:${cacheKey}`;
    const memoryEntry = distributed ? undefined : this.memory.get(cacheKey);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      this.memory.delete(cacheKey);
      this.memory.set(cacheKey, memoryEntry);
      return memoryEntry.value as T;
    }
    if (memoryEntry) this.memory.delete(cacheKey);

    const redisValue = await this.redis.read(cacheKey);
    if (redisValue && generation === this.generation) {
      try {
        const value = JSON.parse(redisValue) as T;
        if (!distributed) this.storeMemoryEntry(cacheKey, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return value;
      } catch {
        // Ignore malformed cache data and refill it from MySQL.
      }
    }

    const pending = this.inFlight.get(inFlightKey);
    if (pending) return pending as Promise<T>;

    const loadPromise = (async () => {
      const value = toJsonSafe(await loader()) as T;
      if (generation === this.generation) {
        if (!distributed) this.storeMemoryEntry(cacheKey, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
        const serialized = JSON.stringify(value);
        await this.redis.write(cacheKey, serialized, ttlSeconds, this.tagKey);
      }
      return value;
    })();
    this.inFlight.set(inFlightKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inFlight.delete(inFlightKey);
    }
  }

  async invalidateAll(): Promise<void> {
    this.generation += 1;
    this.memory.clear();
    await this.redis.bumpGeneration(this.generationKey);
    await this.redis.invalidateTag(this.tagKey);
  }

  private storeMemoryEntry(key: string, entry: MemoryEntry): void {
    const now = Date.now();
    for (const [memoryKey, cached] of this.memory) {
      if (cached.expiresAt <= now) this.memory.delete(memoryKey);
    }

    this.memory.delete(key);
    this.memory.set(key, entry);
    while (this.memory.size > MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey === undefined) return;
      this.memory.delete(oldestKey);
    }
  }
}
