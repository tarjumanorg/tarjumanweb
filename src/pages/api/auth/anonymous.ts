// src/pages/api/auth/anonymous.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase"; // Adjust path if needed

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Check if user already has a valid session cookie (optional but good practice)
  const existingAccessToken = cookies.get("sb-access-token");
  const existingRefreshToken = cookies.get("sb-refresh-token");

  if (existingAccessToken && existingRefreshToken) {
     // Optional: Validate existing session quickly?
     // For simplicity, if cookies exist, assume they might be valid or refreshable by middleware later.
     // You could add a supabase.auth.getUser(existingAccessToken.value) check here if strictness is needed.
     console.log("Anonymous sign-in skipped, existing session cookie found.");
     return new Response(JSON.stringify({ message: "Already authenticated" }), { status: 200 });
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
  const { access_token, refresh_token } = data.session;

  // Set the HttpOnly cookies, mirroring the /api/auth/callback logic
  cookies.set("sb-access-token", access_token, {
    path: "/",
    maxAge: data.session.expires_in ? data.session.expires_in : 60 * 60, // Use expires_in, default 1 hour
    sameSite: "strict",
    secure: import.meta.env.PROD, // Use secure cookies in production
    httpOnly: true,
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // Example: 7 days validity for refresh token
    sameSite: "strict",
    secure: import.meta.env.PROD, // Use secure cookies in production
    httpOnly: true,
  });

  // Return a success response to the client
  return new Response(
    JSON.stringify({ message: "Anonymous sign-in successful", userId: data.user?.id }), // Optionally return user ID
    { status: 200 }
  );
};