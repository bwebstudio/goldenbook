const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

// Session ID — persisted per browser tab
let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = typeof window !== "undefined"
      ? (sessionStorage.getItem("gb_sid") ?? (() => {
          const id = crypto.randomUUID();
          sessionStorage.setItem("gb_sid", id);
          return id;
        })())
      : "server";
  }
  return sessionId;
}

/**
 * Fire-and-forget tracking. Never blocks UI, never throws.
 */
export function trackEvent(
  event: "view_place" | "click_place" | "save_place" | "open_route" | "click_booking",
  payload?: {
    placeId?: string;
    userId?: string;
    city?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  },
): void {
  if (typeof window === "undefined") return;

  const body = {
    event,
    placeId: payload?.placeId,
    userId: payload?.userId,
    sessionId: getSessionId(),
    city: payload?.city,
    category: payload?.category,
    metadata: payload?.metadata,
  };

  // Use navigator.sendBeacon for reliability (survives page unload)
  const ok = navigator.sendBeacon?.(
    `${BASE_URL}/api/v1/analytics/track`,
    new Blob([JSON.stringify(body)], { type: "application/json" }),
  );

  // Fallback to fetch if sendBeacon unavailable or fails
  if (!ok) {
    fetch(`${BASE_URL}/api/v1/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }
}

