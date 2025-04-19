// src/pages/api/guestbook/index.ts
import type { APIRoute } from "astro";
import { getAllGuestbookEntries, createGuestbookEntry } from "../../../services/guestbook.service";
import type { GuestbookEntry } from '../../../schemas/guestbook.schema';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';
import { GuestbookEntrySchema } from '../../../schemas/guestbook.schema';

export const GET: APIRoute = async () => {
  console.log("API Route: GET /api/guestbook invoked.");
  try {
    const entries = await getAllGuestbookEntries();
    // Validate response data (optional but recommended)
    const parseResult = GuestbookEntrySchema.array().safeParse(entries);
    if (!parseResult.success) {
      console.error('Guestbook GET response validation failed:', parseResult.error.flatten());
      // Optionally still return the data, or return an error if strict
      // return jsonErrorResponse(500, 'Internal server error: Invalid response data.');
    }
    return jsonResponse(200, entries);
  } catch (error: any) {
    console.error("API Error (GET /api/guestbook):", error.message);
    return jsonErrorResponse(500, "Failed to retrieve guestbook entries.");
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  console.log("API Route: POST /api/guestbook invoked.");

  const userId = locals.userId;
  if (!userId) {
      console.log("API Error: Unauthorized access attempt to POST /api/guestbook.");
      return jsonErrorResponse(401, "Unauthorized: Authentication required.");
  }
  console.log(`API Route: User authenticated. User ID: ${userId}. Ready to create guestbook entry.`);

  try {
    let validated;
    try {
      const body = await request.json();
      // Validate input using Zod
      const result = GuestbookEntrySchema.pick({ name: true, message: true }).safeParse(body);
      if (!result.success) {
        return jsonErrorResponse(400, result.error.flatten());
      }
      validated = result.data;
    } catch (e) {
      console.log("API Error: Invalid JSON body received.");
      return jsonErrorResponse(400, "Bad Request: Invalid JSON body.");
    }

    const newEntry = await createGuestbookEntry(validated);

    console.log("API Route: Guestbook entry created successfully.");
    return jsonResponse(201, newEntry);

  } catch (error: any) {
    console.error("API Error (POST /api/guestbook):", error.message);

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