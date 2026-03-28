import type { DashboardAdminUser, DashboardRole } from '../../shared/auth/dashboardAuth'

export interface MeDTO {
  id: string
  email: string
  displayName: string | null
  fullName: string | null
  dashboardRole: DashboardRole | null
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
): MeDTO {
  return {
    id: row.id,
    email,
    displayName: row.display_name,
    fullName: adminUser?.fullName ?? row.display_name,
    dashboardRole: adminUser?.dashboardRole ?? null,
    locale: row.locale,
    homeDestinationId: row.home_destination_id,
    onboardingCompleted: row.onboarding_completed,
  }
}
