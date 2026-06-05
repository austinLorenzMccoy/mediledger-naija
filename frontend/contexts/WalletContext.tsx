'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mockWallet, isMockMode } from '@/lib/wallet/mock-wallet';

export type WalletProvider = 'hashpack' | 'blade' | 'walletconnect' | 'mock';
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'transaction_pending' | 'transaction_success' | 'transaction_failed';

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

  // Restore persisted HashPack pairing on mount
  useEffect(() => {
    if (isMockMode()) {
      setWalletState((s) => ({
        ...s,
        status: 'connected',
        accountId: mockWallet.accountId,
        provider: 'mock',
        healBalance: 18400,
        hbarBalance: 150.5,
        connector: mockWallet,
      }));
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
