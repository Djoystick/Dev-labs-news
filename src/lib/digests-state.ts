const digestsStateKey = 'dev-labs:digests-state';
const digestsReturnIntentKey = 'dev-labs:digests-return-intent';
const digestsOpenTraceKey = 'dev-labs:digests-open-trace';

export type DigestsState = {
  activeTopicId: string | null;
  searchQuery: string;
  scrollY: number;
  visibleTopicIds: string[];
};

export type DigestsOpenTrace = {
  openedAt: number;
  postId: string;
  topicId: string | null;
};

function isClient() {
  return typeof window !== 'undefined';
}

function sanitizeTopicIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    uniqueIds.add(normalized);
    if (uniqueIds.size >= 100) {
      break;
    }
  }

  return [...uniqueIds];
}

function sanitizeState(value: unknown): DigestsState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<DigestsState>;
  const activeTopicId = typeof source.activeTopicId === 'string' && source.activeTopicId.trim() ? source.activeTopicId.trim() : null;
  const searchQuery = typeof source.searchQuery === 'string' ? source.searchQuery.slice(0, 120) : '';
  const scrollY = Number.isFinite(source.scrollY) ? Math.max(0, Number(source.scrollY)) : 0;
  const visibleTopicIds = sanitizeTopicIds(source.visibleTopicIds);

  return {
    activeTopicId,
    searchQuery,
    scrollY,
    visibleTopicIds,
  };
}

function sanitizeOpenTrace(value: unknown): DigestsOpenTrace | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<DigestsOpenTrace>;
  const postId = typeof source.postId === 'string' && source.postId.trim() ? source.postId.trim() : null;
  if (!postId) {
    return null;
  }

  const topicId = typeof source.topicId === 'string' && source.topicId.trim() ? source.topicId.trim() : null;
  const openedAt = Number.isFinite(source.openedAt) ? Number(source.openedAt) : 0;
  if (openedAt <= 0) {
    return null;
  }

  return {
    openedAt,
    postId,
    topicId,
  };
}

export function saveDigestsState(state: DigestsState) {
  if (!isClient()) {
    return;
  }

  const safeState = sanitizeState(state);
  if (!safeState) {
    return;
  }

  window.sessionStorage.setItem(digestsStateKey, JSON.stringify(safeState));
}

export function readDigestsState(): DigestsState | null {
  if (!isClient()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(digestsStateKey);
  if (!raw) {
    return null;
  }

  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function markDigestsReturnIntent() {
  if (!isClient()) {
    return;
  }

  window.sessionStorage.setItem(digestsReturnIntentKey, '1');
}

export function consumeDigestsReturnIntent() {
  if (!isClient()) {
    return false;
  }

  const hasIntent = window.sessionStorage.getItem(digestsReturnIntentKey) === '1';
  if (hasIntent) {
    window.sessionStorage.removeItem(digestsReturnIntentKey);
  }

  return hasIntent;
}

export function trackDigestsPostOpen(trace: DigestsOpenTrace) {
  if (!isClient()) {
    return;
  }

  const safeTrace = sanitizeOpenTrace(trace);
  if (!safeTrace) {
    return;
  }

  window.sessionStorage.setItem(digestsOpenTraceKey, JSON.stringify(safeTrace));
}

export function consumeDigestsPostOpen() {
  if (!isClient()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(digestsOpenTraceKey);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(digestsOpenTraceKey);

  try {
    return sanitizeOpenTrace(JSON.parse(raw));
  } catch {
    return null;
  }
}
