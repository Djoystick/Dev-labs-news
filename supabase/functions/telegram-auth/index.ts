import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Raw(key: string | Uint8Array, message: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function hmacSha256Hex(key: string | Uint8Array, message: string) {
  return toHex(await hmacSha256Raw(key, message));
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function parseTelegramUser(rawUser: string | null) {
  if (!rawUser) {
    throw new Error('Telegram payload is missing the user field.');
  }

  const user = JSON.parse(rawUser) as {
    id: number;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    username?: string;
  };

  if (!user?.id) {
    throw new Error('Telegram payload does not contain a valid user id.');
  }

  return user;
}

async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDateValue = params.get('auth_date');

  if (!hash) {
    throw new Error('Telegram payload is missing hash.');
  }

  if (!authDateValue) {
    throw new Error('Telegram payload is missing auth_date.');
  }

  const authDate = Number(authDateValue);

  if (!Number.isFinite(authDate)) {
    throw new Error('Telegram payload auth_date is invalid.');
  }

  if (Math.floor(Date.now() / 1000) - authDate > 60 * 60 * 24) {
    throw new Error('Telegram payload is too old.');
  }

  const entries = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = new Uint8Array(await hmacSha256Raw('WebAppData', botToken));
  const calculatedHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (calculatedHash !== hash) {
    throw new Error('Telegram initData hash verification failed.');
  }

  return parseTelegramUser(params.get('user'));
}

function getDisplayName(user: { first_name?: string; last_name?: string }) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
}

async function getDeterministicPassword(botToken: string, telegramId: string) {
  const hex = await hmacSha256Hex(botToken, `telegram-auth:${telegramId}`);
  return `Tg!${hex.slice(0, 48)}`;
}

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }

  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = getEnv('SUPABASE_URL');
    const { initData } = (await request.json()) as { initData?: string };

    if (!initData) {
      throw new Error('initData is required.');
    }

    const telegramUser = await verifyInitData(initData, botToken);
    const telegramId = String(telegramUser.id);
    const email = `tg_${telegramId}@telegram.local`;
    const password = await getDeterministicPassword(botToken, telegramId);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authUsers = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsers.error) {
      throw new Error(authUsers.error.message);
    }

    const existingUser = authUsers.data.users.find((user) => user.email === email);
    const displayName = getDisplayName(telegramUser);
    let userId = existingUser?.id ?? null;

    if (!existingUser) {
      const createUserResult = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: {
          avatar_url: telegramUser.photo_url ?? null,
          full_name: displayName,
          telegram_id: telegramId,
          username: telegramUser.username ?? null,
        },
      });

      if (createUserResult.error) {
        throw new Error(createUserResult.error.message);
      }

      userId = createUserResult.data.user.id;
    } else {
      const updateUserResult = await adminClient.auth.admin.updateUserById(existingUser.id, {
        email,
        email_confirm: true,
        password,
        user_metadata: {
          avatar_url: telegramUser.photo_url ?? null,
          full_name: displayName,
          telegram_id: telegramId,
          username: telegramUser.username ?? null,
        },
      });

      if (updateUserResult.error) {
        throw new Error(updateUserResult.error.message);
      }

      userId = updateUserResult.data.user.id;
    }

    if (!userId) {
      throw new Error('Failed to resolve Supabase auth user.');
    }

    const existingProfileResult = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfileResult.error) {
      throw new Error(existingProfileResult.error.message);
    }

    const profileRole = existingProfileResult.data?.role ?? 'user';
    const upsertProfileResult = await adminClient.from('profiles').upsert(
      {
        avatar_url: telegramUser.photo_url ?? null,
        full_name: displayName,
        id: userId,
        role: profileRole,
        telegram_id: telegramId,
        username: telegramUser.username ?? null,
      },
      { onConflict: 'id' },
    );

    if (upsertProfileResult.error) {
      throw new Error(upsertProfileResult.error.message);
    }

    return jsonResponse({ email, password });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected error.',
      },
      400,
    );
  }
});
