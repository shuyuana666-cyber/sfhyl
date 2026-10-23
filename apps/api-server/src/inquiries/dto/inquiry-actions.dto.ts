import { InquiryStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateInquiryDto {
  @IsOptional() @IsEnum(InquiryStatus) status?: InquiryStatus;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(191) companyName?: string;
  @IsOptional() @IsString() @Matches(/^[+\d()\s.-]{5,64}$/) phone?: string;
  @IsOptional() @IsString() @Matches(/^[+\d()\s.-]{5,64}$/) whatsapp?: string;
  @IsOptional() @IsEmail() @MaxLength(191) email?: string;
  @IsOptional() @IsString() @MaxLength(5000) message?: string;
}

export class AddInquiryNoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) content!: string;
  @IsOptional() @IsBoolean() isInternal = true;
}

export class AssignInquiryDto {
  @Matches(/^\d+$/) assignedToId!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BatchInquiryStatusDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @Matches(/^\d+$/, { each: true }) ids!: string[];
  @IsEnum(InquiryStatus) status!: InquiryStatus;
}

export class BatchInquiryAssignDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @Matches(/^\d+$/, { each: true }) ids!: string[];
  @Matches(/^\d+$/) assignedToId!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
