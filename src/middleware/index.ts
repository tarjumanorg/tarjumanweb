// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import { setAuthCookies, deleteAuthCookies } from '../utils/auth';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';

// Define path categories
const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin"]; // Paths users are redirected *from* if logged in
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create"];

/**
 * Normalizes pathnames (removes trailing slash unless it's the root)
 * and checks if the pathname matches any path in the provided list.
 */
function matchesPath(pathname: string, pathsToCheck: string[]): boolean {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.includes(normalizedPathname);
}

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    console.log(`\n--- Middleware Start: ${url.pathname} ---`);

    // --- 1. Centralized Authentication Check ---
    const accessToken = cookies.get(ACCESS_TOKEN);
    const refreshToken = cookies.get(REFRESH_TOKEN);
    locals.userId = undefined;

    // Scenario 1: Access Token exists - Primary verification path
    if (accessToken) {
      console.log("Middleware: Access token found. Verifying with Supabase...");
      const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken.value);

      if (user) {
        console.log(`Middleware: User ${user.id} verified via access token.`);
        locals.userId = user.id;
        // Note: Supabase client might handle proactive refresh internally,
        // but `getUser` confirms current validity.
      } else {
        console.log("Middleware: Access token invalid/expired.", getUserError?.message);
        // Scenario 1a: Refresh Token also exists - Attempt session refresh
        if (refreshToken) {
          console.log("Middleware: Refresh token found. Attempting session refresh...");
          // Use `setSession` with *both* tokens. Supabase uses the refresh token
          // to get new tokens if the access token is expired.
          const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
            access_token: accessToken.value,
            refresh_token: refreshToken.value,
          });

          if (refreshData?.session && refreshData?.user) {
            console.log(`Middleware: Session refreshed successfully for user ${refreshData.user.id}. Setting new cookies.`);
            locals.userId = refreshData.user.id;
            setAuthCookies(cookies, refreshData.session);
          } else {
            console.log("Middleware: Session refresh failed. Deleting auth cookies.", refreshError?.message);
            deleteAuthCookies(cookies);
          }
        } else {
          // Scenario 1b: No Refresh Token - Cannot refresh, clear invalid access token.
          console.log("Middleware: Invalid access token and no refresh token. Deleting auth cookies.");
          deleteAuthCookies(cookies);
        }
      }
    }
    // Scenario 2: No Access Token
    else {
       console.log("Middleware: No access token found.");
       // Scenario 2a: Refresh Token exists *without* Access Token
       // This is an unusual state, potentially meaning the access token expired
       // and was deleted, or cookies are somehow mismatched. The refresh token
       // alone isn't enough to verify the user *here* without an initial getUser attempt.
       // Treat as unauthenticated and clear the potentially stale refresh token.
       if (refreshToken) {
           console.log("Middleware: Access token missing, but refresh token exists. Deleting likely stale refresh token.");
           deleteAuthCookies(cookies);
       }
       // Scenario 2b: Neither token exists - User is unauthenticated.
    }

    // --- 2. Path-Based Authorization & Redirection Logic ---
    const isProtectedRoute = matchesPath(url.pathname, protectedPaths);
    const isProtectedAPIRoute = matchesPath(url.pathname, protectedAPIPaths);
    const isRedirectRoute = matchesPath(url.pathname, redirectPaths);

    // Block access to protected pages if not logged in
    if (isProtectedRoute && !locals.userId) {
      console.log(`Middleware: Unauthorized access to protected page ${url.pathname}. Redirecting to /signin.`);
      return redirect("/signin");
    }

    // Block access to protected API routes if not logged in
    if (isProtectedAPIRoute && !locals.userId) {
       console.log(`Middleware: Unauthorized access to protected API route ${url.pathname}. Returning 401.`);
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' }
        });
    }

    // Redirect logged-in users away from pages like /signin
    if (isRedirectRoute && locals.userId) {
        console.log(`Middleware: User ${locals.userId} is already logged in. Redirecting from ${url.pathname} to /dashboard.`);
        return redirect("/dashboard");
    }

    // --- 3. Proceed to the requested page/API endpoint ---
    console.log(`Middleware: Allowing request to ${url.pathname}. Authenticated User ID: ${locals.userId ?? 'None'}`);
    console.log(`--- Middleware End: ${url.pathname} ---`);
    return next();
  },
);