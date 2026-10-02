const express = require('express');
const DeviceInspectionService = require('../services/deviceInspectionService');
const Order = require('../models/Order');
const DeviceInspection = require('../models/DeviceInspection');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Technical errors (Mongoose validation/cast, driver errors, programming errors) carry
// ENGLISH developer text and must never be shown in the German technician UI. They are
// still logged in full by each handler; the client only ever sees a German sentence.
const TECHNICAL_ERROR_NAMES = new Set([
  'ValidationError', 'ValidatorError', 'CastError', 'StrictModeError', 'VersionError',
  'ParallelSaveError', 'DocumentNotFoundError', 'OverwriteModelError', 'DivergentArrayError',
  'MongooseError', 'MongoError', 'MongoServerError', 'MongoNetworkError', 'MongoBulkWriteError',
  'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError',
]);

// Returns the German message to show the technician. Messages thrown by
// DeviceInspectionService are already German and pass through unchanged.
const userFacingError = (error, fallbackDe) => {
  if (!error || typeof error.message !== 'string' || !error.message.trim()) {
    return fallbackDe;
  }
  if (TECHNICAL_ERROR_NAMES.has(error.name)) {
    return fallbackDe;
  }
  return error.message;
};

// Kundenansicht einer Inspektion (K04): POSITIVLISTE statt Ausschlussliste - ein neues
// (internes) Feld erreicht den Kunden nie automatisch. Sichtbar ist der dokumentierte
// Geraetezustand, den die Kundenansicht (InspectionResultsDisplay) rendert: Modell,
// Identifikation, Zubehoer, aeusserer Zustand, Testergebnisse, Apple-Pruefungen, das
// Reparaturangebot (nur der bekannte Preis) und von der Kundeninformation nur Grund und
// ausdruecklicher Kundentext. NIE: interne Notiz (customerInformation.note) und die
// Teamfelder der Kundeninformation (suggestedStatus, mailTemplate, generatedAt),
// Aktionsprotokoll (Technikernamen/-details), Techniker-/Supervisor-IDs, Bericht-Dateipfad
// (reportUrl), Altfelder isRepairable/completionAction.
const pickFields = (source, fields) => {
  if (!source || typeof source !== 'object') return undefined;
  const picked = {};
  fields.forEach((field) => {
    if (source[field] !== undefined) picked[field] = source[field];
  });
  return picked;
};
const pickCheck = (source, fields = ['status', 'notes']) => pickFields(source, fields);
const CUSTOMER_INSPECTION_FIELDS = [
  '_id', 'orderId', 'status', 'currentStep', 'completedSteps', 'hasFailedTests',
  'customerNotificationCreated', 'approvalStatus', 'reportGenerated', 'reportGeneratedAt',
  'startedAt', 'completedAt', 'createdAt', 'updatedAt', 'repairOfferKnownCost',
];
const toCustomerInspectionView = (inspection) => {
  if (!inspection) return inspection;
  const full = typeof inspection.toJSON === 'function' ? inspection.toJSON() : { ...inspection };
  const view = pickFields(full, CUSTOMER_INSPECTION_FIELDS);
  if (view.orderId && typeof view.orderId === 'object' && view.orderId._id) view.orderId = view.orderId._id;
  if (full.modelVerification) {
    view.modelVerification = pickFields(full.modelVerification, [
      'reportedModel', 'actualModel', 'verified', 'verificationStatus', 'costDifference', 'notes',
      'reportedModelSource', 'verifiedAt',
    ]);
  }
  if (full.identification) {
    view.identification = pickFields(full.identification, [
      'deviceType', 'deviceTypeLabel', 'imei', 'serialNumber', 'imeiRequired', 'identified', 'identifiedAt',
    ]);
  }
  if (full.accessories) {
    const accessory = (entry) => pickFields(entry, ['present', 'description']);
    view.accessories = {
      ...pickFields(full.accessories, ['additionalAccessoriesText', 'description', 'checkedAt']),
      ...Object.fromEntries(['originalPackaging', 'caseCover', 'powerAdapter', 'simTray', 'cables']
        .filter((key) => full.accessories[key]).map((key) => [key, accessory(full.accessories[key])])),
      otherAccessories: (full.accessories.otherAccessories || []).map((entry) => pickFields(entry, ['name', 'present', 'description'])),
    };
  }
  if (full.externalInspection) {
    const ext = full.externalInspection;
    view.externalInspection = {
      ...Object.fromEntries(['display', 'frame', 'backCover', 'buttons'].filter((key) => ext[key]).map((key) => [key, pickCheck(ext[key])])),
      ...pickFields(ext, ['uniqueNotes', 'photos', 'inspectedAt']),
      ...(ext.visibleDamages ? { visibleDamages: pickFields(ext.visibleDamages, ['hasDamage', 'description']) } : {}),
    };
  }
  if (full.deviceTest) {
    const test = full.deviceTest;
    view.deviceTest = {
      ...Object.fromEntries(['power', 'wifi', 'frontCamera', 'mainCamera', 'buttons'].filter((key) => test[key]).map((key) => [key, pickCheck(test[key])])),
      ...(test.charging ? { charging: pickCheck(test.charging, ['status', 'current', 'notes']) } : {}),
      ...pickFields(test, ['notes', 'testedAt']),
    };
  }
  if (full.appleSpecific) {
    const apple = full.appleSpecific;
    view.appleSpecific = {
      ...(apple.modemFirmware ? { modemFirmware: pickFields(apple.modemFirmware, ['status', 'present', 'notes']) } : {}),
      ...(apple.touchIdFaceId ? { touchIdFaceId: pickFields(apple.touchIdFaceId, ['status', 'applicable', 'working', 'notes']) } : {}),
      ...(apple.customerInfoAction ? { customerInfoAction: pickFields(apple.customerInfoAction, ['requested', 'note']) } : {}),
      ...pickFields(apple, ['checkedAt']),
    };
  }
  if (Array.isArray(full.failedTestDetails)) {
    view.failedTestDetails = full.failedTestDetails.map((entry) => pickFields(entry, ['testName', 'reason']));
  }
  if (full.repairOffer) {
    // Preis nur als bekannter Betrag (repairOfferKnownCost); kein roher Altwert 0.
    view.repairOffer = pickFields(full.repairOffer, ['timeframe', 'description']);
  }
  if (full.customerInformation && typeof full.customerInformation === 'object') {
    view.customerInformation = pickFields(full.customerInformation, ['shouldInform', 'reason', 'customerMessage', 'sentAt']);
  }
  return view;
};

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Zugriff verweigert. Diese Aktion ist Administratoren und Mitarbeitern vorbehalten.' });
  }
  next();
};

