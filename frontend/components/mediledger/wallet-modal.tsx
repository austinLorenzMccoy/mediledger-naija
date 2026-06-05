"use client"

import { useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import { mockConnect, liveConnect, type WalletAccount, type WalletProvider } from "@/lib/mediledger"

interface WalletModalProps {
  onClose: () => void
  onConnected: (account: WalletAccount) => void
}

function QRCode() {
  return (
    <svg width={180} height={180} viewBox="0 0 180 180" style={{ borderRadius: 8 }}>
      <rect width={180} height={180} fill="#143824" rx={8} />
      {[[8, 8], [138, 8], [8, 138]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <rect width={34} height={34} rx={4} fill="none" stroke="#4EC99A" strokeWidth={3} />
          <rect x={6} y={6} width={22} height={22} rx={2} fill="#4EC99A" />
          <rect x={10} y={10} width={14} height={14} rx={1} fill="#143824" />
        </g>
      ))}
      <g transform="translate(138,138)">
        <rect width={34} height={34} rx={4} fill="none" stroke="#4EC99A" strokeWidth={3} />
        <rect x={6} y={6} width={22} height={22} rx={2} fill="#4EC99A" />
        <rect x={10} y={10} width={14} height={14} rx={1} fill="#143824" />
      </g>
      {[...Array(8)].map((_, r) =>
        [...Array(8)].map((_, c) => {
          const skip =
            (r < 3 && c < 3) || (r < 3 && c > 4) || (r > 4 && c < 3) || (r > 4 && c > 4)
          if (skip) return null
          const on = Math.random() > 0.4
          return on ? (
            <rect
              key={`${r}-${c}`}
              x={48 + c * 11}
              y={48 + r * 11}
              width={8}
              height={8}
              rx={1.5}
              fill="#4EC99A"
              opacity={0.85}
            />
          ) : null
        })
      )}
      <text x={90} y={172} textAnchor="middle" fill="#9DB8A5" fontSize={8} fontFamily="monospace">
        WalletConnect v2
      </text>
    </svg>
  )
}

export function WalletModal({ onClose, onConnected }: WalletModalProps) {
  const [step, setStep] = useState<"choose" | "qr" | "connecting" | "success" | "error">("choose")
  const [error, setError] = useState("")
  const [account, setAccount] = useState<WalletAccount | null>(null)

  const handleConnect = async (provider: WalletProvider = "mock") => {
    setStep("connecting")
    setError("")
    try {
      const isMock = process.env.NEXT_PUBLIC_WALLET_MODE === "mock" || provider === "mock"
      const result = isMock ? await mockConnect() : await liveConnect(provider)
      setAccount(result)
      setStep("success")
      setTimeout(() => {
        onConnected(result)
        onClose()
      }, 1400)
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
      <div
        className="fade-in w-full max-w-[440px] overflow-hidden rounded-2xl border border-border-color bg-ink"
      >
        {/* Header */}
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
              <div className="font-mono text-[11px] text-text-muted">Hedera Testnet</div>
            </div>
          </div>
          <button
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
                Connect your HashPack wallet to access your health vault, sign consent transactions, and earn $HEAL tokens.
              </p>

              {/* HashPack via WalletConnect */}
              <button
                onClick={() => handleConnect("hashpack")}
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
                  <div className="text-xs text-text-muted">via WalletConnect v2</div>
                </div>
                <span className="rounded-xl bg-mint/15 px-2 py-0.5 font-mono text-[10px] text-mint">
                  RECOMMENDED
                </span>
              </button>

              {/* QR option */}
              <button
                onClick={() => setStep("qr")}
                className="mb-5 flex w-full items-center gap-3.5 rounded-[10px] border border-border-color bg-forest-mid p-3.5 text-left transition-colors hover:border-mint/30"
              >
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-gold/25 bg-gold/15">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="3" height="3" />
                    <rect x="18" y="18" width="3" height="3" />
                    <rect x="14" y="18" width="3" height="3" />
                    <rect x="18" y="14" width="3" height="3" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">Scan QR Code</div>
                  <div className="text-xs text-text-muted">Connect any WalletConnect wallet</div>
                </div>
              </button>

              <div className="text-center">
                <span className="text-xs text-text-muted">
                  {"Don't have HashPack? "}
                  <a
                    href="https://www.hashpack.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="border-b border-mint/30 text-mint"
                  >
                    Download here
                  </a>
                </span>
              </div>
            </div>
          )}

          {step === "qr" && (
            <div className="text-center">
              <p className="mb-5 text-[13px] text-text-muted">
                Scan this QR code with your HashPack mobile app or any WalletConnect-compatible wallet.
              </p>
              <div className="mb-5 flex justify-center">
                <QRCode />
              </div>
              <div className="mb-5 break-all font-mono text-[10px] text-text-muted">
                {"wc:1a2b3c4d5e6f...@2?relay-protocol=irn&symKey=abc123def456"}
              </div>
              <button
                onClick={() => handleConnect("walletconnect")}
                className="w-full rounded-lg border-none bg-gradient-to-br from-mint to-mint-dark p-3 text-sm font-semibold text-forest"
              >
                Connect via QR
              </button>
              <button
                onClick={() => setStep("choose")}
                className="mt-2.5 w-full border-none bg-transparent text-[13px] text-text-muted"
              >
                {"<- Back"}
              </button>
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
              <div className="mb-2 text-base font-medium text-text-primary">{"Connecting to HashPack\u2026"}</div>
              <div className="mb-5 text-[13px] text-text-muted">
                Please approve the connection request in your wallet.
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
              <div className="mb-1.5 text-base font-semibold text-mint">Wallet Connected!</div>
              <div className="font-mono text-xs text-text-muted">{account?.accountId}</div>
              <div className="mt-1 text-[13px] text-text-muted">
                {account?.balance} HBAR &middot; Testnet
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="py-5 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
                <Icon name="close" size={28} color="#C9572A" />
              </div>
              <div className="mb-2 text-[15px] font-medium text-terra">Connection Failed</div>
              <div className="mb-5 text-[13px] text-text-muted">{error}</div>
              <button
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
