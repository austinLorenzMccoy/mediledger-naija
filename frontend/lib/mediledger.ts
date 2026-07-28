import { fetchHederaBalances } from '@/lib/wallet/balances';
import { isMockMode, isProductionBuild } from '@/lib/wallet/mode';

export interface WalletAccount {
  accountId: string;
  network: string;
  balance: string;
  publicKey: string;
  provider?: WalletProvider;
  /** true only for intentional local demo simulator */
  isDemo?: boolean;
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
 * Connect a real Hedera wallet.
 * NEVER falls back to the demo simulator when provider is hashpack/blade/wc.
 */
export async function liveConnect(provider: WalletProvider): Promise<WalletAccount> {
  if (provider === 'mock') {
    return mockConnect();
  }

  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
  let accountId: string;

  if (provider === 'hashpack') {
    const { HashPackConnector } = await import('@/lib/wallet/hashpack');
    if (!HashPackConnector.isAvailable()) {
      // Wait for late injection
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!HashPackConnector.isAvailable()) {
      throw new Error(
        'HashPack extension is not installed in this browser. Install it from hashpack.app, unlock it, refresh this page, then try again. (No demo wallet on production.)',
      );
    }
    const connector = new HashPackConnector();
    accountId = await connector.connect();
  } else if (provider === 'blade') {
    const { BladeConnector } = await import('@/lib/wallet/blade');
    if (!BladeConnector.isAvailable()) {
      throw new Error(
        'Blade wallet is not installed. Install Blade from bladewallet.io, then refresh.',
      );
    }
    const connector = new BladeConnector();
    accountId = await connector.connect();
  } else if (provider === 'walletconnect') {
    const { WalletConnectConnector } = await import('@/lib/wallet/walletconnect');
    if (!WalletConnectConnector.isAvailable()) {
      throw new Error(
        'WalletConnect provider is not available in this browser. Use the HashPack or Blade extension instead.',
      );
    }
    const connector = new WalletConnectConnector();
    accountId = await connector.connect();
  } else {
    throw new Error(`Unknown wallet provider: ${provider}`);
  }

  if (!accountId || !/^0\.0\.\d+$/.test(accountId)) {
    throw new Error(`Invalid Hedera account id from wallet: ${accountId}`);
  }

  const balances = await fetchHederaBalances(accountId);

  return {
    accountId,
    network,
    balance: balances.hbar.toFixed(4),
    publicKey: '',
    provider,
    isDemo: false,
  };
}

/**
 * Local-only demo simulator. Throws on Vercel / production hosts.
 * Marked isDemo: true so the UI can refuse to treat it as HashPack.
 */
export async function mockConnect(): Promise<WalletAccount> {
  if (isProductionBuild() || !isMockMode()) {
    throw new Error(
      'Demo wallet is disabled. Install HashPack (hashpack.app) to connect a real account.',
    );
  }

  await new Promise((r) => setTimeout(r, 600));

  // Distinct demo id range so we never confuse with real accounts in logs
  const accountId = `0.0.9${String(100000 + Math.floor(Math.random() * 899999))}`;

  return {
    accountId,
    network: process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet',
    balance: '0.0000',
    publicKey: '',
    provider: 'mock',
    isDemo: true,
  };
}
