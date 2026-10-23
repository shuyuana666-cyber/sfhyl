import { Injectable } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { CatalogQueryDto } from "./dto/catalog.dto";

@Injectable()
export class CatalogQueryService {
  constructor(private readonly prisma: PrismaService) {}

  brands(query: CatalogQueryDto): Promise<unknown> {
    return this.prisma.brand.findMany({
      where: {
        deletedAt: null,
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { nameRu: { contains: query.keyword } },
                { slug: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: {
        logoMedia: true,
        _count: {
          select: { series: true, vehicleModels: true, vehicles: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
  }

  series(query: CatalogQueryDto): Promise<unknown> {
    return this.prisma.vehicleSeries.findMany({
      where: {
        deletedAt: null,
        brandId: query.brandId ? BigInt(query.brandId) : undefined,
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { slug: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: {
        brand: true,
        _count: { select: { models: true, vehicles: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
  }

  models(query: CatalogQueryDto): Promise<unknown> {
    return this.prisma.vehicleModel.findMany({
      where: {
        deletedAt: null,
        brandId: query.brandId ? BigInt(query.brandId) : undefined,
        seriesId: query.seriesId ? BigInt(query.seriesId) : undefined,
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { slug: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: {
        brand: true,
        series: true,
        _count: { select: { vehicles: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { year: "desc" }, { nameEn: "asc" }],
    });
  }

  tags(query: CatalogQueryDto): Promise<unknown> {
    return this.prisma.vehicleTag.findMany({
      where: {
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { slug: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { vehicles: true } } },
      orderBy: [{ nameEn: "asc" }],
    });
  }

  categories(query: CatalogQueryDto): Promise<unknown> {
    return this.prisma.vehicleCategory.findMany({
      where: {
        deletedAt: null,
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { slug: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { vehicles: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
  }
}
