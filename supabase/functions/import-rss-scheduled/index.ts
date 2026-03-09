/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

const DEFAULT_MAX_ITEMS_PER_SOURCE = 15;
const MAX_ITEMS_LIMIT = 25;
const MAX_RESULT_ITEMS = 120;

type ImportRequestBody = {
  maxItems?: number;
};

type ContentSourceRow = {
  id: string;
  is_enabled: boolean;
  title: string;
  type: "rss";
  url: string;
};

type SourceImportSummary = {
  consideredItems: number;
  duplicateItems: number;
  errorItems: number;
  feedItemsTotal: number;
  importedItems: number;
  skippedDuplicateInFeed: number;
  skippedMissingUrl: number;
};

type SourceImportSuccess = {
  ok: true;
  summary: SourceImportSummary;
};

type SourceImportFailure = {
  code?: string;
  message?: string;
  ok?: false;
};

type SourceImportResult = SourceImportSuccess | SourceImportFailure;

type ScheduledSourceResult = {
  sourceId: string;
  sourceTitle: string;
  feedUrl: string;
  status: "success" | "partial_success" | "failed";
  discoveredCount: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  code?: string;
  message?: string;
};

type AggregateCounters = {
  discoveredCount: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
};

class ScheduledImportError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ScheduledImportError";
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

function getServerEnv() {
  const supabaseUrl = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const serviceRoleKey = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = getEnvWithFallback("ANON_KEY", "SUPABASE_ANON_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !cronSecret) {
    throw new ScheduledImportError(500, "Server misconfigured.");
  }

  return { anonKey, cronSecret, serviceRoleKey, supabaseUrl };
}

function assertMethod(request: Request) {
  if (request.method !== "POST") {
    throw new ScheduledImportError(405, "Method not allowed.");
  }
}

function ensureCronAuthorized(request: Request, expectedSecret: string) {
  const providedSecret = request.headers.get("x-cron-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new ScheduledImportError(401, "Unauthorized.");
  }
}

async function parseBody(request: Request): Promise<{ maxItems: number }> {
  if (!request.body) {
    return { maxItems: DEFAULT_MAX_ITEMS_PER_SOURCE };
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ScheduledImportError(400, "Request body must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    return { maxItems: DEFAULT_MAX_ITEMS_PER_SOURCE };
  }

  const body = parsed as ImportRequestBody;
  const rawMaxItems = typeof body.maxItems === "number" && Number.isFinite(body.maxItems)
    ? Math.round(body.maxItems)
    : DEFAULT_MAX_ITEMS_PER_SOURCE;

  return {
    maxItems: Math.min(MAX_ITEMS_LIMIT, Math.max(1, rawMaxItems)),
  };
}

async function loadEnabledRssSources(serviceClient: any): Promise<ContentSourceRow[]> {
  const { data, error } = await serviceClient
    .from("content_sources")
    .select("id, title, type, url, is_enabled")
    .eq("type", "rss")
    .eq("is_enabled", true)
    .order("id", { ascending: true });

  if (error) {
    throw new ScheduledImportError(500, `Failed to load sources. ${error.message}`);
  }

  return (data ?? []) as ContentSourceRow[];
}

function toCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function parseSourceImportResult(value: unknown): SourceImportResult {
  if (!value || typeof value !== "object") {
    return {
      code: "IMPORT_INVALID_RESPONSE",
      message: "import-rss-source returned an invalid response.",
      ok: false,
    };
  }

  return value as SourceImportResult;
}

function normalizeSummary(value: unknown): SourceImportSummary {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    consideredItems: toCount(raw.consideredItems),
    duplicateItems: toCount(raw.duplicateItems),
    errorItems: toCount(raw.errorItems),
    feedItemsTotal: toCount(raw.feedItemsTotal),
    importedItems: toCount(raw.importedItems),
    skippedDuplicateInFeed: toCount(raw.skippedDuplicateInFeed),
    skippedMissingUrl: toCount(raw.skippedMissingUrl),
  };
}

function resolveSourceStatus(summary: SourceImportSummary): "success" | "partial_success" | "failed" {
  if (summary.errorItems > 0 && summary.importedItems === 0) {
    return "failed";
  }

  if (summary.errorItems > 0 || summary.duplicateItems > 0) {
    return "partial_success";
  }

  return "success";
}

