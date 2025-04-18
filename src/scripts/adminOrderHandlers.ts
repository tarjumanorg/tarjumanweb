import type { Order } from "../types/types";
import type { SignedFileInfo, ApiOrderResponse as ClientApiOrderResponse } from "../utils/storageUtils";
import { displayStatus } from "./uiUtils";

// Define the payload type used for updates
type UpdatePayload = {
    status?: Order['status'] | null;
    page_count?: number | null;
    total_price?: number | null;
};

/**
 * Handles the submission of the order update form.
 * @param event The form submit event.
 * @param formElement The update form HTML element.
 * @param statusElement The HTML element for displaying status messages.
 * @param updateTranslatedFileDisplay Function to update the translated file link display.
 */
export async function handleOrderUpdateSubmit(
    event: SubmitEvent,
    formElement: HTMLFormElement,
    statusElement: HTMLElement | null,
    updateTranslatedFileDisplay: (fileInfo: SignedFileInfo | undefined | null) => void
): Promise<void> {
    event.preventDefault();
    if (!statusElement) return;

    displayStatus(statusElement, 'Updating...', 'info');
    const orderId = formElement.dataset.orderId;
    if (!orderId) {
        displayStatus(statusElement, 'Error: Missing order ID.', 'error');
        return;
    }

    const formData = new FormData(formElement);
    const payload: UpdatePayload = {};

    // Extract and validate form data
    const status = formData.get('status');
    const pageCountRaw = formData.get('page_count');
    const totalPriceRaw = formData.get('total_price');

    // Status validation
    if (status !== null && status !== undefined) {
        if (status === "") {
            payload.status = null;
        } else if (["pending", "processing", "completed", "cancelled"].includes(status as string)) {
            payload.status = status as Order['status'];
        } else {
            displayStatus(statusElement, 'Invalid status value selected.', 'error');
            return;
        }
    }

    // Page Count validation
    if (pageCountRaw !== null && pageCountRaw !== '') {
        const pageCountNum = parseInt(pageCountRaw as string, 10);
        if (!isNaN(pageCountNum) && pageCountNum >= 0) payload.page_count = pageCountNum;
        else {
            displayStatus(statusElement, 'Invalid page count (must be a non-negative number).', 'error');
            return;
        }
    } else if (pageCountRaw === '') {
        payload.page_count = null; // Allow clearing
    }

    // Total Price validation
    if (totalPriceRaw !== null && totalPriceRaw !== '') {
        const totalPriceNum = parseInt(totalPriceRaw as string, 10); // Use parseInt for whole units
        if (!isNaN(totalPriceNum) && totalPriceNum >= 0) payload.total_price = totalPriceNum;
        else {
            displayStatus(statusElement, 'Invalid total price (must be a non-negative number).', 'error');
            return;
        }
    } else if (totalPriceRaw === '') {
        payload.total_price = null; // Allow clearing
    }

    // Check if anything changed
    if (Object.keys(payload).length === 0) {
        displayStatus(statusElement, 'No changes detected to update.', 'info');
        return;
    }

    console.log('Sending update payload:', payload);
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(payload),
        });

        const result: ClientApiOrderResponse = await response.json();
        if (!response.ok) throw new Error((result as any).error || `HTTP error ${response.status}`);

        displayStatus(statusElement, 'Order updated successfully!', 'success');

        // Update form fields with returned data
        if (result.status !== undefined) (document.getElementById('status') as HTMLSelectElement).value = result.status ?? '';
        if (result.page_count !== undefined) (document.getElementById('page_count') as HTMLInputElement).value = result.page_count?.toString() ?? '';
        if (result.total_price !== undefined) (document.getElementById('total_price') as HTMLInputElement).value = result.total_price?.toString() ?? '';

        // Update translated file display based on the response (important if PATCH returns full state)
        updateTranslatedFileDisplay(result.translated_file_info);

    } catch (error) {
        console.error('Update Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during update.';
        displayStatus(statusElement, `Update failed: ${errorMessage}`, 'error');
    }
}

/**
 * Handles the submission of the translated file upload form.
 * @param event The form submit event.
 * @param formElement The upload form HTML element.
 * @param statusElement The HTML element for displaying status messages.
 * @param fileInputElement The file input HTML element.
 * @param updateTranslatedFileDisplay Function to update the translated file link display.
 */
export async function handleTranslationUploadSubmit(
    event: SubmitEvent,
    formElement: HTMLFormElement,
    statusElement: HTMLElement | null,
    fileInputElement: HTMLInputElement | null,
    updateTranslatedFileDisplay: (fileInfo: SignedFileInfo | undefined | null) => void
): Promise<void> {
    event.preventDefault();
    if (!statusElement || !fileInputElement) return;

    displayStatus(statusElement, 'Uploading...', 'info');
    const orderId = formElement.dataset.orderId;
    if (!orderId) {
        displayStatus(statusElement, 'Error: Missing order ID.', 'error');
        return;
    }
    if (!fileInputElement.files || fileInputElement.files.length === 0 || fileInputElement.files[0].size === 0) {
         displayStatus(statusElement, 'Please select a file to upload.', 'error');
         return;
    }

    const formData = new FormData(formElement); // FormData automatically includes the file

    try {
        const response = await fetch(`/api/admin/orders/${orderId}/upload`, {
            method: 'POST',
            body: formData, // Send FormData directly
        });

        const result: ClientApiOrderResponse = await response.json();
        if (!response.ok) throw new Error((result as any).error || `HTTP error ${response.status}`);

        displayStatus(statusElement, 'File uploaded and order updated!', 'success');

        // Update the display for the translated file link
        updateTranslatedFileDisplay(result.translated_file_info);

        formElement.reset(); // Reset the upload form

    } catch (error) {
        console.error('Upload Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        displayStatus(statusElement, `Upload failed: ${errorMessage}`, 'error');
    }
}