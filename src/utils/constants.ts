// src/utils/constants.ts
export const ACCESS_TOKEN = "sb-access-token";
export const REFRESH_TOKEN = "sb-refresh-token";

export const CALLBACK_PATH = "/api/auth/callback";

// Turnstile
export const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Supabase Storage
export const STORAGE_BUCKET = 'documents'; // Define your bucket name
export const SIGNED_URL_EXPIRES_IN = 3600; // 1 hour in seconds

// Order Packages
export const PACKAGE_MAP: { [key: string]: string } = {
    "1": "Basic",
    "2": "Standard",
    "3": "Premium",
};