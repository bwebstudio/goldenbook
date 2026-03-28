export type DashboardRole = "super_admin" | "editor";

export interface DashboardSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface DashboardMeResponse {
  id: string;
  email: string;
  displayName: string | null;
  fullName: string | null;
  dashboardRole: DashboardRole | null;
  locale: string | null;
  homeDestinationId: string | null;
  onboardingCompleted: boolean;
}

export interface DashboardUser {
  id: string;
  email: string;
  displayName: string | null;
  fullName: string | null;
  name: string;
  role: DashboardRole;
}
