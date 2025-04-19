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