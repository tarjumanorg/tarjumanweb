import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setAuthCookies } from '../../../utils/auth';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse'; 

import { ACCESS_TOKEN, REFRESH_TOKEN } from '../../../utils/constants';

export const POST: APIRoute = async ({ cookies }) => {

  const existingAccessToken = cookies.get(ACCESS_TOKEN);
  const existingRefreshToken = cookies.get(REFRESH_TOKEN);

  if (existingAccessToken?.value && existingRefreshToken?.value) {
     console.log("Anonymous Route: Found existing tokens. Verifying session...");
     const { data: { user } } = await supabase.auth.getUser(existingAccessToken.value);
     if (user) {
        console.log(`Anonymous Route: Existing session is valid for user ${user.id}. Skipping new anonymous sign-in.`);

        return jsonResponse(200, { message: "Already authenticated anonymously", userId: user.id }); 
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

    return jsonErrorResponse(500, error?.message || "Anonymous sign-in failed"); 
  }

  console.log(`Anonymous Route: Server-side anonymous sign-in successful for user ${data.user.id}. Setting cookies.`);

  setAuthCookies(cookies, data.session);

  return jsonResponse(200, { message: "Anonymous sign-in successful", userId: data.user.id }); 
};