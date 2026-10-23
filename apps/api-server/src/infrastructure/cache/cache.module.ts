import { Global, Module } from "@nestjs/common";
import { RedisHealthService } from "./redis-health.service";
import { PublicCacheService } from "./public-cache.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  providers: [RedisHealthService, PublicCacheService, RedisThrottlerStorage],
  exports: [RedisHealthService, PublicCacheService, RedisThrottlerStorage],
})
export class CacheModule {}
