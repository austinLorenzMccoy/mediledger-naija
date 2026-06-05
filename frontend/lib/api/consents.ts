import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type ConsentInsert = Database['public']['Tables']['consent_agreements']['Insert'];

export const consentApi = {
  // List patient's own consents (or requester's consents — RLS filters appropriately)
  list: () =>
    supabase
      .from('consent_agreements')
      .select('*')
      .order('created_at', { ascending: false }),

  // Get single consent
  get: (id: string) =>
    supabase.from('consent_agreements').select('*').eq('id', id).single(),

  // Create new consent request (called by providers/HMOs/researchers)
  create: (data: ConsentInsert) =>
    supabase.from('consent_agreements').insert(data).select().single(),

  // Revoke consent (patient action)
  revoke: (id: string) =>
    supabase
      .from('consent_agreements')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),

  // Grant pending consent (patient action)
  grant: (id: string) =>
    supabase
      .from('consent_agreements')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single(),
};
