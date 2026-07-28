import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Patient = Database['public']['Tables']['patients']['Row'];
type HealthRecord = Database['public']['Tables']['health_records']['Row'];
type Consent = Database['public']['Tables']['consent_agreements']['Row'];
type TokenTx = Database['public']['Tables']['token_transactions']['Row'];

export type PatientBundle = {
  patient: Patient | null;
  records: HealthRecord[];
  consents: Consent[];
  tokenTxs: TokenTx[];
  error?: string;
};

export const patientApi = {
  /** Own profile — RLS: patient can only see their row. */
  getProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } as const };

    return supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
  },

  updateProfile: async (
    updates: Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } as const };

    return supabase
      .from('patients')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
  },

  getRecords: async (patientId: string, page = 0, limit = 50) =>
    supabase
      .from('health_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1),

  getRecord: (id: string) =>
    supabase.from('health_records').select('*').eq('id', id).single(),

  getConsents: async (patientId: string) =>
    supabase
      .from('consent_agreements')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),

  getTokenTransactions: async (patientId: string, limit = 20) =>
    supabase
      .from('token_transactions')
      .select('*')
      .or(`to_patient_id.eq.${patientId},from_patient_id.eq.${patientId}`)
      .order('created_at', { ascending: false })
      .limit(limit),

  /** Load everything the dashboard needs in one call. */
  loadBundle: async (): Promise<PatientBundle> => {
    const { data: patient, error: pErr } = await patientApi.getProfile();
    if (pErr || !patient) {
      return {
        patient: null,
        records: [],
        consents: [],
        tokenTxs: [],
        error: pErr?.message ?? 'No patient profile linked to this account',
      };
    }

    const [recordsRes, consentsRes, txsRes] = await Promise.all([
      patientApi.getRecords(patient.id),
      patientApi.getConsents(patient.id),
      patientApi.getTokenTransactions(patient.id),
    ]);

    return {
      patient,
      records: recordsRes.data ?? [],
      consents: consentsRes.data ?? [],
      tokenTxs: txsRes.data ?? [],
      error: recordsRes.error?.message,
    };
  },
};

/** Relative time helper for UI */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function vaultSealStatus(patient: Patient | null): {
  sealed: boolean;
  label: string;
  color: string;
  proofPreview: string;
  commitmentPreview: string;
} {
  if (!patient) {
    return {
      sealed: false,
      label: 'No profile',
      color: '#9DB8A5',
      proofPreview: '—',
      commitmentPreview: '—',
    };
  }
  const pending =
    !patient.zk_proof_hash ||
    patient.zk_proof_hash === 'pending' ||
    !patient.vault_public_key ||
    patient.vault_public_key === 'pending';

  if (pending) {
    return {
      sealed: false,
      label: 'Unsealed',
      color: '#C9572A',
      proofPreview: patient.zk_proof_hash || 'pending',
      commitmentPreview: patient.vault_public_key || 'pending',
    };
  }

  return {
    sealed: true,
    label: 'ZK Sealed',
    color: '#4EC99A',
    proofPreview: patient.zk_proof_hash.slice(0, 16) + '…',
    commitmentPreview: patient.vault_public_key.slice(0, 20) + '…',
  };
}

const RECORD_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  lab: { label: 'Laboratory Results', icon: 'chart', color: '#4EC99A' },
  imaging: { label: 'Imaging & Scans', icon: 'ai', color: '#D4A843' },
  prescription: { label: 'Prescriptions', icon: 'lock', color: '#C9572A' },
  consultation: { label: 'Consultations', icon: 'shield', color: '#F0C96B' },
  vaccination: { label: 'Vaccinations', icon: 'consent', color: '#4EC99A' },
  surgical: { label: 'Surgical', icon: 'emergency', color: '#E8754A' },
};

export function groupRecordsByType(records: HealthRecord[]) {
  const groups = new Map<
    string,
    { type: string; label: string; icon: string; color: string; count: number; latest: string }
  >();

  for (const r of records) {
    const meta = RECORD_META[r.record_type] ?? {
      label: r.record_type,
      icon: 'lock',
      color: '#9DB8A5',
    };
    const existing = groups.get(r.record_type);
    if (!existing) {
      groups.set(r.record_type, {
        type: r.record_type,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        count: 1,
        latest: r.created_at,
      });
    } else {
      existing.count += 1;
      if (r.created_at > existing.latest) existing.latest = r.created_at;
    }
  }

  return Array.from(groups.values());
}
