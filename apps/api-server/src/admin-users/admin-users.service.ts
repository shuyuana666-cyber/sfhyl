import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/api-response';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserQueryDto } from './dto/user-query.dto';

const userInclude = {
  roles: { include: { role: { select: { id: true, code: true, nameZh: true, nameEn: true } } } },
} satisfies Prisma.AdminUserInclude;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserQueryDto): Promise<unknown> {
    const where: Prisma.AdminUserWhereInput = {
      deletedAt: null,
      status: query.status,
      ...(query.keyword
        ? {
            OR: [
              { username: { contains: query.keyword } },
              { email: { contains: query.keyword } },
              { displayName: { contains: query.keyword } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.adminUser.count({ where }),
    ]);
    return paginated(items.map(this.withoutPassword), total, query.page, query.pageSize);
  }

  async create(dto: CreateUserDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const roleIds = [...new Set(dto.roleIds.map(BigInt))];
    await this.assertRoles(roleIds);
    await this.assertCanGrantRoles(actorId, roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.adminUser.create({
      data: {
        username: dto.username.trim(),
        email: dto.email.trim().toLowerCase(),
        displayName: dto.displayName?.trim(),
        status: dto.status,
        passwordHash,
        passwordChangedAt: new Date(),
        roles: { create: roleIds.map((roleId) => ({ roleId, createdById: actorId })) },
      },
      include: userInclude,
    });
    await this.audit.record({
      actorId,
      action: 'create',
      resourceType: 'admin_user',
      resourceId: user.id,
      summary: `Created administrator ${user.username}`,
      afterData: this.withoutPassword(user),
      meta,
    });
    return this.withoutPassword(user);
  }

  async update(id: bigint, dto: UpdateUserDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.adminUser.findFirst({ where: { id, deletedAt: null }, include: userInclude });
    if (!before) throw new NotFoundException('管理员不存在');
    if (id === actorId && dto.status && dto.status !== before.status) {
      throw new BadRequestException('不能修改当前登录账号的状态');
    }

    const roleIds = dto.roleIds ? [...new Set(dto.roleIds.map(BigInt))] : undefined;
    if (roleIds) {
      await this.assertRoles(roleIds);
      await this.assertCanGrantRoles(actorId, roleIds);
    }
    const wasSuperAdmin = before.roles.some(({ role }) => role.code === 'super_admin');
    const willBeSuperAdmin = roleIds ? await this.includesSuperRole(roleIds) : wasSuperAdmin;
    if (wasSuperAdmin && !willBeSuperAdmin) {
      await this.assertSuperAdmin(actorId);
      await this.assertNotLastSuperAdmin(id);
    }
    if (wasSuperAdmin && dto.status && dto.status !== 'ACTIVE') {
      await this.assertSuperAdmin(actorId);
      await this.assertNotLastSuperAdmin(id);
    }
    const user = await this.prisma.$transaction(async (transaction) => {
      if (roleIds) {
        await transaction.adminUserRole.deleteMany({ where: { adminUserId: id } });
        await transaction.adminUserRole.createMany({
          data: roleIds.map((roleId) => ({ adminUserId: id, roleId, createdById: actorId })),
        });
      }
      return transaction.adminUser.update({
        where: { id },
        data: {
          email: dto.email?.trim().toLowerCase(),
          displayName: dto.displayName?.trim(),
          status: dto.status,
        },
        include: userInclude,
      });
    });
    await this.audit.record({
      actorId,
      action: 'update',
      resourceType: 'admin_user',
      resourceId: id,
      beforeData: this.withoutPassword(before),
      afterData: this.withoutPassword(user),
      meta,
    });
    return this.withoutPassword(user);
  }

  async remove(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    if (id === actorId) throw new BadRequestException('不能删除当前登录账号');
    const before = await this.prisma.adminUser.findFirst({ where: { id, deletedAt: null }, include: userInclude });
    if (!before) throw new NotFoundException('管理员不存在');
    if (before.roles.some(({ role }) => role.code === 'super_admin')) {
      await this.assertSuperAdmin(actorId);
      await this.assertNotLastSuperAdmin(id);
    }
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { adminUserId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'user_deleted' },
      }),
    ]);
    await this.audit.record({
      actorId,
      action: 'delete',
      resourceType: 'admin_user',
      resourceId: id,
      beforeData: this.withoutPassword(before),
      meta,
    });
  }

  private async assertRoles(roleIds: bigint[]): Promise<void> {
    const count = await this.prisma.role.count({
      where: { id: { in: roleIds }, isEnabled: true, deletedAt: null },
    });
    if (count !== roleIds.length) throw new ConflictException('包含不存在或已禁用的角色');
  }

  private async assertCanGrantRoles(actorId: bigint, roleIds: bigint[]): Promise<void> {
    if (await this.includesSuperRole(roleIds)) await this.assertSuperAdmin(actorId);
  }

  private async includesSuperRole(roleIds: bigint[]): Promise<boolean> {
    return Boolean(await this.prisma.role.findFirst({ where: { id: { in: roleIds }, code: 'super_admin', deletedAt: null }, select: { id: true } }));
  }

  private async assertSuperAdmin(actorId: bigint): Promise<void> {
    const actor = await this.prisma.adminUser.findFirst({
      where: { id: actorId, deletedAt: null, roles: { some: { role: { code: 'super_admin', isEnabled: true, deletedAt: null } } } },
      select: { id: true },
    });
    if (!actor) throw new BadRequestException('只有超级管理员可以授予或移除超级管理员角色');
  }

  private async assertNotLastSuperAdmin(targetId: bigint): Promise<void> {
    const count = await this.prisma.adminUser.count({
      where: {
        id: { not: targetId },
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { code: 'super_admin', isEnabled: true, deletedAt: null } } },
      },
    });
    if (!count) throw new BadRequestException('不能移除或停用最后一个超级管理员');
  }

  private readonly withoutPassword = <T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> => {
    const safe: Partial<T> = { ...user };
    delete safe.passwordHash;
    return safe as Omit<T, 'passwordHash'>;
  };
}
