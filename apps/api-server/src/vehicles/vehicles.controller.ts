import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { ParseBigIntPipe } from '../common/pipes/parse-bigint.pipe';
import { requestMeta } from '../common/utils/request-meta';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { AttachVehicleMediaDto } from './dto/vehicle-media.dto';
import { VehicleBatchActionDto, VehicleFeaturedDto, VehicleSaleStatusDto } from './dto/vehicle-actions.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('admin/vehicles')
@ApiBearerAuth()
@Controller('admin/vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @RequirePermissions('vehicle:view')
  list(@Query() query: VehicleQueryDto): Promise<unknown> {
    return this.vehicles.list(query);
  }

  @Post()
  @RequirePermissions('vehicle:create')
  create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.create(dto, actor.id, requestMeta(request));
  }

  @Post('batch-action')
  @RequirePermissions('vehicle:batch')
  batch(
    @Body() dto: VehicleBatchActionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ affected: number }> {
    return this.vehicles.batch(dto, actor.id, requestMeta(request));
  }

  @Get('export')
  @RequirePermissions('vehicle:export')
  async export(@Query() query: VehicleQueryDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request, @Res() response: Response): Promise<void> {
    const csv = await this.vehicles.exportCsv(query, actor.id, requestMeta(request));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="vehicles-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.status(200).send(csv);
  }

  @Post(':id/duplicate')
  @RequirePermissions('vehicle:create')
  duplicate(@Param('id', ParseBigIntPipe) id: bigint, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request): Promise<unknown> {
    return this.vehicles.duplicate(id, actor.id, requestMeta(request));
  }

  @Get(':id')
  @RequirePermissions('vehicle:view')
  detail(@Param('id', ParseBigIntPipe) id: bigint): Promise<unknown> {
    return this.vehicles.detail(id);
  }

  @Patch(':id')
  @RequirePermissions('vehicle:update')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.update(id, dto, actor.id, requestMeta(request));
  }

  @Delete(':id')
  @RequirePermissions('vehicle:delete')
  async remove(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.vehicles.remove(id, actor.id, requestMeta(request));
    return { deleted: true };
  }

  @Post(':id/publish')
  @RequirePermissions('vehicle:publish')
  publish(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.publish(id, actor.id, requestMeta(request));
  }

  @Post(':id/offline')
  @RequirePermissions('vehicle:offline')
  offline(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.offline(id, actor.id, requestMeta(request));
  }

  @Post(':id/restore')
  @RequirePermissions('vehicle:restore')
  restore(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.restore(id, actor.id, requestMeta(request));
  }

  @Post(':id/sale-status')
  @RequirePermissions('vehicle:update')
  saleStatus(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: VehicleSaleStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.setSaleStatus(id, dto.saleStatus, actor.id, requestMeta(request));
  }

  @Post(':id/featured')
  @RequirePermissions('vehicle:update')
  featured(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: VehicleFeaturedDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.setFeatured(id, dto.isFeatured, actor.id, requestMeta(request));
  }

  @Post(':id/media')
  @RequirePermissions('vehicle:update')
  media(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: AttachVehicleMediaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.vehicles.attachMedia(id, dto, actor.id, requestMeta(request));
  }

  @Delete(':id/media/:mediaId')
  @RequirePermissions('vehicle:update')
  async detachMedia(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Param('mediaId', ParseBigIntPipe) mediaId: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ deleted: true }> {
    await this.vehicles.detachMedia(id, mediaId, actor.id, requestMeta(request));
    return { deleted: true };
  }
}
