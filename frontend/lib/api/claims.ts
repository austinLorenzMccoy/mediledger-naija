import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ClaimInsert = Database['public']['Tables']['insurance_claims']['Insert'];

export const claimsApi = {
  // List claims — RLS returns only what the caller is allowed to see
  list: (filters?: { status?: string }) =>
    supabase
      .from('insurance_claims')
      .select('*')
      .match(filters ?? {})
      .order('created_at', { ascending: false }),

  // Get single claim
  get: (id: string) =>
    supabase.from('insurance_claims').select('*').eq('id', id).single(),

  // Submit a new claim (provider action — starts as 'draft', then transitions to 'submitted')
  submit: (data: Omit<ClaimInsert, 'status'>) =>
    supabase
      .from('insurance_claims')
      .insert({ ...data, status: 'submitted' })
      .select()
      .single(),

  // Sign a claim (patient, provider, or HMO)
  sign: (id: string, role: 'patient' | 'provider' | 'hmo', sigHash: string) => {
    const field = `${role}_sig_hash` as const;
    return supabase
      .from('insurance_claims')
      .update({ [field]: sigHash })
      .eq('id', id)
      .select()
      .single();
  },

  // HMO: reject a claim with reason
  reject: (id: string, rejectionReason: string) =>
    supabase
      .from('insurance_claims')
      .update({ status: 'rejected', rejection_reason: rejectionReason })
      .eq('id', id)
      .select()
      .single(),
};
