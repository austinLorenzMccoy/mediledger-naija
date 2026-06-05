import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { HealService } from './heal.service';

class ConsentPaymentDto {
  consentId: string;
  toPatientNhiaId: string;
  amountHeal: number;
}

class ConfirmHcsDto {
  tx_id: string;
  consent_id: string;
}

@Controller('tokens')
export class HealController {
  constructor(private readonly healService: HealService) {}

  private checkInternalKey(key: string | undefined) {
    if (key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
  }

  // Process monthly consent payment (called by Supabase Edge Function or scheduler)
  @Post('consent-payment')
  async processConsentPayment(
    @Body() dto: ConsentPaymentDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.healService.processConsentPayment(dto);
  }

  // Confirm HCS audit log — called by Edge Function task-completion-notification
  @Post('confirm-hcs')
  async confirmHcs(
    @Body() dto: ConfirmHcsDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.healService.confirmHcsAuditLog(dto.tx_id, dto.consent_id);
  }
}
