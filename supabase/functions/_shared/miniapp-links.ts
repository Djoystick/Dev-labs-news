export const FOR_YOU_START_PAYLOAD = "for_you";
const POST_START_PAYLOAD_PREFIX = "post_";

export function normalizeBotUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/u, "");
  return normalized || null;
}

function normalizeStartPayload(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizePostId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function buildPostStartPayload(postId: string) {
  const normalizedPostId = normalizePostId(postId);
  if (!normalizedPostId) {
    return null;
  }

  return `${POST_START_PAYLOAD_PREFIX}${encodeURIComponent(normalizedPostId)}`;
}

export function buildMiniAppStartAppUrl(botUsername: string | null, startPayload: string) {
  const normalizedBotUsername = normalizeBotUsername(botUsername);
  const normalizedPayload = normalizeStartPayload(startPayload);

  if (!normalizedBotUsername || !normalizedPayload) {
    return null;
  }

  const encodedPayload = encodeURIComponent(normalizedPayload);

  return `https://t.me/${normalizedBotUsername}?startapp=${encodedPayload}`;
}

export function buildMiniAppForYouUrl(botUsername: string | null) {
  return buildMiniAppStartAppUrl(botUsername, FOR_YOU_START_PAYLOAD);
}

export function buildMiniAppPostUrl(botUsername: string | null, postId: string) {
  const startPayload = buildPostStartPayload(postId);
  if (!startPayload) {
    return null;
  }

  return buildMiniAppStartAppUrl(botUsername, startPayload);
}
