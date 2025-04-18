import type { APIRoute, APIContext } from "astro";
import { supabase } from "../../../lib/supabase"; // Use non-admin client for user uploads
import { createOrder } from "../../../services/order.service";
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';
import { sanitizeFilename } from "../../../utils/filenameUtils"; // Only need sanitize
import { generateStoragePath } from "../../../utils/storageUtils"; // Import path generator
import { PACKAGE_MAP, STORAGE_BUCKET } from "../../../utils/constants"; // Import constants

// No longer need local generateRandomSuffix or packageTiers

// Interface for validated data remains the same
interface ValidatedFormData {
    ordererName: string;
    phone?: string;
    packageSliderValue: string; // Keep the raw slider value
    isDisadvantaged: boolean;
    isSchool: boolean;
    turnstileToken: string;
    orderFiles: File[];
    certificateFile: File | null;
}

// Validation function updated to use PACKAGE_MAP
async function _parseAndValidateFormData(formData: FormData): Promise<ValidatedFormData | Response> {
    try {
        const ordererName = formData.get("orderer_name")?.toString().trim();
        const phone = formData.get("phone")?.toString().trim() || undefined;
        const packageSliderValue = formData.get("package_tier_value")?.toString(); // Get slider value '1', '2', '3'
        const isDisadvantaged = formData.get("is_disadvantaged") === "on";
        const isSchool = formData.get("is_school") === "on";
        const turnstileToken = formData.get("cf-turnstile-response")?.toString();
        const orderFiles = formData.getAll("order_files") as File[];
        const certificateFile = formData.get("certificate_file") as File | null;

        // Basic presence checks
        if (!ordererName) return jsonErrorResponse(400, "Bad Request: Orderer name is required.");
        // Use PACKAGE_MAP from constants to validate slider value
        if (!packageSliderValue || !PACKAGE_MAP[packageSliderValue]) return jsonErrorResponse(400, "Bad Request: Invalid or missing package selection.");
        if (!turnstileToken) return jsonErrorResponse(400, "Bad Request: CAPTCHA token is missing.");

        // File checks
        const validOrderFiles = orderFiles.filter(f => f && f instanceof File && f.size > 0);
        if (validOrderFiles.length === 0) return jsonErrorResponse(400, "Bad Request: At least one main document file is required.");

        const validCertificateFile = (certificateFile && certificateFile instanceof File && certificateFile.size > 0) ? certificateFile : null;
        if (isDisadvantaged && !validCertificateFile) return jsonErrorResponse(400, "Bad Request: Certificate of indigence is required when economic disadvantage is checked.");
        if (!isDisadvantaged && validCertificateFile) console.warn("API Warning: Certificate file provided but disadvantage checkbox not checked. Ignoring certificate.");

        return {
            ordererName,
            phone,
            packageSliderValue, // Return the numeric value
            isDisadvantaged,
            isSchool,
            turnstileToken,
            orderFiles: validOrderFiles,
            certificateFile: isDisadvantaged ? validCertificateFile : null // Only include if disadvantaged
        };
    } catch (error: any) {
        console.error("API Error: Unexpected error during FormData parsing.", error);
        return jsonErrorResponse(500, "Server Error: Failed to process form data.");
    }
}

// Interface for upload result remains the same
interface UploadResult {
    uploadedFilePaths: string[];
    certificatePath?: string;
}

// Upload function updated to use generateStoragePath utility
async function _uploadFilesToStorage(
    userId: string,
    orderFiles: File[],
    certificateFile: File | null
): Promise<UploadResult> {
    const uploadedFilePaths: string[] = [];
    let certificatePath: string | undefined = undefined;
    // STORAGE_BUCKET is imported from constants

    console.log(`API Route: Uploading ${orderFiles.length} main document(s) for user ${userId}...`);
    try {
        const uploadPromises = orderFiles.map(async (file) => {
            // Use utility to generate path
            const filePath = generateStoragePath({
                userId: userId,
                filename: file.name,
                type: 'original'
            });

            console.log(`API Route: Uploading ${file.name} to bucket '${STORAGE_BUCKET}' at path ${filePath}`);
            // Use the standard supabase client (non-admin) for user uploads respecting RLS
            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file);

            if (uploadError) {
                console.error(`API Error: Failed to upload ${file.name}. Error:`, uploadError);
                // Check for specific errors if needed (e.g., duplicate file path if policy allows update)
                throw new Error(`Server Error: Failed to upload file '${file.name}'. ${uploadError.message}`);
            }
            console.log(`API Route: Successfully uploaded ${file.name} to ${filePath}`);
            return filePath; // Return the path on success
        });

        // Execute all main file uploads in parallel
        const mainFilePaths = await Promise.all(uploadPromises);
        uploadedFilePaths.push(...mainFilePaths);

        // Upload certificate if present
        if (certificateFile) {
            console.log("API Route: Uploading certificate file...");
             // Use utility to generate path
            const certFilePath = generateStoragePath({
                userId: userId,
                filename: certificateFile.name,
                type: 'certificate'
            });

            console.log(`API Route: Uploading ${certificateFile.name} to bucket '${STORAGE_BUCKET}' at path ${certFilePath}`);
            // Use the standard supabase client
            const { error: certUploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(certFilePath, certificateFile);

            if (certUploadError) {
                console.error(`API Error: Failed to upload certificate ${certificateFile.name}. Error:`, certUploadError);
                throw new Error(`Server Error: Failed to upload certificate file '${certificateFile.name}'. ${certUploadError.message}`);
            }
            certificatePath = certFilePath;
            console.log(`API Route: Successfully uploaded certificate ${certificateFile.name}`);
        }

        console.log("API Route: All required file uploads completed successfully.");
        return { uploadedFilePaths, certificatePath };

    } catch (error: any) {
        // Catch errors from Promise.all or certificate upload
        console.error("API Error: Error during file upload process.", error);
        // Rethrow specific error messages or a generic one
        if (error.message.startsWith("Server Error:")) {
            throw error; // Propagate specific upload errors
        } else {
            throw new Error(`Server Error: An unexpected error occurred during file processing. ${error.message}`);
        }
    }
}

