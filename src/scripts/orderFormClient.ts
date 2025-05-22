import { submitFormDataWithFiles } from "./formHandler"; 
import type { FormDataSubmitOptions } from "../types/types"; 

const form = document.getElementById("order-form") as HTMLFormElement | null;
const orderFilesInput = document.getElementById("order-files") as HTMLInputElement | null;
const nameInput = document.getElementById("orderer-name") as HTMLInputElement | null;
const phoneInput = document.getElementById("phone") as HTMLInputElement | null;
const packageSlider = document.getElementById("package-slider") as HTMLInputElement | null;
const packageDisplay = document.getElementById("selected-package-display") as HTMLSpanElement | null;
const disadvantageCheckbox = document.getElementById("is-disadvantaged") as HTMLInputElement | null;
const certificateContainer = document.getElementById("certificate-container") as HTMLDivElement | null;
const certificateInput = document.getElementById("certificate-file") as HTMLInputElement | null;
const schoolCheckbox = document.getElementById("is-school") as HTMLInputElement | null;
const submitButton = document.getElementById("submit-order-button") as HTMLButtonElement | null;
const statusDiv = document.getElementById("order-status") as HTMLElement | null;

let packageMap: { [key: string]: string } = { "1": "Basic", "2": "Standard", "3": "Premium" };
if (form?.dataset.packageMap) {
    try {
        packageMap = JSON.parse(form.dataset.packageMap);
    } catch (e) {
        console.error("Failed to parse package map data from form attribute:", e);
    }
} else {
    console.warn("Package map data attribute not found on form. Using default map.");
}

