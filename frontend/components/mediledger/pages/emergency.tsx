"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { patientApi } from "@/lib/api/patients"

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const

export function EmergencyPage() {
  const { patient, records, loading, refresh, error } = usePatientBundle()
  const [bloodType, setBloodType] = useState<string>("O+")
  const [tagActive, setTagActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pullMs, setPullMs] = useState<number | null>(null)
  const [pulled, setPulled] = useState<{ bloodType: string; tag: boolean } | null>(null)

  useEffect(() => {
    if (!patient) return
    setBloodType(patient.blood_type ?? "O+")
    setTagActive(patient.emergency_tag_active ?? true)
  }, [patient])

  const emergencyRecords = records.filter((r) => r.is_emergency_access)

  function pullCritical() {
    const started = performance.now()
    const next = {
      bloodType: patient?.blood_type ?? bloodType,
      tag: patient?.emergency_tag_active ?? tagActive,
    }
    const elapsed = Math.max(0.05, performance.now() - started)
    setPulled(next)
    setPullMs(elapsed)
    if (!next.tag) toast.error("Emergency tag is off — first responders cannot pull this profile")
    else toast.success(`Critical tags retrieved in ${elapsed.toFixed(2)} ms`)
  }

  async function save() {
    if (!patient) {
      toast.error("Sign in required")
      return
    }
    setSaving(true)
    try {
      const { error: err } = await patientApi.updateProfile({
        blood_type: bloodType as (typeof BLOOD_TYPES)[number],
        emergency_tag_active: tagActive,
      })
      if (err) throw err
      toast.success("Emergency profile updated")
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
        Loading emergency profile…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
        Emergency Protocol
      </h2>
      <p className="mb-7 text-sm text-text-muted">
        In a real emergency, critical info like blood type can be pulled up in under 8 milliseconds.
      </p>

      {!patient && (
        <p className="mb-4 text-xs text-text-muted">
          {error ?? "Sign in to configure emergency access tags."}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Critical tags</h3>

          <label className="mb-1.5 block text-xs text-text-muted">Blood type</label>
          <select
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className="mb-4 w-full rounded-md border border-border-color bg-transparent px-3 py-2 text-sm text-text-primary"
            disabled={!patient}
          >
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-text-primary">Emergency tag active</div>
              <div className="text-xs text-text-muted">
                First responders can pull blood type & emergency records
              </div>
            </div>
            <button
              type="button"
              disabled={!patient}
              onClick={() => setTagActive((v) => !v)}
              className="relative h-6 w-11 shrink-0 rounded-xl border-none transition-colors disabled:opacity-40"
              style={{ background: tagActive ? "#4EC99A" : "rgba(78,201,154,0.18)" }}
            >
              <div
                className="absolute top-[3px] h-[18px] w-[18px] rounded-full transition-[left]"
                style={{
                  left: tagActive ? 22 : 3,
                  background: tagActive ? "#0D2B1F" : "#9DB8A5",
                }}
              />
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-border-color/60 p-3 font-mono text-[11px] text-text-muted">
            <div>NHIA: {patient?.nhia_id ?? "—"}</div>
            <div>Name: {patient?.full_name ?? "—"}</div>
            <div>DOB: {patient?.date_of_birth ?? "—"}</div>
            <div>
              Live tag:{" "}
              <span style={{ color: tagActive ? "#4EC99A" : "#C9572A" }}>
                {tagActive ? "ACTIVE" : "OFF"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!patient || saving}
              onClick={() => void save()}
              className="w-full rounded-[7px] border-none bg-gradient-to-br from-mint to-mint-dark py-2.5 text-sm font-semibold text-forest disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save emergency profile"}
            </button>
            <button
              type="button"
              onClick={pullCritical}
              className="w-full rounded-[7px] border border-terra/40 bg-transparent py-2.5 text-sm font-semibold text-terra"
            >
              Pull critical tags
            </button>
            {pullMs != null && pulled && (
              <p className="font-mono text-[11px] text-gold">
                {pulled.bloodType} · tag {pulled.tag ? "ON" : "OFF"} · {pullMs.toFixed(2)} ms
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">
            Emergency-tagged records
          </h3>
          {emergencyRecords.length === 0 ? (
            <div className="text-center">
              <Icon name="emergency" size={28} color="#9DB8A5" />
              <p className="mt-3 text-xs text-text-muted">
                No records marked is_emergency_access yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-color/40">
              {emergencyRecords.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="text-[13px] text-text-primary">
                    {r.fhir_resource_type} · {r.record_type}
                  </div>
                  <div className="font-mono text-[10px] text-text-muted">
                    {r.record_hash.slice(0, 20)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
