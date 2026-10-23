import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMeta } from '../common/utils/request-meta';
import { toJsonSafe } from '../common/utils/serialize';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

export interface AuditEntry {
  actorId: bigint | null;
  action: string;
  resourceType: string;
  resourceId?: bigint | string | null;
  summary?: string;
  module?: string;
  beforeData?: unknown;
  afterData?: unknown;
  meta: RequestMeta;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    const actor = entry.actorId
      ? await this.prisma.adminUser.findUnique({
          where: { id: entry.actorId },
          select: { username: true, displayName: true },
        })
      : null;
    await this.prisma.auditLog.create({
      data: {
        adminUserId: entry.actorId,
        actorName: actor?.displayName || actor?.username,
        module: entry.module ?? entry.resourceType.split('_')[0],
        action: entry.action,
        requestMethod: entry.meta.method,
        requestPath: entry.meta.path,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId == null ? null : entry.resourceId.toString(),
        summary: entry.summary,
        beforeData: this.asJson(entry.beforeData),
        afterData: this.asJson(entry.afterData),
        ipAddress: entry.meta.ipAddress,
        userAgent: entry.meta.userAgent,
        durationMs: entry.meta.durationMs,
        requestId: entry.meta.requestId,
      },
    });
  }

  private asJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return toJsonSafe(value) as Prisma.InputJsonValue;
  }
}
