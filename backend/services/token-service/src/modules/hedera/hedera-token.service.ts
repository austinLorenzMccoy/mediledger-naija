import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  Client,
  AccountId,
  PrivateKey,
  TokenId,
  TransferTransaction,
  Hbar,
} from '@hashgraph/sdk';

// HEAL token has 4 decimal places (matches Supabase NUMERIC(15,4))
const HEAL_DECIMALS = 10_000;

@Injectable()
export class HederaTokenService implements OnModuleInit {
  private readonly logger = new Logger(HederaTokenService.name);
  private client: Client;
  private healTokenId: TokenId;
  private treasuryAccountId: AccountId;

  onModuleInit() {
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

    this.client = process.env.HEDERA_NETWORK === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    this.client.setOperator(operatorId, operatorKey);
    this.healTokenId = TokenId.fromString(process.env.HEAL_TOKEN_ID!);
    this.treasuryAccountId = AccountId.fromString(process.env.HEAL_TREASURY_ACCOUNT_ID!);
    this.logger.log(`HederaTokenService initialized — HEAL token: ${this.healTokenId}`);
  }

  // Transfer HEAL tokens from treasury to patient (consent payment, onboarding bonus)
  async transferHealFromTreasury(
    toHederaAccountId: string,
    amountHeal: number,
  ): Promise<string> {
    const units = Math.floor(amountHeal * HEAL_DECIMALS);

    const tx = await new TransferTransaction()
      .addTokenTransfer(this.healTokenId, this.treasuryAccountId, -units)
      .addTokenTransfer(this.healTokenId, AccountId.fromString(toHederaAccountId), units)
      .setMaxTransactionFee(new Hbar(1))
      .execute(this.client);

    const receipt = await tx.getReceipt(this.client);
    this.logger.log(`HEAL transfer ${amountHeal} → ${toHederaAccountId} | TX: ${tx.transactionId} | status: ${receipt.status}`);
    return tx.transactionId.toString();
  }

  // Transfer HEAL from patient to treasury (withdrawal)
  async transferHealToTreasury(
    fromHederaAccountId: string,
    fromPrivateKey: string,
    amountHeal: number,
  ): Promise<string> {
    const units = Math.floor(amountHeal * HEAL_DECIMALS);
    const signerKey = PrivateKey.fromString(fromPrivateKey);

    const tx = await new TransferTransaction()
      .addTokenTransfer(this.healTokenId, AccountId.fromString(fromHederaAccountId), -units)
      .addTokenTransfer(this.healTokenId, this.treasuryAccountId, units)
      .setMaxTransactionFee(new Hbar(1))
      .freezeWith(this.client);

    const signedTx = await tx.sign(signerKey);
    const response = await signedTx.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    this.logger.log(`HEAL withdrawal ${amountHeal} from ${fromHederaAccountId} | TX: ${response.transactionId}`);
    return response.transactionId.toString();
  }
}
