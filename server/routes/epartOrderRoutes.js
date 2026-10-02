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
      const typeError = new Error('Nur PDF-, Bild- und Office-Dateien (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX) sind erlaubt.');
      typeError.status = 400;
      cb(typeError);
    }
  }
});

// Upload-Middleware mit deutscher 400-Antwort statt Express-Standard-500 (HTML).
function uploadInvoiceFile(req, res, next) {
  upload.single('invoice')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Die Datei ist zu groß (maximal 10 MB).'
        : 'Die Datei konnte nicht hochgeladen werden. Bitte genau eine Datei im Feld „invoice“ senden.';
      return res.status(400).json({ error: message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error uploading epart invoice file:', error);
    return res.status(500).json({ error: 'Die Datei konnte nicht gespeichert werden. Bitte erneut versuchen.' });
  });
}

// Einheitliche Fehlerantwort: fachliche Fehler tragen error.status (400/404/409) und
// deutsche Texte; Mongoose-Validierungs-/Cast-Fehler werden zu 400 statt roher 500.
function sendError(res, error, fallbackStatus = 500) {
  let status = Number(error && error.status) || fallbackStatus;
  let message = (error && error.message) || 'Unbekannter Fehler';
  if (!error?.status) {
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      status = 400;
      const field = error?.path || Object.keys(error?.errors || {})[0] || '';
      message = `Ungültige Eingabe${field ? ` (Feld: ${field})` : ''}.`;
    } else if (error?.code === 11000) {
      status = 409;
      message = 'Ein Eintrag mit diesen Daten existiert bereits. Bitte neu laden und erneut versuchen.';
    } else if (error?.name === 'VersionError' || error?.name === 'DocumentNotFoundError') {
      status = 409;
      message = 'Die Bestellung wurde inzwischen geändert. Bitte neu laden und erneut versuchen.';
    }
  }
  return res.status(status).json({ error: message });
}

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Zugriff verweigert. Nur für Mitarbeitende oder Administratoren.' });
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Zugriff verweigert. Nur für Administratoren.' });
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
    sendError(res, error, 500);
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
    sendError(res, error, 404);
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
    sendError(res, error, 400);
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
    sendError(res, error, 400);
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
    sendError(res, error, 400);
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
    sendError(res, error, 500);
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
    sendError(res, error, 500);
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
    sendError(res, error, 404);
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
    sendError(res, error, 400);
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
    sendError(res, error, 400);
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
    sendError(res, error, 400);
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
    sendError(res, error, 400);
  }
});

// Description: Upload invoice file for order
// Endpoint: POST /api/epart-orders/:id/invoice
// Request: FormData with file
// Response: { order: EPartOrder }
router.post('/:id/invoice', requireUser, requireAdminOrStaff, uploadInvoiceFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bitte eine Datei auswählen.' });
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
    sendError(res, error, 400);
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
      return res.status(404).json({ error: 'Zu dieser Bestellung wurde keine Rechnung hochgeladen.' });
    }

    const filePath = path.join(__dirname, '../uploads/invoices', order.invoiceFile.filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Die Rechnungsdatei wurde auf dem Server nicht gefunden.' });
    }

    res.download(filePath, order.invoiceFile.originalName);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    sendError(res, error, 400);
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
      return res.status(400).json({ error: 'Bitte „Rücksendung“ oder „Umtausch“ auswählen.' });
    }

    if (!reason || !description) {
      return res.status(400).json({ error: 'Bitte Grund und Beschreibung angeben.' });
    }

    if (!affectedItems || affectedItems.length === 0) {
      return res.status(400).json({ error: 'Bitte mindestens eine betroffene Position angeben.' });
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
    sendError(res, error, 400);
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
        error: 'Ungültiger Status für Rücksendung/Umtausch. Erlaubt: genehmigt, unterwegs, abgeschlossen, abgelehnt.'
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
    sendError(res, error, 400);
  }
});

module.exports = router;
