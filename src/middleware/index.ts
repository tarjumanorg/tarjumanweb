// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";

// Define routes clearly
const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin", "/register"]; // Assuming you might add /register later
// Add the new API route for creating orders
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create"]; // <-- ADDED HERE

// Helper function to check paths, handling optional trailing slash
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
        return redirect("/signin");
      }

      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error) {
        cookies.delete("sb-access-token", { path: "/" });
        cookies.delete("sb-refresh-token", { path: "/" });
        return redirect("/signin");
      }

      // Store email in locals for dashboard page
      locals.email = data.user?.email!;

      // Refresh cookies with potentially new tokens and ensure flags are set
      cookies.set("sb-access-token", data?.session?.access_token!, {
        sameSite: "strict",
        path: "/",
        secure: import.meta.env.PROD, // Use secure cookies in production
        httpOnly: true
      });
      cookies.set("sb-refresh-token", data?.session?.refresh_token!, {
        sameSite: "strict",
        path: "/",
        secure: import.meta.env.PROD, // Use secure cookies in production
        httpOnly: true,
      });
    }

    const isRedirectRoute = matchesPath(url.pathname, redirectPaths);

    if (isRedirectRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        // Optional: Quick validation before redirecting?
        // For simplicity, just redirect if tokens exist.
        // A robust check might involve supabase.auth.getUser(accessToken.value)
        return redirect("/dashboard");
      }
    }

    const isProtectedAPIRoute = matchesPath(url.pathname, protectedAPIPaths);

    if (isProtectedAPIRoute) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token"); // Keep refresh token check for robustness

      if (!accessToken) { // Primarily check access token for API calls
         console.log("Middleware: No access token for protected API route");
         return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), { status: 401 });
      }

      // Validate the access token
      const { data: { user }, error } = await supabase.auth.getUser(accessToken.value);

      if (error || !user) {
        console.log("Middleware: Invalid/Expired token for API route.", error?.message);
        // Attempt refresh only if refresh token exists (though less common for API calls)
        if (refreshToken) {
           const { data: refreshData , error: refreshError } = await supabase.auth.setSession({
                refresh_token: refreshToken.value,
                access_token: accessToken.value, // Include access token for potential validation
           });

            if (refreshError || !refreshData.session) {
                console.log("Middleware: Session refresh failed for API route.");
                cookies.delete("sb-access-token", { path: "/" });
                cookies.delete("sb-refresh-token", { path: "/" });
                return new Response(JSON.stringify({ error: "Unauthorized: Session Refresh Failed" }), { status: 401 });
            }

             // If refresh worked, set new cookies (important!) and proceed
             console.log("Middleware: Session refreshed successfully for API route.");
             cookies.set("sb-access-token", refreshData.session.access_token, {
               sameSite: "strict", path: "/", secure: import.meta.env.PROD, httpOnly: true
             });
             cookies.set("sb-refresh-token", refreshData.session.refresh_token, {
               sameSite: "strict", path: "/", secure: import.meta.env.PROD, httpOnly: true
             });
             // We *could* store the user ID in locals here if needed by multiple API endpoints
             // locals.userId = refreshData.user.id;
             return next(); // Proceed with the refreshed session
        } else {
            // No refresh token, definitely unauthorized
            cookies.delete("sb-access-token", { path: "/" }); // Clean up invalid token
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid Token" }), { status: 401 });
        }
      }
      // If token is valid, proceed.
      // We *could* store the user ID in locals here if needed by multiple API endpoints
      // locals.userId = user.id;
    }

    // If none of the above conditions were met, proceed to the route handler
    return next();
  },
);