// src/utils/formHandler.ts
import type { FormSubmitOptions } from '../types/types';

export async function submitFormData(options: FormSubmitOptions): Promise<void> {
  const {
    formElement, // Needed for reset on success
    statusElement,
    submitButton,
    preparePayload,
    onSuccess,
    onError,
    endpoint = formElement.action,
    method = formElement.method || 'POST',
    submittingText = 'Submitting...',
    submitText = submitButton?.dataset.originalText || 'Submit', // Use data attribute or default
  } = options;

  // Store original text if not already done
  if (submitButton && !submitButton.dataset.originalText) {
      submitButton.dataset.originalText = submitButton.textContent || 'Submit';
  }
  const originalButtonText = submitButton?.dataset.originalText || 'Submit';

  // Clear previous status
  if (statusElement) {
    statusElement.textContent = '';
    statusElement.style.color = 'inherit';
  }

  // Prepare payload - validation happens here
  const payload = preparePayload();
  if (payload === null) {
    // Validation failed, message should be handled by preparePayload/onError caller
    // Ensure button is re-enabled if it was disabled before this check
     if (submitButton && submitButton.disabled) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
     }
    return; // Exit early
  }

  // Manage UI state: Disable button
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

    let data;
    try {
      // Attempt to parse JSON, works even for errors if body is JSON
      data = await response.json();
    } catch (jsonError) {
      // Handle cases where response is not JSON (e.g., 500 HTML error page)
      if (!response.ok) {
        // Throw generic HTTP error if parsing failed on an error response
        throw new Error(`HTTP error! Status: ${response.status}, Response not JSON.`);
      }
      // If response was ok but not JSON, might be unexpected. Log and treat as success with no data.
      console.warn("Response was OK but not valid JSON.");
      data = null; // Success, but no data parsed
    }

    if (!response.ok) {
      // Use error message from parsed JSON body if available, otherwise default
      const errorMessage = data?.error || `HTTP error! Status: ${response.status}`;
      throw new Error(errorMessage);
    }

    // Call the success callback
    onSuccess(data, formElement);

  } catch (error: any) {
    console.error('Form submission error:', error);
    // Call the error callback
    onError(error, statusElement);
    // Note: error is not re-thrown here, allowing the flow to complete in finally.
    // The onError callback is responsible for user feedback.

  } finally {
    // Re-enable button and restore text in finally block to ensure it always happens
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

/**
 * Sets up a standard event listener for form submission that calls submitFormData.
 * Use this for simple forms without pre-submission steps like auth checks.
 * @param options - Configuration for the form submission.
 */
export function setupFormSubmitListener(options: FormSubmitOptions): void {
   const { formElement } = options;
   if (!formElement) {
       console.error('Form submission listener requires a formElement.');
       return;
   }

   formElement.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Directly call the async submission logic
        await submitFormData(options);
   });
}

/**
 * Helper function to reset a Cloudflare Turnstile widget within a given form.
 * @param formElement - The form containing the Turnstile widget.
 */
export function resetTurnstileWidget(formElement: HTMLFormElement | null): void {
    if (!formElement) return;
    try {
        // Find the widget using its class
        const widgetElement = formElement.querySelector<HTMLElement>('.cf-turnstile');
        if (widgetElement && typeof (window as any).turnstile?.reset === 'function') {
           (window as any).turnstile.reset(widgetElement);
           console.log("Turnstile widget reset.");
        }
    } catch (e) {
        console.warn("Could not reset Turnstile widget", e);
    }
}