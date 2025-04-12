// src/pages/api/auth/anonymous.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse'; // <-- IMPORT ADDED
// Using constants for cookie names
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../../../utils/constants';

export const POST: APIRoute = async ({ cookies }) => {
  // Check for *existing*, *valid* tokens before attempting a new anonymous sign-in.
  const existingAccessToken = cookies.get(ACCESS_TOKEN);
  const existingRefreshToken = cookies.get(REFRESH_TOKEN);

  if (existingAccessToken?.value && existingRefreshToken?.value) {
     console.log("Anonymous Route: Found existing tokens. Verifying session...");
     const { data: { user } } = await supabase.auth.getUser(existingAccessToken.value);
     if (user) {
        console.log(`Anonymous Route: Existing session is valid for user ${user.id}. Skipping new anonymous sign-in.`);
        // Use utility function for success response
        return jsonResponse(200, { message: "Already authenticated anonymously", userId: user.id }); // <-- UPDATED
     } else {
        console.log("Anonymous Route: Existing session token is invalid or expired. Proceeding with sign-in.");
     }
  } else {
      console.log("Anonymous Route: No existing auth tokens found or incomplete pair.");
  }

  console.log("Anonymous Route: Attempting server-side anonymous sign-in...");
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data?.session || !data?.user) {
    console.error("Anonymous Route: Server-side anonymous sign-in error:", error);
    // Use utility function for error response
    return jsonErrorResponse(500, error?.message || "Anonymous sign-in failed"); // <-- UPDATED
  }

  console.log(`Anonymous Route: Server-side anonymous sign-in successful for user ${data.user.id}. Setting cookies.`);

  setAuthCookies(cookies, data.session);

  // Use utility function for success response
  return jsonResponse(200, { message: "Anonymous sign-in successful", userId: data.user.id }); // <-- UPDATED
};