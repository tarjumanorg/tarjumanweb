// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { createOrder } from "../../../services/order.service";
import { verifyTurnstileToken } from '../../../utils/turnstile'; // <-- IMPORT the new utility
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';

// TURNSTILE_SECRET_KEY is no longer needed here

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  console.log("API Route: POST /api/orders/create invoked.");

  // --- Authentication Check (remains the same) ---
  const userId = locals.userId!; // Asserting non-null based on middleware guarantee
  console.log(`API Route: User authenticated via middleware. User ID: ${userId}`);
  // ---

  // --- Request Body Parsing & Validation (remains the same) ---
  let ordererName: string | undefined;
  let turnstileToken: string | undefined;
  try {
    interface OrderRequestBody {
        orderer_name?: string;
        turnstileToken?: string; // Field name from client-side payload
    }
    const body: OrderRequestBody = await request.json();
    ordererName = body.orderer_name?.toString().trim();
    turnstileToken = body.turnstileToken?.toString(); // Extract token

    if (!ordererName) {
        console.log("API Error: Missing or empty orderer_name in request body.");
        return jsonErrorResponse(400, "Bad Request: Orderer name is required.");
    }
    if (!turnstileToken) {
        console.log("API Error: Missing turnstileToken in request body.");
        return jsonErrorResponse(400, "Bad Request: CAPTCHA token is missing.");
    }
  } catch (error) {
    console.log("API Error: Invalid JSON body received.");
    return jsonErrorResponse(400, "Bad Request: Invalid JSON body.");
  }
  // ---

  // --- Turnstile Verification (using the new utility) ---
  try {
    console.log("API Route: Calling Turnstile verification utility...");
    // Get client IP (handle potential proxy headers like Netlify's)
    const forwardedIp = request.headers.get('x-nf-client-connection-ip');
    const remoteIp = forwardedIp || clientAddress;

    // Call the abstracted verification function
    await verifyTurnstileToken(turnstileToken, remoteIp);

    console.log("API Route: Turnstile verification successful.");

  } catch (error: any) {
    console.warn("API Route: Turnstile verification failed.", error.message);
    // Check for specific configuration error
    if (error.message.startsWith("Server configuration error")) {
        return jsonErrorResponse(500, error.message);
    }
    // Treat other errors as client-side verification failures (403 Forbidden)
    return jsonErrorResponse(403, `CAPTCHA verification failed: ${error.message}`);
  }
  // ---

  // --- Order Creation (remains the same) ---
  try {
    console.log(`API Route: Calling createOrder service for user ${userId} with name ${ordererName}`);
    const newOrder = await createOrder(userId, ordererName);
    console.log("API Route: Order created successfully:", newOrder.id);
    return jsonResponse(201, newOrder);

  } catch (error: any) {
    console.error("API Error (POST /api/orders/create - Service Call):", error.message);
    // Specific error handling based on service errors (remains the same)
    if (error.message.startsWith("Validation Error:")) {
        return jsonErrorResponse(400, error.message);
    }
    // ... other specific service error checks ...
    if (error.message.startsWith("Database Error:")) {
         return jsonErrorResponse(500, "Failed to create order due to a server database error.");
    }
    return jsonErrorResponse(500, "An unexpected server error occurred while creating the order.");
  }
};