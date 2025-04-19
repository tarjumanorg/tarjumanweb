import { z } from "zod";

export const EnvSchema = z.object({
  PUBLIC_SUPABASE_URL: z.string().url(),
  PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

export type EnvVars = z.infer<typeof EnvSchema>;
