import type { APIContext } from 'astro';

const commonHeaders = {
    'Content-Type': 'application/json',
};

export function jsonResponse(status: number, data: any): Response {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: commonHeaders,
    });
}

export function jsonErrorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: status,
        headers: commonHeaders,
    });
}