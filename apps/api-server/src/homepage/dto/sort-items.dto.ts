import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, Matches, Min, ValidateNested } from 'class-validator';

export class SortItemDto {
  @Matches(/^\d+$/)
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class SortItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SortItemDto)
  items!: SortItemDto[];
}
