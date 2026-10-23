import {
  type ExecutionContext,
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { LoggingModule } from "./common/logging/logging.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { environmentSchema } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { CacheModule } from "./infrastructure/cache/cache.module";
import { RedisThrottlerStorage } from "./infrastructure/cache/redis-throttler.storage";
import { PublicCacheInvalidationInterceptor } from "./infrastructure/cache/public-cache-invalidation.interceptor";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { RolesModule } from "./roles/roles.module";
import { HomepageModule } from "./homepage/homepage.module";
import { MediaModule } from "./media/media.module";
import { PublicModule } from "./public-api/public.module";
import { SettingsModule } from "./settings/settings.module";
import { CatalogModule } from "./catalog/catalog.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { InquiriesModule } from "./inquiries/inquiries.module";
import { ContentModule } from "./content/content.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import type { Request } from "express";
import { SystemModule } from "./system/system.module";
import { CustomerAuthModule } from "./customer-auth/customer-auth.module";
import { TranslationModule } from "./translation/translation.module";

function requestPath(context: ExecutionContext): string {
  return (
    context.switchToHttp().getRequest<Request>().originalUrl.split("?")[0] ?? ""
  );
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    TranslationModule,
    ThrottlerModule.forRootAsync({
      imports: [CacheModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({ storage, throttlers: [
        {
          name: "default",
          ttl: config.get<number>("GLOBAL_RATE_LIMIT_TTL_MS", 60_000),
          limit: config.get<number>("GLOBAL_RATE_LIMIT_MAX", 120),
        },
        {
          name: "login",
          ttl: 60_000,
          limit: config.get<number>("LOGIN_RATE_LIMIT_MAX", 5),
          skipIf: (context) => !requestPath(context).endsWith("/auth/login"),
        },
        {
          name: "inquiry",
          ttl: config.get<number>("INQUIRY_RATE_LIMIT_TTL_MS", 600_000),
          limit: config.get<number>("INQUIRY_RATE_LIMIT_MAX", 5),
          skipIf: (context) =>
            !requestPath(context).endsWith("/public/inquiries"),
        },
      ] }),
    }),
    PrismaModule,
    LoggingModule,
    CacheModule,
    StorageModule,
    AuditModule,
    HealthModule,
    AuthModule,
    CustomerAuthModule,
    AdminUsersModule,
    RolesModule,
    MediaModule,
    SettingsModule,
    HomepageModule,
    CatalogModule,
    VehiclesModule,
    InquiriesModule,
    ContentModule,
    DashboardModule,
    SystemModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PublicCacheInvalidationInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
