import { Injectable, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

@Injectable()
export class UssdAuthService {
  async getHealBalance(phone: string): Promise<{ balance: number }> {
    const { data, error } = await supabase
      .from('patients')
      .select('heal_balance')
      .eq('phone_number', phone)
      .single();

    if (error || !data) throw new NotFoundException('Patient not found');
    return { balance: data.heal_balance };
  }

  async getActiveConsents(phone: string): Promise<{ consents: unknown[] }> {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('phone_number', phone)
      .single();

    if (!patient) return { consents: [] };

    const { data: consents } = await supabase
      .from('consent_agreements')
      .select('id, requester_type, purpose, valid_until, monthly_payment_heal')
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    return { consents: consents ?? [] };
  }
}
