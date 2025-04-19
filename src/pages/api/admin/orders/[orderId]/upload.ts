import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { jsonResponse, jsonErrorResponse } from '../../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../../utils/supabaseUtils";
import { sanitizeFilename, extractFilename } from "../../../../../utils/filenameUtils"; 
import { generateStoragePath, createSignedUrlForPath, enrichOrderWithSignedUrls, type ApiOrderResponse } from "../../../../../utils/storageUtils"; 
import { STORAGE_BUCKET } from "../../../../../utils/constants"; 
import type { Order } from '../../../../../schemas/order.schema';
import { z } from "zod";
import { AdminOrderDetailResponseSchema } from '../../../../../schemas/order.schema';

export const POST: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;

    if (!adminUserId) {
        console.error(`API Error (POST /api/admin/orders/${orderId}/upload): Admin user ID not found in locals.`);
        return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: POST /api/admin/orders/${orderId}/upload invoked by verified admin user ${adminUserId}. Using service client.`);

    const idNumResult = z.coerce.number().int().positive().safeParse(orderId);
    if (!idNumResult.success) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = idNumResult.data;

    let originalUserId: string;
    try {
        console.log(`API Route: Fetching original user ID for order ${idNum} using service client...`);
        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select("user_id") 
            .eq("id", idNum)
            .maybeSingle(); 

        handleSupabaseError(fetchError, `fetch user_id for order ${idNum} (admin service upload)`);

        if (!orderData?.user_id) {

            return jsonErrorResponse(404, `Order with ID ${idNum} not found or has no associated user.`);
        }
        originalUserId = orderData.user_id;
        console.log(`API Route: Found original user ID ${originalUserId} for order ${idNum}.`);

    } catch (error: any) {
         console.error(`API Error (fetching user_id for order ${idNum} with service client):`, error.message);
         if (error.code === 'PGRST116') { 
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
         }
          if (error.message.startsWith("Permission Denied:")) {
             return jsonErrorResponse(403, "Forbidden: Check RLS policies for admin access.");
         }
         return jsonErrorResponse(500, `Failed to retrieve order details: ${error.message}`);
    }

    let file: File | null = null;
    let originalFilename = 'untitled_translation';
    try {
        const formData = await request.formData();
        const fileEntry = formData.get("translated_file"); 

        if (!fileEntry || typeof fileEntry === 'string' || !(fileEntry instanceof File) || fileEntry.size === 0) {
             return jsonErrorResponse(400, "Missing or invalid 'translated_file' in form data. Ensure the file input name matches and a file is selected.");
        }
        file = fileEntry;
        originalFilename = file.name;
        console.log(`API Route: Received file '${originalFilename}' for upload.`);
    } catch (error: any) {
         console.error("API Error: Failed to parse FormData.", error);
         return jsonErrorResponse(400, "Bad Request: Invalid form data.");
    }

    const filePath = generateStoragePath({
        userId: originalUserId, 
        filename: originalFilename,
        type: 'translation',
        orderId: idNum 
    });

    console.log(`API Route: Uploading translated file via service client to bucket '${STORAGE_BUCKET}' at path: ${filePath}`);
    try {
         const { error: uploadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file!); 

        if (uploadError) {
             console.error(`API Storage Error: Failed to upload ${originalFilename} via service client. Code: ${uploadError.name}, Message: ${uploadError.message}`);

             throw new Error(`Server Error: Failed to upload file '${originalFilename}'. ${uploadError.message}`);
        }
        console.log(`API Route: Successfully uploaded ${originalFilename} via service client to ${filePath}`);

    } catch (error: any) {

         console.error(`API Error (uploading file ${filePath} via service client):`, error.message);
         return jsonErrorResponse(500, `Failed to upload file: ${error.message || 'An unexpected storage error occurred.'}`);
    }

    console.log(`API Route: Updating order ${idNum} via service client with translated_file_url: ${filePath}`);
    let updatedOrderData: Order | null = null;
    try {
        const { data, error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ translated_file_url: filePath }) 
            .eq("id", idNum)
            .select() 
            .single(); 

        handleSupabaseError(updateError, `update order ${idNum} with translated file URL (admin service)`);

        if (!data) {

             console.error(`API Logic Error: Order ${idNum} not found via service client after successful update attempt.`);

             return jsonErrorResponse(500, `Order with ID ${idNum} could not be retrieved after update.`);
        }
        updatedOrderData = data;
        console.log(`API Route: Successfully updated order ${idNum} with translation URL via service client.`);

    } catch (error: any) {
         console.error(`API Error (updating order ${idNum} with URL via service client):`, error.message);

         console.warn(`Potentially orphaned file uploaded to ${filePath} due to database update failure.`);
         let statusCode = 500;
         if (error.code === 'PGRST116') statusCode = 404; 
         if (error.message.startsWith("Permission Denied:")) statusCode = 403;
         return jsonErrorResponse(statusCode, `Failed to update order with file URL: ${error.message}`);
    }

    console.log(`API Route: Enriching final response for order ${idNum} with signed URLs...`);
    const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(updatedOrderData as Order);

    const parseResult = AdminOrderDetailResponseSchema.safeParse(responseData);
    if (!parseResult.success) {
        console.error('Admin Order Upload POST response validation failed:', parseResult.error.flatten());
    }

    return jsonResponse(200, responseData);
};