if (
    form &&
    orderFilesInput &&
    nameInput &&
    phoneInput &&
    packageSlider &&
    packageDisplay &&
    disadvantageCheckbox &&
    certificateContainer &&
    certificateInput &&
    schoolCheckbox &&
    submitButton &&
    statusDiv
) {

    packageSlider.addEventListener("input", () => {
        const selectedValue = packageSlider.value;
        packageDisplay.textContent = packageMap[selectedValue] || "Unknown";
    });
    packageDisplay.textContent = packageMap[packageSlider.value] || "Unknown";

    disadvantageCheckbox.addEventListener("change", () => {
        if (disadvantageCheckbox.checked) {
            certificateContainer.classList.remove("hidden");
            certificateInput.required = true;
        } else {
            certificateContainer.classList.add("hidden");
            certificateInput.required = false;
            certificateInput.value = "";
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault(); 

        // --- Turnstile presence check ---
        const turnstileWidget = document.querySelector('.cf-turnstile');
        if (!turnstileWidget) {
            statusDiv.textContent = "Verification failed to load. Please check your internet connection and refresh the page.";
            statusDiv.className = 'status-message status-error';
            return;
        }

        statusDiv.textContent = '';
        statusDiv.style.color = 'inherit';
        statusDiv.style.removeProperty('background-color');
        statusDiv.style.removeProperty('border');
        statusDiv.className = 'status-message'; 

        if (!orderFilesInput.files || orderFilesInput.files.length === 0 || Array.from(orderFilesInput.files).every(f => f.size === 0)) {
            statusDiv.textContent = "Please select at least one document file.";
            statusDiv.style.color = "red"; statusDiv.classList.add('status-error');
            orderFilesInput.focus();
            return;
        }
        if (disadvantageCheckbox.checked && (!certificateInput.files || certificateInput.files.length === 0 || certificateInput.files[0].size === 0)) {
            statusDiv.textContent = "Please upload proof for economic disadvantage.";
            statusDiv.style.color = "red"; statusDiv.classList.add('status-error');
            certificateInput.focus();
            return;
        }
        if (!nameInput.value.trim()) {
            statusDiv.textContent = "Please enter your name.";
            statusDiv.style.color = "red"; statusDiv.classList.add('status-error');
            nameInput.focus();
            return;
        }
        if (!phoneInput.value.trim()) {
            statusDiv.textContent = "Please enter your phone number.";
            statusDiv.style.color = "red"; statusDiv.classList.add('status-error');
            phoneInput.focus();
            return;
        }

        if (!submitButton.dataset.originalText) {
            submitButton.dataset.originalText = submitButton.textContent || 'Submit Order';
        }
        const originalButtonText = submitButton.dataset.originalText;

        submitButton.disabled = true;
        submitButton.textContent = "Initializing...";
        statusDiv.textContent = "Ensuring session...";
        statusDiv.classList.add('status-info'); 

        try {
            console.log("Attempting anonymous auth...");
            const authResponse = await fetch('/api/auth/anonymous', { method: "POST" });
            if (!authResponse.ok) {
                let errorMsg = `Authentication setup failed (${authResponse.status})`;
                try {
                    const errorData = await authResponse.json();
                    errorMsg = errorData?.error || errorMsg;
                } catch (e) {  }
                throw new Error(errorMsg); 
            }
            console.log("Anonymous session ensured successfully.");

            statusDiv.textContent = "";
            statusDiv.className = 'status-message';

        } catch (authError: any) {
            console.error("Anonymous auth error:", authError);
            statusDiv.textContent = `Error: ${authError.message || "Could not initialize session."}`;
            statusDiv.style.color = "red"; 
            statusDiv.className = 'status-message status-error'; 
            submitButton.disabled = false; 
            submitButton.textContent = originalButtonText;
            return; 
        }

        const onSuccessHandler = (data: any, formElement: HTMLFormElement) => {
            statusDiv.textContent = `Order submitted successfully! Order ID: ${data?.id || "[Unknown ID]"}`;
            statusDiv.className = 'status-message status-success'; 
            formElement.reset();

            if (packageSlider && packageDisplay) {
                packageSlider.value = "1";
                packageDisplay.textContent = packageMap[packageSlider.value] || "Unknown";
            }
            if (certificateContainer && certificateInput) {
                certificateContainer.classList.add("hidden");
                certificateInput.required = false;
            }

            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.textContent = "";
                    statusDiv.className = 'status-message'; 
                }
            }, 8000);
        };

        const onErrorHandler = (error: Error, statusElement: HTMLElement | null) => {
             if (!statusElement) return;
             let displayMessage = "An unexpected error occurred during submission.";

            if (error.message) {
                 if (error.message.includes("CAPTCHA verification failed")) {
                     displayMessage = "CAPTCHA verification failed. Please try again.";
                 } else if (error.message.includes("Bad Request:")) {
                     displayMessage = error.message.replace("Bad Request: ", "");
                 } else if (error.message.includes("Failed to upload file")) {
                     displayMessage = "Error uploading file. Please ensure files are valid and try again.";
                 } else if (error.message.includes("Server error:")) {
                     displayMessage = "Order submission failed due to a server issue. Please try again later or contact support.";
                 } else if (error.message.startsWith("Submission failed with status:")) {
                      displayMessage = "Order submission failed. Please check your input and try again.";
                 } else {

                     displayMessage = error.message;
                 }
            }
            statusElement.textContent = `Error: ${displayMessage}`;
            statusElement.className = 'status-message status-error'; 
        };

        const options: FormDataSubmitOptions = {
            formElement: form,
            statusElement: statusDiv,
            submitButton: submitButton,
            onSuccess: onSuccessHandler,
            onError: onErrorHandler,
            submittingText: "Uploading & Submitting...", 
        };

        await submitFormDataWithFiles(options);

    });

} else {

    console.error("Could not find all required elements for the order form script.", {  });
    const errorDisplay = statusDiv || document.getElementById("order-status");
    if (errorDisplay) {
        errorDisplay.textContent = "Error initializing the order form. Please refresh the page or contact support.";
        errorDisplay.style.color = "red";
        errorDisplay.className = 'status-message status-error';
    }
}