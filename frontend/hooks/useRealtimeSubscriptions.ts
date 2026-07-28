'use client';

/**
 * Realtime is now owned by usePatientBundle (patients, records, consents, tokens, claims).
 * These helpers remain for multi-role dashboards (HMO / NHIA / provider) without react-query.
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export function useHMORealtimeSubscriptions(hmoUserId: string, onChange?: () => void) {
  useEffect(() => {
    if (!hmoUserId) return;
    const channel = supabase
      .channel(`hmo-claims-${hmoUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insurance_claims', filter: `hmo_user_id=eq.${hmoUserId}` },
        () => onChange?.(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hmoUserId, onChange]);
}

export function useNHIARealtimeMonitoring(onChange?: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('nhia-claims-monitor')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'insurance_claims' },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;
          if (newRecord.sla_breached && !oldRecord.sla_breached) {
            const id = String(newRecord.id ?? '').slice(0, 8);
            toast.error(`SLA breach: Claim ${id}…`);
          }
          onChange?.();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange]);
}

export function useProviderConsentSubscriptions(providerUserId: string, onChange?: () => void) {
  useEffect(() => {
    if (!providerUserId) return;
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
          const status = (payload.new as Record<string, unknown>).status as string;
          if (status === 'active') toast.success('Patient granted consent!');
          else if (status === 'revoked') toast('Patient revoked consent', { icon: '⚠️' });
          onChange?.();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [providerUserId, onChange]);
}
