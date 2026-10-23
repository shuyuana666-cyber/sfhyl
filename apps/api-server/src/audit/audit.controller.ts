import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { paginated } from '../common/interfaces/api-response';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsString() @MaxLength(64) action?: string;
  @IsOptional() @IsString() @MaxLength(100) resourceType?: string;
  @IsOptional() @Matches(/^\d+$/) actorId?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}

class LoginLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(191) keyword?: string;
  @IsOptional() @Matches(/^\d+$/) actorId?: string;
  @IsOptional() @IsIn(['true', 'false']) success?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}

@ApiTags('admin/audit')
@ApiBearerAuth()
@Controller('admin')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit-logs')
  @RequirePermissions('audit:view')
  async list(@Query() query: AuditQueryDto): Promise<unknown> {
    const where = {
      adminUserId: query.actorId ? BigInt(query.actorId) : undefined,
      action: query.action,
      resourceType: query.resourceType,
      createdAt: query.createdFrom || query.createdTo ? {
        gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
        lte: query.createdTo ? new Date(query.createdTo) : undefined,
      } : undefined,
      ...(query.keyword ? { OR: [
        { actorName: { contains: query.keyword } },
        { summary: { contains: query.keyword } },
        { resourceId: { contains: query.keyword } },
        { requestPath: { contains: query.keyword } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { adminUser: { select: { id: true, username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  @Get('login-logs')
  @RequirePermissions('login-log:view')
  async loginLogs(@Query() query: LoginLogQueryDto): Promise<unknown> {
    const where = {
      adminUserId: query.actorId ? BigInt(query.actorId) : undefined,
      success: query.success === undefined ? undefined : query.success === 'true',
      createdAt: query.createdFrom || query.createdTo ? {
        gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
        lte: query.createdTo ? new Date(query.createdTo) : undefined,
      } : undefined,
      ...(query.keyword ? { OR: [
        { identifier: { contains: query.keyword } },
        { ipAddress: { contains: query.keyword } },
        { failureCode: { contains: query.keyword } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loginLog.findMany({
        where,
        include: { adminUser: { select: { id: true, username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.loginLog.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }
}
