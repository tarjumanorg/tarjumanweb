// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { createOrder } from "../../../services/order.service";
import type { Order } from "../../../types/types";
import { ACCESS_TOKEN_COOKIE, TURNSTILE_VERIFY_ENDPOINT } from '../../../utils/constants'; // <-- IMPORTS UPDATED

// --- Turnstile Configuration ---
// const TURNSTILE_VERIFY_ENDPOINT = '...'; // Defined in constants now
const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;
// --- End Turnstile ---

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  console.log("API Route: POST /api/orders/create invoked.");

  if (!TURNSTILE_SECRET_KEY) {
      console.error("API Error: TURNSTILE_SECRET_KEY is not set.");
      return new Response(
          JSON.stringify({ error: "Server configuration error: CAPTCHA secret missing." }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
  }

  // --- 1. Parse Request Body ---
  let ordererName: string | undefined;
  let turnstileToken: string | undefined;
  try {
    interface OrderRequestBody {
        orderer_name?: string;
        turnstileToken?: string;
    }
    const body: OrderRequestBody = await request.json();
    ordererName = body.orderer_name?.toString();
    turnstileToken = body.turnstileToken?.toString();

    if (!ordererName) {
        console.log("API Error: Missing orderer_name in request body.");
        return new Response(JSON.stringify({ error: "Bad Request: Orderer name is required." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!turnstileToken) {
        console.log("API Error: Missing turnstileToken in request body.");
        return new Response(JSON.stringify({ error: "Bad Request: CAPTCHA token is missing." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.log("API Error: Invalid JSON body received.");
    return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // --- 2. Verify Turnstile Token ---
  try {
      console.log("API Route: Verifying Turnstile token...");
      const verifyPayload = new URLSearchParams();
      verifyPayload.append('secret', TURNSTILE_SECRET_KEY);
      verifyPayload.append('response', turnstileToken);

      const forwardedIp = request.headers.get('x-nf-client-connection-ip');
      const remoteIp = forwardedIp || clientAddress;
      if (remoteIp) {
          verifyPayload.append('remoteip', remoteIp);
          console.log("API Route: Verifying Turnstile with remoteip:", remoteIp);
      } else {
          console.warn("API Route: Verifying Turnstile without remoteip.");
      }

      // Use constant for endpoint
      const verifyResponse = await fetch(TURNSTILE_VERIFY_ENDPOINT, { // <-- UPDATED
          method: 'POST',
          body: verifyPayload,
      });
      const verifyOutcome = await verifyResponse.json();
      console.log("API Route: Turnstile verification outcome:", verifyOutcome);

      if (!verifyOutcome.success) {
          console.warn("API Route: Turnstile verification failed.", verifyOutcome['error-codes']);
          return new Response(
              JSON.stringify({ error: "CAPTCHA verification failed.", codes: verifyOutcome['error-codes'] || [] }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
      }
      console.log("API Route: Turnstile verification successful for hostname:", verifyOutcome.hostname);

  } catch (error: any) {
      console.error("API Error: Exception during Turnstile verification:", error);
      return new Response(
          JSON.stringify({ error: "Server error during CAPTCHA verification." }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
  }

  // --- 3. Verify Authentication (Get User ID) ---
  let userId: string;
  try {
      console.log("API Route: Verifying user authentication...");
      // Use constant for cookie name
      const accessToken = cookies.get(ACCESS_TOKEN_COOKIE); // <-- UPDATED
      if (!accessToken) {
          console.log("API Error: No access token found after CAPTCHA success.");
          return new Response(JSON.stringify({ error: "Unauthorized: Authentication token missing." }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken.value);

      if (userError || !user) {
          console.error("API Error: Invalid session token after CAPTCHA.", userError?.message);
          // Note: Middleware should handle refresh if possible. If it reaches here with invalid token and no refresh,
          // deleting cookies might be appropriate, although the middleware already does this on failure.
          // deleteAuthCookies(cookies); // Consider if needed here, likely redundant with middleware
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired session." }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      userId = user.id;
      console.log("API Route: User authenticated successfully:", userId);

  } catch (error: any) {
       console.error("API Error: Exception during authentication check:", error);
       return new Response( JSON.stringify({ error: "Server error during authentication check." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }


  // --- 4. Call the Order Service ---
  try {
    console.log(`API Route: Calling createOrder service for user ${userId}`);
    const newOrder = await createOrder(userId, ordererName);

    // --- 5. Return Success Response ---
    console.log("API Route: Order created successfully:", newOrder.id);
    return new Response(JSON.stringify(newOrder), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
     });

  } catch (error: any) {
    // --- 6. Handle Errors from Service ---
    console.error("API Error (POST /api/orders/create - Service Call):", error.message);

    if (error.message.startsWith("Validation Error:")) {
        return new Response( JSON.stringify({ error: `Bad Request: ${error.message}` }), {
             status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (error.message.startsWith("Permission Denied:")) {
        return new Response( JSON.stringify({ error: error.message }), {
             status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (error.message.startsWith("Database Error:")) {
         return new Response( JSON.stringify({ error: "Failed to create order due to a server database error." }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
         });
    }

    // Generic fallback
    return new Response(
      JSON.stringify({ error: "An unexpected server error occurred while creating the order." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};