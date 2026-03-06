export function getTelegramAvatarProxyUrl(tgId: number | string, size: 'small' | 'medium' | 'large' = 'small') {
  return `/api/telegram-avatar?tg_id=${encodeURIComponent(String(tgId))}&size=${size}`;
}

export function getTelegramPhotoUrlProxy(photoUrl: string, size: 'small' | 'medium' | 'large' = 'small') {
  void size;
  return `/api/telegram-avatar?src=${encodeURIComponent(photoUrl)}`;
}
