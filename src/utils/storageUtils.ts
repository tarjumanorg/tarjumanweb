// src/utils/storageUtils.ts
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { SIGNED_URL_EXPIRES_IN, STORAGE_BUCKET } from "./constants";
import { extractFilename, sanitizeFilename, generateRandomSuffix } from "./filenameUtils";
import type { Order } from "../types/types"; // Assuming Order type might be useful

export interface SignedFileInfo {
    path: string;
    filename: string | null;
    signedUrl: string | null;
}

/**
 * Creates a signed URL for a given storage path.
 * Returns null if the path is empty.
 * Includes error handling for the signing process.
 */
export async function createSignedUrlForPath(path: string | null | undefined): Promise<SignedFileInfo | null> {
    if (!path) return null;

    const filename = extractFilename(path);
    try {
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`Storage Util Error: Failed to create signed URL for path "${path}":`, error.message);
            // Return info even if signing fails, indicating the issue
            return { path, filename, signedUrl: null };
        }
        // Ensure signedUrl is actually present in data
        return { path, filename, signedUrl: data?.signedUrl || null };

    } catch (e: any) {
        console.error(`Storage Util Exception: Unexpected error signing URL for path "${path}":`, e.message);
        return { path, filename, signedUrl: null }; // Indicate error
    }
}

// Interface for the API response structure often used
// Can be imported into API routes
export type ApiOrderResponse = Partial<Order> & {
    uploaded_files_info?: (SignedFileInfo | null)[]; // Allow null if signing fails for individual files
    certificate_info?: SignedFileInfo | null;
    translated_file_info?: SignedFileInfo | null;
    // Ensure original URL fields are excluded if needed, done in calling function
};

/**
 * Takes raw order data and enriches it with signed URLs for associated files.
 * Removes the original URL fields.
 */
export async function enrichOrderWithSignedUrls(orderData: Order): Promise<ApiOrderResponse> {
     if (!orderData) {
        // Should not happen if called correctly, but prevents runtime errors
        console.error("enrichOrderWithSignedUrls called with null/undefined orderData");
        return {};
     }

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

    // Prepare the response, spreading orderData first
    const responseData: ApiOrderResponse = {
        ...orderData,
        uploaded_files_info: uploadedFilesInfoResults, // Keep results as is (including potential nulls)
        certificate_info: certificateInfoResult,
        translated_file_info: translatedFileInfoResult,
        // Explicitly remove the raw URL fields from the response
        uploaded_file_urls: undefined,
        certificate_url: undefined,
        translated_file_url: undefined,
    };

    // Clean up undefined URL fields that were set to undefined
    delete responseData.uploaded_file_urls;
    delete responseData.certificate_url;
    delete responseData.translated_file_url;

    return responseData;
}


interface GenerateStoragePathOptions {
    userId: string;
    filename: string;
    type: 'original' | 'certificate' | 'translation';
    orderId?: number | string; // Optional, used for translations
    timestamp?: number; // Optional, defaults to Date.now()
}

/**
 * Generates a consistent storage path for uploaded files based on type and context.
 */
export function generateStoragePath(options: GenerateStoragePathOptions): string {
    const { userId, filename, type, orderId, timestamp = Date.now() } = options;

    if (!userId || !filename) {
        throw new Error("generateStoragePath requires userId and filename.");
    }

    const sanitizedName = sanitizeFilename(filename);
    const randomSuffix = generateRandomSuffix();

    switch (type) {
        case 'original':
            // Example: user_id/originals/1678886400000-aBcDeF-document.pdf
            return `${userId}/originals/${timestamp}-${randomSuffix}-${sanitizedName}`;
        case 'certificate':
             // Example: user_id/certificates/1678886400000-GhIjKl-certificate.pdf
            return `${userId}/certificates/${timestamp}-cert-${randomSuffix}-${sanitizedName}`;
        case 'translation':
            if (!orderId) {
                 throw new Error("generateStoragePath requires orderId for type 'translation'.");
            }
            // Example: user_id/translations/order_123-1678886400000-MnOpQr-translated_doc.pdf
            return `${userId}/translations/order_${orderId}-${timestamp}-${randomSuffix}-${sanitizedName}`;
        default:
            // Fallback or throw error for unknown type
             console.warn(`generateStoragePath called with unknown type: ${type}. Using generic path.`);
             return `${userId}/uploads/${timestamp}-${randomSuffix}-${sanitizedName}`;
    }
}