import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import deTranslation from './locales/de/translation.json';

const resources = {
  en: {
    translation: enTranslation
  },
  de: {
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
    debug: true, // Enable debug to see translation issues

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
