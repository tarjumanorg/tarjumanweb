import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { jsonResponse, jsonErrorResponse } from '../../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../../utils/supabaseUtils";
import { sanitizeFilename, extractFilename } from "../../../../../utils/filenameUtils"; // Import relevant utils
import { generateStoragePath, createSignedUrlForPath, enrichOrderWithSignedUrls, type ApiOrderResponse } from "../../../../../utils/storageUtils"; // Import storage utils
import { STORAGE_BUCKET } from "../../../../../utils/constants"; // Import constants
import type { Order } from "../../../../../types/types";

// No longer need local definitions for constants, suffix generation, or filename extraction

export const POST: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;

    if (!adminUserId) {
        console.error(`API Error (POST /api/admin/orders/${orderId}/upload): Admin user ID not found in locals.`);
        return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: POST /api/admin/orders/${orderId}/upload invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    // 1. Fetch original user ID (needed for storage path)
    let originalUserId: string;
    try {
        console.log(`API Route: Fetching original user ID for order ${idNum} using service client...`);
        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select("user_id") // Select only the user_id
            .eq("id", idNum)
            .maybeSingle(); // Use maybeSingle to handle not found gracefully

        handleSupabaseError(fetchError, `fetch user_id for order ${idNum} (admin service upload)`);

        if (!orderData?.user_id) {
            // No error from Supabase, but order or user_id not found
            return jsonErrorResponse(404, `Order with ID ${idNum} not found or has no associated user.`);
        }
        originalUserId = orderData.user_id;
        console.log(`API Route: Found original user ID ${originalUserId} for order ${idNum}.`);

    } catch (error: any) {
         console.error(`API Error (fetching user_id for order ${idNum} with service client):`, error.message);
         if (error.code === 'PGRST116') { // Check specific codes if maybeSingle() was used
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
         }
          if (error.message.startsWith("Permission Denied:")) {
             return jsonErrorResponse(403, "Forbidden: Check RLS policies for admin access.");
         }
         return jsonErrorResponse(500, `Failed to retrieve order details: ${error.message}`);
    }

    // 2. Process FormData for the file
    let file: File | null = null;
    let originalFilename = 'untitled_translation';
    try {
        const formData = await request.formData();
        const fileEntry = formData.get("translated_file"); // Match the input name attribute

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

    // 3. Generate Storage Path using utility
    const filePath = generateStoragePath({
        userId: originalUserId, // Use the fetched original user ID
        filename: originalFilename,
        type: 'translation',
        orderId: idNum // Pass orderId for translation type
    });

    // 4. Upload file to Storage using Admin client
    console.log(`API Route: Uploading translated file via service client to bucket '${STORAGE_BUCKET}' at path: ${filePath}`);
    try {
         const { error: uploadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file!); // Use the generated path

        // Let handleSupabaseError catch specific storage errors if needed, or check here
        if (uploadError) {
             console.error(`API Storage Error: Failed to upload ${originalFilename} via service client. Code: ${uploadError.name}, Message: ${uploadError.message}`);
             // Rethrow a more specific error or handle common cases (e.g., file exists)
             throw new Error(`Server Error: Failed to upload file '${originalFilename}'. ${uploadError.message}`);
        }
        console.log(`API Route: Successfully uploaded ${originalFilename} via service client to ${filePath}`);

    } catch (error: any) {
         // Catch errors from the upload itself or rethrown errors
         console.error(`API Error (uploading file ${filePath} via service client):`, error.message);
         return jsonErrorResponse(500, `Failed to upload file: ${error.message || 'An unexpected storage error occurred.'}`);
    }

    // 5. Update the order record with the new file path using Admin client
    console.log(`API Route: Updating order ${idNum} via service client with translated_file_url: ${filePath}`);
    let updatedOrderData: Order | null = null;
    try {
        const { data, error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ translated_file_url: filePath }) // Update only the URL field
            .eq("id", idNum)
            .select() // Select the full updated order
            .single(); // Expect the updated order back

        handleSupabaseError(updateError, `update order ${idNum} with translated file URL (admin service)`);

        if (!data) {
             // Should ideally be caught by handleSupabaseError or .single() error handling
             console.error(`API Logic Error: Order ${idNum} not found via service client after successful update attempt.`);
             // Clean up uploaded file? (More complex logic)
             return jsonErrorResponse(500, `Order with ID ${idNum} could not be retrieved after update.`);
        }
        updatedOrderData = data;
        console.log(`API Route: Successfully updated order ${idNum} with translation URL via service client.`);

    } catch (error: any) {
         console.error(`API Error (updating order ${idNum} with URL via service client):`, error.message);
         // Log the orphaned file path for potential manual cleanup
         console.warn(`Potentially orphaned file uploaded to ${filePath} due to database update failure.`);
         let statusCode = 500;
         if (error.code === 'PGRST116') statusCode = 404; // Order not found during update
         if (error.message.startsWith("Permission Denied:")) statusCode = 403;
         return jsonErrorResponse(statusCode, `Failed to update order with file URL: ${error.message}`);
    }

    // 6. Enrich the response with signed URLs
    console.log(`API Route: Enriching final response for order ${idNum} with signed URLs...`);
    const responseData: ApiOrderResponse = await enrichOrderWithSignedUrls(updatedOrderData as Order);

    return jsonResponse(200, responseData);
};