const Language = require('../models/Language');

class LanguageService {
  /**
   * Get all languages
   */
  static async getAllLanguages(filters = {}) {
    console.log('LanguageService: Getting all languages with filters:', filters);
    try {
      const query = {};

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      const languages = await Language.find(query).sort({ isDefault: -1, name: 1 });
      console.log(`LanguageService: Found ${languages.length} languages`);
      return languages;
    } catch (error) {
      console.error('LanguageService: Error getting languages:', error);
      throw error;
    }
  }

  /**
   * Get language by code
   */
  static async getLanguageByCode(code) {
    console.log(`LanguageService: Getting language with code: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }
      return language;
    } catch (error) {
      console.error(`LanguageService: Error getting language ${code}:`, error);
      throw error;
    }
  }

  /**
   * Get default language
   */
  static async getDefaultLanguage() {
    console.log('LanguageService: Getting default language');
    try {
      const language = await Language.findOne({ isDefault: true });
      if (!language) {
        console.log('LanguageService: No default language found, returning English');
        // Return English as fallback
        return await Language.findOne({ code: 'en' });
      }
      return language;
    } catch (error) {
      console.error('LanguageService: Error getting default language:', error);
      throw error;
    }
  }

  /**
   * Create a new language
   */
  static async createLanguage(languageData) {
    console.log('LanguageService: Creating new language:', languageData.code);
    try {
      const existingLanguage = await Language.findOne({ code: languageData.code });
      if (existingLanguage) {
        console.log(`LanguageService: Language already exists with code: ${languageData.code}`);
        throw new Error('Language with this code already exists');
      }

      const language = new Language(languageData);
      await language.save();
      console.log(`LanguageService: Language created successfully: ${language.code}`);
      return language;
    } catch (error) {
      console.error('LanguageService: Error creating language:', error);
      throw error;
    }
  }

  /**
   * Update a language
   */
  static async updateLanguage(code, updateData) {
    console.log(`LanguageService: Updating language: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          language[key] = updateData[key];
        }
      });

      await language.save();
      console.log(`LanguageService: Language updated successfully: ${code}`);
      return language;
    } catch (error) {
      console.error(`LanguageService: Error updating language ${code}:`, error);
      throw error;
    }
  }

  /**
   * Delete a language
   */
  static async deleteLanguage(code) {
    console.log(`LanguageService: Deleting language: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }

      if (language.isDefault) {
        console.log(`LanguageService: Cannot delete default language: ${code}`);
        throw new Error('Cannot delete the default language');
      }

      await Language.deleteOne({ code });
      console.log(`LanguageService: Language deleted successfully: ${code}`);
      return { message: 'Language deleted successfully' };
    } catch (error) {
      console.error(`LanguageService: Error deleting language ${code}:`, error);
      throw error;
    }
  }

  /**
   * Set default language
   */
  static async setDefaultLanguage(code) {
    console.log(`LanguageService: Setting default language: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }

      language.isDefault = true;
      await language.save();
      console.log(`LanguageService: Default language set successfully: ${code}`);
      return language;
    } catch (error) {
      console.error(`LanguageService: Error setting default language ${code}:`, error);
      throw error;
    }
  }

  /**
   * Update translations for a language
   */
  static async updateTranslations(code, translations) {
    console.log(`LanguageService: Updating translations for language: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }

      language.translations = translations;
      await language.save();
      console.log(`LanguageService: Translations updated successfully for: ${code}`);
      return language;
    } catch (error) {
      console.error(`LanguageService: Error updating translations for ${code}:`, error);
      throw error;
    }
  }

  /**
   * Get translation statistics
   */
  static async getTranslationStats(code) {
    console.log(`LanguageService: Getting translation stats for: ${code}`);
    try {
      const language = await Language.findOne({ code });
      if (!language) {
        console.log(`LanguageService: Language not found with code: ${code}`);
        throw new Error('Language not found');
      }

      const totalKeys = language.translations.length;
      const translatedKeys = language.translations.filter(t => t.value && t.value.trim() !== '').length;
      const missingKeys = totalKeys - translatedKeys;
      const progress = totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0;

      const stats = {
        totalKeys,
        translatedKeys,
        missingKeys,
        progress
      };

      console.log(`LanguageService: Translation stats for ${code}:`, stats);
      return stats;
    } catch (error) {
      console.error(`LanguageService: Error getting translation stats for ${code}:`, error);
      throw error;
    }
  }
}

module.exports = LanguageService;
