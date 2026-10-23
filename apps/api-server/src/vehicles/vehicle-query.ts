import { ContentStatus, type Prisma } from "@prisma/client";
import type { PublicVehicleQueryDto, VehicleQueryDto } from "./dto/vehicle-query.dto";

export function buildAdminVehicleWhere(query: VehicleQueryDto): Prisma.VehicleWhereInput {
  return {
    deletedAt: query.deleted === "true" ? { not: null } : null,
    brandId: query.brandId ? BigInt(query.brandId) : undefined,
    seriesId: query.seriesId ? BigInt(query.seriesId) : undefined,
    modelId: query.modelId ? BigInt(query.modelId) : undefined,
    categoryId: query.categoryId ? BigInt(query.categoryId) : undefined,
    type: query.type,
    status: query.status,
    saleStatus: query.saleStatus,
    isFeatured: query.isFeatured === undefined ? undefined : query.isFeatured === "true",
    year: query.yearMin || query.yearMax
      ? { gte: query.yearMin, lte: query.yearMax }
      : undefined,
    price: query.priceMin || query.priceMax
      ? { gte: query.priceMin, lte: query.priceMax }
      : undefined,
    createdAt: query.createdFrom || query.createdTo
      ? {
          gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
          lte: query.createdTo ? endOfDate(query.createdTo) : undefined,
        }
      : undefined,
    publishedAt: query.publishedFrom || query.publishedTo
      ? {
          gte: query.publishedFrom ? new Date(query.publishedFrom) : undefined,
          lte: query.publishedTo ? endOfDate(query.publishedTo) : undefined,
        }
      : undefined,
    ...(query.keyword
      ? {
          OR: [
            { nameZh: { contains: query.keyword } },
            { nameEn: { contains: query.keyword } },
            { nameRu: { contains: query.keyword } },
            { stockNo: { contains: query.keyword } },
            { vin: { contains: query.keyword } },
          ],
        }
      : {}),
  };
}

export function buildPublicVehicleWhere(
  query: PublicVehicleQueryDto,
): Prisma.VehicleWhereInput {
  return {
    ...buildPublicVehicleAvailability(),
    brandId: query.brandId ? BigInt(query.brandId) : undefined,
    seriesId: query.seriesId ? BigInt(query.seriesId) : undefined,
    modelId: query.modelId ? BigInt(query.modelId) : undefined,
    categoryId: query.categoryId ? BigInt(query.categoryId) : undefined,
    type: query.type,
    saleStatus: query.saleStatus,
    isFeatured: query.isFeatured === undefined ? undefined : query.isFeatured === "true",
    year: query.yearMin || query.yearMax
      ? { gte: query.yearMin, lte: query.yearMax }
      : undefined,
    price: query.priceMin || query.priceMax
      ? { gte: query.priceMin, lte: query.priceMax }
      : undefined,
    ...(query.keyword
      ? {
          AND: [
            {
              OR: [
                { nameZh: { contains: query.keyword } },
                { nameEn: { contains: query.keyword } },
                { nameRu: { contains: query.keyword } },
              ],
            },
          ],
        }
      : {}),
  };
}

export function buildPublicVehicleAvailability(): Prisma.VehicleWhereInput {
  const now = new Date();
  return {
    deletedAt: null,
    status: ContentStatus.PUBLISHED,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
  };
}

function endOfDate(value: string): Date {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}
