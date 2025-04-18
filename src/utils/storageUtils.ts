import { supabaseAdmin } from "../lib/supabaseAdmin";
import { SIGNED_URL_EXPIRES_IN, STORAGE_BUCKET } from "./constants";
import { extractFilename, sanitizeFilename, generateRandomSuffix } from "./filenameUtils";
import type { Order } from "../types/types"; 

export interface SignedFileInfo {
    path: string;
    filename: string | null;
    signedUrl: string | null;
}

export async function createSignedUrlForPath(path: string | null | undefined): Promise<SignedFileInfo | null> {
    if (!path) return null;

    const filename = extractFilename(path);
    try {
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`Storage Util Error: Failed to create signed URL for path "${path}":`, error.message);

            return { path, filename, signedUrl: null };
        }

        return { path, filename, signedUrl: data?.signedUrl || null };

    } catch (e: any) {
        console.error(`Storage Util Exception: Unexpected error signing URL for path "${path}":`, e.message);
        return { path, filename, signedUrl: null }; 
    }
}

export type ApiOrderResponse = Partial<Order> & {
    uploaded_files_info?: (SignedFileInfo | null)[]; 
    certificate_info?: SignedFileInfo | null;
    translated_file_info?: SignedFileInfo | null;

};

export async function enrichOrderWithSignedUrls(orderData: Order): Promise<ApiOrderResponse> {
     if (!orderData) {

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

    const responseData: ApiOrderResponse = {
        ...orderData,
        uploaded_files_info: uploadedFilesInfoResults, 
        certificate_info: certificateInfoResult,
        translated_file_info: translatedFileInfoResult,

        uploaded_file_urls: undefined,
        certificate_url: undefined,
        translated_file_url: undefined,
    };

    delete responseData.uploaded_file_urls;
    delete responseData.certificate_url;
    delete responseData.translated_file_url;

    return responseData;
}

interface GenerateStoragePathOptions {
    userId: string;
    filename: string;
    type: 'original' | 'certificate' | 'translation';
    orderId?: number | string; 
    timestamp?: number; 
}

export function generateStoragePath(options: GenerateStoragePathOptions): string {
    const { userId, filename, type, orderId, timestamp = Date.now() } = options;

    if (!userId || !filename) {
        throw new Error("generateStoragePath requires userId and filename.");
    }

    const sanitizedName = sanitizeFilename(filename);
    const randomSuffix = generateRandomSuffix();

    switch (type) {
        case 'original':

            return `${userId}/originals/${timestamp}-${randomSuffix}-${sanitizedName}`;
        case 'certificate':

            return `${userId}/certificates/${timestamp}-cert-${randomSuffix}-${sanitizedName}`;
        case 'translation':
            if (!orderId) {
                 throw new Error("generateStoragePath requires orderId for type 'translation'.");
            }

            return `${userId}/translations/order_${orderId}-${timestamp}-${randomSuffix}-${sanitizedName}`;
        default:

             console.warn(`generateStoragePath called with unknown type: ${type}. Using generic path.`);
             return `${userId}/uploads/${timestamp}-${randomSuffix}-${sanitizedName}`;
    }
}