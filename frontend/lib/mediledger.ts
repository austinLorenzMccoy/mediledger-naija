export interface WalletAccount {
  accountId: string
  network: string
  balance: string
  publicKey: string
}

export const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "vault", label: "Health Vault", icon: "vault" },
  { id: "consent", label: "Consent Hub", icon: "consent" },
  { id: "ai", label: "AI Guardian", icon: "ai" },
  { id: "emergency", label: "Emergency", icon: "emergency" },
  { id: "tokens", label: "$HEAL Tokens", icon: "token" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const

export type NavItemId = (typeof NAV_ITEMS)[number]["id"]

export const SIDEBAR_OPEN = 240
export const SIDEBAR_CLOSED = 64

export type WalletProvider = "hashpack" | "blade" | "walletconnect" | "mock"

// Live wallet connection — selects the right connector for each provider
export async function liveConnect(provider: WalletProvider): Promise<WalletAccount> {
  if (provider === "mock") return mockConnect()

  // Dynamic imports keep wallet SDKs out of the main bundle
  if (provider === "hashpack") {
    const { HashPackConnector } = await import("@/lib/wallet/hashpack")
    const connector = new HashPackConnector()
    const accountId = await connector.connect()
    return { accountId, network: process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet", balance: "0.00", publicKey: "" }
  }

  if (provider === "blade") {
    const { BladeConnector } = await import("@/lib/wallet/blade")
    const connector = new BladeConnector()
    const accountId = await connector.connect()
    return { accountId, network: process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet", balance: "0.00", publicKey: "" }
  }

  if (provider === "walletconnect") {
    const { WalletConnectConnector } = await import("@/lib/wallet/walletconnect")
    const connector = new WalletConnectConnector()
    const accountId = await connector.connect()
    return { accountId, network: process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet", balance: "0.00", publicKey: "" }
  }

  return mockConnect()
}

export function mockConnect(): Promise<WalletAccount> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.08) {
        resolve({
          accountId: "0.0." + (4000000 + Math.floor(Math.random() * 999999)),
          network: "testnet",
          balance: (Math.random() * 800 + 50).toFixed(2),
          publicKey:
            "302a300506032b6570032100" +
            [...Array(32)]
              .map(() =>
                Math.floor(Math.random() * 256)
                  .toString(16)
                  .padStart(2, "0")
              )
              .join(""),
        })
      } else {
        reject(new Error("User rejected the connection request."))
      }
    }, 2200)
  })
}
