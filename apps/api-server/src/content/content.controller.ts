import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { ContentService } from './content.service';
import { HomepageContentService } from './homepage-content.service';
import { HomepageContentDto } from './dto/homepage-content.dto';
import {
  CreateNavigationDto,
  CreatePageDto,
  NavigationQueryDto,
  PageQueryDto,
  SortContentItemsDto,
  UpdateNavigationDto,
  UpdatePageDto,
} from './dto/content.dto';

@ApiTags('admin/content')
@ApiBearerAuth()
@Controller('admin')
export class ContentController {
  constructor(private readonly content: ContentService, private readonly homepageContentService: HomepageContentService) {}

  @Get('homepage-content') @RequirePermissions('content:view')
  homepageContent(): Promise<unknown> { return this.homepageContentService.admin(); }

  @Put('homepage-content') @RequirePermissions('content:manage')
  saveHomepageContent(@Body() dto: HomepageContentDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.homepageContentService.save(dto.content, actor.id, requestMeta(req));
  }

  @Post('homepage-content/publish') @RequirePermissions('content:manage')
  publishHomepageContent(@CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.homepageContentService.publish(actor.id, requestMeta(req));
  }

  @Get('navigation') @RequirePermissions('content:view')
  navigation(@Query() query: NavigationQueryDto): Promise<unknown> { return this.content.navigation(query); }

  @Post('navigation') @RequirePermissions('navigation:manage')
  createNavigation(@Body() dto: CreateNavigationDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.createNavigation(dto, actor.id, requestMeta(req));
  }

  @Put('navigation/sort') @RequirePermissions('navigation:manage')
  async sortNavigation(@Body() dto: SortContentItemsDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ sorted: true }> {
    await this.content.sortNavigation(dto, actor.id, requestMeta(req)); return { sorted: true };
  }

  @Patch('navigation/:id') @RequirePermissions('navigation:manage')
  updateNavigation(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateNavigationDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.updateNavigation(id, dto, actor.id, requestMeta(req));
  }

  @Delete('navigation/:id') @RequirePermissions('navigation:manage')
  async removeNavigation(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.content.removeNavigation(id, actor.id, requestMeta(req)); return { deleted: true };
  }

  @Get('pages') @RequirePermissions('content:view')
  pages(@Query() query: PageQueryDto): Promise<unknown> { return this.content.pages(query); }

  @Post('pages') @RequirePermissions('content:manage')
  createPage(@Body() dto: CreatePageDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.createPage(dto, actor.id, requestMeta(req));
  }

  @Post('pages/:id/publish') @RequirePermissions('content:manage')
  publishPage(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.publishPage(id, actor.id, requestMeta(req));
  }

  @Post('pages/:id/restore') @RequirePermissions('content:manage')
  restorePage(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.restorePage(id, actor.id, requestMeta(req));
  }

  @Get('pages/:id') @RequirePermissions('content:view')
  page(@Param('id', ParseBigIntPipe) id: bigint): Promise<unknown> { return this.content.page(id); }

  @Patch('pages/:id') @RequirePermissions('content:manage')
  updatePage(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdatePageDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.content.updatePage(id, dto, actor.id, requestMeta(req));
  }

  @Delete('pages/:id') @RequirePermissions('content:manage')
  async removePage(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.content.removePage(id, actor.id, requestMeta(req)); return { deleted: true };
  }
}
