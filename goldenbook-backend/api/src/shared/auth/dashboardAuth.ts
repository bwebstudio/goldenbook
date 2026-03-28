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

export function mapAdminRoleToDashboardRole(role: string | null | undefined): DashboardRole | null {
  if (!role) return null

  if (role === 'super_admin') {
    return 'super_admin'
  }

  if (role === 'editor') {
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
