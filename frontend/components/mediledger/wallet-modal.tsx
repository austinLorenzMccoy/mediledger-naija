"use client"

import { useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import { liveConnect, type WalletAccount, type WalletProvider } from "@/lib/mediledger"
import { isMockMode, walletNetworkLabel } from "@/lib/wallet/mode"

interface WalletModalProps {
  onClose: () => void
  onConnected: (account: WalletAccount) => void
}

export function WalletModal({ onClose, onConnected }: WalletModalProps) {
  const [step, setStep] = useState<"choose" | "connecting" | "success" | "error">("choose")
  const [error, setError] = useState("")
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [activeProvider, setActiveProvider] = useState<WalletProvider>("hashpack")
  const allowDemo = isMockMode()

  const handleConnect = async (provider: WalletProvider) => {
    setActiveProvider(provider)
    setStep("connecting")
    setError("")
    try {
      // Never force mock when user picks HashPack/Blade/WC — only "mock" provider uses demo
      const result = await liveConnect(provider)
      setAccount(result)
      setStep("success")
      setTimeout(() => {
        onConnected(result)
        onClose()
      }, 1200)
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
              <div className="font-mono text-[11px] text-text-muted">{walletNetworkLabel()}</div>
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
              <p className="mb-5 text-[13px] leading-relaxed text-text-muted">
                Connect a real Hedera wallet to sign consents and receive $HEAL. Install the
                extension, then approve the pairing popup.
              </p>

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
                  <div className="text-xs text-text-muted">Browser extension · live pairing</div>
                </div>
                <span className="rounded-xl bg-mint/15 px-2 py-0.5 font-mono text-[10px] text-mint">
                  RECOMMENDED
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
                  <div className="text-xs text-text-muted">Extension / mobile</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void handleConnect("walletconnect")}
                className="mb-5 flex w-full items-center gap-3.5 rounded-[10px] border border-border-color bg-forest-mid p-4 text-left transition-colors hover:border-mint/30"
              >
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-gold/25 bg-gold/15">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="3" height="3" />
                    <rect x="18" y="18" width="3" height="3" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">WalletConnect</div>
                  <div className="text-xs text-text-muted">QR / injected provider</div>
                </div>
              </button>

              {allowDemo && (
                <button
                  type="button"
                  onClick={() => void handleConnect("mock")}
                  className="mb-4 w-full rounded-md border border-dashed border-border-color bg-transparent py-2 text-xs text-text-muted hover:border-gold/40 hover:text-gold"
                >
                  Use demo wallet (local only)
                </button>
              )}

              <div className="text-center text-xs text-text-muted">
                Need HashPack?{" "}
                <a
                  href="https://www.hashpack.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="border-b border-mint/30 text-mint"
                >
                  Download extension
                </a>
              </div>
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
                Connecting to {activeProvider === "mock" ? "demo wallet" : activeProvider}…
              </div>
              <div className="mb-5 text-[13px] text-text-muted">
                {activeProvider === "hashpack"
                  ? "Approve the pairing request in the HashPack extension."
                  : "Follow the prompts in your wallet."}
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-mint"
                    style={{ animation: `pulse-dot 1.2s ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-mint bg-mint/15">
                <Icon name="consent" size={28} color="#4EC99A" />
              </div>
              <div className="mb-1.5 text-base font-semibold text-mint">Wallet Connected</div>
              <div className="font-mono text-xs text-text-muted">{account?.accountId}</div>
              <div className="mt-1 text-[13px] text-text-muted">
                {account?.balance} HBAR · {account?.network}
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
                <Icon name="close" size={28} color="#C9572A" />
              </div>
              <div className="mb-2 text-[15px] font-medium text-terra">Connection Failed</div>
              <div className="mb-5 text-[13px] leading-relaxed text-text-muted">{error}</div>
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark px-7 py-2.5 font-semibold text-forest"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
