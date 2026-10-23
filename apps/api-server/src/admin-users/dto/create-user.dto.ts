import { ApiProperty } from '@nestjs/swagger';
import { AdminUserStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]+$/)
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[a-z]/)
  @Matches(/[A-Z]/)
  @Matches(/\d/)
  password!: string;

  @IsOptional()
  @IsEnum(AdminUserStatus)
  status: AdminUserStatus = AdminUserStatus.ACTIVE;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @Matches(/^\d+$/, { each: true })
  roleIds!: string[];
}
