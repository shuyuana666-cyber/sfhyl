import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional() @IsIn(['7', '30', '90', 'custom']) range: '7' | '30' | '90' | 'custom' = '30';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
