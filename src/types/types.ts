export interface JsonFormSubmitOptions {
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

export interface FormDataSubmitOptions {
  formElement: HTMLFormElement; 
  statusElement: HTMLElement | null;
  submitButton: HTMLButtonElement | null;

  onSuccess: (data: any, formElement: HTMLFormElement) => void;
  onError: (error: Error, statusElement: HTMLElement | null) => void;

  submittingText?: string; 
  submitText?: string; 
}

export type FormSubmitOptions = JsonFormSubmitOptions;