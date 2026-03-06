import { useEffect, useMemo, useState } from 'react';

const storageKey = 'devlabs.reading.v1';
const maxReadPostIds = 2000;

export type ContinueReading = {
  postId: string | null;
  path?: string | null;
  title?: string | null;
  updatedAt?: string | null;
};

export type ReadingMarkMeta = {
  path?: string | null;
  topicKey?: string | null;
  title?: string | null;
  updatedAt?: string | null;
};

type ReadingState = {
  continueReading: ContinueReading;
  hiddenReadEnabled: boolean;
  readPostIds: string[];
};

type ReadingSnapshot = {
  continueReading: ContinueReading;
  hiddenReadEnabled: boolean;
  readPostIds: string[];
};

const listeners = new Set<() => void>();
let isStorageSubscribed = false;
let stateCache: ReadingState | null = null;

function getDefaultContinueReading(): ContinueReading {
  return {
    path: null,
    postId: null,
    title: null,
    updatedAt: null,
  };
}

function getDefaultState(): ReadingState {
  return {
    continueReading: getDefaultContinueReading(),
    hiddenReadEnabled: false,
    readPostIds: [],
  };
}

function isClient() {
  return typeof window !== 'undefined';
}

function sanitizeContinueReading(value: unknown): ContinueReading {
  if (!value || typeof value !== 'object') {
    return getDefaultContinueReading();
  }

  const source = value as Partial<ContinueReading>;
  const postId = typeof source.postId === 'string' && source.postId.trim() ? source.postId.trim() : null;
  const title = typeof source.title === 'string' ? source.title.trim() || null : null;
  const path = typeof source.path === 'string' ? source.path.trim() || null : null;
  const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : null;

  return {
    path,
    postId,
    title,
    updatedAt,
  };
}

function sanitizeReadPostIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalizedId = item.trim();
    if (!normalizedId) {
      continue;
    }

    uniqueIds.add(normalizedId);
    if (uniqueIds.size >= maxReadPostIds) {
      break;
    }
  }

  return Array.from(uniqueIds);
}

function sanitizeState(value: unknown): ReadingState {
  if (!value || typeof value !== 'object') {
    return getDefaultState();
  }

  const source = value as Partial<ReadingState>;

  return {
    continueReading: sanitizeContinueReading(source.continueReading),
    hiddenReadEnabled: source.hiddenReadEnabled === true,
    readPostIds: sanitizeReadPostIds(source.readPostIds),
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // no-op: listeners are best-effort
    }
  });
}

function ensureStorageSubscription() {
  if (!isClient() || isStorageSubscribed) {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey) {
      return;
    }

    stateCache = null;
    notifyListeners();
  });

  isStorageSubscribed = true;
}

function readState(): ReadingState {
  if (!isClient()) {
    return getDefaultState();
  }

  if (stateCache) {
    return stateCache;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      stateCache = getDefaultState();
      return stateCache;
    }

    const parsed = JSON.parse(raw);
    stateCache = sanitizeState(parsed);
    return stateCache;
  } catch {
    stateCache = getDefaultState();
    return stateCache;
  }
}

function writeState(nextState: ReadingState) {
  const normalizedState = sanitizeState(nextState);
  stateCache = normalizedState;

  if (isClient()) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizedState));
    } catch {
      // no-op: localStorage can fail in private mode / low quota
    }
  }

  notifyListeners();
}

function updateState(updater: (state: ReadingState) => ReadingState) {
  const currentState = readState();
  writeState(updater(currentState));
}

function getSnapshot(): ReadingSnapshot {
  const state = readState();

  return {
    continueReading: { ...state.continueReading },
    hiddenReadEnabled: state.hiddenReadEnabled,
    readPostIds: [...state.readPostIds],
  };
}

export function markPostRead(postId: string, meta?: ReadingMarkMeta) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return;
  }

  updateState((state) => {
    const hasPost = state.readPostIds.includes(normalizedPostId);
    const readPostIds = hasPost ? state.readPostIds : [normalizedPostId, ...state.readPostIds].slice(0, maxReadPostIds);
    const previousContinue = state.continueReading;

    return {
      ...state,
      continueReading: {
        path: meta?.path ?? (previousContinue.postId === normalizedPostId ? previousContinue.path ?? null : null),
        postId: normalizedPostId,
        title: meta?.title ?? (previousContinue.postId === normalizedPostId ? previousContinue.title ?? null : null),
        updatedAt: meta?.updatedAt ?? new Date().toISOString(),
      },
      readPostIds,
    };
  });
}

export function isPostRead(postId: string) {
  if (!postId) {
    return false;
  }

  return readState().readPostIds.includes(postId);
}

export function setHiddenReadEnabled(nextValue: boolean) {
  updateState((state) => ({
    ...state,
    hiddenReadEnabled: nextValue,
  }));
}

export function getHiddenReadEnabled() {
  return readState().hiddenReadEnabled;
}

export function setContinueReading(payload: ContinueReading) {
  updateState((state) => ({
    ...state,
    continueReading: sanitizeContinueReading(payload),
  }));
}

export function getContinueReading() {
  return { ...readState().continueReading };
}

export function clearContinueReading() {
  updateState((state) => ({
    ...state,
    continueReading: getDefaultContinueReading(),
  }));
}

export function clearReadingHistory() {
  updateState((state) => ({
    ...state,
    continueReading: getDefaultContinueReading(),
    readPostIds: [],
  }));
}

export function subscribe(listener: () => void) {
  ensureStorageSubscription();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useReadingProgress() {
  const [snapshot, setSnapshot] = useState<ReadingSnapshot>(() => getSnapshot());

  useEffect(() => subscribe(() => setSnapshot(getSnapshot())), []);

  return {
    clearContinueReading,
    clearReadingHistory,
    continueReading: snapshot.continueReading,
    getContinueReading,
    getHiddenReadEnabled,
    hiddenReadEnabled: snapshot.hiddenReadEnabled,
    isPostRead,
    markPostRead,
    readPostIds: snapshot.readPostIds,
    setContinueReading,
    setHiddenReadEnabled,
  };
}

export function useFilteredFeedPosts<T extends { id: string }>(posts: T[]) {
  const { hiddenReadEnabled, readPostIds } = useReadingProgress();
  const readPostIdsSet = useMemo(() => new Set(readPostIds), [readPostIds]);

  const filteredPosts = useMemo(() => {
    if (!hiddenReadEnabled) {
      return posts;
    }

    return posts.filter((post) => !readPostIdsSet.has(post.id));
  }, [hiddenReadEnabled, posts, readPostIdsSet]);

  return {
    filteredPosts,
    hiddenReadEnabled,
    hiddenReadCount: Math.max(0, posts.length - filteredPosts.length),
  };
}
