import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_VERSION } from "../version";
import { publicStorageUrl } from "../infrastructure/storage/storage-settings";
import {
  JsonLoggerService,
  type SystemLogEntry,
} from "../common/logging/json-logger.service";

@Injectable()
export class SystemService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: JsonLoggerService,
  ) {}

  storage(): Record<string, unknown> {
    const driver = this.config.get<string>("STORAGE_DRIVER", "local");
    const common = {
      driver,
      implementation: ["local", "minio"].includes(driver)
        ? "ready"
        : "skeleton",
      publicUrl: driver === "local" || driver === "minio"
        ? publicStorageUrl(this.config, driver) : this.config.get<string>("STORAGE_PUBLIC_URL", ""),
    };
    if (driver === "local")
      return {
        ...common,
        path: this.config.get<string>("LOCAL_STORAGE_PATH", "./storage"),
      };
    if (driver === "minio") {
      return {
        ...common,
        endpoint: this.config.get<string>("MINIO_ENDPOINT", ""),
        port: this.config.get<number>("MINIO_PORT", 9000),
        useSsl: this.config.get<boolean>("MINIO_USE_SSL", false),
        bucket: this.config.get<string>("MINIO_BUCKET", ""),
        region: this.config.get<string>("MINIO_REGION", ""),
        pathStyle: this.config.get<boolean>("MINIO_PATH_STYLE", true),
        credentialsConfigured: Boolean(
          this.config.get<string>("MINIO_ACCESS_KEY") &&
          this.config.get<string>("MINIO_SECRET_KEY"),
        ),
      };
    }
    const prefix = driver === "aliyun-oss" ? "ALIYUN_OSS" : "TENCENT_COS";
    return {
      ...common,
      region: this.config.get<string>(`${prefix}_REGION`, ""),
      endpoint: this.config.get<string>(`${prefix}_ENDPOINT`, ""),
      bucket: this.config.get<string>(`${prefix}_BUCKET`, ""),
    };
  }

  mail(): Record<string, unknown> {
    return {
      enabled: this.config.get<boolean>("MAIL_ENABLED", false),
      host: this.config.get<string>("SMTP_HOST", ""),
      port: this.config.get<number>("SMTP_PORT", 587),
      secure: this.config.get<boolean>("SMTP_SECURE", false),
      username: this.config.get<string>("SMTP_USERNAME", ""),
      passwordConfigured: Boolean(this.config.get<string>("SMTP_PASSWORD")),
      fromName: this.config.get<string>("MAIL_FROM_NAME", ""),
      fromAddress: this.config.get<string>("MAIL_FROM_ADDRESS", ""),
    };
  }

  logs(limit: number, level?: SystemLogEntry["level"]): SystemLogEntry[] {
    return this.logger.recent(limit, level);
  }

  info(): Record<string, unknown> {
    const memory = process.memoryUsage();
    return {
      application: "@sfhyl/api-server",
      version: APP_VERSION,
      environment: this.config.get<string>("NODE_ENV", "development"),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      processId: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      },
      timezone: process.env.TZ || "Asia/Shanghai",
      apiPrefix: this.config.get<string>("API_PREFIX", "api/v1"),
      storageDriver: this.config.get<string>("STORAGE_DRIVER", "local"),
      redisEnabled: this.config.get<boolean>("REDIS_ENABLED", false),
      rateLimitStorage: this.config.get<boolean>("REDIS_ENABLED", false) ? "redis" : "memory",
      redisKeyPrefix: this.config.get<string>("REDIS_KEY_PREFIX", "sfhyl"),
      timestamp: new Date().toISOString(),
    };
  }
}
