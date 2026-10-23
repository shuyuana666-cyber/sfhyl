import { BannerStatus, LinkTarget } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  key!: string;

  @IsOptional() @IsString() @MaxLength(255) titleZh?: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(255) titleRu?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleZh?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleEn?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitleRu?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionZh?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @Matches(/^\d+$/) desktopMediaId?: string;
  @IsOptional() @Matches(/^\d+$/) mobileMediaId?: string;
  @IsOptional() @IsString() @MaxLength(120) buttonTextZh?: string;
  @IsOptional() @IsString() @MaxLength(120) buttonTextEn?: string;
  @IsOptional() @IsString() @MaxLength(120) buttonTextRu?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(1024) linkUrl?: string;
  @IsOptional() @IsEnum(LinkTarget) linkTarget: LinkTarget = LinkTarget.SAME_TAB;
  @IsOptional() @IsEnum(BannerStatus) status: BannerStatus = BannerStatus.DRAFT;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsInt() sortOrder = 0;
}
