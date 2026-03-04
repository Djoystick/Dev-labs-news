export const TOPIC_ONBOARDING_STORAGE_KEY = 'dev_labs_onboarding_topics_v1';

export function isTopicsOnboardingDone() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(TOPIC_ONBOARDING_STORAGE_KEY) === 'done';
}

export function markTopicsOnboardingDone() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TOPIC_ONBOARDING_STORAGE_KEY, 'done');
}
