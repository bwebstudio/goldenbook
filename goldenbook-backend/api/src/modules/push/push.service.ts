// Ritual diario.
//
// Una pieza al día, a las 18:00 hora de la ciudad de destino. La hora sale de
// los datos: con el tráfico interno ya excluido, el uso con intención está
// entre las 17h y las 19h, donde la profundidad por sesión se triplica. Los
// picos de madrugada eran gente planificando desde América, mucha apertura y
// casi ningún evento.
//
// Lo que evita que una diaria sature no es la hora, son las reglas de abajo.
// Cada una responde a una forma concreta de quemar la notificación:
//
//   1. Ya abrió la app hoy      -> empujar a quien está dentro es ruido.
//   2. No hay plan en su ciudad -> una notificación que lleva a una pantalla
//                                  vacía enseña a ignorarlas todas.
//   3. Mismo sitio que ayer     -> deja de ser una recomendación.
//   4. Retroceso automático     -> tres sin abrir y baja a dos por semana;
//                                  tres más y se apaga sola.
//
// Con esto un usuario enganchado recibe 4 o 5 por semana, no 7, y quien no
// engancha deja de recibirlas en dos semanas sin que nadie lo decida a mano.

import { db } from '../../db/postgres'
import { getPlanCandidates } from '../plan/plan.query'
import { buildPlan } from '../plan/plan.service'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/** Hora local de la ciudad a la que se dispara. */
export const SEND_HOUR = 18

const CITY_TIMEZONES: Record<string, string> = {
  lisboa:  'Europe/Lisbon',
  porto:   'Europe/Lisbon',
  algarve: 'Europe/Lisbon',
  madeira: 'Atlantic/Madeira',
}

/** Centro aproximado de cada ciudad, para armar el plan sin usuario delante. */
const CITY_CENTRES: Record<string, { lat: number; lon: number }> = {
  lisboa:  { lat: 38.7139, lon: -9.1394 },
  porto:   { lat: 41.1466, lon: -8.6109 },
  algarve: { lat: 37.0179, lon: -7.9307 },
  madeira: { lat: 32.6484, lon: -16.9089 },
}

/** Umbrales del retroceso. */
const BACKOFF_TO_WEEKLY = 3   // sin abrir seguidas -> dos por semana
const BACKOFF_TO_OFF    = 6   // sin abrir seguidas -> se apaga

interface TokenRow {
  token: string
  user_id: string | null
  locale: string | null
  city_slug: string | null
  unopened_streak: number
}

/** Hora local actual en una zona horaria. */
function localHour(tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date()),
    10,
  )
}

/** Fecha local (YYYY-MM-DD) en una zona horaria. */
function localDate(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz,
  }).format(new Date())
}

/**
 * Con racha de 3 a 5 sin abrir pasamos a dos por semana. Lunes y jueves, que
 * reparten mejor que dos días seguidos.
 */
function passesBackoff(streak: number, tz: string): boolean {
  if (streak >= BACKOFF_TO_OFF) return false
  if (streak < BACKOFF_TO_WEEKLY) return true
  const weekday = new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  ).getUTCDay()
  return weekday === 1 || weekday === 4
}

const COPY = {
  es: { title: 'Tu plan de esta noche', body: (n: string, c: string) => `Empieza en ${n}. ${c} paradas a un paseo.` },
  pt: { title: 'O teu plano para hoje',  body: (n: string, c: string) => `Começa no ${n}. ${c} paragens a um passeio.` },
  en: { title: 'Your plan for tonight',  body: (n: string, c: string) => `Starts at ${n}. ${c} stops within a walk.` },
} as const

function copyFor(locale: string | null) {
  return COPY[(locale ?? 'es') as keyof typeof COPY] ?? COPY.es
}

/**
 * Envía la tanda de una ciudad, si es su hora.
 * Devuelve cuántas notificaciones salieron.
 */