// Main POST handler
export const POST: APIRoute = async ({ request, locals, clientAddress }: APIContext) => {
    console.log("API Route: POST /api/orders/create invoked.");

    const userId = locals.userId;
    if (!userId) {
        // Middleware should handle this, but double-check
        console.warn("API Warning: User ID missing in locals for protected route /api/orders/create.");
        return jsonErrorResponse(401, "Unauthorized.");
    }
    console.log(`API Route: User authenticated via middleware. User ID: ${userId}`);

    // 1. Parse FormData
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch (error: any) {
        console.error("API Error: Failed to parse FormData.", error);
        return jsonErrorResponse(400, "Bad Request: Invalid form data.");
    }

    // 2. Validate FormData
    const validationResult = await _parseAndValidateFormData(formData);
    if (validationResult instanceof Response) {
        return validationResult; // Return error response if validation failed
    }

    const {
        ordererName, phone, packageSliderValue, isDisadvantaged, isSchool,
        turnstileToken, orderFiles, certificateFile
    } = validationResult;

    // Get package name from the validated slider value using the constant map
    const packageTier = PACKAGE_MAP[packageSliderValue];

    // 3. Verify Turnstile Token
    try {
        console.log("API Route: Verifying Turnstile token...");
        // Get client IP (best effort)
        const forwardedIp = request.headers.get('x-nf-client-connection-ip'); // Netlify specific
        const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare specific
        const remoteIp = forwardedIp || cfConnectingIp || clientAddress; // Fallback to Astro's clientAddress
        if (!remoteIp) console.warn("API Warning: Could not determine client IP for Turnstile verification.");

        await verifyTurnstileToken(turnstileToken, remoteIp);
        console.log("API Route: Turnstile verification successful.");
    } catch (error: any) {
        console.warn("API Route: Turnstile verification failed.", error.message);
        // Distinguish configuration errors from user errors
        if (error.message.startsWith("Server configuration error")) {
            return jsonErrorResponse(500, error.message); // Server issue
        }
        // User likely failed the challenge or token expired/invalid
        return jsonErrorResponse(403, `CAPTCHA verification failed: ${error.message}`);
    }

    // 4. Upload Files to Storage
    let uploadResult: UploadResult;
    try {
        // Pass validated files to the upload utility
        uploadResult = await _uploadFilesToStorage(userId, orderFiles, certificateFile);
    } catch (error: any) {
        // _uploadFilesToStorage throws specific errors, pass them along
        return jsonErrorResponse(500, error.message);
    }

    // 5. Create Order in Database via Service
    try {
        console.log(`API Route: Calling createOrder service for user ${userId}...`);

        const newOrder = await createOrder(
            userId,
            ordererName,
            phone,
            packageTier, // Pass the mapped package name
            isDisadvantaged,
            isSchool,
            uploadResult.uploadedFilePaths, // Pass the array of paths
            uploadResult.certificatePath, // Pass the single optional path
            undefined, // pageCount (not collected in this form)
            undefined  // totalPrice (not collected in this form)
        );

        console.log("API Route: Order created successfully in database:", newOrder.id);
        return jsonResponse(201, newOrder); // Return the created order data

    } catch (error: any) {
        // Handle errors from the createOrder service
        console.error("API Error (POST /api/orders/create - Service Call):", error.message);

        // Check for specific error types thrown by the service
        if (error.message.startsWith("Validation Error:")) {
            // This suggests an issue with data passed to the service, potentially a server-side logic error
            console.error("Service Validation Error:", error.message);
            return jsonErrorResponse(400, `Bad Request: ${error.message}`); // Or 500 if it's unexpected server-side validation
        }
        if (error.message.startsWith("Database Error:") || error.message.startsWith("Permission Denied:")) {
            // More critical error after uploads succeeded
            console.error("Database or Permission Error during order creation:", error.message);
            // Consider cleanup of uploaded files if possible (complex)
             return jsonErrorResponse(500, `Failed to save order details after uploading files. Please contact support. ${error.message}`);
        }
        // Generic fallback
        return jsonErrorResponse(500, `An unexpected server error occurred while saving the order: ${error.message}`);
    }
};