const mongoose = require('mongoose');
const RepairWorkflow = require('../models/RepairWorkflow');
const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const InspectionCommunication = require('../models/InspectionCommunication');
const EmailService = require('./emailService');

// Fehler mit HTTP-Status und deutscher, UI-tauglicher Meldung. Die Routen geben
// statusCode und message unveraendert weiter.
class RepairWorkflowError extends Error {
  constructor(message, statusCode = 400, code = 'REPAIR_WORKFLOW_ERROR') {
    super(message);
    this.name = 'RepairWorkflowError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const STATUS_LABELS = {
  'pending-confirmation': 'wartet auf Freigabe',
  'in-progress': 'in Bearbeitung',
  paused: 'pausiert',
  completed: 'abgeschlossen',
  incident: 'wegen eines Zwischenfalls unterbrochen',
};

const statusLabel = (status) => STATUS_LABELS[status] || 'in einem unbekannten Zustand';

const notFound = () => new RepairWorkflowError('Reparatur-Workflow nicht gefunden.', 404, 'REPAIR_WORKFLOW_NOT_FOUND');

const invalidTransition = (action, status) => new RepairWorkflowError(
  `Der Reparatur-Workflow kann nicht ${action} werden, er ist ${statusLabel(status)}.`,
  409,
  'REPAIR_WORKFLOW_INVALID_TRANSITION'
);

// "Warten auf Kundenrückmeldung" - nur Ereignisse, die nachweislich eine Antwort des
// Kunden anfordern. Normale Nachrichten zaehlen nie.
const AWAITING_REASON_LABELS = {
  feedback_request: 'Offene Rückfrage an den Kunden',
  unlock_info: 'Entsperrinformation beim Kunden angefordert',
  repair_offer: 'Reparaturangebot wartet auf Entscheidung des Kunden',
  workflow_customer_info: 'Rückfrage aus dem Reparatur-Workflow',
};

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
};

// Zustandswechsel atomar speichern: gespeichert wird nur, wenn der Workflow noch in dem Zustand
// ist, in dem er gelesen wurde (bedingtes updateOne ueber doc.$where). Von zwei parallelen Klicks
// wirkt so genau einer; der andere bekommt dieselbe 409 wie ein spaeterer, zweiter Klick.
// buildConflictError(aktuellerStatus) liefert diese Meldung.
const saveTransition = async (workflow, expected, buildConflictError) => {
  workflow.$where = expected;
  try {
    await workflow.save();
  } catch (error) {
    if (error && error.name === 'DocumentNotFoundError') {
      const current = await RepairWorkflow.findById(workflow._id).select('status').lean();
      if (!current) {
        throw notFound();
      }
      throw buildConflictError(current.status);
    }
    throw error;
  } finally {
    workflow.$where = undefined;
  }
};

