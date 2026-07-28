/**
 * Wallet mode — production never uses the demo simulator.
 *
 * Demo only when BOTH:
 *   NEXT_PUBLIC_WALLET_MODE=mock
 *   NEXT_PUBLIC_ALLOW_MOCK_WALLET=true
 * and build is NOT production/preview.
 */

export function isProductionBuild(): boolean {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app') || host === 'mediledger-nigeria.vercel.app') {
      return true;
    }
  }
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || '';
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  if (process.env.NODE_ENV === 'production') return true;
  return false;
}

/** Explicit opt-in for local demo wallet only. */
export function isMockMode(): boolean {
  // Absolute ban on hosted deploys
  if (isProductionBuild()) return false;
  return (
    process.env.NEXT_PUBLIC_ALLOW_MOCK_WALLET === 'true' &&
    process.env.NEXT_PUBLIC_WALLET_MODE === 'mock'
  );
}

export function walletNetworkLabel(): string {
  const n = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
  return n === 'mainnet' ? 'Hedera Mainnet' : 'Hedera Testnet';
}

export function walletModeLabel(): string {
  return isMockMode() ? 'demo' : 'live';
}
