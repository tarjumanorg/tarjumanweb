import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth'; // <-- IMPORT aDDED

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {
    return new Response("No code provided", { status: 400 });
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    console.error("Auth Callback Error:", error.message);
    return new Response(error.message, { status: 500 });
  }

  if (!data.session) {
      console.error("Auth Callback Error: No session data returned after code exchange.");
      return new Response("Failed to establish session.", { status: 500});
  }


  setAuthCookies(cookies, data.session);

  return redirect("/dashboard");
};