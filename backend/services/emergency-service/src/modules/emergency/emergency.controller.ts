import { Controller, Get, Post, Param, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

class WarmCacheDto {
  nhia_id: string;
}

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // Sub-300ms emergency data lookup — served from Redis hot cache
  // Called by any authenticated provider/ER system with valid Hedera signature
  @Get(':nhiaId')
  async getEmergencyData(
    @Param('nhiaId') nhiaId: string,
    @Headers('x-provider-id') providerId: string,
    @Headers('x-hospital-name') hospitalName: string,
    @Headers('authorization') auth: string,
  ) {
    return this.emergencyService.getEmergencyData(nhiaId, providerId, hospitalName);
  }

  // Internal: warm cache for a patient (called on patient profile update)
  @Post('warm-cache')
  async warmCache(
    @Body() dto: WarmCacheDto,
    @Headers('x-internal-key') key: string,
  ) {
    if (key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
    return this.emergencyService.warmPatientCache(dto.nhia_id);
  }
}
