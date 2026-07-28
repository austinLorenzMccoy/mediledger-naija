import {
  Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ZkVaultService } from './zk-vault.service';
import { InternalKeyGuard } from './internal-key.guard';
import { SealVaultDto } from './dto/seal-vault.dto';
import { VerifyProofDto } from './dto/verify-proof.dto';
import { ConditionProofDto } from './dto/condition-proof.dto';
import { ConsentScopeDto } from './dto/consent-scope.dto';

@Controller('zk')
export class ZkVaultController {
  constructor(private readonly zk: ZkVaultService) {}

  /** Liveness — no auth (Docker healthcheck). */
  @Get('health')
  health() {
    return this.zk.health();
  }

  @UseGuards(InternalKeyGuard)
  @Post('seal-vault')
  sealVault(@Body() dto: SealVaultDto) {
    return this.zk.sealVault(dto);
  }

  @UseGuards(InternalKeyGuard)
  @Get('proof/:nhiaId')
  getProof(@Param('nhiaId') nhiaId: string) {
    return this.zk.getVaultProof(nhiaId);
  }

  @UseGuards(InternalKeyGuard)
  @Post('verify')
  async verify(@Body() dto: VerifyProofDto) {
    const valid = await this.zk.verifyVaultProof(dto.proof, dto.publicSignals);
    return { valid };
  }

  @UseGuards(InternalKeyGuard)
  @Post('prove-condition')
  proveCondition(@Body() dto: ConditionProofDto) {
    return this.zk.proveCondition(dto);
  }

  @UseGuards(InternalKeyGuard)
  @Get('condition-proof/:nhiaId/:conditionCode')
  getConditionProof(
    @Param('nhiaId') nhiaId: string,
    @Param('conditionCode', ParseIntPipe) conditionCode: number,
  ) {
    return this.zk.getConditionProof(nhiaId, conditionCode);
  }

  @UseGuards(InternalKeyGuard)
  @Post('prove-consent-scope')
  proveConsentScope(@Body() dto: ConsentScopeDto) {
    return this.zk.proveConsentScope(dto);
  }
}
