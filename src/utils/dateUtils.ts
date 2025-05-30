// src/utils/dateUtils.ts
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateString));
    } catch {
        return dateString;
    }
}

export function calculateEstimatedDeliveryDate(turnaroundDays: number): Date {
    const now = new Date();
    now.setDate(now.getDate() + turnaroundDays);
    return now;
}