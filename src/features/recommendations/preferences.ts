import { useEffect, useMemo, useState } from 'react';

const storageKey = 'devlabs.recommendations.v1';
const maxTopics = 300;

export type TopicPreference = 'more' | 'less';

type RecommendationsPreferencesState = {
  dislikedTopics: string[];
  likedTopics: string[];
};

type RecommendationsPreferencesSnapshot = {
  dislikedTopics: string[];
  likedTopics: string[];
};

const listeners = new Set<() => void>();
let isStorageSubscribed = false;
let stateCache: RecommendationsPreferencesState | null = null;

function isClient() {
  return typeof window !== 'undefined';
}

function getDefaultState(): RecommendationsPreferencesState {
  return {
    dislikedTopics: [],
    likedTopics: [],
  };
}

function sanitizeTopics(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueTopics = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    uniqueTopics.add(normalized);
    if (uniqueTopics.size >= maxTopics) {
      break;
    }
  }

  return Array.from(uniqueTopics);
}

function sanitizeState(value: unknown): RecommendationsPreferencesState {
  if (!value || typeof value !== 'object') {
    return getDefaultState();
  }

  const source = value as Partial<RecommendationsPreferencesState>;
  const likedTopics = sanitizeTopics(source.likedTopics);
  const dislikedTopics = sanitizeTopics(source.dislikedTopics).filter((topic) => !likedTopics.includes(topic));

  return {
    dislikedTopics,
    likedTopics,
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

function readState(): RecommendationsPreferencesState {
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

function writeState(nextState: RecommendationsPreferencesState) {
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

function updateState(updater: (state: RecommendationsPreferencesState) => RecommendationsPreferencesState) {
  const currentState = readState();
  writeState(updater(currentState));
}

function getSnapshot(): RecommendationsPreferencesSnapshot {
  const state = readState();

  return {
    dislikedTopics: [...state.dislikedTopics],
    likedTopics: [...state.likedTopics],
  };
}

export function likeTopic(topic: string) {
  const normalizedTopic = topic.trim();
  if (!normalizedTopic) {
    return;
  }

  updateState((state) => ({
    dislikedTopics: state.dislikedTopics.filter((item) => item !== normalizedTopic),
    likedTopics: [normalizedTopic, ...state.likedTopics.filter((item) => item !== normalizedTopic)].slice(0, maxTopics),
  }));
}

export function dislikeTopic(topic: string) {
  const normalizedTopic = topic.trim();
  if (!normalizedTopic) {
    return;
  }

  updateState((state) => ({
    dislikedTopics: [normalizedTopic, ...state.dislikedTopics.filter((item) => item !== normalizedTopic)].slice(0, maxTopics),
    likedTopics: state.likedTopics.filter((item) => item !== normalizedTopic),
  }));
}

export function clearTopicPreference(topic: string) {
  const normalizedTopic = topic.trim();
  if (!normalizedTopic) {
    return;
  }

  updateState((state) => ({
    dislikedTopics: state.dislikedTopics.filter((item) => item !== normalizedTopic),
    likedTopics: state.likedTopics.filter((item) => item !== normalizedTopic),
  }));
}

export function getTopicPreference(topic: string): TopicPreference | null {
  if (!topic) {
    return null;
  }

  const state = readState();
  if (state.likedTopics.includes(topic)) {
    return 'more';
  }

  if (state.dislikedTopics.includes(topic)) {
    return 'less';
  }

  return null;
}

export function subscribeTopicPreferences(listener: () => void) {
  ensureStorageSubscription();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useRecommendationsPreferences() {
  const [snapshot, setSnapshot] = useState<RecommendationsPreferencesSnapshot>(() => getSnapshot());

  useEffect(() => subscribeTopicPreferences(() => setSnapshot(getSnapshot())), []);

  const likedTopicsSet = useMemo(() => new Set(snapshot.likedTopics), [snapshot.likedTopics]);
  const dislikedTopicsSet = useMemo(() => new Set(snapshot.dislikedTopics), [snapshot.dislikedTopics]);

  return {
    clearTopicPreference,
    dislikeTopic,
    dislikedTopics: snapshot.dislikedTopics,
    getTopicPreference: (topic: string) => {
      const normalizedTopic = topic.trim();
      if (!normalizedTopic) {
        return null;
      }

      if (likedTopicsSet.has(normalizedTopic)) {
        return 'more' as const;
      }

      if (dislikedTopicsSet.has(normalizedTopic)) {
        return 'less' as const;
      }

      return null;
    },
    likeTopic,
    likedTopics: snapshot.likedTopics,
  };
}
