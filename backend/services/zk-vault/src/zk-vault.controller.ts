import {
  Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ZkVaultService } from './zk-vault.service';
import { InternalKeyGuard } from '../../../shared/middleware/internal-key.guard';
import { SealVaultDto } from './dto/seal-vault.dto';
import { VerifyProofDto } from './dto/verify-proof.dto';
import { ConditionProofDto } from './dto/condition-proof.dto';

@Controller('zk')
@UseGuards(InternalKeyGuard)
export class ZkVaultController {
  constructor(private readonly zk: ZkVaultService) {}

  // POST /zk/seal-vault
  // Called by: patient-service on every health record upload
  // Fills: patients.zk_proof_hash + patients.vault_public_key
  @Post('seal-vault')
  sealVault(@Body() dto: SealVaultDto) {
    return this.zk.sealVault(dto);
  }

  // GET /zk/proof/:nhiaId
  // Called by: AI inference engine — implements get_vault_proof() stub
  @Get('proof/:nhiaId')
  getProof(@Param('nhiaId') nhiaId: string) {
    return this.zk.getVaultProof(nhiaId);
  }

  // POST /zk/verify
  // Called by: AI inference engine — implements verify_zk_proof() stub
  @Post('verify')
  async verify(@Body() dto: VerifyProofDto) {
    const valid = await this.zk.verifyVaultProof(dto.proof, dto.publicSignals);
    return { valid };
  }

  // POST /zk/prove-condition
  // Called by: emergency-service (pre-generate blood type, allergy proofs)
  //            providers (on-demand condition checks)
  @Post('prove-condition')
  proveCondition(@Body() dto: ConditionProofDto) {
    return this.zk.proveCondition(dto);
  }

  // GET /zk/condition-proof/:nhiaId/:conditionCode
  // Called by: emergency-service — retrieves pre-generated condition proof from Redis
  @Get('condition-proof/:nhiaId/:conditionCode')
  getConditionProof(
    @Param('nhiaId') nhiaId: string,
    @Param('conditionCode', ParseIntPipe) conditionCode: number,
  ) {
    return this.zk.getConditionProof(nhiaId, conditionCode);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'zk-vault-service' };
  }
}
