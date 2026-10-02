/**
 * EINE Regel fuer "ungelesen" und "Antwort ausstehend" in allen Kundengespraechen
 * (Auftrags-Thread, Reparaturanfrage-Thread, Reklamationskommentare, Kontaktanfragen).
 *
 * Verwendet von: communicationInboxService (Postfach, Zaehler, Dashboard) und
 * inspectionCommunicationService.getUnreadMessageCounts (Badges in Buchungen/Terminen).
 *
 * Regeln (Produktentscheidung 01.10.2026):
 *  - "Ungelesen" gilt PRO BENUTZER (vorhandenes messages[].readBy). Liest ein Mitarbeiter,
 *    bleibt der Zaehler der anderen Mitarbeiter unveraendert.
 *      * Personal/Admin: Nachrichten des Kunden (auch Gaeste ohne senderId) ohne eigenen
 *        Lese-Eintrag, plus beantwortete Rueckfragen, deren Antwort NACH dem eigenen
 *        Lesezeitpunkt kam. Nachrichten anderer Mitarbeiter zaehlen NICHT.
 *      * Kunde: Nachrichten von Team/System ohne eigenen Lese-Eintrag. Eigene zaehlen nicht.
 *  - "Antwort ausstehend" gilt TEAMWEIT und unabhaengig vom Lesen: die letzte
 *    Kunden-Aktivitaet (Nachricht, Antwort auf Rueckfrage, erledigte Aktion) ist juenger als
 *    die letzte Team-Nachricht. Nur eine Team-Nachricht an den Kunden beendet den Zustand
 *    (interne Notizen und Systemmeldungen nicht).
 */

const STAFF_ROLES = new Set(['staff', 'admin']);

const isStaffRole = (role) => STAFF_ROLES.has(String(role || ''));

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const idOf = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

/** Lesezeitpunkt (ms) des Benutzers fuer eine Nachricht oder 0. */
const readAtFor = (message, userId) => {
  const uid = idOf(userId);
  if (!uid) return 0;
  let latest = 0;
  (message?.readBy || []).forEach((entry) => {
    if (idOf(entry?.userId) === uid) {
      latest = Math.max(latest, toTime(entry.readAt) || 1);
    }
  });
  return latest;
};

const respondedAtOf = (message) => (
  message?.feedbackRequest && message.feedbackRequest.status === 'responded'
    ? toTime(message.feedbackRequest.respondedAt)
    : 0
);

/**
 * Ist die Nachricht fuer diesen Betrachter ungelesen?
 * viewer: { userId, role }
 */
const isMessageUnreadFor = (message, viewer) => {
  // noReadState: Quellen ohne Lesestatus pro Benutzer (Reklamationskommentare, Alt-Nachrichten
  // aus RepairRequest.messages). Sie zaehlen NIE als ungelesen - sonst koennte der Zaehler nie
  // auf 0 fallen. Fuer diese Quellen gilt nur "Antwort ausstehend".
  if (!message || message.isInternal || message.noReadState) return false;
  const userId = idOf(viewer?.userId);
  if (!userId) return false;

  if (isStaffRole(viewer?.role)) {
    const respondedAt = respondedAtOf(message);
    if (respondedAt) {
      // Beantwortete Rueckfrage: ungelesen, bis der Mitarbeiter NACH der Antwort gelesen hat.
      return readAtFor(message, userId) < respondedAt;
    }
    if (message.senderType !== 'customer') return false;
    if (idOf(message.senderId) && idOf(message.senderId) === userId) return false;
    return readAtFor(message, userId) === 0;
  }

  // Kunde
  if (message.senderType !== 'staff' && message.senderType !== 'system') return false;
  if (idOf(message.senderId) && idOf(message.senderId) === userId) return false;
  return readAtFor(message, userId) === 0;
};

/** Juengste Kunden-Aktivitaet (ms) einer Nachricht (Nachricht, Antwort, erledigte Aktion). */
const customerActivityAt = (message) => {
  if (!message || message.isInternal) return 0;
  let at = 0;
  if (message.senderType === 'customer') at = Math.max(at, toTime(message.createdAt));
  at = Math.max(at, respondedAtOf(message));
  if (message.quickAction && message.quickAction.status === 'completed'
    && !isStaffRole(message.quickAction.completedByRole)) {
    // Von Personal erledigte Aktionen sind keine Kunden-Aktivitaet (Altdaten ohne Rolle: Kunde).
    at = Math.max(at, toTime(message.quickAction.completedAt));
  }
  return at;
};

const staffReplyAt = (message) => (
  message && !message.isInternal && message.senderType === 'staff' ? toTime(message.createdAt) : 0
);

