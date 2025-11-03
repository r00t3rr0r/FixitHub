const express = require('express');
const router = express.Router();
const NeedListService = require('../services/needListService');
const { requireUser, requireRole } = require('./middleware/auth');

// Description: Get all need lists with optional filtering
// Endpoint: GET /api/need-lists
// Request: { status?: string, priority?: string, search?: string }
// Response: { needLists: Array<NeedList> }
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/need-lists - Fetching need lists');

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      createdBy: req.user.role !== 'admin' ? req.user._id : undefined
    };

    const needLists = await NeedListService.getNeedLists(filters);

    res.status(200).json({ needLists });
  } catch (error) {
    console.error('GET /api/need-lists - Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get need list statistics
// Endpoint: GET /api/need-lists/statistics
// Request: {}
// Response: { statistics: { total: number, byStatus: object, byPriority: object } }
router.get('/statistics', requireUser, async (req, res) => {
  try {
    console.log('GET /api/need-lists/statistics - Fetching statistics');

    const userId = req.user.role !== 'admin' ? req.user._id : null;
    const statistics = await NeedListService.getNeedListStatistics(userId);

    res.status(200).json({ statistics });
  } catch (error) {
    console.error('GET /api/need-lists/statistics - Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get a single need list by ID
// Endpoint: GET /api/need-lists/:id
// Request: {}
// Response: { needList: NeedList }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('GET /api/need-lists/:id - Fetching need list:', req.params.id);

    const needList = await NeedListService.getNeedListById(req.params.id);

    res.status(200).json({ needList });
  } catch (error) {
    console.error('GET /api/need-lists/:id - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 500).json({ error: error.message });
  }
});

// Description: Create a new need list
// Endpoint: POST /api/need-lists
// Request: { name: string, description?: string, items: Array<{part: string, quantity: number, notes?: string}>, priority?: string, tags?: Array<string> }
// Response: { needList: NeedList }
router.post('/', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('POST /api/need-lists - Creating need list');

    const needList = await NeedListService.createNeedList(req.body, req.user._id);

    res.status(201).json({ needList });
  } catch (error) {
    console.error('POST /api/need-lists - Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update an existing need list
// Endpoint: PUT /api/need-lists/:id
// Request: { name?: string, description?: string, items?: Array<{part: string, quantity: number, notes?: string}>, status?: string, priority?: string, tags?: Array<string> }
// Response: { needList: NeedList }
router.put('/:id', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('PUT /api/need-lists/:id - Updating need list:', req.params.id);

    const needList = await NeedListService.updateNeedList(req.params.id, req.body, req.user._id);

    res.status(200).json({ needList });
  } catch (error) {
    console.error('PUT /api/need-lists/:id - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 400).json({ error: error.message });
  }
});

// Description: Delete a need list
// Endpoint: DELETE /api/need-lists/:id
// Request: {}
// Response: { message: string }
router.delete('/:id', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('DELETE /api/need-lists/:id - Deleting need list:', req.params.id);

    const result = await NeedListService.deleteNeedList(req.params.id, req.user._id);

    res.status(200).json(result);
  } catch (error) {
    console.error('DELETE /api/need-lists/:id - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 400).json({ error: error.message });
  }
});

// Description: Add item to need list
// Endpoint: POST /api/need-lists/:id/items
// Request: { part: string, quantity: number, notes?: string }
// Response: { needList: NeedList }
router.post('/:id/items', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('POST /api/need-lists/:id/items - Adding item to need list:', req.params.id);

    const needList = await NeedListService.addItemToNeedList(req.params.id, req.body, req.user._id);

    res.status(200).json({ needList });
  } catch (error) {
    console.error('POST /api/need-lists/:id/items - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 400).json({ error: error.message });
  }
});

// Description: Remove item from need list
// Endpoint: DELETE /api/need-lists/:id/items/:itemId
// Request: {}
// Response: { needList: NeedList }
router.delete('/:id/items/:itemId', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('DELETE /api/need-lists/:id/items/:itemId - Removing item from need list:', req.params.id);

    const needList = await NeedListService.removeItemFromNeedList(
      req.params.id,
      req.params.itemId,
      req.user._id
    );

    res.status(200).json({ needList });
  } catch (error) {
    console.error('DELETE /api/need-lists/:id/items/:itemId - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 400).json({ error: error.message });
  }
});

// Description: Convert need list to EPart order
// Endpoint: POST /api/need-lists/:id/convert-to-order
// Request: { supplier?: string, notes?: string }
// Response: { order: EPartOrder, needList: NeedList }
router.post('/:id/convert-to-order', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('POST /api/need-lists/:id/convert-to-order - Converting need list to order:', req.params.id);

    const result = await NeedListService.convertToOrder(req.params.id, req.body, req.user._id);

    res.status(201).json(result);
  } catch (error) {
    console.error('POST /api/need-lists/:id/convert-to-order - Error:', error.message);
    res.status(error.message === 'Need list not found' ? 404 : 400).json({ error: error.message });
  }
});

module.exports = router;
