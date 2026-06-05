'use client';

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// ── Patient Dashboard Realtime Subscriptions ─────────────────────────
export function usePatientRealtimeSubscriptions(patientId: string) {
  const queryClient = useQueryClient();

  const setupSubscriptions = useCallback(() => {
    // Channel 1: Insurance claim status changes
    const claimsChannel = supabase
      .channel(`patient-claims-${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance_claims', filter: `patient_id=eq.${patientId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['claims', patientId] });

          if (payload.eventType === 'UPDATE') {
            const status = (payload.new as Record<string, unknown>).status as string;
            const amount = (payload.new as Record<string, unknown>).approved_amount_ngn as number;
            const reason = (payload.new as Record<string, unknown>).rejection_reason as string;

            if (status === 'approved')
              toast.success(`Claim approved — ₦${amount?.toLocaleString('en-NG')}`);
            else if (status === 'rejected')
              toast.error(`Claim rejected: ${reason ?? 'Contact your HMO'}`);
            else if (status === 'paid')
              toast.success('Claim payment processed!');
          }
        },
      )
      .subscribe();

    // Channel 2: New consent requests
    const consentChannel = supabase
      .channel(`patient-consents-${patientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consent_agreements', filter: `patient_id=eq.${patientId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['consents', patientId] });
          const status = (payload.new as Record<string, unknown>).status as string;
          if (status === 'pending')
            toast('New consent request received', { icon: '📋' });
        },
      )
      .subscribe();

    // Channel 3: HEAL token earnings
    const tokenChannel = supabase
      .channel(`patient-tokens-${patientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'token_transactions', filter: `to_patient_id=eq.${patientId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['tokens', 'balance', patientId] });
          const amount = (payload.new as Record<string, unknown>).amount_heal as number;
          toast.success(`Earned ${amount} HEAL tokens!`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(consentChannel);
      supabase.removeChannel(tokenChannel);
    };
  }, [patientId, queryClient]);

  useEffect(() => {
    const cleanup = setupSubscriptions();
    return cleanup;
  }, [setupSubscriptions]);
}

// ── HMO Claims View Realtime Subscriptions ───────────────────────────
export function useHMORealtimeSubscriptions(hmoUserId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`hmo-claims-${hmoUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance_claims', filter: `hmo_user_id=eq.${hmoUserId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hmo', 'claims', hmoUserId] });
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [hmoUserId, queryClient]);
}

// ── NHIA Regulator Dashboard: All-claims monitoring ──────────────────
export function useNHIARealtimeMonitoring() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('nhia-claims-monitor')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'insurance_claims' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['nhia', 'analytics'] });
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;
          if (newRecord.sla_breached && !oldRecord.sla_breached) {
            const id = (newRecord.id as string).slice(0, 8);
            toast.error(`SLA breach: Claim ${id}...`);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [queryClient]);
}

// ── Provider Dashboard: Consent status changes ───────────────────────
export function useProviderConsentSubscriptions(providerUserId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`provider-consents-${providerUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consent_agreements',
          filter: `requester_user_id=eq.${providerUserId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['consents', 'provider', providerUserId] });
          const status = (payload.new as Record<string, unknown>).status as string;
          if (status === 'active') toast.success('Patient granted consent!');
          else if (status === 'revoked') toast('Patient revoked consent', { icon: '' });
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [providerUserId, queryClient]);
}
