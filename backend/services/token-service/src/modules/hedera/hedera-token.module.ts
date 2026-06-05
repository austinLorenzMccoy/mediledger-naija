import { Module, Global } from '@nestjs/common';
import { HederaTokenService } from './hedera-token.service';

@Global()
@Module({
  providers: [HederaTokenService],
  exports: [HederaTokenService],
})
export class HederaTokenModule {}
