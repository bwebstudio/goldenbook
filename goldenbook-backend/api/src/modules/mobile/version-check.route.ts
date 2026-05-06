// GET /api/v1/mobile/version-check
//
// Returns the minimum and latest store-binary build numbers per platform so
// the mobile app can decide whether to show its "Update available" Alert on
// cold start. Intentionally unauthenticated — the response reveals no
// editorial content and is checked before the user has a session.
//
// Tunable via env vars (overrides take priority over the baked-in defaults):
//   MOBILE_IOS_MIN_BUILD              — force-update threshold (iOS)
//   MOBILE_IOS_LATEST_BUILD           — recommended-update threshold (iOS)
//   MOBILE_IOS_STORE_URL              — App Store deep link
//   MOBILE_ANDROID_MIN_VERSION_CODE   — force-update threshold (Android)
//   MOBILE_ANDROID_LATEST_VERSION_CODE — recommended-update threshold (Android)
//   MOBILE_ANDROID_STORE_URL          — Play Store URL
//   MOBILE_FORCE_UPDATE               — '1'/'true' to force update for everyone
//                                        whose build < latestBuild
//
// Defaults are sized so a freshly-installed binary is treated as up-to-date
// (no popup) until ops bumps the env vars in Railway. minBuild defaults to 0
// so we never accidentally lock out installed users.

import type { FastifyInstance } from 'fastify'

const DEFAULT_IOS_LATEST_BUILD = 77
const DEFAULT_ANDROID_LATEST_VERSION_CODE = 81
const DEFAULT_IOS_STORE_URL = 'https://apps.apple.com/app/id6748363796'
const DEFAULT_ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.bwebstudio.goldenbook'

function parseInt0(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const MESSAGES = {
  en: {
    title: 'New update available',
    body: 'A new version of Goldenbook Go is available. Update now to enjoy the latest improvements.',
    updateButton: 'Update',
    laterButton: 'Later',
  },
  es: {
    title: 'Nueva actualización disponible',
    body: 'Hay una nueva versión de Goldenbook Go disponible. Actualiza ahora para disfrutar de las últimas mejoras.',
    updateButton: 'Actualizar',
    laterButton: 'Más tarde',
  },
  pt: {
    title: 'Nova atualização disponível',
    body: 'Está disponível uma nova versão do Goldenbook Go. Atualize agora para aceder às últimas melhorias.',
    updateButton: 'Atualizar',
    laterButton: 'Mais tarde',
  },
} as const

export async function mobileVersionCheckRoutes(app: FastifyInstance) {
  app.get('/mobile/version-check', async (_request, reply) => {
    const ios = {
      minBuild: parseInt0(process.env.MOBILE_IOS_MIN_BUILD, 0),
      latestBuild: parseInt0(
        process.env.MOBILE_IOS_LATEST_BUILD,
        DEFAULT_IOS_LATEST_BUILD,
      ),
      storeUrl: process.env.MOBILE_IOS_STORE_URL ?? DEFAULT_IOS_STORE_URL,
    }

    const android = {
      minVersionCode: parseInt0(process.env.MOBILE_ANDROID_MIN_VERSION_CODE, 0),
      latestVersionCode: parseInt0(
        process.env.MOBILE_ANDROID_LATEST_VERSION_CODE,
        DEFAULT_ANDROID_LATEST_VERSION_CODE,
      ),
      storeUrl:
        process.env.MOBILE_ANDROID_STORE_URL ?? DEFAULT_ANDROID_STORE_URL,
    }

    return reply
      .header('Cache-Control', 'public, max-age=300')
      .send({
        ios,
        android,
        forceUpdate: parseBool(process.env.MOBILE_FORCE_UPDATE),
        messages: MESSAGES,
      })
  })
}
