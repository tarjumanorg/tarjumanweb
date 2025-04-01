import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";

// It's slightly cleaner to define the path separately if needed elsewhere,
// but defining it inline is also fine here.
const OAUTH_CALLBACK_PATH = "/api/auth/callback";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => { // Destructure 'url' from context
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const provider = formData.get("provider")?.toString();

  // Construct the redirect URL dynamically using the request's origin
  const redirectUrl = `${url.origin}${OAUTH_CALLBACK_PATH}`;

  if (provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        // Use the dynamically constructed URL
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return redirect(data.url); // Redirect user to the provider's auth page
  }

  // --- Email/Password Logic remains the same ---
  if (!email || !password) {
    return new Response("Email and password are required", { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const { access_token, refresh_token } = data.session;
  cookies.set("sb-access-token", access_token, {
    sameSite: "strict",
    path: "/",
    secure: true, // Keep secure: true (important for production)
    httpOnly: true, // Recommended for security
  });
  cookies.set("sb-refresh-token", refresh_token, {
    sameSite: "strict",
    path: "/",
    secure: true, // Keep secure: true
    httpOnly: true, // Essential for refresh token security
  });

  return redirect("/dashboard");
};