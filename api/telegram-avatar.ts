import { Buffer } from 'node:buffer';

type ApiRequest = {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
};

type ApiResponse = {
  end: (body?: string) => void;
  send: (body?: string | Buffer) => void;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
};

type AvatarSize = 'small' | 'medium' | 'large';

type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
  height?: number;
  width?: number;
};

type TelegramApiResponse<T> = {
  description?: string;
  ok: boolean;
  result?: T;
};

type TelegramProfilePhotos = {
  photos?: TelegramPhotoSize[][];
};

type TelegramFileResult = {
  file_path?: string;
};

function getSingleHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function sendJson(response: ApiResponse, status: number, payload: Record<string, string>) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).send(JSON.stringify(payload));
}

function getPhotoWeight(photo: TelegramPhotoSize) {
  if (typeof photo.file_size === 'number' && Number.isFinite(photo.file_size)) {
    return photo.file_size;
  }

  return Math.max(1, (photo.width ?? 0) * (photo.height ?? 0));
}

function pickPhotoBySize(photos: TelegramPhotoSize[], size: AvatarSize) {
  if (photos.length === 0) {
    return null;
  }

  const sorted = [...photos].sort((left, right) => getPhotoWeight(left) - getPhotoWeight(right));

  if (size === 'small') {
    return sorted[0] ?? null;
  }

  if (size === 'large') {
    return sorted[sorted.length - 1] ?? null;
  }

  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

async function fetchTelegramJson<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as TelegramApiResponse<T>;
  if (!payload.ok || !payload.result) {
    throw new Error(payload.description ?? 'Telegram API returned an empty result.');
  }

  return payload.result;
}

function setCacheHeaders(response: ApiResponse) {
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    sendJson(response, 500, { error: 'Missing TELEGRAM_BOT_TOKEN' });
    return;
  }

  const host = getSingleHeader(request.headers?.host) || 'localhost';
  const requestUrl = new URL(request.url ?? '', `https://${host}`);
  const tgIdParam = (requestUrl.searchParams.get('tg_id') ?? '').trim();
  const tgId = Number(tgIdParam);

  if (!tgIdParam || !Number.isInteger(tgId) || tgId <= 0) {
    response.status(400).send('Missing tg_id');
    return;
  }

  const sizeParam = (requestUrl.searchParams.get('size') ?? 'small').trim().toLowerCase();
  const size: AvatarSize = sizeParam === 'medium' || sizeParam === 'large' ? sizeParam : 'small';

  try {
    const profilePhotosUrl = `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${encodeURIComponent(String(tgId))}&limit=1`;
    const profilePhotos = await fetchTelegramJson<TelegramProfilePhotos>(profilePhotosUrl);
    const firstPhotoSet = profilePhotos.photos?.[0] ?? [];

    if (firstPhotoSet.length === 0) {
      setCacheHeaders(response);
      response.status(204).end();
      return;
    }

    const selectedPhoto = pickPhotoBySize(firstPhotoSet, size);
    if (!selectedPhoto) {
      setCacheHeaders(response);
      response.status(204).end();
      return;
    }

    const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(selectedPhoto.file_id)}`;
    const fileInfo = await fetchTelegramJson<TelegramFileResult>(fileInfoUrl);

    if (!fileInfo.file_path) {
      sendJson(response, 502, { error: 'Telegram file path is missing' });
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
    const fileResponse = await fetch(fileUrl);

    if (!fileResponse.ok) {
      sendJson(response, 502, { error: 'Failed to fetch Telegram avatar file' });
      return;
    }

    const body = Buffer.from(await fileResponse.arrayBuffer());
    const contentType = fileResponse.headers.get('content-type') ?? 'image/jpeg';

    setCacheHeaders(response);
    response.setHeader('Content-Type', contentType);
    response.status(200).send(body);
  } catch {
    sendJson(response, 502, { error: 'Failed to load Telegram avatar' });
  }
}
