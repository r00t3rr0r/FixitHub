const mongoose = require('mongoose');
const RepairWorkflow = require('../models/RepairWorkflow');
const DeviceInspection = require('../models/DeviceInspection');
const Order = require('../models/Order');
const InspectionCommunication = require('../models/InspectionCommunication');
const EmailService = require('./emailService');
const OrderHistory = require('../utils/orderHistory');
const ReturnMethod = require('../utils/returnMethod');

// Spaet geladen (Zyklen vermeiden: orderService laedt diesen Dienst beim Stornieren).
const getOrderService = () => require('./orderService'); // eslint-disable-line global-require
const getNotificationService = () => require('./notificationService'); // eslint-disable-line global-require
const getDHLService = () => require('./dhlService'); // eslint-disable-line global-require

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

const INCIDENT_TYPE_LABELS = {
  defective_part: 'Defektes Ersatzteil',
  spare_part_needed: 'Ersatzteil benötigt',
  customer_info: 'Rückfrage an Kunden',
  other_repair: 'Weitere Reparatur nötig',
  technician_handover: 'Techniker-Übergabe',
  needs_time: 'Mehr Zeit erforderlich',
};

const MAX_CUSTOMER_MESSAGE = 2000;
const cleanCustomerMessage = (value) => String(value || '').trim().slice(0, MAX_CUSTOMER_MESSAGE);

const deviceLabelOf = (order) => [order?.deviceBrand, order?.deviceModel].filter(Boolean).join(' ').trim();

/**
 * Kundentexte der ausdruecklichen Workflow-Benachrichtigungen (NOTIF-5). Sie enthalten NIE
 * interne Notizen, Pausen- oder Zwischenfallgruende - nur einen neutralen Standardtext oder den
 * Text, den der Mitarbeiter ausdruecklich als "Nachricht an Kunden" eingegeben hat.
 */
const CUSTOMER_TITLES = {
  approve: 'Reparatur begonnen',
  complete: 'Reparatur abgeschlossen',
  incident: 'Information zu Ihrer Reparatur',
  customer_info: 'Rückfrage zu Ihrer Reparatur',
};

// returnMethod ('shipping'|'pickup'|'unknown', utils/returnMethod) nur fuer 'complete': der Fertig-Text
// nennt den echten Rueckgabeweg; ohne Angabe neutral.
const defaultCustomerMessage = (kind, order, incidentType = null, returnMethod = 'unknown') => {
  const device = deviceLabelOf(order);
  const subject = `Ihres Geräts${device ? ` (${device})` : ''}${order?.orderNumber ? ` zu Auftrag ${order.orderNumber}` : ''}`;
  if (kind === 'approve') {
    return `Die Reparatur ${subject} hat begonnen. Wir informieren Sie, sobald sie abgeschlossen ist.`;
  }
  if (kind === 'complete') {
    return ReturnMethod.readyCustomerMessage(returnMethod, subject);
  }
  const incidentTexts = {
    defective_part: `Bei der Reparatur ${subject} wurde ein defektes Ersatzteil festgestellt. Wir beschaffen Ersatz; dadurch kann sich die Reparatur verzögern.`,
    spare_part_needed: `Für die Reparatur ${subject} wird ein zusätzliches Ersatzteil benötigt. Wir melden uns, sobald es eingetroffen ist.`,
    customer_info: `Wir haben eine Rückfrage zur Reparatur ${subject}. Bitte antworten Sie uns über die Nachrichten in Ihrem Kundenkonto.`,
    other_repair: `Bei der Reparatur ${subject} wurde ein weiterer Schaden festgestellt. Wir melden uns mit einem Vorschlag zum weiteren Vorgehen.`,
    technician_handover: `Die Reparatur ${subject} wird von einem anderen Techniker weitergeführt. Für Sie ändert sich nichts.`,
    needs_time: `Die Reparatur ${subject} benötigt etwas mehr Zeit als geplant. Wir informieren Sie, sobald sie abgeschlossen ist.`,
  };
  return incidentTexts[incidentType] || `Es gibt eine neue Information zur Reparatur ${subject}.`;
};

/**
 * Auftragsverlauf + Auftragsstatus je Zustandswechsel des Reparatur-Workflows (HIST-11).
 * Nur bestehende Order-Statuswerte; nie 'completed' (das bleibt Abholbestaetigung/manuell), nie
 * Zahlungen, Rechnungen oder Versandfelder.
 *   from        - nur aus diesen Auftragsstatus wird gewechselt
 *   pauseRule   - nur wenn kein anderer Template-Workflow des Auftrags laeuft
 *   ownPauseOnly- nur eine Pause aufheben, die DIESER Reparatur-Workflow gesetzt hat
 *                 (eine fremde Pause wie "Rückmeldung des Kunden erwartet" bleibt bestehen)
 */
