import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth';
import { jsonErrorResponse } from '../../../utils/apiResponse'; 

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {

    return jsonErrorResponse(400, "No code provided"); 
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    console.error("Auth Callback Error:", error.message);

    return jsonErrorResponse(500, error.message); 
  }

  if (!data.session) {
      console.error("Auth Callback Error: No session data returned after code exchange.");

      return jsonErrorResponse(500, "Failed to establish session."); 
  }

  setAuthCookies(cookies, data.session);

  return redirect("/dashboard");
};