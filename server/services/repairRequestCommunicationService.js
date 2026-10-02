const mongoose = require('mongoose');
const RepairRequestCommunication = require('../models/RepairRequestCommunication');
const RepairRequest = require('../models/RepairRequest');
const User = require('../models/User');
const NotificationService = require('./notificationService');
const EmailService = require('./emailService');
const { summarizeMessages } = require('../utils/communicationReadRules');

// ─────────────────────────────────────────────────────────────────────────────
// Kleine Helfer
// ─────────────────────────────────────────────────────────────────────────────

const httpError = (message, statusCode = 400, code = undefined) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

// Suche: Benutzereingabe nie als RegExp interpretieren ('(' oder '[' liess die Liste mit 500 abstürzen).
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isStaffRole = (role) => ['staff', 'admin'].includes(String(role || '').toLowerCase());

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const sortMessages = (communication) => {
  if (communication && Array.isArray(communication.messages) && communication.messages.length > 1) {
    communication.messages.sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  }
  return communication;
};

const preview = (text, max = 140) => {
  const trimmed = String(text || '').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
};

const COMPANY = () => process.env.COMPANY_NAME || 'McRepair.de';
const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL || 'support@mcrepair.de';
const SUPPORT_PHONE = () => process.env.SUPPORT_PHONE || '+49 (0) 123/456789';

const QUICK_ACTION_LABELS = {
  parts_needed: 'Ersatzteile erforderlich',
  approval_required: 'Kundenfreigabe erforderlich',
  additional_cost: 'Zusatzkosten-Schätzung',
  status_update: 'Statusupdate zur Reparatur',
  schedule_appointment: 'Terminvereinbarung erforderlich',
};

class RepairRequestCommunicationService {
  static httpError = httpError;
  static escapeRegex = escapeRegex;

  // ───────────────────────────────────────────────────────────────────────────
  // Gemeinsame Regeln (auch für den zentralen Nachrichten-Adapter gedacht)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Geräteanzeige ohne Dopplung: "Fairphone" + "Fairphone 5" => "Fairphone 5".
   */
  static formatDeviceLabel(brand, model) {
    const b = String(brand || '').trim();
    const m = String(model || '').trim();
    if (!b) return m;
    if (!m) return b;
    if (m.toLowerCase().startsWith(b.toLowerCase())) return m;
    return `${b} ${m}`;
  }

  /**
   * Kanonischer Link auf eine Reparaturanfrage – je Empfänger.
   *  audience 'staff'    -> /admin/repair-requests?requestId= (Admin) bzw. /staff/repair-requests?requestId=
   *  audience 'customer' -> Gast: /guest-repair-tracking?token=..&email=..; Mitglied: /my-repair-requests?requestId=
   * Relativer Pfad; E-Mails wandeln ihn mit EmailService.buildSystemUrl in eine absolute URL.
   */
  static buildRepairRequestPath(repairRequest, audience = 'customer', recipientRole = 'admin') {
    const id = String(repairRequest?._id || '');
    if (audience === 'staff') {
      return String(recipientRole || '').toLowerCase() === 'admin'
        ? `/admin/repair-requests?requestId=${id}`
        : `/staff/repair-requests?requestId=${id}`;
    }
    const isGuest = Boolean(repairRequest?.isGuest) && !repairRequest?.customerId;
    if (isGuest && repairRequest?.guestTrackingToken && repairRequest?.customerEmail) {
      return `/guest-repair-tracking?token=${encodeURIComponent(repairRequest.guestTrackingToken)}&email=${encodeURIComponent(String(repairRequest.customerEmail).toLowerCase())}`;
    }
    return `/my-repair-requests?requestId=${id}`;
  }

  static isReadBy(message, userId) {
    if (!userId) return false;
    const uid = String(userId);
    return Array.isArray(message?.readBy) && message.readBy.some((entry) => String(entry?.userId || '') === uid);
  }

