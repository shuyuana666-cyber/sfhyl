import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Matches(/^\d+$/)
  parentId?: string | null;
}
