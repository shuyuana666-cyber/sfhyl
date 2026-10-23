import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SubmitInquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(191) companyName?: string;
  @IsOptional() @IsString() @Matches(/^[+\d()\s.-]{5,64}$/) phone?: string;
  @IsOptional() @IsString() @Matches(/^[+\d()\s.-]{5,64}$/) whatsapp?: string;
  @IsOptional() @IsEmail() @MaxLength(191) email?: string;
  @IsOptional() @IsIn(['zh', 'en', 'ru']) preferredLanguage?: string;
  @IsOptional() @Matches(/^\d+$/) vehicleId?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  message!: string;

  @IsOptional() @IsString() @MaxLength(2048) sourcePage?: string;
  @IsOptional() @IsString() @MaxLength(255) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(255) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(255) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(255) utmTerm?: string;
  @IsOptional() @IsString() @MaxLength(255) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(2048) captchaToken?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
