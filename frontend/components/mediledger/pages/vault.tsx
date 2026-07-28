"use client"

import { useMemo, useState } from "react"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import {
  formatRelative,
  groupRecordsByType,
  vaultSealStatus,
} from "@/lib/api/patients"
import { recordsApi } from "@/lib/api/records"

export function VaultPage() {
  const { patient, records, loading, error, refresh } = usePatientBundle()
  const seal = vaultSealStatus(patient)
  const groups = useMemo(() => groupRecordsByType(records), [records])
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  const filtered = selectedType
    ? records.filter((r) => r.record_type === selectedType)
    : records

  async function openRecord(storagePath: string, id: string) {
    setBusyId(id)
    setUrlError(null)
    try {
      const { data, error: signedErr } = await recordsApi.getSignedUrl(storagePath)
      if (signedErr || !data?.signedUrl) {
        setUrlError(signedErr?.message ?? "Could not open record (blob may not be uploaded yet)")
        return
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    } catch (e: unknown) {
      setUrlError(e instanceof Error ? e.message : "Failed to open record")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading vault…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
            Health Vault
          </h2>
          <p className="text-sm text-text-muted">
            Encrypted FHIR records with Groth16 integrity proofs on Hedera.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-border-color bg-transparent px-3 py-1.5 text-xs text-text-muted hover:border-mint/30 hover:text-text-primary"
        >
          Refresh
        </button>
      </div>

      {/* Seal status banner */}
      <div
        className="mb-6 rounded-[10px] border p-5"
        style={{
          borderColor: `${seal.color}44`,
          background: `${seal.color}12`,
        }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
            style={{ background: `${seal.color}22`, color: seal.color }}
          >
            {seal.label}
          </span>
          {patient?.nhia_id && (
            <span className="font-mono text-[11px] text-text-muted">
              NHIA {patient.nhia_id}
            </span>
          )}
          {patient?.blood_type && (
            <span className="text-[11px] text-text-muted">
              Blood type {patient.blood_type}
            </span>
          )}
        </div>
        <div className="grid gap-1 font-mono text-[11px] text-text-muted sm:grid-cols-2">
          <div>
            proof: <span className="text-text-primary">{seal.proofPreview}</span>
          </div>
          <div>
            commitment:{" "}
            <span className="text-text-primary">{seal.commitmentPreview}</span>
          </div>
        </div>
        {!seal.sealed && patient && (
          <p className="mt-2 text-xs text-text-muted">
            Upload records and run seal-vault on the backend to activate the ZK proof.
          </p>
        )}
        {!patient && (
          <p className="mt-2 text-xs text-text-muted">
            {error ?? "Sign in with the account linked to your NHIA patient profile."}
          </p>
        )}
      </div>

      {urlError && (
        <div className="mb-4 rounded-md border border-terra/30 bg-terra/10 px-3 py-2 text-xs text-terra">
          {urlError}
        </div>
      )}

      {/* Category cards */}
      {groups.length === 0 ? (
        <div className="rounded-[10px] border border-border-color bg-forest-mid p-10 text-center">
          <Icon name="lock" size={28} color="#9DB8A5" />
          <p className="mt-3 text-sm text-text-primary">No health records yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Records appear here after providers upload FHIR data to your vault.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <button
                key={g.type}
                type="button"
                onClick={() =>
                  setSelectedType((t) => (t === g.type ? null : g.type))
                }
                className="card-hover rounded-[10px] border bg-forest-mid p-[22px] text-left"
                style={{
                  borderColor:
                    selectedType === g.type ? `${g.color}66` : "var(--border-color, #1e3d2f)",
                }}
              >
                <div className="mb-3 flex justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      background: `${g.color}22`,
                      border: `1px solid ${g.color}40`,
                    }}
                  >
                    <Icon name={g.icon} size={17} color={g.color} />
                  </div>
                  <span
                    className="rounded-xl px-2 py-0.5 font-mono text-[10px]"
                    style={{ background: `${g.color}22`, color: g.color }}
                  >
                    {seal.sealed ? "ZK Proven" : "Encrypted"}
                  </span>
                </div>
                <div className="mb-1 text-[15px] font-medium text-text-primary">
                  {g.label}
                </div>
                <div className="text-xs text-text-muted">
                  {g.count} record{g.count === 1 ? "" : "s"} · Updated{" "}
                  {formatRelative(g.latest)}
                </div>
              </button>
            ))}
          </div>

          {/* Record list */}
          <div className="rounded-xl border border-border-color bg-forest-mid p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-base text-text-primary">
                {selectedType
                  ? groups.find((g) => g.type === selectedType)?.label
                  : "All records"}
              </h3>
              <span className="font-mono text-[11px] text-text-muted">
                {filtered.length} item{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="divide-y divide-border-color/40">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text-primary">
                      {r.fhir_resource_type}{" "}
                      <span className="font-mono text-[10px] text-text-muted">
                        · {r.record_type}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-text-muted">
                      hash {r.record_hash.slice(0, 16)}… · {formatRelative(r.created_at)}
                      {r.is_emergency_access ? " · emergency tag" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void openRecord(r.storage_path, r.id)}
                    className="rounded-md border border-border-color bg-transparent px-3 py-1.5 text-[12px] text-text-muted hover:border-mint/30 hover:text-text-primary disabled:opacity-50"
                  >
                    {busyId === r.id ? "Opening…" : "View"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
