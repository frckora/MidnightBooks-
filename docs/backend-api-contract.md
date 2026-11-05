# MidnightBooks backend API contract (migration draft)

Base path: `/api/v1`. All responses are JSON. Authenticated requests must include Telegram Mini App `initData` in an Authorization header or the documented request header. The server validates Telegram's signature and `auth_date`; the client must never send a trusted user_id as proof of identity.

## Telegram record storage

Canonical metadata is stored as UTF-8 JSON documents in the private Telegram storage group. D1 stores each record's `record_type`, `record_id`, `chat_id`, `message_id`, `telegram_file_id` and `updated_at`. The Worker reads a record by resolving its pointer in D1, calling Telegram `getFile` with the stored `file_id`, and downloading the returned file path. Do not attempt to read arbitrary chat history by message ID; the Bot API does not provide that operation.

Writes upload the new JSON document first and update the D1 pointer only after Telegram confirms success. A failed upload must leave the previous pointer intact.

## Bootstrap

### GET /bootstrap

Returns the catalogue payload expected by the current frontend adapter:

```json
{
  "success": true,
  "books": [],
  "covers": [],
  "files": [],
  "arts": [],
  "stats": [],
  "ratings": [],
  "music": [],
  "announcements": []
}
```

The migration UI will stop using playlists and announcements; these fields exist only during compatibility transition and should eventually be removed.

## Catalogue administration

- `POST /books` — create a book JSON record in Telegram and write its pointer to the technical index.
- `PATCH /books/{bookId}` — upload an updated book JSON record and replace its pointer.
- `DELETE /books/{bookId}` — soft-delete a book record; physical deletion is a separate admin-only maintenance action.
- `POST /books/{bookId}/cover` — upload a cover to Telegram and associate its message/file pointer.
- `POST /books/{bookId}/epub` — upload an EPUB to Telegram and associate its message/file pointer.
- `POST /books/{bookId}/arts` — upload one or more gallery images.
- `DELETE /media/{mediaId}` — remove a media association; Telegram deletion requires a separate explicit admin action.

All admin endpoints require a server-verified Telegram user ID in the configured admin allow-list.

## User library

- `GET /me/library` — return the current user's favorites, reading statuses and ratings from Telegram JSON records.
- `PUT /me/books/{bookId}` — upsert the current user's status/favorite state.
- `PUT /me/books/{bookId}/rating` — set a rating from 1 to 5.

The server derives the user ID from verified initData. It ignores/rejects a client-supplied user_id.

## Statistics

- `POST /books/{bookId}/events` — record a view or download event in Telegram.
- `GET /stats` — admin-only aggregate statistics.

## Media delivery

- `GET /media/{mediaId}` — authorize and deliver or redirect to a Telegram-hosted file using the stored pointer.
- EPUB downloads must be checked against access rules and rate limits before the server requests the Telegram file.

## Error shape

```json
{
  "success": false,
  "error": "Human-readable error",
  "code": "VALIDATION_ERROR"
}
```

## Compatibility notes from current index.html

The current frontend calls one Apps Script bootstrap endpoint, sends book create/update/delete actions, uploads cover/EPUB as base64, records views/downloads, and saves ratings. During migration, replace those calls with this API adapter. Do not expose the old Apps Script URL or client-side admin password in the new production frontend.

The existing upload limits in the old UI (10 MiB cover, 20 MiB EPUB) are frontend checks only; the backend must independently enforce limits and Telegram Bot API constraints.
