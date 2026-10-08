import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { resolveCorsOrigins, KNOWN_PRODUCTION_ORIGINS } from '../cors'

describe('resolveCorsOrigins', () => {
  it('uses CORS_ORIGINS verbatim when set', () => {
    const r = resolveCorsOrigins({
      nodeEnv: 'production',
      corsOrigins: ' https://a.example , https://b.example ,',
      dashboardUrl: 'https://dash.example',
    })
    expect(r.origin).toEqual(['https://a.example', 'https://b.example'])
    expect(r.warning).toBeUndefined()
  })

  it('stays permissive in development when unset', () => {
    expect(resolveCorsOrigins({ nodeEnv: 'development' })).toEqual({ origin: true })
    expect(resolveCorsOrigins({ nodeEnv: 'test', corsOrigins: '' })).toEqual({ origin: true })
  })

  it('falls back to an allowlist in production when unset, and warns', () => {
    const r = resolveCorsOrigins({
      nodeEnv: 'production',
      dashboardUrl: 'https://admin.example/some/path',
      appUrl: 'https://goldenbook.app',
    })
    expect(Array.isArray(r.origin)).toBe(true)
    const list = r.origin as string[]
    for (const o of KNOWN_PRODUCTION_ORIGINS) expect(list).toContain(o)
    expect(list).toContain('https://admin.example')
    expect(new Set(list).size).toBe(list.length)
    expect(r.warning).toMatch(/CORS_ORIGINS is not set/)
  })

  it('ignores localhost and invalid URLs in the production fallback', () => {
    const r = resolveCorsOrigins({
      nodeEnv: 'production',
      dashboardUrl: 'http://localhost:3000',
      appUrl: 'not a url',
    })
    expect(r.origin).toEqual([...KNOWN_PRODUCTION_ORIGINS])
  })
})

describe('CORS behaviour with the production fallback', () => {
  async function buildApp() {
    const app = Fastify()
    const { origin } = resolveCorsOrigins({ nodeEnv: 'production', appUrl: 'https://goldenbook.app' })
    await app.register(cors, { origin, credentials: true })
    app.get('/ping', async () => ({ ok: true }))
    return app
  }

  it('lets native clients (no Origin header) through', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/ping' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    await app.close()
  })

  it('reflects allowed origins and omits headers for others', async () => {
    const app = await buildApp()
    const ok = await app.inject({ method: 'GET', url: '/ping', headers: { origin: 'https://dashboard.goldenbook.app' } })
    expect(ok.headers['access-control-allow-origin']).toBe('https://dashboard.goldenbook.app')
    expect(ok.headers['access-control-allow-credentials']).toBe('true')

    const bad = await app.inject({ method: 'GET', url: '/ping', headers: { origin: 'https://evil.example' } })
    expect(bad.headers['access-control-allow-origin']).toBeUndefined()
    await app.close()
  })
})
