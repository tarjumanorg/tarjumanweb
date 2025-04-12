import type { FormSubmitOptions as SimpleFormSubmitOptions } from '../types/types'; 

export async function submitFormData(options: SimpleFormSubmitOptions): Promise<void> {
  const {
    formElement, 
    statusElement,
    submitButton,
    preparePayload,
    onSuccess,
    onError,
    endpoint = formElement.action,
    method = formElement.method || 'POST',
    submittingText = 'Submitting...',

  } = options;

  if (submitButton && !submitButton.dataset.originalText) {
    submitButton.dataset.originalText = submitButton.textContent || 'Submit';
  }

  const originalButtonText = submitButton?.dataset.originalText || 'Submit';

  if (statusElement) {
    statusElement.textContent = '';
    statusElement.style.color = 'inherit';
  }

  const payload = preparePayload();
  if (payload === null) {

    if (submitButton && submitButton.disabled) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
    return; 
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = submittingText;
  }

  try {
    const response = await fetch(endpoint, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data: any;
    try {

      data = await response.json();
    } catch (jsonError) {

      if (!response.ok) {

        throw new Error(`HTTP error! Status: ${response.status}, Response not JSON.`);
      }

      console.warn("Response was OK but not valid JSON.");
      data = null; 
    }

    if (!response.ok) {

      const errorMessage = data?.error || `HTTP error! Status: ${response.status}`;
      throw new Error(errorMessage);
    }

    onSuccess(data, formElement);

  } catch (error: any) {
    console.error('Form submission error:', error);

    onError(error, statusElement);

  } finally {

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

export function setupFormSubmitListener(options: SimpleFormSubmitOptions): void {
  const { formElement } = options;
  if (!formElement) {
    console.error('Form submission listener requires a formElement.');
    return;
  }

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault(); 
    await submitFormData(options); 
  });
}

export function resetTurnstileWidget(formElement: HTMLFormElement | null): void {
  if (!formElement) return;
  try {

    const widgetElement = formElement.querySelector<HTMLElement>('.cf-turnstile');

    if (widgetElement && typeof (window as any).turnstile?.reset === 'function') {
      (window as any).turnstile.reset(widgetElement); 
      console.log("Turnstile widget reset.");
    } else if (widgetElement) {

      console.warn("Turnstile widget found, but reset function is not available on window.turnstile.");
    }

  } catch (e) {

    console.warn("Could not reset Turnstile widget", e);
  }
}

export interface OrderFormSubmitOptions {
  formElement: HTMLFormElement;
  statusElement: HTMLElement | null;
  submitButton: HTMLButtonElement | null;

  authEndpoint?: string;

  onSuccess: (data: any, formElement: HTMLFormElement) => void;
  onError: (error: Error, statusElement: HTMLElement | null) => void;

  initializingText?: string;
  submittingText?: string;

}

export async function submitOrderForm(options: OrderFormSubmitOptions): Promise<void> {
  const {
    formElement,
    statusElement,
    submitButton,
    authEndpoint = '/api/auth/anonymous', 
    onSuccess,
    onError,
    initializingText = 'Initializing...',
    submittingText = 'Submitting Order...',
  } = options;

  if (!formElement || !submitButton || !statusElement) {
    console.error("submitOrderForm requires formElement, submitButton, and statusElement.");

    if (statusElement) {
      statusElement.textContent = "Form initialization error.";
      statusElement.style.color = "red";
    }
    return; 
  }

  if (!submitButton.dataset.originalText) {
    submitButton.dataset.originalText = submitButton.textContent || 'Submit Order';
  }
  const originalButtonText = submitButton.dataset.originalText; 

  statusElement.textContent = '';
  statusElement.style.color = 'inherit';

  submitButton.disabled = true;
  submitButton.textContent = initializingText;
  statusElement.textContent = "Ensuring session..."; 

  try {

    console.log(`Calling anonymous auth endpoint: ${authEndpoint}`);
    const authResponse = await fetch(authEndpoint, { method: "POST" });

    if (!authResponse.ok) {
      let errorMsg = `Authentication setup failed (${authResponse.status})`;
      try {

        const errorData = await authResponse.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {

        console.warn(`Auth response was not OK (${authResponse.status}) and not JSON.`);
      }

      throw new Error(errorMsg);
    }
    console.log("Anonymous session ensured successfully.");
    statusElement.textContent = "Preparing order..."; 

    const formData = new FormData(formElement);

    const apiEndpoint = formElement.action; 
    if (!apiEndpoint) {
      throw new Error("Form action attribute is missing or empty.");
    }
    console.log(`Submitting FormData to API endpoint: ${apiEndpoint}`);
    submitButton.textContent = submittingText; 
    statusElement.textContent = "Submitting order (this may take a moment)..."; 

    const response = await fetch(apiEndpoint, {
      method: "POST", 
      body: formData,

    });

    let responseData: any = null; 
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json(); 
      } else if (!response.ok) {

        const textResponse = await response.text();
        console.error(`Server error response (non-JSON): Status ${response.status}, Body: ${textResponse.substring(0, 500)}...`);

        throw new Error(`Server error: Status ${response.status}. Check server logs for details.`);
      } else {

        console.warn(`Response from ${apiEndpoint} was OK (${response.status}) but not JSON.`);

      }
    } catch (parseError: any) {

      console.error("Error processing server response:", parseError);
      if (!response.ok) {

        throw new Error(`Failed to process server error response: Status ${response.status}`);
      } else {

        throw new Error(`Failed to process successful server response: ${parseError.message || "Unknown processing error"}`);
      }
    }

    if (!response.ok) {

      const errorMessage = responseData?.error || `Submission failed with status: ${response.status}`;
      throw new Error(errorMessage);
    }

    console.log("Order form submitted successfully via helper.");
    onSuccess(responseData, formElement); 

  } catch (error: any) {

    console.error("Order submission process error:", error);

    onError(error, statusElement); 

  } finally {

    console.log("Resetting form UI state and Turnstile widget.");
    resetTurnstileWidget(formElement); 

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}