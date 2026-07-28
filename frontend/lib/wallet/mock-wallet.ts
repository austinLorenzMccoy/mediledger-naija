// Mock wallet — local development only (never on production unless ALLOW_MOCK_WALLET)
// Enable: NEXT_PUBLIC_WALLET_MODE=mock in .env.local (dev)

import { isMockMode as checkMockMode } from '@/lib/wallet/mode';

export const mockWallet = {
  accountId: '0.0.4728297',
  network: 'testnet',
  isConnected: true,

  connect: async (): Promise<string> => {
    return mockWallet.accountId;
  },

  signMessage: async (message: string): Promise<string> => {
    const fakeHex = Buffer.from(`mock_sig:${message}`).toString('hex').padEnd(128, '0').slice(0, 128);
    return fakeHex;
  },

  sendTransaction: async (_txBytes: Uint8Array): Promise<string> => {
    return `mock_tx_${Date.now()}`;
  },

  getBalance: async (): Promise<{ hbar: number; heal: number }> => {
    return { hbar: 150.5, heal: 18400 };
  },

  transferHeal: async (to: string, amount: number): Promise<{ txId: string }> => {
    return { txId: `mock_heal_${Date.now()}_to_${to}_amt_${amount}` };
  },

  disconnect: () => {},
};

export const isMockMode = checkMockMode;
