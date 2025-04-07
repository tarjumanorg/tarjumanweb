// src/pages/api/auth/anonymous.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase"; // Adjust path if needed
import { setAuthCookies } from '../../../utils/auth'; // <-- IMPORT ADDED

export const POST: APIRoute = async ({ cookies }) => { // Removed redirect as it's not used
  // Check if user already has a valid session cookie (optional but good practice)
  const existingAccessToken = cookies.get("sb-access-token");
  const existingRefreshToken = cookies.get("sb-refresh-token");

  if (existingAccessToken && existingRefreshToken) {
     // Optional: Validate existing session quickly?
     // For simplicity, if cookies exist, assume they might be valid or refreshable by middleware later.
     // You could add a supabase.auth.getUser(existingAccessToken.value) check here if strictness is needed.
     console.log("Anonymous sign-in skipped, existing session cookie found.");
     // Let's verify the existing token before skipping
     const { data: { user } } = await supabase.auth.getUser(existingAccessToken.value);
     if (user) {
        console.log("Existing anonymous session is valid.");
        return new Response(JSON.stringify({ message: "Already authenticated anonymously" }), { status: 200 });
     } else {
        console.log("Existing anonymous session token is invalid, proceeding with sign-in.");
     }
  }

  console.log("Attempting server-side anonymous sign-in...");
  // Perform anonymous sign-in on the server
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data?.session) {
    console.error("Server-side anonymous sign-in error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Anonymous sign-in failed" }),
      { status: 500 }
    );
  }

  console.log("Server-side anonymous sign-in successful. Setting cookies.");

  // Set cookies using the utility function
  setAuthCookies(cookies, data.session); // <-- REPLACED manual cookies.set calls

  return new Response(
    JSON.stringify({ message: "Anonymous sign-in successful", userId: data.user?.id }), // Optionally return user ID
    { status: 200 }
  );
};