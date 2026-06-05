import { Controller, Post, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ClaimsService } from './claims.service';

class SubmitToChainDto {
  claimId: string;
  patientHederaAccountId: string;
  providerHederaAccountId: string;
  totalAmountNgn: number;
}

class ApproveOnChainDto {
  claimId: string;
  approvedAmountNgn: number;
}

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  private checkInternalKey(key: string | undefined) {
    if (key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
  }

  // Called after all 3 signatures are collected (Supabase trigger fires first, then this)
  @Post('submit-chain')
  async submitToChain(
    @Body() dto: SubmitToChainDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.claimsService.submitClaimToHedera(dto);
  }

  // HMO finalizes approval on-chain after Supabase multisig auto-approve
  @Post(':id/approve-chain')
  async approveOnChain(
    @Param('id') id: string,
    @Body() dto: ApproveOnChainDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.claimsService.approveClaimOnHedera(id, dto.approvedAmountNgn);
  }

  // USSD: latest claims for a phone number
  @Post('ussd/claims')
  async ussdClaims(
    @Body() body: { phone: string },
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.claimsService.getClaimsForPhone(body.phone);
  }
}
