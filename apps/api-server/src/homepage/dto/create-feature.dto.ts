import { FeatureIconType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

export class CreateFeatureDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) key!: string;
  @IsEnum(FeatureIconType) iconType!: FeatureIconType;
  @IsOptional() @IsString() @MaxLength(100) iconName?: string;
  @IsOptional() @IsString() @MaxLength(20000) svgContent?: string;
  @IsOptional() @Matches(/^\d+$/) imageMediaId?: string;
  @IsString() @MaxLength(255) titleZh!: string;
  @IsString() @MaxLength(255) titleEn!: string;
  @IsOptional() @IsString() @MaxLength(255) titleRu?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionRu?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(1024) linkUrl?: string;
  @IsOptional() @IsInt() sortOrder = 0;
  @IsOptional() @IsBoolean() isEnabled = true;
}
