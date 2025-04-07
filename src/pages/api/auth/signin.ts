import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { AUTH_CALLBACK_PATH } from "../../../utils/constants"; // <-- IMPORT ADDED

// const OAUTH_CALLBACK_PATH = "/api/auth/callback"; // Defined in constants now

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const provider = formData.get("provider")?.toString();

  // Use constant for callback path
  const redirectUrl = `${url.origin}${AUTH_CALLBACK_PATH}`; // <-- UPDATED

  if (provider === "google") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("OAuth Error:", error.message);
      return new Response(error.message, { status: 500 });
    }

    return redirect(data.url);
  }
  return new Response("Invalid sign-in method", { status: 400 });
};