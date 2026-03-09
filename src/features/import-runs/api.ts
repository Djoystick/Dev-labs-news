import { getSupabaseClient } from '@/lib/supabase';
import type { ImportRun } from '@/types/db';

const importRunSelect =
  'id, created_at, started_at, finished_at, run_type, trigger_mode, status, initiated_by, source_url, source_domain, content_source_id, feed_url, discovered_count, imported_count, duplicate_count, error_count, summary, error_message';

function normalizeSummary(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function normalizeImportRun(input: ImportRun): ImportRun {
  return {
    ...input,
    summary: normalizeSummary(input.summary),
  };
}

export async function listRecentImportRuns(limit = 20): Promise<ImportRun[]> {
  const supabase = getSupabaseClient();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 20;

  const { data, error } = await supabase
    .from('import_runs')
    .select(importRunSelect)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to load import runs. ${error.message}`);
  }

  return (data ?? []).map((row) => normalizeImportRun(row as ImportRun));
}
