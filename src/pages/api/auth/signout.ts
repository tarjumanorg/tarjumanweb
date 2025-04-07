import type { APIRoute } from "astro";
import { deleteAuthCookies } from '../../../utils/auth'; // <-- IMPORT ADDED

export const GET: APIRoute = async ({ cookies, redirect }) => {
  // Use the utility function to delete cookies
  deleteAuthCookies(cookies); // <-- REPLACED manual deletes

  return redirect("/signin");
};