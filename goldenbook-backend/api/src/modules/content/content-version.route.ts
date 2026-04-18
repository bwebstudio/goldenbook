// GET /api/v1/content/version
//
// Returns the monotonically increasing global content version. Mobile polls
// this on app foreground and on major list-screen mounts. When the returned
// version differs from the value the mobile app has stored, it invalidates
// its React Query caches for editorial data (`places`, `routes`, etc.).
//
// This is the primary sync mechanism between the dashboard and the app.
// Supabase Realtime on the same row is an additive Phase-2 optimisation.
//
// The endpoint is intentionally unauthenticated so the mobile app can poll
// it before login; the response reveals no editorial content.

import type { FastifyInstance } from 'fastify'
import { db } from '../../db/postgres'

interface VersionRow {
  version: string          // pg returns bigint as string
  updated_at: string
}

export async function contentVersionRoutes(app: FastifyInstance) {
  app.get('/content/version', async (_request, reply) => {
    const { rows } = await db.query<VersionRow>(
      `SELECT version::text, updated_at
         FROM content_version
        WHERE scope = 'global'
        LIMIT 1`,
    )

    // If the migration hasn't run yet, fail open with version=0 so clients
    // keep working and never hang on a missing endpoint.
    if (!rows[0]) {
      return reply.send({ global: 0, updated_at: new Date().toISOString() })
    }

    return reply
      .header('Cache-Control', 'public, max-age=5')
      .send({
        global: Number(rows[0].version),
        updated_at: rows[0].updated_at,
      })
  })
}
