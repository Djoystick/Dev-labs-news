/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import "@supabase/edge-runtime.d.ts";
import { serve } from "@std/http/server";
import { SignJWT } from "jose";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const PROFILE_SELECT = 'id, role, handle, handle_norm, bio, telegram_id, username, full_name, avatar_url, created_at';
const DEFAULT_AUTH_MAX_AGE_SECONDS = 60 * 60 * 24;
const encoder = new TextEncoder();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

type TelegramAuthRequestBody = {
  initData?: string;
};

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
};

type ProfileRecord = {
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  full_name: string | null;
  handle: string | null;
  handle_norm: string | null;
  id: string;
  role: 'admin' | 'editor' | 'user';
  telegram_id: string | null;
  username: string | null;
};

type AuthUserMetadata = {
  avatar_url: string | null;
  full_name: string | null;
  telegram_id: string;
  username: string | null;
};

type AdminClient = SupabaseClient;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function signHmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const rawKey = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(rawKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(encoder.encode(message)));

  return new Uint8Array(signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function getEnvWithFallback(primary: string, fallback?: string) {
  return Deno.env.get(primary) ?? (fallback ? Deno.env.get(fallback) : undefined);
}

function getRequiredServerEnv() {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const jwtSecret = Deno.env.get('JWT_SECRET');
  const serviceRoleKey = getEnvWithFallback('SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = getEnvWithFallback('PROJECT_URL', 'SUPABASE_URL');

  if (!botToken || !jwtSecret || !serviceRoleKey || !supabaseUrl) {
    throw new HttpError(500, 'Server misconfigured');
  }

  return { botToken, jwtSecret, serviceRoleKey, supabaseUrl };
}

function getAuthMaxAgeSeconds(): number {
  const value = Deno.env.get('TELEGRAM_AUTH_MAX_AGE_SECONDS');

  if (!value) {
    return DEFAULT_AUTH_MAX_AGE_SECONDS;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_AUTH_MAX_AGE_SECONDS;
  }

  return parsed;
}

function parseTelegramUser(rawUser: string | null): TelegramUser {
  if (!rawUser) {
    throw new HttpError(400, 'Telegram payload is missing the user field.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawUser);
  } catch {
    throw new HttpError(400, 'Telegram payload user field is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new HttpError(400, 'Telegram payload user field is invalid.');
  }

  const user = parsed as TelegramUser;

  if (!Number.isInteger(user.id) || user.id <= 0) {
    throw new HttpError(400, 'Telegram payload does not contain a valid user id.');
  }

  return user;
}

async function verifyInitData(initData: string, botToken: string, maxAgeSeconds: number): Promise<TelegramUser> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDateValue = params.get('auth_date');

  if (!hash) {
    throw new HttpError(400, 'Telegram payload is missing hash.');
  }

  if (!authDateValue) {
    throw new HttpError(400, 'Telegram payload is missing auth_date.');
  }

  const authDate = Number(authDateValue);

  if (!Number.isInteger(authDate)) {
    throw new HttpError(400, 'Telegram payload auth_date is invalid.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (authDate > nowSeconds + 300) {
    throw new HttpError(400, 'Telegram payload auth_date is in the future.');
  }

  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new HttpError(400, 'Telegram payload is too old.');
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await signHmacSha256('WebAppData', botToken);
  const calculatedHash = bytesToHex(await signHmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(calculatedHash, hash)) {
    throw new HttpError(400, 'Telegram initData hash is invalid.');
  }

  return parseTelegramUser(params.get('user'));
}

function getDisplayName(user: TelegramUser): string | null {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null;
}

function buildAuthMetadata(user: TelegramUser, telegramId: string): AuthUserMetadata {
  return {
    avatar_url: user.photo_url ?? null,
    full_name: getDisplayName(user),
    telegram_id: telegramId,
    username: user.username ?? null,
  };
}

async function getDeterministicPassword(botToken: string, telegramId: string): Promise<string> {
  const hash = await signHmacSha256(botToken, `tg:${telegramId}:dev-labs-news`);
  return `Tg!${bytesToBase64Url(hash)}`;
}

async function parseRequestBody(request: Request): Promise<TelegramAuthRequestBody> {
  try {
    return (await request.json()) as TelegramAuthRequestBody;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

async function findAuthUserByEmail(
  adminClient: AdminClient,
  email: string,
): Promise<User | null> {
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage });

    if (result.error) {
      throw new HttpError(500, result.error.message);
    }

    const foundUser = result.data.users.find((user: User) => user.email?.toLowerCase() === email.toLowerCase());

    if (foundUser) {
      return foundUser;
    }

    if (result.data.users.length < perPage) {
      break;
    }
  }

  return null;
}

async function getProfileByTelegramId(
  adminClient: AdminClient,
  telegramId: string,
): Promise<ProfileRecord | null> {
  const result = await adminClient
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (result.error) {
    throw new HttpError(500, result.error.message);
  }

  return (result.data as ProfileRecord | null) ?? null;
}

async function getProfileByUserId(
  adminClient: AdminClient,
  userId: string,
): Promise<ProfileRecord | null> {
  const result = await adminClient.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle();

  if (result.error) {
    throw new HttpError(500, result.error.message);
  }

  return (result.data as ProfileRecord | null) ?? null;
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = await parseRequestBody(request);
    const rawInitData = typeof body.initData === 'string' ? body.initData.trim() : null;

    if (!rawInitData) {
      throw new HttpError(400, 'initData is required.');
    }

    const initData: string = rawInitData;

    const { botToken, jwtSecret, serviceRoleKey, supabaseUrl } = getRequiredServerEnv();
    const telegramUser = await verifyInitData(initData, botToken, getAuthMaxAgeSeconds());
    const telegramId = String(telegramUser.id);
    const email = `tg_${telegramId}@telegram.local`;
    const password = await getDeterministicPassword(botToken, telegramId);
    const metadata = buildAuthMetadata(telegramUser, telegramId);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let existingProfile = await getProfileByTelegramId(adminClient, telegramId);
    let userId = existingProfile?.id ?? null;

    if (!userId) {
      const existingAuthUser = await findAuthUserByEmail(adminClient, email);
      userId = existingAuthUser?.id ?? null;

      if (userId) {
        existingProfile = await getProfileByUserId(adminClient, userId);
      }
    }

    if (!userId) {
      const createUserResult = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: metadata,
      });

      if (createUserResult.error) {
        throw new HttpError(500, createUserResult.error.message);
      }

      userId = createUserResult.data.user.id;
      existingProfile = await getProfileByUserId(adminClient, userId);
    } else {
      const updateUserResult = await adminClient.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        password,
        user_metadata: metadata,
      });

      if (updateUserResult.error) {
        throw new HttpError(500, updateUserResult.error.message);
      }
    }

    if (!userId) {
      throw new HttpError(500, 'Failed to resolve Supabase auth user.');
    }

    const profilePayload = {
      avatar_url: metadata.avatar_url,
      bio: existingProfile?.bio ?? null,
      full_name: metadata.full_name,
      handle: existingProfile?.handle ?? null,
      handle_norm: existingProfile?.handle_norm ?? null,
      id: userId,
      role: existingProfile?.role ?? 'user',
      telegram_id: telegramId,
      username: metadata.username,
    };

    const upsertProfileResult = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select(PROFILE_SELECT)
      .single();

    if (upsertProfileResult.error) {
      throw new HttpError(500, upsertProfileResult.error.message);
    }

    const profile = upsertProfileResult.data as ProfileRecord;
    const key = encoder.encode(jwtSecret);
    const token = await new SignJWT({
      app_role: profile.role,
      role: 'authenticated',
      telegram_id: profile.telegram_id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('authenticated')
      .setSubject(profile.id)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(key);

    return jsonResponse({
      ok: true,
      profile: {
        id: profile.id,
        role: profile.role,
        telegram_id: profile.telegram_id,
        username: profile.username,
      },
      token,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error('telegram-auth failed', error);
    return jsonResponse({ error: 'Internal server error.' }, 500);
  }
});
