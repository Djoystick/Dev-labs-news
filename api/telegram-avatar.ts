import { Buffer } from 'buffer';

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

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isAllowedTelegramRedirectHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase();

  if (normalizedHost === 't.me' || normalizedHost === 'telegram.org' || normalizedHost === 'telegram.me' || normalizedHost === 'telesco.pe') {
    return true;
  }

  return normalizedHost.endsWith('.telesco.pe');
}

function parseAllowedUserpicUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 't.me' || !parsed.pathname.startsWith('/i/userpic/')) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function fetchAllowedUserpic(sourceUrl: URL) {
  let currentUrl = sourceUrl;
  let lastRedirectLocation: string | null = null;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const upstream = await fetch(currentUrl.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0',
      },
      redirect: 'manual',
    });

    if (!isRedirectStatus(upstream.status)) {
      return {
        finalUrl: currentUrl,
        lastRedirectLocation,
        response: upstream,
      };
    }

    const location = upstream.headers.get('location');
    if (!location) {
      return {
        finalUrl: currentUrl,
        lastRedirectLocation,
        response: upstream,
      };
    }

    lastRedirectLocation = location;

    if (redirectCount === 3) {
      return {
        finalUrl: currentUrl,
        lastRedirectLocation,
        response: upstream,
      };
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== 'https:' || !isAllowedTelegramRedirectHost(nextUrl.hostname)) {
      return {
        finalUrl: currentUrl,
        lastRedirectLocation,
        response: upstream,
      };
    }

    currentUrl = nextUrl;
  }

  throw new Error('Unexpected avatar redirect state');
}

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

  const host = getSingleHeader(request.headers?.host) || 'localhost';
  const requestUrl = new URL(request.url ?? '', `https://${host}`);
  const srcParam = (requestUrl.searchParams.get('src') ?? '').trim();
  const sizeParam = (requestUrl.searchParams.get('size') ?? 'small').trim().toLowerCase();
  const size: AvatarSize = sizeParam === 'medium' || sizeParam === 'large' ? sizeParam : 'small';

  if (srcParam) {
    const sourceUrl = parseAllowedUserpicUrl(srcParam);
    if (!sourceUrl) {
      sendJson(response, 400, { error: 'Invalid src' });
      return;
    }

    try {
      const upstreamResult = await fetchAllowedUserpic(sourceUrl);
      const fileResponse = upstreamResult.response;

      response.setHeader('X-Avatar-Upstream-Status', String(fileResponse.status));
      response.setHeader('X-Avatar-Upstream-Url', upstreamResult.finalUrl.href);
      if (upstreamResult.lastRedirectLocation) {
        response.setHeader('X-Avatar-Upstream-Location', upstreamResult.lastRedirectLocation);
      }

      if (fileResponse.status !== 200) {
        setCacheHeaders(response);
        response.status(204).end();
        return;
      }

      const body = Buffer.from(await fileResponse.arrayBuffer());
      const contentType = fileResponse.headers.get('content-type') ?? 'image/jpeg';

      setCacheHeaders(response);
      response.setHeader('Content-Type', contentType);
      response.status(200).send(body);
      return;
    } catch {
      response.setHeader('X-Avatar-Upstream-Status', '0');
      response.setHeader('X-Avatar-Upstream-Url', sourceUrl.href);
      setCacheHeaders(response);
      response.status(204).end();
      return;
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    sendJson(response, 500, { error: 'Missing TELEGRAM_BOT_TOKEN' });
    return;
  }

  const tgIdParam = (requestUrl.searchParams.get('tg_id') ?? '').trim();
  const tgId = Number(tgIdParam);

  if (!tgIdParam || !Number.isInteger(tgId) || tgId <= 0) {
    response.status(400).send('Missing tg_id');
    return;
  }

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
