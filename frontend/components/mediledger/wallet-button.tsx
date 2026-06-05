"use client"

import { useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import type { WalletAccount } from "@/lib/mediledger"

interface WalletButtonProps {
  wallet: WalletAccount | null
  onOpen: () => void
  onDisconnect: () => void
  compact?: boolean
}

export function WalletButton({ wallet, onOpen, onDisconnect, compact = false }: WalletButtonProps) {
  const [showMenu, setShowMenu] = useState(false)

  if (wallet) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="flex items-center gap-2 rounded-[7px] border border-mint/30 bg-mint/10 text-[13px] font-medium text-mint transition-all"
          style={{ padding: compact ? "7px 14px" : "9px 18px" }}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-mint" />
          <span className="font-mono text-xs">
            {wallet.accountId.slice(0, 5)}...{wallet.accountId.slice(-4)}
          </span>
          {!compact && (
            <span className="text-[11px] text-text-muted">
              {parseFloat(wallet.balance).toFixed(0)} {"ℏ"}
            </span>
          )}
        </button>
        {showMenu && (
          <div className="fade-in absolute right-0 top-[calc(100%+8px)] z-[200] min-w-[220px] overflow-hidden rounded-[10px] border border-border-color bg-ink">
            <div className="border-b border-border-color px-4 py-3.5">
              <div className="mb-1 text-[11px] text-text-muted">Connected via HashPack</div>
              <div className="font-mono text-xs text-mint">{wallet.accountId}</div>
              <div className="mt-0.5 text-[11px] text-text-muted">
                {wallet.balance} HBAR &middot; Testnet
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(wallet.accountId)
                  setShowMenu(false)
                }}
                className="w-full rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-text-muted hover:bg-forest-mid"
              >
                Copy Account ID
              </button>
              <button
                onClick={() => {
                  onDisconnect()
                  setShowMenu(false)
                }}
                className="w-full rounded-md border-none bg-transparent px-3 py-2.5 text-left text-[13px] text-terra hover:bg-forest-mid"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-[7px] rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark font-semibold text-forest transition-opacity hover:opacity-90"
      style={{
        padding: compact ? "7px 14px" : "9px 20px",
        fontSize: compact ? 13 : 14,
      }}
    >
      <Icon name="lock" size={14} color="#0D2B1F" />
      Connect HashPack
    </button>
  )
}
