'use client';

import { useCallback } from 'react';
import { useWalletContext, WalletProvider } from '@/contexts/WalletContext';
import { liveConnect, mockConnect } from '@/lib/mediledger';

export function useWallet() {
  const { walletState, setWalletState } = useWalletContext();

  const connect = useCallback(async (provider: WalletProvider) => {
    setWalletState((s) => ({ ...s, status: 'connecting', error: null }));

    try {
      // liveConnect handles dynamic imports for each wallet SDK — nothing loaded at bundle time
      const account = provider === 'mock'
        ? await mockConnect()
        : await liveConnect(provider);

      // For mock mode: skip the auth-service round-trip
      if (provider === 'mock') {
        setWalletState({
          status: 'connected',
          accountId: account.accountId,
          provider,
          healBalance: parseFloat(account.balance) || 18400,
          hbarBalance: 150.5,
          connector: null,
          error: null,
        });
        return;
      }

      // Live wallet: challenge-response → Supabase JWT
      const challengeRes = await fetch('/api/v1/auth/wallet-challenge');
      const { challenge } = await challengeRes.json();

      const { supabase } = await import('@/lib/supabase');
      const { token } = await fetch('/api/v1/auth/wallet-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.accountId, challenge, signature: '' }),
      }).then((r) => r.json());

      await supabase.auth.setSession({ access_token: token, refresh_token: '' });

      const balances = await fetchBalances(account.accountId);

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
  }, [setWalletState]);

  const disconnect = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
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
    const balances = await fetchBalances(walletState.accountId);
    setWalletState((s) => ({ ...s, healBalance: balances.heal, hbarBalance: balances.hbar }));
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

async function fetchBalances(accountId: string): Promise<{ hbar: number; heal: number }> {
  try {
    const mirrorBase = process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com/api/v1'
      : 'https://testnet.mirrornode.hedera.com/api/v1';

    const [accountRes, tokenRes] = await Promise.all([
      fetch(`${mirrorBase}/accounts/${accountId}`),
      fetch(`${mirrorBase}/accounts/${accountId}/tokens?token.id=${process.env.NEXT_PUBLIC_HEAL_TOKEN_ID}`),
    ]);

    const accountData = await accountRes.json();
    const tokenData = await tokenRes.json();

    const hbar = (accountData?.balance?.balance ?? 0) / 100_000_000;
    const healRaw = tokenData?.tokens?.[0]?.balance ?? 0;
    return { hbar, heal: healRaw / 10_000 };
  } catch {
    return { hbar: 0, heal: 0 };
  }
}
