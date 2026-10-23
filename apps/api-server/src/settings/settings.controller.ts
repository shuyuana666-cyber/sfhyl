import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { requestMeta } from '../common/utils/request-meta';
import { UpdateSettingsGroupDto } from './dto/update-settings-group.dto';
import { SettingsService } from './settings.service';

@ApiTags('admin/settings')
@ApiBearerAuth()
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings:view')
  list(): Promise<Record<string, Record<string, unknown>>> {
    return this.settings.adminSettings();
  }

  @Patch(':group')
  @RequirePermissions('settings:update')
  update(
    @Param('group') group: string,
    @Body() dto: UpdateSettingsGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<Record<string, unknown>> {
    return this.settings.updateGroup(group, dto.settings, actor.id, requestMeta(request));
  }
}
