// src/pages/api/admin/orders/[orderId].ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin"; // Uses admin client
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types"; // Base Order type

// --- Configuration ---
const SIGNED_URL_EXPIRES_IN = 3600; // 1 hour in seconds
const STORAGE_BUCKET = 'documents';

// --- Helper Function ---
function extractFilename(path: string | null | undefined): string | null {
    if (!path) return null;
    try {
        // Decode URI component first, then get the part after the last slash
        const decodedPath = decodeURIComponent(path);
        return decodedPath.split('/').pop() || decodedPath;
    } catch (e) {
        console.warn(`Failed to decode or extract filename from path: ${path}`, e);
        return path; // Fallback to the original path
    }
}

// --- Structure for File Info with Signed URL ---
interface SignedFileInfo {
    path: string;
    filename: string | null;
    signedUrl: string | null;
}

/**
 * Generates a signed URL for a given path.
 * Logs errors but doesn't throw, returns null on failure.
 */
async function createSignedUrlForPath(path: string | null | undefined): Promise<SignedFileInfo | null> {
    if (!path) return null;

    const filename = extractFilename(path);
    try {
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`API Error: Failed to create signed URL for path "${path}":`, error.message);
            return { path, filename, signedUrl: null }; // Return info with null URL on error
        }
        return { path, filename, signedUrl: data?.signedUrl || null };

    } catch (e: any) {
        console.error(`API Exception: Unexpected error signing URL for path "${path}":`, e.message);
        return { path, filename, signedUrl: null }; // Return info with null URL on exception
    }
}

