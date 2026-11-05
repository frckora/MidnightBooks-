# MidnightBooks backend

This folder is the server-side API layer for the Telegram Mini App. It is intentionally separate from GitHub Pages: GitHub Pages serves the static `index.html` only and cannot run this backend.

## Responsibilities

- Validate Telegram Mini App `initData` on every authenticated request.
- Keep the Telegram bot token in server-side secrets.
- Read/write canonical book records and media in the private Telegram storage group.
- Maintain a small technical index (stable IDs, chat/message IDs, file IDs, lookup keys and cursors). The index is not the catalogue/content database.
- Enforce admin permissions on the server.
- Provide bootstrap, book CRUD, media upload/download, user library, ratings and statistics endpoints.

## Data ownership

| Data | Canonical location |
| --- | --- |
| Book metadata, authors, series, annotations, tropes, triggers, quotes | Telegram messages |
| Covers, EPUBs, arts | Telegram files/messages |
| Favorites, reading status, ratings, preferences | Private Telegram records |
| Views/download events | Telegram event/aggregate records |
| Message pointers and lookup index | Small technical index service |

The technical index may contain identifiers and lookup metadata only. It must not become a second copy of book content or user reading data.

## Deployment

- Frontend: GitHub Pages.
- API runtime: Cloudflare Worker `midnightbooks-api`.
- Worker source/config: this `backend/` directory, deployed from the `telegram-migration` branch.
- Technical index: Cloudflare D1 database `midnightbooks-index`, binding `DB`.
- D1 schema: `migrations/0001_technical_index.sql`.

The first deployment is only an API scaffold. It is not yet connected to Telegram storage and must not be treated as a production-ready catalogue backend.

## Required server secrets / configuration

See `.env.example`. Never commit real values. In particular, never put the bot token, storage chat ID, admin IDs, or Telegram validation secrets in `index.html`.

Configure secrets in the Cloudflare Worker dashboard or with Wrangler. Never paste secrets into GitHub source files or chat.

## Implementation status

- Cloudflare Worker created and GitHub integration configured for `telegram-migration`.
- D1 database created in the EU jurisdiction and technical schema applied.
- D1 binding `DB` connected to the Worker.
- Telegram storage group, bot token secret, storage adapter, and full API endpoints are not yet configured.
