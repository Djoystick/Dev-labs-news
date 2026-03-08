/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ITEMS = 15;
const MAX_ITEMS_LIMIT = 25;

type ImportRequestBody = {
  sourceId?: string;
  maxItems?: number;
};

type ContentSourceRow = {
  id: string;
  title: string;
  type: "rss";
  url: string;
  is_enabled: boolean;
  default_topic_id: string | null;
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
};

type FeedEntry = {
  publishedAt: string | null;
  title: string;
  url: string;
};

type ImportDraftFailure = {
  code?: string;
  message?: string;
  ok?: false;
};

type ImportDraftSuccess = {
  ok: true;
  post?: {
    id?: string;
    title?: string;
  };
};

type ImportDraftResult = ImportDraftFailure | ImportDraftSuccess;

type RunItemResult = {
  title: string;
  url: string;
  status: "imported" | "duplicate" | "error";
  postId?: string;
  code?: string;
  message?: string;
};

class SourceImportError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "SourceImportError";
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

function getServerEnv() {
  const supabaseUrl = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const anonKey = getEnvWithFallback("ANON_KEY", "SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new SourceImportError(500, "CONFIG_MISSING", "Server misconfigured: missing Supabase env.");
  }

  return { anonKey, serviceRoleKey, supabaseUrl };
}

function assertHttpMethod(request: Request) {
  if (request.method !== "POST") {
    throw new SourceImportError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }
}

function getAuthorizationHeader(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new SourceImportError(401, "UNAUTHORIZED", "Missing Authorization header.");
  }

  return authorization;
}

async function parseRequestBody(request: Request): Promise<{ maxItems: number; sourceId: string }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new SourceImportError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new SourceImportError(400, "INVALID_BODY", "Request body is invalid.");
  }

  const body = parsed as ImportRequestBody;
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  if (!sourceId) {
    throw new SourceImportError(400, "SOURCE_ID_REQUIRED", "sourceId is required.");
  }

  const rawMaxItems = typeof body.maxItems === "number" && Number.isFinite(body.maxItems)
    ? Math.round(body.maxItems)
    : DEFAULT_MAX_ITEMS;
  const maxItems = Math.min(MAX_ITEMS_LIMIT, Math.max(1, rawMaxItems));

  return { maxItems, sourceId };
}

async function requireAdmin(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
) {
  const asUser = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });

  const {
    data: authData,
    error: authError,
  } = await asUser.auth.getUser();

  if (authError || !authData.user?.id) {
    throw new SourceImportError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await asUser
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new SourceImportError(403, "FORBIDDEN", "Profile not found.");
  }

  if (profile.role !== "admin") {
    throw new SourceImportError(403, "FORBIDDEN", "Admin role is required.");
  }

  return { userId };
}

async function loadContentSource(serviceClient: any, sourceId: string): Promise<ContentSourceRow> {
  const { data, error } = await serviceClient
    .from("content_sources")
    .select("id, title, type, url, is_enabled, default_topic_id")
    .eq("id", sourceId)
    .maybeSingle();

  if (error) {
    throw new SourceImportError(500, "DB_ERROR", `Failed to load source. ${error.message}`);
  }

  if (!data) {
    throw new SourceImportError(404, "SOURCE_NOT_FOUND", "Source not found.");
  }

  const source = data as ContentSourceRow;
  if (source.type !== "rss") {
    throw new SourceImportError(400, "SOURCE_TYPE_UNSUPPORTED", "Only RSS sources are supported.");
  }

  return source;
}

