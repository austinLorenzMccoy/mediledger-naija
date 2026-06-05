import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Patient = Database['public']['Tables']['patients']['Row'];

export const patientApi = {
  // GET own profile — RLS enforces patient can only see their own row
  getProfile: () =>
    supabase.from('patients').select('*').single(),

  // UPDATE own profile
  updateProfile: (updates: Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) =>
    supabase.from('patients').update(updates).eq('user_id', supabase.auth.getUser()).select().single(),

  // GET own health records with pagination
  getRecords: (page = 0, limit = 20) =>
    supabase
      .from('health_records')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1),

  // GET single health record by ID
  getRecord: (id: string) =>
    supabase.from('health_records').select('*').eq('id', id).single(),
};
