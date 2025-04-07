// src/utils/auth.ts
import type { Session } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './constants'; // <-- IMPORT ADDED

/**
 * Sets the Supabase access and refresh token cookies with consistent security attributes.
 * @param cookies - The Astro cookies object from APIContext or MiddlewareAPIContext.
 * @param session - The Supabase session object containing tokens and expiration info.
 */
export function setAuthCookies(cookies: AstroCookies, session: Session | null | undefined): void {
  // Ensure we have a session and tokens before proceeding
  if (!session?.access_token || !session?.refresh_token) {
      console.warn("setAuthCookies called without a valid session or tokens. Skipping cookie setting.");
      return;
  }

  const { access_token, refresh_token, expires_in } = session;

  const baseCookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: import.meta.env.PROD,
    httpOnly: true,
  };

  const rawAccessTokenMaxAge = (expires_in != null && expires_in > 0) ? expires_in : 3600;
  const accessTokenMaxAge = Math.floor(rawAccessTokenMaxAge);

  const refreshTokenMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

  if (accessTokenMaxAge <= 0) {
      console.warn(`Calculated accessTokenMaxAge is invalid (${accessTokenMaxAge}). Using default 3600.`);
  }

  console.log(`Setting auth cookies. Access token maxAge: ${accessTokenMaxAge}s`);

  // Use constants for cookie names
  cookies.set(ACCESS_TOKEN_COOKIE, access_token, { // <-- UPDATED
    ...baseCookieOptions,
    maxAge: accessTokenMaxAge,
  });

  cookies.set(REFRESH_TOKEN_COOKIE, refresh_token, { // <-- UPDATED
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
    // Use constants for cookie names
    cookies.delete(ACCESS_TOKEN_COOKIE, { path: "/" }); // <-- UPDATED
    cookies.delete(REFRESH_TOKEN_COOKIE, { path: "/" }); // <-- UPDATED
}