import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { UssdAuthService } from './ussd-auth.service';

class UssdPhoneDto {
  phone: string;
}

@Controller('ussd')
export class UssdAuthController {
  constructor(private readonly ussdAuthService: UssdAuthService) {}

  private checkInternalKey(key: string | undefined) {
    if (key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
  }

  @Post('balance')
  async getBalance(
    @Body() dto: UssdPhoneDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.ussdAuthService.getHealBalance(dto.phone);
  }

  @Post('consents')
  async getConsents(
    @Body() dto: UssdPhoneDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.ussdAuthService.getActiveConsents(dto.phone);
  }
}