const kindOf = (message) => {
  if (!message) return 'text';
  if (message.isInternal) return 'internal';
  switch (message.messageType) {
    case 'feedback_request': return 'question';
    case 'quick_action': return 'action';
    case 'repair_offer': return 'offer';
    case 'system_notification': return 'system';
    default: return message.senderType === 'system' ? 'system' : 'text';
  }
};

const previewOf = (message, maxLength = 140) => {
  if (!message) return '';
  let text = '';
  if (message.messageType === 'feedback_request' && message.feedbackRequest) {
    text = message.feedbackRequest.status === 'responded' && message.feedbackRequest.response?.label
      ? `${message.feedbackRequest.question || message.content || ''} – Antwort: ${message.feedbackRequest.response.label}`
      : (message.feedbackRequest.question || message.content || '');
  } else if (message.messageType === 'quick_action' && message.quickAction) {
    text = [message.quickAction.actionLabel, message.quickAction.description].filter(Boolean).join(' – ');
  } else if (message.messageType === 'repair_offer' && message.metadata?.offerDescription) {
    text = `Reparaturangebot: ${message.metadata.offerDescription}`;
  } else {
    text = message.content || '';
  }
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
};

/**
 * Fasst einen Thread fuer einen Betrachter zusammen.
 * messages: normalisierte Nachrichten { senderType, senderId, senderName, messageType, content,
 *           createdAt, readBy, feedbackRequest, quickAction, metadata, isInternal }
 */
const summarizeMessages = (messages, viewer) => {
  const list = (messages || []).filter(Boolean);
  let unreadCount = 0;
  let lastCustomerAt = 0;
  let lastStaffAt = 0;
  let pendingQuestions = 0;
  let pendingActions = 0;
  let last = null;
  let lastTime = -1;
  let lastActivityAt = 0;

  list.forEach((message) => {
    if (isMessageUnreadFor(message, viewer)) unreadCount += 1;
    lastCustomerAt = Math.max(lastCustomerAt, customerActivityAt(message));
    lastStaffAt = Math.max(lastStaffAt, staffReplyAt(message));
    if (!message.isInternal) {
      if (message.feedbackRequest && message.feedbackRequest.status === 'pending') pendingQuestions += 1;
      if (message.quickAction && message.quickAction.status === 'pending') pendingActions += 1;
    }
    const created = toTime(message.createdAt);
    if (created >= lastTime) {
      lastTime = created;
      last = message;
    }
    lastActivityAt = Math.max(lastActivityAt, created, customerActivityAt(message));
  });

  return {
    unreadCount,
    awaitingReply: lastCustomerAt > 0 && lastCustomerAt > lastStaffAt,
    lastCustomerActivityAt: lastCustomerAt ? new Date(lastCustomerAt) : null,
    pendingQuestions,
    pendingActions,
    messageCount: list.length,
    lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
    lastMessage: last ? {
      preview: previewOf(last),
      senderType: last.senderType || 'staff',
      senderName: last.senderName || '',
      kind: kindOf(last),
      createdAt: last.createdAt || null,
    } : null,
  };
};

/**
 * Abgeschlossene Datensaetze brauchen keine Antwort mehr: "Antwort ausstehend" entfaellt fuer
 * Auftraege (abgeschlossen/storniert) und Reklamationen (geloest/geschlossen/abgelehnt) - es sei
 * denn, der Kunde hat NACH dem bekannten Abschlusszeitpunkt (closedAt) noch geschrieben.
 * Ist kein Abschlusszeitpunkt bekannt, entfaellt der Zustand immer. "Ungelesen" bleibt unberuehrt.
 */
const TERMINAL_STATUSES = {
  order: new Set(['completed', 'cancelled']),
  complaint: new Set(['resolved', 'closed', 'rejected', 'denied']),
};

const isTerminalRecord = (sourceType, status) => Boolean(TERMINAL_STATUSES[sourceType]?.has(String(status || '')));

const awaitingReplyForRecord = (summary, sourceType, record = {}) => {
  if (!summary?.awaitingReply) return false;
  if (!isTerminalRecord(sourceType, record.status)) return true;
  const closedAt = toTime(record.closedAt);
  if (!closedAt) return false;
  return toTime(summary.lastCustomerActivityAt) > closedAt;
};

module.exports = {
  isStaffRole,
  isTerminalRecord,
  awaitingReplyForRecord,
  readAtFor,
  isMessageUnreadFor,
  customerActivityAt,
  summarizeMessages,
  previewOf,
  kindOf,
};
