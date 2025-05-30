export const ACCESS_TOKEN = "sb-access-token";
export const REFRESH_TOKEN = "sb-refresh-token";

export const CALLBACK_PATH = "/api/auth/callback";

export const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const STORAGE_BUCKET = 'documents'; 
export const SIGNED_URL_EXPIRES_IN = 3600; 


export interface PackageDetail {
  id: string; // e.g., "1", "2", "3"
  name: string; // "Basic", "Standard", "Premium"
  pricePerPage: number; // Price in smallest currency unit (e.g., IDR 50000)
  turnaroundDays: number; // e.g., 7, 3, 1
  description?: string; // Optional
}

export const PACKAGES_DETAILS: PackageDetail[] = [
  { id: "1", name: "Basic", pricePerPage: 50000, turnaroundDays: 7, description: "Most economical option." },
  { id: "2", name: "Standard", pricePerPage: 75000, turnaroundDays: 3, description: "Balanced speed and cost." },
  { id: "3", name: "Premium", pricePerPage: 100000, turnaroundDays: 1, description: "Fastest turnaround." },
];

export const PACKAGE_MAP: { [key: string]: string } = PACKAGES_DETAILS.reduce((acc, pkg) => {
  acc[pkg.id] = pkg.name;
  return acc;
}, {} as { [key: string]: string });

export const PACKAGES_DETAILS_MAP: Record<string, PackageDetail> = PACKAGES_DETAILS.reduce((acc, pkg) => {
  acc[pkg.id] = pkg;
  return acc;
}, {} as Record<string, PackageDetail>);