  static readAtOf(message, userId) {
    if (!userId || !Array.isArray(message?.readBy)) return 0;
    const uid = String(userId);
    const entry = message.readBy.find((r) => String(r?.userId || '') === uid);
    return entry ? toTime(entry.readAt) : 0;
  }

  /**
   * Nachrichten in die gemeinsame Form der Leseregel bringen: senderId ist hier historisch ein
   * eingebettetes {name,email,avatar}-Objekt, die Benutzer-ID steht (neu) in senderUserId.
   */
  static normalizeForReadRules(communication) {
    const messages = Array.isArray(communication?.messages) ? communication.messages : [];
    return messages.map((message) => {
      const plain = typeof message?.toObject === 'function' ? message.toObject() : message;
      return { ...plain, senderId: plain?.senderUserId || null };
    });
  }

  static viewerOf(user) {
    return { userId: user?._id || user?.id || user?.userId || null, role: user?.role || 'customer' };
  }

  /**
   * Ungelesen PRO BENUTZER und "Antwort ausstehend" (teamweit) – EINE Regel für alle Zähler:
   * server/utils/communicationReadRules (dieselbe wie Postfach, Dashboard und Auftrags-Thread).
   */
  static summarizeThread(communication, user) {
    const summary = summarizeMessages(this.normalizeForReadRules(communication), this.viewerOf(user));
    return {
      unreadCount: user ? summary.unreadCount : 0,
      awaitingReply: summary.awaitingReply,
      pendingFeedbackCount: summary.pendingQuestions,
      pendingActionsCount: summary.pendingActions,
      messageCount: summary.messageCount,
      lastMessageAt: communication?.lastMessageAt || summary.lastActivityAt || null,
    };
  }

  static unreadCountFor(communication, user) {
    return this.summarizeThread(communication, user).unreadCount;
  }

  static isAwaitingReply(communication) {
    return this.summarizeThread(communication, null).awaitingReply;
  }

