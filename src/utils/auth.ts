import type { Session } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { ACCESS_TOKEN, REFRESH_TOKEN } from './constants';

export function setAuthCookies(cookies: AstroCookies, session: Session | null | undefined): void {

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

  const refreshTokenMaxAge = 60 * 60 * 24 * 7;

  if (accessTokenMaxAge <= 0) {
    console.warn(`Calculated accessTokenMaxAge is invalid (${accessTokenMaxAge}). Using default 3600.`);
  }

  console.log(`Setting auth cookies. Access token maxAge: ${accessTokenMaxAge}s`);

  cookies.set(ACCESS_TOKEN, access_token, {
    ...baseCookieOptions,
    maxAge: accessTokenMaxAge,
  });

  cookies.set(REFRESH_TOKEN, refresh_token, {
    ...baseCookieOptions,
    maxAge: refreshTokenMaxAge,
  });
}

export function deleteAuthCookies(cookies: AstroCookies): void {
  console.log("Deleting auth cookies.");

  cookies.delete(ACCESS_TOKEN, { path: "/" });
  cookies.delete(REFRESH_TOKEN, { path: "/" });
}