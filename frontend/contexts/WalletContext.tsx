'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isMockMode } from '@/lib/wallet/mode';

export type WalletProvider = 'hashpack' | 'blade' | 'walletconnect' | 'mock';
export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'transaction_pending'
  | 'transaction_success'
  | 'transaction_failed';

export interface WalletState {
  status: WalletStatus;
  accountId: string | null;
  provider: WalletProvider | null;
  healBalance: number;
  hbarBalance: number;
  connector: { signMessage?: (msg: string) => Promise<string>; disconnect?: () => void } | null;
  error: string | null;
}

const DEFAULT_STATE: WalletState = {
  status: 'disconnected',
  accountId: null,
  provider: null,
  healBalance: 0,
  hbarBalance: 0,
  connector: null,
  error: null,
};

interface WalletContextValue {
  walletState: WalletState;
  setWalletState: React.Dispatch<React.SetStateAction<WalletState>>;
}

export const WalletContext = createContext<WalletContextValue>({
  walletState: DEFAULT_STATE,
  setWalletState: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>(DEFAULT_STATE);

  // Restore last HashPack pairing metadata (account id only) — does not fake balances
  useEffect(() => {
    if (isMockMode()) return; // mock auto-connect is intentionally disabled on prod

    try {
      const raw = localStorage.getItem('ml_hashpack_pairing');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { accountId?: string; network?: string };
      if (!parsed.accountId) return;

      // Soft restore: show account as connected for UX; balances refresh on next connect/useWallet
      setWalletState((s) => ({
        ...s,
        status: 'connected',
        accountId: parsed.accountId!,
        provider: 'hashpack',
      }));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <WalletContext.Provider value={{ walletState, setWalletState }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}
