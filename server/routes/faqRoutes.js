const express = require('express');
const router = express.Router();
const FAQService = require('../services/faqService');
const auth = require('../middleware/auth');

// Get all FAQs with filtering
router.get('/', async (req, res) => {
  try {
    console.log('FAQRoutes: GET / - Query:', req.query);

    const result = await FAQService.getFAQs(req.query);
    res.json(result);
  } catch (error) {
    console.error('FAQRoutes: Error getting FAQs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single FAQ
router.get('/:id', async (req, res) => {
  try {
    console.log('FAQRoutes: GET /:id - ID:', req.params.id);

    const faq = await FAQService.getFAQ(req.params.id);
    res.json({ faq });
  } catch (error) {
    console.error('FAQRoutes: Error getting FAQ:', error);
    if (error.message === 'FAQ not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Create FAQ (authenticated users)
router.post('/', auth, async (req, res) => {
  try {
    console.log('FAQRoutes: POST / - User:', req.user.email);

    const faq = await FAQService.createFAQ(req.body, req.user._id);
    res.status(201).json({ success: true, faq });
  } catch (error) {
    console.error('FAQRoutes: Error creating FAQ:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update FAQ (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('FAQRoutes: PUT /:id - ID:', req.params.id, 'User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const faq = await FAQService.updateFAQ(req.params.id, req.body, req.user._id);
    res.json({ success: true, faq });
  } catch (error) {
    console.error('FAQRoutes: Error updating FAQ:', error);
    if (error.message === 'FAQ not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete FAQ (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('FAQRoutes: DELETE /:id - ID:', req.params.id, 'User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const result = await FAQService.deleteFAQ(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('FAQRoutes: Error deleting FAQ:', error);
    if (error.message === 'FAQ not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get FAQ categories
router.get('/categories/list', async (req, res) => {
  try {
    console.log('FAQRoutes: GET /categories/list');

    const categories = await FAQService.getCategories();
    res.json({ categories });
  } catch (error) {
    console.error('FAQRoutes: Error getting categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark FAQ as helpful/not helpful
router.post('/:id/helpful', async (req, res) => {
  try {
    console.log('FAQRoutes: POST /:id/helpful - ID:', req.params.id);

    const { isHelpful } = req.body;
    const result = await FAQService.markHelpful(req.params.id, isHelpful);
    res.json(result);
  } catch (error) {
    console.error('FAQRoutes: Error marking FAQ as helpful:', error);
    if (error.message === 'FAQ not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;