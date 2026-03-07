const WELCOME_ONBOARDING_STORAGE_PREFIX = 'devlabs.onboarding.welcome.v1';

function getWelcomeOnboardingStorageKey(userId: string) {
  return `${WELCOME_ONBOARDING_STORAGE_PREFIX}:${userId}`;
}

function getAvailableStorages() {
  if (typeof window === 'undefined') {
    return [] as Storage[];
  }

  const storages: Storage[] = [];

  try {
    if (window.localStorage) {
      storages.push(window.localStorage);
    }
  } catch {
    // no-op: localStorage can be unavailable in private mode
  }

  try {
    if (window.sessionStorage) {
      storages.push(window.sessionStorage);
    }
  } catch {
    // no-op: sessionStorage can be unavailable in private mode
  }

  return storages;
}

export function isWelcomeOnboardingDone(userId: string) {
  const storageKey = getWelcomeOnboardingStorageKey(userId);

  for (const storage of getAvailableStorages()) {
    try {
      if (storage.getItem(storageKey) === 'done') {
        return true;
      }
    } catch {
      // no-op: keep checking other storage backends
    }
  }

  return false;
}

export function markWelcomeOnboardingDone(userId: string) {
  const storageKey = getWelcomeOnboardingStorageKey(userId);

  for (const storage of getAvailableStorages()) {
    try {
      storage.setItem(storageKey, 'done');
    } catch {
      // no-op: storage can fail due to quota/private mode restrictions
    }
  }
}

