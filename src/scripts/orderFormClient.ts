// src/scripts/orderFormClient.ts
import { submitOrderForm } from "./formHandler"; // Adjust path if needed
import type { OrderFormSubmitOptions } from "./formHandler"; // Adjust path if needed

// Get form elements
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

// --- Retrieve and Parse Package Map ---
let packageMap: { [key: string]: string } = { "1": "Basic", "2": "Standard", "3": "Premium" }; // Provide a fallback default
if (form?.dataset.packageMap) {
    try {
        packageMap = JSON.parse(form.dataset.packageMap);
    } catch (e) {
        console.error("Failed to parse package map data from form attribute:", e);
        // Using fallback map defined above
    }
} else {
    console.warn("Package map data attribute not found on form. Using default map.");
    // Using fallback map defined above
}
// ------------------------------------

// Check if all essential elements are found
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
    // --- Event Listeners ---

    // Update package display when slider changes
    packageSlider.addEventListener("input", () => {
        const selectedValue = packageSlider.value;
        packageDisplay.textContent = packageMap[selectedValue] || "Unknown";
    });
    // Initialize display based on default value
    packageDisplay.textContent = packageMap[packageSlider.value] || "Unknown";

    // Show/hide certificate upload and set required attribute
    disadvantageCheckbox.addEventListener("change", () => {
        if (disadvantageCheckbox.checked) {
            certificateContainer.classList.remove("hidden");
            certificateInput.required = true; // Make required only when checked
        } else {
            certificateContainer.classList.add("hidden");
            certificateInput.required = false; // Remove required
            certificateInput.value = ""; // Clear the file input if unchecked
        }
    });

    // --- Form Submission Logic ---
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); // Prevent default form submission

        // Basic client-side validation (complementary to server-side)
        statusDiv.textContent = ''; // Clear previous status
        statusDiv.style.color = 'inherit';
        statusDiv.style.removeProperty('background-color');
        statusDiv.style.removeProperty('border');


        if (!orderFilesInput.files || orderFilesInput.files.length === 0 || Array.from(orderFilesInput.files).every(f => f.size === 0)) {
            statusDiv.textContent = "Please select at least one document file.";
            statusDiv.style.color = "red";
            orderFilesInput.focus();
            return;
        }
        if (disadvantageCheckbox.checked && (!certificateInput.files || certificateInput.files.length === 0 || certificateInput.files[0].size === 0)) {
            statusDiv.textContent = "Please upload proof for economic disadvantage.";
            statusDiv.style.color = "red";
            certificateInput.focus();
            return;
        }
        if (!nameInput.value.trim()) {
            statusDiv.textContent = "Please enter your name.";
            statusDiv.style.color = "red";
            nameInput.focus();
            return;
        }
        if (!phoneInput.value.trim()) {
            // Basic check, server validates format
            statusDiv.textContent = "Please enter your phone number.";
            statusDiv.style.color = "red";
            phoneInput.focus();
            return;
        }
        // Add more client-side checks if needed (e.g., file types, sizes)

        // --- Call the Form Handler ---

        // Success callback
        const onSuccessHandler = (data: any, formElement: HTMLFormElement) => {
            if (statusDiv) {
                // Display success message from server or a generic one
                statusDiv.textContent = `Order submitted successfully! Order ID: ${data?.id || "[Unknown ID]"}`;
                statusDiv.style.color = "green";
                // Apply success styles if needed (using the style block ones)
                statusDiv.style.backgroundColor = "#d4edda";
                statusDiv.style.borderColor = "#c3e6cb";
            }
            formElement.reset(); // Reset the form fields

            // Reset UI elements to default state after successful submission
            if (packageSlider && packageDisplay) {
                packageSlider.value = "1"; // Reset slider to default
                packageDisplay.textContent = packageMap[packageSlider.value] || "Unknown"; // Reset display
            }
            if (certificateContainer && certificateInput) {
                certificateContainer.classList.add("hidden"); // Hide certificate section
                certificateInput.required = false; // Ensure not required
            }
            // Optionally clear status after a delay
            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.textContent = "";
                    statusDiv.style.color = 'inherit'; // Reset color
                    statusDiv.style.removeProperty('background-color');
                    statusDiv.style.removeProperty('border');
                }
            }, 8000); // 8 seconds
        };

        // Error callback
        const onErrorHandler = (error: Error, statusElement: HTMLElement | null) => {
            if (statusElement) {
                let displayMessage = "An unexpected error occurred during submission.";
                // Try to get a more specific message
                if (error.message) {
                    // Basic filtering for common user-facing errors
                    if (error.message.includes("CAPTCHA verification failed")) {
                        displayMessage = "CAPTCHA verification failed. Please try again.";
                    } else if (error.message.includes("Bad Request:")) {
                        displayMessage = error.message.replace("Bad Request: ", ""); // Show validation message
                    } else if (error.message.includes("Failed to upload file")) {
                        displayMessage = "Error uploading file. Please ensure files are valid and try again.";
                    } else {
                        // Generic for other errors (e.g., 500)
                        displayMessage = "Order submission failed. Please try again later or contact support.";
                    }
                }

                statusElement.textContent = `Error: ${displayMessage}`;
                statusElement.style.color = "red";
                // Apply error styles if needed (using the style block ones)
                statusElement.style.backgroundColor = "#f8d7da";
                statusElement.style.borderColor = "#f5c6cb";
            }
        };

        // Options for the form submission helper
        const options: OrderFormSubmitOptions = {
            formElement: form,
            statusElement: statusDiv,
            submitButton: submitButton,
            onSuccess: onSuccessHandler,
            onError: onErrorHandler,
            // Optional: Customize texts if needed
            // initializingText: 'Preparing...',
            // submittingText: 'Sending Order...',
        };

        // Call the helper function from formHandler.ts
        await submitOrderForm(options);
    });

} else {
    // Log detailed error if elements are missing
    console.error("Could not find all required elements for the order form script. Check element IDs and ensure they exist in the HTML.", {
        form: !!form, orderFilesInput: !!orderFilesInput, nameInput: !!nameInput, phoneInput: !!phoneInput,
        packageSlider: !!packageSlider, packageDisplay: !!packageDisplay, disadvantageCheckbox: !!disadvantageCheckbox,
        certificateContainer: !!certificateContainer, certificateInput: !!certificateInput, schoolCheckbox: !!schoolCheckbox,
        submitButton: !!submitButton, statusDiv: !!statusDiv
    });
    // Display error to user if possible
    const errorDisplay = statusDiv || document.getElementById("order-status"); // Try again just in case
    if (errorDisplay) {
        errorDisplay.textContent = "Error initializing the order form. Please refresh the page or contact support.";
        errorDisplay.style.color = "red";
         errorDisplay.style.backgroundColor = "#f8d7da"; // Error background
         errorDisplay.style.borderColor = "#f5c6cb"; // Error border
    }
}