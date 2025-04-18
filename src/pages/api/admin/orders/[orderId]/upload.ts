// src/pages/api/admin/orders/[orderId]/upload.ts
// Uploads translated file - Uses the admin client (Service Role Key) for DB and Storage
import type { APIRoute } from "astro";
// Use the admin client for DB operations AND storage
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin"; // <--- Uses admin client
import { jsonResponse, jsonErrorResponse } from '../../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../../utils/supabaseUtils";
import { sanitizeFilename } from "../../../../../utils/filenameUtils";
import type { Order } from "../../../../../types/types";

const generateRandomSuffix = (length = 6) => Math.random().toString(36).substring(2, 2 + length);

export const POST: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId; // Verify the CALLER is an admin
    const orderId = params.orderId;
    const timestamp = Date.now();
    const storageBucket = "documents"; // Ensure service role has 'insert' permission on this bucket

    // Middleware check safeguard
    if (!adminUserId) {
        console.error(`API Error (POST /api/admin/orders/${orderId}/upload): Admin user ID not found in locals.`);
        return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: POST /api/admin/orders/${orderId}/upload invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    // 1. Get the original user ID associated with the order (Needed for file path structure)
    //    Use the ADMIN client here too, as RLS on orders might prevent access otherwise.
    let originalUserId: string;
    try {
        console.log(`API Route: Fetching original user ID for order ${idNum} using service client...`);
        const { data: orderData, error: fetchError } = await supabaseAdmin // <--- Uses admin client
            .from("orders")
            .select("user_id") // Only need user_id
            .eq("id", idNum)
            .maybeSingle(); // Handles not found gracefully

        // Handle DB errors for the fetch operation
        handleSupabaseError(fetchError, `fetch user_id for order ${idNum} (admin service upload)`);

        if (!orderData?.user_id) {
            // This means not found, as handleSupabaseError would throw on actual DB errors
            return jsonErrorResponse(404, `Order with ID ${idNum} not found or has no associated user.`);
        }
        originalUserId = orderData.user_id;
        console.log(`API Route: Found original user ID ${originalUserId} for order ${idNum}.`);

    } catch (error: any) {
         console.error(`API Error (fetching user_id for order ${idNum} with service client):`, error.message);
         return jsonErrorResponse(500, `Failed to retrieve order details: ${error.message}`);
    }

    // 2. Process FormData for the file (remains the same)
    let file: File | null = null;
    let filename = 'untitled_translation';
    try {
        const formData = await request.formData();
        const fileEntry = formData.get("translated_file");

        if (!fileEntry || typeof fileEntry === 'string' || !(fileEntry instanceof File) || fileEntry.size === 0) {
             return jsonErrorResponse(400, "Missing or invalid 'translated_file' in form data.");
        }
        file = fileEntry;
        filename = file.name;
        console.log(`API Route: Received file '${filename}' for upload.`);
    } catch (error: any) {
         console.error("API Error: Failed to parse FormData.", error);
         return jsonErrorResponse(400, "Bad Request: Invalid form data.");
    }

    // 3. Upload file to storage using the ADMIN client
    //    This assumes the service role has INSERT permissions on the target bucket.
    const sanitizedName = sanitizeFilename(filename);
    const randomSuffix = generateRandomSuffix();
    // Store translations in a subfolder within the original user's directory
    const filePath = `${originalUserId}/translations/${idNum}-${timestamp}-${randomSuffix}-${sanitizedName}`;

    console.log(`API Route: Uploading translated file via service client to bucket '${storageBucket}' at path: ${filePath}`);
    try {
         // Use the admin client's storage interface
         const { error: uploadError } = await supabaseAdmin.storage // <--- Uses admin client storage
            .from(storageBucket)
            .upload(filePath, file!); // Assert file is not null here based on previous check

        // Check specifically for StorageError (do not use handleSupabaseError for storage)
        if (uploadError) {
             console.error(`API Storage Error: Failed to upload ${filename} via service client. Code: ${uploadError.name}, Message: ${uploadError.message}`);
             // Throw a standard Error, the catch block below will handle it
             throw new Error(`Server Error: Failed to upload file '${filename}'. ${uploadError.message}`);
        }
        console.log(`API Route: Successfully uploaded ${filename} via service client to ${filePath}`);

    } catch (error: any) {
         // Catches network errors during upload or the explicitly thrown error above.
         console.error(`API Error (uploading file ${filePath} via service client):`, error.message);
         // Return a generic error message for security
         return jsonErrorResponse(500, `Failed to upload file: ${error.message || 'An unexpected storage error occurred.'}`);
    }

    // 4. Update the order record with the file path using the ADMIN client
    console.log(`API Route: Updating order ${idNum} via service client with translated_file_url: ${filePath}`);
    try {
        const { data: updatedOrder, error: updateError } = await supabaseAdmin // <--- Uses admin client
            .from("orders")
            .update({ translated_file_url: filePath })
            .eq("id", idNum)
            .select() // Return updated order
            .single();

        // Use handleSupabaseError for the database update operation
        handleSupabaseError(updateError, `update order ${idNum} with translated file URL (admin service)`);

        // Safeguard check after successful update
        if (!updatedOrder) {
             console.error(`API Logic Error: Order ${idNum} not found via service client after successful update.`);
             return jsonErrorResponse(500, `Order with ID ${idNum} could not be retrieved after update.`);
        }

        console.log(`API Route: Successfully updated order ${idNum} with translation URL via service client.`);
        return jsonResponse(200, updatedOrder as Order);

    } catch (error: any) {
         console.error(`API Error (updating order ${idNum} with URL via service client):`, error.message);
         // Attempt cleanup? Maybe too complex. Log the orphaned file.
         console.warn(`Potentially orphaned file uploaded to ${filePath} due to database update failure.`);

         // Standardize response using error message from handleSupabaseError if it threw
         let statusCode = 500;
         // Check specific codes if handleSupabaseError logic is enhanced later
         // if (error.code === '...') { statusCode = ...; }

         return jsonErrorResponse(statusCode, `Failed to update order with file URL: ${error.message}`);
    }
};