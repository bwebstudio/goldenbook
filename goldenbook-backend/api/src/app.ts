import Fastify from 'fastify'
import cors from '@fastify/cors'
import { AppError } from './shared/errors/AppError'
import { CampaignValidationError } from './modules/campaigns/campaigns.validation'
import { env } from './config/env'

import { healthRoutes } from './modules/health/health.route'
import { destinationsRoutes } from './modules/destinations/destinations.route'
import { placesRoutes } from './modules/places/places.route'
import { discoverRoutes } from './modules/discover/discover.route'
import { routesRoutes } from './modules/routes/routes.route'
import { searchRoutes } from './modules/search/search.route'
import { categoriesRoutes } from './modules/categories/categories.route'
import { mapRoutes } from './modules/map/map.route'
import { usersRoutes } from './modules/users/users.route'
import { meRoutes } from './modules/me/me.route'
import { journeysRoutes } from './modules/journeys/journeys.route'
import { conciergeRoutes } from './modules/concierge/concierge.route'
import { adminPlacesRoutes } from './modules/admin/places/admin-places.route'
import { adminCategoriesRoutes } from './modules/admin/categories/admin-categories.route'
import { adminRoutesRoutes } from './modules/admin/routes/admin-routes.route'
import { adminSuggestionsRoutes } from './modules/admin/suggestions/admin-suggestions.route'
import { adminAnalyticsRoutes } from './modules/admin/analytics/admin-analytics.route'
import { campaignAnalyticsRoutes } from './modules/admin/analytics/campaign-analytics.route'
import { bookingTrackingRoutes } from './modules/booking-tracking/booking-tracking.route'
import { candidatesRoutes } from './modules/booking-candidates/candidates.route'
import { visibilityRoutes } from './modules/visibility/visibility.route'
import { authRoutes } from './modules/auth/auth.route'
import { webRoutes } from './modules/web/web.route'
import { businessPortalRoutes } from './modules/business-portal/business-portal.route'
import { placeEventsRoutes } from './modules/place-events/place-events.route'
import { adminPricingRoutes } from './modules/admin/pricing/admin-pricing.route'
import { adminCampaignsRoutes } from './modules/admin/campaigns/admin-campaigns.route'
import { pricingRoutes } from './modules/pricing/pricing.route'
import { campaignsRoutes } from './modules/campaigns/campaigns.route'
import { campaignsTrackingRoutes } from './modules/campaigns/campaigns-tracking.route'
import { trackingRoutes } from './modules/analytics/tracking.route'
import { behaviorAnalyticsRoutes } from './modules/analytics/behavior-analytics.route'
import { recommendationsRoutes } from './modules/recommendations/recommendations.route'
import { nowRoutes } from './modules/now/now.route'
import { notificationsRoutes } from './modules/notifications/notifications.route'
import { stripeWebhookRoutes } from './modules/stripe/stripe-webhook.route'
import { pricingConfigRoutes } from './modules/pricing-config/pricing-config.route'
import { syncAllSlots } from './modules/inventory/promotion-inventory.query'

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // CORS — restrict origins in production, allow all in development
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : true
  app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  })

  // Routes
  app.register(healthRoutes,      { prefix: env.API_PREFIX })
  app.register(destinationsRoutes, { prefix: env.API_PREFIX })
  app.register(placesRoutes,       { prefix: env.API_PREFIX })
  app.register(discoverRoutes,     { prefix: env.API_PREFIX })
  app.register(routesRoutes,       { prefix: env.API_PREFIX })
  app.register(searchRoutes,       { prefix: env.API_PREFIX })
  app.register(categoriesRoutes,   { prefix: env.API_PREFIX })
  app.register(mapRoutes,          { prefix: env.API_PREFIX })
  app.register(usersRoutes,        { prefix: env.API_PREFIX })
  app.register(meRoutes,           { prefix: env.API_PREFIX })
  app.register(journeysRoutes,     { prefix: env.API_PREFIX })
  app.register(conciergeRoutes,        { prefix: env.API_PREFIX })
  app.register(adminPlacesRoutes,      { prefix: env.API_PREFIX })
  app.register(adminCategoriesRoutes,  { prefix: env.API_PREFIX })
  app.register(adminRoutesRoutes,      { prefix: env.API_PREFIX })
  app.register(adminSuggestionsRoutes, { prefix: env.API_PREFIX })
  app.register(adminAnalyticsRoutes,   { prefix: env.API_PREFIX })
  app.register(campaignAnalyticsRoutes, { prefix: env.API_PREFIX })
  app.register(bookingTrackingRoutes,  { prefix: env.API_PREFIX })
  app.register(candidatesRoutes,       { prefix: env.API_PREFIX })
  app.register(visibilityRoutes,       { prefix: env.API_PREFIX })
  app.register(authRoutes,             { prefix: env.API_PREFIX })
  app.register(webRoutes,              { prefix: env.API_PREFIX })
  app.register(businessPortalRoutes,   { prefix: env.API_PREFIX })
  app.register(placeEventsRoutes,      { prefix: env.API_PREFIX })
  app.register(adminPricingRoutes,     { prefix: env.API_PREFIX })
  app.register(adminCampaignsRoutes,  { prefix: env.API_PREFIX })
  app.register(pricingRoutes,          { prefix: env.API_PREFIX })
  app.register(campaignsRoutes,        { prefix: env.API_PREFIX })
  app.register(campaignsTrackingRoutes, { prefix: env.API_PREFIX })
  app.register(trackingRoutes,         { prefix: env.API_PREFIX })
  app.register(behaviorAnalyticsRoutes, { prefix: env.API_PREFIX })
  app.register(recommendationsRoutes,  { prefix: env.API_PREFIX })
  app.register(nowRoutes,              { prefix: env.API_PREFIX })
  app.register(notificationsRoutes,   { prefix: env.API_PREFIX })
  app.register(pricingConfigRoutes,   { prefix: env.API_PREFIX })

  // Stripe webhook — registered in its own encapsulated context so
  // the raw-body content-type parser doesn't affect other routes.
  app.register(stripeWebhookRoutes,    { prefix: env.API_PREFIX })

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    // Campaign validation errors carry next_available + alternatives
    if (error instanceof CampaignValidationError) {
      return reply.status(error.statusCode).send({
        error: error.code ?? 'NOT_AVAILABLE',
        message: error.message,
        next_available: error.next_available,
        alternatives: error.alternatives,
      })
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code ?? 'ERROR',
        message: error.message,
      })
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      })
    }

    app.log.error(error)
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'Route not found',
    })
  })

  // ── Promotion inventory: sync on startup + periodic self-heal ───────────
  app.addHook('onReady', async () => {
    syncAllSlots().catch((err) =>
      app.log.error(err, '[promotion-inventory] startup sync failed'),
    )
    // Re-sync every 15 minutes to catch expired placements and counter drift
    setInterval(() => {
      syncAllSlots().catch((err) =>
        app.log.error(err, '[promotion-inventory] periodic sync failed'),
      )
    }, 15 * 60 * 1000)
  })

  return app
}
