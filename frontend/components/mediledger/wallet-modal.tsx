"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import { liveConnect, type WalletAccount, type WalletProvider } from "@/lib/mediledger"
import { isMockMode, walletModeLabel, walletNetworkLabel } from "@/lib/wallet/mode"
import { HashPackConnector } from "@/lib/wallet/hashpack"

interface WalletModalProps {
  onClose: () => void
  onConnected: (account: WalletAccount) => void
}

export function WalletModal({ onClose, onConnected }: WalletModalProps) {
  const [step, setStep] = useState<"choose" | "connecting" | "success" | "error">("choose")
  const [error, setError] = useState("")
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [activeProvider, setActiveProvider] = useState<WalletProvider>("hashpack")
  const [hashpackPresent, setHashpackPresent] = useState(false)
  const allowDemo = isMockMode()

  useEffect(() => {
    // Detect extension (and late inject)
    const check = () => setHashpackPresent(HashPackConnector.isAvailable())
    check()
    const t = window.setInterval(check, 800)
    return () => window.clearInterval(t)
  }, [])

  const handleConnect = async (provider: WalletProvider) => {
    // Hard block: HashPack without extension must not succeed
    if (provider === "hashpack" && !HashPackConnector.isAvailable()) {
      setActiveProvider(provider)
      setStep("error")
      setError(
        "HashPack is not installed in this browser. Install the extension from hashpack.app, unlock it, refresh MediLedger, then connect. Demo wallets are disabled on this site.",
      )
      return
    }

    if (provider === "mock" && !allowDemo) {
      setStep("error")
      setError("Demo wallet is disabled on production.")
      return
    }

    setActiveProvider(provider)
    setStep("connecting")
    setError("")
    try {
      const result = await liveConnect(provider)

      // Refuse to label demo as HashPack
      if (result.isDemo && provider !== "mock") {
        throw new Error("Internal error: demo account returned for a live provider")
      }
      if (result.provider === "mock" || result.isDemo) {
        // only allowed on local demo path
        if (!allowDemo) throw new Error("Demo wallet blocked")
      }

      setAccount(result)
      setStep("success")
      setTimeout(() => {
        onConnected(result)
        onClose()
      }, 1000)
    } catch (e) {
      setError((e as Error).message)
      setStep("error")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-5"
      style={{ background: "rgba(5,15,10,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="fade-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-border-color bg-ink">
        <div className="flex items-center justify-between border-b border-border-color px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #4EC99A, #C9572A)" }}
            >
              <Icon name="shield" size={16} color="#0D2B1F" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-text-primary">Connect Wallet</div>
              <div className="font-mono text-[11px] text-text-muted">
                {walletNetworkLabel()} · mode {walletModeLabel()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex border-none bg-transparent p-1 text-text-muted"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="p-6">
          {step === "choose" && (
            <div>
              <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
                Connect a <strong className="text-text-primary">real</strong> Hedera wallet. Without
                the HashPack extension installed, connection will fail — we no longer invent demo
                accounts.
              </p>

              <div
                className="mb-4 rounded-lg border px-3 py-2 font-mono text-[11px]"
                style={{
                  borderColor: hashpackPresent ? "rgba(78,201,154,0.35)" : "rgba(201,87,42,0.35)",
                  background: hashpackPresent ? "rgba(78,201,154,0.08)" : "rgba(201,87,42,0.08)",
                  color: hashpackPresent ? "#4EC99A" : "#E8754A",
                }}
              >
                HashPack extension: {hashpackPresent ? "detected ✓" : "not found in this browser"}
              </div>

              <button
                type="button"
                onClick={() => void handleConnect("hashpack")}
                className="mb-3 flex w-full items-center gap-3.5 rounded-[10px] border border-mint/25 bg-gradient-to-br from-forest-mid to-forest-light p-4 text-left transition-all hover:border-mint"
              >
                <div
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-lg font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #4F46E5)" }}
                >
                  H
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-text-primary">HashPack</div>
                  <div className="text-xs text-text-muted">
                    {hashpackPresent ? "Extension ready — click to pair" : "Requires extension install"}
                  </div>
                </div>
                <span className="rounded-xl bg-mint/15 px-2 py-0.5 font-mono text-[10px] text-mint">
                  LIVE
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleConnect("blade")}
                className="mb-3 flex w-full items-center gap-3.5 rounded-[10px] border border-border-color bg-forest-mid p-4 text-left transition-colors hover:border-mint/30"
              >
                <div
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #0EA5E9, #0369A1)" }}
                >
                  B
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-text-primary">Blade</div>
                  <div className="text-xs text-text-muted">Extension required</div>
                </div>
              </button>

              {!hashpackPresent && (
                <a
                  href="https://www.hashpack.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 flex w-full items-center justify-center rounded-lg border border-mint/40 bg-mint/10 py-3 text-sm font-semibold text-mint"
                >
                  Install HashPack extension →
                </a>
              )}

              {allowDemo && (
                <button
                  type="button"
                  onClick={() => void handleConnect("mock")}
                  className="mb-2 w-full rounded-md border border-dashed border-border-color bg-transparent py-2 text-xs text-text-muted hover:border-gold/40 hover:text-gold"
                >
                  Local demo wallet only (dev)
                </button>
              )}

              <p className="text-center font-mono text-[10px] text-text-muted">
                build wallet-v3 · no silent mock
              </p>
            </div>
          )}

          {step === "connecting" && (
            <div className="py-5 text-center">
              <div
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-mint/25 bg-mint/10"
                style={{ animation: "pulse-badge 1.5s infinite" }}
              >
                <Icon name="shield" size={28} color="#4EC99A" />
              </div>
              <div className="mb-2 text-base font-medium text-text-primary">
                Connecting {activeProvider}…
              </div>
              <div className="mb-5 text-[13px] text-text-muted">
                Approve the request in your wallet extension popup.
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-mint bg-mint/15">
                <Icon name="consent" size={28} color="#4EC99A" />
              </div>
              <div className="mb-1.5 text-base font-semibold text-mint">
                {account?.isDemo ? "Demo wallet connected" : "Wallet connected"}
              </div>
              <div className="font-mono text-xs text-text-muted">{account?.accountId}</div>
              <div className="mt-1 text-[13px] text-text-muted">
                {account?.balance} HBAR · {account?.network}
                {account?.isDemo ? " · DEMO" : " · live"}
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
                <Icon name="close" size={28} color="#C9572A" />
              </div>
              <div className="mb-2 text-[15px] font-medium text-terra">Connection failed</div>
              <div className="mb-5 text-left text-[13px] leading-relaxed text-text-muted">{error}</div>
              <div className="flex flex-col gap-2">
                <a
                  href="https://www.hashpack.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[7px] border border-mint/40 bg-mint/10 px-7 py-2.5 text-center font-semibold text-mint"
                >
                  Get HashPack
                </a>
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark px-7 py-2.5 font-semibold text-forest"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
