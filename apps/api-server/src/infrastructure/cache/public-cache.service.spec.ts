import type { ConfigService } from "@nestjs/config";
import { PublicCacheService } from "./public-cache.service";
import type { RedisHealthService } from "./redis-health.service";

function createService(redisValues: string[] = []): {
  cache: PublicCacheService;
  redis: jest.Mocked<Pick<RedisHealthService, "read" | "write" | "invalidateTag" | "bumpGeneration" | "isEnabled">>;
} {
  const redis = {
    isEnabled: jest.fn(() => false),
    bumpGeneration: jest.fn<Promise<void>, [string]>(async () => undefined),
    read: jest.fn<Promise<string | null>, [string]>(
      async () => redisValues.shift() ?? null,
    ),
    write: jest.fn<Promise<void>, [string, string, number, string]>(
      async () => undefined,
    ),
    invalidateTag: jest.fn<Promise<void>, [string]>(async () => undefined),
  };
  const config = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  } as unknown as ConfigService;
  return {
    cache: new PublicCacheService(config, redis as unknown as RedisHealthService),
    redis,
  };
}

describe("PublicCacheService", () => {
  it("loads a key once and stores JSON-safe values", async () => {
    const { cache, redis } = createService();
    const loader = jest.fn(async () => ({ id: 42n, price: 123.45 }));

    await expect(cache.remember("vehicle", loader)).resolves.toEqual({
      id: "42",
      price: 123.45,
    });
    await expect(cache.remember("vehicle", loader)).resolves.toEqual({
      id: "42",
      price: 123.45,
    });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.write).toHaveBeenCalledTimes(1);
  });

  it("uses valid Redis data without calling the loader", async () => {
    const { cache } = createService([JSON.stringify({ id: "cached" })]);
    const loader = jest.fn(async () => ({ id: "database" }));

    await expect(cache.remember("site", loader)).resolves.toEqual({ id: "cached" });
    expect(loader).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent cache misses", async () => {
    const { cache } = createService();
    let complete!: (value: { id: string }) => void;
    const loader = jest.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          complete = resolve;
        }),
    );

    const first = cache.remember("home", loader);
    const second = cache.remember("home", loader);
    await Promise.resolve();
    complete({ id: "fresh" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: "fresh" },
      { id: "fresh" },
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not repopulate stale data after an invalidation race", async () => {
    const { cache, redis } = createService();
    let complete!: (value: { version: number }) => void;
    const staleLoader = jest.fn(
      () =>
        new Promise<{ version: number }>((resolve) => {
          complete = resolve;
        }),
    );

    const staleRequest = cache.remember("brands", staleLoader);
    await cache.invalidateAll();
    complete({ version: 1 });
    await expect(staleRequest).resolves.toEqual({ version: 1 });

    const freshLoader = jest.fn(async () => ({ version: 2 }));
    await expect(cache.remember("brands", freshLoader)).resolves.toEqual({
      version: 2,
    });
    expect(freshLoader).toHaveBeenCalledTimes(1);
    expect(redis.invalidateTag).toHaveBeenCalledTimes(1);
  });

  it("uses a shared generation so another instance cannot read stale cache", async () => {
    let generation = 0;
    const values = new Map<string, string>();
    const redis = {
      isEnabled: () => true,
      read: async (key: string) => key.endsWith("generation")
        ? String(generation)
        : values.get(key) ?? null,
      write: async (key: string, value: string) => { values.set(key, value); },
      bumpGeneration: async () => { generation += 1; },
      invalidateTag: async () => undefined,
    } as unknown as RedisHealthService;
    const config = { get: (_key: string, fallback: number) => fallback } as ConfigService;
    const first = new PublicCacheService(config, redis);
    const second = new PublicCacheService(config, redis);
    await first.remember("site", async () => ({ version: 1 }));
    await expect(second.remember("site", async () => ({ version: 0 }))).resolves.toEqual({ version: 1 });
    await first.invalidateAll();
    await expect(second.remember("site", async () => ({ version: 2 }))).resolves.toEqual({ version: 2 });
  });
});
