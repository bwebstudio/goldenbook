import { buildApp } from './app'
import { env } from './config/env'
import { checkDbConnection } from './db/postgres'

async function start() {
  const app = buildApp()

  // Verify DB connection before accepting traffic
  await checkDbConnection()
  app.log.info('[db] Connected to Postgres')

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
