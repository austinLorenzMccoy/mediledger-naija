import { Module, Global } from '@nestjs/common';
import { HederaService } from './hedera.service';

@Global()
@Module({
  providers: [HederaService],
  exports: [HederaService],
})
export class HederaModule {}