// K09: Inspektions-Schreibzugriffe (Start, Pruefschritte, Abschluss inkl. Kundeninformation)
// sind bei einem STORNIERTEN Auftrag gesperrt - dieselbe Regel wie beim Reparatur-Workflow
// (repairWorkflowService assertOrderOpenForRepair, HIST-14). Lesen bleibt erlaubt.
// Laeuft erst NACH der Rollenpruefung (Kunden erfahren so nichts ueber fremde Auftraege).
const refuseCancelledOrder = async (req, res, next) => {
  const orderId = String(req.params.orderId || req.body?.orderId || '');
  if (!/^[a-f0-9]{24}$/i.test(orderId)) return next();
  try {
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('status').lean();
    if (order && order.status === 'cancelled') {
      return res.status(409).json({
        error: 'Der Auftrag ist storniert – die Inspektion kann nicht gestartet oder geändert werden. Zum Fortsetzen muss ein Admin die Stornierung aufheben.',
        code: 'INSPECTION_ORDER_CANCELLED',
      });
    }
    return next();
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error checking order status:', error);
    return res.status(500).json({ error: 'Der Auftragsstatus konnte nicht geprüft werden.' });
  }
};

// Description: Initialize or get device inspection
// Endpoint: POST /api/device-inspections/init
// Request: { orderId: string, customerId?: string }
// Response: { inspection: DeviceInspection }
router.post('/init', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] POST /init - Initializing inspection');

  try {
    const { orderId, customerId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Auftrags-ID fehlt.' });
    }

    let resolvedCustomerId = customerId || null;

    // Fallback for cases where populated customer relation is null in frontend responses.
    if (!resolvedCustomerId) {
      // skipAutoPopulate: sonst ist customerId ein Benutzer-Dokument und toString() liefert keinen
      // ObjectId-Text (500 "Cast to ObjectId failed" beim Start ohne customerId im Body).
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('customerId');
      if (!order) {
        return res.status(404).json({ error: 'Auftrag nicht gefunden.' });
      }

      if (order.customerId) {
        resolvedCustomerId = String(order.customerId._id || order.customerId);
      }
    }

    const inspection = await DeviceInspectionService.initializeInspection(
      orderId,
      resolvedCustomerId,
      req.user._id
    );

    // warnings: Auftragsstatus/-verlauf konnte nicht aktualisiert werden (nicht verschluckt, HIST-5c).
    const warnings = inspection?.$locals?.warnings || [];
    return res.status(200).json({ inspection, warnings });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error initializing inspection:', error);
    return res.status(500).json({ error: userFacingError(error, 'Inspektion konnte nicht gestartet werden.') });
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
      const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role);
      const currentUserId = req.user._id.toString();

      // Guest orders can have no customerId; in that case only admin/staff may access.
      if (!order.customerId) {
        if (!isAdminOrStaff) {
          console.log('[DeviceInspectionRoutes] Access denied - Guest order requires staff access');
          return res.status(403).json({ error: 'Zugriff verweigert.' });
        }

        return res.status(200).json({ inspection });
      }

      const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();

      if (orderCustomerId !== currentUserId && !isAdminOrStaff) {
        console.log('[DeviceInspectionRoutes] Access denied - User does not own order');
        return res.status(403).json({ error: 'Zugriff verweigert.' });
      }

      if (!isAdminOrStaff) {
        return res.status(200).json({ inspection: toCustomerInspectionView(inspection) });
      }
    }

    // Return null if inspection not found (this is normal, not an error)
    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error fetching inspection:', error);
    return res.status(500).json({ error: userFacingError(error, 'Inspektion konnte nicht geladen werden.') });
  }
});

