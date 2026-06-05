import { supabase } from '@/lib/supabase';

export const tokenApi = {
  // Get HEAL balance for a patient (cached in patients.heal_balance)
  getBalance: (patientId: string) =>
    supabase
      .from('patients')
      .select('heal_balance')
      .eq('id', patientId)
      .single(),

  // Get transaction history for a patient (RLS enforces participant access)
  getTransactions: (patientId: string, limit = 50) =>
    supabase
      .from('token_transactions')
      .select('*')
      .or(`from_patient_id.eq.${patientId},to_patient_id.eq.${patientId}`)
      .order('created_at', { ascending: false })
      .limit(limit),
};
