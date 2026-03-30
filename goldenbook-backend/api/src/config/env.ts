import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_PREFIX: z.string().default('/api/v1'),
  SUPABASE_JWT_SECRET: z.string().min(1),
  // Supabase project URL (e.g. https://ltdhyshuhkvicsvtssjm.supabase.co)
  SUPABASE_URL: z.string().url(),
  // Supabase service role key — server-side only, never expose to clients
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Firebase API key — used only for legacy Firebase token verification during migration
  // REMOVABLE: delete after migration window closes
  FIREBASE_API_KEY: z.string().min(1).optional(),
  // Optional: Supabase / S3 storage base URL for constructing image URLs.
  // Example: https://xyz.supabase.co
  // If not set, Concierge recommendation images will be returned as null.
  STORAGE_BASE_URL: z.string().url().optional(),
  // Stripe — test mode keys for checkout integration
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  // Stripe webhook endpoint secret — used to verify webhook signatures
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // URL the dashboard runs on — used for Stripe redirect URLs
  DASHBOARD_URL: z.string().url().default('http://localhost:3000'),
  // Comma-separated list of allowed CORS origins (production)
  // Example: https://goldenbook.vercel.app,https://dashboard.goldenbook.com
  CORS_ORIGINS: z.string().optional(),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data
export type Env = typeof env