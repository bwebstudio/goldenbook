import Fastify from 'fastify'
import cors from '@fastify/cors'
import { AppError } from './shared/errors/AppError'
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
import { authRoutes } from './modules/auth/auth.route'
import { webRoutes } from './modules/web/web.route'

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // Plugins
  app.register(cors, { origin: true })

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
  app.register(authRoutes,             { prefix: env.API_PREFIX })
  app.register(webRoutes,              { prefix: env.API_PREFIX })

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
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

  return app
}
