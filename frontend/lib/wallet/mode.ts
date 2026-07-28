/**
 * Wallet mode helpers.
 *
 * Production (Vercel / production builds) NEVER uses the demo mock wallet
 * unless NEXT_PUBLIC_ALLOW_MOCK_WALLET=true is set explicitly.
 *
 * Local dev: set NEXT_PUBLIC_WALLET_MODE=mock for demo without an extension.
 */

export function isProductionBuild(): boolean {
  // NEXT_PUBLIC_VERCEL_ENV is inlined at build time on Vercel
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || '';
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  if (process.env.NODE_ENV === 'production') return true;
  return false;
}

/** True only when demo/mock wallet is intentionally allowed. */
export function isMockMode(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_MOCK_WALLET === 'true') {
    return process.env.NEXT_PUBLIC_WALLET_MODE === 'mock';
  }
  // Hard-disable mock on production/preview deploys
  if (isProductionBuild()) return false;
  return process.env.NEXT_PUBLIC_WALLET_MODE === 'mock';
}

export function walletNetworkLabel(): string {
  const n = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet';
  return n === 'mainnet' ? 'Hedera Mainnet' : 'Hedera Testnet';
}
