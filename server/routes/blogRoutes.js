const express = require('express');
const router = express.Router();
const BlogService = require('../services/blogService');
const auth = require('../middleware/auth');

// Get blog analytics (admin only)
router.get('/analytics', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: GET /analytics - User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const analytics = await BlogService.getAnalytics(req.query);
    res.json({ analytics });
  } catch (error) {
    console.error('BlogRoutes: Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all blog posts with filtering
router.get('/', async (req, res) => {
  try {
    console.log('BlogRoutes: GET / - Query:', req.query);

    const result = await BlogService.getPosts(req.query);
    res.json(result);
  } catch (error) {
    console.error('BlogRoutes: Error getting posts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single blog post
router.get('/:id', async (req, res) => {
  try {
    console.log('BlogRoutes: GET /:id - ID:', req.params.id);

    const post = await BlogService.getPost(req.params.id);
    res.json({ post });
  } catch (error) {
    console.error('BlogRoutes: Error getting post:', error);
    if (error.message === 'Blog post not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Create blog post (authenticated users)
router.post('/', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: POST / - User:', req.user.email);

    const post = await BlogService.createPost(req.body, req.user._id);
    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('BlogRoutes: Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update blog post (author or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: PUT /:id - ID:', req.params.id, 'User:', req.user.email);

    // Check if user is author or admin
    const existingPost = await BlogService.getPost(req.params.id);
    if (existingPost.author._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You can only edit your own posts.' });
    }

    const post = await BlogService.updatePost(req.params.id, req.body, req.user._id);
    res.json({ success: true, post });
  } catch (error) {
    console.error('BlogRoutes: Error updating post:', error);
    if (error.message === 'Blog post not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete post (author or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: DELETE /:id - ID:', req.params.id, 'User:', req.user.email);

    const existingPost = await BlogService.getPost(req.params.id);
    if (existingPost.author._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You can only delete your own posts.' });
    }

    const result = await BlogService.deletePost(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('BlogRoutes: Error deleting post:', error);
    if (error.message === 'Blog post not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update post status (admin only)
router.put('/:id/status', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: PUT /:id/status - ID:', req.params.id, 'User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { status, reviewNotes } = req.body;
    const result = await BlogService.updatePostStatus(req.params.id, status, reviewNotes, req.user._id);
    res.json(result);
  } catch (error) {
    console.error('BlogRoutes: Error updating post status:', error);
    if (error.message === 'Blog post not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Toggle post like
router.post('/:id/like', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: POST /:id/like - ID:', req.params.id, 'User:', req.user.email);

    const result = await BlogService.toggleLike(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    console.error('BlogRoutes: Error toggling like:', error);
    if (error.message === 'Blog post not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get categories
router.get('/categories/list', async (req, res) => {
  try {
    console.log('BlogRoutes: GET /categories/list');

    const categories = await BlogService.getCategories();
    res.json({ categories });
  } catch (error) {
    console.error('BlogRoutes: Error getting categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create category (admin only)
router.post('/categories', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: POST /categories - User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const category = await BlogService.createCategory(req.body);
    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error('BlogRoutes: Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tags
router.get('/tags/list', async (req, res) => {
  try {
    console.log('BlogRoutes: GET /tags/list');

    const tags = await BlogService.getTags();
    res.json({ tags });
  } catch (error) {
    console.error('BlogRoutes: Error getting tags:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create tag (admin only)
router.post('/tags', auth, async (req, res) => {
  try {
    console.log('BlogRoutes: POST /tags - User:', req.user.email);

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const tag = await BlogService.createTag(req.body);
    res.status(201).json({ success: true, tag });
  } catch (error) {
    console.error('BlogRoutes: Error creating tag:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;