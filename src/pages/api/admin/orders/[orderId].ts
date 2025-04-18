// src/pages/api/admin/orders/[orderId].ts // <-- CORRECT FILENAME NOW
import type { APIRoute } from "astro";
import { supabase } from "../../../../lib/supabase";
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types";

// GET handler for fetching a single order by ID
export const GET: APIRoute = async ({ params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId; // Reads the ID from the URL segment
    console.log(`API Route: GET /api/admin/orders/${orderId} invoked by admin user ${adminUserId}.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    try {
        const { data, error } = await supabase
            .from("orders")
            .select(`*`) // Select all fields for detail view
            .eq("id", idNum)
            .single(); // Expect only one

        handleSupabaseError(error, `fetch order ${idNum} (admin)`);

        if (!data) {
            // handleSupabaseError covers PGRST116, but explicit check is good.
            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum} for admin.`);
        return jsonResponse(200, data as Order);

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId}):`, error.message);
        if (error.message.includes("Permission Denied")) {
            return jsonErrorResponse(403, error.message);
        }
        if (error.code === 'PGRST116') { // PostgREST code for "exactly one row expected" failure
            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }
        return jsonErrorResponse(500, `Failed to retrieve order ${idNum}: ${error.message}`);
    }
}

// PATCH handler for updating specific order fields
export const PATCH: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId; // Reads the ID from the URL segment
    console.log(`API Route: PATCH /api/admin/orders/${orderId} invoked by admin user ${adminUserId}.`);

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

    // Validate and build the update object, only allowing specific fields
    const updateData: Partial<Order> = {};
    const allowedFields: (keyof typeof payload)[] = ['status', 'page_count', 'total_price', 'translated_file_url'];
    let hasValidUpdate = false;

    for (const key of allowedFields) {
        if (payload[key] !== undefined) {
            // Add specific validation if needed (e.g., status must be one of the allowed values)
            if (key === 'status') {
                const validStatuses: Order['status'][] = ["pending", "processing", "completed", "cancelled"];
                if (!validStatuses.includes(payload.status as Order['status'])) {
                return jsonErrorResponse(400, `Invalid status value: ${payload.status}`);
                }
                updateData.status = payload.status;
                hasValidUpdate = true;
            } else if (key === 'page_count') {
                // Allow null or a non-negative number
                if (payload.page_count === null) {
                     updateData.page_count = null;
                     hasValidUpdate = true;
                } else {
                    const count = Number(payload.page_count);
                    if (isNaN(count) || count < 0) {
                        return jsonErrorResponse(400, `Invalid page_count value: ${payload.page_count}`);
                    }
                    updateData.page_count = Math.floor(count); // Ensure integer
                    hasValidUpdate = true;
                }
            } else if (key === 'total_price') {
                 // Allow null or a non-negative number
                if (payload.total_price === null) {
                     updateData.total_price = null;
                     hasValidUpdate = true;
                } else {
                    const price = Number(payload.total_price);
                    if (isNaN(price) || price < 0) {
                        return jsonErrorResponse(400, `Invalid total_price value: ${payload.total_price}`);
                    }
                    // Note: Supabase bigint might need conversion depending on exact setup/client library
                    // Assuming direct number assignment works here. Could also send as string if needed.
                    updateData.total_price = price;
                    hasValidUpdate = true;
                }
            } else if (key === 'translated_file_url') {
                // Basic check: allow null or non-empty string
                if (payload.translated_file_url === null || typeof payload.translated_file_url === 'string') {
                    updateData.translated_file_url = payload.translated_file_url || null; // Store empty string as null
                    hasValidUpdate = true;
                } else {
                    return jsonErrorResponse(400, `Invalid translated_file_url value: ${payload.translated_file_url}`);
                }
            }
        }
    }


    if (!hasValidUpdate) {
        return jsonErrorResponse(400, "No valid fields provided for update.");
    }

    console.log(`API Route: Updating order ${idNum} with data:`, updateData);

    try {
        const { data, error } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() // Return the updated row
            .single();

        handleSupabaseError(error, `update order ${idNum} (admin)`);

        if (!data) {
            // handleSupabaseError covers PGRST116, but explicit check is good.
            return jsonErrorResponse(404, `Order with ID ${idNum} not found after update.`);
        }

        console.log(`API Route: Updated order ${idNum} successfully.`);
        return jsonResponse(200, data as Order);

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId}):`, error.message);
        if (error.message.includes("Permission Denied")) {
            return jsonErrorResponse(403, error.message);
        }
        if (error.code === 'PGRST116') { // If the select().single() fails after update
            return jsonErrorResponse(404, `Order with ID ${idNum} not found after update.`);
        }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};