import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type RecordInsert = Database['public']['Tables']['health_records']['Insert'];

export const recordsApi = {
  // List health records for the authed patient (or provider with consent — RLS handles it)
  list: (patientId?: string, page = 0, limit = 20) => {
    let query = supabase
      .from('health_records')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (patientId) query = query.eq('patient_id', patientId);
    return query;
  },

  // Upload a medical record blob to Supabase Storage, then insert the metadata row
  upload: async (
    /** Storage folder prefix — prefer NHIA id for bucket RLS path policies. */
    folderKey: string,
    file: File,
    metadata: Omit<RecordInsert, 'storage_path' | 'record_hash'>,
  ) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${folderKey}/${Date.now()}-${safeName}`;

    // 1. Upload blob to medical-records bucket
    const { error: uploadError } = await supabase.storage
      .from('medical-records')
      .upload(path, file, { upsert: false });

    if (uploadError) throw uploadError;

    // 2. Compute SHA-256 hash of the file (client-side, for integrity / ZK seal)
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const recordHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. Insert metadata row
    return supabase
      .from('health_records')
      .insert({ ...metadata, storage_path: path, record_hash: recordHash })
      .select()
      .single();
  },

  // Get a signed URL for a medical record blob (valid 60 seconds)
  getSignedUrl: (storagePath: string) =>
    supabase.storage
      .from('medical-records')
      .createSignedUrl(storagePath, 60),
};