const TRANSITIONS = {
  approve: { key: 'Repair Workflow Started', label: 'Reparatur gestartet', to: 'in-progress', from: ['pending', 'diagnostic-assessment'] },
  pause: { key: 'Repair Workflow Paused', label: 'Reparatur pausiert', to: 'paused', from: ['in-progress'], pauseRule: true },
  incident: { key: 'Repair Workflow Incident', label: 'Zwischenfall gemeldet', to: 'paused', from: ['in-progress'], pauseRule: true },
  resume: { key: 'Repair Workflow Resumed', label: 'Reparatur fortgesetzt', to: 'in-progress', from: ['paused'], ownPauseOnly: true },
  complete: {
    key: 'Repair Workflow Completed',
    label: 'Reparatur abgeschlossen',
    to: 'ready-for-pickup',
    from: ['pending', 'diagnostic-assessment', 'in-progress', 'paused', 'quality-check'],
    visibility: 'customer',
  },
  reopen: { key: 'Repair Workflow Reopened', label: 'Reparatur wieder aufgenommen', to: 'in-progress', from: ['ready-for-pickup'] },
  'incident-resolved': { key: 'Repair Workflow Incident Resolved', label: 'Zwischenfall erledigt' },
  'cancel-pause': { key: 'Repair Workflow Paused', label: 'Reparatur pausiert (Auftrag storniert)' },
};

const formatWorkTime = (ms) => {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')} h`;
};

const ORDER_SYNC_WARNING = 'Reparaturstatus gespeichert, der Auftragsstatus konnte nicht aktualisiert werden. Bitte erneut versuchen.';

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id && value._id !== value) return toIdString(value._id);
  return typeof value.toString === 'function' ? value.toString() : String(value);
};

// Letzter Statuseintrag des Auftrags hat auf 'paused' gewechselt und stammt von diesem Workflow?
const pausedByRepairWorkflow = (order, workflowId) => {
  const timeline = Array.isArray(order?.timeline) ? order.timeline : [];
  const lastStatus = [...timeline].reverse().find((item) => item && OrderHistory.effectiveType(item) === 'status');
  if (!lastStatus) return false;
  const change = OrderHistory.statusChangeOf(lastStatus);
  return change?.to === 'paused' && toIdString(lastStatus.refs?.repairWorkflowId) === toIdString(workflowId);
};

const hasOtherActiveTemplateWorkflow = (order) => (Array.isArray(order?.workflows) ? order.workflows : [])
  .some((item) => item && item.status === 'in-progress');

// Gast-Tracking-Link (gleiches Format wie die Gast-Nachrichten-Mail im InspectionCommunicationService).
const guestTrackingPath = (order, guestEmail) => {
  const token = String(order?.guestTrackingToken || '').trim();
  return token
    ? `/track-order?token=${encodeURIComponent(token)}&email=${encodeURIComponent(guestEmail)}`
    : '/track-order';
};

/**
 * Auftrag fuer einen Zustandswechsel der Reparatur noch offen? (HIST-14)
 * Ein stornierter Auftrag wird nicht weiter repariert: Freigabe, Fortsetzen, Abschluss und
 * Zwischenfall -> 409. Ein bereits abgeschlossener Auftrag (Abholung bestaetigt/manuell) wird nicht
 * wieder "in Arbeit" genommen: Freigabe, Fortsetzen, Zwischenfall -> 409 (Abschluss bleibt erlaubt,
 * er aendert den Auftragsstatus dann nicht).
 */
