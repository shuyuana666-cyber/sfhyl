import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { mergeMap, type Observable } from "rxjs";
import { PublicCacheService } from "./public-cache.service";

@Injectable()
export class PublicCacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: PublicCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const shouldInvalidate =
      request.originalUrl.split("?")[0]?.includes("/admin/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

    if (!shouldInvalidate) return next.handle();
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        await this.cache.invalidateAll();
        return value;
      }),
    );
  }
}
