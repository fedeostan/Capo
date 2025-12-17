/**
 * Formats a date string or Date object to "DD Month, YYYY"
 * Example: 12 December, 2025
 */
export const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    // Check if valid date
    if (isNaN(d.getTime())) return '';

    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.getFullYear();

    return `${day} ${month}, ${year}`;
};
