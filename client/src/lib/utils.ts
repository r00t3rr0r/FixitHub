
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