// Description: Update model verification step
// Endpoint: PUT /api/device-inspections/:orderId/model-verification
// Request: { reportedModel, actualModel, verificationStatus, costDifference?, notes?, supervisorId? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/model-verification', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/model-verification - Updating model verification');

  try {
    const { reportedModel, actualModel, verificationStatus, costDifference, notes, supervisorId, actualModelConfirmed } = req.body;

    if (!reportedModel || !actualModel || !verificationStatus) {
      return res.status(400).json({ error: 'Gemeldetes Modell, tatsächliches Modell und Prüfstatus sind erforderlich.' });
    }

    const inspection = await DeviceInspectionService.updateModelVerification(
      req.params.orderId,
      reportedModel,
      actualModel,
      verificationStatus,
      costDifference || 0,
      notes || '',
      supervisorId,
      // Explicit "the technician picked/typed this value" flag. Without it the server may
      // replace an echoed pre-change model from a stale draft (and says so in `warnings`).
      { actualModelConfirmed: actualModelConfirmed === true }
    );

    const warnings = (inspection && inspection.$locals && inspection.$locals.warnings) || [];

    return res.status(200).json(warnings.length ? { inspection, warnings } : { inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating model verification:', error);
    return res.status(500).json({ error: userFacingError(error, 'Modellprüfung konnte nicht gespeichert werden.') });
  }
});

// Description: Update identification numbers
// Endpoint: PUT /api/device-inspections/:orderId/identification
// Request: { deviceType, imei?, serialNumber? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/identification', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/identification - Updating identification');

  try {
    const { deviceType, imei, serialNumber } = req.body;

    // deviceType is deliberately NOT required: Order.deviceType is free-form and may be
    // empty or an unmapped catalog name. The service normalises it to 'Other' instead of
    // blocking the technician on step 2.
    const inspection = await DeviceInspectionService.updateIdentification(
      req.params.orderId,
      deviceType,
      imei,
      serialNumber
    );

    return res.status(200).json({ inspection });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error updating identification:', error);
    return res.status(400).json({ error: userFacingError(error, 'Identifikation konnte nicht gespeichert werden.') });
  }
});

// Description: Update accessories and packaging
// Endpoint: PUT /api/device-inspections/:orderId/accessories
// Request: { originalPackaging, caseCover, powerAdapter, cables, otherAccessories }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/accessories', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
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
    return res.status(500).json({ error: userFacingError(error, 'Zubehör konnte nicht gespeichert werden.') });
  }
});

// Description: Update external inspection
// Endpoint: PUT /api/device-inspections/:orderId/external-inspection
// Request: { display, frame, backCover, buttons, visibleDamages, uniqueNotes, photos? }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/external-inspection', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/external-inspection - Updating external inspection');

  try {
    const { display, frame, backCover, buttons, visibleDamages, uniqueNotes, photos } = req.body;

    if (!display || !frame || !backCover || !buttons) {
      return res.status(400).json({ error: 'Anzeige, Rahmen, Rückseite und Tasten sind erforderlich.' });
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
    return res.status(500).json({ error: userFacingError(error, 'Äußere Inspektion konnte nicht gespeichert werden.') });
  }
});

