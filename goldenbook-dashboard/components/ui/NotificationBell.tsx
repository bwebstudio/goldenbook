"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
} from "@/lib/api/notifications";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const typeIcons: Record<string, { bg: string; stroke: string; path: string }> = {
  campaign_activated: { bg: "bg-emerald-50", stroke: "#059669", path: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  campaign_ended: { bg: "bg-amber-50", stroke: "#D97706", path: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  no_active_campaigns: { bg: "bg-red-50", stroke: "#DC2626", path: "M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  high_performance: { bg: "bg-gold/10", stroke: "#D2B68A", path: "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" },
  change_approved: { bg: "bg-emerald-50", stroke: "#059669", path: "M20 6L9 17l-5-5" },
  change_rejected: { bg: "bg-red-50", stroke: "#DC2626", path: "M18 6L6 18M6 6l12 12" },
  promotion_approved: { bg: "bg-emerald-50", stroke: "#059669", path: "M20 6L9 17l-5-5" },
  promotion_rejected: { bg: "bg-red-50", stroke: "#DC2626", path: "M18 6L6 18M6 6l12 12" },
};

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll unread count every 60s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { fetchUnreadCount } = await import("@/lib/api/notifications");
        const count = await fetchUnreadCount();
        setUnreadCount(count);
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    if (!open) load();
    setOpen(!open);
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id).catch(() => {});
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-[#6B6B7B] hover:text-[#222D52] hover:bg-[#F9F7F2] transition-colors cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Dropdown — fullscreen on mobile, positioned on desktop */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white sm:rounded-xl sm:border sm:border-[#EDE9E3] sm:shadow-xl z-50 flex flex-col sm:block sm:overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 sm:py-3 pt-[max(env(safe-area-inset-top),12px)] border-b border-[#EDE9E3] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="sm:hidden p-1 text-muted hover:text-text cursor-pointer">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                </button>
                <p className="text-sm font-bold text-[#222D52]">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                      {unreadCount}
                    </span>
                  )}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-gold hover:text-gold-dark cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 sm:flex-none sm:max-h-80 overflow-y-auto">
              {!loaded ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="1.5">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#6B6B7B]">No notifications yet</p>
                </div>
              ) : (
                items.map((n) => {
                  const icon = typeIcons[n.type] ?? typeIcons.campaign_activated;
                  return (
                    <button
                      key={n.id}
                      onClick={() => { if (!n.isRead) handleMarkRead(n.id); }}
                      className={`w-full text-left px-4 py-3 border-b border-[#EDE9E3]/50 transition-colors cursor-pointer hover:bg-[#F9F7F2] flex items-start gap-3 ${
                        n.isRead ? "opacity-60" : ""
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${icon.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={icon.stroke} strokeWidth="2">
                          <path d={icon.path} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold text-[#222D52] truncate ${!n.isRead ? "" : "font-medium"}`}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B6B7B] mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-[#6B6B7B]/60 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
