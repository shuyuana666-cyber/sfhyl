import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { MediaAssetStatus } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { UpdateVehicleDto } from "./dto/create-vehicle.dto";
import type { VehicleMediaItemDto } from "./dto/vehicle-media.dto";
import { uniqueVehicleIds } from "./vehicle-data.mapper";

interface CurrentVehicleReferences {
  brandId: bigint;
  seriesId: bigint | null;
  modelId: bigint | null;
  categoryId: bigint | null;
}

export class VehicleReferenceValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validateReferences(
    dto: UpdateVehicleDto,
    current?: CurrentVehicleReferences,
  ): Promise<{ categoryName?: string | null }> {
    const brandId = dto.brandId ? BigInt(dto.brandId) : current?.brandId;
    if (!brandId) throw new BadRequestException("必须选择品牌");
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, isEnabled: true, deletedAt: null },
    });
    if (!brand) throw new NotFoundException("品牌不存在或已停用");

    const seriesId =
      dto.seriesId === null
        ? null
        : dto.seriesId
          ? BigInt(dto.seriesId)
          : current?.seriesId;
    if (seriesId) {
      const series = await this.prisma.vehicleSeries.findFirst({
        where: { id: seriesId, brandId, isEnabled: true, deletedAt: null },
      });
      if (!series) throw new ConflictException("车系不存在或不属于所选品牌");
    }
    const modelId =
      dto.modelId === null
        ? null
        : dto.modelId
          ? BigInt(dto.modelId)
          : current?.modelId;
    if (modelId) {
      if (!seriesId) throw new ConflictException("选择车型前必须选择车系");
      const model = await this.prisma.vehicleModel.findFirst({
        where: {
          id: modelId,
          brandId,
          seriesId,
          isEnabled: true,
          deletedAt: null,
        },
      });
      if (!model)
        throw new ConflictException("车型不存在或不属于所选品牌和车系");
    }

    let categoryName: string | null | undefined;
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) categoryName = null;
      else {
        const category = await this.prisma.vehicleCategory.findFirst({
          where: {
            id: BigInt(dto.categoryId),
            isEnabled: true,
            deletedAt: null,
          },
          select: { nameZh: true },
        });
        if (!category) throw new NotFoundException("车辆分类不存在或已停用");
        categoryName = category.nameZh;
      }
    }

    if (dto.tagIds) {
      const tagIds = uniqueVehicleIds(dto.tagIds);
      const count = await this.prisma.vehicleTag.count({
        where: { id: { in: tagIds }, isEnabled: true },
      });
      if (count !== tagIds.length)
        throw new NotFoundException("包含不存在或已停用的车辆标签");
    }
    if (dto.media) await this.validateMedia(dto.media);
    return { categoryName };
  }

  async assertIdentityAvailable(
    dto: UpdateVehicleDto,
    currentId?: bigint,
  ): Promise<void> {
    const stockNo = dto.stockNo?.trim();
    const vin = dto.vin?.trim();
    if (!stockNo && !vin) return;

    const existing = await this.prisma.vehicle.findFirst({
      where: {
        ...(currentId ? { id: { not: currentId } } : {}),
        OR: [...(stockNo ? [{ stockNo }] : []), ...(vin ? [{ vin }] : [])],
      },
      select: { stockNo: true, vin: true },
    });
    if (!existing) return;

    if (stockNo && existing.stockNo === stockNo) {
      throw new ConflictException(
        `库存编号“${stockNo}”已存在，请使用其他库存编号或编辑现有车辆`,
      );
    }
    throw new ConflictException(`VIN“${vin}”已存在，请核对后重试`);
  }

  async validateMedia(items: VehicleMediaItemDto[]): Promise<void> {
    const ids = items.map((item) => item.mediaId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException("车辆素材列表包含重复项目");
    await this.validateMediaIds(uniqueVehicleIds(ids));
  }

  private async validateMediaIds(ids: bigint[]): Promise<void> {
    const count = await this.prisma.mediaAsset.count({
      where: {
        id: { in: ids },
        status: MediaAssetStatus.ACTIVE,
        deletedAt: null,
      },
    });
    if (count !== ids.length)
      throw new NotFoundException("包含不存在或已删除的素材");
  }
}
