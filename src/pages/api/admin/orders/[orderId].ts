// src/pages/api/admin/orders/[orderId].ts
// Fetches/Updates a SINGLE order - Uses the admin client (Service Role Key)
import type { APIRoute } from "astro";
// Import the admin client
import { supabaseAdmin } from "../../../../lib/supabaseAdmin"; // <--- Uses admin client
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types";

// GET handler for fetching a single order by ID
export const GET: APIRoute = async ({ params, locals }) => {
    const adminUserId = locals.userId; // Verify the CALLER is an admin
    const orderId = params.orderId;

    // Middleware check safeguard
    if (!adminUserId) {
         console.error(`API Error (GET /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: GET /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    try {
         // Use the admin client
         const { data, error } = await supabaseAdmin // <--- Uses admin client
            .from("orders")
            .select(`*`) // Select all fields for detail view
            .eq("id", idNum)
            .single(); // Expect only one

        // Handle non-RLS errors
        handleSupabaseError(error, `fetch order ${idNum} (admin service)`);

        // Note: handleSupabaseError with .single() should throw if not found (PGRST116),
        // but an explicit check remains a good safety measure.
        if (!data) {
            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum} using admin service client.`);
        return jsonResponse(200, data as Order);

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId} with service client):`, error.message);
         // Check for the specific error code if handleSupabaseError didn't catch it (should have)
         if (error.code === 'PGRST116') {
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
         }
        return jsonErrorResponse(500, `Failed to retrieve order ${idNum}: ${error.message}`);
    }
}

// PATCH handler for updating specific order fields
export const PATCH: APIRoute = async ({ request, params, locals }) => {
     const adminUserId = locals.userId; // Verify the CALLER is an admin
     const orderId = params.orderId;

     // Middleware check safeguard
     if (!adminUserId) {
         console.error(`API Error (PATCH /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
     }
     console.log(`API Route: PATCH /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    let payload: Partial<Pick<Order, 'status' | 'page_count' | 'total_price' | 'translated_file_url'>>;
    try {
        payload = await request.json();
    } catch (e) {
        return jsonErrorResponse(400, "Invalid JSON body.");
    }

    // Validate and build the update object (logic remains the same)
    const updateData: Partial<Order> = {};
    const allowedFields: (keyof typeof payload)[] = ['status', 'page_count', 'total_price', 'translated_file_url'];
    let hasValidUpdate = false;

    for (const key of allowedFields) {
        if (payload[key] !== undefined) {
            // Specific validation for each field
            if (key === 'status') { /* ...validation... */ updateData.status = payload.status; hasValidUpdate = true; }
             else if (key === 'page_count') { /* ...validation... */ updateData.page_count = payload.page_count === null ? null : Math.floor(Number(payload.page_count)); hasValidUpdate = true; }
             else if (key === 'total_price') { /* ...validation... */ updateData.total_price = payload.total_price === null ? null : Number(payload.total_price); hasValidUpdate = true; }
             else if (key === 'translated_file_url') { /* ...validation... */ updateData.translated_file_url = payload.translated_file_url || null; hasValidUpdate = true; }
             // Add more explicit validation checks as needed here
        }
    }
    // Ensure values are valid before setting hasValidUpdate = true inside the blocks above

    if (!hasValidUpdate) {
        return jsonErrorResponse(400, "No valid fields provided for update, or payload validation failed.");
    }

    console.log(`API Route: Updating order ${idNum} using admin service client with data:`, updateData);

    try {
        // Use the admin client
        const { data, error } = await supabaseAdmin // <--- Uses admin client
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() // Return the updated row
            .single();

        // Handle non-RLS errors
        handleSupabaseError(error, `update order ${idNum} (admin service)`);

        // Check if data is null after successful update (shouldn't happen if row exists and no error)
        if (!data) {
             // handleSupabaseError should catch PGRST116 if the row didn't exist to update
             console.error(`API Logic Error: Order ${idNum} not found after PATCH operation reported success.`);
             return jsonErrorResponse(404, `Order with ID ${idNum} could not be found after update attempt.`);
        }

        console.log(`API Route: Updated order ${idNum} successfully using admin service client.`);
        return jsonResponse(200, data as Order);

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId} with service client):`, error.message);
        // Check specific error codes if needed
         if (error.code === 'PGRST116') { // Should be caught by handleSupabaseError, but good safeguard
             return jsonErrorResponse(404, `Order with ID ${idNum} not found when attempting update.`);
         }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};