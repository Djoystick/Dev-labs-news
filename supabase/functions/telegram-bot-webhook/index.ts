/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const START_PAYLOAD = "for_you";
const START_TEXT = [
  "Привет! Это Dev-labs News.",
  "Здесь есть обычная Лента и Умная лента.",
  "Откройте приложение кнопкой ниже.",
].join("\n");

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

type TelegramUpdate = {
  edited_message?: TelegramMessage;
  message?: TelegramMessage;
};

type TelegramMessage = {
  chat?: {
    id?: number | string | null;
  } | null;
  text?: string | null;
};

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

type ServerEnv = {
  botToken: string;
  botUsername: string;
  miniAppShortName: string | null;
  webhookSecretToken: string | null;
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

function normalizeBotUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/u, "");
  return normalized || null;
}

function normalizeMiniAppShortName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^\/+/u, "").replace(/\/+$/u, "");
  return normalized || null;
}

function getRequiredServerEnv(): ServerEnv {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const botUsername = normalizeBotUsername(getEnvWithFallback("TELEGRAM_BOT_USERNAME", "VITE_TELEGRAM_BOT_USERNAME") ?? null);
  const miniAppShortName = normalizeMiniAppShortName(
    getEnvWithFallback("TELEGRAM_MINI_APP_SHORT_NAME", "VITE_TELEGRAM_MINI_APP_SHORT_NAME") ?? null,
  );
  const webhookSecretToken = Deno.env.get("TELEGRAM_WEBHOOK_SECRET_TOKEN")?.trim() ?? null;

  if (!botToken || !botUsername) {
    throw new HttpError(500, "Server misconfigured");
  }

  return {
    botToken,
    botUsername,
    miniAppShortName,
    webhookSecretToken,
  };
}

function ensureWebhookAuthorized(request: Request, expectedSecretToken: string | null) {
  if (!expectedSecretToken) {
    return;
  }

  const providedSecretToken = request.headers.get("x-telegram-bot-api-secret-token");
  if (!providedSecretToken || providedSecretToken !== expectedSecretToken) {
    throw new HttpError(401, "Unauthorized");
  }
}

function buildMiniAppStartAppUrl(botUsername: string, miniAppShortName: string | null, startPayload: string) {
  const encodedPayload = encodeURIComponent(startPayload);
  if (miniAppShortName) {
    return `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodedPayload}`;
  }

  return `https://t.me/${botUsername}?startapp=${encodedPayload}`;
}

function buildStartReplyMarkup(botUsername: string, miniAppShortName: string | null): TelegramReplyMarkup {
  const deepLink = buildMiniAppStartAppUrl(botUsername, miniAppShortName, START_PAYLOAD);

  return {
    inline_keyboard: [
      [
        {
          text: "Открыть приложение",
          url: deepLink,
        },
      ],
    ],
  };
}

function isStartCommand(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^\/start(?:@\w+)?(?:\s+.*)?$/u.test(value.trim());
}

function normalizeChatId(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
    return String(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^-?\d+$/u.test(normalized) && normalized !== "0") {
      return normalized;
    }
  }

  return null;
}

function getMessageFromUpdate(update: TelegramUpdate) {
  return update.message ?? update.edited_message ?? null;
}

async function parseTelegramUpdate(request: Request): Promise<TelegramUpdate> {
  try {
    return (await request.json()) as TelegramUpdate;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup: TelegramReplyMarkup,
) {
  const payload = {
    chat_id: chatId,
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
    text,
  };

  console.log("telegram-bot-webhook sendMessage payload", {
    hasInlineKeyboard: Boolean(replyMarkup.inline_keyboard?.length),
    replyMarkupKeys: Object.keys(replyMarkup),
  });

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let telegramPayload: { description?: string; ok?: boolean } | null = null;
    if (raw) {
      try {
        telegramPayload = JSON.parse(raw) as { description?: string; ok?: boolean } | null;
      } catch {
        telegramPayload = null;
      }
    }

    if (response.ok && telegramPayload?.ok !== false) {
      return { error: null, ok: true };
    }

    console.error("telegram-bot-webhook Telegram API error", {
      responseStatus: response.status,
      responseText: raw || null,
    });

    return { error: telegramPayload?.description ?? "Telegram API returned an error.", ok: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram sendMessage failed.";
    return { error: message, ok: false };
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
    const { botToken, botUsername, miniAppShortName, webhookSecretToken } = getRequiredServerEnv();
    ensureWebhookAuthorized(request, webhookSecretToken);

    const update = await parseTelegramUpdate(request);
    const message = getMessageFromUpdate(update);
    const messageText = message?.text?.trim() ?? null;

    if (!isStartCommand(messageText)) {
      return jsonResponse({ ignored: true, ok: true });
    }

    const chatId = normalizeChatId(message?.chat?.id ?? null);
    if (!chatId) {
      return jsonResponse({ ignored: true, ok: true });
    }

    const replyMarkup = buildStartReplyMarkup(botUsername, miniAppShortName);
    const sendResult = await sendTelegramMessage(botToken, chatId, START_TEXT, replyMarkup);
    if (!sendResult.ok) {
      throw new HttpError(502, sendResult.error ?? "Telegram sendMessage failed.");
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("telegram-bot-webhook failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
