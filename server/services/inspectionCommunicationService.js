const crypto = require('crypto');
const mongoose = require('mongoose');
const InspectionCommunication = require('../models/InspectionCommunication');
const Order = require('../models/Order');
const User = require('../models/User');
const DeviceInspection = require('../models/DeviceInspection');
const Complaint = require('../models/Complaint');
const NotificationService = require('./notificationService');
const EmailService = require('./emailService');
const { isStaffRole, summarizeMessages } = require('../utils/communicationReadRules');

// Sonderzeichen in Suchbegriffen ('(' '[' '*' ...) duerfen keinen RegExp-Fehler (500) ausloesen.
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kanonische Adresse eines Gespraechs im Postfach (Personal) - dieselbe wie im Inbox-Service.
const orderThreadUrl = (orderId) => `/messages?thread=order:${orderId}`;

const MAX_MESSAGE_LENGTH = 5000;

const isObjectIdLike = (value) => /^[a-f0-9]{24}$/i.test(String(value || ''));

// Fehler mit HTTP-Status fuer die Route (Meldung ist bereits deutsch und kundentauglich).
const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// Idempotenzschluessel des Clients: nur kurze, druckbare Zeichen.
const normalizeClientMessageId = (value) => {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_.:-]{8,100}$/.test(text) ? text : '';
};

const sortMessagesAscending = (communication) => {
  if (communication && communication.messages && communication.messages.length > 0) {
    communication.messages.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }
  return communication;
};

