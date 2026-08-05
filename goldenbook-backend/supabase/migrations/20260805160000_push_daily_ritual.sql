-- Ritual diario: tokens push y registro de envíos.
--
-- Una notificación diaria a secas satura. Lo que la convierte en ritual en vez
-- de en acoso son las reglas de frecuencia, y esas necesitan memoria: saber si
-- la persona abrió hoy, cuántas seguidas lleva sin abrir, y qué sitio le
-- pusimos de cabecera ayer. Por eso hay dos tablas y no solo una de tokens.

BEGIN;

-- ─── Tokens ───────────────────────────────────────────────────────────────
-- Un usuario puede tener varios dispositivos. El token es la clave natural:
-- Expo lo reemite si se reinstala la app, y el antiguo deja de valer.

CREATE TABLE IF NOT EXISTS push_tokens (
  token         text PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type   text,
  locale        text,
  -- Ciudad seleccionada en el momento de registrar. Decide a qué hora local
  -- se envía: el plan es de la ciudad, no del huso del teléfono.
  city_slug     text,
  -- Lo apaga el propio usuario desde ajustes, o el retroceso automático
  -- cuando lleva demasiadas sin abrir.
  is_active     boolean NOT NULL DEFAULT true,
  -- Cuántas notificaciones seguidas se han enviado sin que las abriera.
  -- Se pone a cero en cuanto abre una.
  unopened_streak integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS push_tokens_city_idx ON push_tokens (city_slug) WHERE is_active;

-- ─── Registro de envíos ───────────────────────────────────────────────────
-- Una fila por notificación enviada. Sostiene tres reglas:
--   • no repetir el mismo sitio de cabecera dos días seguidos
--   • no enviar dos veces el mismo día
--   • medir apertura, que es lo que alimenta el retroceso

CREATE TABLE IF NOT EXISTS push_sends (
  id           bigserial PRIMARY KEY,
  token        text NOT NULL REFERENCES push_tokens(token) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Sitio que encabezó la notificación, para no repetirlo mañana.
  lead_place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  city_slug    text,
  title        text NOT NULL,
  body         text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  -- Fecha local de la ciudad, no del servidor. Madeira va una hora por detras
  -- de Lisboa, y "una al dia" tiene que significar su dia, no el nuestro.
  sent_on      date NOT NULL,
  opened_at    timestamptz
);

CREATE INDEX IF NOT EXISTS push_sends_token_sent_idx ON push_sends (token, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS push_sends_one_per_day_idx
  ON push_sends (token, sent_on);

COMMIT;
