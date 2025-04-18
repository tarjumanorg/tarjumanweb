// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
// IMPORTANT: Use the Service Role Key here. It must be available in the server environment.
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Throw an error during server startup if keys are missing
  if (!import.meta.env.PROD) {
      console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables for admin client.");
       // Provide more guidance in dev
       throw new Error("Admin Supabase client configuration error. Check SUPABASE_SERVICE_ROLE_KEY. Ensure it's NOT prefixed with PUBLIC_.");
  } else {
       // Less verbose in prod
       throw new Error("Server configuration error [Admin SB].");
  }
}

// Create a client instance configured with the Service Role Key
// This client bypasses RLS.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    // Optional: Specify auth options if needed, though typically not required
    // when using service_role key directly for backend operations.
    // Using pkce flow here might be unnecessary/ignored when service key is used.
     auth: {
       // Persist session might not be relevant for service key usage.
       // Set autoRefreshToken to false, as service key doesn't expire like user tokens.
       autoRefreshToken: false,
       persistSession: false,
       // detectSessionInUrl: false, // Already default
     }
  }
);

console.log("Admin Supabase client initialized (using Service Role Key).");