export function normalizeHandle(value?: string | null) {
  const s = (value ?? '').trim();
  if (!s) {
    return null;
  }

  return s.startsWith('@') ? s.slice(1) : s;
}
