import { describe, it, expect, vi } from 'vitest'

// dashboardAuth.ts imports the pg pool at module load; the mapping under test
// is pure, so stub the DB layer instead of requiring DATABASE_URL.
vi.mock('../../../db/postgres', () => ({ db: { query: vi.fn() } }))

import { mapAdminRoleToDashboardRole } from '../dashboardAuth'

describe('mapAdminRoleToDashboardRole', () => {
  it('maps super_admin to super_admin', () => {
    expect(mapAdminRoleToDashboardRole('super_admin')).toBe('super_admin')
  })

  it.each(['editor', 'curator', 'translator', 'ops'])('maps %s to editor', (role) => {
    expect(mapAdminRoleToDashboardRole(role)).toBe('editor')
  })

  it('returns null for missing or unknown roles', () => {
    expect(mapAdminRoleToDashboardRole(null)).toBeNull()
    expect(mapAdminRoleToDashboardRole(undefined)).toBeNull()
    expect(mapAdminRoleToDashboardRole('')).toBeNull()
    expect(mapAdminRoleToDashboardRole('business_client')).toBeNull()
    expect(mapAdminRoleToDashboardRole('SUPER_ADMIN')).toBeNull()
  })
})
