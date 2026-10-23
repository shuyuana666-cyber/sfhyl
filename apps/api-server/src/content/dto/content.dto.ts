import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ContentStatus, LinkTarget } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NavigationQueryDto {
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() enabled?: boolean;
}

export class CreateNavigationDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) key!: string;
  @IsString() @MinLength(1) @MaxLength(120) labelZh!: string;
  @IsString() @MinLength(1) @MaxLength(120) labelEn!: string;
  @IsOptional() @IsString() @MaxLength(120) labelRu?: string;
  @IsString() @MinLength(1) @MaxLength(1024) href!: string;
  @IsOptional() @IsEnum(LinkTarget) target: LinkTarget = LinkTarget.SAME_TAB;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @Matches(/^\d+$/) parentId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateNavigationDto extends PartialType(CreateNavigationDto) {}

export class SortContentItemsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SortContentItemDto)
  items!: SortContentItemDto[];
}

export class SortContentItemDto {
  @Matches(/^\d+$/) id!: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
}

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(120) keyword?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsIn(['false', 'true']) deleted = 'false';
}

export class CreatePageDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(191) slug?: string;
  @IsString() @MinLength(1) @MaxLength(255) titleZh!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(255) titleRu?: string;
  @IsOptional() @IsString() @MaxLength(5000) summaryZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) summaryEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) summaryRu?: string;
  @IsString() @MaxLength(200000) contentZh!: string;
  @IsOptional() @IsString() @MaxLength(200000) contentEn?: string;
  @IsOptional() @IsString() @MaxLength(200000) contentRu?: string;
  @IsOptional() @IsEnum(ContentStatus) status: ContentStatus = ContentStatus.DRAFT;
  @IsOptional() @Matches(/^\d+$/) ogMediaId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) seoKeywords?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}
