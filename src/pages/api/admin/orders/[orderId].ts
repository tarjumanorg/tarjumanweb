import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types";
import { createSignedUrlForPath, enrichOrderWithSignedUrls, type ApiOrderResponse } from "../../../../utils/storageUtils"; // Import shared utils and types

// Constants are now imported via storageUtils or constants.ts

// No longer need local extractFilename or createSignedUrlForPath definitions

export const GET: APIRoute = async ({ params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;

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
        // Fetch raw order data
        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select(`*`) // Select all fields initially
            .eq("id", idNum)
            .single(); // Expect a single result

        handleSupabaseError(fetchError, `fetch order ${idNum} (admin service)`);

        if (!orderData) {
            // handleSupabaseError would throw for actual DB errors,
            // this catches the case where the query runs but finds nothing.
            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum}. Enriching with signed URLs...`);

        // Use the utility function to get signed URLs and format the response
        const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(orderData as Order);

        console.log(`API Route: Generated signed URLs for order ${idNum}. Returning enhanced data.`);
        return jsonResponse(200, responseData);

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId} with service client):`, error.message);
         // Check for specific Supabase/PostgREST codes if needed, e.g., 'PGRST116' for not found during single()
         if (error.code === 'PGRST116' || error.message.includes('fetch order')) { // PGRST116: "Searched row does not exist"
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
         }
         if (error.message.startsWith("Permission Denied:")) {
             return jsonErrorResponse(403, "Forbidden: Check RLS policies for admin access.");
         }
        return jsonErrorResponse(500, `Failed to retrieve order ${idNum}: ${error.message}`);
    }
}

export const PATCH: APIRoute = async ({ request, params, locals }) => {
     const adminUserId = locals.userId;
     const orderId = params.orderId;

     if (!adminUserId) {
         console.error(`API Error (PATCH /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
     }
     console.log(`API Route: PATCH /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    let payload: Partial<Pick<Order, 'status' | 'page_count' | 'total_price'>>; // Exclude translated_file_url here, handled by upload route
    try {
        payload = await request.json();
    } catch (e) {
        return jsonErrorResponse(400, "Invalid JSON body.");
    }

    // Validate and build the update object
    const updateData: Partial<Order> = {};
    const allowedFields: (keyof typeof payload)[] = ['status', 'page_count', 'total_price'];
    let hasValidUpdate = false;

    for (const key of allowedFields) {
        if (payload[key] !== undefined) { // Check if the key exists in the payload
            if (key === 'status') {
                // Validate status value
                const validStatuses: Order['status'][] = ["pending", "processing", "completed", "cancelled"];
                if (payload.status === null || (typeof payload.status === 'string' && validStatuses.includes(payload.status))) {
                    updateData.status = payload.status;
                    hasValidUpdate = true;
                } else {
                     return jsonErrorResponse(400, `Invalid status value: ${payload.status}. Must be one of ${validStatuses.join(', ')} or null.`);
                }
            } else if (key === 'page_count') {
                if (payload.page_count === null) {
                    updateData.page_count = null; hasValidUpdate = true;
                } else {
                    const count = Number(payload.page_count);
                    if (!isNaN(count) && count >= 0 && Number.isInteger(count)) {
                        updateData.page_count = count; hasValidUpdate = true;
                    } else {
                        return jsonErrorResponse(400, "Invalid page_count: Must be a non-negative integer or null.");
                    }
                }
            } else if (key === 'total_price') {
                 if (payload.total_price === null) {
                    updateData.total_price = null; hasValidUpdate = true;
                 } else {
                    const price = Number(payload.total_price);
                     // Allow non-integer price if needed, otherwise add Number.isInteger(price)
                    if (!isNaN(price) && price >= 0) {
                        updateData.total_price = price; hasValidUpdate = true;
                    } else {
                        return jsonErrorResponse(400, "Invalid total_price: Must be a non-negative number or null.");
                    }
                 }
            }
            // Note: translated_file_url is intentionally not handled here. Use the separate upload endpoint.
        }
    }

    if (!hasValidUpdate) {
        return jsonErrorResponse(400, "No valid fields provided for update.");
    }

    console.log(`API Route: Updating order ${idNum} using admin service client with data:`, updateData);

    try {
        // Update the order
        const { data: updatedOrderData, error: updateError } = await supabaseAdmin
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() // Select all fields of the updated row
            .single(); // Expect a single result

        handleSupabaseError(updateError, `update order ${idNum} (admin service)`);

        if (!updatedOrderData) {
             // This case might occur if the update condition (eq("id", idNum)) doesn't match any row
             // or if RLS prevents the update/select. handleSupabaseError might catch RLS issues.
             console.error(`API Logic Error: Order ${idNum} not found after PATCH attempt or update failed silently.`);
             return jsonErrorResponse(404, `Order with ID ${idNum} could not be found or updated.`);
        }

        console.log(`API Route: Updated order ${idNum}. Enriching response with signed URLs...`);

        // Enrich the updated order data with fresh signed URLs
        const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(updatedOrderData as Order);

        console.log(`API Route: Updated order ${idNum} successfully. Returning enhanced data.`);
        return jsonResponse(200, responseData);

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId} with service client):`, error.message);
        if (error.code === 'PGRST116' || error.message.includes('update order')) { // PGRST116: row not found
             return jsonErrorResponse(404, `Order with ID ${idNum} not found when attempting update.`);
        }
         if (error.message.startsWith("Permission Denied:")) {
             return jsonErrorResponse(403, "Forbidden: Check RLS policies for admin update access.");
         }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};