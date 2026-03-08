export type PublicEnv = {
  supabaseAnonKey: string;
  supabaseUrl: string;
  telegramBotUsername: string | null;
};

const viteEnv = import.meta.env;

function normalizeBotUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/u, '');
  return normalized || null;
}

const publicEnv: PublicEnv = {
  supabaseAnonKey: viteEnv.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseUrl: viteEnv.VITE_SUPABASE_URL ?? '',
  telegramBotUsername: normalizeBotUsername(viteEnv.VITE_TELEGRAM_BOT_USERNAME),
};

export function getEnv() {
  return publicEnv;
}

export function getEnvIssues() {
  const issues: string[] = [];

  if (!publicEnv.supabaseUrl) {
    issues.push('Missing VITE_SUPABASE_URL');
  } else {
    try {
      new URL(publicEnv.supabaseUrl);
    } catch {
      issues.push('VITE_SUPABASE_URL must be a valid URL');
    }
  }

  if (!publicEnv.supabaseAnonKey) {
    issues.push('Missing VITE_SUPABASE_ANON_KEY');
  }

  return issues;
}

export function hasSupabaseEnv() {
  return getEnvIssues().length === 0;
}

export function getTelegramMiniAppEnv() {
  return {
    botUsername: publicEnv.telegramBotUsername,
  };
}

export function requireEnv() {
  const issues = getEnvIssues();

  if (issues.length > 0) {
    throw new Error(`Supabase environment is not configured. ${issues.join('. ')}`);
  }

  return publicEnv;
}
