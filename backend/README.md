# MidnightBooks backend

This folder contains the server-side API for the Telegram Mini App. GitHub Pages serves the static frontend; Cloudflare Workers runs the API.

## Responsibilities

- Validate Telegram Mini App `initData` on authenticated requests.
- Keep the Telegram bot token in server-side secrets.
- Store canonical book JSON records and media in the private Telegram storage group.
- Maintain a small D1 technical index of stable IDs, Telegram chat/message/file pointers and lookup keys.
- Enforce admin permissions on the server.
- Extend the API over time for media, user library, ratings and statistics.

## Data ownership

| Data | Canonical location |
| --- | --- |
| Book metadata, authors, series, annotations, tropes, triggers, quotes | Telegram JSON documents |
| Covers, EPUBs, arts | Telegram files/messages |
| Favorites, reading status, ratings, preferences | Private Telegram records (planned) |
| Views/download events | Telegram event/aggregate records (planned) |
| Message pointers and lookup index | Cloudflare D1 |

D1 is a technical pointer/search index only. It must not become a second copy of book content or user reading data.

## Deployment

- Frontend: GitHub Pages.
- API runtime: Cloudflare Worker `midnightbooks-api`.
- Worker source/config: this `backend/` directory, deployed from the `telegram-migration` branch.
- Technical index: Cloudflare D1 database `midnightbooks-index`, binding `DB`.
- D1 migrations: `migrations/`.

The D1 schema was initially applied manually in the Cloudflare dashboard. The `0001` migration now describes the complete initial schema, including `telegram_file_id`. The `0002` migration is intentionally a no-op because that column was added manually before Wrangler migration tracking was initialized. Do not manually execute `0002` as SQL.

## Required server secrets / configuration

See `.env.example`. Never commit real values. In particular, never put the bot token, storage chat ID, admin IDs, or Telegram validation secrets in `index.html`.

Configure secrets in the Cloudflare Worker dashboard or with Wrangler. Never paste secrets into GitHub source files or chat.

## Implementation status

- Cloudflare Worker created and GitHub integration configured for `telegram-migration`.
- D1 database created in the EU jurisdiction; core tables and indexes are present.
- D1 binding `DB` connected to the Worker.
- Private Telegram storage group created and bot added with posting/media permissions.
- Telegram bot token secret and storage chat ID configured in Worker.
- First Telegram JSON book-storage adapter implemented: create, update, soft-delete and bootstrap for book records.
- Admin Telegram user IDs are not yet configured.
- Frontend still uses the legacy Google Apps Script API and has not yet been connected to this Worker.
- Media upload/download, user library, ratings, arts management and statistics endpoints remain to be implemented and tested.

This is an in-progress migration layer, not yet a production-ready replacement for the existing app.
