import { Type } from 'class-transformer';
import { ContentStatus, VehicleSaleStatus, VehicleType } from '@prisma/client';
import { IsBooleanString, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PickType } from '@nestjs/swagger';

export class VehicleQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @Matches(/^\d+$/) brandId?: string;
  @IsOptional() @Matches(/^\d+$/) seriesId?: string;
  @IsOptional() @Matches(/^\d+$/) modelId?: string;
  @IsOptional() @Matches(/^\d+$/) categoryId?: string;
  @IsOptional() @IsEnum(VehicleType) type?: VehicleType;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsEnum(VehicleSaleStatus) saleStatus?: VehicleSaleStatus;
  @IsOptional() @IsBooleanString() isFeatured?: string;
  @IsOptional() @IsBooleanString() deleted?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2200) yearMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2200) yearMax?: number;
  @IsOptional() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) priceMin?: string;
  @IsOptional() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) priceMax?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @IsDateString() publishedFrom?: string;
  @IsOptional() @IsDateString() publishedTo?: string;
  @IsOptional() @IsIn(['createdAt', 'updatedAt', 'publishedAt', 'price', 'year', 'sortOrder']) sortBy = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class PublicVehicleQueryDto extends PickType(VehicleQueryDto, [
  'page',
  'pageSize',
  'keyword',
  'brandId',
  'seriesId',
  'modelId',
  'categoryId',
  'type',
  'saleStatus',
  'isFeatured',
  'yearMin',
  'yearMax',
  'priceMin',
  'priceMax',
  'sortBy',
  'sortOrder',
] as const) {}
