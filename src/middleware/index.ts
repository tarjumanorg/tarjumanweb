// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import { setAuthCookies, deleteAuthCookies } from '../utils/auth';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../utils/constants';

// Consider moving these to constants.ts as well if used elsewhere
// Or import if they are defined there
const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin"]; // e.g., signin, register
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create"];

function matchesPath(pathname: string, pathsToCheck: string[]): boolean {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.includes(normalizedPathname);
}

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    // --- 1. Centralized Auth Check ---
    const accessToken = cookies.get(ACCESS_TOKEN_COOKIE);
    const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE);
    locals.userId = undefined; // Ensure locals.userId is reset per request

    if (accessToken) {
      console.log("Middleware: Access token found. Verifying...");
      const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken.value);

      if (user) {
        console.log(`Middleware: User ${user.id} verified successfully via access token.`);
        locals.userId = user.id;
        // Optional: Refresh session proactively if needed, but getUser is usually sufficient
      } else {
        console.log("Middleware: Access token invalid or expired.", getUserError?.message);
        if (refreshToken) {
          console.log("Middleware: Refresh token found. Attempting session refresh...");
          // Use setSession as it handles refresh internally when access token is provided (even if expired)
          const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
            access_token: accessToken.value,
            refresh_token: refreshToken.value,
          });

          if (refreshData?.session && refreshData?.user) {
            console.log(`Middleware: Session refreshed successfully for user ${refreshData.user.id}. Setting cookies.`);
            locals.userId = refreshData.user.id;
            setAuthCookies(cookies, refreshData.session); // Update cookies with new tokens/expiry
          } else {
            console.log("Middleware: Session refresh failed. Deleting auth cookies.", refreshError?.message);
            deleteAuthCookies(cookies);
            // locals.userId remains undefined
          }
        } else {
          console.log("Middleware: Invalid access token and no refresh token found. Deleting auth cookies.");
          deleteAuthCookies(cookies);
          // locals.userId remains undefined
        }
      }
    } else {
       console.log("Middleware: No access token found.");
       // If only refresh token exists, Supabase client handles refresh on next DB call attempt,
       // but we can't pre-validate user easily here without access token for getUser.
       // If access token is missing, treat as unauthenticated for initial checks.
       // If refresh token exists alone, delete it as it's likely stale without access token.
       if (refreshToken) {
           console.log("Middleware: Access token missing but refresh token exists. Deleting stale refresh token.");
           deleteAuthCookies(cookies); // deleteAuthCookies targets both
       }
    }

    // --- 2. Path-Based Logic (using locals.userId) ---
    const isProtectedRoute = matchesPath(url.pathname, protectedPaths);
    const isProtectedAPIRoute = matchesPath(url.pathname, protectedAPIPaths);
    const isRedirectRoute = matchesPath(url.pathname, redirectPaths);

    if (isProtectedRoute && !locals.userId) {
      console.log(`Middleware: Blocked access to protected route ${url.pathname}. Redirecting to signin.`);
      return redirect("/signin");
    }

    if (isProtectedAPIRoute && !locals.userId) {
       console.log(`Middleware: Blocked access to protected API route ${url.pathname}. Returning 401.`);
       return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (isRedirectRoute && locals.userId) {
        console.log(`Middleware: User already logged in (User ID: ${locals.userId}). Redirecting from ${url.pathname} to dashboard.`);
        return redirect("/dashboard");
    }

    // --- 3. Proceed if no action taken ---
    console.log(`Middleware: Allowing request to ${url.pathname}. Authenticated User ID: ${locals.userId ?? 'None'}`);
    return next();
  },
);