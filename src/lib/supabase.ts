// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { EnvSchema } from '../env.schema';

const envParseResult = EnvSchema.safeParse(import.meta.env);
if (!envParseResult.success) {
  throw new Error('Environment variable validation failed: ' + JSON.stringify(envParseResult.error.flatten()));
}
const supabaseUrl = envParseResult.data.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envParseResult.data.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  },
);