import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

const { supabaseAnonKey, supabaseUrl } = getEnv();

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'public-anon-key');
