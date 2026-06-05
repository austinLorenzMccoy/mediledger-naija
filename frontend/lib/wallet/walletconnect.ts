// WalletConnect connector — uses the WalletConnect browser modal injected at runtime.
// We avoid bundling @walletconnect/web3-provider (has broken peer deps); instead we
// load it via a CDN script tag that the extension/dApp environment injects, or we
// fall back to the hashpack/blade extension APIs.

declare global {
  interface Window {
    WalletConnectProvider?: new (opts: {
      rpc: Record<number, string>;
      qrcode: boolean;
      chainId: number;
    }) => {
      enable: () => Promise<string[]>;
      accounts: string[];
      request: (params: unknown) => Promise<string>;
      disconnect: () => void;
    };
  }
}

export class WalletConnectConnector {
  private provider: Window['WalletConnectProvider'] extends new (...args: unknown[]) => infer R ? R : never | null = null as never;
  private accountId: string | null = null;

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.WalletConnectProvider);
  }

  async connect(): Promise<string> {
    if (typeof window === 'undefined') throw new Error('WalletConnect requires a browser environment');

    // Prefer extension-injected WalletConnectProvider; otherwise this path is
    // only reachable when the user explicitly selects WalletConnect mode.
    if (!window.WalletConnectProvider) {
      throw new Error(
        'WalletConnect provider not available. Use HashPack or Blade extension instead.',
      );
    }

    const isMainnet = process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet';
    this.provider = new window.WalletConnectProvider({
      rpc: {
        295: 'https://mainnet.hashio.io/api',
        296: 'https://testnet.hashio.io/api',
      },
      qrcode: true,
      chainId: isMainnet ? 295 : 296,
    });

    const accounts = await this.provider.enable();
    if (!accounts?.length) throw new Error('No accounts from WalletConnect');

    this.accountId = accounts[0];
    return this.accountId;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.provider || !this.accountId) throw new Error('WalletConnect not connected');
    const msgHex = '0x' + Buffer.from(message, 'utf-8').toString('hex');
    return this.provider.request({
      method: 'personal_sign',
      params: [msgHex, this.accountId],
    });
  }

  disconnect() {
    this.provider?.disconnect?.();
    this.provider = null as never;
    this.accountId = null;
  }
}
