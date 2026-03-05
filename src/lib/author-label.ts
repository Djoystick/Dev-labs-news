export function normalizeHandle(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
