"use client"

import { usePatientBundle } from "@/hooks/usePatientBundle"
import { formatRelative } from "@/lib/api/patients"

export function TokensPage() {
  const { patient, tokenTxs, loading, error } = usePatientBundle()
  const heal = patient?.heal_balance ?? 0
  const ngnApprox = heal * 6.5 // display-only rough conversion for UI
  const monthIn = tokenTxs
    .filter((t) => t.status === "confirmed" && t.to_patient_id === patient?.id)
    .reduce((s, t) => s + Number(t.amount_heal), 0)

  if (loading) {
    return (
      <div className="fade-in py-16 text-center text-sm text-text-muted">
        Loading tokens…
      </div>
    )
  }

  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
        $HEAL Token Dashboard
      </h2>
      <p className="mb-7 text-sm text-text-muted">
        Earn tokens when researchers access your anonymized data.
      </p>

      {!patient && (
        <p className="mb-4 text-xs text-text-muted">
          {error ?? "Sign in to see your HEAL balance from Supabase / Hedera cache."}
        </p>
      )}

      <div
        className="mb-6 rounded-[14px] border border-gold/25 p-7"
        style={{
          background:
            "linear-gradient(135deg, rgba(201,87,42,0.13), rgba(212,168,67,0.09))",
        }}
      >
        <div className="mb-2 font-mono text-xs text-gold">TOTAL BALANCE</div>
        <div className="font-serif text-5xl font-bold text-gold">
          {heal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </div>
        <div className="mt-1 text-[13px] text-text-muted">
          ≈ ₦
          {ngnApprox.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Hedera:{" "}
          {patient?.hedera_account_id ?? "not linked"}
        </div>
        {process.env.NEXT_PUBLIC_HEAL_TOKEN_ID && (
          <div className="mt-2 font-mono text-[10px] text-text-muted">
            Token {process.env.NEXT_PUBLIC_HEAL_TOKEN_ID}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Confirmed inflows",
            val: monthIn.toFixed(2),
            change: "HEAL",
            color: "#4EC99A",
          },
          {
            label: "Transactions",
            val: String(tokenTxs.length),
            change: "Ledger rows",
            color: "#D4A843",
          },
          {
            label: "Pending",
            val: String(tokenTxs.filter((t) => t.status === "pending").length),
            change: "Awaiting confirm",
            color: "#C9572A",
          },
        ].map((s, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-border-color bg-forest-mid p-5"
          >
            <div className="mb-2 text-[13px] text-text-muted">{s.label}</div>
            <div className="font-serif text-[28px]" style={{ color: s.color }}>
              {s.val}
            </div>
            <div className="mt-1 text-xs text-text-muted">{s.change}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-color bg-forest-mid p-5">
        <h3 className="mb-4 font-serif text-base text-text-primary">Transaction history</h3>
        {tokenTxs.length === 0 ? (
          <p className="text-xs text-text-muted">
            No token transactions yet. Onboarding bonus and consent payments appear here.
          </p>
        ) : (
          <div className="divide-y divide-border-color/40">
            {tokenTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 font-mono text-[12px]"
              >
                <div>
                  <span className="text-text-primary">{tx.tx_type ?? "transfer"}</span>
                  <span className="ml-2 text-text-muted">
                    {formatRelative(tx.created_at)}
                  </span>
                </div>
                <div className="text-gold">
                  {Number(tx.amount_heal).toFixed(4)} HEAL · {tx.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
