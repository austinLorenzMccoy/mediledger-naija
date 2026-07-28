'use client';

import { useCallback } from 'react';
import { useWalletContext, WalletProvider } from '@/contexts/WalletContext';
import { liveConnect } from '@/lib/mediledger';
import { fetchHederaBalances } from '@/lib/wallet/balances';
import { HashPackConnector } from '@/lib/wallet/hashpack';

export function useWallet() {
  const { walletState, setWalletState } = useWalletContext();

  const connect = useCallback(
    async (provider: WalletProvider) => {
      setWalletState((s) => ({ ...s, status: 'connecting', error: null }));

      try {
        if (provider === 'hashpack' && !HashPackConnector.isAvailable()) {
          throw new Error(
            'HashPack extension not installed in this browser. Install from hashpack.app, then refresh.',
          );
        }

        const account = await liveConnect(provider);

        if (account.isDemo || account.provider === 'mock') {
          setWalletState({
            status: 'connected',
            accountId: account.accountId,
            provider: 'mock',
            healBalance: 0,
            hbarBalance: 0,
            connector: null,
            error: null,
            isDemo: true,
          });
          return;
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
          isDemo: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setWalletState((s) => ({
          ...s,
          status: 'disconnected',
          error: message,
          isDemo: false,
        }));
      }
    },
    [setWalletState],
  );

  const disconnect = useCallback(async () => {
    HashPackConnector.clearStoredPairing();
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
      isDemo: false,
    });
  }, [setWalletState]);

  const refreshBalances = useCallback(async () => {
    if (!walletState.accountId || walletState.isDemo) return;
    const balances = await fetchHederaBalances(walletState.accountId);
    setWalletState((s) => ({
      ...s,
      healBalance: balances.heal,
      hbarBalance: balances.hbar,
    }));
  }, [walletState.accountId, walletState.isDemo, setWalletState]);

  return {
    ...walletState,
    connect,
    disconnect,
    refreshBalances,
    isConnected: walletState.status === 'connected',
    isConnecting: walletState.status === 'connecting',
  };
}
