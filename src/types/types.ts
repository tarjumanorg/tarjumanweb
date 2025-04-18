export interface GuestbookEntry {
  name: string;
  message: string;

}

export interface Order {
  id: number; 
  user_id: string; 
  orderer_name: string;
  status: "pending" | "processing" | "completed" | "cancelled"; 
  created_at: string; 
  phone?: string | null;
  package_tier?: string | null; 
  page_count?: number | null; 
  total_price?: number | null; 
  uploaded_file_urls?: string[] | null; 
  is_disadvantaged: boolean;
  is_school: boolean;
  certificate_url?: string | null;
  translated_file_url?: string | null; 

}

export interface FormSubmitOptions {
  formElement: HTMLFormElement;
  statusElement: HTMLElement | null;
  submitButton: HTMLButtonElement | null;

  preparePayload: () => Record<string, any> | null;

  onSuccess: (data: any, formElement: HTMLFormElement) => void;
  onError: (error: Error, statusElement: HTMLElement | null) => void;

  endpoint?: string;
  method?: string;

  submittingText?: string;
  submitText?: string; 
}