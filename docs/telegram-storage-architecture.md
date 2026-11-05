# MidnightBooks — Telegram-first storage architecture

## Goals

- Keep the existing `main` branch and production Mini App unchanged during migration.
- Use the existing Telegram bot: `@Midnight_library1_Bot`.
- Remove Google Sheets / Apps Script from the target architecture.
- Store canonical book/user records and media files in the private Telegram storage group.
- Keep only technical pointers and lookup metadata in D1.
- Keep the bot token and all privileged operations on the server.
- Preserve the current MidnightBooks visual design and user flows.

## Telegram Bot API constraint and chosen design

Telegram Bot API is not a queryable database. A bot cannot request arbitrary chat history or search old messages by content. Storing ordinary text messages and retaining only message IDs would therefore not let the Worker read those records later.

**Chosen approach: Telegram-hosted JSON record documents + D1 pointer index.**

- Each canonical metadata record is serialized as a UTF-8 JSON document and uploaded to the private Telegram storage group using `sendDocument`.
- Telegram returns a `file_id` and `message_id`. D1 stores those pointers, the record type/ID, chat ID and update timestamp.
- To read a record, the Worker looks up its `file_id` in D1, calls Telegram `getFile`, then downloads and parses the document using the temporary file path returned by Telegram.
- Covers, EPUBs and arts are stored as Telegram media/documents. D1 stores only their Telegram pointers and associations.
- Updating a record uploads a new JSON document and atomically updates its D1 pointer. Old Telegram documents can be retained for recovery and cleaned up later by an explicit maintenance process.

This keeps record contents in Telegram while allowing the Worker to retrieve them through known file IDs. D1 is still required as a durable pointer index; it is not the catalogue database.

## Proposed Telegram storage layout

Use the existing private group `MidnightBooks Storage`. Topics are optional; the implementation must not depend on forum topics.

Logical record types include:

- `book` — book metadata, annotations, tropes, triggers and quotes.
- `author` and `series` — author and series records where normalized entities are needed.
- `user` and `user_book` — preferences, favorites, reading statuses and ratings.
- `stat_event` — append-only view/download events or compact aggregates.

Media types are `cover`, `epub` and `art`.

## Record model

Every JSON record must include a stable ID, schema version, record type, creation/update timestamps and a soft-delete marker where applicable.

Book:
- id, title, author, series (nullable), series_order
- description, trops[], triggers[], quotes[]
- release_date, status
- created_at, updated_at, deleted_at

User:
- telegram_user_id, display_name, preferences, created_at, updated_at

UserBook:
- telegram_user_id, book_id, status (planned | reading | read), favorite, rating (1..5), updated_at

StatEvent:
- id, book_id, telegram_user_id (nullable), event_type (view | download), created_at

## D1 contents

D1 contains only:
- stable record IDs and record types;
- Telegram chat IDs, message IDs and Telegram file IDs;
- normalized title/author and series lookup keys;
- media IDs, book associations and media types;
- timestamps required to maintain pointers.

Do not store annotations, tropes, triggers, quotes, cover bytes, EPUB bytes, user ratings, favorites or reading statuses in D1.

## Server responsibilities

- Verify Telegram Mini App initData signature and freshness on every authenticated request.
- Keep bot token and Telegram API calls server-side.
- Validate admin authorization server-side; never rely on a password embedded in index.html.
- Validate JSON schema, file type and size limits.
- Upload JSON record documents and media to Telegram.
- Update D1 pointers only after Telegram confirms a successful upload.
- Use stable IDs and safe write ordering so failed updates do not lose the previous pointer.
- Rate-limit user actions and downloads.
- Log errors without logging bot tokens or sensitive initData.
- Provide backup/export and restore procedures.

## Migration sequence

1. Preserve `main`; all migration work stays on `telegram-migration`.
2. Inventory current frontend API calls and data shapes.
3. Create the private Telegram storage group and grant the existing bot required permissions.
4. Configure Worker secrets and the D1 binding.
5. Implement the JSON-document storage adapter and pointer migration.
6. Implement a read-only bootstrap endpoint and test with an empty catalogue.
7. Migrate existing catalogue data from the current Apps Script/Google Sheets source.
8. Implement admin writes, media uploads, user library, ratings and statistics.
9. Switch frontend reads, then writes, behind a feature flag.
10. Test admin operations, ratings, favorites, reading lists, downloads and failure recovery.
11. Only after acceptance, update the production branch/deployment.

## Current status

- The private Telegram storage group exists and the existing bot has been added with the required message/media permissions.
- The D1 technical tables have been created and verified.
- The Worker has a scaffold and D1 binding, but the Telegram JSON-document adapter and application endpoints are not implemented yet.
- The current frontend still calls the legacy Google Apps Script API. Do not switch the live Mini App until the replacement backend and migration have been tested.
