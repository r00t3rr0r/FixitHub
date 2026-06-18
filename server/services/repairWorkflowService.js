const RepairWorkflow = require('../models/RepairWorkflow');
const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const EmailService = require('./emailService');

class RepairWorkflowService {
  async initializeRepairWorkflow(orderId, customerId, technicianId, inspectionId) {
    try {
      let workflow = await RepairWorkflow.findOne({ orderId });

      if (workflow) {
        return workflow;
      }

      workflow = new RepairWorkflow({
        orderId,
        customerId,
        technicianId,
        inspectionId,
        status: 'pending-confirmation',
      });

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error initializing repair workflow:', error);
      throw error;
    }
  }

  async approveRepairStart(orderId, internalNotes, orderChanges, notifyCustomer, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw new Error('Repair workflow not found');
      }

      const now = new Date();
      workflow.status = 'in-progress';
      workflow.approvalData = {
        internalNotes,
        orderChanges,
        notifyCustomer,
        approvedAt: now,
        approvedByTechnicianId: technicianId,
        approvedByTechnicianName: technicianName,
      };

      workflow.timerData = {
        startedAt: now,
        totalPausedMs: 0,
        pauseHistory: [],
      };

      workflow.lastStatusChangeAt = now;
      await workflow.save();

      const order = await Order.findById(orderId);
      if (order) {
        if (notifyCustomer) {
          const customer = order.customerId;
          const email = order.customerEmail || (typeof order.customerId === 'object' && order.customerId.email);

          if (email) {
            try {
              await EmailService.sendTriggerEmail(
                'repair_workflow_started',
                email,
                {
                  orderNumber: order.orderNumber,
                  deviceBrand: order.deviceBrand,
                  deviceModel: order.deviceModel,
                  internalNotes,
                  technicianName,
                },
              );
            } catch (emailError) {
              console.error('Error sending repair workflow started email:', emailError);
            }
          }
        }
      }

