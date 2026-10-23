import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import type { SystemLogEntry } from "../common/logging/json-logger.service";
import { SystemService } from "./system.service";

class SystemLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit = 100;
  @IsOptional()
  @IsIn(["debug", "log", "warn", "error", "fatal"])
  level?: SystemLogEntry["level"];
}

@ApiTags("admin/system")
@ApiBearerAuth()
@Controller("admin/system")
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get("storage")
  @RequirePermissions("storage-settings:view")
  storage(): Record<string, unknown> {
    return this.system.storage();
  }

  @Get("mail")
  @RequirePermissions("mail-settings:view")
  mail(): Record<string, unknown> {
    return this.system.mail();
  }

  @Get("logs")
  @RequirePermissions("system-log:view")
  logs(@Query() query: SystemLogQueryDto): SystemLogEntry[] {
    return this.system.logs(query.limit, query.level);
  }

  @Get("info")
  @RequirePermissions("system-info:view")
  info(): Record<string, unknown> {
    return this.system.info();
  }
}
