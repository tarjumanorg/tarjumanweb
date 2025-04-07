// src/pages/api/auth/anonymous.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../../utils/constants'; // <-- IMPORT ADDED

export const POST: APIRoute = async ({ cookies }) => {
  // Use constants for cookie names
  const existingAccessToken = cookies.get(ACCESS_TOKEN_COOKIE); // <-- UPDATED
  const existingRefreshToken = cookies.get(REFRESH_TOKEN_COOKIE); // <-- UPDATED

  if (existingAccessToken && existingRefreshToken) {
     // Verify the existing token before skipping
     const { data: { user } } = await supabase.auth.getUser(existingAccessToken.value);
     if (user) {
        console.log("Existing anonymous session is valid.");
        return new Response(JSON.stringify({ message: "Already authenticated anonymously" }), { status: 200 });
     } else {
        console.log("Existing anonymous session token is invalid, proceeding with sign-in.");
     }
  }

  console.log("Attempting server-side anonymous sign-in...");
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data?.session) {
    console.error("Server-side anonymous sign-in error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Anonymous sign-in failed" }),
      { status: 500 }
    );
  }

  console.log("Server-side anonymous sign-in successful. Setting cookies.");

  // Utility function handles constants internally
  setAuthCookies(cookies, data.session);

  return new Response(
    JSON.stringify({ message: "Anonymous sign-in successful", userId: data.user?.id }),
    { status: 200 }
  );
};