import api from './api';

export interface Language {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
  isActive: boolean;
  isDefault: boolean;
  direction: 'ltr' | 'rtl';
  translations: TranslationKey[];
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationKey {
  key: string;
  value: string;
  section: string;
}

export interface TranslationStats {
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  progress: number;
}

// Description: Get all languages
// Endpoint: GET /api/languages
// Request: { isActive?: boolean }
// Response: { languages: Array<Language> }
export const getLanguages = async (filters?: { isActive?: boolean }) => {
  try {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) {
      params.append('isActive', String(filters.isActive));
    }

    const response = await api.get(`/api/languages?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get default language
// Endpoint: GET /api/languages/default
// Request: {}
// Response: { language: Language }
export const getDefaultLanguage = async () => {
  try {
    const response = await api.get('/api/languages/default');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get language by code
// Endpoint: GET /api/languages/:code
// Request: {}
// Response: { language: Language }
export const getLanguageByCode = async (code: string) => {
  try {
    const response = await api.get(`/api/languages/${code}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new language (Admin only)
// Endpoint: POST /api/languages
// Request: { code: string, name: string, nativeName: string, direction?: string, isActive?: boolean }
// Response: { language: Language }
export const createLanguage = async (languageData: Partial<Language>) => {
  try {
    const response = await api.post('/api/languages', languageData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update a language (Admin only)
// Endpoint: PUT /api/languages/:code
// Request: { name?: string, nativeName?: string, direction?: string, isActive?: boolean }
// Response: { language: Language }
export const updateLanguage = async (code: string, updateData: Partial<Language>) => {
  try {
    const response = await api.put(`/api/languages/${code}`, updateData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a language (Admin only)
// Endpoint: DELETE /api/languages/:code
// Request: {}
// Response: { message: string }
export const deleteLanguage = async (code: string) => {
  try {
    const response = await api.delete(`/api/languages/${code}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Set default language (Admin only)
// Endpoint: PUT /api/languages/:code/default
// Request: {}
// Response: { language: Language }
export const setDefaultLanguage = async (code: string) => {
  try {
    const response = await api.put(`/api/languages/${code}/default`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update translations for a language (Admin only)
// Endpoint: PUT /api/languages/:code/translations
// Request: { translations: Array<{ key: string, value: string, section: string }> }
// Response: { language: Language }
export const updateTranslations = async (code: string, translations: TranslationKey[]) => {
  try {
    const response = await api.put(`/api/languages/${code}/translations`, { translations });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get translation statistics for a language (Admin only)
// Endpoint: GET /api/languages/:code/stats
// Request: {}
// Response: { stats: { totalKeys: number, translatedKeys: number, missingKeys: number, progress: number } }
export const getTranslationStats = async (code: string) => {
  try {
    const response = await api.get(`/api/languages/${code}/stats`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
