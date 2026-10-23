import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Combined application health' })
  health(): Promise<Record<string, unknown>> {
    return this.healthService.ready();
  }

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  live(): Record<string, unknown> {
    return { status: 'ok', process: 'up', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Required dependency readiness' })
  ready(): Promise<Record<string, unknown>> {
    return this.healthService.ready();
  }
}
