import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { HederaService } from '../hedera/hedera.service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// NGN to tinybars conversion rate (approximate, should be fetched from oracle in prod)
const NGN_TO_HBAR_RATE = 0.00028; // 1 NGN ≈ 0.00028 HBAR
const TINYBAR_PER_HBAR = 100_000_000;

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(private readonly hederaService: HederaService) {}

  async submitClaimToHedera(dto: {
    claimId: string;
    patientHederaAccountId: string;
    providerHederaAccountId: string;
    totalAmountNgn: number;
  }): Promise<{ txId: string }> {
    const tinybars = Math.floor(dto.totalAmountNgn * NGN_TO_HBAR_RATE * TINYBAR_PER_HBAR);

    const txId = await this.hederaService.submitClaimToContract(
      dto.claimId,
      dto.patientHederaAccountId,
      dto.providerHederaAccountId,
      tinybars,
    );

    // Persist TX ID back to Supabase
    await supabase
      .from('insurance_claims')
      .update({ smart_contract_tx_id: txId })
      .eq('id', dto.claimId);

    this.logger.log(`Claim ${dto.claimId} submitted to Hedera: ${txId}`);
    return { txId };
  }

  async approveClaimOnHedera(
    claimId: string,
    approvedAmountNgn: number,
  ): Promise<{ txId: string }> {
    const tinybars = Math.floor(approvedAmountNgn * NGN_TO_HBAR_RATE * TINYBAR_PER_HBAR);

    const txId = await this.hederaService.approveClaimOnChain(claimId, tinybars);

    this.logger.log(`Claim ${claimId} approved on Hedera: ${txId}`);
    return { txId };
  }

  async getClaimsForPhone(phone: string): Promise<{ claims: unknown[] }> {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('phone_number', phone)
      .single();

    if (!patient) return { claims: [] };

    const { data: claims } = await supabase
      .from('insurance_claims')
      .select('id, total_amount_ngn, approved_amount_ngn, status, service_date, icd10_codes')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(3);

    return { claims: claims ?? [] };
  }
}
