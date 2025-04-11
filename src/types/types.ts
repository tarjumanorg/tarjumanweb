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
  phone?: string | null; // ADDED: Optional phone field
  // Add any other relevant fields from your orders table based on schema
  page_count?: number | null;
  total_price?: number | null; // Assuming bigint maps to number safely for JS
  package_tier?: string | null;
  uploaded_file_urls?: any | null; // Use a more specific type if possible
}

// FormSubmitOptions interface remains unchanged
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