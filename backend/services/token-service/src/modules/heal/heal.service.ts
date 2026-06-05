import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { HederaTokenService } from '../hedera/hedera-token.service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

@Injectable()
export class HealService {
  private readonly logger = new Logger(HealService.name);

  constructor(private readonly hederaTokenService: HederaTokenService) {}

  async processConsentPayment(dto: {
    consentId: string;
    toPatientNhiaId: string;
    amountHeal: number;
  }): Promise<{ txId: string }> {
    // 1. Fetch patient's Hedera account ID
    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, hedera_account_id')
      .eq('nhia_id', dto.toPatientNhiaId)
      .single();

    if (error || !patient?.hedera_account_id) {
      throw new NotFoundException(`Patient ${dto.toPatientNhiaId} has no Hedera account`);
    }

    // 2. Transfer HEAL from treasury to patient on Hedera HTS
    const hederaTxId = await this.hederaTokenService.transferHealFromTreasury(
      patient.hedera_account_id,
      dto.amountHeal,
    );

    // 3. Record transaction in Supabase (Supabase trigger will update heal_balance cache)
    const { error: txError } = await supabase.from('token_transactions').insert({
      to_patient_id: patient.id,
      consent_id: dto.consentId,
      amount_heal: dto.amountHeal,
      tx_type: 'consent_payment',
      hedera_tx_id: hederaTxId,
      status: 'confirmed',
    });

    if (txError) {
      this.logger.error(`Failed to record token_transaction for ${hederaTxId}:`, txError);
    }

    // 4. Trigger Edge Function for patient SMS notification (non-blocking)
    fetch(`${process.env.SUPABASE_URL}/functions/v1/task-completion-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'x-internal-key': process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        tx_id: hederaTxId,
        to_patient_nhia_id: dto.toPatientNhiaId,
        amount_heal: dto.amountHeal,
        consent_id: dto.consentId,
      }),
    }).catch(() => {}); // Non-blocking

    return { txId: hederaTxId };
  }

  async confirmHcsAuditLog(txId: string, consentId: string): Promise<{ ok: boolean }> {
    // Write HCS message ID back to consent record for immutable audit trail
    const { error } = await supabase
      .from('consent_agreements')
      .update({ hcs_message_id: txId })
      .eq('id', consentId);

    if (error) this.logger.error(`Failed to update HCS message ID for consent ${consentId}`);
    return { ok: !error };
  }
}
