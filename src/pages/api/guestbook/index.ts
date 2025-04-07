// src/pages/api/guestbook/index.ts
import type { APIRoute } from "astro";
import { getAllGuestbookEntries, createGuestbookEntry } from "../../../services/guestbook.service";
import type { GuestbookEntry } from "../../../types/types";
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';

// GET handler remains unchanged
export const GET: APIRoute = async () => {
  console.log("API Route: GET /api/guestbook invoked.");
  try {
    const entries = await getAllGuestbookEntries();
    return jsonResponse(200, entries);
  } catch (error: any) {
    console.error("API Error (GET /api/guestbook):", error.message);
    return jsonErrorResponse(500, "Failed to retrieve guestbook entries.");
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  console.log("API Route: POST /api/guestbook invoked.");

  // --- OPTIMIZATION ---
  // The middleware already ensures that locals.userId is present for this route.
  // We can safely use the non-null assertion operator (!).
  // The redundant check 'if (!userId) { ... }' has been removed.
  const userId = locals.userId!;
  console.log(`API Route: User authenticated via middleware. User ID: ${userId}. Ready to create guestbook entry.`);
  // --- END OPTIMIZATION ---

  try {
    let name: string;
    let message: string;
    try {
        const body: Partial<GuestbookEntry> = await request.json();
        name = body.name?.toString().trim() ?? '';
        message = body.message?.toString().trim() ?? '';

        if (!name || !message) {
            console.log("API Error: Missing or empty name or message in request body.");
            return jsonErrorResponse(400, "Bad Request: Name and message are required and cannot be empty.");
        }
    } catch (e) {
        console.log("API Error: Invalid JSON body received.");
        return jsonErrorResponse(400, "Bad Request: Invalid JSON body.");
    }

    // Note: userId isn't directly used by createGuestbookEntry in this example,
    // but it confirms the user is authenticated as required by the middleware.
    const newEntry = await createGuestbookEntry(name, message);

    console.log("API Route: Guestbook entry created successfully.");
    return jsonResponse(201, newEntry);

  } catch (error: any) {
    console.error("API Error (POST /api/guestbook):", error.message);

    // Error handling remains the same
    if (error.message.startsWith("Validation Error:")) {
         return jsonErrorResponse(400, error.message);
    }
    if (error.message.startsWith("Permission Denied:")) {
         return jsonErrorResponse(403, error.message);
    }
     if (error.message.startsWith("Database Error:")) {
         return jsonErrorResponse(500, "Failed to submit guestbook entry due to a server error.");
     }
    return jsonErrorResponse(500, "An unexpected error occurred while submitting the guestbook entry.");
  }
};