/**
 * MidnightBooks API — Cloudflare Worker scaffold.
 *
 * This is a scaffold, not a deployed production API.
 * Configure TELEGRAM_BOT_TOKEN and ADMIN_TELEGRAM_USER_IDS as Worker secrets.
 * Bind the D1 technical pointer index as DB (see wrangler.toml).
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = (env.ALLOWED_ORIGINS || "https://frckora.github.io")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.includes(origin) ? origin : "";
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-telegram-init-data",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Validate Telegram Mini App initData according to Telegram's WebApp validation
 * algorithm. Returns parsed user data only after signature and auth_date checks.
 */
async function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) throw new Error("AUTH_REQUIRED");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("INVALID_INIT_DATA");
  params.delete("hash");

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");

  // Telegram's WebApp secret key: HMAC_SHA256("WebAppData", bot_token)
  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    new TextEncoder().encode(botToken),
  );
  const calculatedHash = hex(await hmacSha256(secretKey, dataCheckString));

  if (!constantTimeEqual(calculatedHash, receivedHash)) throw new Error("INVALID_INIT_DATA");

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error("EXPIRED_INIT_DATA");
  }

  let user = null;
  const rawUser = params.get("user");
  if (rawUser) {
    try { user = JSON.parse(rawUser); } catch { throw new Error("INVALID_USER_DATA"); }
  }
  if (!user || !Number.isSafeInteger(Number(user.id))) throw new Error("INVALID_USER_DATA");

  return { user, authDate };
}

async function authenticate(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data")
    || (request.headers.get("Authorization") || "").replace(/^tma\s+/i, "");

  const validated = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  return validated.user;
}

function isAdmin(user, env) {
  const ids = (env.ADMIN_TELEGRAM_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(String(user.id));
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/api/v1/health") {
    return json({ success: true, service: "midnightbooks-api", status: "scaffold" });
  }

  if (path === "/api/v1" || path === "/api/v1/") {
    return json({ success: true, service: "midnightbooks-api", version: 1 });
  }

  // All routes below this point require verified Telegram Mini App initData.
  let user;
  try {
    user = await authenticate(request, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_FAILED";
    return json({ success: false, error: "Telegram authentication failed", code }, 401);
  }

  if (method === "GET" && path === "/api/v1/bootstrap") {
    // TODO: load Telegram canonical records via the Telegram storage adapter,
    // using D1 only for message pointers and search/index metadata.
    return json({
      success: true,
      books: [],
      covers: [],
      files: [],
      arts: [],
      stats: [],
      ratings: [],
      music: [],
      announcements: [],
      migrationStatus: "storage-adapter-not-configured",
    });
  }

  if (path.startsWith("/api/v1/admin/") && !isAdmin(user, env)) {
    return json({ success: false, error: "Administrator access required", code: "FORBIDDEN" }, 403);
  }

  // Catalogue, media, user-library and statistics handlers are added only after
  // the private Telegram storage group and D1 binding have been provisioned.
  return json({ success: false, error: "Endpoint not implemented yet", code: "NOT_IMPLEMENTED" }, 501);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      const response = await route(request, env);
      const merged = new Headers(response.headers);
      for (const [key, value] of Object.entries(headers)) merged.set(key, value);
      return new Response(response.body, { status: response.status, headers: merged });
    } catch (error) {
      // Do not log secrets, initData, or request bodies.
      console.error("MidnightBooks API error:", error instanceof Error ? error.message : "unknown");
      return json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500, headers);
    }
  },
};
