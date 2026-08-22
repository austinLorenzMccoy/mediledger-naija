"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { claimsApi } from "@/lib/api/claims"
import { formatRelative } from "@/lib/api/patients"
import { sha256Hex } from "@/lib/api/enrollment"
import type { Database } from "@/lib/database.types"

type Claim = Database["public"]["Tables"]["insurance_claims"]["Row"]

const PIPELINE = [
  { id: "submitted", label: "Submitted" },
  { id: "provider_signed", label: "Provider signed" },
  { id: "patient_signed", label: "Patient signed" },
  { id: "hmo_review", label: "HMO review" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
] as const

function statusColor(status: string, breached?: boolean) {
  if (breached) return "#C9572A"
  if (status === "approved" || status === "paid") return "#4EC99A"
  if (status === "rejected" || status === "disputed") return "#C9572A"
  if (status === "draft") return "#9DB8A5"
  return "#D4A843"
}

function formatNgn(n: number | null | undefined) {
  if (n == null) return "—"
  return `₦${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function pipelineIndex(status: string) {
  if (status === "rejected" || status === "disputed") return -1
  if (status === "draft") return 0
  const i = PIPELINE.findIndex((s) => s.id === status)
  return i === -1 ? 0 : i
}

export function ClaimsPage() {
  const { patient, claims, loading, refresh, error } = usePatientBundle()
  const [busyId, setBusyId] = useState<string | null>(null)

  const pendingSig = claims.filter((c) =>
    ["submitted", "provider_signed"].includes(c.status),
  )
  const approved = claims.filter((c) => c.status === "approved" || c.status === "paid")
  const flagged = claims.filter((c) => c.status === "rejected" || c.status === "disputed" || c.sla_breached)

  async function signAsPatient(claim: Claim) {
    if (!patient) {
      toast.error("Sign in required")
      return
    }
    setBusyId(claim.id)
    try {
      const sigHash = await sha256Hex(`${claim.id}:${patient.nhia_id}:patient`)
      const { error: err } = await claimsApi.sign(claim.id, "patient", sigHash)
      if (err) throw err
      toast.success("Patient signature recorded")
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Signature failed")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading claims processor…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
            Claims Processor
          </h2>
          <p className="text-sm text-text-muted">
            Handles insurance claims automatically and openly, so less delay and less fraud.
            Every step is timestamped on Hedera.
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
          {error ?? "Sign in to see live insurance claims for your NHIA profile."}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Open claims", n: claims.length, color: "#D4A843" },
          { label: "Awaiting signature", n: pendingSig.length, color: "#F0C96B" },
          { label: "Approved / paid", n: approved.length, color: "#4EC99A" },
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

      <div className="mb-6 overflow-x-auto rounded-xl border border-border-color bg-forest-mid p-5">
        <h3 className="mb-4 font-serif text-base text-text-primary">Open lifecycle</h3>
        <div className="flex min-w-[640px] items-center gap-2">
          {PIPELINE.map((step, i) => (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px]"
                  style={{
                    background: "rgba(78,201,154,0.12)",
                    border: "1px solid rgba(78,201,154,0.3)",
                    color: "#4EC99A",
                  }}
                >
                  {i + 1}
                </div>
                <div className="mt-1.5 text-[10px] text-text-muted">
                  {step.label}
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="mb-4 h-px flex-1 bg-border-color" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-text-muted">
          Provider + patient + HMO must all sign. Smart-contract logic flags duplicates and
          posts a 48-hour SLA. Rejected or disputed claims stay on the audit trail.
          {flagged.length > 0 ? ` ${flagged.length} claim(s) flagged.` : ""}
        </p>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-forest-mid p-10 text-center">
          <Icon name="claims" size={28} color="#9DB8A5" />
          <p className="mt-3 text-sm text-text-primary">No insurance claims yet</p>
          <p className="mt-1 text-xs text-text-muted">
            When a provider files a claim against your NHIA enrollment, it appears here in realtime.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {claims.map((c) => {
            const color = statusColor(c.status, c.sla_breached)
            const step = pipelineIndex(c.status)
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border-color bg-forest-mid p-5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[15px] font-medium text-text-primary">
                    {formatNgn(c.total_amount_ngn)}
                    {c.approved_amount_ngn != null && (
                      <span className="ml-2 text-xs text-mint">
                        approved {formatNgn(c.approved_amount_ngn)}
                      </span>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[10px] capitalize"
                    style={{ background: `${color}22`, color }}
                  >
                    {c.sla_breached ? "SLA breached · " : ""}
                    {c.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mb-3 grid gap-1 text-xs text-text-muted sm:grid-cols-2">
                  <div>Service: {new Date(c.service_date).toLocaleDateString()}</div>
                  <div>ICD-10: {c.icd10_codes?.join(", ") || "—"}</div>
                  <div>Filed {formatRelative(c.created_at)}</div>
                  <div>
                    Deadline:{" "}
                    {c.sla_deadline ? new Date(c.sla_deadline).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="mb-3 flex gap-1">
                  {PIPELINE.map((p, i) => (
                    <div
                      key={p.id}
                      className="h-1 flex-1 rounded-full"
                      style={{
                        background:
                          step >= i ? color : "rgba(78,201,154,0.12)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[10px] text-text-muted">
                    {c.smart_contract_tx_id
                      ? `Hedera ${c.smart_contract_tx_id.slice(0, 18)}…`
                      : "Awaiting on-chain submit"}
                    {c.patient_sig_hash ? " · patient signed" : ""}
                    {c.provider_sig_hash ? " · provider signed" : ""}
                    {c.hmo_sig_hash ? " · HMO signed" : ""}
                  </div>
                  {!c.patient_sig_hash &&
                    ["submitted", "provider_signed", "hmo_review"].includes(c.status) && (
                      <button
                        type="button"
                        disabled={busyId === c.id || !patient}
                        onClick={() => void signAsPatient(c)}
                        className="rounded-md border-none bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest disabled:opacity-50"
                      >
                        {busyId === c.id ? "Signing…" : "Sign as patient"}
                      </button>
                    )}
                </div>
                {c.rejection_reason && (
                  <p className="mt-2 text-xs text-terra">{c.rejection_reason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
