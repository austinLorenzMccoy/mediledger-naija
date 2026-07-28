// HashPack wallet connector — browser extension injects window.hashpack at runtime.
// Docs: https://docs.hashpack.app/dapp-developers

declare global {
  interface Window {
    hashpack?: {
      init: (
        meta: { name: string; description: string; icon: string; url?: string },
        network: string,
        persist: boolean,
      ) => Promise<{ pairingString: string }>;
      connectToLocalWallet: (pairingString: string) => void;
      pairingEvent: {
        once: (cb: (data: { topic: string; accountIds: string[]; network?: string; metadata?: unknown }) => void) => void;
        on?: (cb: (data: { topic: string; accountIds: string[] }) => void) => void;
      };
      sendTransaction: (
        topic: string,
        opts: object,
      ) => Promise<{
        success: boolean;
        error?: string;
        receipt?: { transactionId?: string; signature?: string };
      }>;
      disconnect?: () => void;
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
    if (typeof window === 'undefined') {
      throw new Error('HashPack requires a browser');
    }

    // Wait briefly for extension injection (can lag behind page load)
    if (!HashPackConnector.isAvailable()) {
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!HashPackConnector.isAvailable()) {
      throw new Error(
        'HashPack extension not detected. Install HashPack from https://www.hashpack.app/, unlock it, then refresh this page.',
      );
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
    const hp = window.hashpack!;

    let initData: { pairingString: string };
    try {
      initData = await hp.init(
        {
          name: 'MediLedger Nigeria',
          description: 'Patient-owned health vaults · ZK proofs · Hedera',
          icon: `${window.location.origin}/icon.svg`,
          url: window.location.origin,
        },
        network,
        true,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`HashPack init failed: ${msg}`);
    }

    hp.connectToLocalWallet(initData.pairingString);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              'HashPack connection timed out. Open the HashPack extension and approve the pairing request.',
            ),
          ),
        90_000,
      );

      const onPair = (data: { topic: string; accountIds: string[] }) => {
        clearTimeout(timer);
        if (!data?.accountIds?.length) {
          reject(new Error('HashPack returned no account IDs'));
          return;
        }
        this.topic = data.topic;
        this.accountId = data.accountIds[0];
        // Persist pairing for reloads
        try {
          localStorage.setItem(
            'ml_hashpack_pairing',
            JSON.stringify({ topic: data.topic, accountId: data.accountIds[0], network }),
          );
        } catch {
          /* ignore */
        }
        resolve(data.accountIds[0]);
      };

      if (hp.pairingEvent?.once) {
        hp.pairingEvent.once(onPair);
      } else if (hp.pairingEvent?.on) {
        hp.pairingEvent.on(onPair);
      } else {
        clearTimeout(timer);
        reject(new Error('HashPack pairingEvent API missing — update your HashPack extension'));
      }
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
    try {
      window.hashpack?.disconnect?.();
    } catch {
      /* ignore */
    }
    this.topic = null;
    this.accountId = null;
    try {
      localStorage.removeItem('ml_hashpack_pairing');
    } catch {
      /* ignore */
    }
  }
}
