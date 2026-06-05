"use client"

import { useState, useEffect } from "react"
import { Icon } from "@/components/mediledger/icon"
import { WalletButton } from "@/components/mediledger/wallet-button"
import type { WalletAccount } from "@/lib/mediledger"

interface LandingPageProps {
  onEnter: () => void
  wallet: WalletAccount | null
  onOpenWallet: () => void
  onDisconnectWallet: () => void
}

const FEATURES = [
  {
    icon: "lock",
    title: "ZK Health Vaults",
    desc: "Prove medical conditions without revealing records. AES-256 + zk-SNARKs keep your data mathematically secure.",
    color: "#4EC99A",
  },
  {
    icon: "token",
    title: "Earn $HEAL Tokens",
    desc: "Get paid in Hedera tokens when researchers access your anonymized data. Your records, your revenue.",
    color: "#D4A843",
  },
  {
    icon: "chart",
    title: "AI Diagnostics",
    desc: "Federated learning across 10,000+ patient records delivers early disease detection without data exposure.",
    color: "#C9572A",
  },
  {
    icon: "emergency",
    title: "Emergency Protocol",
    desc: "Critical data like blood type and allergies broadcast to nearby hospitals in under 300ms during emergencies.",
    color: "#E8754A",
  },
  {
    icon: "globe",
    title: "HL7 FHIR Standard",
    desc: "Interoperable with 190+ countries' health systems using global healthcare data standards.",
    color: "#F0C96B",
  },
]

const METRICS = [
  { v: "200K+", l: "Patients Onboarded" },
  { v: "\u20A62.1B", l: "Data Revenue Distributed" },
  { v: "47", l: "Partner Hospitals" },
  { v: "99.98%", l: "Uptime Guaranteed" },
]

