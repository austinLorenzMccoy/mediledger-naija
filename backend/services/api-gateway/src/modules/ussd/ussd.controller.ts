import { Controller, Post, Body, SetMetadata } from '@nestjs/common';
import { UssdService } from './ussd.service';
import { PUBLIC_KEY } from '../../middleware/supabase-auth.guard';

// USSD is unauthenticated at gateway; auth-service validates session via MSISDN
export const Public = () => SetMetadata(PUBLIC_KEY, true);

interface UssdPayload {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

@Controller('ussd')
export class UssdController {
  constructor(private readonly ussdService: UssdService) {}

  @Post()
  @Public()
  async handleUssd(@Body() payload: UssdPayload): Promise<string> {
    return this.ussdService.processSession(payload);
  }
}
