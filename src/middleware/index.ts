// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
// No need to import micromatch anymore

// Define routes clearly
// For simple paths, direct string comparison after normalization is often easiest
const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin", "/register"];
const protectedAPIPaths = ["/api/guestbook"];

// Helper function to check paths, handling optional trailing slash
function matchesPath(pathname: string, pathsToCheck: string[]): boolean {
  // Normalize pathname by removing trailing slash (if present)
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.includes(normalizedPathname);
}

// --- OR using URLPattern (slightly more overhead for this simple case, but good for complex patterns) ---
/*
const protectedPatterns = [
  new URLPattern({ pathname: '/dashboard' }),
  new URLPattern({ pathname: '/dashboard/' }) // Handle trailing slash explicitly
];
const redirectPatterns = [
  new URLPattern({ pathname: '/signin' }),
  new URLPattern({ pathname: '/signin/' }),
  new URLPattern({ pathname: '/register' }),
  new URLPattern({ pathname: '/register/' })
];
const protectedAPIPatterns = [
    new URLPattern({ pathname: '/api/guestbook' }),
    new URLPattern({ pathname: '/api/guestbook/' })
];

function matchesPattern(url: URL, patterns: URLPattern[]): boolean {
    return patterns.some(pattern => pattern.test(url));
}
*/
// --- End of URLPattern example ---


export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {

    // Choose one method: matchesPath (simpler) or matchesPattern (URLPattern)
    const isProtectedRoute = matchesPath(url.pathname, protectedPaths);
    // const isProtectedRoute = matchesPattern(url, protectedPatterns); // URLPattern alternative

    if (isProtectedRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        return redirect("/signin");
      }

      // ... rest of your token validation logic ...
      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error) {
        // Clear potentially invalid cookies
        cookies.delete("sb-access-token", { path: "/" });
        cookies.delete("sb-refresh-token", { path: "/" });
        return redirect("/signin");
      }

      locals.email = data.user?.email!;
      cookies.set("sb-access-token", data?.session?.access_token!, {
        sameSite: "strict",
        path: "/",
        secure: true, // Keep secure: true for production
        httpOnly: true // Consider adding httpOnly for access token if not needed client-side
      });
      cookies.set("sb-refresh-token", data?.session?.refresh_token!, {
        sameSite: "strict",
        path: "/",
        secure: true, // Keep secure: true for production
        httpOnly: true, // Refresh token should usually be httpOnly
      });
    }

    const isRedirectRoute = matchesPath(url.pathname, redirectPaths);
    // const isRedirectRoute = matchesPattern(url, redirectPatterns); // URLPattern alternative

    if (isRedirectRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        // Maybe quickly verify tokens here before redirecting? Optional.
        return redirect("/dashboard");
      }
    }

    const isProtectedAPIRoute = matchesPath(url.pathname, protectedAPIPaths);
    // const isProtectedAPIRoute = matchesPattern(url, protectedAPIPatterns); // URLPattern alternative

    if (isProtectedAPIRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      const { error } = await supabase.auth.getUser(accessToken.value); // Use getUser for a quick check

      if (error) {
         // Attempt to refresh if getUser fails (could be expired token)
         if (refreshToken) {
            const { error: refreshError } = await supabase.auth.setSession({
                 refresh_token: refreshToken.value,
                 access_token: accessToken.value, // Provide both for potential session update
            });
             if (refreshError) {
                 // Clear invalid cookies if refresh fails
                 cookies.delete("sb-access-token", { path: "/" });
                 cookies.delete("sb-refresh-token", { path: "/" });
                 return new Response(JSON.stringify({ error: "Unauthorized - Session Refresh Failed" }), { status: 401 });
             }
             // If refresh succeeded, the tokens might have been updated by setSession.
             // Proceed carefully, maybe re-check or let the request handler proceed.
             // For simplicity here, we'll just proceed assuming setSession handles validity.
         } else {
            // No refresh token available
            return new Response(JSON.stringify({ error: "Unauthorized - Invalid Token" }), { status: 401 });
         }
      }
      // If getUser succeeded or refresh succeeded, proceed
    }

    // If none of the conditions matched or validation passed, continue to the next middleware or page
    return next();
  },
);