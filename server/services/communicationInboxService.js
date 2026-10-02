/**
 * Zentrales Postfach (K01-K04): LESENDER Adapter ueber die BESTEHENDEN Speicher - kein
 * viertes Nachrichtensystem, keine Datenmigration.
 *
 * Quellen (sourceType):
 *   order          InspectionCommunication (Auftrags-Thread, inkl. Gastnachrichten)
 *   repair_request RepairRequestCommunication + Alt-Nachrichten RepairRequest.messages (nur lesend)
 *   complaint      Complaint.comments (interne Kommentare NUR fuer Personal)
 *   contact        ContactMessage (Kontaktformular; NUR Admin, nur lesend)
 * Legacy Conversation/Message wird bewusst ignoriert (nicht geloescht).
 *
 * Sichtbarkeit: Kunden sehen nur eigene Datensaetze (Order.customerId, RepairRequest.customerId,
 * Complaint.customerId). Gaeste nutzen ausschliesslich ihre Token-Seiten.
 * Lese-/Ausstehend-Regel: utils/communicationReadRules (eine Regel fuer alle Zaehler).
 *
 * Fehler einer Quelle werden NIE als "keine Nachrichten" gemeldet: die Antwort enthaelt
 * sourceErrors[] und die Zaehler gelten dann nur fuer die erfolgreich geladenen Quellen.
 */
const InspectionCommunication = require('../models/InspectionCommunication');
const RepairRequestCommunication = require('../models/RepairRequestCommunication');
const RepairRequest = require('../models/RepairRequest');
const Complaint = require('../models/Complaint');
const ContactMessage = require('../models/ContactMessage');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');
const {
  isStaffRole, summarizeMessages, isMessageUnreadFor, previewOf, kindOf, awaitingReplyForRecord,
} = require('../utils/communicationReadRules');

const SOURCE_TYPES = ['order', 'repair_request', 'complaint', 'contact'];
const SOURCE_LABELS = {
  order: 'Auftrag',
  repair_request: 'Reparaturanfrage',
  complaint: 'Reklamation',
  contact: 'Kontaktanfrage',
};
const SOURCE_ERROR_TEXT = {
  order: 'Nachrichten zu Aufträgen konnten nicht geladen werden.',
  repair_request: 'Nachrichten zu Reparaturanfragen konnten nicht geladen werden.',
  complaint: 'Nachrichten zu Reklamationen konnten nicht geladen werden.',
  contact: 'Kontaktanfragen konnten nicht geladen werden.',
};
const FILTERS = ['all', 'unread', 'awaiting_reply'];
const MAX_LIMIT = 50;

// Kurzer Cache NUR fuer die Zaehler (/summary, Dashboard), die alle 30 s pro Benutzer abgefragt
// werden. Pro Benutzer+Rolle, 10 s, gleichzeitige Abfragen teilen sich eine Berechnung. Wird beim
// Lesen (markRead) fuer den Benutzer und bei jedem Schreibzugriff ueber die Auftrags-Thread-Routen
// komplett geleert. Ergebnisse mit Quellenfehlern werden nie gecacht. Das Postfach selbst
// (/inbox) rechnet immer frisch.
const SUMMARY_CACHE_TTL_MS = 10 * 1000;
const SUMMARY_CACHE_MAX = 500;
const summaryCache = new Map();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObjectIdLike = (value) => /^[a-f0-9]{24}$/i.test(String(value || ''));
const idString = (value) => (value && typeof value === 'object' && value._id ? String(value._id) : (value ? String(value) : ''));
const toTime = (value) => (value ? new Date(value).getTime() || 0 : 0);

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const threadUrlFor = (sourceType, sourceId) => `/messages?thread=${sourceType}:${sourceId}`;

const viewerOf = (user) => ({
  userId: idString(user?._id),
  role: user?.role || 'customer',
  isStaff: isStaffRole(user?.role),
  isAdmin: user?.role === 'admin',
});

// Welche Quellen darf der Betrachter sehen?
const allowedSources = (viewer) => SOURCE_TYPES.filter((source) => source !== 'contact' || viewer.isAdmin);

const ORDER_MESSAGE_FIELDS = [
  'senderId', 'senderType', 'senderName', 'messageType', 'content', 'createdAt', 'readBy',
  'feedbackRequest.status', 'feedbackRequest.respondedAt', 'feedbackRequest.question',
  'feedbackRequest.response', 'quickAction.status', 'quickAction.completedAt',
  'quickAction.completedByRole', 'quickAction.actionLabel', 'quickAction.description', 'metadata.offerDescription',
].map((field) => `messages.${field}`).join(' ');

