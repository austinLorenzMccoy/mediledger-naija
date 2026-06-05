import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletModule } from './modules/wallet/wallet.module';
import { UssdAuthModule } from './modules/ussd/ussd-auth.module';
import { CustodialWalletModule } from './modules/custodial/custodial-wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WalletModule,
    UssdAuthModule,
    CustodialWalletModule,
  ],
})
export class AppModule {}
