import type { Profile } from '@/types/db';

const authProfileStorageKey = 'dev-labs-auth-profile';
const authTokenStorageKey = 'dev-labs-auth-token';

export type StoredAuthState = {
  profile: Profile;
  token: string;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getStoredAuthToken() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(authTokenStorageKey);
}

export function getStoredAuthState(): StoredAuthState | null {
  if (!canUseStorage()) {
    return null;
  }

  const token = window.localStorage.getItem(authTokenStorageKey);
  const rawProfile = window.localStorage.getItem(authProfileStorageKey);

  if (!token || !rawProfile) {
    return null;
  }

  try {
    return {
      profile: JSON.parse(rawProfile) as Profile,
      token,
    };
  } catch {
    clearStoredAuthState();
    return null;
  }
}

export function setStoredAuthState(value: StoredAuthState) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(authTokenStorageKey, value.token);
  window.localStorage.setItem(authProfileStorageKey, JSON.stringify(value.profile));
}

export function clearStoredAuthState() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
  window.localStorage.removeItem(authProfileStorageKey);
}
