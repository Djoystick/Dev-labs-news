export const POST_CUSTOM_TAGS_LIMIT = 5;
export const POST_CUSTOM_TAG_MAX_LENGTH = 32;

export function normalizePostCustomTag(value: string) {
  return value.trim().toLowerCase().slice(0, POST_CUSTOM_TAG_MAX_LENGTH);
}

export function normalizePostCustomTags(values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) {
    return [] as string[];
  }

  const next: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizePostCustomTag(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(normalized);

    if (next.length >= POST_CUSTOM_TAGS_LIMIT) {
      break;
    }
  }

  return next;
}
