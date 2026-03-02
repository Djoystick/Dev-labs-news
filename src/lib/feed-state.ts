const feedStateKey = 'dev-labs:feed-state';
const feedReturnIntentKey = 'dev-labs:feed-return-intent';

type FeedState = {
  scrollY: number;
  search: string;
};

export function saveFeedState(state: FeedState) {
  window.sessionStorage.setItem(feedStateKey, JSON.stringify(state));
}

export function readFeedState(): FeedState | null {
  const rawValue = window.sessionStorage.getItem(feedStateKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as FeedState;
  } catch {
    return null;
  }
}

export function markFeedReturnIntent() {
  window.sessionStorage.setItem(feedReturnIntentKey, '1');
}

export function consumeFeedReturnIntent() {
  const hasIntent = window.sessionStorage.getItem(feedReturnIntentKey) === '1';

  if (hasIntent) {
    window.sessionStorage.removeItem(feedReturnIntentKey);
  }

  return hasIntent;
}