      return workflow;
    } catch (error) {
      console.error('Error approving repair start:', error);
      throw error;
    }
  }

  async getActiveWorkflow(orderId) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        return null;
      }

      const elapsedTimeMs = this._calculateElapsedTime(workflow);
      workflow.metadata = { elapsedTimeMs };

      return workflow;
    } catch (error) {
      console.error('Error getting active workflow:', error);
      throw error;
    }
  }

  async pauseRepair(orderId, pauseReason) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw new Error('Repair workflow not found');
      }

      if (workflow.status === 'paused') {
        throw new Error('Repair is already paused');
      }

      const now = new Date();
      workflow.status = 'paused';
      workflow.timerData.pausedAt = now;
      workflow.lastStatusChangeAt = now;

      const order = await Order.findById(orderId);
      if (order && workflow.approvalData?.notifyCustomer) {
        const email = order.customerEmail || (typeof order.customerId === 'object' && order.customerId.email);
        if (email) {
          try {
            await EmailService.sendTriggerEmail(
              'repair_workflow_paused',
              email,
              {
                orderNumber: order.orderNumber,
                deviceBrand: order.deviceBrand,
                deviceModel: order.deviceModel,
                pauseReason,
              },
            );
          } catch (emailError) {
            console.error('Error sending pause email:', emailError);
          }
        }
      }

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error pausing repair:', error);
      throw error;
    }
  }

  async resumeRepair(orderId) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw new Error('Repair workflow not found');
      }

      if (workflow.status !== 'paused' && workflow.status !== 'incident') {
        throw new Error('Repair is not paused or in incident state');
      }

      const now = new Date();
      const pausedAt = workflow.timerData.pausedAt ? new Date(workflow.timerData.pausedAt) : null;
      const pauseDuration = pausedAt ? (now.getTime() - pausedAt.getTime()) : 0;

      if (pausedAt && pauseDuration > 0) {
        workflow.timerData.pauseHistory.push({
          pausedAt: pausedAt,
          resumedAt: now,
          durationMs: pauseDuration,
          reason: workflow.status === 'incident' ? 'Zwischenfall' : undefined,
        });
        workflow.timerData.totalPausedMs = (workflow.timerData.totalPausedMs || 0) + pauseDuration;
      }

      workflow.timerData.pausedAt = undefined;
      workflow.timerData.resumedAt = now;
      workflow.status = 'in-progress';
      workflow.lastStatusChangeAt = now;

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error resuming repair:', error);
      throw error;
    }
  }

  async completeRepair(orderId) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw new Error('Repair workflow not found');
      }

      const now = new Date();
      workflow.status = 'completed';
      workflow.timerData.completedAt = now;
      workflow.lastStatusChangeAt = now;

      const elapsedTimeMs = this._calculateElapsedTime(workflow);
      workflow.metadata = { elapsedTimeMs };

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error completing repair:', error);
      throw error;
    }
  }

  async reportIncident(orderId, incidentType, reason, additionalData, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw new Error('Repair workflow not found');
      }

      const incidentData = {
        type: incidentType,
        status: 'reported',
        reason,
        notes: additionalData?.notes || '',
        additionalData,
        reportedByTechnicianId: technicianId,
        reportedByTechnicianName: technicianName,
        timestamp: new Date(),
      };

      workflow.incidents.push(incidentData);
      workflow.status = 'incident';
      workflow.timerData.pausedAt = new Date();
      workflow.lastStatusChangeAt = new Date();

      const order = await Order.findById(orderId);
      if (order && additionalData?.notifyCustomer) {
        const email = order.customerEmail || (typeof order.customerId === 'object' && order.customerId.email);
        if (email) {
          try {
            const triggerMap = {
              defective_part: 'repair_incident_defective_part',
              spare_part_needed: 'repair_incident_spare_part',
              customer_info: 'repair_incident_customer_info',
              other_repair: 'repair_incident_other_repair',
              technician_handover: 'repair_incident_technician_handover',
              needs_time: 'repair_incident_needs_time',
            };

            const trigger = triggerMap[incidentType];
            await EmailService.sendTriggerEmail(
              trigger,
              email,
              {
                orderNumber: order.orderNumber,
                deviceBrand: order.deviceBrand,
                deviceModel: order.deviceModel,
                reason,
                additionalData,
                technicianName,
              },
            );

            incidentData.emailSentAt = new Date();
          } catch (emailError) {
            console.error(`Error sending incident email for ${incidentType}:`, emailError);
          }
        }
      }

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error reporting incident:', error);
      throw error;
    }
  }

  async getInactiveWorkflows(inactivityThresholdMs = 3 * 60 * 60 * 1000) {
    try {
      const thresholdTime = new Date(Date.now() - inactivityThresholdMs);

      const inactiveWorkflows = await RepairWorkflow.find({
        status: { $in: ['in-progress', 'paused'] },
        lastStatusChangeAt: { $lt: thresholdTime },
      })
        .populate('orderId', 'orderNumber customerId')
        .populate('technicianId', 'name email')
        .sort({ lastStatusChangeAt: 1 });

      return inactiveWorkflows;
    } catch (error) {
      console.error('Error getting inactive workflows:', error);
      throw error;
    }
  }

  async checkAndNotifyInactiveWorkflows(inactivityThresholdMs = 3 * 60 * 60 * 1000) {
    try {
      const inactiveWorkflows = await this.getInactiveWorkflows(inactivityThresholdMs);

      for (const workflow of inactiveWorkflows) {
        if (!workflow._doc || !workflow._doc.inactivityAlertCreated) {
          const technician = workflow.technicianId;
          if (technician && technician.email) {
            try {
              await EmailService.sendTriggerEmail(
                'repair_workflow_inactivity_alert',
                technician.email,
                {
                  orderNumber: workflow.orderId?.orderNumber,
                  durationHours: Math.round(
                    (Date.now() - workflow.lastStatusChangeAt) / (1000 * 60 * 60)
                  ),
                  technicianName: technician.name,
                },
              );

              workflow.inactivityAlertCreated = true;
              await workflow.save();
            } catch (emailError) {
              console.error('Error sending inactivity alert:', emailError);
            }
          }
        }
      }

      return inactiveWorkflows;
    } catch (error) {
      console.error('Error checking inactive workflows:', error);
      throw error;
    }
  }

  _calculateElapsedTime(workflow) {
    if (!workflow.timerData?.startedAt) {
      return 0;
    }

    const endTime = workflow.timerData.completedAt || workflow.timerData.pausedAt || new Date();
    const totalTime = endTime - workflow.timerData.startedAt;
    const elapsedTime = totalTime - (workflow.timerData.totalPausedMs || 0);

    return Math.max(0, elapsedTime);
  }
}

module.exports = new RepairWorkflowService();
