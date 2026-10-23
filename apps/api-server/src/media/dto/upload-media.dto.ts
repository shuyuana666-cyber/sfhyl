import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadMediaDto {
  @IsOptional()
  @Matches(/^\d+$/)
  folderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altRu?: string;
}
