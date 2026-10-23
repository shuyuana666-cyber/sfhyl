import {
  ContentStatus,
  Prisma,
  VehicleMediaType,
  VehicleSaleStatus,
} from "@prisma/client";
import { sanitizeRichText } from "../common/security/sanitize-rich-text";
import type {
  CreateVehicleDto,
  UpdateVehicleDto,
} from "./dto/create-vehicle.dto";
import { VehicleBatchAction } from "./dto/vehicle-actions.dto";
import type { VehicleMediaItemDto } from "./dto/vehicle-media.dto";

export function createVehicleData(
  dto: CreateVehicleDto,
  actorId: bigint,
  slug: string,
): Prisma.VehicleUncheckedCreateInput {
  return {
    ...updateVehicleData(dto),
    stockNo: dto.stockNo!.trim(),
    type: dto.type,
    nameZh: dto.nameZh,
    nameEn: dto.nameEn ?? dto.nameZh,
    slug,
    brandId: BigInt(dto.brandId),
    year: dto.year,
    price: new Prisma.Decimal(dto.price ?? "0"),
    status: ContentStatus.DRAFT,
    createdById: actorId,
    updatedById: actorId,
  } as Prisma.VehicleUncheckedCreateInput;
}

export function updateVehicleData(
  dto: UpdateVehicleDto,
): Prisma.VehicleUncheckedUpdateInput {
  return {
    stockNo: dto.stockNo?.trim(),
    vin: dto.vin?.trim(),
    type: dto.type,
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    brandId: dto.brandId ? BigInt(dto.brandId) : undefined,
    seriesId:
      dto.seriesId === null
        ? null
        : dto.seriesId
          ? BigInt(dto.seriesId)
          : undefined,
    modelId:
      dto.modelId === null
        ? null
        : dto.modelId
          ? BigInt(dto.modelId)
          : undefined,
    categoryId:
      dto.categoryId === null
        ? null
        : dto.categoryId
          ? BigInt(dto.categoryId)
          : undefined,
    category: dto.category,
    year: dto.year,
    manufactureDate: dto.manufactureDate
      ? new Date(dto.manufactureDate)
      : undefined,
    registrationDate: dto.registrationDate
      ? new Date(dto.registrationDate)
      : undefined,
    price: dto.price ? new Prisma.Decimal(dto.price) : undefined,
    originalPrice: dto.originalPrice
      ? new Prisma.Decimal(dto.originalPrice)
      : undefined,
    currency: dto.currency,
    showPrice: dto.showPrice,
    showInquiryPrice: dto.showInquiryPrice,
    priceNote: dto.priceNote,
    mileage: dto.mileage,
    mileageUnit: dto.mileageUnit,
    displacement: dto.displacement
      ? new Prisma.Decimal(dto.displacement)
      : undefined,
    fuelType: dto.fuelType,
    transmission: dto.transmission,
    driveType: dto.driveType,
    bodyType: dto.bodyType,
    doors: dto.doors,
    seats: dto.seats,
    exteriorColor: dto.exteriorColor,
    interiorColor: dto.interiorColor,
    engineModel: dto.engineModel,
    enginePower: dto.enginePower,
    batteryCapacity: dto.batteryCapacity
      ? new Prisma.Decimal(dto.batteryCapacity)
      : undefined,
    rangeKm: dto.rangeKm,
    emissionStandard: dto.emissionStandard,
    dimensions: dto.dimensions,
    curbWeightKg: dto.curbWeightKg,
    location: dto.location,
    shortDescriptionZh: dto.shortDescriptionZh,
    shortDescriptionEn: dto.shortDescriptionEn,
    shortDescriptionRu: dto.shortDescriptionRu,
    descriptionZh: sanitizeRichText(dto.descriptionZh),
    descriptionEn: sanitizeRichText(dto.descriptionEn),
    descriptionRu: sanitizeRichText(dto.descriptionRu),
    highlights: dto.highlights as Prisma.InputJsonValue | undefined,
    specifications: dto.specifications as Prisma.InputJsonValue | undefined,
    saleStatus: dto.saleStatus,
    isFeatured: dto.isFeatured,
    isHomepage: dto.isHomepage,
    isHot: dto.isHot,
    sortOrder: dto.sortOrder,
    scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    seoTitle: dto.seoTitle,
    seoKeywords: dto.seoKeywords,
    seoDescription: dto.seoDescription,
    canonicalUrl: dto.canonicalUrl,
  };
}

export function vehicleMediaRows(
  vehicleId: bigint,
  items: VehicleMediaItemDto[],
): Prisma.VehicleMediaCreateManyInput[] {
  return items.map((item, index) => ({
    vehicleId,
    mediaId: BigInt(item.mediaId),
    type:
      item.type === VehicleMediaType.COVER
        ? VehicleMediaType.GALLERY
        : (item.type ?? VehicleMediaType.GALLERY),
    altZh: item.altZh,
    altEn: item.altEn,
    altRu: item.altRu,
    sortOrder: item.sortOrder ?? index,
    isCover: false,
  }));
}

export function uniqueVehicleIds(values: string[] | undefined): bigint[] {
  return [...new Set(values ?? [])].map(BigInt);
}

export function vehicleBatchUpdateData(
  action: VehicleBatchAction,
  actorId: bigint,
): Prisma.VehicleUncheckedUpdateManyInput {
  const common = { updatedById: actorId };
  switch (action) {
    case VehicleBatchAction.PUBLISH:
      return {
        ...common,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      };
    case VehicleBatchAction.OFFLINE:
      return { ...common, status: ContentStatus.OFFLINE };
    case VehicleBatchAction.FEATURE:
      return { ...common, isFeatured: true };
    case VehicleBatchAction.UNFEATURE:
      return { ...common, isFeatured: false };
    case VehicleBatchAction.DELETE:
      return {
        ...common,
        deletedAt: new Date(),
        status: ContentStatus.ARCHIVED,
      };
    case VehicleBatchAction.RESTORE:
      return { ...common, deletedAt: null, status: ContentStatus.DRAFT };
    case VehicleBatchAction.SOLD:
      return { ...common, saleStatus: VehicleSaleStatus.SOLD };
    case VehicleBatchAction.AVAILABLE:
      return { ...common, saleStatus: VehicleSaleStatus.AVAILABLE };
  }
}
