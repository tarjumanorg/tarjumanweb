// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import { setAuthCookies, deleteAuthCookies } from '../utils/auth';

const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin"];
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create"];

function matchesPath(pathname: string, pathsToCheck: string[]): boolean {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.includes(normalizedPathname);
}

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {

    const isProtectedRoute = matchesPath(url.pathname, protectedPaths);

    if (isProtectedRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        console.log("Middleware: No tokens for protected route, redirecting to signin.");
        return redirect("/signin");
      }

      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error || !data.session) {
        console.log("Middleware: setSession failed for protected route, deleting cookies and redirecting.", error?.message);
        deleteAuthCookies(cookies);
        return redirect("/signin");
      }

      locals.email = data.user?.email!;

      console.log("Middleware: Session validated/refreshed for protected route, setting cookies.");
      setAuthCookies(cookies, data.session);
    }

    const isRedirectRoute = matchesPath(url.pathname, redirectPaths);

    if (isRedirectRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        const { data: { user } } = await supabase.auth.getUser(accessToken.value);
        if(user) {
          console.log("Middleware: User already logged in, redirecting from signin/register to dashboard.");
          return redirect("/dashboard");
        } else {
           console.log("Middleware: User has tokens but token is invalid, clearing cookies on redirect path.");
           deleteAuthCookies(cookies);
        }
      }
    }

    const isProtectedAPIRoute = matchesPath(url.pathname, protectedAPIPaths);

    if (isProtectedAPIRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken) {
         console.log("Middleware: No access token for protected API route");
         return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), { status: 401 });
      }

      const { data: { user }, error } = await supabase.auth.getUser(accessToken.value);

      if (error || !user) {
        console.log("Middleware: Invalid/Expired token for API route.", error?.message);

        if (refreshToken) {
           console.log("Middleware: Attempting token refresh for API route.");
           const { data: refreshData , error: refreshError } = await supabase.auth.setSession({
                refresh_token: refreshToken.value,
                access_token: accessToken.value,
           });

            if (refreshError || !refreshData.session) {
                console.log("Middleware: Session refresh failed for API route. Deleting cookies.");
                deleteAuthCookies(cookies);

                return new Response(JSON.stringify({ error: "Unauthorized: Session Refresh Failed" }), { status: 401 });
            }

             console.log("Middleware: Session refreshed successfully for API route. Setting cookies.");
             setAuthCookies(cookies, refreshData.session);

             return next();
        } else {

             console.log("Middleware: Invalid token for API route and no refresh token found. Deleting cookie.");
            deleteAuthCookies(cookies);
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid Token" }), { status: 401 });
        }
      }
      
      // If token is valid, proceed.
      console.log("Middleware: Valid token found for protected API route.");
      // We *could* store the user ID in locals here if needed by multiple API endpoints
      // locals.userId = user.id;
    }

    return next();
  },
);