// Description: Update device tests
// Endpoint: PUT /api/device-inspections/:orderId/device-tests
// Request: { charging, power, wifi, frontCamera, mainCamera }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/device-tests', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/device-tests - Updating device tests');

  try {
    const testData = req.body;

    if (!testData.charging || !testData.power || !testData.wifi || !testData.frontCamera || !testData.mainCamera) {
      return res.status(400).json({ error: 'Alle Testfelder sind erforderlich: Laden, Einschalten, WLAN, Frontkamera und Hauptkamera.' });
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
    return res.status(500).json({ error: userFacingError(error, 'Gerätetests konnten nicht gespeichert werden.') });
  }
});

// Description: Update Apple-specific checks
// Endpoint: PUT /api/device-inspections/:orderId/apple-specific
// Request: { modemFirmware, touchIdFaceId }
// Response: { inspection: DeviceInspection }
router.put('/:orderId/apple-specific', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
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
    return res.status(500).json({ error: userFacingError(error, 'Apple-spezifische Prüfungen konnten nicht gespeichert werden.') });
  }
});

// Description: Complete inspection
// Endpoint: PUT /api/device-inspections/:orderId/complete
// Request: { repairOffer?: { cost?, costSpecified?, timeframe?, description? }, customerInformation? }
//   isRepairable / completionAction are still accepted for old clients but IGNORED (deprecated,
//   never written). A missing/empty cost stays unknown; 0 counts only with costSpecified: true.
// Response: { inspection: DeviceInspection } - inspection.repairOfferKnownCost: number | null
router.put('/:orderId/complete', requireUser, requireAdminOrStaff, refuseCancelledOrder, async (req, res) => {
  console.log('[DeviceInspectionRoutes] PUT /:orderId/complete - Completing inspection');

  try {
    const { isRepairable, repairOffer, completionAction, customerInformation } = req.body;

    const inspection = await DeviceInspectionService.completeInspection(
      req.params.orderId,
      isRepairable,
      repairOffer,
      completionAction,
      customerInformation,
      { actor: req.user }
    );

    // customerNotification: { status: 'sent' | 'duplicate' | 'skipped' | 'failed', reason?, error? }
    // (Kundeninformation zu einem Defekt, getrennt vom Speichererfolg gemeldet - NOTIF-7)
    // warnings: Auftragsverlauf konnte nicht aktualisiert werden (HIST-10).
    return res.status(200).json({
      inspection,
      customerNotification: inspection?.$locals?.customerNotification || { status: 'skipped' },
      warnings: inspection?.$locals?.warnings || [],
    });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error completing inspection:', error);
    return res.status(500).json({ error: userFacingError(error, 'Inspektion konnte nicht abgeschlossen werden.') });
  }
});

// Description: Generate inspection report
// Endpoint: GET /api/device-inspections/:orderId/report
// Request: {}
// Response: { inspection: DeviceInspection, reportUrl: string }
router.get('/:orderId/report', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceInspectionRoutes] GET /:orderId/report - Generating inspection report');

  try {
    // Storniert: einen Bericht einer ABGESCHLOSSENEN Inspektion darf das Team weiter erstellen/lesen; eine
    // laufende Inspektion ist gesperrt (der Bericht schreibt Datei + reportGenerated an die Inspektion).
    if (/^[a-f0-9]{24}$/i.test(String(req.params.orderId || ''))) {
      const order = await Order.findById(req.params.orderId).setOptions({ skipAutoPopulate: true }).select('status').lean();
      if (order && order.status === 'cancelled') {
        const current = await DeviceInspection.findOne({ orderId: req.params.orderId }).select('status').lean();
        if (!current || current.status !== 'completed') {
          return res.status(409).json({
            error: 'Der Auftrag ist storniert – für eine nicht abgeschlossene Inspektion wird kein Prüfbericht erstellt.',
            code: 'INSPECTION_ORDER_CANCELLED',
          });
        }
      }
    }
    const inspection = await DeviceInspectionService.generateInspectionReport(req.params.orderId);

    return res.status(200).json({
      inspection,
      reportUrl: inspection.reportUrl,
    });
  } catch (error) {
    console.error('[DeviceInspectionRoutes] Error generating report:', error);
    return res.status(500).json({ error: userFacingError(error, 'Prüfbericht konnte nicht erstellt werden.') });
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
    return res.status(500).json({ error: userFacingError(error, 'Inspektionen konnten nicht geladen werden.') });
  }
});

module.exports = router;
