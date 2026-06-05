export function TokensPage() {
  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">
        $HEAL Token Dashboard
      </h2>
      <p className="mb-7 text-sm text-text-muted">
        Earn tokens when researchers access your anonymized data.
      </p>

      <div
        className="mb-6 rounded-[14px] border border-gold/25 p-7"
        style={{ background: "linear-gradient(135deg, rgba(201,87,42,0.13), rgba(212,168,67,0.09))" }}
      >
        <div className="mb-2 font-mono text-xs text-gold">TOTAL BALANCE</div>
        <div className="font-serif text-5xl font-bold text-gold">{"\u20A618,400"}</div>
        <div className="mt-1 text-[13px] text-text-muted">
          {"≈ 2,840 $HEAL · Hedera ID: 0.0.4829102"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "This Month", val: "\u20A6820", change: "+12%", color: "#4EC99A" },
          { label: "Active Streams", val: "3", change: "Ongoing", color: "#D4A843" },
          { label: "Pending Payout", val: "\u20A61,200", change: "In 2 days", color: "#C9572A" },
        ].map((s, i) => (
          <div key={i} className="rounded-[10px] border border-border-color bg-forest-mid p-5">
            <div className="mb-2 text-[13px] text-text-muted">{s.label}</div>
            <div className="font-serif text-[28px]" style={{ color: s.color }}>
              {s.val}
            </div>
            <div className="mt-1 text-xs text-text-muted">{s.change}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
