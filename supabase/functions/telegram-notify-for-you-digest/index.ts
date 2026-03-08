/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildMiniAppForYouUrl,
  normalizeBotUsername,
} from "../_shared/miniapp-links.ts";

const MAX_SEND_PER_RUN = 100;
const DIGEST_TEXT = "Ваша подборка готова";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

type DigestRecipientProfile = {
  id: string;
  for_you_digest_threshold: number | null;
  telegram_notifications_enabled: boolean;
  telegram_user_id: number | string | null;
};

type DigestStateRow = {
  current_bucket: number;
  user_id: string;
};

type DigestStatsRow = {
  candidate_count: number | null;
  newest_post_created_at: string | null;
};

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

type Summary = {
  errorsCount: number;
  processedUsers: number;
  sent: number;
  skippedBelowThreshold: number;
  skippedBudget: number;
  skippedNoBucketProgress: number;
  skippedInvalidChatId: number;
  syncedDown: number;
  totalCandidates: number;
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
  const supabaseUrl = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const serviceRoleKey = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const botUsername = normalizeBotUsername(getEnvWithFallback("TELEGRAM_BOT_USERNAME", "VITE_TELEGRAM_BOT_USERNAME") ?? null);
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !botToken || !botUsername || !cronSecret) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { botToken, botUsername, cronSecret, serviceRoleKey, supabaseUrl };
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

function normalizeThreshold(value: number | null | undefined): 10 | 20 | 30 {
  if (value === 20 || value === 30) {
    return value;
  }

  return 10;
}