// Eine laufende Pause (manuell oder Zwischenfall) als abgeschlossenen Abschnitt in den
// Pausenverlauf uebernehmen - mit ihrem eigenen Grund und der Person, die pausiert hat.
const closeRunningPause = (workflow, now, fallbackReason, endedBy = {}) => {
  if (!workflow.timerData.pausedAt) {
    return;
  }
  const pausedAt = new Date(workflow.timerData.pausedAt);
  const pauseDuration = now.getTime() - pausedAt.getTime();
  if (pauseDuration > 0) {
    workflow.timerData.pauseHistory.push({
      pausedAt,
      resumedAt: now,
      durationMs: pauseDuration,
      reason: workflow.timerData.currentPauseReason || fallbackReason,
      pausedByTechnicianId: workflow.timerData.currentPausedByTechnicianId || undefined,
      pausedByTechnicianName: workflow.timerData.currentPausedByTechnicianName || undefined,
      resumedByTechnicianId: endedBy.technicianId || undefined,
      resumedByTechnicianName: endedBy.technicianName || undefined,
    });
    workflow.timerData.totalPausedMs = (workflow.timerData.totalPausedMs || 0) + pauseDuration;
  }
  workflow.timerData.pausedAt = undefined;
  workflow.timerData.currentPauseReason = undefined;
  workflow.timerData.currentPausedByTechnicianId = undefined;
  workflow.timerData.currentPausedByTechnicianName = undefined;
};

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
        throw notFound();
      }

      // Eine Freigabe startet die Zeiterfassung. Ein zweiter Aufruf (Doppelklick,
      // Korrektur-Dialog auf einem bereits laufenden Workflow) darf Startzeit, Pausen
      // und Notizen nicht zuruecksetzen.
      if (workflow.status !== 'pending-confirmation') {
        throw invalidTransition('freigegeben', workflow.status);
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
      // Atomar: bei zwei parallelen Freigaben wirkt nur eine (keine zweite Start-Mail,
      // kein zweites Zuruecksetzen der Zeiterfassung).
      await saveTransition(workflow, { status: 'pending-confirmation' }, (status) => invalidTransition('freigegeben', status));

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

  async pauseRepair(orderId, pauseReason, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw notFound();
      }

      if (workflow.status === 'paused') {
        throw new RepairWorkflowError('Der Reparatur-Workflow ist bereits pausiert.', 409, 'REPAIR_WORKFLOW_ALREADY_PAUSED');
      }

      // Pausieren ist eine ausdrueckliche Aktion aus laufender Arbeit - ein
      // abgeschlossener, noch nicht freigegebener oder wegen eines Zwischenfalls
      // unterbrochener Workflow darf dadurch nicht wieder "geoeffnet" werden.
      if (workflow.status !== 'in-progress') {
        throw invalidTransition('pausiert', workflow.status);
      }

      const now = new Date();
      workflow.status = 'paused';
      workflow.timerData.pausedAt = now;
      workflow.timerData.currentPauseReason = pauseReason || undefined;
      workflow.timerData.currentPausedByTechnicianId = technicianId || undefined;
      workflow.timerData.currentPausedByTechnicianName = technicianName || undefined;
      workflow.lastStatusChangeAt = now;

      // Erst speichern (atomar), dann benachrichtigen: eine abgelehnte Parallel-Anfrage
      // verschickt keine Mail.
      await saveTransition(workflow, { status: 'in-progress' }, (status) => (status === 'paused'
        ? new RepairWorkflowError('Der Reparatur-Workflow ist bereits pausiert.', 409, 'REPAIR_WORKFLOW_ALREADY_PAUSED')
        : invalidTransition('pausiert', status)));

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

      return workflow;
    } catch (error) {
      console.error('Error pausing repair:', error);
      throw error;
    }
  }

  async resumeRepair(orderId, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw notFound();
      }

      if (workflow.status !== 'paused' && workflow.status !== 'incident') {
        throw invalidTransition('fortgesetzt', workflow.status);
      }

      const now = new Date();
      const expectedStatus = workflow.status;
      closeRunningPause(
        workflow,
        now,
        workflow.status === 'incident' ? 'Zwischenfall' : undefined,
        { technicianId, technicianName }
      );

      workflow.timerData.resumedAt = now;
      workflow.status = 'in-progress';
      workflow.lastStatusChangeAt = now;

      // Atomar: zwei parallele "Fortsetzen" tragen die Pause nicht doppelt ein.
      await saveTransition(workflow, { status: expectedStatus }, (status) => invalidTransition('fortgesetzt', status));
      return workflow;
    } catch (error) {
      console.error('Error resuming repair:', error);
      throw error;
    }
  }

  async completeRepair(orderId, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw notFound();
      }

      if (workflow.status === 'completed' || workflow.status === 'pending-confirmation') {
        throw invalidTransition('abgeschlossen', workflow.status);
      }

      const now = new Date();
      const expectedStatus = workflow.status;

      // If currently paused/incident, finalize the active pause into history
      closeRunningPause(
        workflow,
        now,
        workflow.status === 'incident' ? 'Zwischenfall' : 'Abschluss',
        { technicianId, technicianName }
      );

      workflow.status = 'completed';
      workflow.timerData.completedAt = now;
      workflow.lastStatusChangeAt = now;

      const elapsedTimeMs = this._calculateElapsedTime(workflow);
      workflow.timerData.totalWorkMs = elapsedTimeMs;
      workflow.metadata = {
        elapsedTimeMs,
        completedByTechnicianId: technicianId || undefined,
        completedByTechnicianName: technicianName || undefined,
      };

      await saveTransition(workflow, { status: expectedStatus }, (status) => invalidTransition('abgeschlossen', status));
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
        throw notFound();
      }

      if (workflow.status === 'completed' || workflow.status === 'pending-confirmation') {
        throw new RepairWorkflowError(
          `Ein Zwischenfall kann nicht gemeldet werden, der Reparatur-Workflow ist ${statusLabel(workflow.status)}.`,
          409,
          'REPAIR_WORKFLOW_INVALID_TRANSITION'
        );
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
      // Mongoose kopiert beim push - spaetere Aenderungen (emailSentAt) muessen am
      // gespeicherten Unterdokument erfolgen, nicht am Ausgangsobjekt.
      const storedIncident = workflow.incidents[workflow.incidents.length - 1];
      const expectedStatus = workflow.status;
      const now = new Date();
      // Eine bereits laufende Pause (manuell oder ein frueherer Zwischenfall) wird mit IHREM
      // Grund und IHRER Person abgeschlossen; der Zwischenfall schliesst nahtlos an. So geht
      // weder Pausenzeit noch die Angabe verloren, wer warum pausiert hat.
      closeRunningPause(workflow, now, undefined, {});
      workflow.status = 'incident';
      workflow.timerData.pausedAt = now;
      workflow.timerData.currentPauseReason = `Zwischenfall: ${reason}`;
      workflow.timerData.currentPausedByTechnicianId = technicianId;
      workflow.timerData.currentPausedByTechnicianName = technicianName;
      workflow.lastStatusChangeAt = now;

      // Atomar gegen parallele Abschluesse/Freigaben: ein abgeschlossener Workflow wird durch
      // einen gleichzeitig gemeldeten Zwischenfall nicht wieder geoeffnet.
      await saveTransition(workflow, { status: expectedStatus }, (status) => new RepairWorkflowError(
        `Ein Zwischenfall kann gerade nicht gemeldet werden, der Reparatur-Workflow ist inzwischen ${statusLabel(status)}. Bitte die Ansicht neu laden.`,
        409,
        'REPAIR_WORKFLOW_INVALID_TRANSITION'
      ));

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
            const emailResult = await EmailService.sendTriggerEmail(
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

            // Nur eine nachweislich zugestellte Benachrichtigung zaehlt als "Kunde wurde
            // gefragt". sendTriggerEmail wirft bei fehlender Vorlage nicht, sondern
            // liefert success:false - das darf nicht als versendet gespeichert werden.
            if (emailResult && emailResult.success) {
              storedIncident.emailSentAt = new Date();
              // Gezielt nur dieses Feld dieses Zwischenfalls - ueberschreibt keinen
              // inzwischen gespeicherten Zustandswechsel.
              await RepairWorkflow.updateOne(
                { _id: workflow._id, 'incidents._id': storedIncident._id },
                { $set: { 'incidents.$.emailSentAt': storedIncident.emailSentAt } }
              );
            } else {
              console.warn(`RepairWorkflowService: incident email for ${incidentType} not delivered:`, emailResult?.error || 'unknown');
            }
          } catch (emailError) {
            console.error(`Error sending incident email for ${incidentType}:`, emailError);
          }
        }
      }

      return workflow;
    } catch (error) {
      console.error('Error reporting incident:', error);
      throw error;
    }
  }

  // Autorisierte Erledigung eines Zwischenfalls (z. B. Rueckfrage telefonisch geklaert).
  // Aendert NUR den Zwischenfall, nicht den Arbeitszustand des Workflows - fortgesetzt
  // wird weiterhin ausdruecklich ueber resumeRepair.
  async resolveIncident(orderId, incidentId, resolutionNote, technicianId, technicianName) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw notFound();
      }

      const incident = mongoose.Types.ObjectId.isValid(String(incidentId || ''))
        ? workflow.incidents.id(incidentId)
        : null;
      if (!incident) {
        throw new RepairWorkflowError('Zwischenfall nicht gefunden.', 404, 'REPAIR_INCIDENT_NOT_FOUND');
      }

      if (incident.status === 'resolved') {
        return workflow;
      }

      incident.status = 'resolved';
      incident.resolvedAt = new Date();
      incident.resolvedByTechnicianId = technicianId || undefined;
      incident.resolvedByTechnicianName = technicianName || undefined;
      incident.resolutionNote = resolutionNote ? String(resolutionNote).trim() : undefined;

      await workflow.save();
      return workflow;
    } catch (error) {
      console.error('Error resolving repair incident:', error);
      throw error;
    }
  }

  /**
   * "Warten auf Kundenrückmeldung" - rein lesend aus vorhandenen Strukturen abgeleitet,
   * es wird kein Zustand gespeichert und keine Altnachricht umklassifiziert.
   *
   * Ein Auftrag wartet, wenn mindestens eines davon offen ist:
   *  - Feedback-Anfrage im Kommunikationsverlauf (feedbackRequest.status 'pending');
   *    endet mit der Kundenantwort ('responded') oder 'expired'.
   *  - Schnellaktion 'update_unlock_info' (Kunde soll Entsperrinfo nachreichen);
   *    endet mit der Kundeneingabe oder der Erledigung durch Staff.
   *  - Reparaturangebot (repair_offer, metadata.status 'pending'); endet mit Annahme/Ablehnung.
   *  - Workflow-Zwischenfall 'customer_info', dessen Benachrichtigung nachweislich
   *    zugestellt wurde (emailSentAt); endet mit einer Kundennachricht/-antwort danach
   *    oder der autorisierten Erledigung (resolveIncident).
   * Normale Text-, System- und interne Nachrichten zaehlen nie. Stornierte Auftraege
   * werden ausgelassen.
   *
   * @param {string[]|null} orderIds optional auf diese Auftraege begrenzen
   * @returns {Promise<Array<{orderId, orderNumber, since, overdue, reasons}>>}
   */
  async getAwaitingCustomerFeedback(orderIds = null) {
    try {
      const scopedIds = Array.isArray(orderIds)
        ? orderIds
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id))
        : null;
      if (scopedIds && scopedIds.length === 0) {
        return [];
      }
      const orderFilter = scopedIds ? { orderId: { $in: scopedIds } } : {};

      const communications = await InspectionCommunication.find({
        ...orderFilter,
        messages: {
          $elemMatch: {
            $or: [
              { messageType: 'feedback_request', 'feedbackRequest.status': 'pending' },
              { messageType: 'quick_action', 'quickAction.actionType': 'update_unlock_info', 'quickAction.status': 'pending' },
              { messageType: 'repair_offer', 'metadata.status': 'pending' },
            ],
          },
        },
      })
        .select('orderId messages.messageType messages.content messages.createdAt messages._id messages.feedbackRequest messages.quickAction messages.metadata')
        .lean();

      const workflows = await RepairWorkflow.find({
        ...orderFilter,
        incidents: {
          $elemMatch: {
            type: 'customer_info',
            status: { $ne: 'resolved' },
            emailSentAt: { $ne: null },
          },
        },
      })
        .select('orderId incidents')
        .lean();

      const byOrder = new Map();
      const addReason = (orderId, reason) => {
        const key = String(orderId);
        if (!byOrder.has(key)) byOrder.set(key, []);
        byOrder.get(key).push(reason);
      };
      const now = Date.now();

      communications.forEach((communication) => {
        (communication.messages || []).forEach((message) => {
          if (message.messageType === 'feedback_request' && message.feedbackRequest?.status === 'pending') {
            const expiresAt = toTime(message.feedbackRequest.expiresAt);
            addReason(communication.orderId, {
              type: 'feedback_request',
              label: AWAITING_REASON_LABELS.feedback_request,
              detail: message.feedbackRequest.question || message.content || '',
              since: message.createdAt || null,
              // Die Frist ist abgelaufen, die Rueckfrage aber weiter offen - der Kunde
              // kann weiterhin antworten, deshalb bleibt der Auftrag in der Liste.
              overdue: expiresAt !== null && expiresAt < now,
              sourceId: message._id ? String(message._id) : null,
            });
          } else if (message.messageType === 'quick_action'
            && message.quickAction?.actionType === 'update_unlock_info'
            && message.quickAction?.status === 'pending') {
            addReason(communication.orderId, {
              type: 'unlock_info',
              label: AWAITING_REASON_LABELS.unlock_info,
              detail: message.quickAction.description || '',
              since: message.createdAt || null,
              overdue: false,
              sourceId: message._id ? String(message._id) : null,
            });
          } else if (message.messageType === 'repair_offer' && message.metadata?.status === 'pending') {
            addReason(communication.orderId, {
              type: 'repair_offer',
              label: AWAITING_REASON_LABELS.repair_offer,
              detail: message.metadata.offerDescription || '',
              since: message.createdAt || null,
              overdue: false,
              sourceId: message._id ? String(message._id) : null,
            });
          }
        });
      });

      if (workflows.length > 0) {
        // Eine Kundenantwort nach der Rueckfrage beendet das Warten: eine Nachricht des
        // Kunden oder eine Antwort des Kunden auf eine Feedback-Anfrage.
        const replyThreads = await InspectionCommunication.find({
          orderId: { $in: workflows.map((workflow) => workflow.orderId) },
        })
          .select('orderId messages.senderType messages.createdAt messages.feedbackRequest.respondedAt')
          .lean();
        const lastCustomerReplyByOrder = new Map();
        replyThreads.forEach((thread) => {
          let latest = lastCustomerReplyByOrder.get(String(thread.orderId)) || null;
          (thread.messages || []).forEach((message) => {
            const candidates = [];
            if (message.senderType === 'customer') candidates.push(toTime(message.createdAt));
            if (message.feedbackRequest?.respondedAt) candidates.push(toTime(message.feedbackRequest.respondedAt));
            candidates.forEach((time) => {
              if (time !== null && (latest === null || time > latest)) latest = time;
            });
          });
          lastCustomerReplyByOrder.set(String(thread.orderId), latest);
        });

        workflows.forEach((workflow) => {
          const lastReply = lastCustomerReplyByOrder.get(String(workflow.orderId)) ?? null;
          (workflow.incidents || []).forEach((incident) => {
            if (incident.type !== 'customer_info' || incident.status === 'resolved') return;
            const askedAt = toTime(incident.emailSentAt);
            if (askedAt === null) return;
            if (lastReply !== null && lastReply > askedAt) return;
            addReason(workflow.orderId, {
              type: 'workflow_customer_info',
              label: AWAITING_REASON_LABELS.workflow_customer_info,
              detail: incident.reason || '',
              since: incident.emailSentAt,
              overdue: false,
              sourceId: incident._id ? String(incident._id) : null,
            });
          });
        });
      }

      if (byOrder.size === 0) {
        return [];
      }

      const orders = await Order.find({ _id: { $in: [...byOrder.keys()].map((id) => new mongoose.Types.ObjectId(id)) } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id orderNumber status')
        .lean();
      const orderById = new Map(orders.map((order) => [String(order._id), order]));

      return [...byOrder.entries()]
        .filter(([orderId]) => {
          const order = orderById.get(orderId);
          return order && order.status !== 'cancelled';
        })
        .map(([orderId, reasons]) => {
          const sinceTimes = reasons.map((reason) => toTime(reason.since)).filter((time) => time !== null);
          return {
            orderId,
            orderNumber: orderById.get(orderId)?.orderNumber || '',
            since: sinceTimes.length > 0 ? new Date(Math.min(...sinceTimes)) : null,
            overdue: reasons.some((reason) => reason.overdue),
            reasons,
          };
        })
        .sort((a, b) => (toTime(a.since) || 0) - (toTime(b.since) || 0));
    } catch (error) {
      console.error('Error getting orders awaiting customer feedback:', error);
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
module.exports.RepairWorkflowError = RepairWorkflowError;
