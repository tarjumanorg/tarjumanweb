// src/scripts/uiUtils.ts

/**
 * Displays a status message in a designated HTML element with appropriate styling.
 * @param element The HTML element to display the message in.
 * @param message The message text. Pass null or empty string to clear.
 * @param type The type of message ('success', 'error', 'info', or 'clear' to reset).
 */
export function displayStatus(
    element: HTMLElement | null,
    message: string | null,
    type: 'success' | 'error' | 'info' | 'clear' = 'info'
): void {
    if (!element) return;

    if (!message || type === 'clear') {
        element.textContent = '';
        element.className = 'status-message'; // Reset class
        element.style.display = 'none';
        return;
    }

    element.textContent = message;
    // Ensure base class is present, then add specific type class
    element.className = 'status-message'; // Start fresh
    if (type === 'success') {
        element.classList.add('status-success');
    } else if (type === 'error') {
        element.classList.add('status-error');
    } else {
        // Default to info styling if needed, or just use base .status-message styles
        // element.classList.add('status-info'); // If you have an info style
    }

    element.style.display = 'block'; // Make sure it's visible
}