// src/pages/api/admin/orders/[orderId]/upload.ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin"; // Uses admin client
import { jsonResponse, jsonErrorResponse } from '../../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../../utils/supabaseUtils";
import { sanitizeFilename } from "../../../../../utils/filenameUtils";
import type { Order } from "../../../../../types/types";

// --- Configuration ---
const SIGNED_URL_EXPIRES_IN = 3600; // 1 hour in seconds
const STORAGE_BUCKET = 'documents';

// --- Helper Functions ---
const generateRandomSuffix = (length = 6) => Math.random().toString(36).substring(2, 2 + length);

function extractFilename(path: string | null | undefined): string | null {
    if (!path) return null;
    try {
        const decodedPath = decodeURIComponent(path);
        return decodedPath.split('/').pop() || decodedPath;
    } catch (e) {
        console.warn(`Failed to decode or extract filename from path: ${path}`, e);
        return path; // Fallback
    }
}

// --- Structure for File Info ---
interface SignedFileInfo {
    path: string;
    filename: string | null;
    signedUrl: string | null;
}

export const POST: APIRoute = async ({ request, params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;
    const timestamp = Date.now();

    if (!adminUserId) { /* ... (Auth check - unchanged) ... */
        console.error(`API Error (POST /api/admin/orders/${orderId}/upload): Admin user ID not found in locals.`);
        return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: POST /api/admin/orders/${orderId}/upload invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) { /* ... (ID validation - unchanged) ... */
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    // 1. Get the original user ID (unchanged)
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
         return jsonErrorResponse(500, `Failed to retrieve order details: ${error.message}`);
    }

    // 2. Process FormData (unchanged)
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

    // 3. Upload file using ADMIN client (unchanged, path structure is important)
    const sanitizedName = sanitizeFilename(filename);
    const randomSuffix = generateRandomSuffix();
    const filePath = `${originalUserId}/translations/${idNum}-${timestamp}-${randomSuffix}-${sanitizedName}`;

    console.log(`API Route: Uploading translated file via service client to bucket '${STORAGE_BUCKET}' at path: ${filePath}`);
    try {
         const { error: uploadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file!);

        if (uploadError) {
             console.error(`API Storage Error: Failed to upload ${filename} via service client. Code: ${uploadError.name}, Message: ${uploadError.message}`);
             throw new Error(`Server Error: Failed to upload file '${filename}'. ${uploadError.message}`);
        }
        console.log(`API Route: Successfully uploaded ${filename} via service client to ${filePath}`);

    } catch (error: any) {
         console.error(`API Error (uploading file ${filePath} via service client):`, error.message);
         return jsonErrorResponse(500, `Failed to upload file: ${error.message || 'An unexpected storage error occurred.'}`);
    }

    // 4. Update the order record using ADMIN client
    console.log(`API Route: Updating order ${idNum} via service client with translated_file_url: ${filePath}`);
    let updatedOrder: Order | null = null;
    try {
        const { data, error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ translated_file_url: filePath }) // Update with the raw path
            .eq("id", idNum)
            .select() // Return updated order
            .single();

        handleSupabaseError(updateError, `update order ${idNum} with translated file URL (admin service)`);

        if (!data) {
             console.error(`API Logic Error: Order ${idNum} not found via service client after successful update.`);
             return jsonErrorResponse(500, `Order with ID ${idNum} could not be retrieved after update.`);
        }
        updatedOrder = data;
        console.log(`API Route: Successfully updated order ${idNum} with translation URL via service client.`);

    } catch (error: any) {
         console.error(`API Error (updating order ${idNum} with URL via service client):`, error.message);
         console.warn(`Potentially orphaned file uploaded to ${filePath} due to database update failure.`);
         let statusCode = 500;
         return jsonErrorResponse(statusCode, `Failed to update order with file URL: ${error.message}`);
    }

    // 5. Generate Signed URL for the *newly* uploaded file path
    let translatedFileInfo: SignedFileInfo | null = null;
    if (updatedOrder?.translated_file_url) { // Use the path confirmed in the DB
        const dbFilePath = updatedOrder.translated_file_url;
        const filename = extractFilename(dbFilePath);
        try {
            const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(dbFilePath, SIGNED_URL_EXPIRES_IN);

            if (signError) {
                console.error(`API Error: Failed to create signed URL for newly uploaded path "${dbFilePath}":`, signError.message);
                // Proceed but with null signedUrl
                translatedFileInfo = { path: dbFilePath, filename, signedUrl: null };
            } else {
                translatedFileInfo = { path: dbFilePath, filename, signedUrl: signedUrlData?.signedUrl || null };
            }
        } catch (e: any) {
             console.error(`API Exception: Unexpected error signing URL for newly uploaded path "${dbFilePath}":`, e.message);
             translatedFileInfo = { path: dbFilePath, filename, signedUrl: null };
        }
    }

    // 6. Construct and return the final response
    const responseData = {
        ...updatedOrder, // Include all updated order fields
        translated_file_info: translatedFileInfo, // Add structured info
        translated_file_url: undefined, // Remove original URL field
    };

    return jsonResponse(200, responseData);
};