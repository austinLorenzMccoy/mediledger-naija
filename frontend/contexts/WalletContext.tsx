'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HashPackConnector } from '@/lib/wallet/hashpack';

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
  isDemo: boolean;
}

const DEFAULT_STATE: WalletState = {
  status: 'disconnected',
  accountId: null,
  provider: null,
  healBalance: 0,
  hbarBalance: 0,
  connector: null,
  error: null,
  isDemo: false,
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

  useEffect(() => {
    // Never auto-restore a "connected" session without the real extension present.
    // Clear legacy mock / stale pairings from older deploys.
    if (!HashPackConnector.isAvailable()) {
      HashPackConnector.clearStoredPairing();
      return;
    }

    try {
      const raw =
        localStorage.getItem('ml_hashpack_pairing_v2') ||
        localStorage.getItem('ml_hashpack_pairing');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        accountId?: string;
        source?: string;
      };
      // Ignore anything that was not from a real extension pair
      if (parsed.source && parsed.source !== 'hashpack-extension') {
        HashPackConnector.clearStoredPairing();
        return;
      }
      if (!parsed.accountId || !/^0\.0\.\d+$/.test(parsed.accountId)) {
        HashPackConnector.clearStoredPairing();
        return;
      }
      // Soft restore only when extension is actually present
      setWalletState((s) => ({
        ...s,
        status: 'connected',
        accountId: parsed.accountId!,
        provider: 'hashpack',
        isDemo: false,
      }));
    } catch {
      HashPackConnector.clearStoredPairing();
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
