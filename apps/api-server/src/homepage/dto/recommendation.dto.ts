import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class RecommendationQueryDto {
  @IsOptional() @Matches(/^\d+$/) sectionId?: string;
}

export class CreateRecommendationDto {
  @Matches(/^\d+$/) homepageSectionId!: string;
  @Matches(/^\d+$/) vehicleId!: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder = 0;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isEnabled = true;
}

export class UpdateRecommendationDto extends PartialType(CreateRecommendationDto) {}
