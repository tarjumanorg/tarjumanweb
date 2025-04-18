// src/utils/dateUtils.ts
/**
 * Formats a date string into a human-readable format (medium date, short time).
 * Returns 'N/A' if the input is null, undefined, or invalid.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateString));
    } catch {
        // Handle cases where dateString might be invalid after all
        return dateString;
    }
}