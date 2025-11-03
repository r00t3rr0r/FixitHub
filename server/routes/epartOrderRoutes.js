const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const EPartOrderService = require('../services/epartOrderService');
const { requireUser, requireRole } = require('./middleware/auth');

// Configure multer for invoice uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/invoices');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and office documents are allowed'));
    }
  }
});

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin or staff role required.' });
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// ============ SUPPLIER ROUTES ============

// Description: Get all suppliers
// Endpoint: GET /api/epart-orders/suppliers
// Request: { isActive?: boolean, search?: string }
// Response: { suppliers: Array<Supplier> }
router.get('/suppliers', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const filters = {
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search
    };

    const suppliers = await EPartOrderService.getSuppliers(filters);
    res.json({ suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get supplier by ID
// Endpoint: GET /api/epart-orders/suppliers/:id
// Request: {}
// Response: { supplier: Supplier }
router.get('/suppliers/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const supplier = await EPartOrderService.getSupplierById(req.params.id);
    res.json({ supplier });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(404).json({ error: error.message });
  }
});

// Description: Create new supplier
// Endpoint: POST /api/epart-orders/suppliers
// Request: Supplier data
// Response: { supplier: Supplier }
router.post('/suppliers', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const supplier = await EPartOrderService.createSupplier(req.body);
    res.status(201).json({ supplier });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update supplier
// Endpoint: PUT /api/epart-orders/suppliers/:id
// Request: Supplier data
// Response: { supplier: Supplier }
router.put('/suppliers/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const supplier = await EPartOrderService.updateSupplier(req.params.id, req.body);
    res.json({ supplier });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Delete (deactivate) supplier
// Endpoint: DELETE /api/epart-orders/suppliers/:id
// Request: {}
// Response: { message: string }
router.delete('/suppliers/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const result = await EPartOrderService.deleteSupplier(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ ORDER ROUTES ============

// Description: Get order statistics
// Endpoint: GET /api/epart-orders/statistics
// Request: { startDate?, endDate? }
// Response: OrderStatistics
router.get('/statistics', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const statistics = await EPartOrderService.getOrderStatistics(filters);
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get all epart orders with filters
// Endpoint: GET /api/epart-orders
// Request: { status?, supplierId?, paymentStatus?, search?, startDate?, endDate?, page?, limit? }
// Response: { orders: Array<EPartOrder>, pagination: { total, page, pages, limit } }
router.get('/', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      supplierId: req.query.supplierId,
      paymentStatus: req.query.paymentStatus,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await EPartOrderService.getEPartOrders(filters);
    res.json(result);
  } catch (error) {
    console.error('Error fetching epart orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get order by ID
// Endpoint: GET /api/epart-orders/:id
// Request: {}
// Response: { order: EPartOrder }
router.get('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.getEPartOrderById(req.params.id);
    res.json({ order });
  } catch (error) {
    console.error('Error fetching epart order:', error);
    res.status(404).json({ error: error.message });
  }
});

// Description: Create new epart order
// Endpoint: POST /api/epart-orders
// Request: Order data
// Response: { order: EPartOrder }
router.post('/', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.createEPartOrder(req.body, req.user._id);
    res.status(201).json({ order });
  } catch (error) {
    console.error('Error creating epart order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update epart order
// Endpoint: PUT /api/epart-orders/:id
// Request: Update data
// Response: { order: EPartOrder }
router.put('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.updateEPartOrder(req.params.id, req.body, req.user._id);
    res.json({ order });
  } catch (error) {
    console.error('Error updating epart order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Receive order items (full or partial)
// Endpoint: POST /api/epart-orders/:id/receive
// Request: { items: Array<{ itemId, quantity }> }
// Response: { order: EPartOrder }
router.post('/:id/receive', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.receiveOrderItems(
      req.params.id,
      req.body.items,
      req.user._id
    );
    res.json({ order });
  } catch (error) {
    console.error('Error receiving order items:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Cancel epart order
// Endpoint: POST /api/epart-orders/:id/cancel
// Request: { reason?: string }
// Response: { order: EPartOrder }
router.post('/:id/cancel', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.cancelEPartOrder(
      req.params.id,
      req.body.reason,
      req.user._id
    );
    res.json({ order });
  } catch (error) {
    console.error('Error cancelling epart order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Upload invoice file for order
// Endpoint: POST /api/epart-orders/:id/invoice
// Request: FormData with file
// Response: { order: EPartOrder }
router.post('/:id/invoice', requireUser, requireAdminOrStaff, upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const order = await EPartOrderService.uploadInvoice(
      req.params.id,
      {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      },
      req.user._id
    );
    res.json({ order });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    // Clean up uploaded file if there was an error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    res.status(400).json({ error: error.message });
  }
});

// Description: Download invoice file
// Endpoint: GET /api/epart-orders/:id/invoice
// Request: {}
// Response: File download
router.get('/:id/invoice', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const order = await EPartOrderService.getEPartOrderById(req.params.id);

    if (!order.invoiceFile || !order.invoiceFile.filename) {
      return res.status(404).json({ error: 'No invoice file found for this order' });
    }

    const filePath = path.join(__dirname, '../uploads/invoices', order.invoiceFile.filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Invoice file not found on server' });
    }

    res.download(filePath, order.invoiceFile.originalName);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Request return or exchange for broken parts
// Endpoint: POST /api/epart-orders/:id/return-exchange
// Request: { type: 'return' | 'exchange', reason: string, description: string, affectedItems: Array }
// Response: { order: EPartOrder }
router.post('/:id/return-exchange', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const { type, reason, description, affectedItems } = req.body;

    if (!type || !['return', 'exchange'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "return" or "exchange"' });
    }

    if (!reason || !description) {
      return res.status(400).json({ error: 'Reason and description are required' });
    }

    if (!affectedItems || affectedItems.length === 0) {
      return res.status(400).json({ error: 'At least one affected item is required' });
    }

    const order = await EPartOrderService.requestReturnExchange(
      req.params.id,
      {
        type,
        reason,
        description,
        affectedItems
      },
      req.user._id
    );
    res.json({ order });
  } catch (error) {
    console.error('Error requesting return/exchange:', error);
    res.status(400).json({ error: error.message });
  }
});

// Description: Update return/exchange status
// Endpoint: PUT /api/epart-orders/:id/return-exchange
// Request: { status: string, notes?: string }
// Response: { order: EPartOrder }
router.put('/:id/return-exchange', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = ['approved', 'in_transit', 'completed', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await EPartOrderService.updateReturnExchange(
      req.params.id,
      status,
      notes,
      req.user._id
    );
    res.json({ order });
  } catch (error) {
    console.error('Error updating return/exchange:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
