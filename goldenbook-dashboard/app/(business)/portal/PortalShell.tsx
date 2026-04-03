"use client";

import type { DashboardUser } from "@/types/auth";
import { useT, useLocale, type Locale } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";
import PlaceSelector from "@/components/ui/PlaceSelector";
import NotificationBell from "@/components/ui/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

function Initials({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#D2B68A] flex items-center justify-center shrink-0">
      <span className="text-white font-semibold text-xs">{initials}</span>
    </div>
  );
}

function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const toggle = () => setLocale(locale === "en" ? "pt" : "en");
  return (
    <button
      onClick={toggle}
      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-[#6B6B7B] hover:text-[#222D52] hover:bg-[#F9F7F2] transition-colors cursor-pointer"
      title={locale === "en" ? "Mudar para Português" : "Switch to English"}
    >
      {locale === "en" ? "PT" : "EN"}
    </button>
  );
}

function UserMenu({ name, t }: { name: string; t: ReturnType<typeof useT> }) {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  const menuItem = "w-full text-left px-3 py-2 text-sm text-[#6B6B7B] hover:text-[#222D52] hover:bg-[#F9F7F2] transition-colors cursor-pointer flex items-center gap-2.5";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 cursor-pointer">
        <span className="text-sm font-medium text-[#222D52] hidden lg:block leading-tight">{name}</span>
        <Initials name={name} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl border border-[#EDE9E3] shadow-lg py-1 w-52 z-50">
            <div className="px-3 py-2.5 border-b border-[#EDE9E3]">
              <p className="text-sm font-medium text-[#222D52] truncate">{name}</p>
            </div>

            <Link href="/portal/notifications" onClick={() => setOpen(false)} className={menuItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {t.accountMenu.notifications}
            </Link>

            <Link href="/portal/billing" onClick={() => setOpen(false)} className={menuItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              {t.portalNav.billing}
            </Link>

            <button onClick={() => { setLocale(locale === "en" ? "pt" : "en"); setOpen(false); }} className={menuItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              {t.common.language}: {locale === "en" ? "Português" : "English"}
            </button>

            <div className="border-t border-[#EDE9E3] mt-1 pt-1">
              <button onClick={handleLogout} disabled={loggingOut} className={`${menuItem} disabled:opacity-50`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {t.common.logout}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const navIcons = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  listing: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>,
  analytics: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  promote: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  campaigns: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  billing: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
};

export default function PortalShell({ user, children }: { user: DashboardUser; children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();

  const navItems = [
    { label: t.portalNav.overview, href: "/portal", icon: navIcons.overview },
    { label: t.portalNav.listing, href: "/portal/listing", icon: navIcons.listing },
    { label: t.portalNav.analytics, href: "/portal/analytics", icon: navIcons.analytics },
    { label: t.portalNav.promote, href: "/portal/promote", icon: navIcons.promote },
    { label: t.portalNav.campaigns, href: "/portal/campaigns", icon: navIcons.campaigns },
    { label: t.portalNav.billing, href: "/portal/billing", icon: navIcons.billing },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFB] flex flex-col">
      {/* ── Desktop top bar ── */}
      <header className="hidden md:flex items-center justify-between px-8 lg:px-12 py-4 bg-white border-b border-[#EDE9E3]">
        <Link href="/portal" className="flex items-center gap-2.5">
          <span className="text-xl font-bold tracking-tight text-[#222D52]">
            Golden<span className="text-[#D2B68A]">book</span>{" "}
            <span className="text-[#D2B68A]">GO</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-[#D2B68A]/10 text-[#D2B68A]"
                  : "text-[#6B6B7B] hover:text-[#222D52] hover:bg-[#F9F7F2]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <PlaceSelector />
          <NotificationBell />
          <UserMenu name={user.name} t={t} />
        </div>
      </header>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-[#EDE9E3]">
        <Link href="/portal" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[#222D52]">
            Golden<span className="text-[#D2B68A]">book</span>{" "}
            <span className="text-[#D2B68A]">GO</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <PlaceSelector />
          <NotificationBell />
          <UserMenu name={user.name} t={t} />
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 px-5 md:px-8 lg:px-12 py-6 md:py-10 pb-24 md:pb-10 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDE9E3] flex items-center justify-around px-1 py-1.5 z-50 safe-area-bottom">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-0 flex-1 transition-colors ${
              isActive(pathname, item.href) ? "text-[#D2B68A]" : "text-[#6B6B7B]"
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-medium truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
