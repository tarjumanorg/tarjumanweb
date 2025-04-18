export function displayStatus(
    element: HTMLElement | null,
    message: string | null,
    type: 'success' | 'error' | 'info' | 'clear' = 'info'
): void {
    if (!element) return;

    if (!message || type === 'clear') {
        element.textContent = '';
        element.className = 'status-message'; 
        element.style.display = 'none';
        return;
    }

    element.textContent = message;

    element.className = 'status-message'; 
    if (type === 'success') {
        element.classList.add('status-success');
    } else if (type === 'error') {
        element.classList.add('status-error');
    } else {

    }

    element.style.display = 'block'; 
}