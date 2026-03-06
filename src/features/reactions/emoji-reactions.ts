import { useEffect, useMemo, useState } from 'react';

const storageKey = 'devlabs.reactions.v1';

export const emojiReactions = ['👍', '🔥', '🤯', '💡', '👀'] as const;
export type EmojiReaction = (typeof emojiReactions)[number];

type EmojiReactionsState = {
  reactionsByPostId: Record<string, EmojiReaction | null>;
};

type EmojiReactionsSnapshot = {
  reactionsByPostId: Record<string, EmojiReaction | null>;
};

const listeners = new Set<() => void>();
let isStorageSubscribed = false;
let stateCache: EmojiReactionsState | null = null;

function isClient() {
  return typeof window !== 'undefined';
}

function getDefaultState(): EmojiReactionsState {
  return {
    reactionsByPostId: {},
  };
}

function isValidReaction(value: unknown): value is EmojiReaction {
  return typeof value === 'string' && emojiReactions.includes(value as EmojiReaction);
}

function sanitizeState(value: unknown): EmojiReactionsState {
  if (!value || typeof value !== 'object') {
    return getDefaultState();
  }

  const source = value as Partial<EmojiReactionsState>;
  const rawMap = source.reactionsByPostId;
  const reactionsByPostId: Record<string, EmojiReaction | null> = {};

  if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
    for (const [rawPostId, rawReaction] of Object.entries(rawMap as Record<string, unknown>)) {
      const postId = rawPostId.trim();
      if (!postId) {
        continue;
      }

      if (rawReaction === null) {
        reactionsByPostId[postId] = null;
        continue;
      }

      if (isValidReaction(rawReaction)) {
        reactionsByPostId[postId] = rawReaction;
      }
    }
  }

  return {
    reactionsByPostId,
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

function readState(): EmojiReactionsState {
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

function writeState(nextState: EmojiReactionsState) {
  const normalized = sanitizeState(nextState);
  stateCache = normalized;

  if (isClient()) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      // no-op: localStorage can fail in private mode / low quota
    }
  }

  notifyListeners();
}

function updateState(updater: (state: EmojiReactionsState) => EmojiReactionsState) {
  const currentState = readState();
  writeState(updater(currentState));
}

function getSnapshot(): EmojiReactionsSnapshot {
  const state = readState();
  return {
    reactionsByPostId: { ...state.reactionsByPostId },
  };
}

export function getPostReaction(postId: string): EmojiReaction | null {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return null;
  }

  return readState().reactionsByPostId[normalizedPostId] ?? null;
}

export function setPostReaction(postId: string, reaction: EmojiReaction) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId || !isValidReaction(reaction)) {
    return;
  }

  updateState((state) => ({
    ...state,
    reactionsByPostId: {
      ...state.reactionsByPostId,
      [normalizedPostId]: reaction,
    },
  }));
}

export function clearPostReaction(postId: string) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return;
  }

  updateState((state) => {
    if (!(normalizedPostId in state.reactionsByPostId)) {
      return state;
    }

    const nextMap = { ...state.reactionsByPostId };
    delete nextMap[normalizedPostId];

    return {
      ...state,
      reactionsByPostId: nextMap,
    };
  });
}

export function togglePostReaction(postId: string, reaction: EmojiReaction) {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId || !isValidReaction(reaction)) {
    return;
  }

  const currentReaction = getPostReaction(normalizedPostId);
  if (currentReaction === reaction) {
    clearPostReaction(normalizedPostId);
    return;
  }

  setPostReaction(normalizedPostId, reaction);
}

export function subscribeReactions(listener: () => void) {
  ensureStorageSubscription();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function usePostEmojiReaction(postId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<EmojiReactionsSnapshot>(() => getSnapshot());

  useEffect(() => subscribeReactions(() => setSnapshot(getSnapshot())), []);

  const currentReaction = useMemo(() => {
    const normalizedPostId = postId?.trim();
    if (!normalizedPostId) {
      return null;
    }

    return snapshot.reactionsByPostId[normalizedPostId] ?? null;
  }, [postId, snapshot.reactionsByPostId]);

  return {
    clearPostReaction,
    currentReaction,
    emojiReactions,
    getPostReaction,
    setPostReaction,
    togglePostReaction,
  };
}
