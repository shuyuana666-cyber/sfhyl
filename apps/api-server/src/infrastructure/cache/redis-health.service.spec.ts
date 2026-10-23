import type { ConfigService } from "@nestjs/config";
import { RedisHealthService } from "./redis-health.service";

describe("RedisHealthService", () => {
  it("degrades to a no-op cache when Redis is disabled", async () => {
    const config = {
      get: jest.fn((key: string, fallback: unknown) =>
        key === "REDIS_ENABLED" ? false : fallback,
      ),
    } as unknown as ConfigService;
    const redis = new RedisHealthService(config);

    await expect(redis.check()).resolves.toBe("disabled");
    await expect(redis.read("missing")).resolves.toBeNull();
    await expect(redis.write("key", "value", 60, "tag")).resolves.toBeUndefined();
    await expect(redis.invalidateTag("tag")).resolves.toBeUndefined();
    await expect(redis.onModuleDestroy()).resolves.toBeUndefined();
  });
});
