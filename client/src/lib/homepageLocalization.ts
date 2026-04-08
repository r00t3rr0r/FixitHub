export type HomepageLocalizedText = Record<string, string>

const LOCALE_KEY_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isLocalizedTextRecord = (value: unknown): value is HomepageLocalizedText => {
  if (!isPlainObject(value)) return false

  const entries = Object.entries(value)
  if (entries.length === 0) return false

  return entries.every(([key, entryValue]) => LOCALE_KEY_PATTERN.test(key) && typeof entryValue === 'string')
}

const getLocaleCandidates = (language: string) => {
  const normalized = language || 'en'
  const base = normalized.split('-')[0]

  return Array.from(new Set([normalized, base, 'en', 'de']))
}

export const resolveLocalizedText = (
  value: unknown,
  language: string,
  fallbackValue?: string
): string | undefined => {
  if (typeof value === 'string') {
    return value
  }

  if (isPlainObject(value) && isLocalizedTextRecord(value.translations)) {
    return resolveLocalizedText(value.translations, language, fallbackValue)
  }

  if (!isLocalizedTextRecord(value)) {
    return fallbackValue
  }

  const candidates = getLocaleCandidates(language)
  for (const candidate of candidates) {
    if (value[candidate]) {
      return value[candidate]
    }
  }

  return Object.values(value)[0] || fallbackValue
}

export const localizeHomepageValue = <T>(value: T, language: string): T => {
  if (Array.isArray(value)) {
    return value.map((entry) => localizeHomepageValue(entry, language)) as T
  }

  if (isLocalizedTextRecord(value)) {
    return (resolveLocalizedText(value, language) || '') as T
  }

  if (!isPlainObject(value)) {
    return value
  }

  if (isLocalizedTextRecord(value.translations)) {
    return (resolveLocalizedText(value.translations, language) || '') as T
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, localizeHomepageValue(entryValue, language)])
  ) as T
}

export const resolveHomepageField = (
  value: unknown,
  translations: HomepageLocalizedText | undefined,
  language: string,
  fallbackValue?: string
) => {
  if (translations) {
    return resolveLocalizedText(translations, language, fallbackValue)
  }

  return resolveLocalizedText(value, language, fallbackValue)
}