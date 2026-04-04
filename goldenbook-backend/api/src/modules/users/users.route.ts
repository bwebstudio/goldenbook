import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authPlugin'
import { getDashboardAdminUserByEmail } from '../../shared/auth/dashboardAuth'
import { getBusinessClientByUserId } from '../../shared/auth/businessAuth'
import { getUserById, upsertUserOnFirstAccess } from './users.query'
import { toMeDTO } from './users.dto'
import { db } from '../../db/postgres'

export async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /me
   * Returns the authenticated user's profile.
   * If the user exists in Supabase Auth but not yet in the users table,
   * a minimal record is created automatically (first-access provisioning).
   *
   * Social auth users (Google, Apple) are auto-verified since the
   * identity provider already confirmed their email.
   */
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const { sub: userId, email } = request.user
    // Supabase JWT includes app_metadata.provider for the auth method
    const provider = (request.user as any).app_metadata?.provider as string | undefined
    const isSocialAuth = !!provider && provider !== 'email'

    let user = await getUserById(userId)

    if (!user) {
      // First access — social auth users are pre-verified
      user = await upsertUserOnFirstAccess(userId, isSocialAuth)
    } else if (isSocialAuth && !user.email_verified) {
      // Social auth user that was created before the email_verified column existed
      await db.query(
        'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
        [userId],
      )
      user = { ...user, email_verified: true }
    }

    const [adminUser, businessClient] = await Promise.all([
      getDashboardAdminUserByEmail(email),
      getBusinessClientByUserId(userId).catch(() => null),
    ])

    return reply.send(toMeDTO(user, email, adminUser, businessClient))
  })
}
