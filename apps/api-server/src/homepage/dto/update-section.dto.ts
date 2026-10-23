import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateSectionDto {
  @IsOptional() @IsString() @MaxLength(255) titleZh?: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(255) titleRu?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleZh?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleEn?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleRu?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Matches(/^\d+$/) backgroundMediaId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) displayCount?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(100) styleKey?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
