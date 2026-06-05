import { Controller, Post, Body, Get } from '@nestjs/common';
import { WalletService } from './wallet.service';

class WalletChallengeDto {
  accountId: string;
}

class WalletVerifyDto {
  accountId: string;
  challenge: string;
  signature: string;
}

@Controller('auth')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Returns a random challenge nonce for the wallet to sign
  @Get('wallet-challenge')
  getChallenge(): { challenge: string } {
    return { challenge: this.walletService.generateChallenge() };
  }

  // Verifies the signed challenge against Hedera; returns Supabase-compatible JWT
  @Post('wallet-verify')
  async verifyWallet(@Body() dto: WalletVerifyDto): Promise<{ token: string }> {
    return this.walletService.verifyAndIssueToken(dto.accountId, dto.challenge, dto.signature);
  }
}
