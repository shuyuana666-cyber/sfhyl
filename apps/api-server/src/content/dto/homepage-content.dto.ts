import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class HomepageContentDto {
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;
}
