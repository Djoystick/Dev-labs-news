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

type ProfileTelegramSettings = {
  telegram_notifications_enabled: boolean;
  telegram_user_id: number | string | null;
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

  if (!url || !anon) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { anon, url };
}

function getAuthorizationHeader(request: Request) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    throw new HttpError(401, "Missing Authorization header");
  }

  return authorization;
}

async function getCurrentUserId(url: string, anon: string, authorization: string) {
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
    throw new HttpError(401, "Unauthorized");
  }

  return { asUser, userId: data.user.id };
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
    const parsed = JSON.parse(raw) as { description?: string; error_code?: number; ok?: boolean };
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

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  if (!token) {
    return jsonResponse({ error: "Missing env", missing: ["TELEGRAM_BOT_TOKEN"] }, 500);
  }

  try {
    const authorization = getAuthorizationHeader(request);
    const { anon, url } = getRequiredServerEnv();
    const { asUser, userId } = await getCurrentUserId(url, anon, authorization);
    const profileResult = await asUser
      .from("profiles")
      .select("telegram_user_id, telegram_notifications_enabled")
      .eq("id", userId)
      .maybeSingle();

    if (profileResult.error) {
      throw new HttpError(500, profileResult.error.message);
    }

    const settings = profileResult.data as ProfileTelegramSettings | null;
    const telegramUserId = normalizeTelegramUserId(settings?.telegram_user_id ?? null);

    if (!telegramUserId) {
      throw new HttpError(400, "Telegram не привязан. Сначала привяжите аккаунт Telegram.");
    }

    if (!settings?.telegram_notifications_enabled) {
      throw new HttpError(400, "Уведомления в Telegram выключены. Включите их в настройках.");
    }

    const telegramSendResult = await sendTelegramMessage(token, telegramUserId, TEST_TEXT);
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
