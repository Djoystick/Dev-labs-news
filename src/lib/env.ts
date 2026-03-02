export type PublicEnv = {
  supabaseAnonKey: string;
  supabaseUrl: string;
};

const viteEnv = import.meta.env;

const publicEnv: PublicEnv = {
  supabaseAnonKey: viteEnv.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseUrl: viteEnv.VITE_SUPABASE_URL ?? '',
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

export function requireEnv() {
  const issues = getEnvIssues();

  if (issues.length > 0) {
    throw new Error(`Supabase environment is not configured. ${issues.join('. ')}`);
  }

  return publicEnv;
}
