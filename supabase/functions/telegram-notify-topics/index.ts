/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_SEND_PER_RUN = 100;
const CANDIDATE_POSTS_LIMIT = 20;
const LOOKBACK_HOURS = 48;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

type PostCandidate = {
  id: string;
  published_at: string | null;
  title: string | null;
  topic_id: string | null;
};

type TopicSubscription = {
  user_id: string;
};

type RecipientProfile = {
  id: string;
  telegram_notifications_enabled: boolean;
  telegram_user_id: number | string | null;
};

type DeliveryRow = {
  user_id: string;
};

type Summary = {
  errorsCount: number;
  processedPosts: number;
  sent: number;
  skippedAlreadySent: number;
  skippedDisabled: number;
  totalRecipients: number;
};

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
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

function sanitizeBaseUrl(baseUrl: string | null): string | null {
  if (!baseUrl) {
    return null;
  }

  const normalized = baseUrl.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/u, "");
}

function normalizeBotUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/u, "");
  return normalized || null;
}

function getRequiredServerEnv() {
  const supabaseUrl = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const serviceRoleKey = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const botUsername = normalizeBotUsername(getEnvWithFallback("TELEGRAM_BOT_USERNAME", "VITE_TELEGRAM_BOT_USERNAME") ?? null);
  const cronSecret = Deno.env.get("CRON_SECRET");
  const appBaseUrl = sanitizeBaseUrl(Deno.env.get("APP_BASE_URL") ?? null);

  if (!supabaseUrl || !serviceRoleKey || !botToken || !cronSecret) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { appBaseUrl, botToken, botUsername, cronSecret, serviceRoleKey, supabaseUrl };
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

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildMiniAppPostUrl(botUsername: string | null, postId: string) {
  if (!botUsername) {
    return null;
  }

  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(`post_${postId}`)}`;
}

function buildNotificationText(post: PostCandidate, appBaseUrl: string | null) {
  const title = hasText(post.title) ? post.title.trim() : "New publication";
  const postUrl = appBaseUrl ? `${appBaseUrl}/post/${post.id}` : null;

  if (postUrl) {
    return `News for your topic: ${title}\n\nOpen: ${postUrl}`;
  }

  return `News for your topic: ${title}`;
}

function buildNotificationReplyMarkup(post: PostCandidate, botUsername: string | null): TelegramReplyMarkup | null {
  const miniAppUrl = buildMiniAppPostUrl(botUsername, post.id);
  if (!miniAppUrl) {
    return null;
  }

  return {
    inline_keyboard: [
      [
        {
          text: "Открыть в Mini App",
          url: miniAppUrl,
        },
      ],
    ],
  };
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup: TelegramReplyMarkup | null,
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    disable_web_page_preview: true,
    text,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  console.log("telegram-notify-topics sendMessage payload", {
    hasReplyMarkup: Boolean(replyMarkup),
    hasInlineKeyboard: Boolean(replyMarkup?.inline_keyboard?.length),
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

    console.error("telegram-notify-topics Telegram API error", {
      responseStatus: response.status,
      responseText: raw || null,
    });

    const description = hasText(telegramPayload?.description) ? telegramPayload.description : "Telegram API returned an error.";
    return { error: description, ok: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram sendMessage failed.";
    return { error: message, ok: false };
  }
}

function ensureCronAuthorized(request: Request, expectedSecret: string) {
  const providedSecret = request.headers.get("x-cron-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new HttpError(401, "Unauthorized");
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
    const { appBaseUrl, botToken, botUsername, cronSecret, serviceRoleKey, supabaseUrl } = getRequiredServerEnv();
    ensureCronAuthorized(request, cronSecret);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const cutoffIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const postsResult = await supabase
      .from("posts")
      .select("id, title, topic_id, published_at")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .not("topic_id", "is", null)
      .gte("published_at", cutoffIso)
      .order("published_at", { ascending: false })
      .limit(CANDIDATE_POSTS_LIMIT);

    if (postsResult.error) {
      throw new HttpError(500, postsResult.error.message);
    }

    const posts = (postsResult.data ?? []) as PostCandidate[];
    const summary: Summary = {
      errorsCount: 0,
      processedPosts: 0,
      sent: 0,
      skippedAlreadySent: 0,
      skippedDisabled: 0,
      totalRecipients: 0,
    };
    let remainingBudget = MAX_SEND_PER_RUN;

    for (const post of posts) {
      if (!post.topic_id) {
        continue;
      }

      summary.processedPosts += 1;

      const subscriptionsResult = await supabase
        .from("topic_subscriptions")
        .select("user_id")
        .eq("topic_id", post.topic_id);

      if (subscriptionsResult.error) {
        console.error("telegram-notify-topics subscriptions fetch failed", {
          error: subscriptionsResult.error.message,
          postId: post.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      const subscribers = (subscriptionsResult.data ?? []) as TopicSubscription[];
      const subscriberIds = Array.from(new Set(subscribers.map((item) => item.user_id)));
      if (subscriberIds.length === 0) {
        continue;
      }

      const recipientsResult = await supabase
        .from("profiles")
        .select("id, telegram_user_id, telegram_notifications_enabled")
        .in("id", subscriberIds)
        .eq("telegram_notifications_enabled", true)
        .not("telegram_user_id", "is", null);

      if (recipientsResult.error) {
        console.error("telegram-notify-topics recipients fetch failed", {
          error: recipientsResult.error.message,
          postId: post.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      const recipients = (recipientsResult.data ?? []) as RecipientProfile[];
      summary.totalRecipients += recipients.length;
      summary.skippedDisabled += Math.max(0, subscriberIds.length - recipients.length);

      if (recipients.length === 0) {
        continue;
      }

      const deliveriesResult = await supabase
        .from("topic_notification_deliveries")
        .select("user_id")
        .eq("post_id", post.id);

      if (deliveriesResult.error) {
        console.error("telegram-notify-topics deliveries fetch failed", {
          error: deliveriesResult.error.message,
          postId: post.id,
        });
        summary.errorsCount += 1;
        continue;
      }

      const deliveredSet = new Set(((deliveriesResult.data ?? []) as DeliveryRow[]).map((item) => item.user_id));
      const recipientsToSend = recipients.filter((recipient) => !deliveredSet.has(recipient.id));
      summary.skippedAlreadySent += recipients.length - recipientsToSend.length;

      if (recipientsToSend.length === 0 || remainingBudget <= 0) {
        continue;
      }

      const sendBatch = recipientsToSend.slice(0, remainingBudget);
      const messageText = buildNotificationText(post, appBaseUrl);
      const replyMarkup = buildNotificationReplyMarkup(post, botUsername);

      for (const recipient of sendBatch) {
        const chatId = normalizeTelegramUserId(recipient.telegram_user_id);
        if (!chatId) {
          summary.skippedDisabled += 1;
          continue;
        }

        const sendResult = await sendTelegramMessage(botToken, chatId, messageText, replyMarkup);
        if (!sendResult.ok) {
          console.error("telegram-notify-topics send failed", {
            chatId,
            error: sendResult.error,
            postId: post.id,
            userId: recipient.id,
          });
          summary.errorsCount += 1;
          continue;
        }

        const deliveryResult = await supabase
          .from("topic_notification_deliveries")
          .upsert(
            {
              post_id: post.id,
              user_id: recipient.id,
            },
            {
              ignoreDuplicates: true,
              onConflict: "post_id,user_id",
            },
          );

        if (deliveryResult.error) {
          console.error("telegram-notify-topics delivery upsert failed", {
            error: deliveryResult.error.message,
            postId: post.id,
            userId: recipient.id,
          });
          summary.errorsCount += 1;
          continue;
        }

        summary.sent += 1;
        remainingBudget -= 1;

        if (remainingBudget <= 0) {
          break;
        }
      }

      if (remainingBudget <= 0) {
        break;
      }
    }

    return jsonResponse({
      ...summary,
      ok: true,
      runLimit: MAX_SEND_PER_RUN,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("telegram-notify-topics failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});


