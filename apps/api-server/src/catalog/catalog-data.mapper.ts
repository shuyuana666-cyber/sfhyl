import { Prisma } from "@prisma/client";
import type {
  CreateCategoryDto,
  CreateTagDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateModelDto,
  UpdateSeriesDto,
  UpdateTagDto,
} from "./dto/catalog.dto";

export function brandUpdateData(
  dto: UpdateBrandDto,
): Prisma.BrandUncheckedUpdateInput {
  return {
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    logoMediaId: dto.logoMediaId === null ? null : dto.logoMediaId ? BigInt(dto.logoMediaId) : undefined,
    country: dto.country,
    descriptionZh: dto.descriptionZh,
    descriptionEn: dto.descriptionEn,
    descriptionRu: dto.descriptionRu,
    sortOrder: dto.sortOrder,
    isEnabled: dto.isEnabled,
    seoTitle: dto.seoTitle,
    seoKeywords: dto.seoKeywords,
    seoDescription: dto.seoDescription,
  };
}

export function seriesUpdateData(
  dto: UpdateSeriesDto,
): Prisma.VehicleSeriesUncheckedUpdateInput {
  return {
    brandId: dto.brandId ? BigInt(dto.brandId) : undefined,
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    descriptionZh: dto.descriptionZh,
    descriptionEn: dto.descriptionEn,
    descriptionRu: dto.descriptionRu,
    sortOrder: dto.sortOrder,
    isEnabled: dto.isEnabled,
  };
}

export function modelUpdateData(
  dto: UpdateModelDto,
): Prisma.VehicleModelUncheckedUpdateInput {
  return {
    brandId: dto.brandId ? BigInt(dto.brandId) : undefined,
    seriesId: dto.seriesId ? BigInt(dto.seriesId) : undefined,
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    year: dto.year,
    descriptionZh: dto.descriptionZh,
    descriptionEn: dto.descriptionEn,
    descriptionRu: dto.descriptionRu,
    sortOrder: dto.sortOrder,
    isEnabled: dto.isEnabled,
  };
}

export function categoryUpdateData(
  dto: UpdateCategoryDto,
): Prisma.VehicleCategoryUncheckedUpdateInput {
  return {
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    descriptionZh: dto.descriptionZh,
    descriptionEn: dto.descriptionEn,
    descriptionRu: dto.descriptionRu,
    sortOrder: dto.sortOrder,
    isEnabled: dto.isEnabled,
  };
}

export function categoryCreateData(
  dto: CreateCategoryDto,
): Pick<
  Prisma.VehicleCategoryUncheckedCreateInput,
  | "nameRu"
  | "descriptionZh"
  | "descriptionEn"
  | "descriptionRu"
  | "sortOrder"
  | "isEnabled"
> {
  return {
    nameRu: dto.nameRu,
    descriptionZh: dto.descriptionZh,
    descriptionEn: dto.descriptionEn,
    descriptionRu: dto.descriptionRu,
    sortOrder: dto.sortOrder,
    isEnabled: dto.isEnabled,
  };
}

export function tagUpdateData(
  dto: UpdateTagDto,
): Prisma.VehicleTagUncheckedUpdateInput {
  return {
    nameZh: dto.nameZh,
    nameEn: dto.nameEn,
    nameRu: dto.nameRu,
    color: dto.color,
    isEnabled: dto.isEnabled,
  };
}

export function tagCreateData(
  dto: CreateTagDto,
): Pick<
  Prisma.VehicleTagUncheckedCreateInput,
  "nameRu" | "color" | "isEnabled"
> {
  return {
    nameRu: dto.nameRu,
    color: dto.color,
    isEnabled: dto.isEnabled,
  };
}
