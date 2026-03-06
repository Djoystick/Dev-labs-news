export type PostDraftPublishingMode = 'published' | 'draft' | 'scheduled';

type DraftContext =
  | {
      mode: 'create';
    }
  | {
      mode: 'edit';
      postId: string;
    };

export type PostDraftPayload = {
  title: string;
  content: string;
  excerpt: string;
  cover_url: string;
  topic_id: string;
  publish_mode: PostDraftPublishingMode;
  scheduled_at: string;
  updatedAt: string;
};

const DRAFT_KEY_PREFIX = 'devlabs.draft.v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getPostDraftStorageKey(context: DraftContext) {
  return context.mode === 'create' ? `${DRAFT_KEY_PREFIX}:create` : `${DRAFT_KEY_PREFIX}:edit:${context.postId}`;
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isPublishingMode(value: unknown): value is PostDraftPublishingMode {
  return value === 'published' || value === 'draft' || value === 'scheduled';
}

export function hasMeaningfulPostDraft(payload: Pick<PostDraftPayload, 'title' | 'content' | 'excerpt' | 'cover_url' | 'scheduled_at'>) {
  return (
    payload.title.trim().length > 0 ||
    payload.content.trim().length > 0 ||
    payload.excerpt.trim().length > 0 ||
    payload.cover_url.trim().length > 0 ||
    payload.scheduled_at.trim().length > 0
  );
}

export function readPostDraft(storageKey: string): PostDraftPayload | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PostDraftPayload> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      content: toStringValue(parsed.content),
      cover_url: toStringValue(parsed.cover_url),
      excerpt: toStringValue(parsed.excerpt),
      publish_mode: isPublishingMode(parsed.publish_mode) ? parsed.publish_mode : 'published',
      scheduled_at: toStringValue(parsed.scheduled_at),
      title: toStringValue(parsed.title),
      topic_id: toStringValue(parsed.topic_id),
      updatedAt: toStringValue(parsed.updatedAt),
    };
  } catch {
    return null;
  }
}

export function writePostDraft(storageKey: string, payload: PostDraftPayload) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage errors in best-effort autosave.
  }
}

export function clearPostDraft(storageKey: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors in best-effort autosave.
  }
}
