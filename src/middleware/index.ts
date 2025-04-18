// src/middleware/index.ts
import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import { setAuthCookies, deleteAuthCookies } from '../utils/auth';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';
import { jsonErrorResponse } from "../utils/apiResponse"; // Import error response util

// Define path categories
const protectedPaths = ["/dashboard"];
const redirectPaths = ["/signin"]; // Paths users are redirected *from* if logged in
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create"];

// --- NEW: Admin paths ---
const adminPaths = ["/admin", "/admin/orders"]; // Add more admin page routes here
const adminAPIPaths = ["/api/admin/orders"]; // Add more admin API routes here

/**
 * Checks if the pathname (or its parent) matches any path in the provided list.
 * Handles base paths and specific subpaths.
 */
function matchesPathPrefix(pathname: string, pathsToCheck: string[]): boolean {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.some(prefix => normalizedPathname === prefix || normalizedPathname.startsWith(prefix + '/'));
}

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect, request }, next) => { // Added 'request'
    const pathname = url.pathname;
    console.log(`\n--- Middleware Start: ${pathname} ---`);

    // --- 1. Centralized Authentication Check ---
    const accessToken = cookies.get(ACCESS_TOKEN);
    const refreshToken = cookies.get(REFRESH_TOKEN);
    locals.userId = undefined;
    let isAdmin = false; // --- NEW: Track admin status ---

    if (accessToken?.value) {
      console.log("Middleware: Access token found. Verifying with Supabase...");
      // Fetch user data, hoping app_metadata is included
      const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken.value);

      if (user) {
        console.log(`Middleware: User ${user.id} verified via access token.`);
        locals.userId = user.id;
        // --- NEW: Check for admin status ---
        // IMPORTANT: Verify app_metadata exists. It might not be in the default getUser() response depending on JWT claims configuration.
        // If user.app_metadata is consistently undefined here, you'll need the service_role key approach.
        if (user.app_metadata && user.app_metadata.is_admin === true) {
            console.log(`Middleware: User ${user.id} IS an admin.`);
            isAdmin = true;
        } else {
            console.log(`Middleware: User ${user.id} is NOT an admin (app_metadata: ${JSON.stringify(user.app_metadata)})`);
        }
        // --- End NEW ---

      } else {
        console.log("Middleware: Access token invalid/expired.", getUserError?.message);
        if (refreshToken?.value) {
          console.log("Middleware: Refresh token found. Attempting session refresh...");
          const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
            access_token: accessToken.value,
            refresh_token: refreshToken.value,
          });

          if (refreshData?.session && refreshData?.user) {
            console.log(`Middleware: Session refreshed successfully for user ${refreshData.user.id}. Setting new cookies.`);
            locals.userId = refreshData.user.id;
            setAuthCookies(cookies, refreshData.session);
            // --- NEW: Re-check admin status after refresh ---
            if (refreshData.user.app_metadata && refreshData.user.app_metadata.is_admin === true) {
                console.log(`Middleware: Refreshed user ${refreshData.user.id} IS an admin.`);
                isAdmin = true;
            } else {
                console.log(`Middleware: Refreshed user ${refreshData.user.id} is NOT an admin.`);
            }
            // --- End NEW ---
          } else {
            console.log("Middleware: Session refresh failed. Deleting auth cookies.", refreshError?.message);
            deleteAuthCookies(cookies);
          }
        } else {
          console.log("Middleware: Invalid access token and no refresh token. Deleting auth cookies.");
          deleteAuthCookies(cookies);
        }
      }
    } else {
       console.log("Middleware: No access token found.");
       if (refreshToken?.value) {
           console.log("Middleware: Access token missing, but refresh token exists. Deleting likely stale refresh token.");
           deleteAuthCookies(cookies);
       }
    }

    // --- 2. Path-Based Authorization & Redirection Logic ---
    const isProtectedRoute = matchesPathPrefix(pathname, protectedPaths);
    const isProtectedAPIRoute = matchesPathPrefix(pathname, protectedAPIPaths);
    const isRedirectRoute = matchesPathPrefix(pathname, redirectPaths);
    // --- NEW: Check if it's an admin route ---
    const isAdminRoute = matchesPathPrefix(pathname, adminPaths);
    const isAdminAPIRoute = matchesPathPrefix(pathname, adminAPIPaths);
    // --- End NEW ---

    // --- NEW: Admin Route Protection ---
    if ((isAdminRoute || isAdminAPIRoute) && !isAdmin) {
        if (!locals.userId) {
            // Not logged in at all, trying to access admin area
            console.log(`Middleware: Unauthorized anonymous access attempt to admin route ${pathname}. Redirecting to /signin.`);
            if (isAdminAPIRoute) return jsonErrorResponse(401, "Unauthorized: Authentication required.");
            return redirect("/signin?message=Admin area requires login&redirect=" + encodeURIComponent(pathname));
        } else {
            // Logged in, but not an admin
            console.log(`Middleware: Forbidden access attempt by non-admin user ${locals.userId} to admin route ${pathname}.`);
             if (isAdminAPIRoute) return jsonErrorResponse(403, "Forbidden: Administrator privileges required.");
            // Optional: Redirect to dashboard or show a generic forbidden page
            // For simplicity, redirecting to dashboard might be less confusing than signin
             return redirect("/dashboard?message=Forbidden: Admin access required");
             // Or: return new Response("Forbidden: Admin access required", { status: 403 });
        }
    }
    // --- End NEW ---

    // Block access to protected pages if not logged in (and not an admin route handled above)
    if (isProtectedRoute && !isAdminRoute && !locals.userId) {
      console.log(`Middleware: Unauthorized access to protected page ${pathname}. Redirecting to /signin.`);
      return redirect("/signin?redirect=" + encodeURIComponent(pathname));
    }

    // Block access to protected API routes if not logged in (and not an admin API route handled above)
    if (isProtectedAPIRoute && !isAdminAPIRoute && !locals.userId) {
       console.log(`Middleware: Unauthorized access to protected API route ${pathname}. Returning 401.`);
       return jsonErrorResponse(401, "Unauthorized");
    }

    // Redirect logged-in users away from pages like /signin
    // Let admins visit /signin if they somehow land there (e.g., to sign in as a different user)
    if (isRedirectRoute && locals.userId && !isAdmin) {
        console.log(`Middleware: User ${locals.userId} is already logged in. Redirecting from ${pathname} to /dashboard.`);
        return redirect("/dashboard");
    }

    // --- 3. Proceed to the requested page/API endpoint ---
    console.log(`Middleware: Allowing request to ${pathname}. Auth User ID: ${locals.userId ?? 'None'}. Is Admin: ${isAdmin}`);
    console.log(`--- Middleware End: ${pathname} ---`);
    return next();
  },
);