import { IsObject } from 'class-validator';

export class UpdateSettingsGroupDto {
  @IsObject()
  settings!: Record<string, unknown>;
}
