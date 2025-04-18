import type { APIRoute, APIContext } from "astro";
import { supabase } from "../../../lib/supabase"; 
import { createOrder } from "../../../services/order.service";
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';
import { sanitizeFilename } from "../../../utils/filenameUtils"; 
import { generateStoragePath } from "../../../utils/storageUtils"; 
import { PACKAGE_MAP, STORAGE_BUCKET } from "../../../utils/constants"; 

interface ValidatedFormData {
    ordererName: string;
    phone?: string;
    packageSliderValue: string; 
    isDisadvantaged: boolean;
    isSchool: boolean;
    turnstileToken: string;
    orderFiles: File[];
    certificateFile: File | null;
}

async function _parseAndValidateFormData(formData: FormData): Promise<ValidatedFormData | Response> {
    try {
        const ordererName = formData.get("orderer_name")?.toString().trim();
        const phone = formData.get("phone")?.toString().trim() || undefined;
        const packageSliderValue = formData.get("package_tier_value")?.toString(); 
        const isDisadvantaged = formData.get("is_disadvantaged") === "on";
        const isSchool = formData.get("is_school") === "on";
        const turnstileToken = formData.get("cf-turnstile-response")?.toString();
        const orderFiles = formData.getAll("order_files") as File[];
        const certificateFile = formData.get("certificate_file") as File | null;

        if (!ordererName) return jsonErrorResponse(400, "Bad Request: Orderer name is required.");

        if (!packageSliderValue || !PACKAGE_MAP[packageSliderValue]) return jsonErrorResponse(400, "Bad Request: Invalid or missing package selection.");
        if (!turnstileToken) return jsonErrorResponse(400, "Bad Request: CAPTCHA token is missing.");

        const validOrderFiles = orderFiles.filter(f => f && f instanceof File && f.size > 0);
        if (validOrderFiles.length === 0) return jsonErrorResponse(400, "Bad Request: At least one main document file is required.");

        const validCertificateFile = (certificateFile && certificateFile instanceof File && certificateFile.size > 0) ? certificateFile : null;
        if (isDisadvantaged && !validCertificateFile) return jsonErrorResponse(400, "Bad Request: Certificate of indigence is required when economic disadvantage is checked.");
        if (!isDisadvantaged && validCertificateFile) console.warn("API Warning: Certificate file provided but disadvantage checkbox not checked. Ignoring certificate.");

        return {
            ordererName,
            phone,
            packageSliderValue, 
            isDisadvantaged,
            isSchool,
            turnstileToken,
            orderFiles: validOrderFiles,
            certificateFile: isDisadvantaged ? validCertificateFile : null 
        };
    } catch (error: any) {
        console.error("API Error: Unexpected error during FormData parsing.", error);
        return jsonErrorResponse(500, "Server Error: Failed to process form data.");
    }
}

interface UploadResult {
    uploadedFilePaths: string[];
    certificatePath?: string;
}

async function _uploadFilesToStorage(
    userId: string,
    orderFiles: File[],
    certificateFile: File | null
): Promise<UploadResult> {
    const uploadedFilePaths: string[] = [];
    let certificatePath: string | undefined = undefined;

    console.log(`API Route: Uploading ${orderFiles.length} main document(s) for user ${userId}...`);
    try {
        const uploadPromises = orderFiles.map(async (file) => {

            const filePath = generateStoragePath({
                userId: userId,
                filename: file.name,
                type: 'original'
            });

            console.log(`API Route: Uploading ${file.name} to bucket '${STORAGE_BUCKET}' at path ${filePath}`);

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file);

            if (uploadError) {
                console.error(`API Error: Failed to upload ${file.name}. Error:`, uploadError);

                throw new Error(`Server Error: Failed to upload file '${file.name}'. ${uploadError.message}`);
            }
            console.log(`API Route: Successfully uploaded ${file.name} to ${filePath}`);
            return filePath; 
        });

        const mainFilePaths = await Promise.all(uploadPromises);
        uploadedFilePaths.push(...mainFilePaths);

        if (certificateFile) {
            console.log("API Route: Uploading certificate file...");

            const certFilePath = generateStoragePath({
                userId: userId,
                filename: certificateFile.name,
                type: 'certificate'
            });

            console.log(`API Route: Uploading ${certificateFile.name} to bucket '${STORAGE_BUCKET}' at path ${certFilePath}`);

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

        console.error("API Error: Error during file upload process.", error);

        if (error.message.startsWith("Server Error:")) {
            throw error; 
        } else {
            throw new Error(`Server Error: An unexpected error occurred during file processing. ${error.message}`);
        }
    }
}

