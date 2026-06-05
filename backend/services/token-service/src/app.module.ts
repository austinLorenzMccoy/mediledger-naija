import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealModule } from './modules/heal/heal.module';
import { HederaTokenModule } from './modules/hedera/hedera-token.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HederaTokenModule,
    HealModule,
  ],
})
export class AppModule {}
