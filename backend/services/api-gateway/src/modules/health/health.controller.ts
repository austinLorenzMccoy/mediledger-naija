import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PUBLIC_KEY } from '../../middleware/supabase-auth.guard';
import { SetMetadata } from '@nestjs/common';

export const Public = () => SetMetadata(PUBLIC_KEY, true);

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
