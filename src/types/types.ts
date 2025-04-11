// src/types/types.ts

// Existing GuestbookEntry type
export interface GuestbookEntry {
  name: string;
  message: string;
  // Consider adding id and created_at if you fetch/use them
  // id?: number | string;
  // created_at?: string;
}

// Updated Order type
export interface Order {
  id: number; // Or string if you use UUIDs
  user_id: string; // Foreign key to auth.users
  orderer_name: string;
  status: "pending" | "processing" | "completed" | "cancelled"; // Example statuses
  created_at: string; // ISO timestamp string
  phone?: string | null;
  package_tier?: string | null; // Text representation, e.g., "Basic", "Standard"
  page_count?: number | null; // Optional for now
  total_price?: number | null; // Optional for now, Assuming bigint maps to number safely for JS
  uploaded_file_urls?: string[] | null; // Array of storage paths/URLs for main documents
  is_disadvantaged: boolean; // ADDED
  is_school: boolean; // ADDED
  certificate_url?: string | null; // ADDED: Path/URL for the certificate file
  // Add any other relevant fields from your orders table
}

// FormSubmitOptions interface remains unchanged - but NOTE it won't be used by order.astro directly
export interface FormSubmitOptions {
  formElement: HTMLFormElement;
  statusElement: HTMLElement | null;
  submitButton: HTMLButtonElement | null;
  // Function to extract and validate data before sending
  // Returns null if validation fails and status should not proceed.
  preparePayload: () => Record<string, any> | null;
  // Callbacks for custom actions on success/error
  onSuccess: (data: any, formElement: HTMLFormElement) => void;
  onError: (error: Error, statusElement: HTMLElement | null) => void;
  // Optional: Use form's action/method by default if not provided
  endpoint?: string;
  method?: string;
  // Optional: Customize button text during submission
  submittingText?: string;
  submitText?: string; // Optional: Text to restore button to (defaults to initial text)
}