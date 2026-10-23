import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CatalogQueryDto {
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @Matches(/^\d+$/) brandId?: string;
  @IsOptional() @Matches(/^\d+$/) seriesId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() enabled?: boolean;
}

export class QuickCreateBrandDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

export class CreateBrandDto {
  @IsString() @MaxLength(120) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(120) nameRu?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(191) slug?: string;
  @IsOptional() @Matches(/^\d+$/) logoMediaId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
  @IsOptional() @IsString() @MaxLength(255) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) seoKeywords?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class CreateSeriesDto {
  @Matches(/^\d+$/) brandId!: string;
  @IsString() @MaxLength(120) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(120) nameRu?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(191) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateSeriesDto extends PartialType(CreateSeriesDto) {}

export class CreateModelDto {
  @Matches(/^\d+$/) brandId!: string;
  @Matches(/^\d+$/) seriesId!: string;
  @IsString() @MaxLength(120) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(120) nameRu?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(191) slug?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2200) year?: number;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateModelDto extends PartialType(CreateModelDto) {}

export class CreateCategoryDto {
  @IsString() @MaxLength(100) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(100) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(100) nameRu?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateTagDto {
  @IsString() @MaxLength(100) nameZh!: string;
  @IsOptional() @IsString() @MaxLength(100) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(100) nameRu?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}
