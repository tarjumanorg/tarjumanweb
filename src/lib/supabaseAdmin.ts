// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  if (!import.meta.env.PROD) {
      console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables for admin client.");
       throw new Error("Admin Supabase client configuration error. Check SUPABASE_SERVICE_ROLE_KEY. Ensure it's NOT prefixed with PUBLIC_.");
  } else {
       throw new Error("Server configuration error [Admin SB].");
  }
}
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
     auth: {
       autoRefreshToken: false,
       persistSession: false,
     }
  }
);

console.log("Admin Supabase client initialized (using Service Role Key).");