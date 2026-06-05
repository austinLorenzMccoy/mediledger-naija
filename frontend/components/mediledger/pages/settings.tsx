"use client"

import { useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import type { WalletAccount } from "@/lib/mediledger"

interface SettingsPageProps {
  wallet: WalletAccount | null
  onOpenWallet: () => void
  onDisconnectWallet: () => void
}

function Toggle({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setOn(!on)}
      className="relative h-6 w-11 shrink-0 rounded-xl border-none transition-colors"
      style={{ background: on ? "#4EC99A" : "rgba(78,201,154,0.18)" }}
    >
      <div
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full transition-[left]"
        style={{
          left: on ? 22 : 3,
          background: on ? "#0D2B1F" : "#9DB8A5",
        }}
      />
    </button>
  )
}

export function SettingsPage({ wallet, onOpenWallet, onDisconnectWallet }: SettingsPageProps) {
  const [notif, setNotif] = useState(true)
  const [emergency, setEmergency] = useState(true)
  const [research, setResearch] = useState(false)

  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">Settings</h2>
      <p className="mb-7 text-sm text-text-muted">
        Manage your account, privacy, and notification preferences.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* Profile */}
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">Profile</h3>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Full Name</label>
              <input defaultValue="Augustine Chibueze" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Email</label>
              <input defaultValue="adaeze@email.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Phone</label>
              <input defaultValue="+234 801 234 5678" />
            </div>
            <button className="rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-2.5 text-sm font-semibold text-forest">
              Save Changes
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">{"Privacy & Preferences"}</h3>
          {[
            { label: "Consent Notifications", desc: "Get alerts for new data access requests", val: notif, set: setNotif },
            { label: "Emergency Protocol", desc: "Allow emergency access to blood type & allergies", val: emergency, set: setEmergency },
            { label: "Research Data Pool", desc: "Join anonymized research dataset programs", val: research, set: setResearch },
          ].map((p, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 pb-4 mb-4"
              style={{ borderBottom: i < 2 ? "1px solid rgba(78,201,154,0.18)" : "none" }}
            >
              <div>
                <div className="text-sm font-medium text-text-primary">{p.label}</div>
                <div className="mt-0.5 text-xs text-text-muted">{p.desc}</div>
              </div>
              <Toggle on={p.val} setOn={p.set} />
            </div>
          ))}
        </div>

        {/* Wallet */}
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">Hedera Wallet</h3>
          {wallet ? (
            <>
              <div className="mb-3.5 rounded-lg border border-mint/25 p-4" style={{ background: "rgba(13,43,31,0.72)" }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-mint" />
                  <span className="text-xs font-medium text-mint">Connected via HashPack</span>
                </div>
                <div className="mb-1 font-mono text-[13px] text-gold">{wallet.accountId}</div>
                <div className="text-xs text-text-muted">
                  {wallet.balance} HBAR &middot; {wallet.network}
                </div>
              </div>
              <div className="mb-3.5 rounded-lg bg-forest-light/25 p-3">
                <div className="mb-1 text-[11px] text-text-muted">Public Key</div>
                <div className="break-all font-mono text-[10px] leading-relaxed text-text-muted">
                  {wallet.publicKey?.slice(0, 32)}...
                </div>
              </div>
              <div className="mb-3.5 text-[13px] leading-relaxed text-text-muted">
                $HEAL payouts are auto-transferred to your wallet every 7 days.
              </div>
              <button
                onClick={onDisconnectWallet}
                className="w-full rounded-[7px] border border-terra bg-transparent py-2.5 text-sm text-terra"
              >
                Disconnect Wallet
              </button>
            </>
          ) : (
            <>
              <div
                className="mb-4 rounded-lg border border-dashed border-border-color p-5 text-center"
                style={{ background: "rgba(13,43,31,0.72)" }}
              >
                <Icon name="lock" size={28} color="#9DB8A5" />
                <div className="mt-2.5 text-[13px] leading-relaxed text-text-muted">
                  No wallet connected. Connect HashPack to sign consent transactions and receive $HEAL tokens.
                </div>
              </div>
              <button
                onClick={onOpenWallet}
                className="w-full rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-[11px] text-sm font-semibold text-forest"
              >
                Connect HashPack Wallet
              </button>
              <a
                href="https://www.hashpack.app/"
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-center text-xs text-text-muted"
              >
                {"Don't have HashPack? Download here \u2192"}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
