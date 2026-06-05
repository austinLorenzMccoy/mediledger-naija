import { Icon } from "@/components/mediledger/icon"

const VAULT_ITEMS = [
  { cat: "Laboratory Results", count: 12, updated: "2 days ago", icon: "chart", color: "#4EC99A", proof: "ZK Proven" },
  { cat: "Imaging & Scans", count: 4, updated: "1 week ago", icon: "ai", color: "#D4A843", proof: "Encrypted" },
  { cat: "Prescriptions", count: 8, updated: "3 days ago", icon: "lock", color: "#C9572A", proof: "ZK Proven" },
  { cat: "Genomic Data", count: 1, updated: "2 months ago", icon: "shield", color: "#F0C96B", proof: "Encrypted" },
  { cat: "Allergies & Tags", count: 5, updated: "Today", icon: "emergency", color: "#E8754A", proof: "Public Tag" },
  { cat: "Vaccinations", count: 9, updated: "6 months ago", icon: "consent", color: "#4EC99A", proof: "Verified" },
]

export function VaultPage() {
  return (
    <div className="fade-in">
      <h2 className="mb-2 font-serif text-[clamp(1.6rem,3vw,2rem)] text-text-primary">Health Vault</h2>
      <p className="mb-7 text-sm text-text-muted">
        Your encrypted medical records secured with zk-SNARKs on Hedera.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VAULT_ITEMS.map((v, i) => (
          <div
            key={i}
            className="card-hover rounded-[10px] border border-border-color bg-forest-mid p-[22px]"
          >
            <div className="mb-3 flex justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${v.color}22`, border: `1px solid ${v.color}40` }}
              >
                <Icon name={v.icon} size={17} color={v.color} />
              </div>
              <span
                className="rounded-xl px-2 py-0.5 font-mono text-[10px]"
                style={{ background: `${v.color}22`, color: v.color }}
              >
                {v.proof}
              </span>
            </div>
            <div className="mb-1 text-[15px] font-medium text-text-primary">{v.cat}</div>
            <div className="text-xs text-text-muted">
              {v.count} records &middot; Updated {v.updated}
            </div>
            <button className="mt-3.5 w-full rounded-md border border-border-color bg-transparent py-2 text-[13px] text-text-muted hover:border-mint/30 hover:text-text-primary">
              View Records
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
