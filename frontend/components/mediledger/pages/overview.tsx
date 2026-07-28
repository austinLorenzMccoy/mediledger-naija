"use client"

import { Icon } from "@/components/mediledger/icon"
import { usePatientBundle } from "@/hooks/usePatientBundle"
import { formatRelative, vaultSealStatus } from "@/lib/api/patients"

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: string
  color: string
  delay?: number
}

function StatCard({ label, value, sub, icon, color, delay = 0 }: StatCardProps) {
  return (
    <div
      className="card-hover count-anim rounded-xl border border-border-color bg-forest-mid p-6"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="mb-4 flex justify-between">
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px]"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          <Icon name={icon} size={18} color={color} />
        </div>
        <span className="font-mono text-[10px] text-text-muted">LIVE</span>
      </div>
      <div className="font-serif text-[26px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[13px] text-text-muted">{label}</div>
      {sub && <div className="mt-1.5 text-[11px] text-mint">{sub}</div>}
    </div>
  )
}

function firstName(fullName?: string | null) {
  if (!fullName) return "there"
  return fullName.split(/\s+/)[0]
}

export function OverviewPage() {
  const { patient, records, consents, tokenTxs, loading, error } = usePatientBundle()
  const seal = vaultSealStatus(patient)

  const activeConsents = consents.filter((c) => c.status === "active")
  const pendingConsents = consents.filter((c) => c.status === "pending")
  const heal = patient?.heal_balance ?? 0
  const healDisplay =
    heal >= 1000 ? `₦${(heal * 6.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${heal.toFixed(2)} HEAL`

  const activity = records.slice(0, 6).map((r) => ({
    t: r.fhir_resource_type,
    d: `${r.record_type} · hash ${r.record_hash.slice(0, 10)}…`,
    time: formatRelative(r.created_at),
    color: r.is_emergency_access ? "#E8754A" : "#4EC99A",
  }))

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading dashboard…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="mb-1.5 font-serif text-[clamp(1.6rem,3vw,2.2rem)] text-text-primary">
          Welcome,{" "}
          <span className="text-terra">{firstName(patient?.full_name)}</span>
        </h2>
        <p className="text-sm text-text-muted">
          {patient
            ? `NHIA ${patient.nhia_id} · vault ${seal.label.toLowerCase()}`
            : error ?? "Sign in to see your live health overview."}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="$HEAL Balance"
          value={patient ? healDisplay : "—"}
          sub={patient ? `${heal.toFixed(4)} HEAL on-chain cache` : "Link wallet & profile"}
          icon="token"
          color="#D4A843"
          delay={0.05}
        />
        <StatCard
          label="Active Consents"
          value={String(activeConsents.length)}
          sub={
            pendingConsents.length
              ? `${pendingConsents.length} pending request${pendingConsents.length === 1 ? "" : "s"}`
              : "No pending requests"
          }
          icon="consent"
          color="#4EC99A"
          delay={0.1}
        />
        <StatCard
          label="Vault Security"
          value={seal.sealed ? "Sealed" : patient ? "Open" : "—"}
          sub={seal.sealed ? "ZK proof active" : "Awaiting seal"}
          icon="lock"
          color={seal.color}
          delay={0.15}
        />
        <StatCard
          label="Health Records"
          value={String(records.length)}
          sub={records[0] ? `Latest ${formatRelative(records[0].created_at)}` : "None yet"}
          icon="ai"
          color="#E8754A"
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Recent Vault Activity</h3>
          {activity.length === 0 ? (
            <p className="text-xs text-text-muted">No record activity yet.</p>
          ) : (
            activity.map((a, i) => (
              <div
                key={i}
                className="mb-3.5 flex gap-3 pb-3.5"
                style={{
                  borderBottom:
                    i < activity.length - 1 ? "1px solid rgba(78,201,154,0.18)" : "none",
                }}
              >
                <div
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: a.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-text-primary">{a.t}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{a.d}</div>
                </div>
                <div className="whitespace-nowrap font-mono text-[11px] text-text-muted">
                  {a.time}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Consent Requests</h3>
          {pendingConsents.length === 0 && activeConsents.length === 0 ? (
            <p className="text-xs text-text-muted">
              No consent agreements yet. Providers will appear here when they request access.
            </p>
          ) : (
            [...pendingConsents, ...activeConsents].slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="mb-3 rounded-lg border border-border-color p-4"
                style={{ background: "rgba(13,43,31,0.72)" }}
              >
                <div className="mb-1 text-sm font-medium text-text-primary">
                  {c.purpose || "Data access"}
                </div>
                <div className="mb-3 text-xs text-text-muted">
                  {c.requester_type ?? "requester"} · {c.status}
                  {c.valid_until ? ` · until ${new Date(c.valid_until).toLocaleDateString()}` : ""}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gold">
                    {Number(c.monthly_payment_heal).toFixed(2)} HEAL/mo
                  </span>
                  <span
                    className="rounded px-2 py-0.5 font-mono text-[10px]"
                    style={{
                      background: c.status === "active" ? "#4EC99A22" : "#D4A84322",
                      color: c.status === "active" ? "#4EC99A" : "#D4A843",
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            ))
          )}

          {tokenTxs.length > 0 && (
            <div className="mt-5 border-t border-border-color/40 pt-4">
              <h4 className="mb-2 text-xs font-medium text-text-muted">Recent HEAL txs</h4>
              {tokenTxs.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="mb-2 flex justify-between font-mono text-[11px] text-text-muted"
                >
                  <span>{tx.tx_type ?? "transfer"}</span>
                  <span className="text-gold">
                    {Number(tx.amount_heal).toFixed(2)} · {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