// ---------------------------------------------------------------------------------------
// Suche: liefert je Quelle die passenden Datensatz-IDs (null = keine Suche aktiv).
// ---------------------------------------------------------------------------------------
async function matchingUserIds(regex) {
  const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').limit(500).lean();
  return users.map((user) => user._id);
}

async function searchOrderIds(regex, viewer) {
  const [userIds, bookings] = await Promise.all([
    viewer.isStaff ? matchingUserIds(regex) : Promise.resolve([]),
    Booking.find({ bookingNumber: regex }).select('_id').limit(500).lean(),
  ]);
  const or = [
    { orderNumber: regex },
    { deviceBrand: regex },
    { deviceModel: regex },
  ];
  if (viewer.isStaff) {
    or.push({ 'guestInfo.email': regex }, { 'guestInfo.firstName': regex }, { 'guestInfo.lastName': regex });
    if (userIds.length) or.push({ customerId: { $in: userIds } });
  }
  if (bookings.length) or.push({ bookingId: { $in: bookings.map((booking) => booking._id) } });
  const query = { $or: or };
  if (!viewer.isStaff) query.customerId = viewer.userId;
  const orders = await Order.find(query).setOptions({ skipAutoPopulate: true }).select('_id').limit(5000).lean();
  return orders.map((order) => order._id);
}

