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

  // --- Anonymous to Permanent Account Linking Logic ---
  // Check if there was an active anonymous session before OAuth
  const { data: currentSessionData, error: sessionError } = await supabase.auth.getSession();
  const currentSession = currentSessionData?.session;
  const isAnonymous = currentSession?.user?.is_anonymous === true;

  let finalSession = data.session;

  if (isAnonymous) {
    try {
      // Attempt to link the OAuth identity to the anonymous user
      const { error: linkError } = await supabase.auth.linkIdentity({ provider: 'google' });
      if (linkError) {
        if (linkError.message && linkError.message.toLowerCase().includes('already registered')) {
          await supabase.auth.signOut();
          finalSession = data.session;
        } else {
          console.error('linkIdentity error:', linkError.message);
          finalSession = data.session;
        }
      } else {
        // Linking succeeded, fetch the upgraded session
        const { data: upgradedSessionData } = await supabase.auth.getSession();
        if (upgradedSessionData?.session) {
          finalSession = upgradedSessionData.session;
        }
      }
    } catch (err) {
      console.error('Exception during linkIdentity:', err);
      finalSession = data.session;
    }
  }

  setAuthCookies(cookies, finalSession);

  return redirect("/dashboard");
};