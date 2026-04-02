import { apiGet, apiPost } from "./client";

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationDTO[];
  unreadCount: number;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return apiGet<NotificationsResponse>("/api/v1/me/notifications");
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiGet<{ unreadCount: number }>("/api/v1/me/notifications/unread-count");
  return data.unreadCount;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiPost("/api/v1/me/notifications/mark-read", { notificationId });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiPost("/api/v1/me/notifications/mark-all-read", {});
}
