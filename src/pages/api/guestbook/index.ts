// src/pages/api/guestbook/index.ts
import type { APIRoute } from "astro";
import { getAllGuestbookEntries, createGuestbookEntry } from "../../../services/guestbook.service";
import type { GuestbookEntry } from "../../../types/types";
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse'; // <-- IMPORT ADDED

export const GET: APIRoute = async () => {
  console.log("API Route: GET /api/guestbook invoked.");
  try {
    const entries = await getAllGuestbookEntries();
    // Use utility function for success response
    return jsonResponse(200, entries); // <-- UPDATED
  } catch (error: any) {
    console.error("API Error (GET /api/guestbook):", error.message);
    // Use utility function for error response
    return jsonErrorResponse(500, "Failed to retrieve guestbook entries."); // <-- UPDATED
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  console.log("API Route: POST /api/guestbook invoked.");

  const userId = locals.userId;
  if (!userId) {
      console.error("API Error: No userId found in locals for protected route /api/guestbook");
      // Use utility function for error response
      return jsonErrorResponse(401, "Unauthorized: Missing user session."); // <-- UPDATED
  }
  console.log(`API Route: User authenticated via middleware. User ID: ${userId}. Ready to create guestbook entry.`);

  try {
    let name: string;
    let message: string;
    try {
        const body: Partial<GuestbookEntry> = await request.json();
        name = body.name?.toString().trim() ?? '';
        message = body.message?.toString().trim() ?? '';

        if (!name || !message) {
            console.log("API Error: Missing or empty name or message in request body.");
            // Use utility function for error response
            return jsonErrorResponse(400, "Bad Request: Name and message are required and cannot be empty."); // <-- UPDATED
        }
    } catch (e) {
        console.log("API Error: Invalid JSON body received.");
        // Use utility function for error response
        return jsonErrorResponse(400, "Bad Request: Invalid JSON body."); // <-- UPDATED
    }

    const newEntry = await createGuestbookEntry(name, message);

    console.log("API Route: Guestbook entry created successfully.");
    // Use utility function for success response
    return jsonResponse(201, newEntry); // <-- UPDATED

  } catch (error: any) {
    console.error("API Error (POST /api/guestbook):", error.message);

    // Use utility function for error responses based on service error messages
    if (error.message.startsWith("Validation Error:")) {
         return jsonErrorResponse(400, error.message); // <-- UPDATED
    }
    if (error.message.startsWith("Permission Denied:")) {
         return jsonErrorResponse(403, error.message); // <-- UPDATED
    }
     if (error.message.startsWith("Database Error:")) {
         return jsonErrorResponse(500, "Failed to submit guestbook entry due to a server error."); // <-- UPDATED (Generic message for DB error)
     }

    // Fallback for unexpected errors
    return jsonErrorResponse(500, "An unexpected error occurred while submitting the guestbook entry."); // <-- UPDATED
  }
};