async function loadDefaultTopic(serviceClient: any, topicId: string | null): Promise<TopicRow | null> {
  if (!topicId) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("topics")
    .select("id, name, slug")
    .eq("id", topicId)
    .maybeSingle();

  if (error) {
    throw new SourceImportError(500, "DB_ERROR", `Failed to load default topic. ${error.message}`);
  }

  return (data as TopicRow | null) ?? null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function toAbsoluteHttpUrl(rawValue: string, baseUrl: string) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value, baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    parsed.hash = "";
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    }

    const cleanedQuery = new URLSearchParams();
    for (const [key, queryValue] of parsed.searchParams.entries()) {
      const lowered = key.toLowerCase();
      if (
        lowered.startsWith("utm_")
        || lowered === "fbclid"
        || lowered === "gclid"
        || lowered === "mc_cid"
        || lowered === "mc_eid"
      ) {
        continue;
      }
      cleanedQuery.append(key, queryValue);
    }

    parsed.search = cleanedQuery.toString();
    return parsed.toString();
  } catch {
    return null;
  }
}

function getFirstText(node: Element, selectors: string[]) {
  for (const selector of selectors) {
    const value = normalizeWhitespace(node.querySelector(selector)?.textContent ?? "");
    if (value) {
      return value;
    }
  }

  return "";
}

