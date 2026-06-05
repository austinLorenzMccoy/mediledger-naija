// Mock wallet — development and demo environments only
// Simulates Hedera account without real network calls
// Enable: NEXT_PUBLIC_WALLET_MODE=mock in .env.local

export const mockWallet = {
  accountId: '0.0.4728297',
  network: 'testnet',
  isConnected: true,

  connect: async (): Promise<string> => {
    return mockWallet.accountId;
  },

  signMessage: async (message: string): Promise<string> => {
    // Returns a deterministic fake signature — never use in production
    const fakeHex = Buffer.from(`mock_sig:${message}`).toString('hex').padEnd(128, '0').slice(0, 128);
    return fakeHex;
  },

  sendTransaction: async (_txBytes: Uint8Array): Promise<string> => {
    return `mock_tx_${Date.now()}`;
  },

  getBalance: async (): Promise<{ hbar: number; heal: number }> => {
    return { hbar: 150.50, heal: 18400 };
  },

  transferHeal: async (to: string, amount: number): Promise<{ txId: string }> => {
    return { txId: `mock_heal_${Date.now()}_to_${to}_amt_${amount}` };
  },

  disconnect: () => {},
};

export const isMockMode = (): boolean =>
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_WALLET_MODE === 'mock';
