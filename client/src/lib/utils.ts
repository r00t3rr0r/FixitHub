
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts MongoDB Decimal128 or any object/string value to a number
 * Handles various formats including:
 * - Regular numbers
 * - String representations of numbers
 * - MongoDB Decimal128 objects ({ $numberDecimal: "123.45" })
 * - Objects with {s, e, c} structure (serialized Decimal128)
 * 
 * @param value The value to convert
 * @param defaultValue The default value to return if conversion fails (default: 0)
 * @returns The numeric value or defaultValue if conversion fails
 */
export function safeToNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }
  
  // Handle MongoDB Decimal128 objects
  if (typeof value === 'object') {
    // Standard MongoDB format
    if ('$numberDecimal' in value) {
      const parsed = parseFloat(value.$numberDecimal)
      return isNaN(parsed) ? defaultValue : parsed
    }
    
    // Try to convert object to string first, then to number
    const stringValue = String(value)
    const parsed = parseFloat(stringValue)
    return isNaN(parsed) ? defaultValue : parsed
  }
  
  return defaultValue
}

/**
 * Formats a price value for display, safely converting objects to numbers first
 * 
 * @param value The price value to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted price string without currency symbol
 */
export function formatPrice(value: any, decimals: number = 2): string {
  return safeToNumber(value).toFixed(decimals)
}

/**
 * DER Geldformatierer der Anwendung (CUSTUX-12 / FIN-12).
 *
 * Regeln:
 *  - Die Waehrung kommt aus den DATEN (payment.currency, Finanzeinstellungen; Standard
 *    EUR) - nie aus der Sprache. Ein ungueltiger Waehrungscode faellt auf EUR zurueck.
 *  - Das Zahlenformat ist standardmaessig de-DE ("47,40 €"), auch in der englischen
 *    Oberflaeche. Ein anderes Format nur, wenn ein Aufrufer es ausdruecklich uebergibt.
 *  - Nicht lesbare Werte werden als 0 formatiert (wie safeToNumber).
 *
 * @example formatMoney(47.4)               // "47,40 €"
 * @example formatMoney(47.4, 'EUR', 'en-GB') // "€47.40"
 * @example formatMoney(1, 'XX!')            // "1,00 €" (Fallback EUR)
 */
export function formatMoney(value: unknown, currency: string = 'EUR', locale: string = 'de-DE'): string {
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'EUR'
  const amount = safeToNumber(value)
  try {
    return new Intl.NumberFormat(locale || 'de-DE', { style: 'currency', currency: code }).format(amount)
  } catch {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
  }
}

/**
 * Formats a numeric value as Euro currency using German locale (e.g. 10,99 €).
 * Wrapper um formatMoney (bestehende Aufrufer bleiben unveraendert).
 *
 * @param value The price value to format
 * @returns Formatted Euro string, e.g. "10,99 €"
 */
export function formatEUR(value: any): string {
  return formatMoney(value, 'EUR')
}

