/**
 * Formats a date string or Date object to "DD Month, YYYY"
 * Example: 12 December, 2025
 */
export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    // Check if valid date
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};
