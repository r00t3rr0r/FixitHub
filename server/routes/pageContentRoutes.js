const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./middleware/auth');
const PageContentService = require('../services/pageContentService');

// Description: Get all pages list
// Endpoint: GET /api/page-content
// Request: {}
// Response: { pages: Array<PageContent> }
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/page-content - Fetching all pages');
    const pages = await PageContentService.getAllPages();
    res.json({ pages });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get page content by page ID
// Endpoint: GET /api/page-content/:pageId
// Request: {}
// Response: { pageContent: PageContent }
router.get('/:pageId', requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/page-content/:pageId - Fetching page content for:', req.params.pageId);
    const pageContent = await PageContentService.getPageContent(req.params.pageId);
    res.json({ pageContent });
  } catch (error) {
    console.error('Error fetching page content:', error);
    res.status(404).json({ error: error.message });
  }
});

// Description: Create new page content
// Endpoint: POST /api/page-content
// Request: { pageId, pageTitle, pageSlug, sections?, globalStyles?, seo?, customCSS?, customJS? }
// Response: { pageContent: PageContent }
router.post('/', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content - Creating new page content');
    const pageContent = await PageContentService.createPageContent(req.body, req.user._id);
    res.status(201).json({ pageContent });
  } catch (error) {
    console.error('Error creating page content:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update page content
// Endpoint: PUT /api/page-content/:pageId
// Request: { sections?, globalStyles?, seo?, customCSS?, customJS?, ... }
// Response: { pageContent: PageContent }
router.put('/:pageId', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/page-content/:pageId - Updating page content');
    const pageContent = await PageContentService.updatePageContent(
      req.params.pageId,
      req.body,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error updating page content:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Delete page content
// Endpoint: DELETE /api/page-content/:pageId
// Request: {}
// Response: { success: boolean, message: string }
router.delete('/:pageId', requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/page-content/:pageId - Deleting page content');
    const result = await PageContentService.deletePageContent(req.params.pageId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting page content:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Duplicate page
// Endpoint: POST /api/page-content/:pageId/duplicate
// Request: { pageId, pageTitle, pageSlug }
// Response: { pageContent: PageContent }
router.post('/:pageId/duplicate', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/duplicate - Duplicating page');
    const pageContent = await PageContentService.duplicatePageContent(
      req.params.pageId,
      req.body,
      req.user._id
    );
    res.status(201).json({ pageContent });
  } catch (error) {
    console.error('Error duplicating page:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Publish page
// Endpoint: POST /api/page-content/:pageId/publish
// Request: {}
// Response: { pageContent: PageContent }
router.post('/:pageId/publish', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/publish - Publishing page');
    const pageContent = await PageContentService.publishPage(req.params.pageId);
    res.json({ pageContent, message: 'Page published successfully' });
  } catch (error) {
    console.error('Error publishing page:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Add section to page
// Endpoint: POST /api/page-content/:pageId/sections
// Request: { id?, name, type, components?, styles? }
// Response: { pageContent: PageContent }
router.post('/:pageId/sections', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/sections - Adding section');
    const pageContent = await PageContentService.addSection(
      req.params.pageId,
      req.body,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error adding section:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update section
// Endpoint: PUT /api/page-content/:pageId/sections/:sectionId
// Request: { name?, type?, components?, styles?, ... }
// Response: { pageContent: PageContent }
router.put('/:pageId/sections/:sectionId', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/page-content/:pageId/sections/:sectionId - Updating section');
    const pageContent = await PageContentService.updateSection(
      req.params.pageId,
      req.params.sectionId,
      req.body,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error updating section:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Delete section
// Endpoint: DELETE /api/page-content/:pageId/sections/:sectionId
// Request: {}
// Response: { pageContent: PageContent }
router.delete('/:pageId/sections/:sectionId', requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/page-content/:pageId/sections/:sectionId - Deleting section');
    const pageContent = await PageContentService.deleteSection(
      req.params.pageId,
      req.params.sectionId,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Reorder sections
// Endpoint: POST /api/page-content/:pageId/sections/reorder
// Request: { sectionIds: Array<string> }
// Response: { pageContent: PageContent }
router.post('/:pageId/sections/reorder', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/sections/reorder - Reordering sections');
    const pageContent = await PageContentService.reorderSections(
      req.params.pageId,
      req.body.sectionIds,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error reordering sections:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Add component to section
// Endpoint: POST /api/page-content/:pageId/sections/:sectionId/components
// Request: { id?, type, name?, content?, styles?, parentId? }
// Response: { pageContent: PageContent }
router.post('/:pageId/sections/:sectionId/components', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/sections/:sectionId/components - Adding component');
    const pageContent = await PageContentService.addComponent(
      req.params.pageId,
      req.params.sectionId,
      req.body,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error adding component:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update component
// Endpoint: PUT /api/page-content/:pageId/sections/:sectionId/components/:componentId
// Request: { type?, name?, content?, styles?, ... }
// Response: { pageContent: PageContent }
router.put('/:pageId/sections/:sectionId/components/:componentId', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/page-content/:pageId/sections/:sectionId/components/:componentId - Updating component');
    const pageContent = await PageContentService.updateComponent(
      req.params.pageId,
      req.params.sectionId,
      req.params.componentId,
      req.body,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Delete component
// Endpoint: DELETE /api/page-content/:pageId/sections/:sectionId/components/:componentId
// Request: {}
// Response: { pageContent: PageContent }
router.delete('/:pageId/sections/:sectionId/components/:componentId', requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/page-content/:pageId/sections/:sectionId/components/:componentId - Deleting component');
    const pageContent = await PageContentService.deleteComponent(
      req.params.pageId,
      req.params.sectionId,
      req.params.componentId,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Reorder components
// Endpoint: POST /api/page-content/:pageId/sections/:sectionId/components/reorder
// Request: { componentIds: Array<string> }
// Response: { pageContent: PageContent }
router.post('/:pageId/sections/:sectionId/components/reorder', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/sections/:sectionId/components/reorder - Reordering components');
    const pageContent = await PageContentService.reorderComponents(
      req.params.pageId,
      req.params.sectionId,
      req.body.componentIds,
      req.user._id
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error reordering components:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Create version snapshot
// Endpoint: POST /api/page-content/:pageId/versions
// Request: { action?: string }
// Response: { pageContent: PageContent }
router.post('/:pageId/versions', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/versions - Creating version');
    const pageContent = await PageContentService.createVersion(
      req.params.pageId,
      req.user._id,
      req.body.action
    );
    res.json({ pageContent });
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Get version history
// Endpoint: GET /api/page-content/:pageId/versions
// Request: {}
// Response: { currentVersion: number, history: Array<Version> }
router.get('/:pageId/versions', requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/page-content/:pageId/versions - Fetching version history');
    const history = await PageContentService.getVersionHistory(req.params.pageId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Restore from version
// Endpoint: POST /api/page-content/:pageId/versions/:versionIndex/restore
// Request: {}
// Response: { pageContent: PageContent }
router.post('/:pageId/versions/:versionIndex/restore', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/page-content/:pageId/versions/:versionIndex/restore - Restoring version');
    const pageContent = await PageContentService.restoreVersion(
      req.params.pageId,
      parseInt(req.params.versionIndex)
    );
    res.json({ pageContent, message: 'Version restored successfully' });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
