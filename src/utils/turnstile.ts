import { TURNSTILE_VERIFY } from './constants'; 
import { jsonErrorResponse } from './apiResponse'; 

const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<void> {
    if (!TURNSTILE_SECRET_KEY) {
        console.error("Turnstile Verification Error: TURNSTILE_SECRET_KEY is not set.");

        throw new Error("Server configuration error: CAPTCHA secret missing.");
    }

    if (!token) {
         throw new Error("CAPTCHA token is missing."); 
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
        const verifyResponse = await fetch(TURNSTILE_VERIFY, {
            method: 'POST',
            body: verifyPayload,
        });

        if (!verifyResponse.ok) {

             throw new Error(`Turnstile endpoint returned status ${verifyResponse.status}`);
        }

        const verifyOutcome = await verifyResponse.json();
        console.log("Util: Turnstile verification outcome:", verifyOutcome);

        if (!verifyOutcome.success) {

            throw new Error(`Verification failed. Codes: ${(verifyOutcome['error-codes'] || []).join(', ')}`);
        }

        console.log("Util: Turnstile verification successful for hostname:", verifyOutcome.hostname);

    } catch (error: any) {
        console.error("Util Error: Exception during Turnstile verification fetch:", error);

        throw new Error(`Server error during CAPTCHA verification: ${error.message}`);
    }
}