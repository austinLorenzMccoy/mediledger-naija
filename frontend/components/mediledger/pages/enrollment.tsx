"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { verifyEnrollment, type EnrollmentCheck } from "@/lib/api/enrollment"

export function EnrollmentPage() {
  const { patient, loading, error } = usePatientBundle()
  const [nhiaId, setNhiaId] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EnrollmentCheck | null>(null)

  useEffect(() => {
    if (patient?.nhia_id) setNhiaId(patient.nhia_id)
  }, [patient?.nhia_id])

  async function verify() {
    setBusy(true)
    try {
      const check = await verifyEnrollment(nhiaId, patient)
      setResult(check)
      if (check.isActive) toast.success(`Verified in ${check.elapsedMs.toFixed(2)} ms`)
      else if (patient) toast.error("No active enrollment visible for this ID")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading enrollment verifier…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
        Enrollment Verifier
      </h2>
      <p className="mb-7 text-sm text-text-muted">
        Checks NHIA status instantly, so no more weeks of waiting. Only hashed identifiers
        go on Hedera — never the raw record.
      </p>

      {!patient && (
        <p className="mb-4 text-xs text-text-muted">
          {error ?? "Sign in to confirm live NHIA enrollment against your patient profile."}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Instant NHIA check</h3>
          <label className="mb-1.5 block text-xs text-text-muted">NHIA ID</label>
          <input
            value={nhiaId}
            onChange={(e) => setNhiaId(e.target.value)}
            placeholder="NHIA-XXXX-001"
            className="mb-4 w-full rounded-md border border-border-color bg-transparent px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-mint/40"
          />
          <button
            type="button"
            disabled={busy || !nhiaId.trim()}
            onClick={() => void verify()}
            className="w-full rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-2.5 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {busy ? "Checking…" : "Verify now"}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
            Feature phones can run the same check over USSD <span className="font-mono text-mint">*384*NHIA#</span>.
            The smart contract returns active / expired / suspended without opening the vault.
          </p>
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Result</h3>
          {!result ? (
            <div className="text-center">
              <Icon name="shield" size={28} color="#9DB8A5" />
              <p className="mt-3 text-xs text-text-muted">
                Run a check to see program, HMO hash, and query time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
                  style={{
                    background: result.isActive ? "#4EC99A22" : "#C9572A22",
                    color: result.isActive ? "#4EC99A" : "#C9572A",
                  }}
                >
                  {result.isActive ? "ACTIVE" : "NOT ACTIVE"}
                </span>
                <span className="font-mono text-[11px] text-gold">
                  {result.elapsedMs.toFixed(2)} ms
                </span>
              </div>
              <div className="rounded-lg border border-border-color/60 p-3 font-mono text-[11px] text-text-muted">
                <div>NHIA: {result.nhiaId || "—"}</div>
                <div>Program: {result.program?.name ?? "—"}</div>
                <div>Valid until: {result.validUntil ? new Date(result.validUntil).toLocaleDateString() : "—"}</div>
                <div className="mt-2 break-all">patientHash: 0x{result.patientHash.slice(0, 24)}…</div>
                <div className="break-all">hmoHash: 0x{result.hmoHash.slice(0, 24)}…</div>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">{result.reason}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Paper verification", value: "Weeks", sub: "The status quo" },
          { label: "This query", value: result ? `${result.elapsedMs.toFixed(1)} ms` : "< 1 s", sub: "Hedera + hashed ID" },
          { label: "On-chain data", value: "Hashes only", sub: "NDPA 2023 aligned" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[10px] border border-border-color bg-forest-mid p-4"
          >
            <div className="text-xs text-text-muted">{s.label}</div>
            <div className="font-serif text-xl text-mint">{s.value}</div>
            <div className="mt-1 text-[11px] text-text-muted">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
