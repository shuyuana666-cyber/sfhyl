import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Currency, MileageUnit, VehicleSaleStatus, VehicleType } from '@prisma/client';
import { VehicleMediaItemDto } from './vehicle-media.dto';

const MONEY = /^\d{1,12}(?:\.\d{1,2})?$/;
const DECIMAL = /^\d{1,6}(?:\.\d{1,2})?$/;

export class CreateVehicleDto {
  @IsOptional() @IsString() @MaxLength(100) stockNo?: string;
  @IsOptional() @IsString() @MaxLength(64) vin?: string;
  @IsEnum(VehicleType) type!: VehicleType;
  @IsString() @MaxLength(255) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(255) nameRu?: string;
  // Kept optional for older API clients. New vehicles receive a server-generated slug.
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(191) slug?: string;
  @Matches(/^\d+$/) brandId!: string;
  @IsOptional() @Matches(/^\d+$/) seriesId?: string | null;
  @IsOptional() @Matches(/^\d+$/) modelId?: string | null;
  @IsOptional() @Matches(/^\d+$/) categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @Type(() => Number) @IsInt() @Min(1900) @Max(2200) year!: number;
  @IsOptional() @IsDateString() manufactureDate?: string;
  @IsOptional() @IsDateString() registrationDate?: string;
  @IsOptional() @Matches(MONEY) price?: string;
  @IsOptional() @Matches(MONEY) originalPrice?: string;
  @IsOptional() @IsEnum(Currency) currency?: Currency;
  @IsOptional() @Type(() => Boolean) @IsBoolean() showPrice?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() showInquiryPrice?: boolean;
  @IsOptional() @IsString() @MaxLength(500) priceNote?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) mileage?: number;
  @IsOptional() @IsEnum(MileageUnit) mileageUnit?: MileageUnit;
  @IsOptional() @Matches(DECIMAL) displacement?: string;
  @IsOptional() @IsString() @MaxLength(100) fuelType?: string;
  @IsOptional() @IsString() @MaxLength(100) transmission?: string;
  @IsOptional() @IsString() @MaxLength(100) driveType?: string;
  @IsOptional() @IsString() @MaxLength(100) bodyType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) doors?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) seats?: number;
  @IsOptional() @IsString() @MaxLength(100) exteriorColor?: string;
  @IsOptional() @IsString() @MaxLength(100) interiorColor?: string;
  @IsOptional() @IsString() @MaxLength(120) engineModel?: string;
  @IsOptional() @IsString() @MaxLength(120) enginePower?: string;
  @IsOptional() @Matches(DECIMAL) batteryCapacity?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5000) rangeKm?: number;
  @IsOptional() @IsString() @MaxLength(100) emissionStandard?: string;
  @IsOptional() @IsString() @MaxLength(120) dimensions?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000) curbWeightKg?: number;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsString() @MaxLength(5000) shortDescriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) shortDescriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) shortDescriptionRu?: string;
  @IsOptional() @IsString() @MaxLength(100_000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(100_000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(100_000) descriptionRu?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(500, { each: true }) highlights?: string[];
  @IsOptional() @IsObject() specifications?: Record<string, unknown>;
  @IsOptional() @IsEnum(VehicleSaleStatus) saleStatus?: VehicleSaleStatus;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isFeatured?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isHomepage?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isHot?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(255) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) seoKeywords?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(1024) canonicalUrl?: string;
  @IsOptional() @Matches(/^\d+$/) coverMediaId?: string | null;
  @IsOptional() @Type(() => Boolean) @IsBoolean() publishNow?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^\d+$/, { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VehicleMediaItemDto)
  media?: VehicleMediaItemDto[];
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
