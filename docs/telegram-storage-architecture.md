# MidnightBooks — Telegram-first storage architecture

## Goals

- Keep the existing `main` branch and production Mini App unchanged during migration.
- Use the existing Telegram bot: `@Midnight_library1_Bot`.
- Remove Google Sheets / Apps Script from the target architecture.
- Store book files and user-facing library data in Telegram.
- Keep the bot token and all privileged operations on a server, never in browser code.
- Preserve the current MidnightBooks visual design and user flows.

## Critical Telegram Bot API constraint

Telegram Bot API is not a queryable database. A bot can receive updates and act on known chat/message identifiers, but it cannot request arbitrary chat history or search old messages by content. Therefore, a design that stores all records as messages but keeps no external index/pointer is not reliably queryable after a server restart.

Before implementation, choose one of these explicit approaches:

1. **Bot API + small durable index** — Telegram stores files and canonical record messages; a small external durable store holds message IDs, mappings, cursors and indexes. This is the simplest reliable design, but it means not literally every byte is in Telegram.
2. **MTProto client** — a dedicated Telegram user session can read chat history and rebuild indexes, but adds account-session security, operational complexity and user-account dependency. It must be explicitly approved and secured.
3. **Bot API + Telegram snapshot pointer** — store a compact index snapshot in Telegram and keep its message ID in server configuration. This reduces external state, but still requires a durable pointer and has message-size/editing/backup constraints; it is not a robust relational database.

Do not claim that Telegram Bot API alone provides database-like search or history access.

## Proposed Telegram storage layout

Create a private supergroup owned by the project:

- `Books` — one canonical metadata record per book.
- `Covers` — cover images, linked by stable book ID.
- `EPUB` — book files, linked by stable book ID.
- `Arts` — gallery images, linked by stable book ID and sort order.
- `Users` — user profile/settings records, keyed by Telegram user ID.
- `User actions` — favorites, reading statuses and ratings.
- `Statistics` — append-only events or aggregated counters.

Topics are optional organization only; they do not provide database indexes.

## Record model

Every record must have a stable UUID, schema version, record type, creation/update timestamps and a soft-delete marker where applicable.

Book:
- id, title, author_id, series_id (nullable), series_number
- annotation, tropes[], triggers[], quotes[]
- publication_date, publication_status
- cover_message_id, epub_message_id, art_message_ids[]
- created_at, updated_at, deleted_at

Author:
- id, name

Series:
- id, title, author_id, status

User:
- telegram_user_id, display_name, preferences, created_at, updated_at

UserBook:
- telegram_user_id, book_id, status (want_to_read | reading | read), favorite, rating (1..5), updated_at

StatEvent:
- id, book_id, telegram_user_id (nullable), event_type (view | download), created_at

## Server responsibilities

- Verify Telegram Mini App initData signature and freshness on every authenticated request.
- Keep bot token and Telegram API calls server-side.
- Validate admin authorization server-side; never rely on a password embedded in index.html.
- Enforce file type and size limits.
- Save Telegram chat_id/message_id/file_id mappings and make writes idempotent.
- Rate-limit user actions and downloads.
- Log errors without logging bot tokens or sensitive initData.
- Provide backup/export and restore procedures.

## Migration sequence

1. Preserve `main`; all migration work stays on `telegram-migration`.
2. Inventory current frontend API calls and data shapes.
3. Agree on the storage approach (Bot API + small index, MTProto, or snapshot pointer).
4. Create the private Telegram storage group and grant the existing bot only required permissions.
5. Implement server endpoints and storage adapter.
6. Implement a read-only bootstrap endpoint and test with an empty catalogue.
7. Switch frontend reads, then writes, behind a feature flag.
8. Test admin operations, ratings, favorites, reading lists, downloads and failure recovery.
9. Only after acceptance, update the production branch/deployment.

## Current status

Architecture draft only. No Telegram group has been created, no bot token has been used, no production code has been changed, and Google Apps Script has not been disconnected.