// --- GET handler ---
export const GET: APIRoute = async ({ params, locals }) => {
    const adminUserId = locals.userId;
    const orderId = params.orderId;

    if (!adminUserId) { /* ... (Auth check - unchanged) ... */
         console.error(`API Error (GET /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: GET /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) { /* ... (ID validation - unchanged) ... */
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    try {
        // 1. Fetch original order data
        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select(`*`)
            .eq("id", idNum)
            .single();

        handleSupabaseError(fetchError, `fetch order ${idNum} (admin service)`);

        if (!orderData) {
            // Should be caught by handleSupabaseError with .single(), but safeguard
            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum}. Generating signed URLs...`);

        // 2. Generate Signed URLs for file paths
        const uploadedFilesInfoPromises = (orderData.uploaded_file_urls || [])
            .map((path: string) => createSignedUrlForPath(path));

        const [
            uploadedFilesInfoResults,
            certificateInfoResult,
            translatedFileInfoResult
        ] = await Promise.all([
            Promise.all(uploadedFilesInfoPromises),
            createSignedUrlForPath(orderData.certificate_url),
            createSignedUrlForPath(orderData.translated_file_url),
        ]);

        // Filter out any null results from uploaded files if needed (e.g., path was null/empty)
        const validUploadedFilesInfo = uploadedFilesInfoResults.filter(info => info !== null) as SignedFileInfo[];

        // 3. Construct response object
        const responseData = {
            ...orderData, // Include all original order fields
            // Add structured info for files
            uploaded_files_info: validUploadedFilesInfo,
            certificate_info: certificateInfoResult,
            translated_file_info: translatedFileInfoResult,
            // Optionally remove original URL fields to avoid confusion
            uploaded_file_urls: undefined,
            certificate_url: undefined,
            translated_file_url: undefined,
        };

        console.log(`API Route: Generated signed URLs for order ${idNum}. Returning enhanced data.`);
        return jsonResponse(200, responseData); // Type assertion might be needed depending on strictness

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId} with service client):`, error.message);
         if (error.code === 'PGRST116' || error.message.includes('fetch order')) { // Check specific message if needed
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
         }
        return jsonErrorResponse(500, `Failed to retrieve order ${idNum}: ${error.message}`);
    }
}

// --- PATCH handler ---
export const PATCH: APIRoute = async ({ request, params, locals }) => {
     const adminUserId = locals.userId;
     const orderId = params.orderId;

     if (!adminUserId) { /* ... (Auth check - unchanged) ... */
         console.error(`API Error (PATCH /api/admin/orders/${orderId}): Admin user ID not found in locals.`);
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
     }
     console.log(`API Route: PATCH /api/admin/orders/${orderId} invoked by verified admin user ${adminUserId}. Using service client.`);

    if (!orderId || isNaN(Number(orderId))) { /* ... (ID validation - unchanged) ... */
        return jsonErrorResponse(400, "Invalid Order ID.");
    }
    const idNum = Number(orderId);

    let payload: Partial<Pick<Order, 'status' | 'page_count' | 'total_price' | 'translated_file_url'>>; // Keep payload definition simple
    try {
        payload = await request.json();
    } catch (e) {
        return jsonErrorResponse(400, "Invalid JSON body.");
    }

    // Validate and build update object (logic remains the same)
    const updateData: Partial<Order> = {};
    const allowedFields: (keyof typeof payload)[] = ['status', 'page_count', 'total_price', 'translated_file_url'];
    let hasValidUpdate = false;

    for (const key of allowedFields) {
        if (payload[key] !== undefined) {
             // Add specific validation checks as needed here
            if (key === 'status') { updateData.status = payload.status; hasValidUpdate = true; }
            else if (key === 'page_count') { updateData.page_count = payload.page_count === null ? null : Math.floor(Number(payload.page_count)); hasValidUpdate = true; }
            else if (key === 'total_price') { updateData.total_price = payload.total_price === null ? null : Number(payload.total_price); hasValidUpdate = true; }
            else if (key === 'translated_file_url') { updateData.translated_file_url = payload.translated_file_url || null; hasValidUpdate = true; }
        }
    }

    if (!hasValidUpdate) {
        return jsonErrorResponse(400, "No valid fields provided for update or payload validation failed.");
    }

    console.log(`API Route: Updating order ${idNum} using admin service client with data:`, updateData);

    try {
        // 1. Update the database record
        const { data: updatedOrderData, error: updateError } = await supabaseAdmin
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() // Return the updated row
            .single();

        handleSupabaseError(updateError, `update order ${idNum} (admin service)`);

        if (!updatedOrderData) {
             console.error(`API Logic Error: Order ${idNum} not found after PATCH reported success.`);
             return jsonErrorResponse(404, `Order with ID ${idNum} could not be found after update attempt.`);
        }

        console.log(`API Route: Updated order ${idNum}. Generating signed URLs for updated data...`);

        // 2. Generate Signed URLs for the *updated* file paths
        const uploadedFilesInfoPromises = (updatedOrderData.uploaded_file_urls || [])
            .map((path: string) => createSignedUrlForPath(path));

        const [
            uploadedFilesInfoResults,
            certificateInfoResult,
            translatedFileInfoResult
        ] = await Promise.all([
            Promise.all(uploadedFilesInfoPromises),
            createSignedUrlForPath(updatedOrderData.certificate_url),
            createSignedUrlForPath(updatedOrderData.translated_file_url), // Use updated path here
        ]);

        const validUploadedFilesInfo = uploadedFilesInfoResults.filter(info => info !== null) as SignedFileInfo[];

        // 3. Construct response object
        const responseData = {
            ...updatedOrderData, // Include all updated order fields
            uploaded_files_info: validUploadedFilesInfo,
            certificate_info: certificateInfoResult,
            translated_file_info: translatedFileInfoResult,
            uploaded_file_urls: undefined,
            certificate_url: undefined,
            translated_file_url: undefined,
        };

        console.log(`API Route: Updated order ${idNum} successfully. Returning enhanced data.`);
        return jsonResponse(200, responseData); // Return the enhanced data

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId} with service client):`, error.message);
         if (error.code === 'PGRST116' || error.message.includes('update order')) {
             return jsonErrorResponse(404, `Order with ID ${idNum} not found when attempting update.`);
         }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};