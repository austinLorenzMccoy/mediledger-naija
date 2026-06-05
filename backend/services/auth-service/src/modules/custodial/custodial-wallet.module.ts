import { Module } from '@nestjs/common';
import { CustodialWalletService } from './custodial-wallet.service';
import { CustodialWalletController } from './custodial-wallet.controller';

@Module({
  controllers: [CustodialWalletController],
  providers: [CustodialWalletService],
  exports: [CustodialWalletService],
})
export class CustodialWalletModule {}
