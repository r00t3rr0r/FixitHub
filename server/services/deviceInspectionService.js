const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');
const OrderService = require('./orderService');
const EmailService = require('./emailService');
const pdfkit = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Canonical inspection device types (must stay inside identificationSchema.deviceType's enum).
const CANONICAL_DEVICE_TYPES = {
  smartphone: 'Smartphone',
  handy: 'Smartphone',
  mobiltelefon: 'Smartphone',
  mobilephone: 'Smartphone',
  phone: 'Smartphone',
  telefon: 'Smartphone',
  iphone: 'Smartphone',
  laptop: 'Laptop',
  notebook: 'Laptop',
  macbook: 'Laptop',
  tablet: 'Tablet',
  ipad: 'Tablet',
  watch: 'Watch',
  smartwatch: 'Watch',
  applewatch: 'Watch',
  wearable: 'Watch',
  uhr: 'Watch',
  headphone: 'Headphones',
  headset: 'Headphones',
  kopfhoerer: 'Headphones',
  ohrhoerer: 'Headphones',
  earphone: 'Headphones',
  earbud: 'Headphones',
  airpod: 'Headphones',
};

// Free-form order device types (admin-editable catalog names, German or English,
// singular or plural) are normalised here. Unknown values are NOT an error - they
// map to 'Other' so the technician is never blocked on step 2.
// Keep in sync with normalizeInspectionDeviceType() in
// client/src/components/inspection/DeviceInspectionForm.tsx.
const normalizeInspectionDeviceType = (deviceType) => {
  const slug = String(deviceType || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

  if (!slug) {
    return 'Other';
  }

  // Catalogue names are frequently plural ("Smartphones", "Smartwatches").
  const candidates = [slug, slug.replace(/es$/, ''), slug.replace(/s$/, '')];
  for (const candidate of candidates) {
    if (CANONICAL_DEVICE_TYPES[candidate]) {
      return CANONICAL_DEVICE_TYPES[candidate];
    }
  }

  return 'Other';
};

const FAILED_TEST_LABELS = {
  charging: 'Laden',
  power: 'Einschalten',
  wifi: 'WLAN',
  frontCamera: 'Frontkamera',
  mainCamera: 'Hauptkamera',
  buttons: 'Tasten',
};

// German labels for stored enum values in the PDF report (raw English values must not reach it).
const REPORT_LABELS = {
  verification: {
    correct: 'Korrekt - Modell stimmt überein',
    'incorrect-more-expensive': 'Abweichend - teureres Modell',
    'incorrect-same-cheaper': 'Abweichend - gleichwertiges oder günstigeres Modell',
    unverifiable: 'Nicht verifizierbar',
  },
  condition: {
    '--': 'Keine optischen Auffälligkeiten',
    OK: 'In Ordnung',
    'Not OK': 'Nicht in Ordnung',
    'light-wear': 'Leichte Gebrauchsspuren',
    'scratches-wear': 'Kratzer und Gebrauchsspuren',
    'heavy-scratches-wear': 'Schwere Kratzer und Gebrauchsspuren',
    damaged: 'Beschädigt',
    working: 'Funktionieren',
    'not-working': 'Nicht funktionierend',
  },
  test: {
    OK: 'In Ordnung',
    'Not OK': 'Nicht in Ordnung',
    'Not tested': 'Nicht getestet',
  },
  apple: {
    working: 'Funktioniert',
    defective: 'Defekt',
    'not-testable': 'Nicht testbar',
    'not-applicable': 'Nicht vorhanden',
  },
  status: {
    'not-started': 'Nicht begonnen',
    'in-progress': 'In Bearbeitung',
    completed: 'Abgeschlossen',
    'on-hold': 'Pausiert',
  },
  deviceType: {
    Smartphone: 'Smartphone',
    Laptop: 'Laptop',
    Tablet: 'Tablet',
    Watch: 'Smartwatch',
    Headphones: 'Kopfhörer',
    Other: 'Sonstiges',
  },
};

const reportLabel = (group, value) => {
  if (value === undefined || value === null || value === '') {
    return 'Nicht angegeben';
  }
  return (REPORT_LABELS[group] && REPORT_LABELS[group][value]) || String(value);
};

// A lazily captured Order.reportedDevice (pre('save')) and the 'Device Changed' timeline entry of
// the same save differ by milliseconds; anything later than this was captured at a later change.
const SNAPSHOT_SAME_SAVE_TOLERANCE_MS = 5000;

class DeviceInspectionService {
  static normalizeDeviceType(deviceType) {
    return normalizeInspectionDeviceType(deviceType);
  }

  static _buildDeviceLabel(brand, model) {
    return [brand, model]
      .filter((part) => part && part !== 'N/A')
      .join(' ')
      .trim();
  }

  static _markStepCompleted(inspection, stepNumber) {
    const alreadyCompleted = (inspection.completedSteps || []).some((entry) => entry.step === stepNumber);
    if (!alreadyCompleted) {
      inspection.completedSteps.push({ step: stepNumber, completedAt: new Date() });
    }
  }

  // "From" device of a recorded 'Device Changed' timeline entry. Only the two formats the app
  // has actually written are read; anything else is NOT guessed.
  static _parseDeviceChangeOrigin(description) {
    const text = String(description || '').trim();
    const german = text.match(/^Modellwechsel:\s*(.+?)\s*->\s*.+$/);
    const english = text.match(/^Device changed from\s+(.+?)\s+to\s+.+$/i);
    const origin = (german && german[1]) || (english && english[1]) || '';
    return origin.replace(/^N\/A\s+/, '').replace(/\s+/g, ' ').trim();
  }

  // The device the customer originally reported, and how reliable that statement is.
  // Never invents history: without a snapshot or a readable recorded change the current device
  // is used and explicitly marked as unverified.
  static _resolveReportedDevice(order) {
    const currentModel = this._buildDeviceLabel(order?.deviceBrand, order?.deviceModel);
    const snapshotModel = this._buildDeviceLabel(order?.reportedDevice?.brand, order?.reportedDevice?.model);
    const snapshotAt = order?.reportedDevice?.capturedAt ? new Date(order.reportedDevice.capturedAt) : null;
    const recordedChanges = (Array.isArray(order?.timeline) ? order.timeline : [])
      .filter((entry) => entry && entry.status === 'Device Changed')
      .sort((a, b) => new Date(a.completedAt || 0) - new Date(b.completedAt || 0));
    const firstChange = recordedChanges[0] || null;
    const firstChangeAt = firstChange && firstChange.completedAt ? new Date(firstChange.completedAt) : null;
    const timelineOrigin = firstChange ? this._parseDeviceChangeOrigin(firstChange.description) : '';

    if (snapshotModel) {
      // Written at order creation (or before any recorded change): authoritative.
      // The legacy capture in Order's pre('save') runs a few milliseconds AFTER the timeline
      // entry of the same change was stamped (OrderService.updateDevice), so an exact "<=" would
      // demote a genuine snapshot. A snapshot that names the recorded origin of the first change,
      // or was taken within the same save, is the state before that change.
      const sameDevice = (a, b) => String(a || '').replace(/\s+/g, ' ').trim().toLowerCase()
        === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const snapshotPredatesChanges = !firstChangeAt || !snapshotAt
        || snapshotAt.getTime() <= firstChangeAt.getTime()
        || (timelineOrigin
          ? sameDevice(snapshotModel, timelineOrigin)
          : snapshotAt.getTime() - firstChangeAt.getTime() <= SNAPSHOT_SAME_SAVE_TOLERANCE_MS);
      if (snapshotPredatesChanges) {
        return { model: snapshotModel, source: 'order-snapshot' };
      }
      // Legacy order: snapshot captured lazily after an earlier change - the oldest recorded
      // change knows better, if it is readable.
      if (timelineOrigin) {
        return { model: timelineOrigin, source: 'order-timeline' };
      }
      return { model: snapshotModel, source: 'order-snapshot-unverified' };
    }

    if (!firstChange) {
      return { model: currentModel, source: 'order-current' };
    }
    if (timelineOrigin) {
      return { model: timelineOrigin, source: 'order-timeline' };
    }
    return { model: currentModel, source: 'order-current-unverified' };
  }

  // Strict repair offer: a missing / empty price stays UNKNOWN (no cost field), never 0.
  // cost 0 counts only with costSpecified === true (a deliberately free quote); clients before
  // 25.09.2026 sent 0 whenever no price existed.
  static _normalizeRepairOffer(repairOffer) {
    if (!repairOffer || typeof repairOffer !== 'object') {
      return null;
    }

    const timeframe = String(repairOffer.timeframe || '').trim();
    const description = String(repairOffer.description || '').trim();
    const rawCost = repairOffer.cost;
    let cost;

    const hasRawCost = rawCost !== null
      && rawCost !== undefined
      && !(typeof rawCost === 'string' && rawCost.trim() === '');
    if (hasRawCost) {
      const parsed = typeof rawCost === 'number' ? rawCost : Number(String(rawCost).trim().replace(',', '.'));
      if (Number.isFinite(parsed) && parsed >= 0 && (repairOffer.costSpecified === true || parsed > 0)) {
        cost = Math.round(parsed * 100) / 100;
      }
    }

    if (cost === undefined && !timeframe && !description) {
      return null;
    }

    const normalized = { timeframe, description, costSpecified: cost !== undefined };
    if (cost !== undefined) {
      normalized.cost = cost;
    }
    return normalized;
  }

  static _formatEuro(value) {
    return `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  }

  // Create or get inspection for an order
  static async initializeInspection(orderId, customerId, technicianId) {
    console.log(`[DeviceInspection] Initializing inspection for order: ${orderId}`);

    try {
      let resolvedCustomerId = customerId || null;

      const order = await Order.findById(orderId)
        .select('customerId deviceBrand deviceModel deviceType reportedDevice timeline');
      if (!order) {
        throw new Error('Auftrag nicht gefunden.');
      }

      if (!resolvedCustomerId && order.customerId) {
        resolvedCustomerId = order.customerId;
      }

      // Check if inspection already exists
      let inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        // "Gemeldetes Modell" is the device the customer originally booked. Order.reportedDevice
        // is the authoritative snapshot; legacy orders without it fall back to the recorded
        // device-change history, and only then to the current device (marked as unverified
        // when a change is recorded that cannot be read).
        const currentModel = this._buildDeviceLabel(order.deviceBrand, order.deviceModel);
        const reportedDevice = this._resolveReportedDevice(order);
        const reportedModelSnapshot = reportedDevice.model || currentModel;
        // "Tatsaechliches Modell" is the order's CURRENT (possibly already corrected) device,
        // so a device change made before the inspection existed is not lost.
        const actualModelSnapshot = currentModel || reportedModelSnapshot;

        inspection = new DeviceInspection({
          orderId,
          customerId: resolvedCustomerId,
          technicianId,
          status: 'in-progress',
          startedAt: new Date(),
        });

        if (reportedModelSnapshot && actualModelSnapshot) {
          inspection.modelVerification = {
            reportedModel: reportedModelSnapshot,
            reportedModelSource: reportedDevice.source,
            actualModel: actualModelSnapshot,
            verified: true,
            verificationStatus: 'correct',
            costDifference: 0,
            verifiedAt: new Date(),
          };
        }

        try {
          await inspection.save();
          console.log(`[DeviceInspection] New inspection created: ${inspection._id}`);
        } catch (saveError) {
          // If duplicate key error, try to fetch the existing inspection
          if (saveError.code === 11000) {
            console.log(`[DeviceInspection] Duplicate inspection found, retrieving existing one`);
            inspection = await DeviceInspection.findOne({ orderId });
            if (!inspection) {
              throw new Error('Bestehende Inspektion konnte nicht geladen werden. Bitte erneut versuchen.');
            }
          } else {
            throw saveError;
          }
        }

        // Update order state through OrderService so status notifications stay centralized.
        try {
          const updatedOrder = await OrderService.updateStatus(
            orderId,
            'diagnostic-assessment',
            'Device inspection has been initiated by technician',
            technicianId
          );
          console.log(`[DeviceInspection] Order status updated to 'diagnostic-assessment' for order: ${updatedOrder?._id || orderId}`);
        } catch (orderError) {
          console.error(`[DeviceInspection] Error updating order status:`, orderError);
          // Don't throw - status update failure shouldn't block inspection initialization
        }
      }

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error initializing inspection:`, error);
      throw error;
    }
  }

  // Get inspection by order ID
  static async getByOrderId(orderId) {
    console.log(`[DeviceInspection] Retrieving inspection for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId })
        .populate('technicianId', 'name email avatar')
        .populate('customerId', 'name email');

      if (!inspection) {
        console.log(`[DeviceInspection] No inspection found for order: ${orderId}`);
        return null;
      }

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error getting inspection:`, error);
      throw error;
    }
  }

  // Update model verification step
  static async updateModelVerification(
    orderId,
    reportedModel,
    actualModel,
    verificationStatus,
    costDifference = 0,
    notes = '',
    supervisorId = null,
    options = {}
  ) {
    console.log(`[DeviceInspection] Updating model verification for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      const verified = verificationStatus === 'correct';

      const order = await Order.findById(orderId)
        .select('deviceBrand deviceModel reportedDevice timeline');
      const orderCurrentModel = this._buildDeviceLabel(order?.deviceBrand, order?.deviceModel);
      const resolvedReportedDevice = order ? this._resolveReportedDevice(order) : { model: '', source: undefined };
      const orderReportedModel = resolvedReportedDevice.model;

      // E1: "Gemeldetes Modell" is WRITE-ONCE. An already recorded lock ALWAYS wins - it is
      // the historically correct value and must never be moved by a later device correction.
      // Order.reportedDevice is only a fallback: for legacy orders it is captured lazily at
      // the first correction and can therefore itself already hold a corrected device.
      // It stays authoritative for NEW inspections via initializeInspection().
      const existingLock = inspection.modelVerification?.reportedModel;
      const lockedReportedModel = existingLock || orderReportedModel || reportedModel;
      const lockedReportedModelSource = existingLock
        ? inspection.modelVerification?.reportedModelSource
        : (orderReportedModel ? resolvedReportedDevice.source : undefined);

      const submittedReportedModel = String(reportedModel || '').trim();
      const submittedActualModel = String(actualModel || '').trim() || orderCurrentModel;
      // Explicit, deterministic signal from the client: the technician actively picked or
      // typed this value, so it is NEVER overridden. Guessing from the value alone used to
      // discard a legitimate "the device really IS the originally reported one" input.
      const actualModelConfirmed = options.actualModelConfirmed === true;

      // The only case still corrected is the stale-draft ECHO: a draft written before the
      // device correction posts the pre-change device in BOTH fields, which would silently
      // revert the order's corrected device. Never silent - it is reported back as a warning.
      const isStaleDraftEcho =
        !actualModelConfirmed &&
        Boolean(orderCurrentModel) &&
        Boolean(submittedReportedModel) &&
        Boolean(submittedActualModel) &&
        submittedReportedModel.toLowerCase() === submittedActualModel.toLowerCase() &&
        orderCurrentModel.toLowerCase() !== submittedActualModel.toLowerCase();
      const resolvedActualModel = isStaleDraftEcho ? orderCurrentModel : submittedActualModel;
      const warnings = [];

      if (isStaleDraftEcho) {
        warnings.push(
          `Das übermittelte tatsächliche Modell "${submittedActualModel}" stammt aus einem Entwurf von vor der Gerätekorrektur und wurde durch das aktuelle Gerät des Auftrags "${orderCurrentModel}" ersetzt. Bitte prüfen und bei Bedarf erneut speichern.`
        );
        console.warn(
          `[DeviceInspection] Replaced stale draft actualModel "${submittedActualModel}" for order ${orderId} with corrected device "${orderCurrentModel}"`
        );
      }

      inspection.modelVerification = {
        reportedModel: lockedReportedModel,
        reportedModelSource: lockedReportedModelSource,
        actualModel: resolvedActualModel,
        verified,
        verificationStatus,
        costDifference,
        supervisorNotified: verificationStatus === 'unverifiable',
        supervisorId,
        notes,
        verifiedAt: new Date(),
      };

      // Mark step as completed if it's not unverifiable
      if (verificationStatus !== 'unverifiable') {
        this._markStepCompleted(inspection, 1);
      }

      await inspection.save();
      // Surfaced by the route as `warnings`, so a replaced value is reported to the
      // technician instead of disappearing silently.
      inspection.$locals.warnings = warnings;
      console.log(`[DeviceInspection] Model verification updated`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating model verification:`, error);
      throw error;
    }
  }

  // Update identification numbers
  static async updateIdentification(orderId, deviceType, imei = null, serialNumber = null) {
    console.log(`[DeviceInspection] Updating identification for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      // Order.deviceType is free-form (admin-editable catalog names), so an unknown value
      // must never block the inspection - it is recorded as 'Other' with the original label.
      const normalizedDeviceType = normalizeInspectionDeviceType(deviceType);
      const rawDeviceTypeLabel = String(deviceType || '').trim();

      if (normalizedDeviceType === 'Other') {
        console.warn(
          `[DeviceInspection] Unmapped device type "${rawDeviceTypeLabel}" for order ${orderId}, recording as 'Other'`
        );
      }

      // IMEI is optional for smartphones in this workflow.
      const identified =
        (normalizedDeviceType === 'Smartphone' && Boolean(imei || serialNumber)) ||
        (['Laptop', 'Tablet'].includes(normalizedDeviceType) && Boolean(serialNumber)) ||
        (!['Smartphone', 'Laptop', 'Tablet'].includes(normalizedDeviceType));

      inspection.identification = {
        deviceType: normalizedDeviceType,
        deviceTypeLabel: rawDeviceTypeLabel,
        imei: imei || null,
        serialNumber: serialNumber || null,
        imeiRequired: normalizedDeviceType === 'Smartphone' && !imei,
        identified,
        identifiedAt: new Date(),
      };

      this._markStepCompleted(inspection, 2);

      await inspection.save();
      console.log(`[DeviceInspection] Identification updated`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating identification:`, error);
      throw error;
    }
  }

  // Update accessories and packaging
  static async updateAccessories(orderId, accessoriesData) {
    console.log(`[DeviceInspection] Updating accessories for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      const normalizedOtherAccessories = Array.isArray(accessoriesData.otherAccessories)
        ? accessoriesData.otherAccessories
        : [];

      inspection.accessories = {
        ...accessoriesData,
        otherAccessories: normalizedOtherAccessories,
        checkedAt: new Date(),
      };

      this._markStepCompleted(inspection, 3);

      await inspection.save();
      console.log(`[DeviceInspection] Accessories updated`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating accessories:`, error);
      throw error;
    }
  }

  // Update external inspection
  static async updateExternalInspection(orderId, inspectionData, photos = []) {
    console.log(`[DeviceInspection] Updating external inspection for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      const isDamagedCategory = ['damaged'].includes(inspectionData?.display?.status)
        || ['damaged'].includes(inspectionData?.frame?.status)
        || ['damaged'].includes(inspectionData?.backCover?.status);

      const normalizedVisibleDamages = {
        hasDamage: Boolean(inspectionData?.visibleDamages?.hasDamage || isDamagedCategory),
        description: inspectionData?.visibleDamages?.description || '',
      };

      inspection.externalInspection = {
        ...inspectionData,
        visibleDamages: normalizedVisibleDamages,
        photos,
        inspectedAt: new Date(),
      };

      this._markStepCompleted(inspection, 4);

      await inspection.save();
      console.log(`[DeviceInspection] External inspection updated`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating external inspection:`, error);
      throw error;
    }
  }

  // Update device testing results
  static async updateDeviceTest(orderId, testData, technicianId) {
    console.log(`[DeviceInspection] Updating device test for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      inspection.deviceTest = {
        ...testData,
        testedAt: new Date(),
      };

      // Check for failed tests
      const failedTests = [];
      Object.entries(testData).forEach(([testName, testResult]) => {
        const testFailed = testResult.status === 'Not OK'
          || (testName === 'buttons' && testResult.status === 'not-working');

        if (testFailed) {
          failedTests.push({
            testName: FAILED_TEST_LABELS[testName] || (testName.charAt(0).toUpperCase() + testName.slice(1)),
            reason: testResult.notes || 'Funktioniert nicht einwandfrei',
          });
        }
      });

      if (failedTests.length > 0) {
        inspection.hasFailedTests = true;
        inspection.failedTestDetails = failedTests;

        // Create customer notification subtask
        await this._createCustomerNotification(inspection, technicianId);
      }

      this._markStepCompleted(inspection, 5);

      await inspection.save();
      console.log(`[DeviceInspection] Device test updated. Failed tests: ${failedTests.length}`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating device test:`, error);
      throw error;
    }
  }

  // Update Apple-specific checks
  static async updateAppleSpecific(orderId, appleData) {
    console.log(`[DeviceInspection] Updating Apple-specific checks for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      inspection.appleSpecific = {
        ...appleData,
        checkedAt: new Date(),
      };

      this._markStepCompleted(inspection, 6);

      await inspection.save();
      console.log(`[DeviceInspection] Apple-specific checks updated`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error updating Apple checks:`, error);
      throw error;
    }
  }

  // Create customer notification for failed tests
  static async _createCustomerNotification(inspection, technicianId) {
    try {
      if (inspection.customerNotificationCreated) {
        console.log(`[DeviceInspection] Customer failed-test notification already created, skipping duplicate`);
        return;
      }

      console.log(`[DeviceInspection] Creating customer notification for failed tests`);

      const failedTestsText = inspection.failedTestDetails
        .map(t => `- ${t.testName}: ${t.reason}`)
        .join('\n');

      await NotificationService.createNotification({
        userId: inspection.customerId,
        type: 'order-alert',
        title: 'Auffälligkeiten beim Gerätetest',
        message: `Beim Test Ihres Geräts sind folgende Auffälligkeiten aufgefallen:\n${failedTestsText}\nEin Techniker meldet sich in Kürze mit den Reparaturmöglichkeiten bei Ihnen.`,
        metadata: {
          orderId: inspection.orderId,
          inspectionId: inspection._id,
          failedTests: inspection.failedTestDetails,
        },
      });

      inspection.customerNotificationCreated = true;
      console.log(`[DeviceInspection] Customer notification created`);
    } catch (error) {
      console.error(`[DeviceInspection] Error creating customer notification:`, error);
      // Don't throw - notification failure shouldn't block inspection
    }
  }

  // Complete inspection and generate report
  // options._concurrentRetry: internal - set when this call lost the completion race (see below).
  static async completeInspection(orderId, isRepairable = null, repairOffer = null, completionAction = null, customerInformation = null, options = {}) {
    console.log(`[DeviceInspection] Completing inspection for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      const wasAlreadyCompleted = inspection.status === 'completed';

      inspection.status = 'completed';
      inspection.completedAt = new Date();

      // DEPRECATED fields: the "Reparatureinschaetzung" control no longer exists, so nothing a
      // client sends here is a decision someone made - the client build of 15.09.2026 still sends
      // completionAction='repairable' / isRepairable=true BY DEFAULT. They are therefore never
      // written; values already stored stay untouched (history) and are never displayed.
      if (typeof isRepairable === 'boolean' || completionAction) {
        console.warn(
          `[DeviceInspection] Ignoring deprecated isRepairable/completionAction for order ${orderId} (no longer part of the inspection)`
        );
      }

      if (customerInformation && typeof customerInformation === 'object') {
        inspection.customerInformation = {
          shouldInform: Boolean(customerInformation.shouldInform),
          reason: customerInformation.reason || '',
          note: customerInformation.note || '',
          suggestedStatus: customerInformation.suggestedStatus || '',
          mailTemplate: customerInformation.mailTemplate || '',
          generatedAt: customerInformation.mailTemplate ? new Date() : null,
        };
      }

      const normalizedOffer = this._normalizeRepairOffer(repairOffer);
      if (normalizedOffer) {
        const previousKnownCost = DeviceInspection.resolveKnownRepairCost(inspection.repairOffer);
        // Step 7 has no price input: a payload WITHOUT a price is never a deliberate removal (the
        // 15.09 client sends cost 0 without costSpecified whenever it has no price). A quote that
        // is already known - including an explicit free one - is kept.
        if (!normalizedOffer.costSpecified && previousKnownCost !== null) {
          normalizedOffer.cost = previousKnownCost;
          normalizedOffer.costSpecified = true;
        }
        inspection.repairOffer = normalizedOffer;
        // Only a real price is something the customer can approve. Re-completing with the SAME
        // price must not reset a decision the customer already made; a changed price is a new
        // quote and needs a new approval.
        if (normalizedOffer.costSpecified) {
          const priceChanged = previousKnownCost === null || previousKnownCost !== normalizedOffer.cost;
          const decisionMade = ['approved', 'rejected'].includes(inspection.approvalStatus);
          if (priceChanged || !decisionMade) {
            inspection.approvalStatus = 'awaiting-customer';
          }
        }
      }

      // Log completion
      inspection.actionLogs.push({
        action: 'Inspection completed',
        timestamp: new Date(),
        technicianId: inspection.technicianId,
        technicianName: inspection.technicianId.name || 'Unknown',
        resultStatus: 'success',
        details: {
          hasFailedTests: inspection.hasFailedTests,
        },
      });

      // ATOMIC completion transition: the first completion is saved only while the stored status is
      // still not 'completed' (conditional save via doc.$where). Of two parallel completions
      // (double-click on step 7) exactly one wins and performs the side effects (diagnosis e-mail).
      // The loser re-reads the now completed inspection and is applied as a re-completion: its
      // data is kept, no second e-mail is sent.
      if (!wasAlreadyCompleted) {
        inspection.$where = { status: { $ne: 'completed' } };
      }
      try {
        await inspection.save();
      } catch (saveError) {
        if (saveError && saveError.name === 'DocumentNotFoundError' && !wasAlreadyCompleted && !options._concurrentRetry) {
          console.log(`[DeviceInspection] Inspection ${inspection._id} was completed concurrently - applying this request as a re-completion`);
          return this.completeInspection(orderId, isRepairable, repairOffer, completionAction, customerInformation, { _concurrentRetry: true });
        }
        throw saveError;
      } finally {
        inspection.$where = undefined;
      }
      console.log(`[DeviceInspection] Inspection completed: ${inspection._id}`);

      if (wasAlreadyCompleted) {
        console.log(`[DeviceInspection] Inspection was already completed, skipping duplicate diagnosis email`);
        return inspection;
      }

      // Send customer notification email asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          const order = await Order.findById(orderId)
            .populate('customerId', 'firstName lastName name email')
            .select('orderNumber deviceBrand deviceModel customerId');

          if (order && order.customerId && order.customerId.email) {
            const customerName = String(
              `${order.customerId.firstName || ''} ${order.customerId.lastName || ''}`.trim() ||
              order.customerId.name ||
              order.customerId.email
            );

            // Only an explicitly given price is quoted; a missing price is never "EUR 0.00", and
            // the deprecated isRepairable is not sent (its stored values were mostly defaults).
            const knownCost = DeviceInspection.resolveKnownRepairCost(inspection.repairOffer);
            await EmailService.sendDiagnosisCompletedEmail(order.customerId.email, {
              customerName,
              orderNumber: order.orderNumber,
              deviceBrand: order.deviceBrand,
              deviceModel: order.deviceModel,
              isRepairable: undefined,
              orderId: String(orderId),
              diagnosisCompletedAt: inspection.completedAt,
              deviceCondition: inspection.externalInspection?.overallCondition || null,
              recommendedAction: knownCost === null
                ? 'Diagnose abgeschlossen - wir melden uns mit dem weiteren Vorgehen.'
                : `Kostenvoranschlag: ${this._formatEuro(knownCost)}${knownCost === 0 ? ' (kostenlos)' : ''}`
            });
          }
        } catch (emailError) {
          console.error(`[DeviceInspection] Error sending diagnosis completed email:`, emailError);
        }
      });

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error completing inspection:`, error);
      throw error;
    }
  }

  // Generate inspection report (PDF)
  static async generateInspectionReport(orderId) {
    console.log(`[DeviceInspection] Generating report for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId })
        .populate('orderId')
        .populate('customerId', 'name email phone')
        .populate('technicianId', 'name email');

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      // Create reports directory if it doesn't exist
      const reportsDir = path.join(__dirname, '../uploads/reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Generate PDF
      const fileName = `inspection-${inspection._id}-${Date.now()}.pdf`;
      const filePath = path.join(reportsDir, fileName);
      const doc = new pdfkit();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Title
      const formatDate = (value) => (value ? new Date(value).toLocaleDateString('de-DE') : null);
      doc.fontSize(24).font('Helvetica-Bold').text('Geräteinspektionsbericht', { align: 'center' });
      doc.moveDown();

      // Order Information
      doc.fontSize(14).font('Helvetica-Bold').text('Auftragsinformationen');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Auftragsnummer: ${inspection.orderId?.orderNumber || 'Nicht angegeben'}`);
      doc.text(`Auftrags-ID: ${orderId}`);
      doc.moveDown();

      // Customer Information
      doc.fontSize(14).font('Helvetica-Bold').text('Kundeninformationen');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Name: ${inspection.customerId?.name || 'Nicht angegeben'}`);
      doc.text(`E-Mail: ${inspection.customerId?.email || 'Nicht angegeben'}`);
      doc.text(`Telefon: ${inspection.customerId?.phone || 'Nicht angegeben'}`);
      doc.moveDown();

      // Technician Information
      doc.fontSize(14).font('Helvetica-Bold').text('Techniker');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Name: ${inspection.technicianId?.name || 'Nicht angegeben'}`);
      doc.text(`E-Mail: ${inspection.technicianId?.email || 'Nicht angegeben'}`);
      doc.text(`Inspektionsdatum: ${formatDate(inspection.completedAt) || 'Noch nicht abgeschlossen'}`);
      doc.moveDown();

      // Step 1: Model Verification
      doc.fontSize(14).font('Helvetica-Bold').text('1. Modellprüfung');
      doc.fontSize(12).font('Helvetica');
      if (inspection.modelVerification) {
        const mv = inspection.modelVerification;
        doc.text(`Gemeldetes Modell: ${mv.reportedModel || 'Nicht angegeben'}`);
        if (mv.reportedModelSource === 'order-timeline') {
          doc.text('(ermittelt aus dem Auftragsverlauf - kein gespeicherter Schnappschuss der Buchung)');
        } else if (mv.reportedModelSource === 'order-current-unverified' || mv.reportedModelSource === 'order-snapshot-unverified') {
          doc.text('Hinweis: Das ursprünglich gemeldete Modell ist nicht gesichert erfasst; die Angabe entspricht dem damaligen Auftragsstand.');
        }
        doc.text(`Tatsächliches Modell: ${mv.actualModel || 'Nicht angegeben'}`);
        doc.text(`Prüfstatus: ${reportLabel('verification', mv.verificationStatus)}`);
        if (typeof mv.costDifference === 'number' && mv.costDifference !== 0) {
          doc.text(`Preisdifferenz: ${mv.costDifference > 0 ? '+' : ''}${this._formatEuro(mv.costDifference)}`);
        }
        if (mv.notes) {
          doc.text(`Anmerkungen: ${mv.notes}`);
        }
      }
      doc.moveDown();

      // Step 2: Identification
      doc.fontSize(14).font('Helvetica-Bold').text('2. Geräteidentifikation');
      doc.fontSize(12).font('Helvetica');
      if (inspection.identification) {
        doc.text(`Gerätetyp: ${inspection.identification.deviceTypeLabel || reportLabel('deviceType', inspection.identification.deviceType)}`);
        if (inspection.identification.imei) {
          doc.text(`IMEI: ${inspection.identification.imei}`);
        }
        if (inspection.identification.serialNumber) {
          doc.text(`Seriennummer: ${inspection.identification.serialNumber}`);
        }
      }
      doc.moveDown();

      // Step 3: Accessories
      doc.fontSize(14).font('Helvetica-Bold').text('3. Zubehör & Verpackung');
      doc.fontSize(12).font('Helvetica');
      if (inspection.accessories) {
        const acc = inspection.accessories;
        const items = [
          { label: 'Originalverpackung', data: acc.originalPackaging },
          { label: 'Schutzhülle', data: acc.caseCover },
          { label: 'Netzteil', data: acc.powerAdapter },
          { label: 'SIM-Schublade', data: acc.simTray },
          { label: 'Kabel', data: acc.cables },
        ];
        items.forEach(({ label, data }) => {
          if (data && data.present !== undefined) {
            doc.text(`${label}: ${data.present ? 'Vorhanden' : 'Nicht vorhanden'}${data.description ? ` (${data.description})` : ''}`);
          }
        });
        if (Array.isArray(acc.otherAccessories)) {
          acc.otherAccessories.forEach(item => {
            if (item && item.name) {
              doc.text(`${item.name}: ${item.present ? 'Vorhanden' : 'Nicht vorhanden'}${item.description ? ` (${item.description})` : ''}`);
            }
          });
        }
        if (acc.additionalAccessoriesText) {
          doc.text(`Weiteres Zubehör: ${acc.additionalAccessoriesText}`);
        }
        if (acc.description) {
          doc.text(`Anmerkungen: ${acc.description}`);
        }
      }
      doc.moveDown();

      // Step 4: External Inspection
      doc.fontSize(14).font('Helvetica-Bold').text('4. Äußere Inspektion');
      doc.fontSize(12).font('Helvetica');
      if (inspection.externalInspection) {
        const ext = inspection.externalInspection;
        const parts = [
          { label: 'Display', data: ext.display },
          { label: 'Rahmen', data: ext.frame },
          { label: 'Rückseite', data: ext.backCover },
          { label: 'Tasten', data: ext.buttons },
        ];
        parts.forEach(({ label, data }) => {
          if (data) {
            doc.text(`${label}: ${reportLabel('condition', data.status)}${data.notes ? ` - ${data.notes}` : ''}`);
          }
        });
        if (ext.visibleDamages?.hasDamage) {
          doc.text(`Sichtbare Schäden: Ja${ext.visibleDamages.description ? ` - ${ext.visibleDamages.description}` : ''}`);
        } else {
          doc.text('Sichtbare Schäden: Keine');
        }
        if (ext.uniqueNotes) {
          doc.text(`Besondere Anmerkungen: ${ext.uniqueNotes}`);
        }
      }
      doc.moveDown();

      // Step 5: Device Tests
      doc.fontSize(14).font('Helvetica-Bold').text('5. Gerätetests');
      doc.fontSize(12).font('Helvetica');
      if (inspection.deviceTest) {
        const tests = [
          { key: 'charging', label: 'Laden' },
          { key: 'power', label: 'Einschalten' },
          { key: 'wifi', label: 'WLAN' },
          { key: 'frontCamera', label: 'Frontkamera' },
          { key: 'mainCamera', label: 'Hauptkamera' },
        ];
        tests.forEach(({ key, label }) => {
          const test = inspection.deviceTest[key];
          if (test) {
            let line = `${label}: ${reportLabel('test', test.status)}`;
            if (key === 'charging' && test.current) line += ` (Ladestrom: ${test.current})`;
            if (test.notes) line += ` - ${test.notes}`;
            doc.text(line);
          }
        });
        if (inspection.deviceTest.buttons?.status) {
          doc.text(`Tasten: ${reportLabel('condition', inspection.deviceTest.buttons.status)}${inspection.deviceTest.buttons.notes ? ` - ${inspection.deviceTest.buttons.notes}` : ''}`);
        }
        if (inspection.deviceTest.notes) {
          doc.text(`Hinweise: ${inspection.deviceTest.notes}`);
        }
      }
      if (inspection.hasFailedTests && Array.isArray(inspection.failedTestDetails) && inspection.failedTestDetails.length > 0) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Fehlgeschlagene Tests:');
        doc.font('Helvetica');
        inspection.failedTestDetails.forEach(test => {
          doc.text(`  - ${test.testName}: ${test.reason === 'Not functioning properly' ? 'Funktioniert nicht einwandfrei' : test.reason}`);
        });
      }
      doc.moveDown();

      // Step 6: Apple-Specific
      if (inspection.appleSpecific) {
        doc.fontSize(14).font('Helvetica-Bold').text('6. Apple-spezifische Prüfungen');
        doc.fontSize(12).font('Helvetica');
        const apple = inspection.appleSpecific;
        if (apple.modemFirmware?.status) {
          doc.text(`Modem-Firmware: ${reportLabel('apple', apple.modemFirmware.status)}${apple.modemFirmware.notes ? ` - ${apple.modemFirmware.notes}` : ''}`);
        }
        if (apple.touchIdFaceId?.status) {
          doc.text(`Touch ID / Face ID: ${reportLabel('apple', apple.touchIdFaceId.status)}${apple.touchIdFaceId.notes ? ` - ${apple.touchIdFaceId.notes}` : ''}`);
        }
        if (apple.customerInfoAction?.requested && apple.customerInfoAction?.note) {
          doc.text(`Kundeninfo angefordert: ${apple.customerInfoAction.note}`);
        }
        doc.moveDown();
      }

      // Repair Assessment / Summary
      doc.fontSize(14).font('Helvetica-Bold').text('7. Abschluss & Zusammenfassung');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Status: ${reportLabel('status', inspection.status)}`);

      // The "Reparatureinschaetzung" (reparierbar ja/nein) is no longer part of the inspection
      // workflow; stored legacy values were mostly client defaults and are never printed.
      // A price is printed only when it was actually given (0 only as an explicit free quote).
      const knownCost = DeviceInspection.resolveKnownRepairCost(inspection.repairOffer);
      const offerTimeframe = String(inspection.repairOffer?.timeframe || '').trim();
      const offerDescription = String(inspection.repairOffer?.description || '').trim();
      if (knownCost !== null || offerTimeframe || offerDescription) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Reparaturangaben:');
        doc.font('Helvetica');
        doc.text(knownCost === null
          ? 'Kosten: nicht angegeben'
          : `Kosten: ${this._formatEuro(knownCost)}${knownCost === 0 ? ' (kostenlos)' : ''}`);
        if (offerTimeframe) {
          doc.text(`Zeitrahmen: ${offerTimeframe}`);
        }
        if (offerDescription) {
          doc.text(`Beschreibung: ${offerDescription}`);
        }
      }

      if (inspection.customerInformation?.shouldInform) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Kundeninformation:');
        doc.font('Helvetica');
        if (inspection.customerInformation.reason) {
          doc.text(`Grund: ${inspection.customerInformation.reason}`);
        }
        if (inspection.customerInformation.note) {
          doc.text(`Notiz: ${inspection.customerInformation.note}`);
        }
      }

      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(
        `Bericht erstellt am ${new Date().toLocaleString('de-DE')}`,
        { align: 'center' }
      );

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          console.log(`[DeviceInspection] Report generated: ${fileName}`);
          inspection.reportGenerated = true;
          inspection.reportUrl = `/uploads/reports/${fileName}`;
          inspection.reportGeneratedAt = new Date();
          inspection.save();
          resolve(inspection);
        });

        stream.on('error', (error) => {
          console.error(`[DeviceInspection] Error generating PDF:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[DeviceInspection] Error generating report:`, error);
      throw error;
    }
  }

  // Get all inspections for a technician
  static async getTechnicianInspections(technicianId, filters = {}) {
    console.log(`[DeviceInspection] Fetching inspections for technician: ${technicianId}`);

    try {
      let query = { technicianId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.hasFailedTests !== undefined) {
        query.hasFailedTests = filters.hasFailedTests;
      }

      const inspections = await DeviceInspection.find(query)
        .populate('orderId', 'orderNumber deviceBrand deviceModel')
        .populate('customerId', 'name email')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip((filters.page || 0) * (filters.limit || 50));

      return inspections;
    } catch (error) {
      console.error(`[DeviceInspection] Error getting technician inspections:`, error);
      throw error;
    }
  }

  // Add action log
  static async addActionLog(orderId, action, technicianId, resultStatus, details = {}) {
    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspektion nicht gefunden.');
      }

      inspection.actionLogs.push({
        action,
        timestamp: new Date(),
        technicianId,
        resultStatus,
        details,
      });

      await inspection.save();
      console.log(`[DeviceInspection] Action logged: ${action}`);

      return inspection;
    } catch (error) {
      console.error(`[DeviceInspection] Error adding action log:`, error);
      throw error;
    }
  }
}

module.exports = DeviceInspectionService;
