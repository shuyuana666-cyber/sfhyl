import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[a-z]/, { message: '新密码必须包含小写字母' })
  @Matches(/[A-Z]/, { message: '新密码必须包含大写字母' })
  @Matches(/\d/, { message: '新密码必须包含数字' })
  newPassword!: string;
}
