import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CreateFolderDto } from './create-folder.dto';

export class UpdateMediaDto {
  @IsOptional() @IsString() @MaxLength(255) originalName?: string;
  @IsOptional() @Matches(/^\d+$/) folderId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) altZh?: string;
  @IsOptional() @IsString() @MaxLength(255) altEn?: string;
  @IsOptional() @IsString() @MaxLength(255) altRu?: string;
}

export class UpdateFolderDto extends PartialType(CreateFolderDto) {}
