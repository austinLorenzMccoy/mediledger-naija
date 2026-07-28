"use client"

import { useState } from "react"
import { LandingPage } from "@/components/mediledger/landing-page"
import { Dashboard } from "@/components/mediledger/dashboard"
import { WalletModal } from "@/components/mediledger/wallet-modal"
import type { WalletAccount } from "@/lib/mediledger"

export default function MediLedgerApp() {
  const [route, setRoute] = useState<"landing" | "dashboard">("landing")
  const [wallet, setWallet] = useState<WalletAccount | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const handleConnected = (account: WalletAccount) => {
    // Never accept a demo account labeled as HashPack
    if (account.isDemo || account.provider === "mock") {
      setWallet({ ...account, provider: "mock" })
      return
    }
    setWallet(account)
  }

  const handleDisconnect = () => {
    try {
      localStorage.removeItem("ml_hashpack_pairing")
      localStorage.removeItem("ml_hashpack_pairing_v2")
    } catch {
      /* ignore */
    }
    setWallet(null)
  }

  const sharedWalletProps = {
    wallet,
    onOpenWallet: () => setWalletModalOpen(true),
    onDisconnectWallet: handleDisconnect,
  }

  return (
    <>
      {walletModalOpen && (
        <WalletModal
          onClose={() => setWalletModalOpen(false)}
          onConnected={handleConnected}
        />
      )}
      {route === "landing" && (
        <LandingPage onEnter={() => setRoute("dashboard")} {...sharedWalletProps} />
      )}
      {route === "dashboard" && (
        <Dashboard onGoHome={() => setRoute("landing")} {...sharedWalletProps} />
      )}
    </>
  )
}
