import { getSupabaseClient } from '@/lib/supabase';
import type { ContentSource } from '@/types/db';

export type ContentSourceInput = {
  title: string;
  url: string;
  default_topic_id?: string | null;
  is_enabled?: boolean;
};

export type SourceImportRunResultItem = {
  title: string;
  url: string;
  status: 'imported' | 'duplicate' | 'error';
  postId?: string;
  code?: string;
  message?: string;
};

export type SourceImportRunSuccess = {
  ok: true;
  source: {
    id: string;
    title: string;
    type: string;
    url: string;
    isEnabled: boolean;
  };
  summary: {
    consideredItems: number;
    duplicateItems: number;
    errorItems: number;
    feedItemsTotal: number;
    importedItems: number;
    skippedDuplicateInFeed: number;
    skippedMissingUrl: number;
  };
  results: SourceImportRunResultItem[];
};

export type SourceImportRunFailure = {
  ok: false;
  code?: string;
  message: string;
  details?: Record<string, unknown>;
};

export type SourceImportRunResult = SourceImportRunSuccess | SourceImportRunFailure;

function normalizeSourcePayload(input: ContentSourceInput) {
  return {
    default_topic_id: input.default_topic_id?.trim() || null,
    is_enabled: typeof input.is_enabled === 'boolean' ? input.is_enabled : true,
    title: input.title.trim(),
    type: 'rss' as const,
    url: input.url.trim(),
  };
}

function parseRunResult(value: unknown): SourceImportRunResult {
  if (!value || typeof value !== 'object') {
    return {
      message: 'Import function returned an invalid response.',
      ok: false,
    };
  }

  const raw = value as Record<string, unknown>;
  if (raw.ok === true) {
    const source = raw.source && typeof raw.source === 'object' ? raw.source as Record<string, unknown> : {};
    const summary = raw.summary && typeof raw.summary === 'object' ? raw.summary as Record<string, unknown> : {};
    const rawResults = Array.isArray(raw.results) ? raw.results : [];

    const results: SourceImportRunResultItem[] = rawResults
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        code: typeof item.code === 'string' ? item.code : undefined,
        message: typeof item.message === 'string' ? item.message : undefined,
        postId: typeof item.postId === 'string' ? item.postId : undefined,
        status: item.status === 'imported' || item.status === 'duplicate' || item.status === 'error' ? item.status : 'error',
        title: typeof item.title === 'string' ? item.title : 'Untitled',
        url: typeof item.url === 'string' ? item.url : '',
      }));

    const asCount = (valueToParse: unknown) => {
      const numberValue = typeof valueToParse === 'number' ? valueToParse : Number.NaN;
      if (!Number.isFinite(numberValue) || numberValue < 0) {
        return 0;
      }

      return Math.floor(numberValue);
    };

    return {
      ok: true,
      results,
      source: {
        id: typeof source.id === 'string' ? source.id : '',
        isEnabled: typeof source.isEnabled === 'boolean' ? source.isEnabled : true,
        title: typeof source.title === 'string' ? source.title : 'Unknown source',
        type: typeof source.type === 'string' ? source.type : 'rss',
        url: typeof source.url === 'string' ? source.url : '',
      },
      summary: {
        consideredItems: asCount(summary.consideredItems),
        duplicateItems: asCount(summary.duplicateItems),
        errorItems: asCount(summary.errorItems),
        feedItemsTotal: asCount(summary.feedItemsTotal),
        importedItems: asCount(summary.importedItems),
        skippedDuplicateInFeed: asCount(summary.skippedDuplicateInFeed),
        skippedMissingUrl: asCount(summary.skippedMissingUrl),
      },
    };
  }

  return {
    code: typeof raw.code === 'string' ? raw.code : undefined,
    details: raw.details && typeof raw.details === 'object' ? raw.details as Record<string, unknown> : undefined,
    message: typeof raw.message === 'string' && raw.message.trim().length > 0 ? raw.message : 'Source import failed.',
    ok: false,
  };
}

export async function listContentSources() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_sources')
    .select('id, title, type, url, is_enabled, default_topic_id, created_at, updated_at, created_by, updated_by')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load sources. ${error.message}`);
  }

  return (data ?? []) as ContentSource[];
}

export async function createContentSource(input: ContentSourceInput) {
  const supabase = getSupabaseClient();
  const payload = normalizeSourcePayload(input);
  const { data, error } = await supabase
    .from('content_sources')
    .insert(payload)
    .select('id, title, type, url, is_enabled, default_topic_id, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) {
    throw new Error(`Failed to create source. ${error.message}`);
  }

  return data as ContentSource;
}

export async function updateContentSource(sourceId: string, input: Partial<ContentSourceInput>) {
  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = {};

  if (typeof input.title === 'string') {
    patch.title = input.title.trim();
  }

  if (typeof input.url === 'string') {
    patch.url = input.url.trim();
  }

  if (typeof input.is_enabled === 'boolean') {
    patch.is_enabled = input.is_enabled;
  }

  if ('default_topic_id' in input) {
    patch.default_topic_id = input.default_topic_id?.trim() || null;
  }

  const { data, error } = await supabase
    .from('content_sources')
    .update(patch)
    .eq('id', sourceId)
    .select('id, title, type, url, is_enabled, default_topic_id, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) {
    throw new Error(`Failed to update source. ${error.message}`);
  }

  return data as ContentSource;
}

export async function deleteContentSource(sourceId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('content_sources').delete().eq('id', sourceId);

  if (error) {
    throw new Error(`Failed to delete source. ${error.message}`);
  }
}

export async function runContentSourceImport(sourceId: string, maxItems = 15): Promise<SourceImportRunResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('import-rss-source', {
    body: {
      maxItems,
      sourceId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to run source import.');
  }

  return parseRunResult(data);
}
