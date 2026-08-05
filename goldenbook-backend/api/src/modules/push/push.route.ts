// Registro de tokens push y acuse de apertura.
//
//   POST   /me/push/register   guarda o refresca el token del dispositivo
//   POST   /me/push/opened     marca abierta la última notificación
//   DELETE /me/push/register   el usuario apaga las notificaciones
//
// El acuse de apertura no es telemetría opcional: es lo que alimenta el
// retroceso automático. Sin él la racha de no abiertas nunca baja y acabaría
// apagando a gente que sí las abre.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../shared/auth/authPlugin'
import { db } from '../../db/postgres'

const registerSchema = z.object({
  // Expo emite "ExponentPushToken[...]". Validamos la forma para no llenar la
  // tabla de cadenas que Expo va a rechazar.
  token:      z.string().min(10).max(200).regex(/^ExponentPushToken\[.+\]$/),
  deviceType: z.enum(['ios', 'android']).optional(),
  locale:     z.string().max(8).optional(),
  citySlug:   z.string().max(64).optional(),
})

export async function pushRoutes(app: FastifyInstance) {

  app.post('/me/push/register', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_TOKEN' })
    const { token, deviceType, locale, citySlug } = parsed.data

    await db.query(
      `INSERT INTO push_tokens (token, user_id, device_type, locale, city_slug, is_active, updated_at)
       VALUES ($1,$2,$3,$4,$5,true, now())
       ON CONFLICT (token) DO UPDATE SET
         user_id     = EXCLUDED.user_id,
         device_type = COALESCE(EXCLUDED.device_type, push_tokens.device_type),
         locale      = COALESCE(EXCLUDED.locale, push_tokens.locale),
         city_slug   = COALESCE(EXCLUDED.city_slug, push_tokens.city_slug),
         -- Volver a registrar es un gesto deliberado: reactiva y limpia la
         -- racha, para que alguien que reinstala no herede su apagado.
         is_active       = true,
         unopened_streak = 0,
         updated_at      = now()`,
      [token, request.user.sub, deviceType ?? null, locale ?? null, citySlug ?? null],
    )
    return reply.status(204).send()
  })

  app.post('/me/push/opened', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = z.object({ token: z.string().max(200) }).safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()

    await db.query(
      `UPDATE push_sends SET opened_at = now()
        WHERE token = $1 AND opened_at IS NULL
          AND sent_at >= now() - interval '48 hours'`,
      [parsed.data.token],
    )
    await db.query(
      `UPDATE push_tokens SET unopened_streak = 0, updated_at = now() WHERE token = $1`,
      [parsed.data.token],
    )
    return reply.status(204).send()
  })

  app.delete('/me/push/register', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = z.object({ token: z.string().max(200) }).safeParse(request.body)
    if (!parsed.success) return reply.status(204).send()
    await db.query(
      `UPDATE push_tokens SET is_active = false, updated_at = now()
        WHERE token = $1 AND user_id = $2`,
      [parsed.data.token, request.user.sub],
    )
    return reply.status(204).send()
  })
}
