import { db } from '../../db/postgres'
import { AppError } from '../errors/AppError'
import { authenticate } from './authPlugin'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type DashboardRole = 'super_admin' | 'editor'

export interface DashboardAdminUser {
  email: string
  fullName: string | null
  adminRole: string
  dashboardRole: DashboardRole
}

interface AdminUserRow {
  email: string
  full_name: string | null
  role: string
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: DashboardAdminUser
  }
}

// admin_users.role allows five values (CHECK constraint): super_admin, editor,
// curator, translator, ops. The dashboard only distinguishes two access
// levels, so every non-super_admin staff role gets the editor experience.
// Before this mapping covered the last three, anyone invited as curator,
// translator or ops was authenticated but resolved to `null` here, got a 403
// on every dashboard call and was bounced back to the login screen.
// If one of these roles ever needs narrower access, give it its own
// DashboardRole (and a matching branch in the dashboard's permissions.ts)
// instead of returning null.
const EDITOR_EQUIVALENT_ROLES: ReadonlySet<string> = new Set(['editor', 'curator', 'translator', 'ops'])

export function mapAdminRoleToDashboardRole(role: string | null | undefined): DashboardRole | null {
  if (!role) return null

  if (role === 'super_admin') {
    return 'super_admin'
  }

  if (EDITOR_EQUIVALENT_ROLES.has(role)) {
    return 'editor'
  }

  return null
}

export async function getDashboardAdminUserByEmail(email: string): Promise<DashboardAdminUser | null> {
  const { rows } = await db.query<AdminUserRow>(
    `SELECT email, full_name, role
     FROM admin_users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  )

  const adminUser = rows[0]
  if (!adminUser) return null

  const dashboardRole = mapAdminRoleToDashboardRole(adminUser.role)
  if (!dashboardRole) return null

  return {
    email: adminUser.email,
    fullName: adminUser.full_name,
    adminRole: adminUser.role,
    dashboardRole,
  }
}

export async function authenticateDashboardUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply)

  const adminUser = await getDashboardAdminUserByEmail(request.user.email)

  if (!adminUser) {
    throw new AppError(403, 'You do not have permission to access the dashboard', 'FORBIDDEN')
  }

  request.adminUser = adminUser
}

// preHandler chain for actions restricted to super_admin (edit/delete).
// Editors retain view/create/deactivate, but edit & delete are admin-only.
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticateDashboardUser(request, reply)

  if (request.adminUser?.dashboardRole !== 'super_admin') {
    throw new AppError(403, 'This action requires super admin privileges', 'FORBIDDEN')
  }
}
