import { Module } from '@nestjs/common';
import { ZkVaultController } from './zk-vault.controller';
import { ZkVaultService } from './zk-vault.service';
import { ProofCacheService } from './proof-cache.service';

@Module({
  controllers: [ZkVaultController],
  providers: [ZkVaultService, ProofCacheService],
})
export class ZkVaultModule {}
