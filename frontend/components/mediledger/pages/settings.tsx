"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import type { WalletAccount } from "@/lib/mediledger"
import { useAuth } from "@/contexts/AuthContext"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { patientApi } from "@/lib/api/patients"

interface SettingsPageProps {
  wallet: WalletAccount | null
  onOpenWallet: () => void
  onDisconnectWallet: () => void
}

function Toggle({ on, setOn, disabled }: { on: boolean; setOn: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOn(!on)}
      className="relative h-6 w-11 shrink-0 rounded-xl border-none transition-colors disabled:opacity-40"
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
  const { user } = useAuth()
  const { patient, loading, refresh } = usePatientBundle()
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [emergency, setEmergency] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!patient) return
    setFullName(patient.full_name ?? "")
    setPhone(patient.phone_number ?? "")
    setEmergency(patient.emergency_tag_active ?? true)
  }, [patient])

  async function saveProfile() {
    if (!patient) {
      toast.error("No patient profile")
      return
    }
    setSaving(true)
    try {
      const { error } = await patientApi.updateProfile({
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        emergency_tag_active: emergency,
      })
      if (error) throw error
      toast.success("Profile saved")
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">Settings</h2>
      <p className="mb-7 text-sm text-text-muted">
        Live account data from Supabase — changes save to your patient row.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">Profile</h3>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!patient}
                className="w-full rounded-md border border-border-color bg-transparent px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Email (auth)</label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full rounded-md border border-border-color bg-transparent px-3 py-2 text-sm text-text-muted opacity-70"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!patient}
                className="w-full rounded-md border border-border-color bg-transparent px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">NHIA ID</label>
              <input
                value={patient?.nhia_id ?? "—"}
                disabled
                className="w-full rounded-md border border-border-color bg-transparent px-3 py-2 font-mono text-sm text-text-muted opacity-70"
              />
            </div>
            <button
              type="button"
              disabled={!patient || saving}
              onClick={() => void saveProfile()}
              className="rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-2.5 text-sm font-semibold text-forest disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">
            Privacy & Preferences
          </h3>
          <div className="flex items-start justify-between gap-4 pb-4">
            <div>
              <div className="text-sm font-medium text-text-primary">Emergency Protocol</div>
              <div className="mt-0.5 text-xs text-text-muted">
                Allow emergency access to blood type & critical tags
              </div>
            </div>
            <Toggle
              on={emergency}
              setOn={setEmergency}
              disabled={!patient}
            />
          </div>
          <div className="rounded-lg border border-border-color/50 p-3 font-mono text-[10px] text-text-muted">
            <div>Vault key: {patient?.vault_public_key === "pending" ? "pending" : patient?.vault_public_key?.slice(0, 18) + "…"}</div>
            <div>ZK proof: {patient?.zk_proof_hash === "pending" ? "pending" : patient?.zk_proof_hash?.slice(0, 18) + "…"}</div>
            <div>HEAL cache: {patient?.heal_balance ?? 0}</div>
            <div>Hedera: {patient?.hedera_account_id ?? "not linked"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-5 font-serif text-base text-text-primary">Hedera Wallet</h3>
          {wallet ? (
            <>
              <div
                className="mb-3.5 rounded-lg border border-mint/25 p-4"
                style={{ background: "rgba(13,43,31,0.72)" }}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-mint" />
                  <span className="text-xs font-medium text-mint">Connected</span>
                </div>
                <div className="mb-1 font-mono text-[13px] text-gold">{wallet.accountId}</div>
                <div className="text-xs text-text-muted">
                  {wallet.balance} HBAR · {wallet.network}
                </div>
              </div>
              {wallet.publicKey && (
                <div className="mb-3.5 rounded-lg bg-forest-light/25 p-3">
                  <div className="mb-1 text-[11px] text-text-muted">Public Key</div>
                  <div className="break-all font-mono text-[10px] leading-relaxed text-text-muted">
                    {wallet.publicKey.slice(0, 48)}…
                  </div>
                </div>
              )}
              <button
                type="button"
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
                  No wallet connected. Connect HashPack to sign consent transactions and receive
                  $HEAL tokens.
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenWallet}
                className="w-full rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-[11px] text-sm font-semibold text-forest"
              >
                Connect Wallet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