// Deutsches Betragsformat fuer Meldungen an die Oberflaeche (20,00 € statt 20.00 €).
function formatEuroDe(value) {
  return `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

class InspectionCommunicationService {
  static async notifyGuestMessageRecipient(order, senderType, senderName, content) {
    try {
      if (senderType === 'customer') {
        return;
      }

      const guestEmail = String(order?.guestInfo?.email || '').trim();
      if (!guestEmail) {
        return;
      }

      const guestName = String(`${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim() || guestEmail);
      const guestTrackingToken = String(order?.guestTrackingToken || '').trim();
      const trackingPath = guestTrackingToken
        ? `/track-order?token=${encodeURIComponent(guestTrackingToken)}&email=${encodeURIComponent(guestEmail)}`
        : '/track-order';

      const trimmedContent = String(content || '').trim();
      const preview = trimmedContent.length > 240 ? `${trimmedContent.slice(0, 237)}...` : trimmedContent;

      await EmailService.sendTriggerEmail('system_notification', guestEmail, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName: guestName,
        notificationTitle: 'Neue Nachricht zu Ihrem Auftrag',
        notificationPreview: `Neue Nachricht von ${senderName || 'unserem Service-Team'}`,
        notificationTopic: order?.orderNumber ? `Auftrag ${order.orderNumber}` : 'Ihr Auftrag',
        notificationBody: preview || 'Es liegt eine neue Nachricht in Ihrem Auftragsverlauf vor.',
        notificationDate: new Date().toLocaleString('de-DE'),
        effectiveDate: new Date().toLocaleDateString('de-DE'),
        ctaLabel: 'Auftrag ansehen',
        ctaUrl: trackingPath,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
      });
    } catch (guestEmailError) {
      console.error(`InspectionCommunicationService: Error sending guest message email: ${guestEmailError.message || guestEmailError}`);
    }
  }

  static async getComplaintNotificationContext(orderId) {
    try {
      const complaint = await Complaint.findOne({
        $or: [{ orderId }, { newOrderId: orderId }],
      })
        .select('_id complaintNumber subject')
        .lean();

      if (!complaint) {
        return null;
      }

      return {
        complaintId: complaint._id.toString(),
        complaintNumber: complaint.complaintNumber || null,
        complaintSubject: complaint.subject || null,
        actionUrl: '/my-complaints',
      };
    } catch (error) {
      console.error(`InspectionCommunicationService: Error resolving complaint context for notifications: ${error.message || error}`);
      return null;
    }
  }

  // Alle aktiven Admins (Empfaenger, wenn einem Auftrag kein Mitarbeiter zugewiesen ist).
  static async getActiveAdminIds() {
    try {
      const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
      return admins.map((admin) => String(admin._id));
    } catch (error) {
      console.error(`InspectionCommunicationService: Error loading admin recipients: ${error.message || error}`);
      return [];
    }
  }

  // Team-Empfaenger einer Kundenaktivitaet: zugewiesene Mitarbeiter, sonst alle aktiven Admins.
  static async getTeamRecipientIds(order) {
    const ids = new Set();
    (order?.assignedStaff || []).forEach((entry) => {
      const staffId = entry?.staffId ? String(entry.staffId) : '';
      if (staffId) ids.add(staffId);
    });
    if (!ids.size) {
      (await this.getActiveAdminIds()).forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }

  // Benachrichtigt das Team ueber eine Kundenaktivitaet ohne Textnachricht
  // (Antwort auf Rueckfrage - auch von Gaesten). Fehler brechen die Hauptaktion nie ab.
  static async notifyTeamAboutCustomerActivity(orderId, { title, message, messageType, senderName }) {
    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
        .select('assignedStaff orderNumber').lean();
      if (!order) return;
      const recipients = await this.getTeamRecipientIds(order);
      await Promise.all(recipients.map((recipientId) => NotificationService.createNotification({
        userId: recipientId,
        title,
        message,
        type: 'message',
        orderId,
        actionUrl: orderThreadUrl(orderId),
        metadata: { senderType: 'customer', messageType, senderName: senderName || null },
      })));
    } catch (error) {
      console.error(`InspectionCommunicationService: Error notifying team: ${error.message || error}`);
    }
  }

  static async notifyMessageRecipients(orderId, senderId, senderType, senderName, content) {
    try {
      // skipAutoPopulate: sonst sind customerId/assignedStaff.staffId populierte Objekte und
      // String(...) ergibt '[object Object]' - die Benachrichtigung ging dann ins Leere.
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true })
        .select('customerId assignedStaff orderNumber guestInfo guestTrackingToken').lean();
      if (!order) return;
      const complaintContext = await this.getComplaintNotificationContext(orderId);

      const recipientIds = new Set();
      const senderIdString = senderId ? String(senderId) : '';

      if (senderType === 'customer') {
        (order.assignedStaff || []).forEach((entry) => {
          const staffId = entry?.staffId ? String(entry.staffId) : '';
          if (staffId && staffId !== senderIdString) {
            recipientIds.add(staffId);
          }
        });
        // Ohne zugewiesenen Mitarbeiter ging die Kundennachricht bisher an niemanden.
        // Produktentscheidung: dann alle aktiven Admins benachrichtigen.
        if (!recipientIds.size) {
          (await this.getActiveAdminIds()).forEach((adminId) => {
            if (adminId !== senderIdString) recipientIds.add(adminId);
          });
        }
      } else {
        const customerId = order.customerId ? String(order.customerId) : '';
        if (customerId && customerId !== senderIdString) {
          recipientIds.add(customerId);
        }
      }

      if (!recipientIds.size) {
        await this.notifyGuestMessageRecipient(order, senderType, senderName, content);
        return;
      }

      const trimmedContent = String(content || '').trim();
      const preview = trimmedContent.length > 140 ? `${trimmedContent.slice(0, 137)}...` : trimmedContent;
      const title = complaintContext
        ? (senderType === 'customer' ? 'Neue Nachricht zur Reklamation' : 'Neue Team-Nachricht zur Reklamation')
        : (senderType === 'customer' ? 'Neue Kundennachricht' : 'Neue Team-Nachricht');
      const customerIdString = order.customerId ? String(order.customerId) : '';
      const orderReference = order.orderNumber ? `#${order.orderNumber}` : 'Ihrem Auftrag';
      const notificationReference = complaintContext?.complaintNumber
        ? `Reklamation ${complaintContext.complaintNumber}`
        : orderReference;

      await Promise.all(
        Array.from(recipientIds).map((recipientId) =>
          NotificationService.createNotification({
            userId: recipientId,
            title,
            message: `${senderName} hat eine neue Nachricht zu ${notificationReference} gesendet${preview ? `: ${preview}` : '.'}`,
            type: 'message',
            orderId,
            // Personal landet direkt im Gespraech (Postfach), der Kunde im eigenen Auftrag.
            actionUrl: String(recipientId) === customerIdString ? `/orders/${orderId}` : orderThreadUrl(orderId),
            metadata: {
              senderId: senderIdString || null,
              senderType,
              messageType: 'text',
              complaintId: complaintContext?.complaintId || null,
              complaintNumber: complaintContext?.complaintNumber || null,
            },
          }, {
            // Ensure customer receives an email alert for new staff/admin messages.
            forceEmail: senderType !== 'customer' && String(order.customerId || '') === String(recipientId || ''),
          })
        )
      );

      await this.notifyGuestMessageRecipient(order, senderType, senderName, content);
    } catch (notificationError) {
      console.error(`InspectionCommunicationService: Error notifying message recipients: ${notificationError.message || notificationError}`);
    }
  }

  // Get communication threads visible to the current user
  static async getCommunicationsForUser(userId, userRole = 'customer', filters = {}) {
    try {
      const page = Math.max(1, parseInt(filters.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const search = (filters.search || '').trim();

      const communicationQuery = {
        'messages.0': { $exists: true },
      };

      // Customers can only see communications for their own orders.
      if (userRole !== 'staff' && userRole !== 'admin') {
        const customerOrders = await Order.find({ customerId: userId }).select('_id').lean();
        const customerOrderIds = customerOrders.map(order => order._id);

        if (customerOrderIds.length === 0) {
          return {
            communications: [],
            totalPages: 0,
            currentPage: page,
            totalCount: 0,
          };
        }

        communicationQuery.orderId = { $in: customerOrderIds };
      }

      if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        const matchingOrdersQuery = {
          $or: [
            { orderNumber: { $regex: searchRegex } },
            { deviceBrand: { $regex: searchRegex } },
            { deviceModel: { $regex: searchRegex } },
          ],
        };

        if (userRole !== 'staff' && userRole !== 'admin') {
          matchingOrdersQuery.customerId = userId;
        }

        const matchingOrders = await Order.find(matchingOrdersQuery).select('_id').lean();
        const matchingOrderIds = matchingOrders.map(order => order._id);

        communicationQuery.orderId = { $in: matchingOrderIds };
      }

      const [communications, totalCount] = await Promise.all([
        InspectionCommunication.find(communicationQuery)
          .sort({ lastMessageAt: -1, updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('orderId inspectionId createdBy messages status pendingFeedbackCount pendingActionsCount lastMessageAt createdAt updatedAt')
          .lean(),
        InspectionCommunication.countDocuments(communicationQuery),
      ]);

      const orderIds = communications
        .map(comm => comm.orderId)
        .filter(Boolean);

      const userIds = [...new Set(
        communications.flatMap((comm) => {
          const messageUserIds = (comm.messages || []).flatMap((message) => {
            const ids = [];
            if (message.senderId) ids.push(String(message.senderId));
            if (message.feedbackRequest?.respondedBy) ids.push(String(message.feedbackRequest.respondedBy));
            return ids;
          });
          if (comm.createdBy?.userId) {
            messageUserIds.push(String(comm.createdBy.userId));
          }
          return messageUserIds;
        })
      )];

      const [orders, users] = await Promise.all([
        Order.find({ _id: { $in: orderIds } })
          .select('_id orderNumber deviceBrand deviceModel customerId guestInfo')
          .populate('customerId', 'name email phone')
          .lean(),
        userIds.length ? User.find({ _id: { $in: userIds } }).select('name email role avatar').lean() : Promise.resolve([]),
      ]);

      const orderById = new Map(orders.map(order => [order._id.toString(), order]));
      const userById = new Map(users.map(user => [user._id.toString(), user]));

      const normalizedCommunications = communications.map(comm => {
        const orderId = comm.orderId ? comm.orderId.toString() : null;
        const order = orderId ? orderById.get(orderId) : null;
        const normalizedMessages = (comm.messages || []).map((message) => ({
          ...message,
          senderId: message.senderId ? (userById.get(String(message.senderId)) || null) : null,
          feedbackRequest: message.feedbackRequest ? {
            ...message.feedbackRequest,
            respondedBy: message.feedbackRequest.respondedBy
              ? (userById.get(String(message.feedbackRequest.respondedBy)) || null)
              : null,
          } : null,
        }));

        return {
          _id: comm._id,
          orderId,
          orderNumber: order?.orderNumber || '',
          deviceInfo: order ? `${order.deviceBrand} ${order.deviceModel}` : '',
          customer: order ? {
            name: order.customerId?.name || `${order.guestInfo?.firstName || ''} ${order.guestInfo?.lastName || ''}`.trim() || 'Gastkunde',
            email: order.customerId?.email || order.guestInfo?.email || '',
            phone: order.customerId?.phone || order.guestInfo?.phone || '',
            isGuest: Boolean(order.guestInfo?.isGuest),
          } : null,
          messages: normalizedMessages,
          status: comm.status,
          pendingFeedbackCount: comm.pendingFeedbackCount || 0,
          pendingActionsCount: comm.pendingActionsCount || 0,
          createdBy: comm.createdBy && comm.createdBy.userId
            ? {
                ...comm.createdBy,
                userId: userById.get(String(comm.createdBy.userId)) || null,
              }
            : comm.createdBy,
          lastMessageAt: comm.lastMessageAt || comm.updatedAt,
          createdAt: comm.createdAt,
          updatedAt: comm.updatedAt,
        };
      });

      return {
        communications: normalizedCommunications,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        totalCount,
      };
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting communications for user: ${error}`);
      throw error;
    }
  }

  // Thread eines Auftrags lesen. Gibt es (Altdaten) mehrere Dokumente pro Auftrag, gewinnt
  // immer das aelteste - Schreib- und Lesepfade arbeiten damit auf demselben Dokument.
  static findThread(orderId) {
    return InspectionCommunication.findOne({ orderId }).sort({ createdAt: 1, _id: 1 });
  }

  // Thread populiert und chronologisch sortiert (Antwortformat aller Schreib-Routen).
  static async loadPopulatedThread(orderId) {
    const communication = await this.findThread(orderId)
      .populate('messages.senderId', 'name email role avatar')
      .populate('messages.feedbackRequest.respondedBy', 'name email');
    return sortMessagesAscending(communication);
  }

  // Get or create communication thread for an order
  // Atomar (upsert): gleichzeitige erste Nachrichten legen keinen zweiten Thread an
  // (zusaetzlich abgesichert durch den eindeutigen Index orderId_unique_thread).
  static async getOrCreateCommunicationThread(orderId, inspectionId = null, initiatingUserId = null, initiatingUserName = null, initiatingUserRole = null) {
    try {
      const existing = await this.findThread(orderId);
      if (existing) {
        return existing;
      }

      const now = new Date();
      const setOnInsert = {
        orderId,
        messages: [],
        status: 'active',
        pendingFeedbackCount: 0,
        pendingActionsCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      if (inspectionId) setOnInsert.inspectionId = inspectionId;
      if (initiatingUserId) {
        setOnInsert.createdBy = { userId: initiatingUserId, name: initiatingUserName, role: initiatingUserRole };
      }

      try {
        await InspectionCommunication.updateOne(
          { orderId },
          { $setOnInsert: setOnInsert },
          { upsert: true, timestamps: false }
        );
      } catch (error) {
        // E11000: ein paralleler Aufruf hat den Thread gerade angelegt - den verwenden wir.
        if (error?.code !== 11000) throw error;
      }

      return await this.findThread(orderId);
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting or creating communication thread: ${error}`);
      throw error;
    }
  }

  // Haengt eine Nachricht atomar an. Mit clientMessageId wird dieselbe Nachricht nur EINMAL
  // gespeichert (Doppelklick, Enter-Wiederholung, Retry). Rueckgabe: { created, message }.
  static async appendMessage(orderId, message, { clientMessageId = '', incrementFeedback = 0, incrementActions = 0, threadDefaults = {} } = {}) {
    const thread = await this.getOrCreateCommunicationThread(
      orderId,
      threadDefaults.inspectionId || null,
      threadDefaults.userId || null,
      threadDefaults.userName || null,
      threadDefaults.userRole || null
    );
    const key = normalizeClientMessageId(clientMessageId);
    const now = new Date();
    const messageId = new mongoose.Types.ObjectId();
    const toPush = {
      ...message,
      _id: messageId,
      readBy: message.readBy || [],
      createdAt: message.createdAt || now,
      updatedAt: now,
    };
    if (key) toPush.clientMessageId = key;

    const filter = { _id: thread._id };
    if (key) {
      // Wiederholung = gleiche clientMessageId vom SELBEN Absender mit DEMSELBEN Nachrichtentyp.
      // So wird z. B. eine Rueckfrage mit einer wiederverwendeten Entwurfs-ID nicht still verworfen.
      const duplicate = { clientMessageId: key, messageType: message.messageType || 'text' };
      const senderKey = message.senderId && typeof message.senderId === 'object' && message.senderId._id
        ? message.senderId._id
        : message.senderId;
      if (senderKey && isObjectIdLike(senderKey)) duplicate.senderId = new mongoose.Types.ObjectId(String(senderKey));
      else duplicate.senderType = message.senderType;
      filter.messages = { $not: { $elemMatch: duplicate } };
    }
    const update = { $push: { messages: toPush }, $set: { lastMessageAt: now } };
    const inc = {};
    if (incrementFeedback) inc.pendingFeedbackCount = incrementFeedback;
    if (incrementActions) inc.pendingActionsCount = incrementActions;
    if (Object.keys(inc).length) update.$inc = inc;

    const result = await InspectionCommunication.updateOne(filter, update);
    if (result.modifiedCount) {
      // Auch Gast-Nachrichten (Track-Order-Routen) leeren den Zaehler-Cache des Postfachs.
      require('./communicationInboxService').invalidateSummaryCache();
    }
    return { created: Boolean(result.modifiedCount), messageId, clientMessageId: key };
  }

  // Send a message
  static async sendMessage(orderId, senderId, senderName, content, senderType = 'staff', senderRole = null, options = {}) {
    const result = await this.sendMessageWithResult(orderId, senderId, senderName, content, senderType, senderRole, options);
    return result.communication;
  }

  // Wie sendMessage, meldet aber zusaetzlich, ob die Nachricht neu war (false = Wiederholung
  // derselben clientMessageId; dann KEINE zweite Benachrichtigung).
  static async sendMessageWithResult(orderId, senderId, senderName, content, senderType = 'staff', senderRole = null, options = {}) {
    try {
      const text = String(content || '').trim();
      if (!text) throw httpError(400, 'Bitte geben Sie eine Nachricht ein.');
      if (text.length > MAX_MESSAGE_LENGTH) {
        throw httpError(400, `Die Nachricht ist zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`);
      }

      const { created } = await this.appendMessage(orderId, {
        senderId: senderId || undefined,
        senderType,
        senderName,
        senderRole,
        messageType: 'text',
        content: text,
        metadata: options.metadata || undefined,
      }, { clientMessageId: options.clientMessageId });

      const communication = await this.loadPopulatedThread(orderId);

      if (created && options.notify !== false) {
        await this.notifyMessageRecipients(orderId, senderId, senderType, senderName, text);
      }

      return { communication, created };
    } catch (error) {
      console.error(`InspectionCommunicationService: Error sending message: ${error}`);
      throw error;
    }
  }

  // Gastnachricht (Tracking-Link): gleiche Speicherung und Team-Benachrichtigung wie bei
  // angemeldeten Kunden. Der Gast hat keine senderId.
  static async sendGuestMessage(orderId, { guestName, guestEmail, content, clientMessageId }) {
    return this.sendMessageWithResult(orderId, null, guestName, content, 'customer', 'guest', {
      clientMessageId,
      metadata: { guestEmail },
    });
  }

  // DeviceInspection-ID nur uebernehmen, wenn sie WIRKLICH zu diesem Auftrag gehoert; sonst die
  // Inspektion des Auftrags (falls vorhanden) oder null. Frueher wurde hier oft die orderId
  // als "inspectionId" gespeichert (Buchungs-Modal, Auftragsdetail).
  static async resolveInspectionId(orderId, providedInspectionId) {
    try {
      if (providedInspectionId && isObjectIdLike(providedInspectionId)) {
        const match = await DeviceInspection.findOne({ _id: providedInspectionId, orderId }).select('_id').lean();
        if (match) return match._id;
      }
      const inspection = await DeviceInspection.findOne({ orderId }).select('_id').lean();
      return inspection ? inspection._id : null;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error resolving inspection id: ${error.message || error}`);
      return null;
    }
  }

  // Interne Notizen eines Auftrags (bestehender Speicher Order.staffNotes, Typ 'internal').
  // NUR fuer Personal - Kunden- und Gastpfade rufen das nie auf.
  static async getInternalNotes(orderId) {
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('staffNotes').lean();
    return (order?.staffNotes || [])
      .filter((note) => note && note.type === 'internal')
      .map((note) => ({
        _id: String(note._id),
        staffId: note.staffId ? String(note.staffId) : null,
        staffName: note.staffName || 'Team',
        note: note.note,
        createdAt: note.createdAt,
        visibility: 'internal',
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Interne Notiz speichern: $push in Order.staffNotes (Typ 'internal') OHNE automatische
  // Mitarbeiterzuweisung, OHNE order.save() und OHNE Kundenbenachrichtigung.
  // Idempotent: die Notiz-ID wird aus (Auftrag, Mitarbeiter, clientMessageId) abgeleitet.
  static async addInternalNote(orderId, staffUser, noteText, clientMessageId = '') {
    const text = String(noteText || '').trim();
    if (!text) throw httpError(400, 'Bitte geben Sie eine Notiz ein.');
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw httpError(400, `Die Notiz ist zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`);
    }
    const key = normalizeClientMessageId(clientMessageId);
    const noteId = key
      ? new mongoose.Types.ObjectId(crypto.createHash('sha1')
        .update(`${orderId}:${staffUser._id}:${key}`).digest('hex').slice(0, 24))
      : new mongoose.Types.ObjectId();

    const note = {
      _id: noteId,
      staffId: staffUser._id,
      staffName: staffUser.name || staffUser.email || 'Team',
      note: text,
      type: 'internal',
      createdAt: new Date(),
    };
    const result = await Order.updateOne(
      { _id: orderId, 'staffNotes._id': { $ne: noteId } },
      { $push: { staffNotes: note } }
    );
    const internalNotes = await this.getInternalNotes(orderId);
    return {
      created: Boolean(result.modifiedCount),
      internalNote: internalNotes.find((entry) => entry._id === String(noteId)) || null,
      internalNotes,
    };
  }

  // Send a feedback request
  static async sendFeedbackRequest(orderId, providedInspectionId, senderId, senderName, question, options, senderRole = null, requestOptions = {}) {
    try {
      console.log(`InspectionCommunicationService: Sending feedback request to order ${orderId}`);

      const inspectionId = await this.resolveInspectionId(orderId, providedInspectionId);
      const cleanQuestion = String(question || '').trim();
      const cleanOptions = (options || [])
        .map((option) => ({
          label: String(option?.label || '').trim(),
          value: String(option?.value || option?.label || '').trim(),
        }))
        .filter((option) => option.label);
      if (!cleanQuestion || cleanOptions.length < 2) {
        throw httpError(400, 'Bitte eine Frage und mindestens zwei Antwortoptionen angeben.');
      }

      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 48); // 48 hour expiration

      const message = {
        senderId,
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'feedback_request',
        content: cleanQuestion,
        feedbackRequest: {
          type: 'agreement',
          question: cleanQuestion,
          options: cleanOptions,
          status: 'pending',
          expiresAt: expirationTime,
        },
      };

      const { created, messageId } = await this.appendMessage(orderId, message, {
        clientMessageId: requestOptions.clientMessageId,
        incrementFeedback: 1,
        threadDefaults: { inspectionId, userId: senderId, userName: senderName, userRole: senderRole },
      });
      const communication = await this.loadPopulatedThread(orderId);
      // Aufrufer (Route) erfaehrt, ob die Nachricht neu war (Wiederholung -> 200 statt 201).
      if (requestOptions.result && typeof requestOptions.result === 'object') requestOptions.result.created = created;
      if (!created) {
        return communication;
      }

      // Create notification for customer
      try {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('customerId').lean();
        if (order && order.customerId) {
          const complaintContext = await this.getComplaintNotificationContext(orderId);
          await NotificationService.createNotification({
            userId: order.customerId,
            title: complaintContext
              ? 'Rückmeldung zu Ihrer Reklamation erforderlich'
              : 'Rückmeldung zu Ihrem Reparaturauftrag erforderlich',
            message: cleanQuestion,
            type: 'message',
            orderId,
            actionUrl: complaintContext?.actionUrl || `/orders/${orderId}`,
            metadata: {
              messageId,
              inspectionId,
              messageType: 'feedback_request',
              complaintId: complaintContext?.complaintId || null,
              complaintNumber: complaintContext?.complaintNumber || null,
            }
          });
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification for feedback request: ${notificationError.message || notificationError}`, notificationError.stack);
        // Don't throw, as the main operation succeeded
      }

      console.log(`InspectionCommunicationService: Feedback request sent successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error sending feedback request: ${error}`);
      throw error;
    }
  }

  // Respond to feedback request
  // Nur offene Rueckfragen (status 'pending') koennen beantwortet werden - atomar, damit eine
  // Doppel-Antwort weder die Antwort ueberschreibt noch pendingFeedbackCount doppelt senkt.
  // Rollen-/Besitzpruefung macht die Route (nur der Auftragskunde; Gaeste ueber track-order).
  // extra.guestEmail: Antwort eines Gastes (Track-Order-Seite, kein Benutzerkonto) - gleicher
  // atomarer Pfad, die Gast-E-Mail wird wie bisher in metadata.guestResponderEmail vermerkt.
  static async respondToFeedback(orderId, messageId, response, responderId, respondedByName, extra = {}) {
    try {
      console.log(`InspectionCommunicationService: Recording feedback response from ${respondedByName}`);

      const thread = await this.findThread(orderId);
      if (!thread) {
        throw httpError(404, 'Für diesen Auftrag gibt es noch keine Nachrichten.');
      }

      const message = (thread.messages || []).find((msg) => msg._id && msg._id.toString() === String(messageId));
      if (!message || !message.feedbackRequest) {
        throw httpError(404, 'Die Rückfrage wurde nicht gefunden.');
      }

      const chosen = (message.feedbackRequest.options || []).find((option) => (
        String(option.value) === String(response?.value) || String(option.label) === String(response?.label)
      ));
      if (!chosen) {
        throw httpError(400, 'Bitte wählen Sie eine der angebotenen Antworten.');
      }

      if (message.feedbackRequest.status !== 'pending') {
        throw httpError(409, 'Diese Rückfrage wurde bereits beantwortet.');
      }

      const now = new Date();
      const update = {
        $set: {
          'messages.$[target].feedbackRequest.response': { label: chosen.label, value: chosen.value },
          'messages.$[target].feedbackRequest.respondedAt': now,
          'messages.$[target].feedbackRequest.respondedBy': responderId,
          'messages.$[target].feedbackRequest.status': 'responded',
          lastMessageAt: now,
        },
        $inc: { pendingFeedbackCount: -1 },
      };
      if (extra.guestEmail) {
        const baseMetadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};
        update.$set['messages.$[target].metadata'] = { ...baseMetadata, guestResponderEmail: extra.guestEmail };
      }
      const alreadyRead = (message.readBy || []).some((read) => read.userId && read.userId.toString() === String(responderId));
      if (!alreadyRead && responderId) {
        update.$push = { 'messages.$[target].readBy': { userId: responderId, readAt: now } };
      }

      const result = await InspectionCommunication.updateOne(
        {
          _id: thread._id,
          messages: { $elemMatch: { _id: message._id, 'feedbackRequest.status': 'pending' } },
        },
        update,
        { arrayFilters: [{ 'target._id': message._id }] }
      );
      if (!result.modifiedCount) {
        throw httpError(409, 'Diese Rückfrage wurde bereits beantwortet.');
      }
      // Zaehler nie negativ (Altdaten mit falschem Zaehler).
      await InspectionCommunication.updateOne(
        { _id: thread._id, pendingFeedbackCount: { $lt: 0 } },
        { $set: { pendingFeedbackCount: 0 } }
      );

      await this.notifyTeamAboutCustomerActivity(orderId, {
        title: 'Kunde hat eine Rückfrage beantwortet',
        message: `${respondedByName || 'Der Kunde'} hat die Rückfrage „${message.feedbackRequest.question}“ beantwortet: ${chosen.label}`,
        messageType: 'feedback_response',
        senderName: respondedByName,
      });

      const communication = await this.loadPopulatedThread(orderId);
      console.log(`InspectionCommunicationService: Feedback response recorded successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error responding to feedback: ${error}`);
      throw error;
    }
  }

  // Create a quick action
  static async createQuickAction(orderId, providedInspectionId, senderId, senderName, actionType, description = null, metadata = null, senderRole = null, requestOptions = {}) {
    try {
      console.log(`InspectionCommunicationService: Creating quick action ${actionType} for order ${orderId}`);

      const inspectionId = await this.resolveInspectionId(orderId, providedInspectionId);

      // Define action labels
      const actionLabels = {
        part_replacement: 'Teileaustausch erforderlich',
        incorrect_device: 'Falsches Gerät angegeben',
        incorrect_unlock_code: 'Falscher Entsperrcode angegeben',
        additional_costs: 'Zusätzliche Kosten erforderlich',
        update_unlock_info: 'Entsperrinformation aktualisieren',
        // Kundensichtbarer Titel (Benachrichtigung/Verlauf), keine Mitarbeiteranweisung (NOTIF-7).
        customer_defect_info: 'Information zu einem Defekt an Ihrem Gerät',
      };

      const message = {
        senderId,
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'quick_action',
        content: actionLabels[actionType] || actionType,
        quickAction: {
          actionType,
          actionLabel: actionLabels[actionType] || actionType,
          description,
          metadata,
          status: 'pending',
        },
      };

      const { created, messageId } = await this.appendMessage(orderId, message, {
        clientMessageId: requestOptions.clientMessageId,
        incrementActions: 1,
        threadDefaults: { inspectionId, userId: senderId, userName: senderName, userRole: senderRole },
      });
      const communication = await this.loadPopulatedThread(orderId);
      // Aufrufer (Route) erfaehrt, ob die Nachricht neu war (Wiederholung -> 200 statt 201).
      if (requestOptions.result && typeof requestOptions.result === 'object') requestOptions.result.created = created;
      if (!created) {
        return communication;
      }

      // Create notification for customer
      try {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('customerId').lean();
        if (order && order.customerId) {
          const complaintContext = await this.getComplaintNotificationContext(orderId);
          await NotificationService.createNotification({
            userId: order.customerId,
            title: complaintContext
              ? `Reklamation: ${actionLabels[actionType] || actionType}`
              : `${actionLabels[actionType] || actionType}`,
            message: description || actionLabels[actionType] || actionType,
            type: 'message',
            orderId,
            actionUrl: complaintContext?.actionUrl || `/orders/${orderId}`,
            metadata: {
              messageId,
              actionType,
              inspectionId,
              messageType: 'quick_action',
              complaintId: complaintContext?.complaintId || null,
              complaintNumber: complaintContext?.complaintNumber || null,
            }
          });
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification for quick action: ${notificationError.message || notificationError}`, notificationError.stack);
        // Don't throw, as the main operation succeeded
      }

      console.log(`InspectionCommunicationService: Quick action created successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error creating quick action: ${error}`);
      throw error;
    }
  }

  // Complete a quick action
  static async completeQuickAction(orderId, messageId, completedBy = {}) {
    try {
      console.log(`InspectionCommunicationService: Completing quick action in order ${orderId}`);

      let communication = await this.findThread(orderId);

      if (!communication) {
        throw httpError(404, 'Für diesen Auftrag gibt es noch keine Nachrichten.');
      }

      const messageIndex = communication.messages.findIndex(
        msg => msg._id && msg._id.toString() === messageId
      );

      if (messageIndex === -1) {
        throw httpError(404, 'Die Aktion wurde nicht gefunden.');
      }

      const message = communication.messages[messageIndex];

      if (!message.quickAction) {
        throw httpError(404, 'Die Aktion wurde nicht gefunden.');
      }
      if (message.quickAction.status !== 'pending') {
        throw httpError(409, 'Diese Aktion ist bereits erledigt.');
      }

      message.quickAction.status = 'completed';
      message.quickAction.completedAt = new Date();
      // Nur eine vom Kunden erledigte Aktion zaehlt als Kunden-Aktivitaet ("Antwort ausstehend").
      if (completedBy.userId) message.quickAction.completedBy = completedBy.userId;
      if (completedBy.role) message.quickAction.completedByRole = String(completedBy.role);
      communication.pendingActionsCount = Math.max(0, communication.pendingActionsCount - 1);
      communication.lastMessageAt = new Date();

      await communication.save();

      // Refetch to ensure all nested documents are properly populated
      communication = await this.loadPopulatedThread(orderId);

      console.log(`InspectionCommunicationService: Quick action completed successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error completing quick action: ${error}`);
      throw error;
    }
  }

  // Customer submits updated unlock information
  static async submitUnlockInfoUpdate(orderId, customerId, customerName, unlockData) {
    try {
      console.log(`InspectionCommunicationService: Customer submitting unlock info update for order ${orderId}`);

      const PAUSE_REASON = 'Entsperrinformationen Falsch - Nutzerrückmeldung erwartet';

      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.customerId.toString() !== customerId.toString()) {
        throw new Error('Unauthorized');
      }

      if (typeof unlockData.noLock === 'boolean' && unlockData.noLock) {
        order.unlockPattern = [];
        order.unlockCode = '';
        order.noLock = true;
      } else if (Array.isArray(unlockData.unlockPattern) && unlockData.unlockPattern.length > 0) {
        order.unlockPattern = unlockData.unlockPattern;
        order.unlockCode = '';
        order.noLock = false;
      } else if (unlockData.unlockCode && unlockData.unlockCode.trim()) {
        order.unlockCode = unlockData.unlockCode.trim();
        order.unlockPattern = [];
        order.noLock = false;
      } else {
        throw new Error('Ungültige Entsperrinformation angegeben');
      }

      // Clear the previous confirmation so admin can re-verify
      order.unlockConfirmation = undefined;

      // Fortsetzen (HIST-13): nur wenn die LETZTE Statusaenderung die Pause "Rückmeldung des Kunden
      // erwartet" war - mit Verlaufseintrag 'Order Resumed' (Quelle Kunde) im selben Speichervorgang.
      // Eine andere Pause (z. B. "Teile fehlen") wird nicht still aufgehoben.
      // eslint-disable-next-line global-require
      const OrderHistory = require('../utils/orderHistory');
      const resumedForCustomer = OrderHistory.resumeIfPausedForCustomer(order, { id: customerId, name: customerName || 'Kunde' });
      // Altpfad (Feld existiert im Schema nicht; bleibt fuer alte Dokumente wirkungslos-kompatibel).
      if (!resumedForCustomer && order.status === 'paused' && order.pauseReason === PAUSE_REASON) {
        order.status = 'in-progress';
        order.pauseReason = '';
      }

      await order.save();

      // Mark pending update_unlock_info quick actions as completed
      const communication = await this.findThread(orderId);
      if (communication) {
        let actionsCompleted = 0;
        communication.messages.forEach((msg) => {
          if (
            msg.messageType === 'quick_action' &&
            msg.quickAction?.actionType === 'update_unlock_info' &&
            msg.quickAction?.status === 'pending'
          ) {
            msg.quickAction.status = 'completed';
            msg.quickAction.completedAt = new Date();
            actionsCompleted++;
          }
        });
        if (actionsCompleted > 0) {
          communication.pendingActionsCount = Math.max(0, (communication.pendingActionsCount || 0) - actionsCompleted);
          communication.lastMessageAt = new Date();
          await communication.save();
        }
      }

      // Notify all assigned staff — fetch fresh lean copy so staffId ObjectIds are raw strings
      const freshOrder = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).select('assignedStaff orderNumber').lean();
      const assignedStaff = freshOrder?.assignedStaff || [];
      const orderRef = freshOrder?.orderNumber ? `#${freshOrder.orderNumber}` : 'dem Auftrag';

      await Promise.all(
        assignedStaff
          .map((entry) => (entry?.staffId ? String(entry.staffId) : null))
          .filter(Boolean)
          .map((staffId) =>
            NotificationService.createNotification({
              userId: staffId,
              title: 'Entsperrinformation aktualisiert',
              message: `${customerName} hat die Entsperrinformation für Auftrag ${orderRef} aktualisiert. Bitte erneut überprüfen.`,
              type: 'message',
              orderId,
              actionUrl: `/orders/${orderId}`,
              metadata: { senderType: 'customer', actionType: 'unlock_info_updated' },
            })
          )
      );

      console.log(`InspectionCommunicationService: Unlock info updated and staff notified for order ${orderId}`);
      return order;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error submitting unlock info update: ${error}`);
      throw error;
    }
  }

  // Get communication thread with all messages
  static async getCommunicationThread(orderId) {
    try {
      console.log(`InspectionCommunicationService: Fetching communication thread for order ${orderId}`);

      const communication = await this.findThread(orderId)
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (!communication) {
        // NICHT mehr automatisch anlegen!
        return null;
      }

      // Sort messages by createdAt in ascending order (oldest to newest)
      if (communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        console.log(`InspectionCommunicationService: Sorted ${communication.messages.length} messages by createdAt`);
      }

      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error fetching communication thread: ${error}`);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(orderId, userId) {
    try {
      console.log(`InspectionCommunicationService: Marking messages as read for user ${userId} in order ${orderId}`);

      let communication = await this.findThread(orderId);

      if (!communication) {
        // Noch kein Thread: nichts zu markieren (kein Fehler, kein Anlegen).
        return null;
      }

      const now = new Date();
      let markedCount = 0;
      communication.messages.forEach(message => {
        const existingEntry = message.readBy.find(read => read.userId.toString() === userId.toString());

        if (!existingEntry) {
          // First time reading this message
          message.readBy.push({ userId, readAt: now });
          markedCount++;
        } else {
          // For feedback-responded messages: if the customer responded AFTER the admin last read,
          // update readAt so the unread check (readAt >= respondedAt) passes correctly.
          const respondedAt = message.feedbackRequest?.respondedAt;
          if (respondedAt && new Date(existingEntry.readAt) < new Date(respondedAt)) {
            existingEntry.readAt = now;
            markedCount++;
          }
        }
      });

      await communication.save();

      console.log(`InspectionCommunicationService: ${markedCount} messages marked as read`);

      // Refetch to ensure all nested documents have proper IDs and timestamps, and populate sender info
      communication = await this.loadPopulatedThread(orderId);

      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error marking messages as read: ${error}`);
      throw error;
    }
  }

  // Get pending feedback count for an order
  static async getPendingFeedbackCount(orderId) {
    try {
      const communication = await this.findThread(orderId);
      return communication ? communication.pendingFeedbackCount : 0;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting pending feedback count: ${error}`);
      throw error;
    }
  }

  // Get pending actions count for an order
  static async getPendingActionsCount(orderId) {
    try {
      const communication = await this.findThread(orderId);
      return communication ? communication.pendingActionsCount : 0;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting pending actions count: ${error}`);
      throw error;
    }
  }

  // Get unread message counts for multiple orders
  // Gemeinsame Regel aus utils/communicationReadRules (dieselbe wie Postfach und Dashboard):
  // Personal zaehlt Kundennachrichten (auch Gaeste) und neue Antworten auf Rueckfragen, nicht
  // die Nachrichten anderer Mitarbeiter; Kunden zaehlen Team-/Systemnachrichten.
  // Antwortformat unveraendert: { [orderId]: { unread, senderType, awaitingReply } } nur fuer
  // Auftraege mit ungelesenen Nachrichten.
  static async getUnreadMessageCounts(orderIds, userId, userRole) {
    try {
      const validIds = (orderIds || []).map(String).filter(isObjectIdLike);
      if (!validIds.length) return {};

      const communications = await InspectionCommunication.find({ orderId: { $in: validIds } })
        .select('orderId messages.senderId messages.senderType messages.messageType messages.readBy messages.createdAt messages.feedbackRequest.status messages.feedbackRequest.respondedAt messages.quickAction.status messages.quickAction.completedAt messages.quickAction.completedByRole')
        .lean();

      const viewer = { userId, role: userRole };
      const unreadCounts = {};
      const byOrder = new Map();
      communications.forEach((comm) => {
        const key = String(comm.orderId);
        byOrder.set(key, [...(byOrder.get(key) || []), ...(comm.messages || [])]);
      });

      byOrder.forEach((messages, key) => {
        const summary = summarizeMessages(messages, viewer);
        if (summary.unreadCount > 0) {
          unreadCounts[key] = {
            unread: summary.unreadCount,
            senderType: isStaffRole(userRole) ? 'customer' : 'staff',
            awaitingReply: summary.awaitingReply,
          };
        }
      });

      return unreadCounts;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting unread message counts: ${error}`);
      throw error;
    }
  }

  // Send a repair offer message into the order communication thread (called when complaint is denied)
  // notifyCustomer: false -> nur Verlaufseintrag; der Aufrufer benachrichtigt selbst (Reklamation, NOTIF-11).
  static async sendRepairOfferMessage(orderId, senderId, senderName, { complaintId, offerAmount, offerDescription, notifyCustomer = true }) {
    try {
      console.log(`InspectionCommunicationService: Sending repair offer message to order ${orderId}`);

      let communication = await this.findThread(orderId);
      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(orderId, null, senderId, senderName, 'system');
      }

      const message = {
        senderId,
        senderType: 'system',
        senderName,
        senderRole: 'system',
        messageType: 'repair_offer',
        content: `Neues Reparaturangebot: ${offerDescription} – Kosten: ${formatEuroDe(Number(offerAmount))}`,
        metadata: {
          complaintId: complaintId.toString(),
          offerAmount: Number(offerAmount),
          offerDescription,
          status: 'pending',
        },
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
        communication.markModified('messages');
        await communication.save();

      // Notify customer
      try {
        const order = notifyCustomer ? await Order.findById(orderId) : null;
        if (order && order.customerId) {
          const complaintContext = await this.getComplaintNotificationContext(orderId);
          await NotificationService.createNotification({
            userId: order.customerId,
            title: 'Neues Reparaturangebot verfügbar',
            message: `${offerDescription} – ${formatEuroDe(Number(offerAmount))}. Bitte annehmen oder ablehnen.`,
            type: 'message',
            orderId,
            actionUrl: complaintContext?.actionUrl || `/orders/${orderId}`,
            metadata: {
              complaintId: complaintId.toString(),
              messageType: 'repair_offer',
              complaintNumber: complaintContext?.complaintNumber || null,
            },
          });
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error notifying customer about repair offer: ${notificationError.message || notificationError}`);
      }

      console.log(`InspectionCommunicationService: Repair offer message sent successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error sending repair offer message: ${error}`);
      throw error;
    }
  }

  // Update the status field inside the repair_offer message metadata (called on accept/reject)
  static async updateRepairOfferStatus(orderId, complaintId, status) {
    try {
      console.log(`InspectionCommunicationService: Updating repair offer status to ${status} for order ${orderId}`);

      const communication = await this.findThread(orderId);
      if (!communication) return;

      const msg = communication.messages.find(
        m => m.messageType === 'repair_offer' && m.metadata && m.metadata.complaintId === complaintId.toString()
      );

      if (msg) {
        msg.metadata = { ...msg.metadata, status };
        msg.updatedAt = new Date();
        communication.markModified('messages');
        await communication.save();
        console.log(`InspectionCommunicationService: Repair offer status updated to ${status}`);
      }
    } catch (error) {
      console.error(`InspectionCommunicationService: Error updating repair offer status: ${error}`);
      // Non-fatal
    }
  }
}

module.exports = InspectionCommunicationService;
