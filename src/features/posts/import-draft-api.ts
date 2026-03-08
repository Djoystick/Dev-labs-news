import { getSupabaseClient } from '@/lib/supabase';

export type ImportDraftSuccess = {
  ok: true;
  aiModelUsed?: string;
  aiModelsTried?: string[];
  aiWasFallback?: boolean;
  post: {
    id: string;
    title: string;
  };
  sourceDomain?: string;
  sourceUrl?: string;
  warnings?: string[];
};

export type ImportDraftFailure = {
  code?: string;
  details?: Record<string, unknown>;
  existingPostId?: string;
  existingPostTitle?: string | null;
  message: string;
  ok: false;
};

export type ImportDraftResult = ImportDraftSuccess | ImportDraftFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseImportResponse(value: unknown): ImportDraftResult {
  if (!isObject(value)) {
    return {
      message: 'Сервис импорта вернул неожиданный ответ.',
      ok: false,
    };
  }

  if (value.ok === true) {
    const post = isObject(value.post) ? value.post : null;
    if (!post || typeof post.id !== 'string' || typeof post.title !== 'string') {
      return {
        message: 'Сервис импорта вернул неполные данные черновика.',
        ok: false,
      };
    }

    return {
      ok: true,
      aiModelUsed: typeof value.aiModelUsed === 'string' ? value.aiModelUsed : undefined,
      aiModelsTried: Array.isArray(value.aiModelsTried)
        ? value.aiModelsTried.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : undefined,
      aiWasFallback: typeof value.aiWasFallback === 'boolean' ? value.aiWasFallback : undefined,
      post: {
        id: post.id,
        title: post.title,
      },
      sourceDomain: typeof value.sourceDomain === 'string' ? value.sourceDomain : undefined,
      sourceUrl: typeof value.sourceUrl === 'string' ? value.sourceUrl : undefined,
      warnings: Array.isArray(value.warnings)
        ? value.warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : undefined,
    };
  }

  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    details: isObject(value.details) ? value.details : undefined,
    existingPostId: typeof value.existingPostId === 'string' ? value.existingPostId : undefined,
    existingPostTitle: typeof value.existingPostTitle === 'string' ? value.existingPostTitle : null,
    message: typeof value.message === 'string' && value.message.trim().length > 0
      ? value.message
      : 'Не удалось импортировать материал.',
    ok: false,
  };
}

export async function importPostDraftByUrl(input: { note?: string; url: string }): Promise<ImportDraftResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('import-post-draft', {
    body: {
      note: input.note?.trim() || null,
      url: input.url.trim(),
    },
  });

  if (error) {
    throw new Error(error.message || 'Не удалось запустить импорт.');
  }

  return parseImportResponse(data);
}