export function LandingPage({ onEnter, wallet, onOpenWallet, onDisconnectWallet }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])

  return (
    <div className="min-h-screen font-sans">
      {/* NAV */}
      <nav
        className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between px-4 py-4 transition-all duration-300 md:px-10"
        style={{
          background: scrolled ? "rgba(13,43,31,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(78,201,154,0.18)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src="/mediledger-nigeria-logo.svg"
            alt="MediLedger Nigeria"
            className="h-9 w-auto"
          />
          <span className="font-serif text-xl font-semibold tracking-wide text-text-primary">
            MediLedger<span className="text-terra">NG</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hide-mobile">
            <WalletButton wallet={wallet} onOpen={onOpenWallet} onDisconnect={onDisconnectWallet} />
          </span>
          <button
            onClick={onEnter}
            className="rounded-md border-none bg-terra px-4 py-2 text-sm font-semibold text-white md:px-6"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="hero-bg adire-bg relative flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-32 text-center"
      >
        {/* Adire diamond decoration */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%234EC99A' stroke-width='0.4' opacity='0.08'%3E%3Cpolygon points='40,4 76,40 40,76 4,40'/%3E%3Cpolygon points='40,16 64,40 40,64 16,40'/%3E%3Cpolygon points='40,28 52,40 40,52 28,40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="fade-in mb-4" style={{ animationDelay: "0.1s" }}>
          <span className="rounded-full border border-mint px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[3px] text-mint opacity-85">
            Powered by Hedera &middot; Built for Nigeria
          </span>
        </div>

        <h1
          className="fade-in mb-6 max-w-[820px] font-serif text-[clamp(2.6rem,7vw,5.5rem)] font-bold leading-[1.12]"
          style={{ animationDelay: "0.2s" }}
        >
          Your Health Records.
          <br />
          <span className="text-terra">Your Sovereignty.</span>
          <br />
          <span className="text-mint">Your Economy.</span>
        </h1>

        <p
          className="fade-in mb-10 max-w-[560px] text-[17px] leading-relaxed text-text-muted"
          style={{ animationDelay: "0.35s" }}
        >
          {"Nigeria\u2019s first decentralized health data ecosystem \u2014 secured by zero-knowledge proofs, governed by patients, and powered by Hedera blockchain."}
        </p>

        <div
          className="fade-in flex flex-wrap justify-center gap-3.5"
          style={{ animationDelay: "0.45s" }}
        >
          <button
            onClick={onEnter}
            className="flex items-center gap-2 rounded-lg border-none px-9 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.04]"
            style={{
              background: "linear-gradient(135deg, #C9572A, #E8754A)",
              boxShadow: "0 8px 32px rgba(201,87,42,0.4)",
            }}
          >
            Enter Dashboard <Icon name="arrow" size={16} color="#fff" />
          </button>
          <button className="rounded-lg border border-border-color bg-transparent px-9 py-3.5 text-base text-text-primary">
            View Whitepaper
          </button>
        </div>

        {/* Metrics strip */}
        <div
          className="fade-in mt-[72px] flex flex-wrap justify-center overflow-hidden rounded-xl border border-border-color"
          style={{
            animationDelay: "0.6s",
            background: "rgba(13,43,31,0.72)",
            backdropFilter: "blur(12px)",
          }}
        >
          {METRICS.map((m, i) => (
            <div
              key={i}
              className="px-9 py-6 text-center"
              style={{
                borderRight: i < 3 ? "1px solid rgba(78,201,154,0.18)" : "none",
              }}
            >
              <div className="font-serif text-[28px] font-bold text-gold">{m.v}</div>
              <div className="mt-1 text-xs tracking-wide text-text-muted">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="adire-bg bg-forest-mid px-6 py-24 md:px-10">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-serif text-[clamp(2rem,4vw,3rem)] text-text-primary">
              {"Built for "}
              <span className="text-terra">{"Africa\u2019s"}</span>
              {" Healthcare Future"}
            </h2>
            <p className="mx-auto max-w-[500px] text-base text-text-muted">
              Five pillars that protect your most sensitive data while unlocking its economic potential.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card-hover rounded-xl border border-border-color p-7"
                style={{
                  background: "rgba(13,43,31,0.72)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px]"
                  style={{
                    background: `${f.color}22`,
                    border: `1px solid ${f.color}44`,
                  }}
                >
                  <Icon name={f.icon} size={20} color={f.color} />
                </div>
                <h3 className="mb-2.5 font-serif text-lg text-text-primary">{f.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="relative overflow-hidden px-6 py-20 text-center md:px-10"
        style={{ background: "linear-gradient(135deg, #0D2B1F 0%, #1F5233 100%)" }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,87,42,0.09), transparent 70%)" }}
        />
        <h2 className="relative mb-4 font-serif text-[clamp(1.8rem,4vw,2.8rem)] text-text-primary">
          Ready to own your health data?
        </h2>
        <p className="relative mb-9 text-text-muted">
          Join 200,000+ Nigerians already on the ecosystem.
        </p>
        <button
          onClick={onEnter}
          className="relative rounded-lg border-none px-12 py-4 text-base font-bold text-forest"
          style={{
            background: "linear-gradient(135deg, #4EC99A, #2A8C68)",
            boxShadow: "0 8px 32px rgba(78,201,154,0.35)",
          }}
        >
          {"Get Started Free \u2192"}
        </button>
      </section>

      {/* FOOTER */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border-color bg-ink px-6 py-10 md:px-10">
        <div className="font-serif text-lg text-text-primary">
          MediLedger<span className="text-terra">NG</span>
        </div>
        <div className="text-[13px] text-text-muted">
          {"© 2025 MediLedger Nigeria. Built on Hedera. NDPR & HIPAA Compliant."}
        </div>
        <div className="flex gap-5">
          {["Privacy", "Terms", "Docs", "GitHub"].map((l) => (
            <span key={l} className="cursor-pointer text-[13px] text-text-muted hover:text-text-primary">
              {l}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
