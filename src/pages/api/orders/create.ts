// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

// --- Turnstile Siteverify Endpoint ---
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;
// --- End Turnstile ---


export const POST: APIRoute = async ({ request, cookies, clientAddress }) => { // Added clientAddress

  if (!TURNSTILE_SECRET_KEY) {
      console.error("API /api/orders/create: TURNSTILE_SECRET_KEY is not set in environment variables.");
      return new Response(
          JSON.stringify({ error: "Server configuration error: Missing CAPTCHA secret." }),
          { status: 500 }
      );
  }

  // 1. Get submitted data (including Turnstile token)
  let ordererName: string | undefined;
  let turnstileToken: string | undefined;
  try {
    const data = await request.json();
    ordererName = data.orderer_name?.toString().trim();
    turnstileToken = data.turnstileToken?.toString(); // Get the token from payload

    if (!ordererName) {
      return new Response(
        JSON.stringify({ error: "Orderer name is required." }),
        { status: 400 }
      );
    }
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ error: "CAPTCHA token is missing." }),
        { status: 400 }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body. Expected JSON." }),
      { status: 400 }
    );
  }

  // --- 2. Verify Turnstile Token ---
  try {
      const verifyPayload = new URLSearchParams(); // Use URLSearchParams for form-encoded data
      verifyPayload.append('secret', TURNSTILE_SECRET_KEY);
      verifyPayload.append('response', turnstileToken);
      // Optionally add remoteip - Recommended for extra security
      // Astro's clientAddress gives the direct connecting IP, which might be Netlify's proxy.
      // If using Netlify, check request headers like 'x-nf-client-connection-ip'
      const forwardedIp = request.headers.get('x-nf-client-connection-ip');
      const remoteIp = forwardedIp || clientAddress; // Use forwarded IP if available, else direct clientAddress
      if (remoteIp) {
          verifyPayload.append('remoteip', remoteIp);
          console.log("Verifying Turnstile with remoteip:", remoteIp);
      } else {
          console.log("Verifying Turnstile without remoteip.");
      }


      const verifyResponse = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
          method: 'POST',
          body: verifyPayload, // Send as form data
          headers: {
              // 'Content-Type': 'application/x-www-form-urlencoded' // fetch sets this automatically for URLSearchParams
          }
      });

      const verifyOutcome = await verifyResponse.json();

      console.log("Turnstile verification outcome:", verifyOutcome);

      if (!verifyOutcome.success) {
          console.warn("API /api/orders/create: Turnstile verification failed.", verifyOutcome['error-codes']);
          return new Response(
              JSON.stringify({
                  error: "CAPTCHA verification failed.",
                  codes: verifyOutcome['error-codes'] || []
              }),
              { status: 403 } // 403 Forbidden is appropriate for failed CAPTCHA
          );
      }
      // Turnstile validation passed! Proceed...
      console.log("Turnstile verification successful for hostname:", verifyOutcome.hostname);

  } catch (error: any) {
      console.error("API /api/orders/create: Error during Turnstile verification", error);
      return new Response(
          JSON.stringify({ error: "Failed to verify CAPTCHA." }),
          { status: 500 }
      );
  }
  // --- End Turnstile Verification ---


  // 3. Verify authentication and get user ID (Middleware should have run)
  const accessToken = cookies.get("sb-access-token");

  if (!accessToken) {
    // This check might be redundant if the anonymous auth endpoint always runs first,
    // but good for robustness if someone calls the API directly without going through the page flow.
    return new Response(JSON.stringify({ error: "Unauthorized: Missing token after CAPTCHA" }), { status: 401 });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken.value);

  if (userError || !user) {
    console.error("API /api/orders/create: Error getting user after CAPTCHA", userError);
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid session after CAPTCHA" }), { status: 401 });
  }

  const userId = user.id;

  // 4. Insert into Database
  try {
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        orderer_name: ordererName,
        status: "pending",
        // other fields...
      })
      .select()
      .single();

    if (insertError) {
      console.error("API /api/orders/create: Supabase insert error", insertError);
      if (insertError.code === '42501') {
         return new Response(
            JSON.stringify({ error: "Database permission denied. Check RLS policies." }),
            { status: 403 }
         );
      }
      return new Response(
        JSON.stringify({ error: "Database error: " + insertError.message }),
        { status: 500 }
      );
    }

    // 5. Return Success Response
    return new Response(JSON.stringify(newOrder), { status: 201 });

  } catch (error: any) {
    console.error("API /api/orders/create: Unexpected error during DB insert", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500 }
    );
  }
};