export async function sendDailyRitual(): Promise<number> {
  let sent = 0

  for (const [citySlug, tz] of Object.entries(CITY_TIMEZONES)) {
    if (localHour(tz) !== SEND_HOUR) continue

    const centre = CITY_CENTRES[citySlug]
    if (!centre) continue

    // Regla 2: un solo plan por ciudad, y si no hay, nadie recibe nada.
    // Se arma desde el centro de la ciudad porque a esta hora no sabemos
    // dónde está cada persona, y pedir ubicación en segundo plano sería
    // desproporcionado para una notificación editorial.
    const candidates = await getPlanCandidates(citySlug, 'es', centre.lat, centre.lon, 2500, tz)
    const plan = candidates.length > 0 ? buildPlan(candidates, centre.lat, centre.lon, tz, citySlug) : null
    if (!plan) continue

    const today = localDate(tz)

    const { rows } = await db.query<TokenRow>(
      `SELECT t.token, t.user_id, t.locale, t.city_slug, t.unopened_streak
         FROM push_tokens t
        WHERE t.is_active
          AND t.city_slug = $1
          -- Regla: una al día. El índice único lo garantiza igualmente, pero
          -- filtrar aquí evita pedirle a Expo envíos que vamos a descartar.
          AND NOT EXISTS (
            SELECT 1 FROM push_sends s
             WHERE s.token = t.token AND s.sent_on = $2::date
          )
          -- Regla 1: si ya abrió la app hoy, no le empujamos nada.
          AND NOT EXISTS (
            SELECT 1 FROM analytics_events ae
             WHERE ae.user_id = t.user_id
               AND NOT ae.is_internal
               AND ae.created_at >= now() - interval '12 hours'
          )`,
      [citySlug, today],
    )

    for (const row of rows) {
      if (!passesBackoff(row.unopened_streak, tz)) continue

      // Regla 3: el sitio de cabecera no puede repetir el de ayer.
      const lead = await pickLead(row.token, plan.stops)
      if (!lead) continue

      const copy = copyFor(row.locale)
      const title = copy.title
      const body = copy.body(lead.name, String(plan.stops.length))

      const ok = await pushToExpo(row.token, title, body, {
        // Abre el plan, no la portada. Una notificación que deja al usuario
        // buscando lo que le prometiste es peor que no enviarla.
        url: `goldenbook://plan?city=${citySlug}`,
      })
      if (!ok) continue

      await db.query(
        `INSERT INTO push_sends (token, user_id, lead_place_id, city_slug, title, body, sent_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7::date)
         ON CONFLICT (token, sent_on) DO NOTHING`,
        [row.token, row.user_id, lead.placeId, citySlug, title, body, today],
      )
      await db.query(
        `UPDATE push_tokens
            SET unopened_streak = unopened_streak + 1, updated_at = now()
          WHERE token = $1`,
        [row.token],
      )
      sent++
    }
  }

  return sent
}

/** Primera parada del plan que no encabezó la notificación de ayer. */
async function pickLead(
  token: string,
  stops: { placeId: string; name: string }[],
): Promise<{ placeId: string; name: string } | null> {
  const { rows } = await db.query<{ lead_place_id: string | null }>(
    `SELECT lead_place_id FROM push_sends
      WHERE token = $1 ORDER BY sent_at DESC LIMIT 1`,
    [token],
  )
  const previous = rows[0]?.lead_place_id ?? null
  const fresh = stops.find((s) => s.placeId !== previous)
  return fresh ?? null
}

/**
 * Envía a Expo. Un token rechazado como no registrado se desactiva: la app se
 * desinstaló o el token caducó, y seguir intentándolo solo suma ruido.
 */
async function pushToExpo(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ to: token, title, body, data, sound: 'default', priority: 'normal' }]),
    })
    const json = await res.json() as { data?: Array<{ status: string; details?: { error?: string } }> }
    const result = json.data?.[0]
    if (result?.status === 'error') {
      if (result.details?.error === 'DeviceNotRegistered') {
        await db.query(`UPDATE push_tokens SET is_active = false, updated_at = now() WHERE token = $1`, [token])
      }
      return false
    }
    return true
  } catch {
    return false
  }
}
