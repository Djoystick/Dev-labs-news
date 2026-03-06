/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

const TEST_TEXT = "✅ Тест уведомлений Dev-labs-news. Всё работает.";
const encoder = new TextEncoder();

type ProfileTelegramSettings = {
  telegram_notifications_enabled: boolean;
  telegram_user_id: number | string | null;
};

type TelegramUser = {
  id: number;
};

type TelegramSendTestBody = {
  initData?: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

function getEnvWithFallback(primary: string, fallback?: string) {
  return Deno.env.get(primary) ?? (fallback ? Deno.env.get(fallback) : undefined);
}

function getRequiredServerEnv() {
  const url = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const anon = getEnvWithFallback("ANON_KEY", "SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anon || !serviceRoleKey) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { anon, serviceRoleKey, url };
}

function normalizeTelegramUserId(value: number | string | null): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^\d+$/u.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signHmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const rawKey = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(encoder.encode(message)));

  return new Uint8Array(signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function parseTelegramUser(rawUser: string | null): TelegramUser {
  if (!rawUser) {
    throw new HttpError(401, "Invalid initData hash");
  }

  try {
    const parsed = JSON.parse(rawUser) as { id?: number };
    if (!Number.isInteger(parsed.id) || (parsed.id ?? 0) <= 0) {
      throw new HttpError(401, "Invalid initData hash");
    }

    return { id: parsed.id as number };
  } catch {
    throw new HttpError(401, "Invalid initData hash");
  }
}

async function verifyTelegramInitData(initData: string, botToken: string): Promise<TelegramUser> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new HttpError(401, "Invalid initData hash");
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await signHmacSha256("WebAppData", botToken);
  const calculatedHash = bytesToHex(await signHmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(calculatedHash, hash)) {
    throw new HttpError(401, "Invalid initData hash");
  }

  return parseTelegramUser(params.get("user"));
}

async function parseRequestBody(request: Request): Promise<TelegramSendTestBody> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as TelegramSendTestBody;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

async function resolveUserIdFromJwt(url: string, anon: string, authorization: string | null): Promise<string | null> {
  if (!authorization || !/^Bearer\s+.+/iu.test(authorization.trim())) {
    return null;
  }

  const asUser = createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });

  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user?.id) {
    return null;
  }

  return data.user.id;
}

async function loadProfileByUserId(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("telegram_user_id, telegram_notifications_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data as ProfileTelegramSettings | null) ?? null;
}

async function loadProfileByTelegramUserId(serviceClient: ReturnType<typeof createClient>, telegramUserId: number) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("telegram_user_id, telegram_notifications_enabled")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data as ProfileTelegramSettings | null) ?? null;
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const telegramResp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (telegramResp.ok) {
    return { message: null, ok: true };
  }

  const raw = await telegramResp.text();
  let message = raw || "Telegram API returned an error.";

  try {
    const parsed = JSON.parse(raw) as { description?: string; error_code?: number };
    if (typeof parsed.description === "string" && parsed.description.trim()) {
      message = parsed.description.trim();
    } else if (typeof parsed.error_code === "number") {
      message = `Telegram error code ${parsed.error_code}`;
    }
  } catch {
    // Keep raw text for diagnostics when JSON parsing fails.
  }

  return { message, ok: false };
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  if (!botToken) {
    return jsonResponse({ error: "Missing env", missing: ["TELEGRAM_BOT_TOKEN"] }, 500);
  }

  try {
    const { anon, serviceRoleKey, url } = getRequiredServerEnv();
    const serviceClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await parseRequestBody(request);
    const initData = typeof body.initData === "string" ? body.initData.trim() : "";

    const authorization = request.headers.get("authorization") ?? request.headers.get("Authorization");
    const jwtUserId = await resolveUserIdFromJwt(url, anon, authorization);

    let settings: ProfileTelegramSettings | null = null;

    if (jwtUserId) {
      settings = await loadProfileByUserId(serviceClient, jwtUserId);
    }

    if (!settings) {
      if (!initData) {
        return jsonResponse({ error: "Missing auth", hint: "Provide Authorization or initData" }, 401);
      }

      const telegramUser = await verifyTelegramInitData(initData, botToken);
      settings = await loadProfileByTelegramUserId(serviceClient, telegramUser.id);
    }

    const telegramUserId = normalizeTelegramUserId(settings?.telegram_user_id ?? null);

    if (!telegramUserId) {
      throw new HttpError(400, "Telegram не привязан. Сначала привяжите аккаунт Telegram.");
    }

    if (!settings?.telegram_notifications_enabled) {
      throw new HttpError(400, "Уведомления в Telegram выключены. Включите их в настройках.");
    }

    const telegramSendResult = await sendTelegramMessage(botToken, telegramUserId, TEST_TEXT);
    if (!telegramSendResult.ok) {
      return jsonResponse(
        {
          error: "Telegram API error",
          message: telegramSendResult.message,
        },
        400,
      );
    }

    return jsonResponse({
      ok: true,
      message: "Тестовое сообщение отправлено.",
    });
  } catch (err) {
    if (err instanceof HttpError && (err.status === 400 || err.status === 401 || err.status === 403)) {
      return jsonResponse({ error: err.message }, err.status);
    }

    console.error("telegram-send-test error:", err);
    return jsonResponse(
      {
        error: "Internal error",
        message: String((err as { message?: unknown } | null)?.message ?? err),
      },
      500,
    );
  }
});