const ACTION_TEXT = {
  init: 'angelegt',
  approve: 'freigegeben',
  resume: 'fortgesetzt',
  complete: 'abgeschlossen',
  incident: 'mit einem Zwischenfall unterbrochen',
};
const assertOrderOpenForRepair = async (orderId, action) => {
  const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('status').lean();
  if (!order) return;
  const closed = order.status === 'cancelled' || (order.status === 'completed' && action !== 'complete');
  if (closed) {
    throw new RepairWorkflowError(
      `Der Auftrag ist ${order.status === 'cancelled' ? 'storniert' : 'bereits abgeschlossen'} – die Reparatur kann nicht ${ACTION_TEXT[action] || 'geändert'} werden.`,
      409,
      'REPAIR_ORDER_CLOSED'
    );
  }
};

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
  /**
   * Auftrag mit einem Zustandswechsel des Reparatur-Workflows abgleichen (HIST-11):
   *  1. Verlaufseintrag (Typ 'workflow', Quelle 'Reparatur-Workflow', refs.repairWorkflowId) -
   *     idempotent ueber eventKey (gleiches Format wie die Leseprojektion in GET /history).
   *  2. Auftragsstatus nach TRANSITIONS ueber OrderService.updateStatus (bedingtes Speichern,
   *     Buchungs-Sync, ehrlicher "von"-Wert). Der Kunde wird dabei NICHT automatisch benachrichtigt;
   *     Kundenkommunikation ist eine eigene, ausdrueckliche Aktion (notifyCustomer).
   * Wirft nie: ein Fehler wird als warnings[] gemeldet (der Workflow-Wechsel ist bereits gespeichert).
   * Rueckgabe { orderStatus, statusChanged, warnings }.
   */
  async syncOrderFromRepairWorkflow(workflow, transition, { actor, at, reason, description } = {}) {
    const meta = TRANSITIONS[transition];
    const result = { orderStatus: null, statusChanged: false, warnings: [] };
    if (!meta || !workflow) return result;
    try {
      const orderId = workflow.orderId?._id || workflow.orderId;
      const order = await Order.findById(orderId)
        .setOptions({ skipAutoPopulate: true })
        .select('_id status timeline workflows actualCompletion');
      if (!order) {
        result.warnings.push('Der zugehörige Auftrag wurde nicht gefunden – der Auftragsverlauf wurde nicht aktualisiert.');
        return result;
      }
      const actorInfo = OrderHistory.normalizeActor(actor);
      const eventKey = OrderHistory.repairWorkflowEventKey(workflow._id, transition, at);
      const historyEntry = OrderHistory.entry({
        key: meta.key,
        type: 'workflow',
        description: description || meta.label,
        actor: actorInfo,
        source: 'Reparatur-Workflow',
        reason,
        refs: { repairWorkflowId: workflow._id },
        visibility: meta.visibility || 'staff',
        eventKey,
        at,
      });
      const { filter, update } = OrderHistory.updateFor(historyEntry, { _id: order._id });
      await Order.updateOne(filter, update);

      result.orderStatus = order.status;
      const allowed = meta.to
        && Array.isArray(meta.from) && meta.from.includes(order.status)
        && (!meta.pauseRule || !hasOtherActiveTemplateWorkflow(order))
        && (!meta.ownPauseOnly || pausedByRepairWorkflow(order, workflow._id));
      if (allowed) {
        const updated = await getOrderService().updateStatus(order._id, meta.to, null, actorInfo.id !== 'system' ? actorInfo.id : null, {
          eventKey: `${eventKey}:status`,
          source: 'Reparatur-Workflow',
          refs: { repairWorkflowId: workflow._id },
          reason,
          notifyCustomer: false,
        });
        result.orderStatus = updated?.status || meta.to;
        result.statusChanged = !updated?.$locals?.unchanged;
      }
      // Reparatur fertig: Fertigstellungszeitpunkt am Auftrag (nur wenn noch keiner erfasst ist).
      if (transition === 'complete' && at) {
        await Order.updateOne({ _id: order._id, actualCompletion: null }, { $set: { actualCompletion: new Date(at) } });
      }
    } catch (error) {
      console.error(`RepairWorkflowService: order sync for ${transition} failed:`, error);
      result.warnings.push(ORDER_SYNC_WARNING);
    }
    return result;
  }

  /**
   * Abgleich fuer den AKTUELLEN Zustand erneut ausfuehren (Wiederholung nach einer Warnung).
   * Idempotent ueber die eventKeys - es entsteht kein zweiter Eintrag.
   */
  async syncOrderForCurrentState(orderId, actor) {
    const workflow = await RepairWorkflow.findOne({ orderId });
    if (!workflow) throw notFound();
    const timer = workflow.timerData || {};
    const lastReopen = (workflow.reopenHistory || []).slice(-1)[0];
    let transition = null;
    let at = null;
    let reason;
    if (workflow.status === 'completed') {
      transition = 'complete';
      at = timer.completedAt;
    } else if (workflow.status === 'paused') {
      transition = 'pause';
      at = timer.pausedAt;
      reason = timer.currentPauseReason;
    } else if (workflow.status === 'incident') {
      const incident = (workflow.incidents || []).slice(-1)[0];
      transition = 'incident';
      at = incident?.timestamp;
      reason = incident?.reason;
    } else if (workflow.status === 'in-progress') {
      const resumedAt = timer.resumedAt ? new Date(timer.resumedAt).getTime() : 0;
      const reopenedAt = lastReopen?.reopenedAt ? new Date(lastReopen.reopenedAt).getTime() : 0;
      if (reopenedAt && reopenedAt >= resumedAt) {
        transition = 'reopen';
        at = lastReopen.reopenedAt;
        reason = lastReopen.reason;
      } else if (resumedAt) {
        transition = 'resume';
        at = timer.resumedAt;
      } else {
        transition = 'approve';
        at = workflow.approvalData?.approvedAt;
      }
    }
    if (!transition || !at) {
      return { workflow, orderSync: { orderStatus: null, statusChanged: false, warnings: [] } };
    }
    const orderSync = await this.syncOrderFromRepairWorkflow(workflow, transition, {
      actor, at, reason, description: TRANSITIONS[transition].label,
    });
    return { workflow, orderSync };
  }

  /**
   * Ausdrueckliche Kundenbenachrichtigung zu einem Auftrag (In-App + E-Mail, forceEmail wie eine
   * Mitarbeiter-Chatnachricht). Der Text ist ausschliesslich der Kundentext - nie interne Notizen.
   * Rueckgabe { status: 'sent'|'failed'|'skipped'|'duplicate', inApp, email, reason?, error?, message, at }.
   */
  // emailOnly (nur Wiederholung): die In-App-Zeile des ersten Versuchs existiert bereits, nur die
  // E-Mail war gescheitert -> nur die E-Mail erneut senden (keine zweite In-App-Zeile).
  async _notifyOrderCustomer(orderId, { title, message, dedupeKey, event, workflowId, emailOnly = false }) {
    const at = new Date();
    const base = { message, at };
    try {
      const order = await Order.findById(orderId)
        .setOptions({ skipAutoPopulate: true })
        .select('_id orderNumber customerId status guestInfo guestTrackingToken')
        .lean();
      if (!order) return { ...base, status: 'failed', inApp: false, email: 'skipped', error: 'Auftrag nicht gefunden.' };
      // Stornierter Auftrag: keine Reparatur-Nachrichten mehr an den Kunden (HIST-14).
      if (order.status === 'cancelled') {
        return { ...base, status: 'skipped', inApp: false, email: 'skipped', reason: 'order_cancelled' };
      }
      const customerId = toIdString(order.customerId);
      if (!customerId) {
        return await this._notifyGuestCustomer(order, { title, message, dedupeKey, base });
      }
      const result = await getNotificationService().createNotification({
        userId: customerId,
        type: 'order_update',
        title,
        message,
        orderId: String(order._id),
        actionUrl: `/orders/${order._id}`,
        dedupeKey,
        metadata: {
          orderId: String(order._id),
          repairWorkflowId: workflowId ? String(workflowId) : null,
          event,
        },
      }, { forceEmail: true, returnResult: true, ...(emailOnly ? { sendInApp: false } : {}) });
      if (result?.deduplicated) return { ...base, status: 'duplicate', inApp: false, email: 'skipped' };
      const inApp = Boolean(result?.notification) || Boolean(emailOnly);
      const email = result?.emailDelivery?.status || 'skipped';
      if (email === 'failed') {
        return { ...base, status: 'failed', inApp, email, error: result?.emailDelivery?.error || 'E-Mail konnte nicht gesendet werden.' };
      }
      if (inApp || email === 'sent') return { ...base, status: 'sent', inApp, email };
      return { ...base, status: 'skipped', inApp, email, reason: result?.emailDelivery?.reason || 'preferences' };
    } catch (error) {
      console.error('RepairWorkflowService: customer notification failed:', error);
      return { ...base, status: 'failed', inApp: false, email: 'skipped', error: error?.message || String(error) };
    }
  }

  /**
   * Gastauftrag (kein Kundenkonto): E-Mail an guestInfo.email ueber denselben Weg wie die
   * Gast-Nachrichten-Mail (Trigger system_notification, Gast-Tracking-Link). Keine In-App-Zeile.
   * Doppelversand wird ueber einen Dedupe-Anspruch (NotificationDedupeClaim, userId = Auftrags-ID,
   * channel 'guest_email') atomar verhindert. Ohne E-Mail-Adresse: ehrlich 'skipped'/'no_contact'.
   */
  async _notifyGuestCustomer(order, { title, message, dedupeKey, base }) {
    const guestEmail = String(order?.guestInfo?.email || '').trim();
    if (!guestEmail) {
      return { ...base, status: 'skipped', inApp: false, email: 'skipped', reason: 'no_contact' };
    }
    const { NotificationDedupeClaim } = require('../models/Notification'); // eslint-disable-line global-require
    if (dedupeKey && NotificationDedupeClaim) {
      try {
        await NotificationDedupeClaim.create({ userId: order._id, dedupeKey, channel: 'guest_email' });
      } catch (claimError) {
        if (claimError && claimError.code === 11000) {
          return { ...base, status: 'duplicate', inApp: false, email: 'skipped' };
        }
        throw claimError;
      }
    }
    const guestName = `${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim() || guestEmail;
    const now = new Date();
    const result = await EmailService.sendTriggerEmail('system_notification', guestEmail, {
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      customerName: guestName,
      notificationTitle: title,
      notificationPreview: title,
      notificationTopic: order?.orderNumber ? `Auftrag ${order.orderNumber}` : 'Ihr Auftrag',
      notificationBody: message,
      notificationDate: now.toLocaleString('de-DE'),
      effectiveDate: now.toLocaleDateString('de-DE'),
      ctaLabel: 'Auftrag ansehen',
      ctaUrl: guestTrackingPath(order, guestEmail),
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
    });
    if (result?.success) {
      return { ...base, status: 'sent', inApp: false, email: 'sent', guest: true };
    }
    return {
      ...base,
      status: 'failed',
      inApp: false,
      email: 'failed',
      guest: true,
      error: 'E-Mail an den Gastkunden konnte nicht gesendet werden.',
    };
  }

  async initializeRepairWorkflow(orderId, customerId, technicianId, inspectionId) {
    try {
      let workflow = await RepairWorkflow.findOne({ orderId });

      if (workflow) {
        return workflow;
      }
      // Kein neuer Reparatur-Workflow fuer einen stornierten/abgeschlossenen Auftrag (409).
      await assertOrderOpenForRepair(orderId, 'init');

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

  async approveRepairStart(orderId, internalNotes, orderChanges, notifyCustomer, technicianId, technicianName, options = {}) {
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
      await assertOrderOpenForRepair(orderId, 'approve');

      const shouldNotify = notifyCustomer === true;
      const customerMessage = cleanCustomerMessage(options.customerMessage);
      const now = new Date();
      workflow.status = 'in-progress';
      workflow.approvalData = {
        internalNotes,
        orderChanges,
        notifyCustomer: shouldNotify,
        customerMessage: shouldNotify ? customerMessage : undefined,
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

      const actor = { id: technicianId, name: technicianName };
      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'approve', {
        actor, at: now, description: 'Reparatur gestartet',
      });

      // Kunde benachrichtigen: AN -> In-App + E-Mail an den Kunden des Auftrags mit einem
      // kundentauglichen Text (nie internalNotes, COMMS-16); AUS -> es verlaesst nichts das Team.
      if (shouldNotify) {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
          .select('orderNumber deviceBrand deviceModel').lean();
        const message = customerMessage || defaultCustomerMessage('approve', order);
        const customerNotification = await this._notifyOrderCustomer(orderId, {
          title: CUSTOMER_TITLES.approve,
          message,
          dedupeKey: `repairwf:${workflow._id}:approve:notify`,
          event: 'repair_workflow_started',
          workflowId: workflow._id,
        });
        await this._storeNotificationResult(workflow, 'approvalData.customerNotification', customerNotification);
        workflow.$locals.customerNotification = customerNotification;
      } else {
        workflow.$locals.customerNotification = { status: 'skipped', reason: 'not_requested' };
      }

      return workflow;
    } catch (error) {
      console.error('Error approving repair start:', error);
      throw error;
    }
  }

  // Ergebnis einer Benachrichtigung gezielt speichern (ueberschreibt keinen parallelen Zustandswechsel).
  async _storeNotificationResult(workflow, path, notification, extraFilter = {}, extraSet = {}) {
    const value = {
      status: notification.status,
      reason: notification.reason || undefined,
      error: notification.error || undefined,
      message: notification.message || undefined,
      inApp: Boolean(notification.inApp),
      email: notification.email || undefined,
      at: notification.at || new Date(),
    };
    try {
      await RepairWorkflow.updateOne({ _id: workflow._id, ...extraFilter }, { $set: { [path]: value, ...extraSet } });
    } catch (error) {
      console.error('RepairWorkflowService: could not store notification result:', error.message);
    }
    // Auch im zurueckgegebenen Dokument sichtbar machen.
    const segments = path.replace('.$.', '.').split('.');
    if (segments[0] === 'approvalData' && workflow.approvalData) workflow.approvalData.customerNotification = value;
    if (segments[0] === 'completionNotification') workflow.completionNotification = value;
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

      // Kein automatischer Kundenkontakt beim Pausieren: der Pausengrund ist intern (K04).
      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'pause', {
        actor: { id: technicianId, name: technicianName },
        at: now,
        reason: pauseReason,
        description: 'Reparatur pausiert',
      });
      workflow.$locals.customerNotification = { status: 'skipped', reason: 'not_requested' };

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
      // Storno pausiert die Reparatur; die Zeiterfassung darf danach nicht wieder anlaufen.
      await assertOrderOpenForRepair(orderId, 'resume');

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
      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'resume', {
        actor: { id: technicianId, name: technicianName },
        at: now,
        description: expectedStatus === 'incident' ? 'Reparatur nach Zwischenfall fortgesetzt' : 'Reparatur fortgesetzt',
      });
      return workflow;
    } catch (error) {
      console.error('Error resuming repair:', error);
      throw error;
    }
  }

  async completeRepair(orderId, technicianId, technicianName, options = {}) {
    try {
      const workflow = await RepairWorkflow.findOne({ orderId });
      if (!workflow) {
        throw notFound();
      }

      if (workflow.status === 'completed' || workflow.status === 'pending-confirmation') {
        throw invalidTransition('abgeschlossen', workflow.status);
      }
      await assertOrderOpenForRepair(orderId, 'complete');

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

      // Reparatur fertig => Auftrag 'ready-for-pickup' ("Reparatur abgeschlossen"), nie automatisch
      // 'completed'/versendet (HIST-17). Danach ist "An Kunden versenden" nach der bestehenden Regel moeglich.
      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'complete', {
        actor: { id: technicianId, name: technicianName },
        at: now,
        description: `Reparatur abgeschlossen (Arbeitszeit ${formatWorkTime(elapsedTimeMs)})`,
      });

      if (options.notifyCustomer === true) {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
          .select('orderNumber deviceBrand deviceModel').lean();
        const message = cleanCustomerMessage(options.customerMessage)
          || defaultCustomerMessage('complete', order, null, await ReturnMethod.resolveReturnMethodForOrder(orderId));
        const customerNotification = await this._notifyOrderCustomer(orderId, {
          title: CUSTOMER_TITLES.complete,
          message,
          dedupeKey: `repairwf:${workflow._id}:complete:${now.getTime()}:notify`,
          event: 'repair_workflow_completed',
          workflowId: workflow._id,
        });
        await this._storeNotificationResult(workflow, 'completionNotification', customerNotification);
        workflow.$locals.customerNotification = customerNotification;
      } else {
        workflow.$locals.customerNotification = { status: 'skipped', reason: 'not_requested' };
      }
      return workflow;
    } catch (error) {
      console.error('Error completing repair:', error);
      throw error;
    }
  }

  async reportIncident(orderId, incidentType, reason, additionalData, technicianId, technicianName, options = {}) {
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

      if (!INCIDENT_TYPE_LABELS[incidentType]) {
        throw new RepairWorkflowError('Unbekannte Art des Zwischenfalls.', 400, 'REPAIR_INCIDENT_INVALID_TYPE');
      }
      await assertOrderOpenForRepair(orderId, 'incident');
      // Der Kundentext gehoert nicht in die internen Zusatzdaten.
      const { customerMessage: additionalCustomerMessage, ...storedAdditionalData } = (additionalData && typeof additionalData === 'object') ? additionalData : {};
      const shouldNotify = options.notifyCustomer === true || additionalData?.notifyCustomer === true;
      const customerMessage = cleanCustomerMessage(options.customerMessage || additionalCustomerMessage);
      const now = new Date();
      const incidentData = {
        type: incidentType,
        status: 'reported',
        reason,
        notes: additionalData?.notes || '',
        additionalData: storedAdditionalData,
        reportedByTechnicianId: technicianId,
        reportedByTechnicianName: technicianName,
        timestamp: now,
      };

      workflow.incidents.push(incidentData);
      // Mongoose kopiert beim push - spaetere Aenderungen (emailSentAt) muessen am
      // gespeicherten Unterdokument erfolgen, nicht am Ausgangsobjekt.
      const storedIncident = workflow.incidents[workflow.incidents.length - 1];
      const expectedStatus = workflow.status;
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

      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'incident', {
        actor: { id: technicianId, name: technicianName },
        at: now,
        reason,
        description: `Zwischenfall gemeldet: ${INCIDENT_TYPE_LABELS[incidentType]}`,
      });

      // Kunde informieren: AN -> In-App + E-Mail mit kundentauglichem Text (nie Grund/Notizen des
      // Teams); AUS -> nichts verlaesst das Team. "Warten auf Kundenrückmeldung" (customer_info)
      // beginnt erst mit einer nachweislich erstellten Benachrichtigung (emailSentAt).
      if (shouldNotify) {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
          .select('orderNumber deviceBrand deviceModel').lean();
        const message = customerMessage || defaultCustomerMessage('incident', order, incidentType);
        const customerNotification = await this._notifyOrderCustomer(orderId, {
          title: incidentType === 'customer_info' ? CUSTOMER_TITLES.customer_info : CUSTOMER_TITLES.incident,
          message,
          dedupeKey: `repairwf:${workflow._id}:incident:${storedIncident._id}:notify`,
          event: `repair_incident_${incidentType}`,
          workflowId: workflow._id,
        });
        const sentAt = customerNotification.status === 'sent' ? customerNotification.at : null;
        await this._storeNotificationResult(
          workflow,
          'incidents.$.customerNotification',
          customerNotification,
          { 'incidents._id': storedIncident._id },
          sentAt ? { 'incidents.$.emailSentAt': sentAt } : {}
        );
        storedIncident.customerNotification = customerNotification;
        if (sentAt) storedIncident.emailSentAt = sentAt;
        workflow.$locals.customerNotification = customerNotification;
      } else {
        workflow.$locals.customerNotification = { status: 'skipped', reason: 'not_requested' };
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
      workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'incident-resolved', {
        actor: { id: technicianId, name: technicianName },
        at: incident.resolvedAt,
        reason: incident.resolutionNote,
        description: `Zwischenfall erledigt: ${INCIDENT_TYPE_LABELS[incident.type] || 'Zwischenfall'}`,
      });
      return workflow;
    } catch (error) {
      console.error('Error resolving repair incident:', error);
      throw error;
    }
  }

  /**
   * Ist die Auslieferung an den Kunden bereits angestossen (Versandlabel/Tracking vorhanden oder
   * Label-Erstellung laeuft/unklar)? Dieselbe Lesesicht wie die Auftragsansicht (DHLService).
   * Kann der Zustand nicht gelesen werden, gilt "ja" (sichere Richtung: keine Wiederaufnahme).
   */
  async isOutboundShippingStarted(orderId) {
    try {
      const state = await getDHLService().getOrderShipmentState(orderId);
      const outbound = state?.shipments?.outbound || {};
      return Boolean(outbound.hasLabel || outbound.trackingNumber || outbound.inProgress || outbound.reconciliationRequired);
    } catch (error) {
      console.error('RepairWorkflowService: outbound shipment state could not be read:', error.message);
      return true;
    }
  }

  /**
   * Abgeschlossene Reparatur wieder aufnehmen (HIST-11). Nur mit Grund, nur solange der Auftrag
   * nicht abgeschlossen/storniert ist und noch kein Versandlabel an den Kunden existiert. Die Zeit
   * zwischen Abschluss und Wiederaufnahme zaehlt als Pause, nicht als Arbeitszeit. Keine
   * Schein-Pause/-Fortsetzung noetig.
   */
  async reopenRepair(orderId, reason, technicianId, technicianName) {
    const trimmedReason = String(reason || '').trim().slice(0, 2000);
    if (!trimmedReason) {
      throw new RepairWorkflowError('Bitte einen Grund für die Wiederaufnahme angeben.', 400, 'REPAIR_REOPEN_REASON_REQUIRED');
    }
    const workflow = await RepairWorkflow.findOne({ orderId });
    if (!workflow) throw notFound();
    if (workflow.status !== 'completed') {
      throw invalidTransition('wieder aufgenommen', workflow.status);
    }
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('status').lean();
    if (!order) {
      throw new RepairWorkflowError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new RepairWorkflowError(
        `Der Auftrag ist ${order.status === 'completed' ? 'bereits abgeschlossen' : 'storniert'} – die Reparatur kann nicht wieder aufgenommen werden.`,
        409,
        'REPAIR_REOPEN_ORDER_CLOSED'
      );
    }
    if (await this.isOutboundShippingStarted(orderId)) {
      throw new RepairWorkflowError(
        'Das Gerät ist bereits für den Versand vorbereitet (Versandlabel an den Kunden vorhanden) – Wiederaufnahme nicht möglich.',
        409,
        'REPAIR_REOPEN_OUTBOUND_EXISTS'
      );
    }

    const now = new Date();
    const previousCompletedAt = workflow.timerData?.completedAt ? new Date(workflow.timerData.completedAt) : null;
    const gapMs = previousCompletedAt ? Math.max(0, now.getTime() - previousCompletedAt.getTime()) : 0;
    workflow.status = 'in-progress';
    workflow.timerData.totalPausedMs = Number(workflow.timerData.totalPausedMs || 0) + gapMs;
    workflow.timerData.completedAt = undefined;
    workflow.timerData.resumedAt = now;
    workflow.reopenHistory.push({
      reopenedAt: now,
      previousCompletedAt: previousCompletedAt || undefined,
      gapMs,
      reason: trimmedReason,
      technicianId: technicianId || undefined,
      technicianName: technicianName || undefined,
    });
    workflow.lastStatusChangeAt = now;
    await saveTransition(workflow, { status: 'completed' }, (status) => invalidTransition('wieder aufgenommen', status));

    workflow.$locals.orderSync = await this.syncOrderFromRepairWorkflow(workflow, 'reopen', {
      actor: { id: technicianId, name: technicianName },
      at: now,
      reason: trimmedReason,
      description: 'Reparatur wieder aufgenommen',
    });
    return workflow;
  }

  /**
   * Fehlgeschlagene/uebersprungene Kundenbenachrichtigung erneut senden (ohne den Zustand erneut
   * zu speichern). target: 'approval' | 'completion' | 'incident' (+ incidentId). Bereits
   * gesendete Benachrichtigungen werden nicht wiederholt ({ status: 'duplicate' }).
   */
  async retryCustomerNotification(orderId, { target, incidentId, customerMessage } = {}) {
    const workflow = await RepairWorkflow.findOne({ orderId });
    if (!workflow) throw notFound();
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
      .select('orderNumber deviceBrand deviceModel').lean();
    let previous;
    let path;
    let filter = {};
    let title;
    let defaultText;
    let event;
    let incident = null;
    if (target === 'approval') {
      if (!workflow.approvalData?.approvedAt) {
        throw new RepairWorkflowError('Die Reparatur wurde noch nicht gestartet.', 409, 'REPAIR_WORKFLOW_INVALID_TRANSITION');
      }
      previous = workflow.approvalData.customerNotification;
      path = 'approvalData.customerNotification';
      title = CUSTOMER_TITLES.approve;
      defaultText = workflow.approvalData.customerMessage || defaultCustomerMessage('approve', order);
      event = 'repair_workflow_started';
    } else if (target === 'completion') {
      if (workflow.status !== 'completed') {
        throw new RepairWorkflowError('Die Reparatur ist nicht abgeschlossen.', 409, 'REPAIR_WORKFLOW_INVALID_TRANSITION');
      }
      previous = workflow.completionNotification;
      path = 'completionNotification';
      title = CUSTOMER_TITLES.complete;
      defaultText = defaultCustomerMessage('complete', order, null, await ReturnMethod.resolveReturnMethodForOrder(orderId));
      event = 'repair_workflow_completed';
    } else if (target === 'incident') {
      incident = mongoose.Types.ObjectId.isValid(String(incidentId || '')) ? workflow.incidents.id(incidentId) : null;
      if (!incident) throw new RepairWorkflowError('Zwischenfall nicht gefunden.', 404, 'REPAIR_INCIDENT_NOT_FOUND');
      previous = incident.customerNotification;
      path = 'incidents.$.customerNotification';
      filter = { 'incidents._id': incident._id };
      title = incident.type === 'customer_info' ? CUSTOMER_TITLES.customer_info : CUSTOMER_TITLES.incident;
      defaultText = defaultCustomerMessage('incident', order, incident.type);
      event = `repair_incident_${incident.type}`;
    } else {
      throw new RepairWorkflowError('Unbekanntes Ziel der Benachrichtigung.', 400, 'REPAIR_NOTIFY_INVALID_TARGET');
    }
    if (previous?.status === 'sent' || (incident && incident.emailSentAt)) {
      return { workflow, customerNotification: { status: 'duplicate', reason: 'already_sent', at: previous?.at || incident?.emailSentAt } };
    }
    const message = cleanCustomerMessage(customerMessage) || previous?.message || defaultText;
    // Schluessel je Wiederholung aus dem zuletzt gespeicherten Versuch abgeleitet: der erste Versuch
    // kann eine In-App-Zeile ohne E-Mail hinterlassen haben, deshalb nicht der Erstschluessel. Zwei
    // parallele Wiederholungen (Doppelklick, zwei Mitarbeiter) lesen denselben Stand, bekommen
    // denselben Schluessel und kollidieren am eindeutigen Dedupe-Index -> genau ein Versand.
    // Nach einem gescheiterten Versuch aendert sich previous.at, die naechste Wiederholung sendet erneut.
    const previousAt = previous?.at ? new Date(previous.at).getTime() : 0;
    // In-App-Zeile kam beim letzten Versuch an, nur die E-Mail scheiterte (gleicher Text):
    // nur die E-Mail wiederholen, sonst laege dieselbe Nachricht zweimal in der Glocke.
    const emailOnly = previous?.inApp === true && previous?.email === 'failed' && message === previous?.message;
    const customerNotification = await this._notifyOrderCustomer(orderId, {
      title,
      message,
      dedupeKey: `repairwf:${workflow._id}:${target}:${incident ? incident._id : 'main'}:retry:${previousAt || 'initial'}`,
      event,
      workflowId: workflow._id,
      emailOnly,
    });
    if (customerNotification.status === 'duplicate') {
      // Die parallele Wiederholung speichert ihr eigenes Ergebnis - hier nichts ueberschreiben.
      return { workflow, customerNotification: { ...customerNotification, reason: 'already_sent' } };
    }
    const sentAt = incident && customerNotification.status === 'sent' ? customerNotification.at : null;
    await this._storeNotificationResult(workflow, path, customerNotification, filter, sentAt ? { 'incidents.$.emailSentAt': sentAt } : {});
    if (incident) {
      incident.customerNotification = customerNotification;
      if (sentAt) incident.emailSentAt = sentAt;
    }
    return { workflow, customerNotification };
  }

  /**
   * Auftrag storniert (HIST-14): eine laufende Reparatur wird pausiert (Zeiterfassung stoppt),
   * nicht abgeschlossen oder geloescht. Kein Kundenkontakt, keine Rechnungs-/Zahlungsaenderung.
   * Rueckgabe { paused: boolean }.
   */
  async pauseForOrderCancellation(orderId, actor = null) {
    const workflow = await RepairWorkflow.findOne({ orderId });
    if (!workflow || workflow.status !== 'in-progress') return { paused: false };
    const actorInfo = OrderHistory.normalizeActor(actor);
    const now = new Date();
    workflow.status = 'paused';
    workflow.timerData.pausedAt = now;
    workflow.timerData.currentPauseReason = 'Auftrag storniert';
    workflow.timerData.currentPausedByTechnicianId = actorInfo.id !== 'system' && mongoose.Types.ObjectId.isValid(actorInfo.id) ? actorInfo.id : undefined;
    workflow.timerData.currentPausedByTechnicianName = actorInfo.name;
    workflow.lastStatusChangeAt = now;
    try {
      await saveTransition(workflow, { status: 'in-progress' }, (status) => invalidTransition('pausiert', status));
    } catch (error) {
      if (error && error.statusCode === 409) return { paused: false };
      throw error;
    }
    // eventKey im Format der Leseprojektion ('pause' + pausedAt), damit kein Doppeleintrag entsteht.
    const historyEntry = OrderHistory.entry({
      key: TRANSITIONS['cancel-pause'].key,
      type: 'workflow',
      description: TRANSITIONS['cancel-pause'].label,
      actor: actorInfo,
      source: 'Reparatur-Workflow',
      reason: 'Auftrag storniert',
      refs: { repairWorkflowId: workflow._id },
      eventKey: OrderHistory.repairWorkflowEventKey(workflow._id, 'pause', now),
      at: now,
    });
    const { filter, update } = OrderHistory.updateFor(historyEntry, { _id: workflow.orderId });
    await Order.updateOne(filter, update);
    return { paused: true };
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
        .populate('orderId', 'orderNumber customerId status')
        .populate('technicianId', 'name email')
        .sort({ lastStatusChangeAt: 1 });

      // Stornierte Auftraege sind keine liegengebliebene Arbeit (HIST-14).
      return inactiveWorkflows.filter((workflow) => workflow?.orderId?.status !== 'cancelled');
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
module.exports.defaultCustomerMessage = defaultCustomerMessage;
module.exports.INCIDENT_TYPE_LABELS = INCIDENT_TYPE_LABELS;
