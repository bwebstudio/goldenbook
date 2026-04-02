-- Notification system for all dashboard users (admin, editor, business client)

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  type       text NOT NULL CHECK (type IN (
    'campaign_activated', 'campaign_ended', 'no_active_campaigns',
    'editorial_feedback', 'high_performance',
    'change_approved', 'change_rejected',
    'promotion_approved', 'promotion_rejected',
    'system'
  )),
  title      text NOT NULL,
  message    text NOT NULL DEFAULT '',
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications (user_id) WHERE is_read = false;
