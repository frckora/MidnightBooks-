-- D1 contains technical pointers only. Canonical data remains in Telegram.
CREATE TABLE IF NOT EXISTS telegram_records (
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (record_type, record_id),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_records_message
  ON telegram_records (chat_id, message_id);

CREATE TABLE IF NOT EXISTS book_lookup (
  book_id TEXT PRIMARY KEY,
  normalized_title TEXT NOT NULL,
  normalized_author TEXT NOT NULL DEFAULT '',
  series_id TEXT,
  series_position REAL,
  record_chat_id TEXT NOT NULL,
  record_message_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_lookup_title ON book_lookup (normalized_title);
CREATE INDEX IF NOT EXISTS idx_book_lookup_author ON book_lookup (normalized_author);
CREATE INDEX IF NOT EXISTS idx_book_lookup_series ON book_lookup (series_id, series_position);

CREATE TABLE IF NOT EXISTS media_pointers (
  media_id TEXT PRIMARY KEY,
  book_id TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('cover', 'epub', 'art')),
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  telegram_file_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_book_type ON media_pointers (book_id, media_type);
