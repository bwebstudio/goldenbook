export type DashboardRole = "super_admin" | "editor" | "business_client";

export type PlaceRole = "owner" | "manager";

export interface DashboardSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface MeBusinessClient {
  id: string;
  placeId: string;
  contactName: string | null;
}

export interface MePlaceLink {
  placeId: string;
  role: PlaceRole;
}

export interface DashboardMeResponse {
  id: string;
  email: string;
  displayName: string | null;
  fullName: string | null;
  dashboardRole: DashboardRole | null;
  businessClient: MeBusinessClient | null;
  places: MePlaceLink[];
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
  businessClient?: MeBusinessClient | null;
  places: MePlaceLink[];
}
