import { Module } from '@nestjs/common';
import { UssdAuthController } from './ussd-auth.controller';
import { UssdAuthService } from './ussd-auth.service';

@Module({
  controllers: [UssdAuthController],
  providers: [UssdAuthService],
})
export class UssdAuthModule {}
