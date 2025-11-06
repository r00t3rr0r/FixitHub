const express = require('express');
const DeviceInspectionService = require('../services/deviceInspectionService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin or staff role required.' });
  }
  next();
};

// Description: Initialize or get device inspection
// Endpoint: POST /api/device-inspections/init
// Request: { orderId: string, customerId: string }
// Response: { inspection: DeviceInspection }
router.post('/init', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] POST /init - Initializing inspection');

  try {
    const { orderId, customerId } = req.body;

    if (!orderId || !customerId) {
      return res.status(400).json({ error: 'orderId and customerId are required' });
    }

    const inspection = await DeviceInspectionService.initializeInspection(
      orderId,
      customerId,
      req.user._id
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error initializing inspection:', error);
    return res.status(500).json({ error: error.message || 'Failed to initialize inspection' });
  }
});

// Description: Get inspection by order ID
// Endpoint: GET /api/device-inspections/:orderId
// Request: {}
// Response: { inspection: DeviceInspection | null }
// Note: Customers can view their own order's completed inspection, admin/staff can view any inspection
router.get('/:orderId', requireUser, async (req, res) => {
  console.log('[DeviceInspectionRoutes] GET /:orderId - Fetching inspection');

  try {
    const inspection = await DeviceInspectionService.getByOrderId(req.params.orderId);

    // If inspection exists, check permissions
    if (inspection) {
      const OrderService = require('../services/orderService');
      const order = await OrderService.getById(req.params.orderId);

      // Check if user owns this order or is admin/staff
      const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();
      const currentUserId = req.user._id.toString();

      if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
        console.log('[DeviceInspectionRoutes] Access denied - User does not own order');
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Return null if inspection not found (this is normal, not an error)
    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error fetching inspection:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch inspection' });
  }
});

// Description: Update model verification step
// Endpoint: PUT /api/device-inspections/:orderId/model-verification
// Request: { reportedModel, actualModel, verificationStatus, costDifference?, notes?, supervisorId? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/model-verification', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/model-verification - Updating model verification');

  try {
    const { reportedModel, actualModel, verificationStatus, costDifference, notes, supervisorId } = req.body;

    if (!reportedModel || !actualModel || !verificationStatus) {
      return res.status(400).json({ error: 'reportedModel, actualModel, and verificationStatus are required' });
    }

    const inspection = await DeviceInspectionService.updateModelVerification(
      req.params.orderId,
      reportedModel,
      actualModel,
      verificationStatus,
      costDifference || 0,
      notes || '',
      supervisorId
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating model verification:', error);
    return res.status(500).json({ error: error.message || 'Failed to update model verification' });
  }
});

// Description: Update identification numbers
// Endpoint: PUT /api/device-inspections/:orderId/identification
// Request: { deviceType, imei?, serialNumber? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/identification', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/identification - Updating identification');

  try {
    const { deviceType, imei, serialNumber } = req.body;

    if (!deviceType) {
      return res.status(400).json({ error: 'deviceType is required' });
    }

    const inspection = await DeviceInspectionService.updateIdentification(
      req.params.orderId,
      deviceType,
      imei,
      serialNumber
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating identification:', error);
    return res.status(400).json({ error: error.message || 'Failed to update identification' });
  }
});

// Description: Update accessories and packaging
// Endpoint: PUT /api/device-inspections/:orderId/accessories
// Request: { originalPackaging, caseCover, powerAdapter, cables, otherAccessories }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/accessories', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/accessories - Updating accessories');

  try {
    const accessoriesData = req.body;

    const inspection = await DeviceInspectionService.updateAccessories(
      req.params.orderId,
      accessoriesData
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating accessories:', error);
    return res.status(500).json({ error: error.message || 'Failed to update accessories' });
  }
});

