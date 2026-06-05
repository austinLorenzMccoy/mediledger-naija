// HashPack wallet connector — uses window.hashpack browser extension API directly.
// No npm SDK import needed — HashPack injects its API into the page at runtime.

declare global {
  interface Window {
    hashpack?: {
      init: (
        meta: { name: string; description: string; icon: string; url?: string },
        network: string,
        persist: boolean,
      ) => Promise<{ pairingString: string }>;
      connectToLocalWallet: (pairingString: string) => void;
      pairingEvent: { once: (cb: (data: { topic: string; accountIds: string[] }) => void) => void };
      sendTransaction: (
        topic: string,
        opts: object,
      ) => Promise<{ success: boolean; error?: string; receipt?: { transactionId?: string; signature?: string } }>;
    };
  }
}

export class HashPackConnector {
  private topic: string | null = null;
  private accountId: string | null = null;

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.hashpack);
  }

  async connect(): Promise<string> {
    if (!HashPackConnector.isAvailable()) {
      throw new Error('HashPack extension not found. Install it from hashpack.app then refresh.');
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
    const initData = await window.hashpack!.init(
      {
        name: 'MediLedger Nigeria',
        description: 'Your Health Vault — Secured by ZK Proofs',
        icon: `${window.location.origin}/icon.png`,
        url: window.location.origin,
      },
      network,
      true,
    );

    window.hashpack!.connectToLocalWallet(initData.pairingString);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HashPack connection timed out (60s)')), 60_000);
      window.hashpack!.pairingEvent.once((data) => {
        clearTimeout(timer);
        this.topic     = data.topic;
        this.accountId = data.accountIds[0];
        resolve(data.accountIds[0]);
      });
    });
  }

  async signMessage(message: string): Promise<string> {
    if (!this.topic || !this.accountId) throw new Error('HashPack not connected');
    const resp = await window.hashpack!.sendTransaction(this.topic, {
      topic: this.topic,
      byteArray: new TextEncoder().encode(message),
      metadata: { accountToSign: this.accountId, returnTransaction: true },
    });
    if (!resp.success) throw new Error(`HashPack signing failed: ${resp.error}`);
    return resp.receipt?.signature ?? '';
  }

  disconnect() {
    this.topic     = null;
    this.accountId = null;
  }
}
