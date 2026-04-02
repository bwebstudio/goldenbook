"use client";

import LogoutButton from "@/components/auth/LogoutButton";
import { canAccessPath, isBusinessClient } from "@/lib/auth/permissions";
import { useT, useLocale, type Locale } from "@/lib/i18n";
import { fetchReviewCount } from "@/lib/api/review-queue";
import type { DashboardUser } from "@/types/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const iconSvg = {
  grid: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  pin: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  route: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  tag: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  megaphone: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  star: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
};

const adminNavDefs = [
  { key: "dashboard", href: "/dashboard", icon: iconSvg.grid },
  { key: "places", href: "/places", icon: iconSvg.pin },
  { key: "campaigns", href: "/campaigns", icon: iconSvg.megaphone },
  { key: "routes", href: "/routes", icon: iconSvg.route },
  { key: "analytics", href: "/analytics", icon: iconSvg.chart },
  { key: "categories", href: "/categories", icon: iconSvg.tag },
  { key: "review", href: "/review-queue", icon: iconSvg.clipboard },
  { key: "pricing", href: "/pricing", icon: iconSvg.star },
  { key: "users", href: "/users", icon: iconSvg.users },
  { key: "settings", href: "/settings", icon: iconSvg.settings },
] as const;

function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const toggle = () => setLocale(locale === "en" ? "pt" : "en");
  return (
    <button onClick={toggle} className="w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:bg-[#F5F1EB] hover:text-text transition-colors cursor-pointer flex items-center gap-3" title={locale === "en" ? "Mudar para Português" : "Switch to English"}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
      <span>{locale === "en" ? "Português" : "English"}</span>
    </button>
  );
}

export default function Sidebar({ currentUser }: { currentUser: DashboardUser }) {
  const pathname = usePathname();
  const t = useT();

  const [reviewCount, setReviewCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (isBusinessClient(currentUser.role)) return;
    const refresh = () => fetchReviewCount().then(setReviewCount).catch(() => {});
    refresh();
    window.addEventListener('review-count-changed', refresh);
    return () => window.removeEventListener('review-count-changed', refresh);
  }, [currentUser.role]);

  if (isBusinessClient(currentUser.role)) return null;

  const empNav = t.employeeNav as Record<string, string>;
  const navItems = adminNavDefs.map((d) => ({
    label: empNav[d.key] ?? d.key,
    href: d.href,
    icon: d.icon,
    badge: d.key === "review" && reviewCount > 0 ? reviewCount : undefined,
  }));
  const allowedItems = navItems.filter((item) => canAccessPath(currentUser.role, item.href));

  const navContent = (
    <>
      <div className="px-6 lg:px-8 py-5 lg:py-8 border-b border-border flex items-center justify-between">
        <span className="text-xl lg:text-2xl font-bold tracking-tight text-text">
          <span className="hidden lg:inline">Golden<span className="text-gold">book</span> Go</span>
          <span className="lg:hidden">GB <span className="text-gold">Go</span></span>
        </span>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-muted hover:text-text cursor-pointer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <nav className="flex-1 px-3 lg:px-4 py-4 lg:py-6 flex flex-col gap-0.5 overflow-y-auto">
        {allowedItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 lg:gap-4 px-4 py-3 lg:py-4 rounded-xl text-base lg:text-lg font-medium transition-colors ${isActive ? "bg-gold text-white" : "text-muted hover:bg-[#F5F1EB] hover:text-text"}`}>
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{item.badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 lg:px-4 py-4 border-t border-border flex flex-col gap-1">
        <LanguageSwitch />
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3.5 left-3 z-40 p-2 rounded-xl bg-white border border-border shadow-sm text-text hover:bg-[#F5F1EB] cursor-pointer"
        aria-label="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-white border-r border-border flex-col shrink-0">
        {navContent}
      </aside>
    </>
  );
}
