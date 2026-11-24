// Cliente único de Supabase. Las variables PUBLIC_* se leen de .env (ver .env.example).
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

export const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(
  env.PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  env.PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-missing',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }
);

/** URL pública de un archivo en un bucket público. */
export function publicUrl(bucket: 'images' | 'docs' | 'audio' | 'avatars', path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Lanza si la respuesta de Supabase trae error; devuelve data. */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
