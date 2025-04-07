// src/utils/apiResponse.ts
import type { APIContext } from 'astro';

const commonHeaders = {
    'Content-Type': 'application/json',
};

/**
 * Creates a standardized JSON success response.
 * @param status - HTTP status code (e.g., 200, 201).
 * @param data - The payload to be stringified and sent.
 * @returns A Response object.
 */
export function jsonResponse(status: number, data: any): Response {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: commonHeaders,
    });
}

/**
 * Creates a standardized JSON error response.
 * @param status - HTTP status code (e.g., 400, 401, 403, 404, 500).
 * @param message - The error message.
 * @returns A Response object with { error: message } payload.
 */
export function jsonErrorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: status,
        headers: commonHeaders,
    });
}

// Example of a more detailed error structure if needed in the future:
/*
export function jsonDetailedErrorResponse(status: number, message: string, details?: any): Response {
    return new Response(JSON.stringify({ error: { message, details } }), {
        status: status,
        headers: commonHeaders,
    });
}
*/