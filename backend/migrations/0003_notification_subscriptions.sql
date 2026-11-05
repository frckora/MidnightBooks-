-- Telegram IDs here are used only as delivery routing for opt-in notifications.
-- Notification preferences are limited to whether the user opted in/out.
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  telegram_user_id TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_active
  ON notification_subscriptions (active);
