// src/pages/api/admin/orders/[orderId]/upload.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../../../lib/supabase";
import { jsonResponse, jsonErrorResponse } from '../../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../../utils/supabaseUtils"; // Keep for DB operations
import { sanitizeFilename } from "../../../../../utils/filenameUtils";
import type { Order } from "../../../../../types/types";

const generateRandomSuffix = (length = 6) => Math.random().toString(36).substring(2, 2 + length);

export const POST: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;
    const timestamp = Date.now();
    const storageBucket = "documents";

    // Middleware should have already verified admin status, but we check userId exists
    if (!adminUserId) {
        // This should technically not be reachable if middleware is correct
        console.error("API Error (admin upload): No admin user ID found in locals.");
        return jsonErrorResponse(401, "Unauthorized: Admin session not found.");
    }

    console.log(`API Route: POST /api/admin/orders/${orderId}/upload invoked by admin user ${adminUserId}.`);

    if (!orderId || isNaN(Number(orderId))) {
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    // 1. Get the original user ID associated with the order
    let originalUserId: string;
    try {
        console.log(`API Route: Fetching original user ID for order ${idNum}...`);
        const { data: orderData, error: fetchError } = await supabase
            .from("orders")
            .select("user_id")
            .eq("id", idNum)
            .maybeSingle(); // Use maybeSingle to handle not found gracefully

        // Use handleSupabaseError for the database fetch operation
        handleSupabaseError(fetchError, `fetch user_id for order ${idNum} (admin upload)`);

        if (!orderData?.user_id) {
            // handleSupabaseError would throw on DB error, so this means not found
            return jsonErrorResponse(404, `Order with ID ${idNum} not found or has no associated user.`);
        }
        originalUserId = orderData.user_id;
        console.log(`API Route: Found original user ID ${originalUserId} for order ${idNum}.`);

    } catch (error: any) {
         console.error(`API Error (fetching user_id for order ${idNum}):`, error.message);
         // If handleSupabaseError threw, error message will be standardized
         return jsonErrorResponse(500, `Failed to retrieve order details: ${error.message}`);
    }

    // 2. Process FormData for the file
    let file: File | null = null;
    let filename = 'untitled_translation';
    try {
        const formData = await request.formData();
        const fileEntry = formData.get("translated_file"); // Make sure form field name matches

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

    // 3. Upload file to storage under the *original user's* folder
    const sanitizedName = sanitizeFilename(filename);
    const randomSuffix = generateRandomSuffix();
    // Store translations in a subfolder within the user's directory
    const filePath = `${originalUserId}/translations/${idNum}-${timestamp}-${randomSuffix}-${sanitizedName}`;

    console.log(`API Route: Uploading translated file to bucket '${storageBucket}' at path ${filePath}`);
    try {
         const { error: uploadError } = await supabase.storage
            .from(storageBucket)
            .upload(filePath, file!); // Assert file is not null here based on previous check

        // Check specifically for StorageError here, NOT using handleSupabaseError
        if (uploadError) {
             console.error(`API Error: Failed to upload ${filename}. Error:`, uploadError);
             // Throw a standard Error, the catch block below will handle it
             throw new Error(`Server Error: Failed to upload file '${filename}'. ${uploadError.message}`);
        }
        console.log(`API Route: Successfully uploaded ${filename} to ${filePath}`);

    } catch (error: any) {
         // This catch block now handles both network errors during upload
         // and the explicitly thrown error from the 'if (uploadError)' check above.
         console.error(`API Error (uploading file ${filePath}):`, error.message);
         // Return a generic error message for security
         return jsonErrorResponse(500, `Failed to upload file: ${error.message || 'An unexpected error occurred.'}`);
    }

    // 4. Update the order record with the file path
    console.log(`API Route: Updating order ${idNum} with translated_file_url: ${filePath}`);
    try {
        const { data: updatedOrder, error: updateError } = await supabase
            .from("orders")
            .update({ translated_file_url: filePath })
            .eq("id", idNum)
            .select() // Return updated order
            .single();

        // Use handleSupabaseError for the database update operation
        handleSupabaseError(updateError, `update order ${idNum} with translated file URL (admin)`);

        if (!updatedOrder) {
             // Should not happen if update succeeded without error and row exists, but safeguard.
             // handleSupabaseError would throw on PGRST116 (not found) if .single() failed.
             console.error(`API Logic Error: Order ${idNum} not found after successful update.`);
             return jsonErrorResponse(500, `Order with ID ${idNum} could not be retrieved after update.`);
        }

        console.log(`API Route: Successfully updated order ${idNum} with translation URL.`);
        return jsonResponse(200, updatedOrder as Order);

    } catch (error: any) {
         console.error(`API Error (updating order ${idNum} with URL):`, error.message);
         // Attempt to delete the orphaned file? Maybe too complex for now. Log it.
         console.warn(`Potentially orphaned file uploaded to ${filePath} due to database update failure.`);

         // Standardize response using error message from handleSupabaseError if it threw
         let statusCode = 500;
         if (error.message.includes("Permission Denied")) {
            statusCode = 403;
         }
         // Consider other specific errors if needed

         return jsonErrorResponse(statusCode, `Failed to update order with file URL: ${error.message}`);
    }
};