function resolveEntryUrl(node: Element, feedUrl: string) {
  const linkNodes = Array.from(node.querySelectorAll("link"));
  for (const linkNode of linkNodes) {
    const href = normalizeWhitespace(linkNode.getAttribute("href") ?? "");
    if (href) {
      const resolved = toAbsoluteHttpUrl(href, feedUrl);
      if (resolved) {
        return resolved;
      }
    }
  }

  for (const linkNode of linkNodes) {
    const textValue = normalizeWhitespace(linkNode.textContent ?? "");
    if (textValue) {
      const resolved = toAbsoluteHttpUrl(textValue, feedUrl);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

async function fetchFeedXml(feedUrl: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, {
      method: "GET",
      headers: {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.2",
        "User-Agent": "DevLabsNewsBot/1.0 (+rss-source-import)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SourceImportError(400, "RSS_FETCH_FAILED", `Source responded with HTTP ${response.status}.`);
    }

    const xml = await response.text();
    if (!xml.trim()) {
      throw new SourceImportError(400, "RSS_EMPTY", "RSS feed is empty.");
    }

    return {
      responseUrl: response.url || feedUrl,
      xml,
    };
  } catch (error) {
    if (error instanceof SourceImportError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SourceImportError(400, "RSS_TIMEOUT", "RSS source timed out.");
    }

    throw new SourceImportError(400, "RSS_FETCH_FAILED", "Failed to fetch RSS source.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseFeedEntries(xml: string, feedUrl: string, maxItems: number) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (!doc) {
    throw new SourceImportError(400, "RSS_PARSE_FAILED", "Failed to parse RSS XML.");
  }

  const parseErrorNode = doc.querySelector("parsererror");
  if (parseErrorNode) {
    throw new SourceImportError(400, "RSS_PARSE_FAILED", "RSS XML is invalid.");
  }

  const nodes = Array.from(doc.querySelectorAll("item, entry"));
  const uniqueUrls = new Set<string>();
  const entries: FeedEntry[] = [];
  let skippedMissingUrl = 0;
  let skippedDuplicateInFeed = 0;

  for (const node of nodes) {
    const url = resolveEntryUrl(node, feedUrl);
    if (!url) {
      skippedMissingUrl += 1;
      continue;
    }

    const dedupeKey = url.toLowerCase();
    if (uniqueUrls.has(dedupeKey)) {
      skippedDuplicateInFeed += 1;
      continue;
    }

    uniqueUrls.add(dedupeKey);

    const title = getFirstText(node, ["title"]);
    const publishedAt = getFirstText(node, ["pubDate", "published", "updated"]) || null;
    entries.push({
      publishedAt,
      title: title || url,
      url,
    });

    if (entries.length >= maxItems) {
      break;
    }
  }

  return {
    entries,
    feedItemsTotal: nodes.length,
    skippedDuplicateInFeed,
    skippedMissingUrl,
  };
}

function toImportResult(value: unknown): ImportDraftResult {
  if (!value || typeof value !== "object") {
    return {
      code: "IMPORT_INVALID_RESPONSE",
      message: "Import function returned invalid response.",
      ok: false,
    };
  }

  return value as ImportDraftResult;
}

async function callImportPostDraft(
  importEndpoint: string,
  anonKey: string,
  authorization: string,
  payload: { note: string; url: string },
): Promise<ImportDraftResult> {
  const response = await fetch(importEndpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
      "apikey": anonKey,
      "x-client-info": "import-rss-source/1.0",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorObject = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : null;
    const message = typeof errorObject?.message === "string"
      ? errorObject.message
      : `import-post-draft failed with HTTP ${response.status}`;

    return {
      code: typeof errorObject?.code === "string" ? errorObject.code : "IMPORT_HTTP_ERROR",
      message,
      ok: false,
    };
  }

  return toImportResult(parsed);
}

function buildImportNote(source: ContentSourceRow, entry: FeedEntry, defaultTopic: TopicRow | null) {
  const parts = [`Imported from source registry: ${source.title}.`];
  if (defaultTopic) {
    parts.push(`Preferred topic: ${defaultTopic.name} (${defaultTopic.slug}).`);
  }

  if (entry.publishedAt) {
    parts.push(`Feed published date: ${entry.publishedAt}.`);
  }

  return parts.join(" ");
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  try {
    assertHttpMethod(request);

    const authorization = getAuthorizationHeader(request);
    const { maxItems, sourceId } = await parseRequestBody(request);
    const { anonKey, serviceRoleKey, supabaseUrl } = getServerEnv();
    await requireAdmin(supabaseUrl, anonKey, authorization);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const source = await loadContentSource(serviceClient, sourceId);
    const defaultTopic = await loadDefaultTopic(serviceClient, source.default_topic_id);
    const fetchedFeed = await fetchFeedXml(source.url);
    const parsedFeed = parseFeedEntries(fetchedFeed.xml, fetchedFeed.responseUrl, maxItems);
    const importEndpoint = `${supabaseUrl.replace(/\/+$/u, "")}/functions/v1/import-post-draft`;

    const results: RunItemResult[] = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const entry of parsedFeed.entries) {
      const note = buildImportNote(source, entry, defaultTopic);
      const importResult = await callImportPostDraft(importEndpoint, anonKey, authorization, {
        note,
        url: entry.url,
      });

      if (importResult.ok === true) {
        importedCount += 1;
        results.push({
          postId: typeof importResult.post?.id === "string" ? importResult.post.id : undefined,
          status: "imported",
          title: entry.title,
          url: entry.url,
        });
        continue;
      }

      const code = typeof importResult.code === "string" ? importResult.code : "IMPORT_FAILED";
      const message = typeof importResult.message === "string" ? importResult.message : "Import failed.";

      if (code === "DUPLICATE" || code === "DUPLICATE_SOFT") {
        duplicateCount += 1;
        results.push({
          code,
          message,
          status: "duplicate",
          title: entry.title,
          url: entry.url,
        });
      } else {
        errorCount += 1;
        results.push({
          code,
          message,
          status: "error",
          title: entry.title,
          url: entry.url,
        });
      }
    }

    return jsonResponse({
      ok: true,
      source: {
        id: source.id,
        isEnabled: source.is_enabled,
        title: source.title,
        type: source.type,
        url: source.url,
      },
      summary: {
        consideredItems: parsedFeed.entries.length,
        duplicateItems: duplicateCount,
        errorItems: errorCount,
        feedItemsTotal: parsedFeed.feedItemsTotal,
        importedItems: importedCount,
        skippedDuplicateInFeed: parsedFeed.skippedDuplicateInFeed,
        skippedMissingUrl: parsedFeed.skippedMissingUrl,
      },
      results: results.slice(0, 50),
    });
  } catch (error) {
    if (error instanceof SourceImportError) {
      return jsonResponse(
        {
          code: error.code,
          details: error.details,
          message: error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("import-rss-source failed", error);
    return jsonResponse(
      {
        code: "INTERNAL_ERROR",
        message: "Internal source import error.",
        ok: false,
      },
      500,
    );
  }
});
