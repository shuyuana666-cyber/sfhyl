import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { VehicleMediaType } from '@prisma/client';

export class VehicleMediaItemDto {
  @Matches(/^\d+$/)
  mediaId!: string;

  @IsOptional() @IsEnum(VehicleMediaType) type?: VehicleMediaType;
  @IsOptional() @IsString() @MaxLength(255) altZh?: string;
  @IsOptional() @IsString() @MaxLength(255) altEn?: string;
  @IsOptional() @IsString() @MaxLength(255) altRu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isCover?: boolean;
}

export class AttachVehicleMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleMediaItemDto)
  items!: VehicleMediaItemDto[];
}
