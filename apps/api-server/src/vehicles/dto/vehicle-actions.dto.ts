import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsEnum, Matches } from 'class-validator';
import { VehicleSaleStatus } from '@prisma/client';

export enum VehicleBatchAction {
  PUBLISH = 'PUBLISH',
  OFFLINE = 'OFFLINE',
  FEATURE = 'FEATURE',
  UNFEATURE = 'UNFEATURE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  SOLD = 'SOLD',
  AVAILABLE = 'AVAILABLE',
}

export class VehicleBatchActionDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @Matches(/^\d+$/, { each: true }) ids!: string[];
  @IsEnum(VehicleBatchAction) action!: VehicleBatchAction;
}

export class VehicleSaleStatusDto {
  @IsEnum(VehicleSaleStatus)
  saleStatus!: VehicleSaleStatus;
}

export class VehicleFeaturedDto {
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured!: boolean;
}
