import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('admin/roles')
@ApiBearerAuth()
@Controller('admin')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermissions('role:view')
  list(): Promise<unknown> {
    return this.roles.list();
  }

  @Get('permissions')
  @RequirePermissions('permission:view')
  permissions(): Promise<unknown> {
    return this.roles.permissions();
  }

  @Post('roles')
  @RequirePermissions('role:create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.roles.create(dto, actor.id, requestMeta(request));
  }

  @Patch('roles/:id')
  @RequirePermissions('role:update')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.roles.update(id, dto, actor.id, requestMeta(request));
  }

  @Delete('roles/:id')
  @RequirePermissions('role:delete')
  async remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.roles.remove(id, actor.id, requestMeta(request));
    return { deleted: true };
  }
}
