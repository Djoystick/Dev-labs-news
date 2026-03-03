/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import "@supabase/edge-runtime.d.ts";
import { serve } from "@std/http/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

type RulesBody = {
  content_md?: string;
};

type RulesRecord = {
  id: number;
  updated_at: string;
  version: number;
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
  const service = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const bot = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (!url || !anon || !service || !bot) {
    throw new HttpError(500, "Server misconfigured");
  }

  return { anon, bot, service, url };
}

function getAuthorizationHeader(request: Request) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    throw new HttpError(401, "Missing Authorization header");
  }

  return authorization;
}

async function parseBody(request: Request): Promise<RulesBody> {
  try {
    return (await request.json()) as RulesBody;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

async function requireAdminRole(url: string, anon: string, authorization: string) {
  const asUser = createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });

  const { data, error } = await asUser.from("profiles").select("role").limit(1).single();

  if (error || !data || data.role !== "admin") {
    throw new HttpError(403, "Forbidden");
  }

  return asUser;
}

async function sendTelegramMessage(bot: string, telegramId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      body: JSON.stringify({
        chat_id: telegramId,
        text,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return response.ok;
  } catch (error) {
    console.error("admin-rules notify failed", error);
    return false;
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
    const { anon, bot, service, url } = getRequiredServerEnv();
    const body = await parseBody(request);

    if (typeof body.content_md !== "string") {
      throw new HttpError(400, "content_md is required");
    }

    const asUser = await requireAdminRole(url, anon, authorization);
    const { data, error } = await asUser
      .from("publication_rules")
      .update({ content_md: body.content_md })
      .eq("id", 1)
      .select("id, version, updated_at")
      .single();

    if (error) {
      throw new HttpError(500, "Failed to update publication rules");
    }

    const rules = data as RulesRecord;
    const serviceClient = createClient(url, service, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const editorsResult = await serviceClient
      .from("profiles")
      .select("telegram_id")
      .eq("role", "editor")
      .not("telegram_id", "is", null);

    if (editorsResult.error) {
      throw new HttpError(500, "Failed to load editors");
    }

    let notifiedCount = 0;

    for (const editor of editorsResult.data ?? []) {
      if (!editor.telegram_id) {
        continue;
      }

      const notified = await sendTelegramMessage(bot, String(editor.telegram_id), "Правила обновлены");

      if (notified) {
        notifiedCount += 1;
      }
    }

    return jsonResponse({
      notifiedCount,
      ok: true,
      rules: {
        updated_at: rules.updated_at,
        version: rules.version,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("admin-rules failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
