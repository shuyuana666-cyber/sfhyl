import { ArrayMaxSize, IsArray, IsIn, IsOptional, Matches } from 'class-validator';

export class MediaBatchActionDto {
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(/^\d+$/, { each: true })
  ids!: string[];

  @IsIn(['MOVE', 'ARCHIVE', 'DELETE'])
  action!: 'MOVE' | 'ARCHIVE' | 'DELETE';

  @IsOptional()
  @Matches(/^\d+$/)
  folderId?: string | null;
}
