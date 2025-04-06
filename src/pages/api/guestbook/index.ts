// src/pages/api/guestbook/index.ts
import type { APIRoute } from "astro";
// Import the SERVICE functions, NOT the supabase client directly for DB operations
import { getAllGuestbookEntries, createGuestbookEntry } from "../../../services/guestbook.service";
import type { GuestbookEntry } from "../../../types/types"; // Import type for request body validation

export const GET: APIRoute = async () => {
  console.log("API Route: GET /api/guestbook invoked.");
  try {
    // Call the service function to get data
    const entries = await getAllGuestbookEntries();

    // API route focuses on the HTTP response
    return new Response(JSON.stringify(entries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("API Error (GET /api/guestbook):", error.message);
    // Return a generic server error response (avoid leaking detailed errors)
    return new Response(
      JSON.stringify({ error: "Failed to retrieve guestbook entries." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  console.log("API Route: POST /api/guestbook invoked.");
  try {
    // 1. Parse and validate request body at the API level
    let name: string;
    let message: string;
    try {
        // Ensure body is valid JSON and has the expected fields
        const body: Partial<GuestbookEntry> = await request.json();
        name = body.name?.toString() ?? ''; // Use nullish coalescing for safety
        message = body.message?.toString() ?? '';

        // Basic presence check (more specific validation is in the service)
        if (!name || !message) {
            console.log("API Error: Missing name or message in request body.");
            return new Response(JSON.stringify({ error: "Bad Request: Name and message are required."}), {
                 status: 400,
                 headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (e) {
        console.log("API Error: Invalid JSON body received.");
        return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body."}), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 2. Call the service function to perform the action
    // The service handles its own validation and database logic
    const newEntry = await createGuestbookEntry(name, message);

    // 3. Return the successful HTTP response
    console.log("API Route: Guestbook entry created successfully.");
    return new Response(JSON.stringify(newEntry), {
        status: 201, // 201 Created is appropriate for successful POST
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("API Error (POST /api/guestbook):", error.message);

    // Handle specific errors thrown by the service
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
         return new Response( JSON.stringify({ error: "Failed to submit guestbook entry due to a server error." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
         });
     }

    // Fallback for unexpected errors
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred while submitting the guestbook entry." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};