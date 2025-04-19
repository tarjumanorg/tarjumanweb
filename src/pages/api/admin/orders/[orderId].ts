import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from '../../../../schemas/order.schema';
import { createSignedUrlForPath, enrichOrderWithSignedUrls, type ApiOrderResponse } from "../../../../utils/storageUtils";
import { z } from "zod";
import { AdminOrderDetailResponseSchema, UpdateOrderPayloadSchema } from '../../../../schemas/order.schema';

export const GET: APIRoute = async ({ params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;

    if (!adminUserId) {
         console.error(`API Error (GET /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: GET /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    const idNumResult = z.coerce.number().int().positive().safeParse(orderId);
    if (!idNumResult.success) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = idNumResult.data;

    try {

        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select(`*`) 
            .eq("id", idNum)
            .single(); 

        handleSupabaseError(fetchError, `fetch order ${idNum} (admin service)`);

        if (!orderData) {

            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum}. Enriching with signed URLs...`);

        const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(orderData as Order);

        const parseResult = AdminOrderDetailResponseSchema.safeParse(responseData);
        if (!parseResult.success) {
            console.error('Admin Order Detail GET response validation failed:', parseResult.error.flatten());
       }

        console.log(`API Route: Generated signed URLs for order ${idNum}. Returning enhanced data.`);
        return jsonResponse(200, responseData);

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId} with service client):`, error.message);

         if (error.code === 'PGRST116' || error.message.includes('fetch order')) { 
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

    const idNumResult = z.coerce.number().int().positive().safeParse(orderId);
    if (!idNumResult.success) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = idNumResult.data;

    let payload;
    try {
        payload = await request.json();
        const result = UpdateOrderPayloadSchema.safeParse(payload);
        if (!result.success) {
            return jsonErrorResponse(400, result.error.flatten());
        }
        payload = result.data;
    } catch (e) {
        return jsonErrorResponse(400, "Invalid JSON body.");
    }

    const updateData: import('../../../../schemas/order.schema').UpdateOrderPayload = { ...payload };
    const hasValidUpdate = Object.keys(updateData).length > 0;

    if (!hasValidUpdate) {
        return jsonErrorResponse(400, "No valid fields provided for update.");
    }

    console.log(`API Route: Updating order ${idNum} using admin service client with data:`, updateData);

    try {

        const { data: updatedOrderData, error: updateError } = await supabaseAdmin
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() 
            .single(); 

        handleSupabaseError(updateError, `update order ${idNum} (admin service)`);

        if (!updatedOrderData) {

             console.error(`API Logic Error: Order ${idNum} not found after PATCH attempt or update failed silently.`);
             return jsonErrorResponse(404, `Order with ID ${idNum} could not be found or updated.`);
        }

        console.log(`API Route: Updated order ${idNum}. Enriching response with signed URLs...`);

        const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(updatedOrderData as Order);

        const parseResult = AdminOrderDetailResponseSchema.safeParse(responseData);
        if (!parseResult.success) {
            console.error('Admin Order Detail PATCH response validation failed:', parseResult.error.flatten());
        }

        console.log(`API Route: Updated order ${idNum} successfully. Returning enhanced data.`);
        return jsonResponse(200, responseData);

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId} with service client):`, error.message);
        if (error.code === 'PGRST116' || error.message.includes('update order')) { 
             return jsonErrorResponse(404, `Order with ID ${idNum} not found when attempting update.`);
        }
         if (error.message.startsWith("Permission Denied:")) {
             return jsonErrorResponse(403, "Forbidden: Check RLS policies for admin update access.");
         }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};