// HashPack — requires the real browser extension. No silent demo fallback.

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
        once: (cb: (data: { topic: string; accountIds: string[] }) => void) => void;
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

const STORAGE_KEY = 'ml_hashpack_pairing_v2';

export class HashPackConnector {
  private topic: string | null = null;
  private accountId: string | null = null;

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.hashpack !== 'undefined' && window.hashpack !== null;
  }

  static clearStoredPairing() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('ml_hashpack_pairing'); // legacy
    } catch {
      /* ignore */
    }
  }

  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('HashPack requires a browser');
    }

    // Poll up to ~2s for extension inject
    for (let i = 0; i < 8; i++) {
      if (HashPackConnector.isAvailable()) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!HashPackConnector.isAvailable()) {
      HashPackConnector.clearStoredPairing();
      throw new Error(
        'HashPack extension not found in this browser. Install from https://www.hashpack.app/ (Chrome/Brave/Firefox), unlock it, reload MediLedger, then connect again.',
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

    if (!initData?.pairingString) {
      throw new Error('HashPack did not return a pairing string');
    }

    try {
      hp.connectToLocalWallet(initData.pairingString);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not open HashPack pairing UI: ${msg}`);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            'HashPack pairing timed out (90s). Open the HashPack extension popup and approve the connection.',
          ),
        );
      }, 90_000);

      const onPair = (data: { topic: string; accountIds: string[] }) => {
        clearTimeout(timer);
        if (!data?.accountIds?.length) {
          reject(new Error('HashPack returned no accounts — create/import an account in HashPack first'));
          return;
        }
        this.topic = data.topic;
        this.accountId = data.accountIds[0];
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              topic: data.topic,
              accountId: data.accountIds[0],
              network,
              at: Date.now(),
              source: 'hashpack-extension',
            }),
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
        reject(new Error('HashPack API outdated — update the HashPack extension'));
      }
    });
  }

  async signMessage(message: string): Promise<string> {
    if (!this.topic || !this.accountId) throw new Error('HashPack not connected');
    if (!HashPackConnector.isAvailable()) throw new Error('HashPack extension missing');
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
    HashPackConnector.clearStoredPairing();
  }
}
