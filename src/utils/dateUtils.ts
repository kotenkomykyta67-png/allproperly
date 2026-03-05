/**
 * Date formatting utilities shared across the application
 */

/**
 * Format date as MM/DD/YY
 */
export function formatShortDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/**
 * Format date as "Nov 15, 2025"
 */
export function formatLongDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Parse date from string format
 */
export function parseLongDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Format number with commas (e.g., 1000 -> "1,000")
 */
export function formatNumber(num: string | number | undefined): string {
  if (num === undefined || num === null || num === '') return '';
  const n = typeof num === 'string' ? parseFloat(num.replace(/[^\d.\-]/g, '')) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-US');
}

/**
 * Format currency amount with 2 decimal places (without $ prefix)
 * Returns just the formatted number like "1,234.56"
 */
export function formatCurrencyAmount(amount: string | number | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '0.00';
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.\-]/g, '')) : Number(amount);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
