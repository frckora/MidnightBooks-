/**
 * MidnightBooks API — Telegram-first storage adapter (books/bootstrap phase).
 *
 * Canonical book records are JSON documents uploaded to the private Telegram
 * storage chat. D1 stores only Telegram pointers and normalized lookup fields.
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const MAX_JSON_BYTES = 512 * 1024;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://frckora.github.io")
    .split(",").map((v) => v.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-telegram-init-data",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
}

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData) throw new Error("INIT_DATA_MISSING");
  if (!botToken) throw new Error("BOT_TOKEN_MISSING");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("INVALID_INIT_DATA");
  params.delete("hash");

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const checkString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    new TextEncoder().encode(botToken),
  );
  const calculated = hex(await hmacSha256(secretKey, new TextEncoder().encode(checkString)));
  if (!constantTimeEqual(calculated, receivedHash)) throw new Error("INVALID_INIT_DATA");

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error("EXPIRED_INIT_DATA");
  }

  let user;
  try { user = JSON.parse(params.get("user") || "null"); } catch {
    throw new Error("INVALID_USER_DATA");
  }
  if (!user || !Number.isSafeInteger(Number(user.id))) throw new Error("INVALID_USER_DATA");
  return user;
}

async function authenticate(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data")
    || (request.headers.get("Authorization") || "").replace(/^tma\s+/i, "");
  return validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
}

function getAdminIds(env) {
  return String(env.ADMIN_TELEGRAM_USER_IDS || "")
    .split(/[;,\\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAdmin(user, env) {
  return getAdminIds(env).includes(String(user.id).trim());
}

function requireAdmin(user, env) {
  if (!isAdmin(user, env)) {
    const error = new Error("FORBIDDEN");
    error.status = 403;
    throw error;
  }
}

function normalizeBook(input, existing = {}) {
  const book = { ...existing, ...input };
  const id = String(book.id || book.book_id || "").trim();
  const title = String(book.title || book.name || "").trim();
  const author = String(book.author || "").trim();
  if (!id || !title || !author) {
    const error = new Error("Book id, title and author are required");
    error.status = 400;
    throw error;
  }
  return {
    ...book,
    id,
    title,
    author,
    series: book.series ? String(book.series).trim() : "",
    series_order: book.series_order == null ? "" : String(book.series_order),
    trops: Array.isArray(book.trops) ? book.trops : [],
    triggers: Array.isArray(book.triggers) ? book.triggers : [],
    quotes: Array.isArray(book.quotes) ? book.quotes : [],
    description: String(book.description || ""),
    status: String(book.status || "published"),
    schema_version: 1,
    record_type: "book",
    updated_at: new Date().toISOString(),
    deleted_at: book.deleted_at || null,
  };
}

function normalizeText(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ru");
}

async function telegramCall(method, env, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    console.error("Telegram API operation failed:", method, response.status, payload?.error_code || "");
    const error = new Error("Telegram storage operation failed");
    error.status = 502;
    throw error;
  }
  return payload.result;
}

async function uploadJsonRecord(record, env) {
  if (!env.TELEGRAM_STORAGE_CHAT_ID) {
    const error = new Error("Telegram storage chat is not configured");
    error.status = 503;
    throw error;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  if (bytes.byteLength > MAX_JSON_BYTES) {
    const error = new Error("Record is too large");
    error.status = 413;
    throw error;
  }

  const form = new FormData();
  form.set("chat_id", env.TELEGRAM_STORAGE_CHAT_ID);
  form.set("document", new Blob([bytes], { type: "application/json" }), `${record.record_type}-${record.id}.json`);
  form.set("disable_notification", "true");
  const message = await telegramCall("sendDocument", env, form);
  const document = message.document;
  if (!document?.file_id) {
    const error = new Error("Telegram did not return a document file id");
    error.status = 502;
    throw error;
  }
  return {
    chatId: String(message.chat.id),
    messageId: Number(message.message_id),
    fileId: document.file_id,
  };
}

async function saveRecordPointer(record, pointer, env) {
  const updatedAt = record.updated_at || new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO telegram_records
      (record_type, record_id, chat_id, message_id, telegram_file_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(record_type, record_id) DO UPDATE SET
      chat_id = excluded.chat_id,
      message_id = excluded.message_id,
      telegram_file_id = excluded.telegram_file_id,
      updated_at = excluded.updated_at
  `).bind(record.record_type, record.id, pointer.chatId, pointer.messageId, pointer.fileId, updatedAt).run();

  if (record.record_type === "book") {
    await env.DB.prepare(`
      INSERT INTO book_lookup
        (book_id, normalized_title, normalized_author, series_id, series_position,
         record_chat_id, record_message_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET
        normalized_title = excluded.normalized_title,
        normalized_author = excluded.normalized_author,
        series_id = excluded.series_id,
        series_position = excluded.series_position,
        record_chat_id = excluded.record_chat_id,
        record_message_id = excluded.record_message_id,
        updated_at = excluded.updated_at
    `).bind(
      record.id, normalizeText(record.title), normalizeText(record.author),
      record.series || null, Number.parseFloat(record.series_order) || null,
      pointer.chatId, pointer.messageId, updatedAt,
    ).run();
  }
}

async function readTelegramJson(fileId, env) {
  const form = new FormData();
  form.set("file_id", fileId);
  const file = await telegramCall("getFile", env, form);
  if (!file?.file_path) throw new Error("Telegram file path is unavailable");
  const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to download Telegram record");
  const text = await response.text();
  try { return JSON.parse(text); } catch {
    throw new Error("Stored Telegram record is not valid JSON");
  }
}

async function readRecord(recordType, recordId, env) {
  const pointer = await env.DB.prepare(`
    SELECT telegram_file_id FROM telegram_records
    WHERE record_type = ? AND record_id = ?
  `).bind(recordType, recordId).first();
  if (!pointer?.telegram_file_id) return null;
  return readTelegramJson(pointer.telegram_file_id, env);
}

async function readAllBooks(env) {
  const rows = await env.DB.prepare(`
    SELECT record_id, telegram_file_id FROM telegram_records
    WHERE record_type = 'book' AND telegram_file_id IS NOT NULL
    ORDER BY updated_at DESC
  `).all();
  const books = [];
  for (const row of rows.results || []) {
    try {
      const book = await readTelegramJson(row.telegram_file_id, env);
      if (book && !book.deleted_at) books.push({ ...book, cover_url: book.cover_media_id ? `/api/v1/media/${book.cover_media_id}` : book.cover_url });
    } catch (error) {
      console.error("Unable to read stored book record:", row.record_id, error.message);
    }
  }
  return books;
}


async function sendUserMessage(chatId, text, env) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("text", text);
  form.set("disable_web_page_preview", "true");
  return telegramCall("sendMessage", env, form);
}

async function notifyNewBook(book, env) {
  const rows = await env.DB.prepare("SELECT telegram_user_id FROM notification_subscriptions WHERE active = 1").all();
  const title = String(book.title || "Новая книга");
  const author = String(book.author || "");
  const text = `В MidnightBooks вышла новая книга!\n\n${title}${author ? "\n" + author : ""}\n\nОткрыть библиотеку: https://t.me/Midnight_library1_Bot/MidnightBooks`;
  const subscribers = rows.results || [];
  const results = await Promise.allSettled(subscribers.map(row => sendUserMessage(row.telegram_user_id, text, env)));
  const blocked = results.map((result, index) => result.status === "rejected" ? subscribers[index].telegram_user_id : null).filter(Boolean);
  if (blocked.length) {
    const stmt = env.DB.prepare("UPDATE notification_subscriptions SET active = 0, updated_at = ? WHERE telegram_user_id = ?");
    await Promise.allSettled(blocked.map(id => stmt.bind(new Date().toISOString(), String(id)).run()));
  }
  return { sent: results.filter(result => result.status === "fulfilled").length, failed: blocked.length };
}

async function saveWelcomeText(value, env) {
  const existing = await readRecord("settings", "welcome", env);
  const record = {
    id: "welcome", record_type: "settings", text: String(value || "").slice(0, 4000),
    schema_version: 1, updated_at: new Date().toISOString()
  };
  const pointer = await uploadJsonRecord(record, env);
  await saveRecordPointer(record, pointer, env);
  return record.text;
}

async function storeMediaFile(file, mediaType, ownerId, env) {
  if (!file || !file.size || file.size > 10 * 1024 * 1024 || !String(file.type || "").startsWith("image/")) {
    const error = new Error("Choose an image up to 10 MB");
    error.status = 400;
    throw error;
  }
  const form = new FormData();
  form.set("chat_id", env.TELEGRAM_STORAGE_CHAT_ID);
  form.set("document", file, file.name || "image");
  form.set("disable_notification", "true");
  const message = await telegramCall("sendDocument", env, form);
  const doc = message.document;
  if (!doc?.file_id) throw new Error("Telegram did not return media file id");
  const mediaId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO media_pointers (media_id, book_id, media_type, chat_id, message_id, telegram_file_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(mediaId, String(ownerId), mediaType, String(message.chat.id), Number(message.message_id), doc.file_id, new Date().toISOString()).run();
  return { mediaId, fileId: doc.file_id };
}

async function mediaResponse(mediaId, env) {
  const row = await env.DB.prepare("SELECT telegram_file_id FROM media_pointers WHERE media_id = ?").bind(mediaId).first();
  if (!row?.telegram_file_id) return json({ success: false, error: "Media not found" }, 404);
  const form = new FormData(); form.set("file_id", row.telegram_file_id);
  const file = await telegramCall("getFile", env, form);
  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) return json({ success: false, error: "Unable to load media" }, 502);
  return new Response(response.body, { status: 200, headers: {
    "content-type": response.headers.get("content-type") || "application/octet-stream",
    "cache-control": "public, max-age=86400, immutable",
    "x-content-type-options": "nosniff"
  }});
}

async function readJsonBody(request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    const error = new Error("Request body is too large");
    error.status = 413;
    throw error;
  }
  try { return JSON.parse(raw); } catch {
    const error = new Error("Request body must be valid JSON");
    error.status = 400;
    throw error;
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/v1/health") {
    return json({ success: true, service: "midnightbooks-api", status: "telegram-books-adapter" });
  }
  if (path === "/api/v1" || path === "/api/v1/") {
    return json({ success: true, service: "midnightbooks-api", version: 1 });
  }

  const mediaMatch = path.match(/^\/api\/v1\/media\/([a-f0-9-]+)$/i);
  if (method === "GET" && mediaMatch) return mediaResponse(mediaMatch[1], env);

  let user;
  try { user = await authenticate(request, env); } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_FAILED";
    return json({ success: false, error: "Telegram authentication failed", code }, 401);
  }

  if (method === "GET" && path === "/api/v1/me") {
    const adminIds = getAdminIds(env);
    return json({
      success: true,
      user: { id: String(user.id) },
      isAdmin: adminIds.includes(String(user.id).trim()),
      diagnostics: {
        adminConfigPresent: adminIds.length > 0,
        adminIdCount: adminIds.length,
      },
    });
  }

  if (method === "GET" && path === "/api/v1/bootstrap") {
    const books = await readAllBooks(env);
    const welcome = await readRecord("settings", "welcome", env);
    const subscription = await env.DB.prepare(
      "SELECT active FROM notification_subscriptions WHERE telegram_user_id = ?"
    ).bind(String(user.id)).first();
    const artRows = await env.DB.prepare(
      "SELECT record_id, telegram_file_id FROM telegram_records WHERE record_type = 'art' AND telegram_file_id IS NOT NULL ORDER BY updated_at DESC"
    ).all();
    const arts = [];
    for (const row of artRows.results || []) {
      try { const art = await readTelegramJson(row.telegram_file_id, env); if (art && !art.deleted_at) arts.push({ ...art, image_url: art.media_id ? `${new URL(request.url).origin}/api/v1/media/${art.media_id}` : art.image_url }); }
      catch (error) { console.error("Unable to read art:", row.record_id, error.message); }
    }
    return json({
      success: true, books, covers: [], files: [], arts,
      stats: [], ratings: [], music: [], announcements: [],
      welcomeText: welcome?.text || "",
      notificationsSubscribed: !!subscription?.active,
      migrationStatus: "telegram-books-active",
    });
  }

  const coverMatch = path.match(/^\/api\/v1\/books\/([^/]+)\/cover$/);
  if (coverMatch && method === "POST") {
    requireAdmin(user, env);
    const id = decodeURIComponent(coverMatch[1]);
    const existing = await readRecord("book", id, env);
    if (!existing || existing.deleted_at) return json({ success: false, error: "Book not found" }, 404);
    const form = await request.formData();
    const file = form.get("file");
    const media = await storeMediaFile(file, "cover", id, env);
    const record = { ...existing, cover_media_id: media.mediaId, cover_emoji: "", cover_url: `${new URL(request.url).origin}/api/v1/media/${media.mediaId}`, updated_at: new Date().toISOString() };
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    return json({ success: true, cover_url: record.cover_url, media_id: media.mediaId });
  }

  if (path === "/api/v1/notifications/subscription" && (method === "POST" || method === "DELETE")) {
    const active = method === "POST" ? 1 : 0;
    if (active) {
      try { await sendUserMessage(user.id, "Вы подписались на уведомления о новых книгах MidnightBooks. Когда в библиотеке появится новая книга, мы сообщим вам здесь."); }
      catch (error) {
        return json({ success: false, error: "Сначала откройте бота @Midnight_library1_Bot и нажмите Start, затем повторите подписку.", code: "BOT_NOT_STARTED" }, 409);
      }
    }
    await env.DB.prepare(`
      INSERT INTO notification_subscriptions (telegram_user_id, active, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET active = excluded.active, updated_at = excluded.updated_at
    `).bind(String(user.id), active, new Date().toISOString()).run();
    return json({ success: true, subscribed: !!active });
  }

  const artMatch = path.match(/^\/api\/v1\/arts\/([^/]+)$/);
  if (path === "/api/v1/arts" && method === "POST") {
    requireAdmin(user, env);
    const form = await request.formData();
    const id = String(form.get("id") || "").trim();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "");
    const file = form.get("file");
    if (!id || !title || !file) return json({ success: false, error: "Art title and image file are required" }, 400);
    const existing = await readRecord("art", id, env);
    if (existing && !existing.deleted_at) return json({ success: false, error: "Art already exists" }, 409);
    const media = await storeMediaFile(file, "art", id, env);
    const record = { id, title, description, media_id: media.mediaId, image_url: `${new URL(request.url).origin}/api/v1/media/${media.mediaId}`, record_type: "art", schema_version: 1, updated_at: new Date().toISOString(), deleted_at: null };
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    return json({ success: true, id, image_url: record.image_url }, 201);
  }
  if (artMatch && method === "DELETE") {
    requireAdmin(user, env);
    const id = decodeURIComponent(artMatch[1]);
    const existing = await readRecord("art", id, env);
    if (!existing || existing.deleted_at) return json({ success: false, error: "Art not found" }, 404);
    const record = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    return json({ success: true, id, deleted: true });
  }

  if (path === "/api/v1/settings/welcome" && method === "PUT") {
    requireAdmin(user, env);
    const body = await readJsonBody(request);
    const text = await saveWelcomeText(body.text || "", env);
    return json({ success: true, welcomeText: text });
  }

  if (path === "/api/v1/books" && method === "POST") {
    requireAdmin(user, env);
    const body = await readJsonBody(request);
    const record = normalizeBook(body.book || body);
    const existing = await readRecord("book", record.id, env);
    if (existing && !existing.deleted_at) {
      return json({ success: false, error: "Book already exists", code: "CONFLICT" }, 409);
    }
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    let notifications = { sent: 0, failed: 0 };
    if (record.status === "published" || record.status === "active") {
      try { notifications = await notifyNewBook(record, env); }
      catch (error) { console.error("New-book notifications failed:", error.message); }
    }
    return json({ success: true, id: record.id, notifications }, 201);
  }

  const bookMatch = path.match(/^\/api\/v1\/books\/([^/]+)$/);
  if (bookMatch && method === "PATCH") {
    requireAdmin(user, env);
    const id = decodeURIComponent(bookMatch[1]);
    const existing = await readRecord("book", id, env);
    if (!existing || existing.deleted_at) {
      return json({ success: false, error: "Book not found", code: "NOT_FOUND" }, 404);
    }
    const body = await readJsonBody(request);
    const record = normalizeBook(body.book || body, existing);
    if (record.id !== id) {
      return json({ success: false, error: "Book id cannot be changed", code: "VALIDATION_ERROR" }, 400);
    }
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    return json({ success: true, id });
  }

  if (bookMatch && method === "DELETE") {
    requireAdmin(user, env);
    const id = decodeURIComponent(bookMatch[1]);
    const existing = await readRecord("book", id, env);
    if (!existing || existing.deleted_at) {
      return json({ success: false, error: "Book not found", code: "NOT_FOUND" }, 404);
    }
    const record = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const pointer = await uploadJsonRecord(record, env);
    await saveRecordPointer(record, pointer, env);
    return json({ success: true, id, deleted: true });
  }

  return json({ success: false, error: "Endpoint not implemented yet", code: "NOT_IMPLEMENTED" }, 501);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      const response = await route(request, env);
      const merged = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) merged.set(key, value);
      return new Response(response.body, { status: response.status, headers: merged });
    } catch (error) {
      console.error("MidnightBooks API error:", error instanceof Error ? error.message : "unknown");
      return json(
        { success: false, error: error.message || "Internal server error", code: error.status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR" },
        error.status || 500,
        headers,
      );
    }
  },
};