  /**
   * Zusammenfassungen für viele Anfragen in EINER Abfrage (Listen ohne N+1-Aufrufe).
   * @returns Map<repairRequestId, summary>
   */
  static async getThreadSummaries(repairRequestIds = [], user) {
    const ids = [...new Set((repairRequestIds || []).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    const result = new Map();
    if (!ids.length) return result;
    const threads = await RepairRequestCommunication.find({ repairRequestId: { $in: ids } })
      .select('repairRequestId messages.senderType messages.senderUserId messages.messageType messages.readBy messages.createdAt messages.feedbackRequest.status messages.feedbackRequest.respondedAt messages.quickAction.status messages.quickAction.completedAt lastMessageAt')
      .lean();
    threads.forEach((thread) => {
      result.set(String(thread.repairRequestId), this.summarizeThread(thread, user));
    });
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lesen
  // ───────────────────────────────────────────────────────────────────────────

  // Get communication threads visible to the current user
  static async getCommunicationsForUser(userId, userRole = 'customer', filters = {}) {
    try {
      const page = Math.max(1, parseInt(filters.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const search = String(filters.search || '').trim();
      const staff = isStaffRole(userRole);

      const requestQuery = {};
      if (!staff) requestQuery.customerId = userId;
      if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        requestQuery.$or = [
          { requestNumber: searchRegex },
          { deviceBrand: searchRegex },
          { deviceModel: searchRegex },
          { customerName: searchRegex },
          { customerEmail: searchRegex },
        ];
      }

      const communicationQuery = { 'messages.0': { $exists: true } };
      if (!staff || search) {
        const matchingRequests = await RepairRequest.find(requestQuery).select('_id').lean();
        if (!matchingRequests.length) {
          return { communications: [], totalPages: 0, currentPage: page, totalCount: 0 };
        }
        communicationQuery.repairRequestId = { $in: matchingRequests.map((request) => request._id) };
      }

      const [totalCount, pageThreads] = await Promise.all([
        RepairRequestCommunication.countDocuments(communicationQuery),
        RepairRequestCommunication.find(communicationQuery)
          .sort({ lastMessageAt: -1, updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const repairRequestIds = pageThreads.map((comm) => comm.repairRequestId).filter(Boolean);
      const repairRequests = await RepairRequest.find({ _id: { $in: repairRequestIds } })
        .select('_id requestNumber deviceBrand deviceModel customerId customerName customerEmail customerPhone isGuest')
        .lean();
      const requestById = new Map(repairRequests.map((request) => [request._id.toString(), request]));
      const viewer = { _id: userId, role: userRole };

      const communications = pageThreads.map((comm) => {
        const repairRequestId = comm.repairRequestId ? comm.repairRequestId.toString() : null;
        const repairRequest = repairRequestId ? requestById.get(repairRequestId) : null;
        sortMessages(comm);
        const summary = this.summarizeThread(comm, viewer);
        return {
          _id: comm._id,
          repairRequestId,
          requestNumber: repairRequest?.requestNumber || '',
          deviceInfo: repairRequest ? this.formatDeviceLabel(repairRequest.deviceBrand, repairRequest.deviceModel) : '',
          customer: repairRequest && staff
            ? {
                name: repairRequest.customerName || 'Kunde',
                email: repairRequest.customerEmail || '',
                phone: repairRequest.customerPhone || '',
                isGuest: Boolean(repairRequest.isGuest && !repairRequest.customerId),
              }
            : null,
          messages: comm.messages || [],
          status: comm.status,
          pendingFeedbackCount: summary.pendingFeedbackCount,
          pendingActionsCount: summary.pendingActionsCount,
          unreadCount: summary.unreadCount,
          awaitingReply: summary.awaitingReply,
          link: repairRequest
            ? this.buildRepairRequestPath(repairRequest, staff ? 'staff' : 'customer', userRole)
            : null,
          createdBy: comm.createdBy,
          lastMessageAt: comm.lastMessageAt || comm.updatedAt,
          createdAt: comm.createdAt,
          updatedAt: comm.updatedAt,
        };
      });

      return {
        communications,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        totalCount,
      };
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting communications for user: ${error.message}`, error);
      throw error;
    }
  }

  // Get or create communication thread for a repair request (atomar, keine Doppel-Threads)
  static async getOrCreateCommunicationThread(repairRequestId, initiatingUserId = null, initiatingUserName = null, initiatingUserRole = null) {
    const setOnInsert = {
      repairRequestId,
      messages: [],
      status: 'active',
      pendingFeedbackCount: 0,
      pendingActionsCount: 0,
    };
    if (initiatingUserId) {
      setOnInsert.createdBy = { userId: initiatingUserId, name: initiatingUserName, role: initiatingUserRole };
    }
    try {
      return await RepairRequestCommunication.findOneAndUpdate(
        { repairRequestId },
        { $setOnInsert: setOnInsert },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error?.code === 11000) {
        return RepairRequestCommunication.findOne({ repairRequestId });
      }
      console.error(`RepairRequestCommunicationService: Error getting or creating communication thread: ${error.message}`, error);
      throw error;
    }
  }

  // Get communication thread (used by frontend). Legt NICHT automatisch an.
  static async getCommunicationThread(repairRequestId) {
    const communication = await RepairRequestCommunication.findOne({ repairRequestId });
    if (!communication) return null;
    return sortMessages(communication);
  }

  static async refetchSorted(repairRequestId) {
    return sortMessages(await RepairRequestCommunication.findOne({ repairRequestId }));
  }

  /**
   * Hängt eine Nachricht atomar an (Upsert des Threads). Mit clientMessageId idempotent:
   * eine Wiederholung derselben ID legt keine zweite Nachricht an (duplicate: true).
   */
  static async appendMessage(repairRequestId, message, { inc = {}, createdBy = null } = {}) {
    const now = new Date();
    const doc = { _id: new mongoose.Types.ObjectId(), readBy: [], createdAt: now, updatedAt: now, ...message };
    const update = {
      $push: { messages: doc },
      $set: { lastMessageAt: now },
      $setOnInsert: {
        status: 'active',
        ...(createdBy ? { createdBy } : {}),
      },
    };
    const incFields = { pendingFeedbackCount: 0, pendingActionsCount: 0, ...inc };
    // $inc und $setOnInsert duerfen dasselbe Feld nicht gleichzeitig setzen.
    update.$inc = incFields;

    const filter = { repairRequestId };
    if (doc.clientMessageId) {
      filter['messages.clientMessageId'] = { $ne: doc.clientMessageId };
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // setDefaultsOnInsert aus: die Zaehler werden per $inc gesetzt (sonst Pfadkonflikt).
        const updated = await RepairRequestCommunication.findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: false,
        });
        return { communication: sortMessages(updated), messageId: doc._id, duplicate: false };
      } catch (error) {
        if (error?.code !== 11000) throw error;
        // Entweder existiert der Thread bereits mit dieser clientMessageId (Wiederholung)
        // oder zwei erste Nachrichten kamen gleichzeitig: einmal ohne Upsert-Konflikt erneut.
        if (doc.clientMessageId) {
          const existing = await RepairRequestCommunication.findOne({
            repairRequestId,
            'messages.clientMessageId': doc.clientMessageId,
          });
          if (existing) {
            const original = existing.messages.find((m) => m.clientMessageId === doc.clientMessageId);
            return { communication: sortMessages(existing), messageId: original?._id || null, duplicate: true };
          }
        }
      }
    }
    throw httpError('Die Nachricht konnte nicht gespeichert werden. Bitte erneut versuchen.', 409);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Benachrichtigungen (deutsch, mit Deep-Link; Fallback: alle aktiven Admins)
  // ───────────────────────────────────────────────────────────────────────────

  static async resolveStaffRecipients(repairRequest) {
    if (repairRequest?.assignedStaffId) {
      const assigned = await User.findById(repairRequest.assignedStaffId).select('_id role isActive').lean();
      if (assigned && assigned.isActive !== false) {
        return { recipients: [assigned], fallback: false };
      }
    }
    const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id role').lean();
    return { recipients: admins, fallback: true };
  }

  static async notifyStaff(repairRequest, { title, message, messageType, messageId = null }) {
    try {
      const { recipients, fallback } = await this.resolveStaffRecipients(repairRequest);
      await Promise.all(recipients.map((recipient) => NotificationService.createNotification({
        userId: recipient._id,
        title,
        message,
        type: 'message',
        actionUrl: this.buildRepairRequestPath(repairRequest, 'staff', recipient.role),
        metadata: {
          repairRequestId: String(repairRequest._id),
          requestNumber: repairRequest.requestNumber,
          messageId: messageId ? String(messageId) : null,
          messageType,
        },
      }, fallback ? { sendEmail: false } : {}).catch((err) => {
        console.error('RepairRequestCommunicationService: Fehler bei Mitarbeiter-Benachrichtigung:', err.message);
      })));
      return { recipients: recipients.length };
    } catch (error) {
      console.error('RepairRequestCommunicationService: notifyStaff fehlgeschlagen:', error.message);
      return { recipients: 0, error: error.message };
    }
  }

  /**
   * Kunde benachrichtigen: Mitglied => In-App + E-Mail (forceEmail wie im Auftrags-Chat),
   * Gast => E-Mail an die Anfrage-Adresse mit Tracking-/Antwort-Link.
   * options.sendEmailToMember=false: nur In-App (z. B. wenn eine eigene E-Mail folgt).
   */
  static async notifyCustomer(repairRequest, { title, message, messageType, messageId = null, ctaLabel = 'Anfrage ansehen', emailBody = null, sendEmailToMember = true }) {
    const result = { inApp: false, email: null };
    try {
      if (repairRequest?.customerId) {
        const created = await NotificationService.createNotification({
          userId: repairRequest.customerId,
          title,
          message,
          type: 'message',
          actionUrl: this.buildRepairRequestPath(repairRequest, 'customer'),
          metadata: {
            repairRequestId: String(repairRequest._id),
            requestNumber: repairRequest.requestNumber,
            messageId: messageId ? String(messageId) : null,
            messageType,
          },
        }, sendEmailToMember ? { forceEmail: true } : { sendEmail: false });
        result.inApp = Boolean(created);
        return result;
      }
      const guestEmail = String(repairRequest?.customerEmail || '').trim();
      if (!guestEmail) return result;
      const sent = await EmailService.sendTriggerEmail('system_notification', guestEmail, {
        companyName: COMPANY(),
        customerName: repairRequest.customerName || guestEmail,
        notificationTitle: title,
        notificationPreview: message,
        notificationTopic: `Reparaturanfrage ${repairRequest.requestNumber || ''}`.trim(),
        notificationBody: emailBody || message,
        notificationDate: new Date().toLocaleString('de-DE'),
        effectiveDate: new Date().toLocaleDateString('de-DE'),
        ctaLabel,
        ctaUrl: this.buildRepairRequestPath(repairRequest, 'customer'),
        supportEmail: SUPPORT_EMAIL(),
        supportPhone: SUPPORT_PHONE(),
      });
      result.email = sent?.success ? 'accepted' : 'failed';
      if (!sent?.success) result.emailError = sent?.error || 'Unbekannter Fehler';
      return result;
    } catch (error) {
      console.error('RepairRequestCommunicationService: Kunden-Benachrichtigung fehlgeschlagen:', error.message);
      result.email = 'failed';
      result.emailError = error.message;
      return result;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Schreiben
  // ───────────────────────────────────────────────────────────────────────────

  // Send a message
  static async sendMessage(repairRequestId, senderId, senderName, content, senderType = 'staff', senderRole = null, options = {}) {
    const text = String(content || '').trim();
    if (!text) throw httpError('Nachrichteninhalt darf nicht leer sein.', 400);
    if (text.length > 5000) throw httpError('Die Nachricht ist zu lang (max. 5000 Zeichen).', 400);

    const repairRequest = await RepairRequest.findById(repairRequestId)
      .select('_id requestNumber customerId customerName customerEmail isGuest guestTrackingToken assignedStaffId')
      .lean();
    if (!repairRequest) throw httpError('Reparaturanfrage nicht gefunden.', 404);

    const clientMessageId = options.clientMessageId ? String(options.clientMessageId).slice(0, 100) : undefined;
    const { communication, messageId, duplicate } = await this.appendMessage(repairRequest._id, {
      senderId: { name: senderName, email: '', avatar: null },
      senderUserId: senderId && mongoose.Types.ObjectId.isValid(String(senderId)) ? senderId : undefined,
      senderType,
      senderName,
      senderRole,
      messageType: 'text',
      content: text,
      ...(clientMessageId ? { clientMessageId } : {}),
    }, {
      createdBy: senderId ? { userId: senderId, name: senderName, role: senderRole } : null,
    });

    if (!duplicate) {
      if (senderType === 'customer') {
        await this.notifyStaff(repairRequest, {
          title: `Neue Kundennachricht zur Reparaturanfrage ${repairRequest.requestNumber}`,
          message: `${senderName || 'Kunde'}: ${preview(text)}`,
          messageType: 'text',
          messageId,
        });
      } else {
        await this.notifyCustomer(repairRequest, {
          title: 'Neue Nachricht zu Ihrer Reparaturanfrage',
          message: `${senderName || 'Unser Team'}: ${preview(text)}`,
          emailBody: preview(text, 600),
          ctaLabel: 'Nachricht lesen und antworten',
          messageType: 'text',
          messageId,
        });
      }
    }

    if (communication) communication.$locals = { ...(communication.$locals || {}), duplicate };
    return communication;
  }

  /**
   * Rückfrage mit Auswahlantworten. extra.metadata bindet sie fachlich (z. B. Kostenvoranschlag),
   * extra.notify=false unterdrückt die Standard-Benachrichtigung (Aufrufer benachrichtigt selbst).
   * @returns {Promise<{communication, messageId}>}
   */
  static async createFeedbackRequest(repairRequestId, senderId, senderName, question, options, senderRole = null, extra = {}) {
    const text = String(question || '').trim();
    const cleanOptions = (Array.isArray(options) ? options : [])
      .map((opt) => ({ label: String(opt?.label || '').trim(), value: String(opt?.value || opt?.label || '').trim() }))
      .filter((opt) => opt.label && opt.value);
    if (!text || cleanOptions.length === 0) {
      throw httpError('Frage und mindestens eine Antwortmöglichkeit sind erforderlich.', 400);
    }

    const repairRequest = await RepairRequest.findById(repairRequestId)
      .select('_id requestNumber customerId customerName customerEmail isGuest guestTrackingToken assignedStaffId')
      .lean();
    if (!repairRequest) throw httpError('Reparaturanfrage nicht gefunden.', 404);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { communication, messageId } = await this.appendMessage(repairRequest._id, {
      senderId: { name: senderName, email: '', avatar: null },
      senderUserId: senderId && mongoose.Types.ObjectId.isValid(String(senderId)) ? senderId : undefined,
      senderType: 'staff',
      senderName,
      senderRole,
      messageType: 'feedback_request',
      content: text,
      feedbackRequest: {
        _id: new mongoose.Types.ObjectId(),
        question: text,
        options: cleanOptions,
        status: 'pending',
        expiresAt: extra.metadata?.kind === 'quote' ? undefined : expiresAt,
        ...(extra.metadata ? { metadata: extra.metadata } : {}),
      },
    }, {
      inc: { pendingFeedbackCount: 1 },
      createdBy: senderId ? { userId: senderId, name: senderName, role: senderRole } : null,
    });

    if (extra.notify !== false) {
      await this.notifyCustomer(repairRequest, {
        title: 'Rückmeldung zu Ihrer Reparaturanfrage erforderlich',
        message: preview(text),
        emailBody: `${preview(text, 600)}\n\nBitte antworten Sie über den Link.`,
        ctaLabel: 'Jetzt antworten',
        messageType: 'feedback_request',
        messageId,
      });
    }

    return { communication, messageId };
  }

  // Send a feedback request (öffentliche Signatur unverändert: liefert den Thread)
  static async sendFeedbackRequest(repairRequestId, senderId, senderName, question, options, senderRole = null, extra = {}) {
    const { communication } = await this.createFeedbackRequest(repairRequestId, senderId, senderName, question, options, senderRole, extra);
    return communication;
  }

  /**
   * Rückfrage abbrechen (z. B. alter Kostenvoranschlag nach Änderung). Nur wenn noch offen.
   */
  static async expireFeedbackRequest(repairRequestId, messageId) {
    if (!messageId) return false;
    const result = await RepairRequestCommunication.updateOne(
      { repairRequestId, messages: { $elemMatch: { _id: messageId, 'feedbackRequest.status': 'pending' } } },
      { $set: { 'messages.$.feedbackRequest.status': 'expired' }, $inc: { pendingFeedbackCount: -1 } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Antwort auf eine Rückfrage – genau einmal (atomar an status 'pending' gebunden).
   * options.channel: 'customer' | 'guest'. Ist die Rückfrage an einen Kostenvoranschlag
   * gebunden, wird die Entscheidung über RepairRequestService.applyQuoteDecision übernommen.
   */
  static async respondToFeedback(repairRequestId, messageId, response, responderId, responderName, options = {}) {
    if (!messageId || !mongoose.Types.ObjectId.isValid(String(messageId))) {
      throw httpError('Rückfrage nicht gefunden.', 404);
    }
    const communication = await RepairRequestCommunication.findOne({ repairRequestId });
    if (!communication) throw httpError('Rückfrage nicht gefunden.', 404);
    const message = communication.messages.id(messageId);
    if (!message || message.messageType !== 'feedback_request' || !message.feedbackRequest) {
      throw httpError('Rückfrage nicht gefunden.', 404);
    }
    if (message.feedbackRequest.status !== 'pending') {
      throw httpError(message.feedbackRequest.status === 'expired'
        ? 'Diese Rückfrage ist nicht mehr gültig.'
        : 'Diese Frage wurde bereits beantwortet.', 409);
    }
    const value = String(response?.value || '').trim();
    const option = (message.feedbackRequest.options || []).find((opt) => String(opt.value) === value);
    if (!option) throw httpError('Ungültige Antwort.', 400);

    const isQuote = message.feedbackRequest.metadata?.kind === 'quote';
    const channel = options.channel === 'guest' ? 'guest' : 'customer';
    const respondedAt = new Date();

    if (isQuote) {
      // Kostenvoranschlag: ZUERST die (versionsgebundene, atomare) Entscheidung. Erst wenn sie
      // gilt, markiert applyQuoteDecision die Rückfrage als beantwortet. Scheitert sie (Angebot
      // geändert, bereits beantwortet, Anfrage abgelehnt/umgewandelt), bleibt der Thread
      // widerspruchsfrei (Rückfrage verfällt bzw. zeigt die tatsächliche Entscheidung).
      // Lazy require: repairRequestService benutzt diesen Service ebenfalls.
      const RepairRequestService = require('./repairRequestService');
      await RepairRequestService.applyQuoteDecision(repairRequestId, {
        decision: option.value === 'quote_accept' ? 'accept' : 'decline',
        responderName,
        responderId,
        channel,
        feedbackMessageId: message._id,
        quoteVersion: message.feedbackRequest.metadata?.quoteVersion,
        fromFeedback: true,
      });
      return this.refetchSorted(repairRequestId);
    }

    const claim = await RepairRequestCommunication.updateOne(
      { repairRequestId, messages: { $elemMatch: { _id: message._id, 'feedbackRequest.status': 'pending' } } },
      {
        $set: {
          'messages.$.feedbackRequest.status': 'responded',
          'messages.$.feedbackRequest.response': { label: option.label, value: option.value },
          'messages.$.feedbackRequest.respondedBy': responderName,
          'messages.$.feedbackRequest.respondedAt': respondedAt,
          ...(responderId && mongoose.Types.ObjectId.isValid(String(responderId))
            ? { 'messages.$.feedbackRequest.respondedById': responderId }
            : {}),
          'messages.$.feedbackRequest.responseChannel': channel,
          lastMessageAt: respondedAt,
        },
        $inc: { pendingFeedbackCount: -1 },
      }
    );
    if (claim.modifiedCount === 0) {
      throw httpError('Diese Frage wurde bereits beantwortet.', 409);
    }

    const repairRequest = await RepairRequest.findById(repairRequestId)
      .select('_id requestNumber customerId customerName customerEmail isGuest guestTrackingToken assignedStaffId')
      .lean();

    if (repairRequest) {
      await this.notifyStaff(repairRequest, {
        title: `Kunde hat eine Rückfrage beantwortet – ${repairRequest.requestNumber}`,
        message: `Antwort: ${option.label}`,
        messageType: 'feedback_response',
        messageId: message._id,
      });
    }

    return this.refetchSorted(repairRequestId);
  }

  // Create a quick action
  static async createQuickAction(repairRequestId, senderId, senderName, actionType, description = '', metadata = {}, senderRole = null) {
    if (!QUICK_ACTION_LABELS[actionType]) {
      throw httpError('Ungültiger Aktionstyp.', 400);
    }
    const repairRequest = await RepairRequest.findById(repairRequestId)
      .select('_id requestNumber customerId customerName customerEmail isGuest guestTrackingToken assignedStaffId')
      .lean();
    if (!repairRequest) throw httpError('Reparaturanfrage nicht gefunden.', 404);

    const label = QUICK_ACTION_LABELS[actionType];
    const text = String(description || '').trim();
    const { communication, messageId } = await this.appendMessage(repairRequest._id, {
      senderId: { name: senderName, email: '', avatar: null },
      senderUserId: senderId && mongoose.Types.ObjectId.isValid(String(senderId)) ? senderId : undefined,
      senderType: 'staff',
      senderName,
      senderRole,
      messageType: 'quick_action',
      content: text || label,
      quickAction: {
        _id: new mongoose.Types.ObjectId(),
        actionType,
        actionLabel: label,
        description: text,
        status: 'pending',
        metadata,
      },
    }, {
      inc: { pendingActionsCount: 1 },
      createdBy: senderId ? { userId: senderId, name: senderName, role: senderRole } : null,
    });

    await this.notifyCustomer(repairRequest, {
      title: label,
      message: text || 'Zu Ihrer Reparaturanfrage ist eine Aktion erforderlich.',
      ctaLabel: 'Anfrage öffnen',
      messageType: 'quick_action',
      messageId,
    });

    return communication;
  }

  // Complete a quick action (idempotent: zweiter Aufruf ändert nichts)
  static async completeQuickAction(repairRequestId, messageId) {
    if (!messageId || !mongoose.Types.ObjectId.isValid(String(messageId))) {
      throw httpError('Aktion nicht gefunden.', 404);
    }
    const communication = await RepairRequestCommunication.findOne({ repairRequestId });
    const message = communication?.messages?.id(messageId);
    if (!message || message.messageType !== 'quick_action' || !message.quickAction) {
      throw httpError('Aktion nicht gefunden.', 404);
    }
    const now = new Date();
    await RepairRequestCommunication.updateOne(
      { repairRequestId, messages: { $elemMatch: { _id: message._id, 'quickAction.status': 'pending' } } },
      {
        $set: { 'messages.$.quickAction.status': 'completed', 'messages.$.quickAction.completedAt': now, lastMessageAt: now },
        $inc: { pendingActionsCount: -1 },
      }
    );
    return this.refetchSorted(repairRequestId);
  }

  // Mark messages as read (pro Benutzer; aktualisiert den Lesezeitpunkt bei neuen Antworten)
  static async markMessagesAsRead(repairRequestId, userId) {
    const communication = await RepairRequestCommunication.findOne({ repairRequestId });
    if (!communication) {
      return null;
    }
    const now = new Date();
    let updatedCount = 0;
    for (const message of communication.messages) {
      if (!message.readBy) message.readBy = [];
      const entry = message.readBy.find((r) => String(r?.userId || '') === String(userId));
      if (!entry) {
        message.readBy.push({ userId, readAt: now });
        updatedCount += 1;
        continue;
      }
      const respondedAt = toTime(message?.feedbackRequest?.respondedAt);
      if (respondedAt && toTime(entry.readAt) < respondedAt) {
        entry.readAt = now;
        updatedCount += 1;
      }
    }
    if (updatedCount > 0) {
      await communication.save();
    }
    return sortMessages(communication);
  }

  // Get pending feedback count
  static async getPendingFeedbackCount(repairRequestId) {
    const communication = await RepairRequestCommunication.findOne({ repairRequestId }).lean();
    if (!communication) return 0;
    return this.summarizeThread(communication, null).pendingFeedbackCount;
  }

  // Get pending actions count
  static async getPendingActionsCount(repairRequestId) {
    const communication = await RepairRequestCommunication.findOne({ repairRequestId }).lean();
    if (!communication) return 0;
    return this.summarizeThread(communication, null).pendingActionsCount;
  }

  // Get unread message count (Regel: unreadCountFor)
  static async getUnreadMessageCount(repairRequestId, userId, userRole = 'customer') {
    const communication = await RepairRequestCommunication.findOne({ repairRequestId }).lean();
    if (!communication) return 0;
    return this.unreadCountFor(communication, { _id: userId, role: userRole });
  }
}

module.exports = RepairRequestCommunicationService;
