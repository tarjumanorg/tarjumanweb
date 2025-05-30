import type { Order } from '../schemas/order.schema';
import type { SignedFileInfo } from '../schemas/order.schema';
import type { ApiOrderResponse as ClientApiOrderResponse } from "../utils/storageUtils";
import { displayStatus } from "./uiUtils";
import { UpdateOrderPayloadSchema } from '../schemas/order.schema';
import { setupFormSubmitListener } from './formHandler';
import type { FormSubmitOptions } from '../types/types';

type UpdatePayload = {
    status?: Order['status'] | null;
    page_count?: number | null;
    total_price?: number | null;
};

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

    const formData = new FormData(formElement);

    try {
        const response = await fetch(`/api/admin/orders/${orderId}/upload`, {
            method: 'POST',
            body: formData,
        });

        const result: ClientApiOrderResponse = await response.json();
        if (!response.ok) throw new Error((result as any).error || `HTTP error ${response.status}`);

        displayStatus(statusElement, 'File uploaded and order updated!', 'success');

        updateTranslatedFileDisplay(result.translated_file_info);

        formElement.reset();

    } catch (error) {
        console.error('Upload Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        displayStatus(statusElement, `Upload failed: ${errorMessage}`, 'error');
    }
}

export function setupOrderUpdateForm(
    formElement: HTMLFormElement,
    statusElement: HTMLElement | null,
    submitButton: HTMLButtonElement | null,
    updateTranslatedFileDisplay: (fileInfo: SignedFileInfo | undefined | null) => void
) {
    const orderId = formElement.dataset.orderId;
    if (!orderId) {
        console.error("Cannot setup update form listener: Missing data-order-id attribute on the form.");
        if (statusElement) {
            displayStatus(statusElement, "Form setup error: Missing Order ID.", "error");
        }
        return;
    }

    function preparePayload(): UpdatePayload | null {
        const formData = new FormData(formElement);
        const payload: UpdatePayload = {};
        const status = formData.get('status');
        const pageCountRaw = formData.get('page_count');
        const totalPriceRaw = formData.get('total_price');

        if (status !== null && status !== undefined) {
            if (status === "") {
                payload.status = null;
            } else {
                // Accept any status from the schema
                payload.status = status as Order['status'];
            }
        }
        if (pageCountRaw !== null && pageCountRaw !== '') {
            const pageCountNum = parseInt(pageCountRaw as string, 10);
            if (!isNaN(pageCountNum) && pageCountNum >= 0) payload.page_count = pageCountNum;
            else {
                if (statusElement) displayStatus(statusElement, 'Invalid page count (must be a non-negative number).', 'error');
                return null;
            }
        } else if (pageCountRaw === '') {
            payload.page_count = null;
        }
        if (totalPriceRaw !== null && totalPriceRaw !== '') {
            const totalPriceNum = parseInt(totalPriceRaw as string, 10);
            if (!isNaN(totalPriceNum) && totalPriceNum >= 0) payload.total_price = totalPriceNum;
            else {
                if (statusElement) displayStatus(statusElement, 'Invalid total price (must be a non-negative number).', 'error');
                return null;
            }
        } else if (totalPriceRaw === '') {
            payload.total_price = null;
        }

        if (Object.keys(payload).length === 0) {
            if (statusElement) displayStatus(statusElement, 'No changes detected to update.', 'info');
            return null;
        }

        const zodResult = UpdateOrderPayloadSchema.safeParse(payload);
        if (!zodResult.success) {
            const errorMessages = Object.values(zodResult.error.flatten().fieldErrors).flat().join(' ');
            if (statusElement) displayStatus(statusElement, `Validation error: ${errorMessages}`, 'error');
            return null;
        }

        console.log('Prepared update payload:', payload);
        return payload;
    }

    function onSuccess(result: ClientApiOrderResponse, formElement: HTMLFormElement) {
        if (statusElement) {
             displayStatus(statusElement, 'Order updated successfully!', 'success');
        }
        if (result.status !== undefined) (document.getElementById('status') as HTMLSelectElement).value = result.status ?? '';
        if (result.page_count !== undefined) (document.getElementById('page_count') as HTMLInputElement).value = result.page_count?.toString() ?? '';
        if (result.total_price !== undefined) (document.getElementById('total_price') as HTMLInputElement).value = result.total_price?.toString() ?? '';
        updateTranslatedFileDisplay(result.translated_file_info);
    }

    function onError(error: Error, statusElement: HTMLElement | null) {
         console.error('Update Error (via generic handler):', error);
         if (statusElement) {
             const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during update.';
             displayStatus(statusElement, `Update failed: ${errorMessage}`, 'error');
         }
    }

    const options: FormSubmitOptions = {
        formElement,
        statusElement,
        submitButton,
        preparePayload,
        onSuccess,
        onError,
        endpoint: `/api/admin/orders/${orderId}`,
        method: 'PATCH',
        submittingText: 'Updating...'
    };

    setupFormSubmitListener(options);
}