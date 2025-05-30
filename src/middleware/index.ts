import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import { setAuthCookies, deleteAuthCookies } from '../utils/auth';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';
import { jsonErrorResponse } from "../utils/apiResponse"; 

const protectedPaths = ["/dashboard", "/dashboard/my-orders"];
const redirectPaths = ["/signin"]; 
const protectedAPIPaths = ["/api/guestbook", "/api/orders/create", "/api/orders"];

const adminPaths = ["/admin", "/admin/orders"]; 
const adminAPIPaths = ["/api/admin/orders"]; 

function matchesPathPrefix(pathname: string, pathsToCheck: string[]): boolean {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return pathsToCheck.some(prefix => normalizedPathname === prefix || normalizedPathname.startsWith(prefix + '/'));
}

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect, request }, next) => { 
    const pathname = url.pathname;
    console.log(`\n--- Middleware Start: ${pathname} ---`);

    const accessToken = cookies.get(ACCESS_TOKEN);
    const refreshToken = cookies.get(REFRESH_TOKEN);
    locals.userId = undefined;
    let isAdmin = false; 

    if (accessToken?.value) {
      console.log("Middleware: Access token found. Verifying with Supabase...");

      const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken.value);

      if (user) {
        console.log(`Middleware: User ${user.id} verified via access token.`);
        locals.userId = user.id;
        // Add anonymous flag for downstream logic

        locals.isAnonymous = user.is_anonymous === true;
        if (user.app_metadata && user.app_metadata.is_admin === true) {
            console.log(`Middleware: User ${user.id} IS an admin.`);
            isAdmin = true;
        } else {
            console.log(`Middleware: User ${user.id} is NOT an admin (app_metadata: ${JSON.stringify(user.app_metadata)})`);
        }

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

            if (refreshData.user.app_metadata && refreshData.user.app_metadata.is_admin === true) {
                console.log(`Middleware: Refreshed user ${refreshData.user.id} IS an admin.`);
                isAdmin = true;
            } else {
                console.log(`Middleware: Refreshed user ${refreshData.user.id} is NOT an admin.`);
            }

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

    const isProtectedRoute = matchesPathPrefix(pathname, protectedPaths);
    const isProtectedAPIRoute = matchesPathPrefix(pathname, protectedAPIPaths);
    const isRedirectRoute = matchesPathPrefix(pathname, redirectPaths);

    const isAdminRoute = matchesPathPrefix(pathname, adminPaths);
    const isAdminAPIRoute = matchesPathPrefix(pathname, adminAPIPaths);

    if ((isAdminRoute || isAdminAPIRoute) && !isAdmin) {
        if (!locals.userId) {

            console.log(`Middleware: Unauthorized anonymous access attempt to admin route ${pathname}. Redirecting to /signin.`);
            if (isAdminAPIRoute) return jsonErrorResponse(401, "Unauthorized: Authentication required.");
            return redirect("/signin?message=Admin area requires login&redirect=" + encodeURIComponent(pathname));
        } else {

            console.log(`Middleware: Forbidden access attempt by non-admin user ${locals.userId} to admin route ${pathname}.`);
             if (isAdminAPIRoute) return jsonErrorResponse(403, "Forbidden: Administrator privileges required.");

             return redirect("/dashboard?message=Forbidden: Admin access required");

        }
    }

    if (isProtectedRoute && !isAdminRoute && !locals.userId) {
      console.log(`Middleware: Unauthorized access to protected page ${pathname}. Redirecting to /signin.`);
      return redirect("/signin?redirect=" + encodeURIComponent(pathname));
    }

    if (isProtectedAPIRoute && !isAdminAPIRoute && !locals.userId) {
       console.log(`Middleware: Unauthorized access to protected API route ${pathname}. Returning 401.`);
       return jsonErrorResponse(401, "Unauthorized");
    }

    if (isRedirectRoute && locals.userId && !isAdmin) {
        console.log(`Middleware: User ${locals.userId} is already logged in. Redirecting from ${pathname} to /dashboard.`);
        return redirect("/dashboard");
    }

    console.log(`Middleware: Allowing request to ${pathname}. Auth User ID: ${locals.userId ?? 'None'}. Is Admin: ${isAdmin}`);
    console.log(`--- Middleware End: ${pathname} ---`);
    return next();
  },
);