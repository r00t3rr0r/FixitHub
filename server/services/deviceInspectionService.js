const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');
const OrderService = require('./orderService');
const EmailService = require('./emailService');
const pdfkit = require('pdfkit');
const path = require('path');
const fs = require('fs');

class DeviceInspectionService {
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

      // Validate identification based on device type
      const identified =
        (deviceType === 'Smartphone' && imei) ||
        (['Laptop', 'Tablet'].includes(deviceType) && serialNumber);

      if (!identified) {
        throw new Error(`Missing required identification for ${deviceType}`);
      }

      inspection.identification = {
        deviceType,
        imei: deviceType === 'Smartphone' ? imei : null,
        serialNumber: ['Laptop', 'Tablet'].includes(deviceType) ? serialNumber : null,
        identified: true,
        identifiedAt: new Date(),
      };

      inspection.completedSteps.push({ step: 2, completedAt: new Date() });

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

      inspection.accessories = {
        ...accessoriesData,
        checkedAt: new Date(),
      };

      inspection.completedSteps.push({ step: 3, completedAt: new Date() });

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

      inspection.externalInspection = {
        ...inspectionData,
        photos,
        inspectedAt: new Date(),
      };

      inspection.completedSteps.push({ step: 4, completedAt: new Date() });

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

      inspection.completedSteps.push({ step: 5, completedAt: new Date() });

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

      inspection.completedSteps.push({ step: 6, completedAt: new Date() });

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
  static async completeInspection(orderId, isRepairable, repairOffer = null) {
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

      if (repairOffer) {
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
                ? `Kostenvoranschlag: EUR ${Number(repairOffer.amount || 0).toFixed(2)}`
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

      // Inspection Results
      doc.fontSize(14).font('Helvetica-Bold').text('Inspection Results');
      doc.fontSize(12).font('Helvetica');

      if (inspection.modelVerification) {
        doc.text(`Model: ${inspection.modelVerification.actualModel}`);
        doc.text(`Verified: ${inspection.modelVerification.verified ? 'Yes' : 'No'}`);
      }

      if (inspection.identification) {
        if (inspection.identification.imei) {
          doc.text(`IMEI: ${inspection.identification.imei}`);
        }
        if (inspection.identification.serialNumber) {
          doc.text(`Serial Number: ${inspection.identification.serialNumber}`);
        }
      }

      doc.moveDown();
      doc.text(`Repairable: ${inspection.isRepairable ? 'Yes' : 'No'}`);
      doc.text(`Status: ${inspection.status}`);

      if (inspection.hasFailedTests) {
        doc.fontSize(14).font('Helvetica-Bold').text('Failed Tests');
        doc.fontSize(12).font('Helvetica');
        inspection.failedTestDetails.forEach(test => {
          doc.text(`- ${test.testName}: ${test.reason}`);
        });
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