function normalizeCandidateCount(value: number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function ensureCronAuthorized(request: Request, expectedSecret: string) {
  const providedSecret = request.headers.get("x-cron-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new HttpError(401, "Unauthorized");
  }
}

function buildDigestReplyMarkup(botUsername: string): TelegramReplyMarkup {
  const miniAppUrl = buildMiniAppForYouUrl(botUsername);
  if (!miniAppUrl) {
    throw new HttpError(500, "Server misconfigured");
  }

  return {
    inline_keyboard: [
      [
        {
          text: "Открыть подборку",
          url: miniAppUrl,
        },
      ],
    ],
  };
}

function toInlineReplyMarkup(replyMarkup: TelegramReplyMarkup): TelegramReplyMarkup {
  return {
    inline_keyboard: replyMarkup.inline_keyboard.map((row) =>
      row.map((button) => ({
        text: button.text,
        url: button.url,
      })),
    ),
  };
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string, replyMarkup: TelegramReplyMarkup) {
  const inlineReplyMarkup = toInlineReplyMarkup(replyMarkup);
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    disable_web_page_preview: true,
    reply_markup: inlineReplyMarkup,
    text,
  };

  console.log("telegram-notify-for-you-digest sendMessage payload", {
    hasInlineKeyboard: Boolean(inlineReplyMarkup.inline_keyboard?.length),
    replyMarkupKeys: Object.keys(inlineReplyMarkup),
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

    console.error("telegram-notify-for-you-digest Telegram API error", {
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
    const { botToken, botUsername, cronSecret, serviceRoleKey, supabaseUrl } = getRequiredServerEnv();
    ensureCronAuthorized(request, cronSecret);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const recipientsResult = await supabase
      .from("profiles")
      .select("id, telegram_user_id, telegram_notifications_enabled, for_you_digest_enabled, for_you_digest_threshold")
      .eq("for_you_digest_enabled", true)
      .eq("telegram_notifications_enabled", true)
      .not("telegram_user_id", "is", null);

    if (recipientsResult.error) {
      throw new HttpError(500, recipientsResult.error.message);
    }

    const recipients = (recipientsResult.data ?? []) as DigestRecipientProfile[];
    const summary: Summary = {
      errorsCount: 0,
      processedUsers: 0,
      sent: 0,
      skippedBelowThreshold: 0,
      skippedBudget: 0,
      skippedInvalidChatId: 0,
      skippedNoBucketProgress: 0,
      syncedDown: 0,
      totalCandidates: recipients.length,
    };

    console.log("telegram-notify-for-you-digest candidates", {
      totalCandidates: recipients.length,
    });

    if (recipients.length === 0) {
      return jsonResponse({
        ...summary,
        ok: true,
        runLimit: MAX_SEND_PER_RUN,
      });
    }

    const recipientIds = recipients.map((recipient) => recipient.id);
    const statesResult = await supabase
      .from("for_you_digest_state")
      .select("user_id, current_bucket")
      .in("user_id", recipientIds);

    if (statesResult.error) {
      throw new HttpError(500, statesResult.error.message);
    }

    const stateByUserId = new Map<string, DigestStateRow>(
      ((statesResult.data ?? []) as DigestStateRow[]).map((state) => [state.user_id, state]),
    );
    const replyMarkup = buildDigestReplyMarkup(botUsername);

    for (const recipient of recipients) {
      summary.processedUsers += 1;

      const threshold = normalizeThreshold(recipient.for_you_digest_threshold);
      const chatId = normalizeTelegramUserId(recipient.telegram_user_id);
      if (!chatId) {
        summary.skippedInvalidChatId += 1;
        continue;
      }

      let state = stateByUserId.get(recipient.id);
      if (!state) {
        const createStateResult = await supabase
          .from("for_you_digest_state")
          .upsert(
            {
              user_id: recipient.id,
              current_bucket: 0,
              last_notified_count: 0,
            },
            {
              onConflict: "user_id",
            },
          );

        if (createStateResult.error) {
          console.error("telegram-notify-for-you-digest state init failed", {
            error: createStateResult.error.message,
            userId: recipient.id,
          });
          summary.errorsCount += 1;
          continue;
        }

        state = {
          current_bucket: 0,
          user_id: recipient.id,
        };
        stateByUserId.set(recipient.id, state);
      }

      const statsResult = await supabase.rpc("get_for_you_digest_stats", { p_user_id: recipient.id });
      if (statsResult.error) {
        console.error("telegram-notify-for-you-digest digest stats failed", {
          error: statsResult.error.message,
          userId: recipient.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      const stats = ((statsResult.data ?? []) as DigestStatsRow[])[0];
      const candidateCount = normalizeCandidateCount(stats?.candidate_count ?? 0);
      const newBucket = Math.floor(candidateCount / threshold);

      if (newBucket < state.current_bucket) {
        const syncDownResult = await supabase
          .from("for_you_digest_state")
          .update({ current_bucket: newBucket })
          .eq("user_id", recipient.id);

        if (syncDownResult.error) {
          console.error("telegram-notify-for-you-digest state sync-down failed", {
            error: syncDownResult.error.message,
            nextBucket: newBucket,
            userId: recipient.id,
          });
          summary.errorsCount += 1;
          continue;
        }

        summary.syncedDown += 1;
        state.current_bucket = newBucket;
      }

      if (candidateCount < threshold) {
        summary.skippedBelowThreshold += 1;
        continue;
      }

      if (newBucket <= state.current_bucket) {
        summary.skippedNoBucketProgress += 1;
        continue;
      }

      if (summary.sent >= MAX_SEND_PER_RUN) {
        summary.skippedBudget += 1;
        continue;
      }

      const sendResult = await sendTelegramMessage(botToken, chatId, DIGEST_TEXT, replyMarkup);
      if (!sendResult.ok) {
        console.error("telegram-notify-for-you-digest send failed", {
          error: sendResult.error,
          userId: recipient.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      const persistResult = await supabase
        .from("for_you_digest_state")
        .upsert(
          {
            user_id: recipient.id,
            current_bucket: newBucket,
            last_notified_count: candidateCount,
            last_notified_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

      if (persistResult.error) {
        console.error("telegram-notify-for-you-digest state persist failed", {
          error: persistResult.error.message,
          nextBucket: newBucket,
          userId: recipient.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      state.current_bucket = newBucket;
      summary.sent += 1;
    }

    console.log("telegram-notify-for-you-digest completed", {
      sent: summary.sent,
      totalCandidates: summary.totalCandidates,
    });

    return jsonResponse({
      ...summary,
      ok: true,
      runLimit: MAX_SEND_PER_RUN,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("telegram-notify-for-you-digest failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
