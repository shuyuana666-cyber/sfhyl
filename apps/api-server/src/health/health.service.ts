import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { RedisHealthService } from "../infrastructure/cache/redis-health.service";
import { StorageProvider } from "../infrastructure/storage/storage-provider";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly redis: RedisHealthService,
  ) {}

  async ready(): Promise<Record<string, unknown>> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.storage.checkHealth();
    } catch {
      throw new ServiceUnavailableException(
        "A required dependency is unavailable",
      );
    }
    let redis: "up" | "down" | "disabled";
    try {
      redis = await this.redis.check();
    } catch {
      redis = "down";
    }
    return {
      status: redis === "down" ? "degraded" : "ok",
      process: "up",
      mysql: "up",
      storage: "up",
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