export const POST: APIRoute = async ({ request, locals, clientAddress }: APIContext) => {
    console.log("API Route: POST /api/orders/create invoked.");

    const userId = locals.userId;
    if (!userId) {

        console.warn("API Warning: User ID missing in locals for protected route /api/orders/create.");
        return jsonErrorResponse(401, "Unauthorized.");
    }
    console.log(`API Route: User authenticated via middleware. User ID: ${userId}`);

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch (error: any) {
        console.error("API Error: Failed to parse FormData.", error);
        return jsonErrorResponse(400, "Bad Request: Invalid form data.");
    }

    const validationResult = await _parseAndValidateFormData(formData);
    if (validationResult instanceof Response) {
        return validationResult; 
    }

    const {
        ordererName, phone, packageSliderValue, isDisadvantaged, isSchool,
        turnstileToken, orderFiles, certificateFile
    } = validationResult;

    const packageTier = PACKAGE_MAP[packageSliderValue];

    try {
        console.log("API Route: Verifying Turnstile token...");

        const forwardedIp = request.headers.get('x-nf-client-connection-ip'); 
        const cfConnectingIp = request.headers.get('cf-connecting-ip'); 
        const remoteIp = forwardedIp || cfConnectingIp || clientAddress; 
        if (!remoteIp) console.warn("API Warning: Could not determine client IP for Turnstile verification.");

        await verifyTurnstileToken(turnstileToken, remoteIp);
        console.log("API Route: Turnstile verification successful.");
    } catch (error: any) {
        console.warn("API Route: Turnstile verification failed.", error.message);

        if (error.message.startsWith("Server configuration error")) {
            return jsonErrorResponse(500, error.message); 
        }

        return jsonErrorResponse(403, `CAPTCHA verification failed: ${error.message}`);
    }

    let uploadResult: UploadResult;
    try {

        uploadResult = await _uploadFilesToStorage(userId, orderFiles, certificateFile);
    } catch (error: any) {

        return jsonErrorResponse(500, error.message);
    }

    try {
        console.log(`API Route: Calling createOrder service for user ${userId}...`);

        const newOrder = await createOrder(
            userId,
            ordererName,
            phone,
            packageTier, 
            isDisadvantaged,
            isSchool,
            uploadResult.uploadedFilePaths, 
            uploadResult.certificatePath, 
            undefined, 
            undefined  
        );

        console.log("API Route: Order created successfully in database:", newOrder.id);
        return jsonResponse(201, newOrder); 

    } catch (error: any) {

        console.error("API Error (POST /api/orders/create - Service Call):", error.message);

        if (error.message.startsWith("Validation Error:")) {

            console.error("Service Validation Error:", error.message);
            return jsonErrorResponse(400, `Bad Request: ${error.message}`); 
        }
        if (error.message.startsWith("Database Error:") || error.message.startsWith("Permission Denied:")) {

            console.error("Database or Permission Error during order creation:", error.message);

             return jsonErrorResponse(500, `Failed to save order details after uploading files. Please contact support. ${error.message}`);
        }

        return jsonErrorResponse(500, `An unexpected server error occurred while saving the order: ${error.message}`);
    }
};