// Description: Update external inspection
// Endpoint: PUT /api/device-inspections/:orderId/external-inspection
// Request: { display, frame, backCover, buttons, visibleDamages, uniqueNotes, photos? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/external-inspection', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/external-inspection - Updating external inspection');

  try {
    const { display, frame, backCover, buttons, visibleDamages, uniqueNotes, photos } = req.body;

    if (!display || !frame || !backCover || !buttons) {
      return res.status(400).json({ error: 'display, frame, backCover, and buttons are required' });
    }

    const inspectionData = {
      display,
      frame,
      backCover,
      buttons,
      visibleDamages,
      uniqueNotes,
    };

    const inspection = await DeviceInspectionService.updateExternalInspection(
      req.params.orderId,
      inspectionData,
      photos || []
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating external inspection:', error);
    return res.status(500).json({ error: error.message || 'Failed to update external inspection' });
  }
});

// Description: Update device tests
// Endpoint: PUT /api/device-inspections/:orderId/device-tests
// Request: { charging, power, wifi, frontCamera, mainCamera }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/device-tests', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/device-tests - Updating device tests');

  try {
    const testData = req.body;

    if (!testData.charging || !testData.power || !testData.wifi || !testData.frontCamera || !testData.mainCamera) {
      return res.status(400).json({ error: 'All test fields are required: charging, power, wifi, frontCamera, mainCamera' });
    }

    const inspection = await DeviceInspectionService.updateDeviceTest(
      req.params.orderId,
      testData,
      req.user._id
    );

    return res.status(200).json({
      inspection,
      hasFailedTests: inspection.hasFailedTests,
      failedTestDetails: inspection.failedTestDetails,
    });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating device tests:', error);
    return res.status(500).json({ error: error.message || 'Failed to update device tests' });
  }
});

// Description: Update Apple-specific checks
// Endpoint: PUT /api/device-inspections/:orderId/apple-specific
// Request: { modemFirmware, touchIdFaceId }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/apple-specific', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/apple-specific - Updating Apple-specific checks');

  try {
    const appleData = req.body;

    const inspection = await DeviceInspectionService.updateAppleSpecific(
      req.params.orderId,
      appleData
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating Apple-specific checks:', error);
    return res.status(500).json({ error: error.message || 'Failed to update Apple-specific checks' });
  }
});

// Description: Complete inspection
// Endpoint: PUT /api/device-inspections/:orderId/complete
// Request: { isRepairable, repairOffer? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/complete', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/complete - Completing inspection');

  try {
    const { isRepairable, repairOffer } = req.body;

    if (isRepairable === undefined) {
      return res.status(400).json({ error: 'isRepairable is required' });
    }

    const inspection = await DeviceInspectionService.completeInspection(
      req.params.orderId,
      isRepairable,
      repairOffer
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error completing inspection:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete inspection' });
  }
});

// Description: Generate inspection report
// Endpoint: GET /api/device-inspections/:orderId/report
// Request: {}
// Response: { inspection: DeviceInspection, reportUrl: string }
router.get('/:orderId/report', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] GET /:orderId/report - Generating inspection report');

  try {
    const inspection = await DeviceInspectionService.generateInspectionReport(req.params.orderId);

    return res.status(200).json({
      inspection,
      reportUrl: inspection.reportUrl,
    });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error generating report:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// Description: Get technician inspections
// Endpoint: GET /api/device-inspections
// Request: { status?, hasFailedTests?, page?, limit? }
// Response: { inspections: DeviceInspection[], total: number }
router.get('/', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] GET / - Fetching technician inspections');

  try {
    const filters = {
      status: req.query.status,
      hasFailedTests: req.query.hasFailedTests === 'true',
      page: parseInt(req.query.page) || 0,
      limit: parseInt(req.query.limit) || 50,
    };

    const inspections = await DeviceInspectionService.getTechnicianInspections(req.user._id, filters);

    return res.status(200).json({
      inspections,
      total: inspections.length,
    });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error fetching inspections:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch inspections' });
  }
});

module.exports = router;
