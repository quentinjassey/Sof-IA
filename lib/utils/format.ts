// =============================================================================
// SOF'IA — Formatting Utilities
// French-locale formatting for dates, currency, file sizes, and text.
// =============================================================================

/**
 * Formats a date string or Date object to French format: DD/MM/YYYY HH:mm
 *
 * @param date - ISO date string, Date object, or timestamp
 * @returns Formatted date string (e.g., "14/02/2026 09:30")
 *
 * @example
 * formatDate('2026-02-14T09:30:00Z') // "14/02/2026 09:30"
 * formatDate(new Date())              // "14/02/2026 15:45"
 */
export function formatDate(date: string | Date | number): string {
  const d = date instanceof Date ? date : new Date(date)

  if (isNaN(d.getTime())) {
    return '—'
  }

  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats an amount in EUR with French locale.
 * Uses non-breaking space as thousands separator and comma as decimal separator.
 *
 * @param amount - Numeric amount
 * @returns Formatted currency string (e.g., "1 234,56 €")
 *
 * @example
 * formatCurrency(1234.56) // "1 234,56 €"
 * formatCurrency(0)       // "0,00 €"
 * formatCurrency(-500)    // "-500,00 €"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formats a file size in bytes to a human-readable French format.
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1,2 Mo", "450 Ko", "3,5 Go")
 *
 * @example
 * formatFileSize(1024)        // "1,0 Ko"
 * formatFileSize(1048576)     // "1,0 Mo"
 * formatFileSize(1073741824)  // "1,0 Go"
 * formatFileSize(512)         // "512 o"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return '—'

  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  // No decimals for bytes
  if (unitIndex === 0) {
    return `${Math.round(size)} ${units[unitIndex]}`
  }

  return `${size.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ${units[unitIndex]}`
}

/**
 * Truncates text to a maximum length, appending an ellipsis if truncated.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum character length (default: 100)
 * @returns Truncated text with ellipsis, or original text if within limit
 *
 * @example
 * truncateText('Hello World', 5)  // "Hello..."
 * truncateText('Short', 100)      // "Short"
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return ''
  if (text.length <= maxLength) return text

  return text.slice(0, maxLength).trimEnd() + '...'
}

/**
 * Masks a license key for display, showing only the first and last segments.
 * Format: DEMO-****-****-XXXX (where XXXX is the last segment)
 *
 * @param key - Full license key (e.g., "DEMO-SOFI-2026-0001")
 * @returns Masked key (e.g., "DEMO-****-****-0001")
 *
 * @example
 * maskLicenseKey('DEMO-SOFI-2026-0001') // "DEMO-****-****-0001"
 * maskLicenseKey('ABC-DEF-GHI')          // "ABC-****-GHI"
 */
export function maskLicenseKey(key: string): string {
  if (!key) return '—'

  const parts = key.split('-')

  if (parts.length < 2) return '****'

  if (parts.length === 2) {
    return `${parts[0]}-****`
  }

  const first = parts[0]
  const last = parts[parts.length - 1]
  const maskedMiddle = parts
    .slice(1, -1)
    .map(() => '****')
    .join('-')

  return `${first}-${maskedMiddle}-${last}`
}
