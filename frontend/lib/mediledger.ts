import { fetchHederaBalances } from '@/lib/wallet/balances';
import { isMockMode } from '@/lib/wallet/mode';

export interface WalletAccount {
  accountId: string;
  network: string;
  balance: string;
  publicKey: string;
  provider?: WalletProvider;
}

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'vault', label: 'Health Vault', icon: 'vault' },
  { id: 'consent', label: 'Consent Hub', icon: 'consent' },
  { id: 'ai', label: 'AI Guardian', icon: 'ai' },
  { id: 'emergency', label: 'Emergency', icon: 'emergency' },
  { id: 'tokens', label: '$HEAL Tokens', icon: 'token' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];

export const SIDEBAR_OPEN = 240;
export const SIDEBAR_CLOSED = 64;

export type WalletProvider = 'hashpack' | 'blade' | 'walletconnect' | 'mock';

/**
 * Connect a real Hedera wallet. Never falls back to mock silently.
 */
export async function liveConnect(provider: WalletProvider): Promise<WalletAccount> {
  if (provider === 'mock') {
    if (!isMockMode()) {
      throw new Error('Demo wallet is disabled. Connect HashPack or Blade.');
    }
    return mockConnect();
  }

  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
  let accountId: string;

  if (provider === 'hashpack') {
    const { HashPackConnector } = await import('@/lib/wallet/hashpack');
    const connector = new HashPackConnector();
    accountId = await connector.connect();
  } else if (provider === 'blade') {
    const { BladeConnector } = await import('@/lib/wallet/blade');
    const connector = new BladeConnector();
    accountId = await connector.connect();
  } else if (provider === 'walletconnect') {
    const { WalletConnectConnector } = await import('@/lib/wallet/walletconnect');
    const connector = new WalletConnectConnector();
    accountId = await connector.connect();
  } else {
    throw new Error(`Unknown wallet provider: ${provider}`);
  }

  const balances = await fetchHederaBalances(accountId);

  return {
    accountId,
    network,
    balance: balances.hbar.toFixed(4),
    publicKey: '',
    provider,
  };
}

/** Simulated wallet — local demos only. */
export function mockConnect(): Promise<WalletAccount> {
  return new Promise((resolve, reject) => {
    if (!isMockMode()) {
      reject(new Error('Demo wallet is disabled on this deployment'));
      return;
    }
    setTimeout(() => {
      resolve({
        accountId: '0.0.' + (4000000 + Math.floor(Math.random() * 999999)),
        network: process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet',
        balance: (Math.random() * 800 + 50).toFixed(2),
        publicKey:
          '302a300506032b6570032100' +
          [...Array(32)]
            .map(() =>
              Math.floor(Math.random() * 256)
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
        provider: 'mock',
      });
    }, 800);
  });
}
