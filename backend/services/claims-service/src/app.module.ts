import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaimsModule } from './modules/claims/claims.module';
import { HederaModule } from './modules/hedera/hedera.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HederaModule,
    ClaimsModule,
  ],
})
export class AppModule {}
