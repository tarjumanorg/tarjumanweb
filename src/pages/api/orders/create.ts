// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase"; // Keep for auth check ONLY
// Import the SERVICE function for database interaction
import { createOrder } from "../../../services/order.service";
import type { Order } from "../../../types/types"; // Import type if needed for request validation

// --- Turnstile Configuration ---
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;
// --- End Turnstile ---

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  console.log("API Route: POST /api/orders/create invoked.");

  // --- Environment Variable Check ---
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
    // Define expected body structure (optional but good practice)
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

      const verifyResponse = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
          method: 'POST',
          body: verifyPayload,
      });
      const verifyOutcome = await verifyResponse.json();
      console.log("API Route: Turnstile verification outcome:", verifyOutcome);

      if (!verifyOutcome.success) {
          console.warn("API Route: Turnstile verification failed.", verifyOutcome['error-codes']);
          return new Response(
              JSON.stringify({ error: "CAPTCHA verification failed.", codes: verifyOutcome['error-codes'] || [] }),
              { status: 403, headers: { 'Content-Type': 'application/json' } } // 403 Forbidden
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
      const accessToken = cookies.get("sb-access-token");
      if (!accessToken) {
          console.log("API Error: No access token found after CAPTCHA success.");
          // Middleware should ideally catch this, but double-check
          return new Response(JSON.stringify({ error: "Unauthorized: Authentication token missing." }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Use Supabase client *only* for auth check here
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken.value);

      if (userError || !user) {
          console.error("API Error: Invalid session token after CAPTCHA.", userError?.message);
          // Consider attempting refresh here or instruct client to re-auth? For now, fail.
          // Clean up potentially invalid cookies?
          // cookies.delete("sb-access-token", { path: "/" });
          // cookies.delete("sb-refresh-token", { path: "/" });
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
    // Pass necessary data (userId, ordererName) to the service
    const newOrder = await createOrder(userId, ordererName); // Service handles DB interaction

    // --- 5. Return Success Response ---
    console.log("API Route: Order created successfully:", newOrder.id);
    return new Response(JSON.stringify(newOrder), {
        status: 201, // Created
        headers: { 'Content-Type': 'application/json' }
     });

  } catch (error: any) {
    // --- 6. Handle Errors from Service ---
    console.error("API Error (POST /api/orders/create - Service Call):", error.message);

    // Map specific errors from the service to appropriate HTTP statuses
    if (error.message.startsWith("Validation Error:")) {
        return new Response( JSON.stringify({ error: `Bad Request: ${error.message}` }), {
             status: 400,
             headers: { 'Content-Type': 'application/json' }
        });
    }
    if (error.message.startsWith("Permission Denied:")) {
        return new Response( JSON.stringify({ error: error.message }), {
             status: 403, // Forbidden
             headers: { 'Content-Type': 'application/json' }
        });
    }
    if (error.message.startsWith("Database Error:")) {
         // Log the specific DB error but return a generic 500 to the client
         return new Response( JSON.stringify({ error: "Failed to create order due to a server database error." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
         });
    }

    // Generic fallback for unexpected errors during service call
    return new Response(
      JSON.stringify({ error: "An unexpected server error occurred while creating the order." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};