"use client";

import { useEffect, useState } from "react";
import { refreshSessionNow } from "@/lib/api/client";

type Status = "working" | "unavailable";

/**
 * Runs the browser's serialised refresh (single-flight + cross-tab Web Lock,
 * adopting a rotation another tab already made), then returns to `next`.
 * A dead session goes to /login; an auth-service outage offers a retry
 * instead of logging the user out.
 */
export default function RecoverSession({ next, staleMarker }: { next: string; staleMarker: number | null }) {
  const [status, setStatus] = useState<Status>("working");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await refreshSessionNow(staleMarker);
      if (cancelled) return;
      if (result.ok) {
        // Full navigation so the page's server components run with the fresh
        // cookie (a client transition could reuse the failed RSC payload).
        window.location.replace(next);
      } else if (result.definitive) {
        window.location.replace("/login");
      } else {
        setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, staleMarker, attempt]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white px-10 py-12 shadow-sm text-center">
        {status === "working" ? (
          <p className="text-base text-muted">Restoring your session...</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-text">Could not restore your session</h1>
            <p className="mt-4 text-base text-muted">
              The sign-in service did not respond. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("working");
                setAttempt((n) => n + 1);
              }}
              className="mt-8 inline-flex rounded-xl bg-gold px-6 py-3 text-base font-semibold text-white hover:bg-gold-dark transition-colors cursor-pointer"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
