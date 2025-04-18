import type { APIRoute } from "astro";
import { deleteAuthCookies } from '../../../utils/auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {

  deleteAuthCookies(cookies);

  return redirect("/signin");
};