export function getTelegramAvatarProxyUrl(tgId: number | string, size: 'small' | 'medium' | 'large' = 'small') {
  return `/api/telegram-avatar?tg_id=${encodeURIComponent(String(tgId))}&size=${size}`;
}
