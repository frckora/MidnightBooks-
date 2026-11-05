-- Store Telegram file IDs for canonical JSON record documents.
-- Nullable for compatibility with any pre-existing pointer rows.
ALTER TABLE telegram_records ADD COLUMN telegram_file_id TEXT;
