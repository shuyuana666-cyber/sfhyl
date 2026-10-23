import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { AdminUsersService } from './admin-users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@ApiTags('admin/users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @RequirePermissions('user:view')
  list(@Query() query: UserQueryDto): Promise<unknown> {
    return this.users.list(query);
  }

  @Post()
  @RequirePermissions('user:create')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.users.create(dto, actor.id, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.users.update(id, dto, actor.id, requestMeta(request));
  }

  @Delete(':id')
  @RequirePermissions('user:disable')
  async remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.users.remove(id, actor.id, requestMeta(request));
    return { deleted: true };
  }
}
