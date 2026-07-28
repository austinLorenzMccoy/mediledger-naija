'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { patientApi, type PatientBundle } from '@/lib/api/patients';

const empty: PatientBundle = {
  patient: null,
  records: [],
  consents: [],
  tokenTxs: [],
};

export function usePatientBundle() {
  const { user, isLoading: authLoading } = useAuth();
  const [bundle, setBundle] = useState<PatientBundle>(empty);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setBundle({ ...empty, error: 'Sign in to load your vault' });
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await patientApi.loadBundle();
    setBundle(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return { ...bundle, loading: authLoading || loading, refresh, user };
}
