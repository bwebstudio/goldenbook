import { FastifyInstance } from 'fastify'
import { authenticate } from '../../shared/auth/authPlugin'
import { getDashboardAdminUserByEmail } from '../../shared/auth/dashboardAuth'
import { getUserById, upsertUserOnFirstAccess } from './users.query'
import { toMeDTO } from './users.dto'

export async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /me
   * Returns the authenticated user's profile.
   * If the user exists in Supabase Auth but not yet in the users table,
   * a minimal record is created automatically (first-access provisioning).
   */
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const { sub: userId, email } = request.user

    let user = await getUserById(userId)

    if (!user) {
      user = await upsertUserOnFirstAccess(userId)
    }

    const adminUser = await getDashboardAdminUserByEmail(email)

    return reply.send(toMeDTO(user, email, adminUser))
  })
}
