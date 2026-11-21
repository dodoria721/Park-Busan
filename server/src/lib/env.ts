export type ServerEnvName = 'SUPABASE_URL' | 'SUPABASE_SECRET_KEY' | 'OPENAI_API_KEY';

export function getServerEnv(name: ServerEnvName): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
