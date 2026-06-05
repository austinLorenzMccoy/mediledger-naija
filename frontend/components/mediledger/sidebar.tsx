"use client"

import { Icon } from "@/components/mediledger/icon"
import { NAV_ITEMS, SIDEBAR_OPEN, SIDEBAR_CLOSED, type NavItemId } from "@/lib/mediledger"

interface SidebarProps {
  active: NavItemId
  setActive: (id: NavItemId) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onGoHome: () => void
  isMobile: boolean
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

export function Sidebar({
  active,
  setActive,
  collapsed,
  setCollapsed,
  onGoHome,
  isMobile,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const width = collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[149] bg-black/60"
        />
      )}
      <div
        className="fixed left-0 top-0 z-[150] flex min-h-screen flex-col overflow-hidden border-r border-border-color bg-ink"
        style={{
          width: isMobile ? SIDEBAR_OPEN : width,
          transition: isMobile
            ? "transform 0.32s cubic-bezier(0.4,0,0.2,1)"
            : "width 0.32s cubic-bezier(0.4,0,0.2,1)",
          transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : undefined,
        }}
      >
        {/* Logo */}
        <div
          className="flex min-h-16 items-center gap-2.5 overflow-hidden border-b border-border-color px-4 py-5"
        >
          <img
            src="/mediledger-nigeria-logo.svg"
            alt="MediLedger Nigeria"
            className="h-8 w-auto cursor-pointer"
            onClick={onGoHome}
          />
          {!collapsed && (
            <span className="fade-in overflow-hidden whitespace-nowrap font-serif text-[17px] font-semibold text-text-primary">
              MediLedger<span className="text-terra">NG</span>
            </span>
          )}
          {!isMobile && (
            <button
              onClick={() => {
                const next = !collapsed
                setCollapsed(next)
                try {
                  localStorage.setItem("ml_sidebar_collapsed", String(next))
                } catch {
                  /* noop */
                }
              }}
              className="ml-auto flex shrink-0 rounded border-none bg-transparent p-1 text-text-muted"
            >
              <Icon name={collapsed ? "expand" : "collapse"} size={16} />
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto flex border-none bg-transparent p-1 text-text-muted"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Home link */}
        <button
          onClick={onGoHome}
          className="mx-2.5 mt-3 mb-1 flex items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg border border-dashed border-border-color bg-transparent px-3 py-2.5 text-left text-[13px] text-text-muted transition-all hover:border-mint hover:text-mint"
        >
          <Icon name="home" size={16} />
          {!collapsed && <span>{"<- Back to Home"}</span>}
        </button>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActive(item.id)
                  if (isMobile) setMobileOpen(false)
                }}
                className="mb-0.5 flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
                style={{
                  background: isActive ? "rgba(78,201,154,0.08)" : "transparent",
                  borderColor: isActive ? "rgba(78,201,154,0.19)" : "transparent",
                  color: isActive ? "#4EC99A" : "#9DB8A5",
                }}
              >
                <div className="flex shrink-0">
                  <Icon name={item.icon} size={18} />
                </div>
                {!collapsed && (
                  <span className="fade-in">{item.label}</span>
                )}
                {!collapsed && item.id === "emergency" && (
                  <span className="pulse-badge ml-auto h-[7px] w-[7px] shrink-0 rounded-full bg-terra" />
                )}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2.5 overflow-hidden border-t border-border-color px-2.5 py-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #C9572A, #D4A843)" }}
          >
            AO
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="whitespace-nowrap text-[13px] font-medium text-text-primary">
                Augustine Chibueze
              </div>
              <div className="font-mono text-[10px] text-mint">ID: 0.0.4829102</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
