// Blade wallet connector — Hedera wallet with native mobile app
// Injects window.bladeConnect into web pages

declare global {
  interface Window {
    bladeConnect?: {
      init: (appName: string, network: string) => Promise<{ accountId: string }[]>;
      signTransaction: (txBytes: Uint8Array, accountId: string) => Promise<{ txId: string }>;
      getPairingQR: () => string;
      disconnect: () => void;
    };
  }
}

export class BladeConnector {
  private accountId: string | null = null;

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.bladeConnect);
  }

  async connect(): Promise<string> {
    if (!BladeConnector.isAvailable()) {
      throw new Error('Blade wallet not installed. Visit bladewallet.io to install.');
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
    const accounts = await window.bladeConnect!.init('MediLedger Nigeria', network);

    if (!accounts?.length) throw new Error('No accounts returned from Blade');
    this.accountId = accounts[0].accountId;
    return this.accountId;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.accountId) throw new Error('Wallet not connected');
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message);
    const result = await window.bladeConnect!.signTransaction(msgBytes, this.accountId);
    return result.txId;
  }

  async sendTransaction(txBytes: Uint8Array): Promise<string> {
    if (!this.accountId) throw new Error('Wallet not connected');
    const result = await window.bladeConnect!.signTransaction(txBytes, this.accountId);
    return result.txId;
  }

  getPairingQR(): string {
    return window.bladeConnect?.getPairingQR() ?? '';
  }

  disconnect() {
    window.bladeConnect?.disconnect();
    this.accountId = null;
  }
}
