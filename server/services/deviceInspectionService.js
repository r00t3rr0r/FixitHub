const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');
const OrderService = require('./orderService');
const EmailService = require('./emailService');
const pdfkit = require('pdfkit');
const path = require('path');
const fs = require('fs');

class DeviceInspectionService {
  static _markStepCompleted(inspection, stepNumber) {
    const alreadyCompleted = (inspection.completedSteps || []).some((entry) => entry.step === stepNumber);
    if (!alreadyCompleted) {
      inspection.completedSteps.push({ step: stepNumber, completedAt: new Date() });
    }
  }

  // Create or get inspection for an order
  static async initializeInspection(orderId, customerId, technicianId) {
    console.log(`[DeviceInspection] Initializing inspection for order: ${orderId}`);

    try {
      let resolvedCustomerId = customerId || null;

      if (!resolvedCustomerId) {
        const order = await Order.findById(orderId).select('customerId');
        if (!order) {
          throw new Error('Order not found');
        }

        if (order.customerId) {
          resolvedCustomerId = order.customerId;
        }
      }

      // Check if inspection already exists
      let inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        inspection = new DeviceInspection({
          orderId,
          customerId: resolvedCustomerId,
          technicianId,
          status: 'in-progress',
          startedAt: new Date(),
        });

        try {
          await inspection.save();
          console.log(`[DeviceInspection] New inspection created: ${inspection._id}`);
        } catch (saveError) {
          // If duplicate key error, try to fetch the existing inspection
          if (saveError.code === 11000) {
            console.log(`[DeviceInspection] Duplicate inspection found, retrieving existing one`);
            inspection = await DeviceInspection.findOne({ orderId });
            if (!inspection) {
              throw new Error('Failed to retrieve existing inspection after duplicate key error');
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
    supervisorId = null
  ) {
    console.log(`[DeviceInspection] Updating model verification for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspection not found');
      }

      const verified = verificationStatus === 'correct';

      inspection.modelVerification = {
        reportedModel,
        actualModel,
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
        inspection.completedSteps.push({ step: 1, completedAt: new Date() });
      }

      await inspection.save();
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
        throw new Error('Inspection not found');
      }

      // IMEI is optional for smartphones in this workflow.
      const identified =
        (deviceType === 'Smartphone' && Boolean(imei || serialNumber)) ||
        (['Laptop', 'Tablet'].includes(deviceType) && Boolean(serialNumber)) ||
        (!['Smartphone', 'Laptop', 'Tablet'].includes(deviceType));

      inspection.identification = {
        deviceType,
        imei: deviceType === 'Smartphone' ? imei : null,
        serialNumber: ['Laptop', 'Tablet'].includes(deviceType) ? serialNumber : null,
        imeiRequired: deviceType === 'Smartphone' && !imei,
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
        throw new Error('Inspection not found');
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
        throw new Error('Inspection not found');
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
        throw new Error('Inspection not found');
      }

      inspection.deviceTest = {
        ...testData,
        testedAt: new Date(),
      };

      // Check for failed tests
      const failedTests = [];
      Object.entries(testData).forEach(([testName, testResult]) => {
        if (testResult.status === 'Not OK') {
          failedTests.push({
            testName: testName.charAt(0).toUpperCase() + testName.slice(1),
            reason: testResult.notes || 'Not functioning properly',
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
        throw new Error('Inspection not found');
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
        title: 'Device Testing Issues Detected',
        message: `Testing revealed the following issues with your device:\n${failedTestsText}\nA technician will contact you shortly with repair options.`,
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
  static async completeInspection(orderId, isRepairable, repairOffer = null, completionAction = null, customerInformation = null) {
    console.log(`[DeviceInspection] Completing inspection for order: ${orderId}`);

    try {
      const inspection = await DeviceInspection.findOne({ orderId });

      if (!inspection) {
        throw new Error('Inspection not found');
      }

      const wasAlreadyCompleted = inspection.status === 'completed';

      inspection.status = 'completed';
      inspection.completedAt = new Date();
      inspection.isRepairable = isRepairable;
      inspection.completionAction = completionAction || (isRepairable ? 'repairable' : 'not-repairable');

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

      if (repairOffer && typeof repairOffer === 'object' && Number.isFinite(Number(repairOffer.cost))) {
        inspection.repairOffer = repairOffer;
        inspection.approvalStatus = 'awaiting-customer';
      }

      // Log completion
      inspection.actionLogs.push({
        action: 'Inspection completed',
        timestamp: new Date(),
        technicianId: inspection.technicianId,
        technicianName: inspection.technicianId.name || 'Unknown',
        resultStatus: 'success',
        details: {
          isRepairable,
          hasFailedTests: inspection.hasFailedTests,
          completionAction: inspection.completionAction,
        },
      });

      await inspection.save();
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

            await EmailService.sendDiagnosisCompletedEmail(order.customerId.email, {
              customerName,
              orderNumber: order.orderNumber,
              deviceBrand: order.deviceBrand,
              deviceModel: order.deviceModel,
              isRepairable,
              orderId: String(orderId),
              diagnosisCompletedAt: inspection.completedAt,
              deviceCondition: inspection.externalInspection?.overallCondition || null,
              recommendedAction: repairOffer
                ? `Kostenvoranschlag: EUR ${Number(repairOffer.cost || 0).toFixed(2)}`
                : (isRepairable ? 'Kostenvoranschlag wird erstellt' : 'Bitte kontaktieren Sie uns fuer weitere Optionen')
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
        throw new Error('Inspection not found');
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
      doc.fontSize(24).font('Helvetica-Bold').text('Device Inspection Report', { align: 'center' });
      doc.moveDown();

      // Order Information
      doc.fontSize(14).font('Helvetica-Bold').text('Order Information');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Order Number: ${inspection.orderId?.orderNumber || 'N/A'}`);
      doc.text(`Order ID: ${orderId}`);
      doc.moveDown();

      // Customer Information
      doc.fontSize(14).font('Helvetica-Bold').text('Customer Information');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Name: ${inspection.customerId?.name || 'N/A'}`);
      doc.text(`Email: ${inspection.customerId?.email || 'N/A'}`);
      doc.text(`Phone: ${inspection.customerId?.phone || 'N/A'}`);
      doc.moveDown();

      // Technician Information
      doc.fontSize(14).font('Helvetica-Bold').text('Technician Information');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Name: ${inspection.technicianId?.name || 'N/A'}`);
      doc.text(`Email: ${inspection.technicianId?.email || 'N/A'}`);
      doc.text(`Inspection Date: ${inspection.completedAt?.toLocaleDateString() || 'Pending'}`);
      doc.moveDown();

      // Step 1: Model Verification
      doc.fontSize(14).font('Helvetica-Bold').text('1. Modellverifizierung');
      doc.fontSize(12).font('Helvetica');
      if (inspection.modelVerification) {
        doc.text(`Gemeldetes Modell: ${inspection.modelVerification.reportedModel || 'N/A'}`);
        doc.text(`Tatsaechliches Modell: ${inspection.modelVerification.actualModel || 'N/A'}`);
        doc.text(`Verifizierungsstatus: ${inspection.modelVerification.verificationStatus || 'N/A'}`);
        doc.text(`Verifiziert: ${inspection.modelVerification.verified ? 'Ja' : 'Nein'}`);
        if (inspection.modelVerification.costDifference != null && inspection.modelVerification.costDifference !== 0) {
          doc.text(`Preisdifferenz: ${inspection.modelVerification.costDifference > 0 ? '+' : ''}${inspection.modelVerification.costDifference} EUR`);
        }
        if (inspection.modelVerification.notes) {
          doc.text(`Anmerkungen: ${inspection.modelVerification.notes}`);
        }
      }
      doc.moveDown();

      // Step 2: Identification
      doc.fontSize(14).font('Helvetica-Bold').text('2. Geraeteidentifikation');
      doc.fontSize(12).font('Helvetica');
      if (inspection.identification) {
        doc.text(`Geraetetyp: ${inspection.identification.deviceType || 'N/A'}`);
        if (inspection.identification.imei) {
          doc.text(`IMEI: ${inspection.identification.imei}`);
        }
        if (inspection.identification.serialNumber) {
          doc.text(`Seriennummer: ${inspection.identification.serialNumber}`);
        }
      }
      doc.moveDown();

      // Step 3: Accessories
      doc.fontSize(14).font('Helvetica-Bold').text('3. Zubehoer & Verpackung');
      doc.fontSize(12).font('Helvetica');
      if (inspection.accessories) {
        const acc = inspection.accessories;
        const items = [
          { label: 'Originalverpackung', data: acc.originalPackaging },
          { label: 'Schutzhuelle', data: acc.caseCover },
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
          doc.text(`Zusaetzliche Hinweise: ${acc.additionalAccessoriesText}`);
        }
      }
      doc.moveDown();

      // Step 4: External Inspection
      doc.fontSize(14).font('Helvetica-Bold').text('4. Aeussere Inspektion');
      doc.fontSize(12).font('Helvetica');
      if (inspection.externalInspection) {
        const ext = inspection.externalInspection;
        const parts = [
          { label: 'Display', data: ext.display },
          { label: 'Rahmen', data: ext.frame },
          { label: 'Rueckseite', data: ext.backCover },
          { label: 'Tasten', data: ext.buttons },
        ];
        parts.forEach(({ label, data }) => {
          if (data) {
            doc.text(`${label}: ${data.status || 'N/A'}${data.notes ? ` - ${data.notes}` : ''}`);
          }
        });
        if (ext.visibleDamages?.hasDamage) {
          doc.text(`Sichtbare Schaeden: Ja${ext.visibleDamages.description ? ` - ${ext.visibleDamages.description}` : ''}`);
        } else {
          doc.text('Sichtbare Schaeden: Keine');
        }
        if (ext.uniqueNotes) {
          doc.text(`Besondere Anmerkungen: ${ext.uniqueNotes}`);
        }
      }
      doc.moveDown();

      // Step 5: Device Tests
      doc.fontSize(14).font('Helvetica-Bold').text('5. Geraetetests');
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
            let line = `${label}: ${test.status || 'N/A'}`;
            if (key === 'charging' && test.current) line += ` (Ladestrom: ${test.current})`;
            if (test.notes) line += ` - ${test.notes}`;
            doc.text(line);
          }
        });
      }
      if (inspection.hasFailedTests && Array.isArray(inspection.failedTestDetails) && inspection.failedTestDetails.length > 0) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Fehlgeschlagene Tests:');
        doc.font('Helvetica');
        inspection.failedTestDetails.forEach(test => {
          doc.text(`  - ${test.testName}: ${test.reason}`);
        });
      }
      doc.moveDown();

      // Step 6: Apple-Specific
      if (inspection.appleSpecific) {
        doc.fontSize(14).font('Helvetica-Bold').text('6. Apple-spezifische Checks');
        doc.fontSize(12).font('Helvetica');
        const apple = inspection.appleSpecific;
        if (apple.modemFirmware?.status) {
          doc.text(`Modem-Firmware: ${apple.modemFirmware.status}${apple.modemFirmware.notes ? ` - ${apple.modemFirmware.notes}` : ''}`);
        }
        if (apple.touchIdFaceId?.status) {
          doc.text(`Touch ID / Face ID: ${apple.touchIdFaceId.status}${apple.touchIdFaceId.notes ? ` - ${apple.touchIdFaceId.notes}` : ''}`);
        }
        if (apple.customerInfoAction?.requested && apple.customerInfoAction?.note) {
          doc.text(`Kundeninfo angefordert: ${apple.customerInfoAction.note}`);
        }
        doc.moveDown();
      }

      // Repair Assessment
      doc.fontSize(14).font('Helvetica-Bold').text('Reparatureinschaetzung');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Reparierbar: ${inspection.isRepairable === true ? 'Ja' : inspection.isRepairable === false ? 'Nein' : 'Ausstehend'}`);
      doc.text(`Abschlussaktion: ${inspection.completionAction || 'N/A'}`);
      doc.text(`Status: ${inspection.status}`);

      if (inspection.repairOffer && inspection.repairOffer.cost != null) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Kostenvoranschlag:');
        doc.font('Helvetica');
        doc.text(`Kosten: ${inspection.repairOffer.cost} EUR`);
        if (inspection.repairOffer.timeframe) {
          doc.text(`Zeitrahmen: ${inspection.repairOffer.timeframe}`);
        }
        if (inspection.repairOffer.description) {
          doc.text(`Beschreibung: ${inspection.repairOffer.description}`);
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
        `Report generated on ${new Date().toLocaleString()}`,
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
        throw new Error('Inspection not found');
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
