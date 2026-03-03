import { createDefaultTopicFilterState, normalizeTopicFilterState, type TopicFilterState } from '@/features/topics/model';

const storageKey = 'dev-labs-topics-filter-v1';

export function readTopicFilterState(): TopicFilterState {
  const defaults = createDefaultTopicFilterState();

  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return defaults;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return defaults;
    }

    return {
      ...defaults,
      ...normalizeTopicFilterState(JSON.parse(rawValue)),
    };
  } catch {
    return defaults;
  }
}

export function writeTopicFilterState(state: TopicFilterState) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    const normalizedState = {
      ...createDefaultTopicFilterState(),
      ...state,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedState));
  } catch {
    return;
  }
}
