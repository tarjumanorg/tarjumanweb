// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase"; // Direct import for storage
import { createOrder } from "../../../services/order.service";
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';
import { sanitizeFilename } from "../../../utils/filenameUtils"; // Assuming you create this utility

// Helper function to generate a random suffix
const generateRandomSuffix = (length = 6) => Math.random().toString(36).substring(2, 2 + length);

// --- API Route Handler ---
export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  console.log("API Route: POST /api/orders/create invoked.");

  // --- Authentication Check (Middleware Guarantee) ---
  const userId = locals.userId!; // Asserting non-null based on middleware guarantee
  console.log(`API Route: User authenticated via middleware. User ID: ${userId}`);

  // --- FormData Parsing ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error: any) {
    console.error("API Error: Failed to parse FormData.", error);
    return jsonErrorResponse(400, "Bad Request: Invalid form data.");
  }

  // --- Data Extraction from FormData ---
  const ordererName = formData.get("orderer_name")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const packageSliderValue = formData.get("package_tier_value")?.toString(); // e.g., "1", "2"
  const isDisadvantaged = formData.get("is_disadvantaged") === "on"; // Checkbox value is 'on' when checked
  const isSchool = formData.get("is_school") === "on";
  const turnstileToken = formData.get("cf-turnstile-response")?.toString();
  const orderFiles = formData.getAll("order_files") as File[]; // Array of File objects
  const certificateFile = formData.get("certificate_file") as File | null; // Single File or null

  // --- Basic Validation ---
  if (!ordererName) {
    return jsonErrorResponse(400, "Bad Request: Orderer name is required.");
  }
  if (!packageSliderValue) {
    return jsonErrorResponse(400, "Bad Request: Package selection is required.");
  }
  if (!turnstileToken) {
    return jsonErrorResponse(400, "Bad Request: CAPTCHA token is missing.");
  }
  if (!orderFiles || orderFiles.length === 0 || orderFiles.some(f => f.size === 0)) {
     return jsonErrorResponse(400, "Bad Request: At least one main document file is required.");
  }
  if (isDisadvantaged && (!certificateFile || certificateFile.size === 0)) {
     return jsonErrorResponse(400, "Bad Request: Certificate of indigence is required when economic disadvantage is checked.");
  }
  if (!isDisadvantaged && certificateFile && certificateFile.size > 0) {
      console.warn("API Warning: Certificate file provided but disadvantage checkbox not checked. Ignoring certificate.");
      // Optionally clear certificateFile here if strict adherence is needed
  }


  // --- Map Slider Value to Tier Name (Example Mapping) ---
  const packageTiers: { [key: string]: string } = {
    "1": "Basic",
    "2": "Standard",
    "3": "Premium",
    // Add more tiers as needed
  };
  const packageTier = packageTiers[packageSliderValue];
  if (!packageTier) {
      return jsonErrorResponse(400, "Bad Request: Invalid package selection value.");
  }


  // --- Turnstile Verification ---
  try {
    console.log("API Route: Verifying Turnstile token...");
    const forwardedIp = request.headers.get('x-nf-client-connection-ip');
    const remoteIp = forwardedIp || clientAddress;
    await verifyTurnstileToken(turnstileToken, remoteIp);
    console.log("API Route: Turnstile verification successful.");
  } catch (error: any) {
    console.warn("API Route: Turnstile verification failed.", error.message);
    if (error.message.startsWith("Server configuration error")) {
        return jsonErrorResponse(500, error.message);
    }
    return jsonErrorResponse(403, `CAPTCHA verification failed: ${error.message}`);
  }

  // --- File Upload Logic (Upload First Strategy) ---
  const uploadedFilePaths: string[] = [];
  let certificatePath: string | undefined = undefined;
  const timestamp = Date.now();

  try {
    console.log(`API Route: Uploading ${orderFiles.length} main document(s)...`);
    for (const file of orderFiles) {
        if (file.size === 0) continue; // Skip empty file placeholders if any
        const sanitizedName = sanitizeFilename(file.name);
        const randomSuffix = generateRandomSuffix();
        const filePath = `${userId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

        console.log(`API Route: Uploading ${file.name} to ${filePath}`);
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) {
            console.error(`API Error: Failed to upload ${file.name}. Error:`, uploadError);
            // ABORT on first failure of a main document
            // Note: Files uploaded before this error are now orphaned.
            return jsonErrorResponse(500, `Server Error: Failed to upload file '${file.name}'. ${uploadError.message}`);
        }
        uploadedFilePaths.push(filePath);
        console.log(`API Route: Successfully uploaded ${file.name}`);
    }

    // Upload certificate file if applicable
    if (isDisadvantaged && certificateFile && certificateFile.size > 0) {
        console.log("API Route: Uploading certificate file...");
        const sanitizedName = sanitizeFilename(certificateFile.name);
        const randomSuffix = generateRandomSuffix();
        const certFilePath = `${userId}/${timestamp}-certificate-${randomSuffix}-${sanitizedName}`;

        console.log(`API Route: Uploading ${certificateFile.name} to ${certFilePath}`);
        const { error: certUploadError } = await supabase.storage
            .from("documents")
            .upload(certFilePath, certificateFile);

        if (certUploadError) {
             console.error(`API Error: Failed to upload certificate ${certificateFile.name}. Error:`, certUploadError);
             // Decide: Abort or continue without certificate? Let's abort for consistency.
             // Note: Main files uploaded before this are now orphaned.
             return jsonErrorResponse(500, `Server Error: Failed to upload certificate file '${certificateFile.name}'. ${certUploadError.message}`);
        }
        certificatePath = certFilePath;
        console.log(`API Route: Successfully uploaded certificate ${certificateFile.name}`);
    }

    console.log("API Route: All required file uploads completed successfully.");

  } catch (error: any) {
      // Catch any unexpected errors during the upload loops
      console.error("API Error: Unexpected error during file upload process.", error);
      return jsonErrorResponse(500, `Server Error: An unexpected error occurred during file processing. ${error.message}`);
  }


  // --- Database Interaction (Only if all uploads succeeded) ---
  try {
    console.log(`API Route: Calling createOrder service for user ${userId} with name ${ordererName}`);

    // Note: pageCount and totalPrice are undefined here as we aren't calculating them yet.
    const newOrder = await createOrder(
        userId,
        ordererName,
        phone,
        packageTier,
        isDisadvantaged,
        isSchool,
        uploadedFilePaths,
        certificatePath,
        undefined, // pageCount - deferred
        undefined  // totalPrice - deferred
    );

    console.log("API Route: Order created successfully in database:", newOrder.id);
    return jsonResponse(201, newOrder); // Return the created order object

  } catch (error: any) {
    // Handle errors from the createOrder service (validation, DB errors)
    console.error("API Error (POST /api/orders/create - Service Call):", error.message);
    // Note: Files are already uploaded and potentially orphaned if DB insert fails.
    if (error.message.startsWith("Validation Error:")) {
        return jsonErrorResponse(400, error.message);
    }
    if (error.message.startsWith("Database Error:")) {
         return jsonErrorResponse(500, "Failed to save order details after uploading files.");
    }
    // Catch specific DB constraint errors if needed (e.g., duplicate order check)
    return jsonErrorResponse(500, `An unexpected server error occurred while saving the order: ${error.message}`);
  }
};