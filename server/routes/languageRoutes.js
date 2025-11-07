const express = require('express');
const router = express.Router();
const LanguageService = require('../services/languageService');
const { requireUser, requireRole } = require('./middleware/auth');

// Description: Get all languages
// Endpoint: GET /api/languages
// Request: { isActive?: boolean }
// Response: { languages: Array<Language> }
router.get('/', async (req, res) => {
  console.log('LanguageRoutes: GET /api/languages');
  try {
    const { isActive } = req.query;
    const filters = {};

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    const languages = await LanguageService.getAllLanguages(filters);
    res.json({ languages });
  } catch (error) {
    console.error('LanguageRoutes: Error getting languages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get default language
// Endpoint: GET /api/languages/default
// Request: {}
// Response: { language: Language }
router.get('/default', async (req, res) => {
  console.log('LanguageRoutes: GET /api/languages/default');
  try {
    const language = await LanguageService.getDefaultLanguage();
    res.json({ language });
  } catch (error) {
    console.error('LanguageRoutes: Error getting default language:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get language by code
// Endpoint: GET /api/languages/:code
// Request: {}
// Response: { language: Language }
router.get('/:code', async (req, res) => {
  console.log(`LanguageRoutes: GET /api/languages/${req.params.code}`);
  try {
    const language = await LanguageService.getLanguageByCode(req.params.code);
    res.json({ language });
  } catch (error) {
    console.error(`LanguageRoutes: Error getting language ${req.params.code}:`, error);
    res.status(404).json({ error: error.message });
  }
});

// Description: Create a new language (Admin only)
// Endpoint: POST /api/languages
// Request: { code: string, name: string, nativeName: string, direction?: string, isActive?: boolean }
// Response: { language: Language }
router.post('/', requireUser, requireRole('admin'), async (req, res) => {
  console.log('LanguageRoutes: POST /api/languages');
  try {
    const language = await LanguageService.createLanguage(req.body);
    res.status(201).json({ language });
  } catch (error) {
    console.error('LanguageRoutes: Error creating language:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update a language (Admin only)
// Endpoint: PUT /api/languages/:code
// Request: { name?: string, nativeName?: string, direction?: string, isActive?: boolean }
// Response: { language: Language }
router.put('/:code', requireUser, requireRole('admin'), async (req, res) => {
  console.log(`LanguageRoutes: PUT /api/languages/${req.params.code}`);
  try {
    const language = await LanguageService.updateLanguage(req.params.code, req.body);
    res.json({ language });
  } catch (error) {
    console.error(`LanguageRoutes: Error updating language ${req.params.code}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Delete a language (Admin only)
// Endpoint: DELETE /api/languages/:code
// Request: {}
// Response: { message: string }
router.delete('/:code', requireUser, requireRole('admin'), async (req, res) => {
  console.log(`LanguageRoutes: DELETE /api/languages/${req.params.code}`);
  try {
    const result = await LanguageService.deleteLanguage(req.params.code);
    res.json(result);
  } catch (error) {
    console.error(`LanguageRoutes: Error deleting language ${req.params.code}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Set default language (Admin only)
// Endpoint: PUT /api/languages/:code/default
// Request: {}
// Response: { language: Language }
router.put('/:code/default', requireUser, requireRole('admin'), async (req, res) => {
  console.log(`LanguageRoutes: PUT /api/languages/${req.params.code}/default`);
  try {
    const language = await LanguageService.setDefaultLanguage(req.params.code);
    res.json({ language });
  } catch (error) {
    console.error(`LanguageRoutes: Error setting default language ${req.params.code}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update translations for a language (Admin only)
// Endpoint: PUT /api/languages/:code/translations
// Request: { translations: Array<{ key: string, value: string, section: string }> }
// Response: { language: Language }
router.put('/:code/translations', requireUser, requireRole('admin'), async (req, res) => {
  console.log(`LanguageRoutes: PUT /api/languages/${req.params.code}/translations`);
  try {
    const { translations } = req.body;
    const language = await LanguageService.updateTranslations(req.params.code, translations);
    res.json({ language });
  } catch (error) {
    console.error(`LanguageRoutes: Error updating translations for ${req.params.code}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Get translation statistics for a language (Admin only)
// Endpoint: GET /api/languages/:code/stats
// Request: {}
// Response: { stats: { totalKeys: number, translatedKeys: number, missingKeys: number, progress: number } }
router.get('/:code/stats', requireUser, requireRole('admin'), async (req, res) => {
  console.log(`LanguageRoutes: GET /api/languages/${req.params.code}/stats`);
  try {
    const stats = await LanguageService.getTranslationStats(req.params.code);
    res.json({ stats });
  } catch (error) {
    console.error(`LanguageRoutes: Error getting translation stats for ${req.params.code}:`, error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
