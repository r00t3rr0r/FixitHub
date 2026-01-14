import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import deTranslation from './locales/de/translation.json';

const resources = {
  en: {
    translation: enTranslation
  },
  'en-US': {
    translation: enTranslation
  },
  'en-GB': {
    translation: enTranslation
  },
  de: {
    translation: deTranslation
  },
  'de-DE': {
    translation: deTranslation
  }
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: false, // Disable debug to reduce console noise

    // Support language variants (en-US, en-GB, de-DE, etc.)
    load: 'languageOnly', // Load only the language part (en from en-US)

    // Fallback to base language if specific variant is not available
    nonExplicitSupportedLngs: true,

    interpolation: {
      escapeValue: false // React already escapes values
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator'],
      // Cache user language selection
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    }
  });

console.log('i18n initialized with languages:', Object.keys(resources));
console.log('i18n English keys sample:', Object.keys(enTranslation).slice(0, 10));
console.log('i18n has dashboardStats:', 'dashboardStats' in enTranslation);

export default i18n;
