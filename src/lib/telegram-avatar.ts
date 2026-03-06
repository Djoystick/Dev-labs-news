export function getTelegramAvatarProxyUrl(tgId: number | string, size: 'small' | 'medium' | 'large' = 'small') {
  return `/api/telegram-avatar?tg_id=${encodeURIComponent(String(tgId))}&size=${size}`;
}

export function getTelegramPhotoUrlProxy(photoUrl: string, size: 'small' | 'medium' | 'large' = 'small') {
  const target = size === 'small' ? 80 : size === 'medium' ? 160 : 320;
  const mappedUrl = photoUrl.replace(/\/userpic\/\d+\//, `/userpic/${target}/`);
  return `/api/telegram-avatar?src=${encodeURIComponent(mappedUrl)}`;
}
