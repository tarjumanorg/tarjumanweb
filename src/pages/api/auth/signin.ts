import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { AUTH_CALLBACK_PATH } from "../../../utils/constants";
import { jsonErrorResponse } from '../../../utils/apiResponse'; // <-- IMPORT ADDED

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const provider = formData.get("provider")?.toString();

  const redirectUrl = `${url.origin}${AUTH_CALLBACK_PATH}`;

  if (provider === "google") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("OAuth Error:", error.message);
      // Use utility function for error response
      return jsonErrorResponse(500, error.message); // <-- UPDATED
    }

    // Redirect remains unchanged
    return redirect(data.url);
  }
  // Use utility function for error response
  return jsonErrorResponse(400, "Invalid sign-in method"); // <-- UPDATED
};