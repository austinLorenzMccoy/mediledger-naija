'use client';

import { useCallback } from 'react';
import { useWalletContext, WalletProvider } from '@/contexts/WalletContext';
import { liveConnect } from '@/lib/mediledger';
import { fetchHederaBalances } from '@/lib/wallet/balances';
import { isMockMode } from '@/lib/wallet/mode';

export function useWallet() {
  const { walletState, setWalletState } = useWalletContext();

  const connect = useCallback(
    async (provider: WalletProvider) => {
      setWalletState((s) => ({ ...s, status: 'connecting', error: null }));

      try {
        const account = await liveConnect(provider);

        if (provider === 'mock' || isMockMode()) {
          setWalletState({
            status: 'connected',
            accountId: account.accountId,
            provider,
            healBalance: parseFloat(account.balance) || 0,
            hbarBalance: parseFloat(account.balance) || 0,
            connector: null,
            error: null,
          });
          return;
        }

        // Optional: challenge-response if auth-service is up (non-blocking for UI connect)
        try {
          const challengeRes = await fetch('/api/v1/auth/wallet-challenge');
          if (challengeRes.ok) {
            const { challenge } = await challengeRes.json();
            const verifyRes = await fetch('/api/v1/auth/wallet-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: account.accountId,
                challenge,
                signature: '',
              }),
            });
            if (verifyRes.ok) {
              const { token } = await verifyRes.json();
              if (token) {
                const { supabase } = await import('@/lib/supabase');
                await supabase.auth.setSession({
                  access_token: token,
                  refresh_token: '',
                });
              }
            }
          }
        } catch {
          /* wallet can connect without auth-service */
        }

        const balances = await fetchHederaBalances(account.accountId);

        setWalletState({
          status: 'connected',
          accountId: account.accountId,
          provider,
          healBalance: balances.heal,
          hbarBalance: balances.hbar,
          connector: null,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setWalletState((s) => ({ ...s, status: 'disconnected', error: message }));
      }
    },
    [setWalletState],
  );

  const disconnect = useCallback(async () => {
    try {
      localStorage.removeItem('ml_hashpack_pairing');
    } catch {
      /* ignore */
    }
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    setWalletState({
      status: 'disconnected',
      accountId: null,
      provider: null,
      healBalance: 0,
      hbarBalance: 0,
      connector: null,
      error: null,
    });
  }, [setWalletState]);

  const refreshBalances = useCallback(async () => {
    if (!walletState.accountId) return;
    const balances = await fetchHederaBalances(walletState.accountId);
    setWalletState((s) => ({
      ...s,
      healBalance: balances.heal,
      hbarBalance: balances.hbar,
    }));
  }, [walletState.accountId, setWalletState]);

  return {
    ...walletState,
    connect,
    disconnect,
    refreshBalances,
    isConnected: walletState.status === 'connected',
    isConnecting: walletState.status === 'connecting',
  };
}
