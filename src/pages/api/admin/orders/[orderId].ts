import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin"; 
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types"; 

const SIGNED_URL_EXPIRES_IN = 3600; 
const STORAGE_BUCKET = 'documents';

function extractFilename(path: string | null | undefined): string | null {
    if (!path) return null;
    try {

        const decodedPath = decodeURIComponent(path);
        return decodedPath.split('/').pop() || decodedPath;
    } catch (e) {
        console.warn(`Failed to decode or extract filename from path: ${path}`, e);
        return path; 
    }
}

interface SignedFileInfo {
    path: string;
    filename: string | null;
    signedUrl: string | null;
}

async function createSignedUrlForPath(path: string | null | undefined): Promise<SignedFileInfo | null> {
    if (!path) return null;

    const filename = extractFilename(path);
    try {
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`API Error: Failed to create signed URL for path "${path}":`, error.message);
            return { path, filename, signedUrl: null }; 
        }
        return { path, filename, signedUrl: data?.signedUrl || null };

    } catch (e: any) {
        console.error(`API Exception: Unexpected error signing URL for path "${path}":`, e.message);
        return { path, filename, signedUrl: null }; 
    }
}

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

        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select(`*`)
            .eq("id", idNum)
            .single();

        handleSupabaseError(fetchError, `fetch order ${idNum} (admin service)`);

        if (!orderData) {

            return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
        }

        console.log(`API Route: Fetched order ${idNum}. Generating signed URLs...`);

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

        const validUploadedFilesInfo = uploadedFilesInfoResults.filter(info => info !== null) as SignedFileInfo[];

        const responseData = {
            ...orderData, 

            uploaded_files_info: validUploadedFilesInfo,
            certificate_info: certificateInfoResult,
            translated_file_info: translatedFileInfoResult,

            uploaded_file_urls: undefined,
            certificate_url: undefined,
            translated_file_url: undefined,
        };

        console.log(`API Route: Generated signed URLs for order ${idNum}. Returning enhanced data.`);
        return jsonResponse(200, responseData); 

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders/${orderId} with service client):`, error.message);
         if (error.code === 'PGRST116' || error.message.includes('fetch order')) { 
             return jsonErrorResponse(404, `Order with ID ${idNum} not found.`);
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

    let payload: Partial<Pick<Order, 'status' | 'page_count' | 'total_price' | 'translated_file_url'>>; 
    try {
        payload = await request.json();
    } catch (e) {
        return jsonErrorResponse(400, "Invalid JSON body.");
    }

    const updateData: Partial<Order> = {};
    const allowedFields: (keyof typeof payload)[] = ['status', 'page_count', 'total_price', 'translated_file_url'];
    let hasValidUpdate = false;

    for (const key of allowedFields) {
        if (payload[key] !== undefined) {

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

        const { data: updatedOrderData, error: updateError } = await supabaseAdmin
            .from("orders")
            .update(updateData)
            .eq("id", idNum)
            .select() 
            .single();

        handleSupabaseError(updateError, `update order ${idNum} (admin service)`);

        if (!updatedOrderData) {
             console.error(`API Logic Error: Order ${idNum} not found after PATCH reported success.`);
             return jsonErrorResponse(404, `Order with ID ${idNum} could not be found after update attempt.`);
        }

        console.log(`API Route: Updated order ${idNum}. Generating signed URLs for updated data...`);

        const uploadedFilesInfoPromises = (updatedOrderData.uploaded_file_urls || [])
            .map((path: string) => createSignedUrlForPath(path));

        const [
            uploadedFilesInfoResults,
            certificateInfoResult,
            translatedFileInfoResult
        ] = await Promise.all([
            Promise.all(uploadedFilesInfoPromises),
            createSignedUrlForPath(updatedOrderData.certificate_url),
            createSignedUrlForPath(updatedOrderData.translated_file_url), 
        ]);

        const validUploadedFilesInfo = uploadedFilesInfoResults.filter(info => info !== null) as SignedFileInfo[];

        const responseData = {
            ...updatedOrderData, 
            uploaded_files_info: validUploadedFilesInfo,
            certificate_info: certificateInfoResult,
            translated_file_info: translatedFileInfoResult,
            uploaded_file_urls: undefined,
            certificate_url: undefined,
            translated_file_url: undefined,
        };

        console.log(`API Route: Updated order ${idNum} successfully. Returning enhanced data.`);
        return jsonResponse(200, responseData); 

    } catch (error: any) {
        console.error(`API Error (PATCH /api/admin/orders/${orderId} with service client):`, error.message);
         if (error.code === 'PGRST116' || error.message.includes('update order')) {
             return jsonErrorResponse(404, `Order with ID ${idNum} not found when attempting update.`);
         }
        return jsonErrorResponse(500, `Failed to update order ${idNum}: ${error.message}`);
    }
};