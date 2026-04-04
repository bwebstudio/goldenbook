"use client";

import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";
import { markLoggingOut } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    // Signal the API client to stop all requests immediately
    markLoggingOut();

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore signOut errors — session may already be invalid
    }

    // Navigate without router.refresh() to avoid re-rendering
    // server components (which would trigger requireDashboardUser → redirect loop)
    router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-muted hover:bg-[#F5F1EB] hover:text-text transition-colors w-full disabled:opacity-60"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span>{isLoading ? "..." : t.common.logout}</span>
    </button>
  );
}
