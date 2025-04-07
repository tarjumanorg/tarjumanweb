// src/utils/auth.ts
import type { Session } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/**
 * Sets the Supabase access and refresh token cookies with consistent security attributes.
 * @param cookies - The Astro cookies object from APIContext or MiddlewareAPIContext.
 * @param session - The Supabase session object containing tokens and expiration info.
 */
export function setAuthCookies(cookies: AstroCookies, session: Session | null | undefined): void {
  // Ensure we have a session and tokens before proceeding
  if (!session?.access_token || !session?.refresh_token) {
      console.warn("setAuthCookies called without a valid session or tokens. Skipping cookie setting.");
      // Optionally, clear existing cookies if session is null/undefined?
      // deleteAuthCookies(cookies); // Be cautious if calling this here
      return;
  }

  const { access_token, refresh_token, expires_in } = session;

  const baseCookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: import.meta.env.PROD,
    httpOnly: true,
  };

  // Calculate Access Token maxAge: Use expires_in (if valid > 0), default 1 hour.
  // MUST be an integer, so use Math.floor().
  const rawAccessTokenMaxAge = (expires_in != null && expires_in > 0) ? expires_in : 3600;
  const accessTokenMaxAge = Math.floor(rawAccessTokenMaxAge); // <-- THE FIX

  // Define Refresh Token maxAge: Typically longer, e.g., 7 days (already an integer)
  const refreshTokenMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

  // Add a check/log if the calculated maxAge seems wrong
  if (accessTokenMaxAge <= 0) {
      console.warn(`Calculated accessTokenMaxAge is invalid (${accessTokenMaxAge}). Using default 3600.`);
      // accessTokenMaxAge = 3600; // Re-assign default if needed, though floor(>0) should be >= 0
  }

  console.log(`Setting auth cookies. Access token maxAge: ${accessTokenMaxAge}s`);

  cookies.set("sb-access-token", access_token, {
    ...baseCookieOptions,
    maxAge: accessTokenMaxAge, // Pass the floored integer value
  });

  cookies.set("sb-refresh-token", refresh_token, {
    ...baseCookieOptions,
    maxAge: refreshTokenMaxAge,
  });
}

/**
 * Deletes the Supabase authentication cookies.
 * @param cookies - The Astro cookies object.
 */
export function deleteAuthCookies(cookies: AstroCookies): void {
    console.log("Deleting auth cookies.");
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });
}