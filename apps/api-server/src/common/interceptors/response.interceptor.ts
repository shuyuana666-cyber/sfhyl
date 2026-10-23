import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import type { ApiSuccess } from '../interfaces/api-response';
import { toJsonSafe } from '../utils/serialize';

@Injectable()
export class ResponseInterceptor implements NestInterceptor<unknown, ApiSuccess<unknown>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccess<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (response.headersSent) return data as ApiSuccess<unknown>;
        return {
          code: 0,
          message: 'success',
          data: toJsonSafe(data),
          requestId: request.requestId,
        };
      }),
    );
  }
}