// ---------------------------------------------------------------------------------------
// Quellen-Lader: liefern vollstaendige Listeneintraege (ohne Paginierung) fuer den Betrachter.
// ---------------------------------------------------------------------------------------
async function loadOrderItems(viewer, regex) {
  const query = { 'messages.0': { $exists: true } };
  if (!viewer.isStaff) {
    const owned = await Order.find({ customerId: viewer.userId }).setOptions({ skipAutoPopulate: true }).select('_id').lean();
    if (!owned.length) return [];
    query.orderId = { $in: owned.map((order) => order._id) };
  }
  if (regex) {
    const matching = await searchOrderIds(regex, viewer);
    const allowed = query.orderId ? new Set(query.orderId.$in.map(String)) : null;
    const ids = allowed ? matching.filter((id) => allowed.has(String(id))) : matching;
    if (!ids.length) return [];
    query.orderId = { $in: ids };
  }

  const threads = await InspectionCommunication.find(query)
    .select(`orderId lastMessageAt createdAt ${ORDER_MESSAGE_FIELDS}`)
    .lean();
  if (!threads.length) return [];

  // Mehrere Dokumente je Auftrag (Altdaten) werden zu EINEM Gespraech zusammengefasst.
  const messagesByOrder = new Map();
  threads.forEach((thread) => {
    const key = String(thread.orderId);
    messagesByOrder.set(key, [...(messagesByOrder.get(key) || []), ...(thread.messages || [])]);
  });

  const orderIds = Array.from(messagesByOrder.keys());
  const orders = await Order.find({ _id: { $in: orderIds } })
    .setOptions({ skipAutoPopulate: true })
    .select(`_id orderNumber deviceBrand deviceModel customerId guestInfo bookingId status actualCompletion${viewer.isStaff ? ' staffNotes.type' : ''}`)
    .lean();
  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  const customerIds = [...new Set(orders.map((order) => idString(order.customerId)).filter(Boolean))];
  const bookingIds = [...new Set(orders.map((order) => idString(order.bookingId)).filter(Boolean))];
  const [customers, bookings] = await Promise.all([
    viewer.isStaff && customerIds.length
      ? User.find({ _id: { $in: customerIds } }).select('name email').lean()
      : Promise.resolve([]),
    bookingIds.length ? Booking.find({ _id: { $in: bookingIds } }).select('bookingNumber').lean() : Promise.resolve([]),
  ]);
  const customerById = new Map(customers.map((user) => [String(user._id), user]));
  const bookingById = new Map(bookings.map((booking) => [String(booking._id), booking]));

  return orderIds.map((orderId) => {
    const order = orderById.get(orderId) || null;
    // Kunden sehen nie Threads zu fremden/geloeschten Auftraegen.
    if (!viewer.isStaff && !order) return null;
    const summary = summarizeMessages(messagesByOrder.get(orderId), viewer);
    // Abgeschlossene/stornierte Auftraege brauchen keine Antwort mehr (ausser der Kunde schrieb danach).
    summary.awaitingReply = awaitingReplyForRecord(summary, 'order', {
      status: order?.status,
      closedAt: order?.status === 'completed' ? order?.actualCompletion : null,
    });
    const booking = order?.bookingId ? bookingById.get(String(order.bookingId)) : null;
    const customerUser = order?.customerId ? customerById.get(String(order.customerId)) : null;
    const guestName = `${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim();
    const item = baseItem('order', orderId, viewer, summary);
    item.title = order?.orderNumber ? `Auftrag ${order.orderNumber}` : 'Auftrag';
    item.reference = {
      orderNumber: order?.orderNumber || '',
      bookingNumber: booking?.bookingNumber || '',
      bookingId: order?.bookingId ? String(order.bookingId) : null,
    };
    item.device = order ? [order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') : '';
    if (viewer.isStaff) {
      item.customer = {
        name: customerUser?.name || guestName || 'Gastkunde',
        email: customerUser?.email || order?.guestInfo?.email || '',
        isGuest: !order?.customerId || Boolean(order?.guestInfo?.isGuest),
      };
      item.internalNotesCount = (order?.staffNotes || []).filter((note) => note?.type === 'internal').length;
    }
    item.link = order ? `/orders/${orderId}` : null;
    item.linkLabel = 'Zum Auftrag';
    item.replyChannel = 'order';
    item.canReply = Boolean(order);
    return item;
  }).filter(Boolean);
}

function normalizeRepairRequestMessage(message) {
  return {
    ...message,
    // senderId ist hier historisch ein eingebettetes Objekt; die Benutzer-ID steht (neu) in senderUserId.
    senderId: message.senderUserId || null,
  };
}

function normalizeLegacyRepairRequestMessage(message) {
  return {
    _id: message._id,
    senderType: message.senderRole === 'customer' ? 'customer' : 'staff',
    senderId: message.senderId || null,
    senderName: message.senderName || '',
    messageType: 'text',
    content: message.message || '',
    createdAt: message.sentAt || null,
    // Alte Nachrichten haben nur ein globales isRead-Flag und keinen Lesestatus pro Benutzer:
    // noReadState -> zaehlen nie als "ungelesen" (sonst nie zu leeren), nur "Antwort ausstehend".
    readBy: [],
    noReadState: true,
    legacy: true,
  };
}

async function loadRepairRequestItems(viewer, regex) {
  const requestQuery = {};
  if (!viewer.isStaff) requestQuery.customerId = viewer.userId;
  if (regex) {
    const or = [{ requestNumber: regex }, { deviceBrand: regex }, { deviceModel: regex }, { deviceType: regex }];
    if (viewer.isStaff) or.push({ customerName: regex }, { customerEmail: regex });
    requestQuery.$or = or;
  }
  const restrictIds = (!viewer.isStaff || regex)
    ? (await RepairRequest.find(requestQuery).select('_id').limit(5000).lean()).map((request) => request._id)
    : null;
  if (restrictIds && !restrictIds.length) return [];

  const threadQuery = { 'messages.0': { $exists: true } };
  const legacyQuery = { 'messages.0': { $exists: true } };
  if (restrictIds) {
    threadQuery.repairRequestId = { $in: restrictIds };
    legacyQuery._id = { $in: restrictIds };
  }

  const [threads, legacyRequests] = await Promise.all([
    RepairRequestCommunication.find(threadQuery)
      .select('repairRequestId lastMessageAt messages.senderUserId messages.senderType messages.senderName messages.messageType messages.content messages.createdAt messages.readBy messages.feedbackRequest.status messages.feedbackRequest.respondedAt messages.feedbackRequest.question messages.feedbackRequest.response messages.quickAction.status messages.quickAction.completedAt messages.quickAction.actionLabel messages.quickAction.description')
      .lean(),
    RepairRequest.find(legacyQuery).select('_id messages').lean(),
  ]);

  const messagesById = new Map();
  threads.forEach((thread) => {
    const key = String(thread.repairRequestId);
    messagesById.set(key, [...(messagesById.get(key) || []), ...(thread.messages || []).map(normalizeRepairRequestMessage)]);
  });
  legacyRequests.forEach((request) => {
    const key = String(request._id);
    messagesById.set(key, [...(messagesById.get(key) || []), ...(request.messages || []).map(normalizeLegacyRepairRequestMessage)]);
  });
  if (!messagesById.size) return [];

  const requests = await RepairRequest.find({ _id: { $in: Array.from(messagesById.keys()) } })
    .select('_id requestNumber customerId customerName customerEmail isGuest deviceType deviceBrand deviceModel')
    .lean();
  const requestById = new Map(requests.map((request) => [String(request._id), request]));

  return Array.from(messagesById.entries()).map(([requestId, messages]) => {
    const request = requestById.get(requestId) || null;
    if (!viewer.isStaff && (!request || idString(request.customerId) !== viewer.userId)) return null;
    const item = baseItem('repair_request', requestId, viewer, summarizeMessages(messages, viewer));
    item.title = request?.requestNumber ? `Reparaturanfrage ${request.requestNumber}` : 'Reparaturanfrage';
    item.reference = { requestNumber: request?.requestNumber || '' };
    item.device = request ? [request.deviceBrand, request.deviceModel].filter(Boolean).join(' ') || request.deviceType || '' : '';
    if (viewer.isStaff) {
      item.customer = {
        name: request?.customerName || 'Kunde',
        email: request?.customerEmail || '',
        isGuest: Boolean(request?.isGuest),
      };
    }
    item.legacyMessageCount = messages.filter((message) => message.legacy).length;
    if (viewer.isStaff) {
      item.link = `${viewer.isAdmin ? '/admin' : '/staff'}/repair-requests?requestId=${requestId}`;
    } else {
      item.link = `/my-repair-requests?requestId=${requestId}`;
    }
    item.linkLabel = 'Zur Reparaturanfrage';
    item.replyChannel = 'repair_request';
    item.canReply = Boolean(request);
    return item;
  }).filter(Boolean);
}

function normalizeComplaintComment(comment) {
  return {
    _id: comment._id,
    senderType: comment.userRole === 'customer' ? 'customer' : 'staff',
    senderId: comment.userId || null,
    senderName: comment.userName || '',
    messageType: 'text',
    content: comment.comment || '',
    createdAt: comment.createdAt || null,
    // Reklamationskommentare haben keinen Lesestatus: nie "ungelesen", nur "Antwort ausstehend".
    readBy: [],
    noReadState: true,
    isInternal: Boolean(comment.isInternal),
  };
}

async function loadComplaintItems(viewer, regex) {
  const query = { 'comments.0': { $exists: true } };
  if (!viewer.isStaff) query.customerId = viewer.userId;
  if (regex) {
    const or = [{ complaintNumber: regex }, { subject: regex }];
    const orderIds = await searchOrderIds(regex, viewer);
    if (orderIds.length) or.push({ orderId: { $in: orderIds } }, { newOrderId: { $in: orderIds } });
    if (viewer.isStaff) {
      const userIds = await matchingUserIds(regex);
      if (userIds.length) or.push({ customerId: { $in: userIds } });
    }
    query.$or = or;
  }
  // skipAutoPopulate: die 7 Auto-Populates des Modells werden hier nicht gebraucht.
  const complaints = await Complaint.find(query)
    .setOptions({ skipAutoPopulate: true })
    .select('_id complaintNumber subject customerId orderId status resolvedAt comments._id comments.userId comments.userName comments.userRole comments.comment comments.isInternal comments.createdAt')
    .lean();
  if (!complaints.length) return [];

  const orderIds = [...new Set(complaints.map((complaint) => idString(complaint.orderId)).filter(Boolean))];
  const customerIds = [...new Set(complaints.map((complaint) => idString(complaint.customerId)).filter(Boolean))];
  const [orders, customers] = await Promise.all([
    orderIds.length
      ? Order.find({ _id: { $in: orderIds } }).setOptions({ skipAutoPopulate: true }).select('_id orderNumber deviceBrand deviceModel').lean()
      : Promise.resolve([]),
    viewer.isStaff && customerIds.length ? User.find({ _id: { $in: customerIds } }).select('name email').lean() : Promise.resolve([]),
  ]);
  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  const customerById = new Map(customers.map((user) => [String(user._id), user]));

  return complaints.map((complaint) => {
    // Interne Kommentare verlassen den Server fuer Kunden nie (auch nicht als Vorschau).
    const comments = (complaint.comments || [])
      .map(normalizeComplaintComment)
      .filter((comment) => viewer.isStaff || !comment.isInternal);
    if (!comments.length) return null;
    const visibleForSummary = comments.filter((comment) => !comment.isInternal);
    const summary = summarizeMessages(visibleForSummary, viewer);
    // Geloeste/geschlossene/abgelehnte Reklamationen: keine "Antwort ausstehend" mehr.
    summary.awaitingReply = awaitingReplyForRecord(summary, 'complaint', {
      status: complaint.status,
      closedAt: complaint.resolvedAt,
    });
    // Vorschau fuer Personal: juengster Eintrag inklusive interner Notizen (als "Intern" markiert).
    if (viewer.isStaff) {
      const latest = comments.reduce((acc, comment) => (toTime(comment.createdAt) >= toTime(acc?.createdAt) ? comment : acc), null);
      if (latest) {
        summary.lastMessage = {
          preview: previewOf(latest),
          senderType: latest.senderType,
          senderName: latest.senderName,
          kind: kindOf(latest),
          createdAt: latest.createdAt,
        };
      }
      summary.lastActivityAt = new Date(Math.max(toTime(summary.lastActivityAt), ...comments.map((comment) => toTime(comment.createdAt))));
    }
    const complaintId = String(complaint._id);
    const order = complaint.orderId ? orderById.get(String(complaint.orderId)) : null;
    const customer = complaint.customerId ? customerById.get(String(complaint.customerId)) : null;
    const item = baseItem('complaint', complaintId, viewer, summary);
    item.title = complaint.complaintNumber ? `Reklamation ${complaint.complaintNumber}` : 'Reklamation';
    item.subtitle = complaint.subject || '';
    item.reference = { complaintNumber: complaint.complaintNumber || '', orderNumber: order?.orderNumber || '' };
    item.device = order ? [order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') : '';
    if (viewer.isStaff) {
      item.customer = { name: customer?.name || 'Kunde', email: customer?.email || '', isGuest: false };
      item.internalNotesCount = comments.filter((comment) => comment.isInternal).length;
    }
    // /admin/complaints ist nur fuer Admins freigegeben; Mitarbeiter antworten direkt im Postfach.
    item.link = viewer.isStaff ? (viewer.isAdmin ? '/admin/complaints' : null) : `/my-complaints/${complaintId}`;
    item.linkLabel = 'Zur Reklamation';
    item.replyChannel = 'complaint';
    item.canReply = true;
    return item;
  }).filter(Boolean);
}

// Betreff des Kontaktformulars (contactRoutes ALLOWED_SUBJECTS) als deutsches Label;
// unbekannte/alte Werte bleiben unveraendert.
const CONTACT_SUBJECT_LABELS = {
  repair: 'Reparatur',
  status: 'Status',
  business: 'Geschäftlich',
  complaint: 'Reklamation',
  other: 'Sonstiges',
};
const contactSubjectLabel = (subject) => (
  Object.prototype.hasOwnProperty.call(CONTACT_SUBJECT_LABELS, subject) ? CONTACT_SUBJECT_LABELS[subject] : subject
);

function normalizeContactMessages(contact) {
  const subjectLabel = contactSubjectLabel(contact.subject);
  const list = [{
    _id: contact._id,
    senderType: 'customer',
    senderId: null,
    senderName: contact.name || contact.email || 'Kontaktanfrage',
    messageType: 'text',
    content: [subjectLabel ? `[${subjectLabel}]` : '', contact.message || ''].filter(Boolean).join(' '),
    createdAt: contact.createdAt || null,
    readBy: [],
  }];
  (contact.replies || []).forEach((reply) => {
    list.push({
      _id: reply._id,
      senderType: 'staff',
      senderId: null,
      senderName: reply.repliedBy || 'Team',
      messageType: 'text',
      content: reply.message || reply.subject || '',
      createdAt: reply.repliedAt || reply.sentAt || null,
      readBy: [],
    });
  });
  return list;
}

async function loadContactItems(viewer, regex) {
  if (!viewer.isAdmin) return [];
  const query = { isSpam: { $ne: true } };
  if (regex) {
    query.$or = [{ name: regex }, { email: regex }, { subject: regex }, { orderNumber: regex }, { message: regex }];
    // Das Team sieht den deutschen Betreff ("Sonstiges", "Reparatur") - die Suche soll ihn ebenfalls finden.
    const labelHits = Object.keys(CONTACT_SUBJECT_LABELS).filter((key) => regex.test(CONTACT_SUBJECT_LABELS[key]));
    if (labelHits.length) query.$or.push({ subject: { $in: labelHits } });
  }
  const contacts = await ContactMessage.find(query)
    .select('_id name email subject message orderNumber status replies createdAt')
    .lean();
  return contacts.map((contact) => {
    const messages = normalizeContactMessages(contact);
    const summary = summarizeMessages(messages, viewer);
    // Kein Lesestatus pro Benutzer: "ungelesen" = Status 'neu' (teamweit, bestehendes Feld).
    summary.unreadCount = contact.status === 'new' ? 1 : 0;
    summary.awaitingReply = ['new', 'read'].includes(contact.status) && !(contact.replies || []).length;
    const item = baseItem('contact', String(contact._id), viewer, summary);
    const subjectLabel = contactSubjectLabel(contact.subject);
    item.title = `Kontaktanfrage${subjectLabel ? ` · ${subjectLabel}` : ''}`;
    item.reference = { orderNumber: contact.orderNumber || '' };
    item.customer = { name: contact.name || '', email: contact.email || '', isGuest: true };
    item.link = '/admin/contact-requests';
    item.linkLabel = 'Zu den Kontaktanfragen';
    item.replyChannel = 'none';
    item.canReply = false;
    return item;
  });
}

function baseItem(sourceType, sourceId, viewer, summary) {
  return {
    key: `${sourceType}:${sourceId}`,
    sourceType,
    sourceId,
    sourceLabel: SOURCE_LABELS[sourceType],
    title: SOURCE_LABELS[sourceType],
    subtitle: '',
    reference: {},
    customer: null,
    device: '',
    lastMessage: summary.lastMessage,
    lastActivityAt: summary.lastActivityAt,
    unreadCount: summary.unreadCount,
    awaitingReply: viewer.isStaff ? summary.awaitingReply : false,
    pendingQuestions: summary.pendingQuestions,
    pendingActions: summary.pendingActions,
    messageCount: summary.messageCount,
    link: null,
    linkLabel: '',
    threadUrl: threadUrlFor(sourceType, sourceId),
    replyChannel: 'none',
    canReply: false,
  };
}

const LOADERS = {
  order: loadOrderItems,
  repair_request: loadRepairRequestItems,
  complaint: loadComplaintItems,
  contact: loadContactItems,
};

class CommunicationInboxService {
  static get SOURCE_TYPES() { return SOURCE_TYPES.slice(); }

  static threadUrl(sourceType, sourceId) { return threadUrlFor(sourceType, sourceId); }

  // Laedt alle Quellen (oder eine) einzeln abgesichert. Eine fehlerhafte Quelle liefert einen
  // Eintrag in sourceErrors - nie stillschweigend eine leere Liste.
  static async collect(user, { source = 'all', q = '' } = {}) {
    const viewer = viewerOf(user);
    const permitted = allowedSources(viewer);
    const sources = source && source !== 'all' ? permitted.filter((entry) => entry === source) : permitted;
    const text = String(q || '').trim().slice(0, 100);
    const regex = text ? new RegExp(escapeRegex(text), 'i') : null;

    const results = await Promise.all(sources.map(async (entry) => {
      try {
        return { source: entry, items: await LOADERS[entry](viewer, regex) };
      } catch (error) {
        console.error(`CommunicationInboxService: source ${entry} failed: ${error?.stack || error}`);
        return { source: entry, error: SOURCE_ERROR_TEXT[entry] };
      }
    }));

    const items = [];
    const sourceErrors = [];
    results.forEach((result) => {
      if (result.error) sourceErrors.push({ source: result.source, label: SOURCE_LABELS[result.source], message: result.error });
      else items.push(...result.items);
    });
    return { viewer, sources, items, sourceErrors };
  }

  static countItems(items, sources) {
    const bySource = {};
    sources.forEach((source) => { bySource[source] = { all: 0, unread: 0, awaitingReply: 0 }; });
    let unread = 0;
    let unreadMessages = 0;
    let awaitingReply = 0;
    items.forEach((item) => {
      const bucket = bySource[item.sourceType] || (bySource[item.sourceType] = { all: 0, unread: 0, awaitingReply: 0 });
      bucket.all += 1;
      if (item.unreadCount > 0) { unread += 1; bucket.unread += 1; }
      unreadMessages += item.unreadCount || 0;
      if (item.awaitingReply) { awaitingReply += 1; bucket.awaitingReply += 1; }
    });
    return { all: items.length, unread, unreadMessages, awaitingReply, bySource };
  }

  /**
   * GET /api/communications/inbox
   * query: source=all|order|repair_request|complaint|contact, filter=all|unread|awaiting_reply,
   *        q (Suche), page (ab 1), limit (1-50, Standard 25)
   */
  static async listInbox(user, query = {}) {
    const source = SOURCE_TYPES.includes(query.source) ? query.source : 'all';
    const filter = FILTERS.includes(query.filter) ? query.filter : 'all';
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || 25));
    const page = Math.max(1, parseInt(query.page, 10) || 1);

    const { viewer, sources, items, sourceErrors } = await this.collect(user, { source, q: query.q });
    const counts = this.countItems(items, sources);
    const filtered = items.filter((item) => {
      if (filter === 'unread') return item.unreadCount > 0;
      if (filter === 'awaiting_reply') return item.awaitingReply;
      return true;
    });
    filtered.sort((a, b) => (toTime(b.lastActivityAt) - toTime(a.lastActivityAt)) || a.key.localeCompare(b.key));
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const pageItems = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: pageItems,
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page * limit < totalCount,
      source,
      filter,
      q: String(query.q || ''),
      counts,
      // Alle fuer den Benutzer sichtbaren Quellen - unabhaengig vom aktiven Quellenfilter,
      // damit die Quellen-Chips direkt zwischen den Quellen wechseln koennen.
      availableSources: allowedSources(viewer).map((entry) => ({ source: entry, label: SOURCE_LABELS[entry] })),
      sourceErrors,
      partial: sourceErrors.length > 0,
      viewerRole: viewer.role,
    };
  }

  /**
   * GET /api/communications/summary -> Zaehler fuer Seitenleiste und Dashboard.
   * Personal: zusaetzlich die neuesten Eintraege mit ungelesenen Nachrichten oder offener Antwort.
   */
  static async collectForSummary(user) {
    const viewer = viewerOf(user);
    const key = `${viewer.userId}:${viewer.role}`;
    const now = Date.now();
    const cached = summaryCache.get(key);
    if (cached && now - cached.at < SUMMARY_CACHE_TTL_MS) return cached.promise;
    if (summaryCache.size >= SUMMARY_CACHE_MAX) {
      summaryCache.forEach((entry, entryKey) => {
        if (now - entry.at >= SUMMARY_CACHE_TTL_MS) summaryCache.delete(entryKey);
      });
      if (summaryCache.size >= SUMMARY_CACHE_MAX) summaryCache.clear();
    }
    const entry = { at: now, promise: null };
    entry.promise = this.collect(user, { source: 'all' }).then((result) => {
      if (result.sourceErrors.length && summaryCache.get(key) === entry) summaryCache.delete(key);
      return result;
    }, (error) => {
      if (summaryCache.get(key) === entry) summaryCache.delete(key);
      throw error;
    });
    summaryCache.set(key, entry);
    return entry.promise;
  }

  /** Zaehler-Cache leeren: fuer einen Benutzer (userId) oder komplett (ohne Argument). */
  static invalidateSummaryCache(userId) {
    if (!userId) {
      summaryCache.clear();
      return;
    }
    const prefix = `${idString(userId)}:`;
    Array.from(summaryCache.keys()).forEach((key) => {
      if (key.startsWith(prefix)) summaryCache.delete(key);
    });
  }

  static async getSummary(user, { recentLimit = 0 } = {}) {
    const { viewer, sources, items, sourceErrors } = await this.collectForSummary(user);
    const counts = this.countItems(items, sources);
    const limit = Math.min(MAX_LIMIT, Math.max(0, parseInt(recentLimit, 10) || 0));
    const recent = limit
      ? items
        .filter((item) => item.unreadCount > 0 || item.awaitingReply)
        .sort((a, b) => toTime(b.lastActivityAt) - toTime(a.lastActivityAt))
        .slice(0, limit)
      : [];
    return {
      unread: counts.unread,
      unreadMessages: counts.unreadMessages,
      awaitingReply: viewer.isStaff ? counts.awaitingReply : 0,
      bySource: counts.bySource,
      recent,
      sourceErrors,
      partial: sourceErrors.length > 0,
    };
  }

  // Zugriff auf genau einen Datensatz pruefen. Kunden: fremd/unbekannt/ungueltig -> 403.
  static async assertAccess(user, sourceType, sourceId) {
    const viewer = viewerOf(user);
    const deny = () => (viewer.isStaff
      ? httpError(404, 'Das Gespräch wurde nicht gefunden.')
      : httpError(403, 'Zugriff verweigert.'));
    if (!allowedSources(viewer).includes(sourceType) || !isObjectIdLike(sourceId)) throw deny();
    let record = null;
    if (sourceType === 'order') {
      record = await Order.findById(sourceId).setOptions({ skipAutoPopulate: true }).select('_id customerId orderNumber').lean();
    } else if (sourceType === 'repair_request') {
      record = await RepairRequest.findById(sourceId).select('_id customerId requestNumber messages').lean();
    } else if (sourceType === 'complaint') {
      record = await Complaint.findById(sourceId).setOptions({ skipAutoPopulate: true }).select('_id customerId complaintNumber subject comments orderId').lean();
    } else if (sourceType === 'contact') {
      record = await ContactMessage.findById(sourceId).lean();
    }
    if (!record) throw deny();
    if (!viewer.isStaff && idString(record.customerId) !== viewer.userId) throw deny();
    return { viewer, record };
  }

  /**
   * GET /api/communications/thread/:sourceType/:sourceId
   * Lesende Thread-Sicht fuer Quellen ohne eigenes Thread-UI im Postfach:
   *  - complaint: Kommentare (interne nur fuer Personal)
   *  - contact:   Anfrage + Antworten (nur Admin)
   *  - repair_request: NUR die Alt-Nachrichten aus RepairRequest.messages (der aktuelle Thread
   *    kommt wie bisher aus /api/repair-request-communication/:id)
   *  - order: keine Nachrichten (der Thread kommt aus /api/inspection-communication/:id)
   */
  static async getThread(user, sourceType, sourceId) {
    const { viewer, record } = await this.assertAccess(user, sourceType, sourceId);
    let messages = [];
    if (sourceType === 'complaint') {
      messages = (record.comments || []).map(normalizeComplaintComment).filter((comment) => viewer.isStaff || !comment.isInternal);
    } else if (sourceType === 'contact') {
      messages = normalizeContactMessages(record);
    } else if (sourceType === 'repair_request') {
      messages = (record.messages || []).map(normalizeLegacyRepairRequestMessage);
    }
    messages.sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
    return {
      key: `${sourceType}:${sourceId}`,
      sourceType,
      sourceId,
      messages: messages.map((message) => ({
        _id: idString(message._id),
        senderType: message.senderType,
        senderName: message.senderName,
        kind: kindOf(message),
        content: message.content,
        createdAt: message.createdAt,
        isInternal: Boolean(message.isInternal),
        legacy: Boolean(message.legacy),
      })),
    };
  }

  /**
   * PUT /api/communications/:sourceType/:sourceId/read -> markiert fuer DIESEN Benutzer gelesen.
   * Auftrag/Reparaturanfrage: readBy des Benutzers (pro Benutzer). Kontaktanfrage: Status
   * 'new' -> 'read' (teamweit, bestehendes Feld). Reklamation: kein Lesestatus vorhanden.
   */
  static async markRead(user, sourceType, sourceId) {
    const { viewer } = await this.assertAccess(user, sourceType, sourceId);
    this.invalidateSummaryCache(viewer.userId);
    let updated = 0;
    // Delegiert an die bestehenden Markierungsfunktionen der Quellen (keine eigene Schreiblogik).
    if (sourceType === 'order') {
      const InspectionCommunicationService = require('./inspectionCommunicationService');
      await InspectionCommunicationService.markMessagesAsRead(sourceId, viewer.userId);
      updated = 1;
    } else if (sourceType === 'repair_request') {
      const RepairRequestCommunicationService = require('./repairRequestCommunicationService');
      await RepairRequestCommunicationService.markMessagesAsRead(sourceId, viewer.userId);
      updated = 1;
    } else if (sourceType === 'contact') {
      const result = await ContactMessage.updateOne({ _id: sourceId, status: 'new' }, { $set: { status: 'read' } });
      updated = result.modifiedCount || 0;
    }
    return { success: true, updated };
  }

  // Fuer Tests/Diagnose: ist eine Nachricht fuer den Benutzer ungelesen?
  static isUnreadFor(message, user) {
    return isMessageUnreadFor(message, viewerOf(user));
  }
}

module.exports = CommunicationInboxService;
