const postStartPayloadPrefix = 'post_';
const forYouStartPayload = 'for_you';

export type TelegramMiniAppConfig = {
  botUsername?: string | null;
};

function normalizePostId(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeBotUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/u, '');
  return normalized || null;
}

export function getForYouStartPayload() {
  return forYouStartPayload;
}

export function getPostPath(postId: string) {
  const normalizedPostId = normalizePostId(postId);
  if (!normalizedPostId) {
    return '/';
  }

  return `/post/${encodeURIComponent(normalizedPostId)}`;
}

export function getPostStartPayload(postId: string) {
  const normalizedPostId = normalizePostId(postId);
  if (!normalizedPostId) {
    return null;
  }

  return `${postStartPayloadPrefix}${encodeURIComponent(normalizedPostId)}`;
}

export function getPostIdFromStartPayload(startPayload: string | null | undefined) {
  if (typeof startPayload !== 'string') {
    return null;
  }

  const normalizedPayload = startPayload.trim();
  if (!normalizedPayload.startsWith(postStartPayloadPrefix)) {
    return null;
  }

  const encodedPostId = normalizedPayload.slice(postStartPayloadPrefix.length);
  if (!encodedPostId) {
    return null;
  }

  try {
    const decodedPostId = decodeURIComponent(encodedPostId).trim();
    return decodedPostId || null;
  } catch {
    return null;
  }
}

export function buildMiniAppStartLink(startPayload: string, config: TelegramMiniAppConfig) {
  const normalizedPayload = startPayload.trim();
  if (!normalizedPayload) {
    return null;
  }

  const botUsername = normalizeBotUsername(config.botUsername ?? null);
  if (!botUsername) {
    return null;
  }

  const encodedPayload = encodeURIComponent(normalizedPayload);

  return `https://t.me/${botUsername}?startapp=${encodedPayload}`;
}

export function buildMiniAppPostLink(postId: string, config: TelegramMiniAppConfig) {
  const startPayload = getPostStartPayload(postId);
  if (!startPayload) {
    return null;
  }

  return buildMiniAppStartLink(startPayload, config);
}

export function buildPostWebUrl(postId: string, origin?: string | null) {
  const path = getPostPath(postId);

  const safeOrigin = typeof origin === 'string' && origin.trim() ? origin.trim() : typeof window !== 'undefined' ? window.location.origin : null;
  if (!safeOrigin) {
    return path;
  }

  try {
    return new URL(path, safeOrigin).toString();
  } catch {
    return path;
  }
}

export function buildPreferredPostOpenUrl(postId: string, config: TelegramMiniAppConfig, origin?: string | null) {
  return buildMiniAppPostLink(postId, config) ?? buildPostWebUrl(postId, origin);
}
