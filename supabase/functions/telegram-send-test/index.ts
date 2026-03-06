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
  const bot = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (!url || !anon || !bot) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { anon, bot, url };
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

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  let payload: { description?: string; ok?: boolean } | null = null;

  try {
    payload = (await response.json()) as { description?: string; ok?: boolean };
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    const description = typeof payload?.description === "string"
      ? payload.description
      : "Telegram API returned an error.";
    const lowered = description.toLowerCase();
    if (
      lowered.includes("chat not found")
      || lowered.includes("bot was blocked")
      || lowered.includes("forbidden")
      || lowered.includes("user is deactivated")
      || lowered.includes("have no rights")
    ) {
      throw new HttpError(400, "Не удалось отправить тест. Откройте бота и нажмите Start, затем повторите попытку.");
    }

    throw new HttpError(502, `Telegram sendMessage failed: ${description}`);
  }
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = getAuthorizationHeader(request);
    const { anon, bot, url } = getRequiredServerEnv();
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

    await sendTelegramMessage(bot, telegramUserId, TEST_TEXT);

    return jsonResponse({
      ok: true,
      message: "Тестовое сообщение отправлено.",
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("telegram-send-test failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
