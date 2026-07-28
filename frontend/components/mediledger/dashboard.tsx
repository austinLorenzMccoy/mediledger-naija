"use client"

import { useState, useEffect } from "react"
import { Icon } from "@/components/mediledger/icon"
import { WalletButton } from "@/components/mediledger/wallet-button"
import { Sidebar } from "@/components/mediledger/sidebar"
import { OverviewPage } from "@/components/mediledger/pages/overview"
import { VaultPage } from "@/components/mediledger/pages/vault"
import { TokensPage } from "@/components/mediledger/pages/tokens"
import { SettingsPage } from "@/components/mediledger/pages/settings"
import { ConsentPage } from "@/components/mediledger/pages/consent"
import { AiPage } from "@/components/mediledger/pages/ai"
import { EmergencyPage } from "@/components/mediledger/pages/emergency"
import { NAV_ITEMS, SIDEBAR_OPEN, SIDEBAR_CLOSED, type NavItemId, type WalletAccount } from "@/lib/mediledger"
import { useAuth } from "@/contexts/AuthContext"

interface DashboardProps {
  onGoHome: () => void
  wallet: WalletAccount | null
  onOpenWallet: () => void
  onDisconnectWallet: () => void
}

export function Dashboard({ onGoHome, wallet, onOpenWallet, onDisconnectWallet }: DashboardProps) {
  const { user, signOut } = useAuth()
  const [active, setActive] = useState<NavItemId>("overview")
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ml_sidebar_collapsed") === "true"
    } catch {
      return false
    }
  })
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = (
    user?.user_metadata?.full_name ||
    user?.email ||
    wallet?.accountId ||
    "ML"
  )
    .toString()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("") || "ML"

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const sidebarWidth = isMobile ? 0 : collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN

  const renderPage = () => {
    switch (active) {
      case "overview":
        return <OverviewPage wallet={wallet} />
      case "vault":
        return <VaultPage />
      case "tokens":
        return <TokensPage />
      case "settings":
        return (
          <SettingsPage
            wallet={wallet}
            onOpenWallet={onOpenWallet}
            onDisconnectWallet={onDisconnectWallet}
          />
        )
      case "consent":
        return <ConsentPage />
      case "ai":
        return <AiPage />
      case "emergency":
        return <EmergencyPage />
      default:
        return <OverviewPage wallet={wallet} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={active}
        setActive={setActive}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onGoHome={onGoHome}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        wallet={wallet}
      />
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-[90] flex h-16 items-center justify-between border-b border-border-color bg-ink px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="flex border-none bg-transparent p-1 text-text-muted"
              >
                <Icon name="menu" size={22} />
              </button>
            )}
            <span className="font-serif text-lg font-semibold text-text-primary">
              {NAV_ITEMS.find((n) => n.id === active)?.label || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <WalletButton wallet={wallet} onOpen={onOpenWallet} onDisconnect={onDisconnectWallet} compact />
            <div className="relative" title="Notifications (live toasts on data changes)">
              <Icon name="notification" size={20} color="#9DB8A5" />
            </div>
            <button
              type="button"
              title={user?.email ?? "Not signed in"}
              onClick={() => {
                if (user) void signOut()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border-none text-[11px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #C9572A, #D4A843)" }}
            >
              {initials}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="w-full max-w-[1200px] flex-1 px-5 py-8 md:px-7">
          {/* Wallet connection banner */}
          {!wallet && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-terra/25 bg-terra/8 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Icon name="lock" size={16} color="#C9572A" />
                <span className="text-[13px] text-text-primary">
                  Connect your HashPack wallet to sign transactions and access your full health vault.
                </span>
              </div>
              <button
                onClick={onOpenWallet}
                className="whitespace-nowrap rounded-md border-none bg-gradient-to-br from-mint to-mint-dark px-[18px] py-2 text-[13px] font-semibold text-forest"
              >
                Connect Now
              </button>
            </div>
          )}
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
