// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { createOrder } from "../../../services/order.service";
import { TURNSTILE_VERIFY_ENDPOINT } from '../../../utils/constants';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse'; // <-- IMPORT ADDED

const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  console.log("API Route: POST /api/orders/create invoked.");

  const userId = locals.userId;
  if (!userId) {
      console.error("API Error: No userId found in locals for protected route /api/orders/create");
      // Use utility function for error response
      return jsonErrorResponse(401, "Unauthorized: Missing user session."); // <-- UPDATED
  }
  console.log(`API Route: User authenticated via middleware. User ID: ${userId}`);

  if (!TURNSTILE_SECRET_KEY) {
      console.error("API Error: TURNSTILE_SECRET_KEY is not set.");
      // Use utility function for error response
      return jsonErrorResponse(500, "Server configuration error: CAPTCHA secret missing."); // <-- UPDATED
  }

  let ordererName: string | undefined;
  let turnstileToken: string | undefined;
  try {
    interface OrderRequestBody {
        orderer_name?: string;
        turnstileToken?: string;
    }
    const body: OrderRequestBody = await request.json();
    ordererName = body.orderer_name?.toString().trim();
    turnstileToken = body.turnstileToken?.toString();

    if (!ordererName) {
        console.log("API Error: Missing or empty orderer_name in request body.");
        // Use utility function for error response
        return jsonErrorResponse(400, "Bad Request: Orderer name is required."); // <-- UPDATED
    }
    if (!turnstileToken) {
        console.log("API Error: Missing turnstileToken in request body.");
        // Use utility function for error response
        return jsonErrorResponse(400, "Bad Request: CAPTCHA token is missing."); // <-- UPDATED
    }
  } catch (error) {
    console.log("API Error: Invalid JSON body received.");
    // Use utility function for error response
    return jsonErrorResponse(400, "Bad Request: Invalid JSON body."); // <-- UPDATED
  }

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
          // Use utility function for error response
          return jsonErrorResponse(403, `CAPTCHA verification failed. Codes: ${ (verifyOutcome['error-codes'] || []).join(', ') }`); // <-- UPDATED
      }
      console.log("API Route: Turnstile verification successful for hostname:", verifyOutcome.hostname);

  } catch (error: any) {
      console.error("API Error: Exception during Turnstile verification:", error);
      // Use utility function for error response
      return jsonErrorResponse(500, "Server error during CAPTCHA verification."); // <-- UPDATED
  }

  try {
    console.log(`API Route: Calling createOrder service for user ${userId} with name ${ordererName}`);
    const newOrder = await createOrder(userId, ordererName);

    console.log("API Route: Order created successfully:", newOrder.id);
    // Use utility function for success response
    return jsonResponse(201, newOrder); // <-- UPDATED

  } catch (error: any) {
    console.error("API Error (POST /api/orders/create - Service Call):", error.message);

    // Use utility function for error responses based on service error messages
    if (error.message.startsWith("Validation Error:")) {
        return jsonErrorResponse(400, error.message); // <-- UPDATED
    }
    if (error.message.startsWith("Permission Denied:")) {
        return jsonErrorResponse(403, error.message); // <-- UPDATED
    }
    if (error.message.startsWith("Database Error:")) {
         return jsonErrorResponse(500, "Failed to create order due to a server database error."); // <-- UPDATED (Generic message for DB error)
    }

    // Generic fallback for unexpected errors
    return jsonErrorResponse(500, "An unexpected server error occurred while creating the order."); // <-- UPDATED
  }
};