// src/utils/turnstile.ts
import { TURNSTILE_VERIFY_ENDPOINT } from './constants'; // Assuming you move the constant here
import { jsonErrorResponse } from './apiResponse'; // Or just throw errors

const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;

/**
 * Verifies a Cloudflare Turnstile token.
 * Throws an error if verification fails or if the server is misconfigured.
 *
 * @param token - The `cf-turnstile-response` token from the client.
 * @param remoteIp - The client's IP address (optional but recommended).
 * @throws {Error} If the secret key is missing, the fetch fails, or verification is unsuccessful.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<void> {
    if (!TURNSTILE_SECRET_KEY) {
        console.error("Turnstile Verification Error: TURNSTILE_SECRET_KEY is not set.");
        // Throw an error that the API route can catch and translate to a 500
        throw new Error("Server configuration error: CAPTCHA secret missing.");
    }

    if (!token) {
         throw new Error("CAPTCHA token is missing."); // Or handle this validation earlier
    }

    console.log("Util: Verifying Turnstile token...");
    const verifyPayload = new URLSearchParams();
    verifyPayload.append('secret', TURNSTILE_SECRET_KEY);
    verifyPayload.append('response', token);

    if (remoteIp) {
        verifyPayload.append('remoteip', remoteIp);
        console.log("Util: Verifying Turnstile with remoteip:", remoteIp);
    } else {
        console.warn("Util: Verifying Turnstile without remoteip.");
    }

    try {
        const verifyResponse = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
            method: 'POST',
            body: verifyPayload,
        });

        if (!verifyResponse.ok) {
             // Handle non-2xx responses from Cloudflare endpoint
             throw new Error(`Turnstile endpoint returned status ${verifyResponse.status}`);
        }

        const verifyOutcome = await verifyResponse.json();
        console.log("Util: Turnstile verification outcome:", verifyOutcome);

        if (!verifyOutcome.success) {
            // Throw a specific error that the API route can catch
            throw new Error(`Verification failed. Codes: ${(verifyOutcome['error-codes'] || []).join(', ')}`);
        }

        console.log("Util: Turnstile verification successful for hostname:", verifyOutcome.hostname);
        // If successful, the function completes without returning anything (void)

    } catch (error: any) {
        console.error("Util Error: Exception during Turnstile verification fetch:", error);
        // Re-throw or throw a new standardized error
        throw new Error(`Server error during CAPTCHA verification: ${error.message}`);
    }
}