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

The frontend remains on GitHub Pages. This backend needs a separate HTTPS runtime. Cloudflare Workers is a candidate, but no hosting provider or external index has been provisioned yet. Choose the runtime and its small durable index implementation before adding deployment-specific code.

## Required server secrets / configuration

See `.env.example`. Never commit real values. In particular, never put the bot token, storage chat ID, admin IDs, or Telegram validation secrets in `index.html`.

## Implementation status

Scaffold and contract planning only. No live Telegram storage chat has been created, no bot token has been configured, and no endpoint is deployed.
