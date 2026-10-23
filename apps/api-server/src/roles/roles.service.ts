import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<unknown> {
    return this.prisma.role.findMany({
      where: { deletedAt: null },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }

  permissions(): Promise<unknown> {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async create(dto: CreateRoleDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const permissionIds = await this.permissionIds(dto.permissionCodes);
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        nameZh: dto.nameZh,
        nameEn: dto.nameEn,
        description: dto.description,
        isEnabled: dto.isEnabled,
        createdById: actorId,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId, createdById: actorId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit.record({
      actorId,
      action: 'create',
      resourceType: 'role',
      resourceId: role.id,
      afterData: role,
      meta,
    });
    return role;
  }

  async update(id: bigint, dto: UpdateRoleDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
    });
    if (!before) throw new NotFoundException('角色不存在');
    if (before.isSystem) {
      await this.assertSuperAdmin(actorId);
      if (before.code === 'super_admin' && dto.permissionCodes) throw new BadRequestException('超级管理员权限不可移除');
      if (dto.isEnabled === false) throw new BadRequestException('系统角色不能停用');
    }
    const permissionIds = dto.permissionCodes ? await this.permissionIds(dto.permissionCodes) : undefined;
    const role = await this.prisma.$transaction(async (transaction) => {
      if (permissionIds) {
        await transaction.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds.length) {
          await transaction.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: id, permissionId, createdById: actorId })),
          });
        }
      }
      return transaction.role.update({
        where: { id },
        data: {
          nameZh: dto.nameZh,
          nameEn: dto.nameEn,
          description: dto.description,
          isEnabled: dto.isEnabled,
          updatedById: actorId,
        },
        include: { permissions: { include: { permission: true } } },
      });
    });
    await this.audit.record({
      actorId,
      action: 'update',
      resourceType: 'role',
      resourceId: id,
      beforeData: before,
      afterData: role,
      meta,
    });
    return role;
  }

  async remove(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.isSystem) throw new BadRequestException('系统角色不能删除');
    if (role._count.users) throw new ConflictException('角色仍有关联管理员，不能删除');
    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
    await this.audit.record({ actorId, action: 'delete', resourceType: 'role', resourceId: id, beforeData: role, meta });
  }

  private async permissionIds(codes: string[]): Promise<bigint[]> {
    const unique = [...new Set(codes)];
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: unique } }, select: { id: true } });
    if (permissions.length !== unique.length) throw new ConflictException('包含不存在的权限码');
    return permissions.map(({ id }) => id);
  }

  private async assertSuperAdmin(actorId: bigint): Promise<void> {
    const actor = await this.prisma.adminUser.findFirst({
      where: { id: actorId, deletedAt: null, roles: { some: { role: { code: 'super_admin', isEnabled: true, deletedAt: null } } } },
      select: { id: true },
    });
    if (!actor) throw new BadRequestException('只有超级管理员可以修改系统角色');
  }
}
