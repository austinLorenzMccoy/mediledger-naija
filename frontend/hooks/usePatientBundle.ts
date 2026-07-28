'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { patientApi, type PatientBundle } from '@/lib/api/patients';
import { claimsApi } from '@/lib/api/claims';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import toast from 'react-hot-toast';

type Claim = Database['public']['Tables']['insurance_claims']['Row'];

export type FullPatientBundle = PatientBundle & {
  claims: Claim[];
};

const empty: FullPatientBundle = {
  patient: null,
  records: [],
  consents: [],
  tokenTxs: [],
  claims: [],
};

export function usePatientBundle() {
  const { user, isLoading: authLoading } = useAuth();
  const [bundle, setBundle] = useState<FullPatientBundle>(empty);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setBundle({ ...empty, error: 'Sign in to load your live data' });
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await patientApi.loadBundle();
    let claims: Claim[] = [];
    if (data.patient?.id) {
      const { data: claimRows } = await claimsApi.listForPatient(data.patient.id);
      claims = claimRows ?? [];
    }
    setBundle({ ...data, claims });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  // Realtime: keep bundle in sync with Supabase
  useEffect(() => {
    const patientId = bundle.patient?.id;
    if (!user || !patientId) return;

    const channels = [
      supabase
        .channel(`rt-patient-${patientId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'patients', filter: `id=eq.${patientId}` },
          () => {
            void refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`rt-records-${patientId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'health_records', filter: `patient_id=eq.${patientId}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              toast.success('New health record added to your vault');
            }
            void refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`rt-consents-${patientId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'consent_agreements', filter: `patient_id=eq.${patientId}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              toast('Consent update', { icon: '📋' });
            }
            void refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`rt-tokens-${patientId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'token_transactions', filter: `to_patient_id=eq.${patientId}` },
          (payload) => {
            const amount = (payload.new as { amount_heal?: number }).amount_heal;
            if (amount != null) toast.success(`Earned ${amount} HEAL`);
            void refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`rt-claims-${patientId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'insurance_claims', filter: `patient_id=eq.${patientId}` },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const status = (payload.new as { status?: string }).status;
              if (status === 'approved') toast.success('Claim approved');
              if (status === 'rejected') toast.error('Claim rejected');
              if (status === 'paid') toast.success('Claim paid');
            }
            void refresh();
          },
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((ch) => {
        void supabase.removeChannel(ch);
      });
    };
  }, [user, bundle.patient?.id, refresh]);

  return { ...bundle, loading: authLoading || loading, refresh, user };
}
