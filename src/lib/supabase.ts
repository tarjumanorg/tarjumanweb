// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
// Do not import the global EnvSchema here. Instead, define what this specific client needs.
import { z } from "zod";

// Define a schema specifically for the variables this Supabase client instance needs
const ClientSupabaseEnvSchema = z.object({
  PUBLIC_SUPABASE_URL: z.string().url(),
  PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Validate import.meta.env against this client-specific schema
const envParseResult = ClientSupabaseEnvSchema.safeParse(import.meta.env);

if (!envParseResult.success) {
  // Construct a more informative error message, indicating context if possible
  const contextMessage = typeof window === 'undefined' ? "server-side context" : "client-side browser context";
  const errorMessage = `Supabase client environment variable validation failed in ${contextMessage}: ${JSON.stringify(envParseResult.error.flatten())}. Check that PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are correctly set and accessible. Available PUBLIC_ env keys: ${Object.keys(import.meta.env).filter(k => k.startsWith('PUBLIC_')).join(', ')}`;
  console.error(errorMessage); // Log it for better debugging
  throw new Error(errorMessage);
}

const supabaseUrl = envParseResult.data.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envParseResult.data.PUBLIC_SUPABASE_ANON_KEY;

// The explicit check for missing supabaseUrl or supabaseAnonKey is now redundant
// because Zod's .url() and .min(1) ensure they are valid non-empty strings.

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
  }
);