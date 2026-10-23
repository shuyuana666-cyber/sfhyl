import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header('x-request-id');
    request.requestId = supplied && VALID_REQUEST_ID.test(supplied) ? supplied : randomUUID();
    request.startedAt = Date.now();
    response.setHeader('x-request-id', request.requestId);
    next();
  }
}
