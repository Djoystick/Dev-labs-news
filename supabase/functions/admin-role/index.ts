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

const profileSelect = "id, telegram_id, username, handle, role";

type RoleChangeBody = {
  handle?: string;
  role?: "editor" | "user";
};

type ProfileRecord = {
  handle: string | null;
  id: string;
  role: "admin" | "editor" | "user";
  telegram_id: string | null;
  username: string | null;
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

async function parseBody(request: Request): Promise<RoleChangeBody> {
  try {
    return (await request.json()) as RoleChangeBody;
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
    console.error("admin-role notify failed", error);
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
    const { anon, bot, url } = getRequiredServerEnv();
    const body = await parseBody(request);
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    const role = body.role;

    if (!handle) {
      throw new HttpError(400, "handle is required");
    }

    if (role !== "editor" && role !== "user") {
      throw new HttpError(400, "role must be editor or user");
    }

    const asUser = await requireAdminRole(url, anon, authorization);
    const { data, error } = await asUser.rpc("set_profile_role_by_handle", {
      p_handle: handle,
      p_role: role,
    });

    if (error) {
      if (error.message === "forbidden") {
        throw new HttpError(403, "Forbidden");
      }

      if (error.message === "handle is required" || error.message === "profile not found" || error.message === "multiple profiles match (handle not unique)") {
        throw new HttpError(400, error.message);
      }

      throw new HttpError(500, "Failed to update role");
    }

    const profile = data as ProfileRecord;
    let notified = false;

    if (role === "editor" && profile.telegram_id) {
      notified = await sendTelegramMessage(
        bot,
        profile.telegram_id,
        "Вам назначена роль редактора. Перезайдите, чтобы права применились.",
      );
    }

    return jsonResponse({
      notified,
      ok: true,
      profile: {
        handle: profile.handle,
        id: profile.id,
        role: profile.role,
        telegram_id: profile.telegram_id,
        username: profile.username,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error("admin-role failed", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
