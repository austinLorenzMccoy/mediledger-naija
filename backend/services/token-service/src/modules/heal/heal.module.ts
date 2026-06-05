import { Module } from '@nestjs/common';
import { HealController } from './heal.controller';
import { HealService } from './heal.service';

@Module({
  controllers: [HealController],
  providers: [HealService],
})
export class HealModule {}
