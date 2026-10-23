import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CustomerRegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  companyName?: string;

  @IsString()
  @Matches(/^[+\d()\s.-]{5,64}$/)
  phone!: string;

  @IsEmail()
  @MaxLength(191)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class CustomerLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(191)
  identifier!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember = false;
}

export class CustomerRefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class CustomerProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  companyName?: string;

  @IsString()
  @Matches(/^[+\d()\s.-]{5,64}$/)
  phone!: string;

  @IsEmail()
  @MaxLength(191)
  email!: string;
}
