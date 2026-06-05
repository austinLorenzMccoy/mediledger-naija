import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import {
  AccountCreateTransaction,
  TokenAssociateTransaction,
  PrivateKey,
  AccountId,
  TokenId,
  Hbar,
  Client,
} from '@hashgraph/sdk';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface CustodialWallet {
  accountId: string;
  publicKey: string;
}

@Injectable()
export class CustodialWalletService {
  private readonly logger = new Logger(CustodialWalletService.name);
  private hederaClient: Client;

  constructor() {
    this.hederaClient = process.env.HEDERA_NETWORK === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    this.hederaClient.setOperator(
      AccountId.fromString(process.env.HEDERA_OPERATOR_ID!),
      PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!),
    );
  }

  async createCustodialWallet(patientId: string, phoneNumber: string): Promise<CustodialWallet> {
    // Prevent duplicate wallets
    const { data: existing } = await supabase
      .from('patient_custodial_wallets')
      .select('hedera_account_id')
      .eq('patient_id', patientId)
      .single();

    if (existing) {
      throw new ConflictException('Custodial wallet already exists for this patient');
    }

    // 1. Generate new ED25519 key pair
    const privateKey = PrivateKey.generateED25519();
    const publicKey = privateKey.publicKey;

    // 2. Create Hedera account — NHIA Treasury funds 0.5 HBAR for fees
    const createTx = await new AccountCreateTransaction()
      .setKey(publicKey)
      .setInitialBalance(new Hbar(0.5))
      .setMaxTransactionFee(new Hbar(5))
      .execute(this.hederaClient);

    const receipt = await createTx.getReceipt(this.hederaClient);
    const accountId = receipt.accountId!.toString();

    this.logger.log(`Created custodial Hedera account ${accountId} for patient ${patientId}`);

    // 3. Associate HEAL token with new account
    const associateTx = await new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(process.env.HEAL_TOKEN_ID!)])
      .freezeWith(this.hederaClient);

    const signedAssociate = await associateTx.sign(privateKey);
    await signedAssociate.execute(this.hederaClient);

    // 4. Encrypt private key — in production, use AWS CloudHSM
    // For now: encrypt with INTERNAL_API_KEY as placeholder (replace with HSM call)
    const hsmKeyHandle = await this.storeKeyInHSM(privateKey.toStringDer(), accountId);

    // 5. Persist wallet record in Supabase
    await supabase.from('patient_custodial_wallets').insert({
      patient_id: patientId,
      hedera_account_id: accountId,
      hsm_key_handle: hsmKeyHandle,
      key_type: 'ED25519',
      custody_type: 'nhia_custodial',
      is_token_associated: true,
    });

    // 6. Update patients table with hedera_account_id
    await supabase
      .from('patients')
      .update({ hedera_account_id: accountId, vault_public_key: publicKey.toString() })
      .eq('id', patientId);

    return { accountId, publicKey: publicKey.toString() };
  }

  async requestSelfCustodyMigration(patientId: string): Promise<{ requestedAt: string }> {
    const requestedAt = new Date().toISOString();
    await supabase
      .from('patient_custodial_wallets')
      .update({
        custody_type: 'migrating',
        export_requested_at: requestedAt,
      })
      .eq('patient_id', patientId);

    this.logger.log(`Self-custody migration requested for patient ${patientId}`);
    return { requestedAt };
  }

  async completeSelfCustodyMigration(patientId: string): Promise<{ ok: boolean }> {
    // Called after patient confirms key import into HashPack/Blade
    await supabase
      .from('patient_custodial_wallets')
      .update({
        custody_type: 'self_custody',
        export_completed_at: new Date().toISOString(),
      })
      .eq('patient_id', patientId);

    this.logger.log(`Self-custody migration completed for patient ${patientId}`);
    return { ok: true };
  }

  private async storeKeyInHSM(privateKeyDer: string, accountId: string): Promise<string> {
    // Production: call AWS CloudHSM PKCS#11 API
    // The HSM stores the key and returns a handle — the raw key never leaves the HSM
    // Placeholder: return a deterministic reference string
    // Replace with: await hsmClient.generateAndStore(privateKeyDer)
    const handle = `hsm-${accountId}-${Date.now()}`;
    this.logger.warn(`HSM stub used for ${accountId} — replace with CloudHSM in production`);
    return handle;
  }
}
