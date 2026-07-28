"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { consentApi } from "@/lib/api/consents"
import { formatRelative } from "@/lib/api/patients"

function scopeLabel(scope: unknown): string {
  if (Array.isArray(scope)) return scope.join(", ")
  if (scope && typeof scope === "object") return JSON.stringify(scope)
  if (typeof scope === "string") return scope
  return "—"
}

export function ConsentPage() {
  const { patient, consents, loading, refresh, error } = usePatientBundle()
  const [busyId, setBusyId] = useState<string | null>(null)

  const pending = consents.filter((c) => c.status === "pending")
  const active = consents.filter((c) => c.status === "active")
  const other = consents.filter((c) => !["pending", "active"].includes(c.status))

  async function grant(id: string) {
    setBusyId(id)
    try {
      const { error: err } = await consentApi.grant(id)
      if (err) throw err
      toast.success("Consent granted")
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Grant failed")
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(id: string) {
    setBusyId(id)
    try {
      const { error: err } = await consentApi.revoke(id)
      if (err) throw err
      toast.success("Consent revoked")
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Revoke failed")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading consents…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
            Consent Hub
          </h2>
          <p className="text-sm text-text-muted">
            Live consent agreements for{" "}
            {patient?.nhia_id ?? "your account"} — updates stream in realtime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-border-color bg-transparent px-3 py-1.5 text-xs text-text-muted hover:border-mint/30"
        >
          Refresh
        </button>
      </div>

      {!patient && (
        <p className="mb-4 text-xs text-text-muted">
          {error ?? "Sign in to manage live consent agreements."}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Pending", n: pending.length, color: "#D4A843" },
          { label: "Active", n: active.length, color: "#4EC99A" },
          { label: "Expired / revoked", n: other.length, color: "#9DB8A5" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[10px] border border-border-color bg-forest-mid p-4"
          >
            <div className="text-xs text-text-muted">{s.label}</div>
            <div className="font-serif text-2xl" style={{ color: s.color }}>
              {s.n}
            </div>
          </div>
        ))}
      </div>

      {consents.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-forest-mid p-10 text-center">
          <Icon name="consent" size={28} color="#9DB8A5" />
          <p className="mt-3 text-sm text-text-primary">No consent agreements yet</p>
          <p className="mt-1 text-xs text-text-muted">
            When a provider or researcher requests access, it appears here in realtime.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {consents.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border-color bg-forest-mid p-5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[15px] font-medium text-text-primary">
                  {c.purpose || "Data access request"}
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[10px]"
                  style={{
                    background:
                      c.status === "active"
                        ? "#4EC99A22"
                        : c.status === "pending"
                          ? "#D4A84322"
                          : "#9DB8A522",
                    color:
                      c.status === "active"
                        ? "#4EC99A"
                        : c.status === "pending"
                          ? "#D4A843"
                          : "#9DB8A5",
                  }}
                >
                  {c.status}
                </span>
              </div>
              <div className="mb-3 grid gap-1 text-xs text-text-muted sm:grid-cols-2">
                <div>Requester: {c.requester_type ?? "—"}</div>
                <div>Scope: {scopeLabel(c.data_scope)}</div>
                <div>
                  Valid: {new Date(c.valid_from).toLocaleDateString()} →{" "}
                  {new Date(c.valid_until).toLocaleDateString()}
                </div>
                <div>
                  Payment: {Number(c.monthly_payment_heal).toFixed(2)} HEAL/mo ·{" "}
                  {formatRelative(c.created_at)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void grant(c.id)}
                      className="rounded-md border-none bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void revoke(c.id)}
                      className="rounded-md border border-border-color bg-transparent px-3.5 py-1.5 text-xs text-text-muted disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </>
                )}
                {c.status === "active" && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => void revoke(c.id)}
                    className="rounded-md border border-terra bg-transparent px-3.5 py-1.5 text-xs text-terra disabled:opacity-50"
                  >
                    Revoke access
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
