import type { Request } from 'express';

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
  method: string;
  path: string;
  durationMs: number;
}

export function requestMeta(request: Request): RequestMeta {
  const path = request.originalUrl.split('?', 1)[0] || request.path;
  return {
    // Express resolves this through the configured trusted proxy chain. Reading
    // X-Forwarded-For directly would let callers forge audit and inquiry IPs.
    ipAddress: request.ip || null,
    userAgent: request.header('user-agent')?.slice(0, 1000) || null,
    requestId: request.requestId,
    method: request.method,
    // Query values can contain tokens or other private data; audit records only
    // need the route path.
    path: path.slice(0, 2048),
    durationMs: Math.max(0, Date.now() - request.startedAt),
  };
}
