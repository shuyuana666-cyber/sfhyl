import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { CatalogService } from './catalog.service';
import { CatalogQueryService } from './catalog-query.service';
import {
  CatalogQueryDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateModelDto,
  QuickCreateBrandDto,
  CreateSeriesDto,
  CreateTagDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateModelDto,
  UpdateSeriesDto,
  UpdateTagDto,
} from './dto/catalog.dto';

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Controller('admin')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly catalogQueries: CatalogQueryService,
  ) {}

  @Get('brands')
  @RequirePermissions('brand:view')
  brands(@Query() query: CatalogQueryDto): Promise<unknown> {
    return this.catalogQueries.brands(query);
  }

  @Post('brands')
  @RequirePermissions('brand:manage')
  createBrand(@Body() dto: CreateBrandDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.createBrand(dto, actor.id, requestMeta(req));
  }

  @Post('brands/quick-create')
  @RequirePermissions('vehicle:create')
  quickCreateBrand(@Body() dto: QuickCreateBrandDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.quickCreateBrand(dto, actor.id, requestMeta(req));
  }

  @Patch('brands/:id')
  @RequirePermissions('brand:manage')
  updateBrand(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateBrandDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.updateBrand(id, dto, actor.id, requestMeta(req));
  }

  @Delete('brands/:id')
  @RequirePermissions('brand:manage')
  async removeBrand(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.catalog.removeBrand(id, actor.id, requestMeta(req));
    return { deleted: true };
  }

  @Get('series')
  @RequirePermissions('brand:view')
  series(@Query() query: CatalogQueryDto): Promise<unknown> {
    return this.catalogQueries.series(query);
  }

  @Post('series')
  @RequirePermissions('series:manage')
  createSeries(@Body() dto: CreateSeriesDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.createSeries(dto, actor.id, requestMeta(req));
  }

  @Patch('series/:id')
  @RequirePermissions('series:manage')
  updateSeries(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateSeriesDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.updateSeries(id, dto, actor.id, requestMeta(req));
  }

  @Delete('series/:id')
  @RequirePermissions('series:manage')
  async removeSeries(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.catalog.removeSeries(id, actor.id, requestMeta(req));
    return { deleted: true };
  }

  @Get('models')
  @RequirePermissions('brand:view')
  models(@Query() query: CatalogQueryDto): Promise<unknown> {
    return this.catalogQueries.models(query);
  }

  @Post('models')
  @RequirePermissions('model:manage')
  createModel(@Body() dto: CreateModelDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.createModel(dto, actor.id, requestMeta(req));
  }

  @Patch('models/:id')
  @RequirePermissions('model:manage')
  updateModel(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateModelDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.updateModel(id, dto, actor.id, requestMeta(req));
  }

  @Delete('models/:id')
  @RequirePermissions('model:manage')
  async removeModel(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.catalog.removeModel(id, actor.id, requestMeta(req));
    return { deleted: true };
  }

  @Get('categories')
  @RequirePermissions('vehicle:view')
  categories(@Query() query: CatalogQueryDto): Promise<unknown> {
    return this.catalogQueries.categories(query);
  }

  @Post('categories')
  @RequirePermissions('category:manage')
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.createCategory(dto, actor.id, requestMeta(req));
  }

  @Patch('categories/:id')
  @RequirePermissions('category:manage')
  updateCategory(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateCategoryDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.updateCategory(id, dto, actor.id, requestMeta(req));
  }

  @Delete('categories/:id')
  @RequirePermissions('category:manage')
  async removeCategory(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.catalog.removeCategory(id, actor.id, requestMeta(req));
    return { deleted: true };
  }

  @Get('tags')
  @RequirePermissions('vehicle:view')
  tags(@Query() query: CatalogQueryDto): Promise<unknown> {
    return this.catalogQueries.tags(query);
  }

  @Post('tags')
  @RequirePermissions('tag:manage')
  createTag(@Body() dto: CreateTagDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.createTag(dto, actor.id, requestMeta(req));
  }

  @Patch('tags/:id')
  @RequirePermissions('tag:manage')
  updateTag(@Param('id', ParseBigIntPipe) id: bigint, @Body() dto: UpdateTagDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<unknown> {
    return this.catalog.updateTag(id, dto, actor.id, requestMeta(req));
  }

  @Delete('tags/:id')
  @RequirePermissions('tag:manage')
  async removeTag(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request): Promise<{ deleted: true }> {
    await this.catalog.removeTag(id, actor.id, requestMeta(req));
    return { deleted: true };
  }
}
