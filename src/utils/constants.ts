export const ACCESS_TOKEN = "sb-access-token";
export const REFRESH_TOKEN = "sb-refresh-token";

export const CALLBACK_PATH = "/api/auth/callback";

export const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const STORAGE_BUCKET = 'documents'; 
export const SIGNED_URL_EXPIRES_IN = 3600; 

export const PACKAGE_MAP: { [key: string]: string } = {
    "1": "Basic",
    "2": "Standard",
    "3": "Premium",
};