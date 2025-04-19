import type { APIContext } from 'astro';
import type { typeToFlattenedError } from 'zod';

const commonHeaders = {
    'Content-Type': 'application/json',
};

export function jsonResponse(status: number, data: any): Response {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: commonHeaders,
    });
}

export function jsonErrorResponse(status: number, messageOrZodError: string | typeToFlattenedError<any, string>): Response {
    let errorObj: any;
    if (typeof messageOrZodError === 'string') {
        errorObj = { error: messageOrZodError };
    } else {
        errorObj = { error: 'Validation error', details: messageOrZodError };
    }
    return new Response(JSON.stringify(errorObj), {
        status: status,
        headers: commonHeaders,
    });
}