/** Fetch HBAR + HEAL balances from Hedera mirror node (public, no key). */

export async function fetchHederaBalances(
  accountId: string,
): Promise<{ hbar: number; heal: number }> {
  try {
    const isMainnet = process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet';
    const mirrorBase = isMainnet
      ? 'https://mainnet-public.mirrornode.hedera.com/api/v1'
      : 'https://testnet.mirrornode.hedera.com/api/v1';

    const tokenId = process.env.NEXT_PUBLIC_HEAL_TOKEN_ID;
    const accountRes = await fetch(`${mirrorBase}/accounts/${accountId}`);
    if (!accountRes.ok) return { hbar: 0, heal: 0 };
    const accountData = await accountRes.json();
    const hbar = (accountData?.balance?.balance ?? 0) / 100_000_000;

    let heal = 0;
    if (tokenId && !tokenId.includes('XXXX')) {
      const tokenRes = await fetch(
        `${mirrorBase}/accounts/${accountId}/tokens?token.id=${tokenId}`,
      );
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const healRaw = tokenData?.tokens?.[0]?.balance ?? 0;
        heal = healRaw / 10_000; // HEAL 4 decimals
      }
    }

    return { hbar, heal };
  } catch {
    return { hbar: 0, heal: 0 };
  }
}