async function callImportRssSource(
  endpoint: string,
  anonKey: string,
  cronSecret: string,
  sourceId: string,
  maxItems: number,
): Promise<SourceImportResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      "apikey": anonKey,
      "x-client-info": "import-rss-scheduled/1.0",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({
      sourceId,
      maxItems,
      triggerMode: "scheduled",
    }),
  });

  const rawText = await response.text();
  let parsed: unknown = null;

  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const payload = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    return {
      code: typeof payload?.code === "string" ? payload.code : "RSS_SOURCE_HTTP_ERROR",
      message: typeof payload?.message === "string"
        ? payload.message
        : `import-rss-source failed with HTTP ${response.status}.`,
      ok: false,
    };
  }

  return parseSourceImportResult(parsed);
}

function pushAggregate(counters: AggregateCounters, result: ScheduledSourceResult) {
  counters.discoveredCount += result.discoveredCount;
  counters.importedCount += result.importedCount;
  counters.duplicateCount += result.duplicateCount;
  counters.errorCount += result.errorCount;
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  const startedAt = new Date().toISOString();

  try {
    assertMethod(request);
    const { maxItems } = await parseBody(request);
    const { anonKey, cronSecret, serviceRoleKey, supabaseUrl } = getServerEnv();
    ensureCronAuthorized(request, cronSecret);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const sources = await loadEnabledRssSources(serviceClient);
    const importEndpoint = `${supabaseUrl.replace(/\/+$/u, "")}/functions/v1/import-rss-source`;
    const results: ScheduledSourceResult[] = [];
    const totals: AggregateCounters = {
      discoveredCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    };

    let successCount = 0;
    let partialCount = 0;
    let failedCount = 0;

    for (const source of sources) {
      try {
        const sourceResult = await callImportRssSource(importEndpoint, anonKey, cronSecret, source.id, maxItems);

        if (sourceResult.ok === true) {
          const summary = normalizeSummary(sourceResult.summary);
          const status = resolveSourceStatus(summary);

          if (status === "success") {
            successCount += 1;
          } else if (status === "partial_success") {
            partialCount += 1;
          } else {
            failedCount += 1;
          }

          const normalized: ScheduledSourceResult = {
            sourceId: source.id,
            sourceTitle: source.title,
            feedUrl: source.url,
            status,
            discoveredCount: summary.feedItemsTotal,
            importedCount: summary.importedItems,
            duplicateCount: summary.duplicateItems,
            errorCount: summary.errorItems,
          };

          results.push(normalized);
          pushAggregate(totals, normalized);
          continue;
        }

        const failed: ScheduledSourceResult = {
          sourceId: source.id,
          sourceTitle: source.title,
          feedUrl: source.url,
          status: "failed",
          discoveredCount: 0,
          importedCount: 0,
          duplicateCount: 0,
          errorCount: 1,
          code: sourceResult.code,
          message: sourceResult.message ?? "Scheduled source import failed.",
        };

        failedCount += 1;
        results.push(failed);
        pushAggregate(totals, failed);
      } catch (error) {
        const failed: ScheduledSourceResult = {
          sourceId: source.id,
          sourceTitle: source.title,
          feedUrl: source.url,
          status: "failed",
          discoveredCount: 0,
          importedCount: 0,
          duplicateCount: 0,
          errorCount: 1,
          code: "RSS_SOURCE_CALL_FAILED",
          message: error instanceof Error ? error.message : "Failed to call import-rss-source.",
        };

        failedCount += 1;
        results.push(failed);
        pushAggregate(totals, failed);
      }
    }

    const finishedAt = new Date().toISOString();
    const batchStatus = failedCount > 0
      ? (successCount > 0 || partialCount > 0 ? "partial_success" : "failed")
      : (partialCount > 0 ? "partial_success" : "success");

    return jsonResponse({
      ok: true,
      triggerMode: "scheduled",
      status: batchStatus,
      startedAt,
      finishedAt,
      maxItems,
      sourceCount: sources.length,
      successCount,
      partialCount,
      failedCount,
      totals,
      results: results.slice(0, MAX_RESULT_ITEMS),
    });
  } catch (error) {
    if (error instanceof ScheduledImportError) {
      return jsonResponse(
        {
          ok: false,
          code: "SCHEDULED_IMPORT_FAILED",
          message: error.message,
          startedAt,
        },
        error.status,
      );
    }

    console.error("import-rss-scheduled failed", error);
    return jsonResponse(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Internal scheduled import error.",
        startedAt,
      },
      500,
    );
  }
});
