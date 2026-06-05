import { Icon } from "@/components/mediledger/icon"

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

const ACTIVITY = [
  { t: "Lagos University Teaching Hospital", d: "Blood test results uploaded", time: "2h ago", color: "#4EC99A" },
  { t: "Consent Granted", d: "Nigerian Institute of Medical Research", time: "1d ago", color: "#D4A843" },
  { t: "AI Alert", d: "Vitamin D deficiency risk detected", time: "3d ago", color: "#C9572A" },
  { t: "Emergency Tag Updated", d: "Blood type O+ confirmed", time: "5d ago", color: "#4EC99A" },
]

const CONSENT_REQUESTS = [
  { org: "NG Cancer Research Centre", type: "Genomic Data", tokens: "\u20A64,200/mo" },
  { org: "AfDB Health Initiative", type: "Lab Results", tokens: "\u20A61,800/mo" },
]

export function OverviewPage() {
  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="mb-1.5 font-serif text-[clamp(1.6rem,3vw,2.2rem)] text-text-primary">
          Good morning, <span className="text-terra">Augustine</span>
        </h2>
        <p className="text-sm text-text-muted">{"Here\u2019s your health data overview for today."}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="$HEAL Earned" value={"\u20A618,400"} sub={"+\u20A6820 this week"} icon="token" color="#D4A843" delay={0.05} />
        <StatCard label="Active Consents" value="3" sub="2 expiring soon" icon="consent" color="#4EC99A" delay={0.1} />
        <StatCard label="Vault Security" value="100%" sub="ZK proof active" icon="lock" color="#4EC99A" delay={0.15} />
        <StatCard label="AI Insights" value="2 New" sub="Early detection alerts" icon="ai" color="#E8754A" delay={0.2} />
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Recent Vault Activity</h3>
          {ACTIVITY.map((a, i) => (
            <div
              key={i}
              className="mb-3.5 flex gap-3 pb-3.5"
              style={{ borderBottom: i < 3 ? "1px solid rgba(78,201,154,0.18)" : "none" }}
            >
              <div
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: a.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-text-primary">{a.t}</div>
                <div className="mt-0.5 text-xs text-text-muted">{a.d}</div>
              </div>
              <div className="whitespace-nowrap font-mono text-[11px] text-text-muted">{a.time}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border-color bg-forest-mid p-6">
          <h3 className="mb-4 font-serif text-base text-text-primary">Consent Requests</h3>
          {CONSENT_REQUESTS.map((r, i) => (
            <div
              key={i}
              className="mb-3 rounded-lg border border-border-color p-4"
              style={{ background: "rgba(13,43,31,0.72)" }}
            >
              <div className="mb-1 text-sm font-medium text-text-primary">{r.org}</div>
              <div className="mb-3 text-xs text-text-muted">{r.type} access requested</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-gold">{r.tokens}</span>
                <div className="flex gap-2">
                  <button className="rounded-[5px] border border-border-color bg-transparent px-3.5 py-1.5 text-xs text-text-muted">
                    Decline
                  </button>
                  <button className="rounded-[5px] border-none bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest">
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
