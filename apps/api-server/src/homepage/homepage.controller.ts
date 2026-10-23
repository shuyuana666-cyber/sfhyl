import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { CreateBannerDto } from './dto/create-banner.dto';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { SortItemsDto } from './dto/sort-items.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { HomepageService } from './homepage.service';
import { CreateRecommendationDto, RecommendationQueryDto, UpdateRecommendationDto } from './dto/recommendation.dto';

@ApiTags('admin/homepage')
@ApiBearerAuth()
@Controller('admin')
export class HomepageController {
  constructor(private readonly homepage: HomepageService) {}

  @Get('banners')
  @RequirePermissions('banner:view')
  banners(): Promise<unknown> {
    return this.homepage.adminBanners();
  }

  @Post('banners')
  @RequirePermissions('banner:create')
  createBanner(
    @Body() dto: CreateBannerDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.homepage.createBanner(dto, actor.id, requestMeta(request));
  }

  @Put('banners/sort')
  @RequirePermissions('banner:sort')
  async sortBanners(
    @Body() dto: SortItemsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ sorted: true }> {
    await this.homepage.sortBanners(dto, actor.id, requestMeta(request));
    return { sorted: true };
  }

  @Patch('banners/:id')
  @RequirePermissions('banner:update')
  updateBanner(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.homepage.updateBanner(id, dto, actor.id, requestMeta(request));
  }

  @Delete('banners/:id')
  @RequirePermissions('banner:delete')
  async removeBanner(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.homepage.removeBanner(id, actor.id, requestMeta(request));
    return { deleted: true };
  }

  @Get('features')
  @RequirePermissions('homepage:view')
  features(): Promise<unknown> {
    return this.homepage.adminFeatures();
  }

  @Post('features')
  @RequirePermissions('homepage:manage')
  createFeature(
    @Body() dto: CreateFeatureDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.homepage.createFeature(dto, actor.id, requestMeta(request));
  }

  @Put('features/sort')
  @RequirePermissions('homepage:manage')
  async sortFeatures(
    @Body() dto: SortItemsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ sorted: true }> {
    await this.homepage.sortFeatures(dto, actor.id, requestMeta(request));
    return { sorted: true };
  }

  @Patch('features/:id')
  @RequirePermissions('homepage:manage')
  updateFeature(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateFeatureDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.homepage.updateFeature(id, dto, actor.id, requestMeta(request));
  }

  @Delete('features/:id')
  @RequirePermissions('homepage:manage')
  async removeFeature(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.homepage.removeFeature(id, actor.id, requestMeta(request));
    return { deleted: true };
  }

  @Get('homepage-sections')
  @RequirePermissions('homepage:view')
  sections(): Promise<unknown> {
    return this.homepage.adminSections();
  }

  @Put('homepage-sections/sort')
  @RequirePermissions('homepage:manage')
  async sortSections(
    @Body() dto: SortItemsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ sorted: true }> {
    await this.homepage.sortSections(dto, actor.id, requestMeta(request));
    return { sorted: true };
  }

  @Patch('homepage-sections/:id')
  @RequirePermissions('homepage:manage')
  updateSection(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.homepage.updateSection(id, dto, actor.id, requestMeta(request));
  }

  @Get('recommendations')
  @RequirePermissions('homepage:view')
  recommendations(@Query() query: RecommendationQueryDto): Promise<unknown> {
    return this.homepage.adminRecommendations(query);
  }

  @Post('recommendations')
  @RequirePermissions('homepage:manage')
  createRecommendation(@Body() dto: CreateRecommendationDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.homepage.createRecommendation(dto, actor.id, requestMeta(request));
  }

  @Put('recommendations/sort')
  @RequirePermissions('homepage:manage')
  async sortRecommendations(@Body() dto: SortItemsDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<{ sorted: true }> {
    await this.homepage.sortRecommendations(dto, actor.id, requestMeta(request));
    return { sorted: true };
  }

  @Patch('recommendations/:id')
  @RequirePermissions('homepage:manage')
  updateRecommendation(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateRecommendationDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.homepage.updateRecommendation(id, dto, actor.id, requestMeta(request));
  }

  @Delete('recommendations/:id')
  @RequirePermissions('homepage:manage')
  async removeRecommendation(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<{ deleted: true }> {
    await this.homepage.removeRecommendation(id, actor.id, requestMeta(request));
    return { deleted: true };
  }
}
