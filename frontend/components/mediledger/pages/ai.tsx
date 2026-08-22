"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { aiApi, type AiInferResponse, type AiInsight } from "@/lib/api/ai"
import { vaultSealStatus } from "@/lib/api/patients"

function severityColor(s: string) {
  if (s === "critical") return "#C9572A"
  if (s === "high") return "#E8754A"
  if (s === "medium") return "#D4A843"
  return "#4EC99A"
}

export function AiPage() {
  const { patient, records, loading: bundleLoading } = usePatientBundle()
  const seal = vaultSealStatus(patient)
  const [result, setResult] = useState<AiInferResponse | null>(null)
  const [running, setRunning] = useState(false)

  const loadCached = useCallback(async () => {
    if (!patient?.nhia_id) return
    const cached = await aiApi.getCachedInsights(patient.nhia_id)
    if (cached) setResult(cached)
  }, [patient?.nhia_id])

  useEffect(() => {
    void loadCached()
  }, [loadCached])

  async function runInference() {
    if (!patient?.nhia_id) {
      toast.error("No patient profile — sign in first")
      return
    }
    if (!seal.sealed) {
      toast.error("Vault must be ZK-sealed before AI inference")
      return
    }
    setRunning(true)
    try {
      const res = await aiApi.infer(patient.nhia_id)
      setResult(res)
      if (res.error) toast.error(res.error)
      else toast.success(`Inference complete · ${res.insights?.length ?? 0} insights`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Inference failed")
    } finally {
      setRunning(false)
    }
  }

  if (bundleLoading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading AI Guardian…
      </div>
    )
  }

  const insights: AiInsight[] = result?.insights ?? []

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
            AI Health Guardian
          </h2>
          <p className="text-sm text-text-muted">
            Uses AI that learns from hospitals without taking raw patient data away from them. Inference only after the vault is ZK-sealed.
          </p>
        </div>
        <button
          type="button"
          disabled={running || !patient}
          onClick={() => void runInference()}
          className="rounded-md border-none bg-gradient-to-br from-mint to-mint-dark px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
        >
          {running ? "Running…" : "Run inference"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[10px] border border-border-color bg-forest-mid p-4">
          <div className="text-xs text-text-muted">Vault gate</div>
          <div className="font-serif text-xl" style={{ color: seal.color }}>
            {seal.label}
          </div>
        </div>
        <div className="rounded-[10px] border border-border-color bg-forest-mid p-4">
          <div className="text-xs text-text-muted">Records in vault</div>
          <div className="font-serif text-xl text-mint">{records.length}</div>
        </div>
        <div className="rounded-[10px] border border-border-color bg-forest-mid p-4">
          <div className="text-xs text-text-muted">Model</div>
          <div className="font-mono text-sm text-text-primary">
            {result?.model_version ?? "—"}
          </div>
        </div>
      </div>

      {result?.error && (
        <div className="mb-4 rounded-md border border-terra/30 bg-terra/10 px-3 py-2 text-xs text-terra">
          {result.error}
          <div className="mt-1 text-text-muted">
            Start AI service (`docker compose up ai-service`) and ensure the vault is sealed.
          </div>
        </div>
      )}

      {result && !result.error && (
        <div className="mb-4 font-mono text-[11px] text-text-muted">
          Last run {result.inference_at ? new Date(result.inference_at).toLocaleString() : "—"}
          {result.hcs_audit_ref ? ` · audit ${result.hcs_audit_ref}` : ""}
          {result.privacy_guarantee?.epsilon != null
            ? ` · ε ≤ ${String(result.privacy_guarantee.epsilon)}`
            : ""}
        </div>
      )}

      {insights.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-forest-mid p-10 text-center">
          <Icon name="ai" size={28} color="#9DB8A5" />
          <p className="mt-3 text-sm text-text-primary">No insights yet</p>
          <p className="mt-1 text-xs text-text-muted">
            {seal.sealed
              ? "Run inference to analyze your sealed vault."
              : "Seal your vault first, then run AI inference."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {insights.map((ins, i) => (
            <div
              key={`${ins.condition}-${i}`}
              className="rounded-xl border border-border-color bg-forest-mid p-5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[15px] font-medium text-text-primary">
                  {ins.display_name ?? ins.condition}
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[10px]"
                  style={{
                    background: `${severityColor(ins.severity)}22`,
                    color: severityColor(ins.severity),
                  }}
                >
                  {ins.severity} · {(ins.confidence * 100).toFixed(0)}%
                </span>
              </div>
              {ins.explanation && (
                <p className="mb-2 text-xs leading-relaxed text-text-muted">
                  {ins.explanation}
                </p>
              )}
              {ins.recommended_action && (
                <p className="text-xs text-mint">{ins.recommended_action}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
