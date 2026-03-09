export type ImportRunType = "url_import" | "rss_import";
export type ImportRunTriggerMode = "manual" | "scheduled";
export type ImportRunStatus = "running" | "success" | "partial_success" | "failed";

type BaseImportRunPayload = {
  contentSourceId?: string | null;
  feedUrl?: string | null;
  initiatedBy?: string | null;
  sourceDomain?: string | null;
  sourceUrl?: string | null;
  summary?: Record<string, unknown>;
};

export type StartImportRunInput = BaseImportRunPayload & {
  runType: ImportRunType;
  triggerMode?: ImportRunTriggerMode;
};

export type FinishImportRunInput = BaseImportRunPayload & {
  duplicateCount?: number;
  discoveredCount?: number;
  errorCount?: number;
  errorMessage?: string | null;
  importedCount?: number;
  status: ImportRunStatus;
};

function toOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toOptionalObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCounter(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export async function startImportRun(serviceClient: any, input: StartImportRunInput) {
  try {
    const payload = {
      run_type: input.runType,
      trigger_mode: input.triggerMode ?? "manual",
      status: "running" as const,
      started_at: new Date().toISOString(),
      initiated_by: toOptionalText(input.initiatedBy),
      source_url: toOptionalText(input.sourceUrl),
      source_domain: toOptionalText(input.sourceDomain),
      content_source_id: toOptionalText(input.contentSourceId),
      feed_url: toOptionalText(input.feedUrl),
      summary: toOptionalObject(input.summary),
    };

    const { data, error } = await serviceClient
      .from("import_runs")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.warn("import-run start failed", {
        code: error?.code,
        message: error?.message,
        runType: input.runType,
      });
      return null;
    }

    return data.id as string;
  } catch (error) {
    console.warn("import-run start failed", error);
    return null;
  }
}

export async function finishImportRun(serviceClient: any, runId: string | null, input: FinishImportRunInput) {
  if (!runId) {
    return;
  }

  try {
    const payload = {
      finished_at: new Date().toISOString(),
      status: input.status,
      source_url: toOptionalText(input.sourceUrl),
      source_domain: toOptionalText(input.sourceDomain),
      content_source_id: toOptionalText(input.contentSourceId),
      feed_url: toOptionalText(input.feedUrl),
      discovered_count: normalizeCounter(input.discoveredCount),
      imported_count: normalizeCounter(input.importedCount),
      duplicate_count: normalizeCounter(input.duplicateCount),
      error_count: normalizeCounter(input.errorCount),
      summary: toOptionalObject(input.summary),
      error_message: toOptionalText(input.errorMessage),
    };

    const { error } = await serviceClient
      .from("import_runs")
      .update(payload)
      .eq("id", runId);

    if (error) {
      console.warn("import-run finish failed", {
        code: error.code,
        message: error.message,
        runId,
      });
    }
  } catch (error) {
    console.warn("import-run finish failed", error);
  }
}
