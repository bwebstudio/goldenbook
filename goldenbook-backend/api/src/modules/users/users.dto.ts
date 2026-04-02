import type { DashboardAdminUser, DashboardRole } from '../../shared/auth/dashboardAuth'
import type { BusinessClient, PlaceUserLink } from '../../shared/auth/businessAuth'

export interface MeBusinessClient {
  id: string
  placeId: string
  contactName: string | null
}

export interface MePlaceLink {
  placeId: string
  role: 'owner' | 'manager'
}

export interface MeDTO {
  id: string
  email: string
  displayName: string | null
  fullName: string | null
  dashboardRole: DashboardRole | null
  businessClient: MeBusinessClient | null
  places: MePlaceLink[]
  locale: string | null
  homeDestinationId: string | null
  onboardingCompleted: boolean
}

interface UserRow {
  id: string
  username: string | null
  display_name: string | null
  locale: string | null
  home_destination_id: string | null
  onboarding_completed: boolean
}

export function toMeDTO(
  row: UserRow,
  email: string,
  adminUser: DashboardAdminUser | null = null,
  businessClient: BusinessClient | null = null,
): MeDTO {
  return {
    id: row.id,
    email,
    displayName: row.display_name,
    fullName: adminUser?.fullName ?? row.display_name,
    dashboardRole: adminUser?.dashboardRole ?? null,
    businessClient: businessClient
      ? { id: businessClient.id, placeId: businessClient.placeId, contactName: businessClient.contactName }
      : null,
    places: businessClient?.places ?? [],
    locale: row.locale,
    homeDestinationId: row.home_destination_id,
    onboardingCompleted: row.onboarding_completed,
  }
}
