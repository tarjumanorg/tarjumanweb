import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth';
import { jsonErrorResponse } from '../../../utils/apiResponse'; // <-- IMPORT ADDED

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {
    // Use utility function for error response
    return jsonErrorResponse(400, "No code provided"); // <-- UPDATED
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    console.error("Auth Callback Error:", error.message);
    // Use utility function for error response
    return jsonErrorResponse(500, error.message); // <-- UPDATED
  }

  if (!data.session) {
      console.error("Auth Callback Error: No session data returned after code exchange.");
      // Use utility function for error response
      return jsonErrorResponse(500, "Failed to establish session."); // <-- UPDATED
  }

  setAuthCookies(cookies, data.session);

  // Redirect remains unchanged
  return redirect("/dashboard");
};