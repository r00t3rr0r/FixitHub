'use strict';

/**
 * Auftragsverlauf (Order.timeline) - EIN gemeinsamer Helfer fuer alle Schreiber und Leser.
 *
 * Vertrag (HIST-CONTRACT, Stand 01.10.2026):
 *   - `status` eines Eintrags bleibt der STABILE Maschinenschluessel (z. B. 'Device Changed',
 *     'Shipping Label Created'). Bestehende Schluessel werden NIE umbenannt - mehrere Leser
 *     parsen sie (deviceInspectionService, dhlService, bookingService, InspectionResultsDisplay).
 *   - Neue, optionale Felder (Order.js orderTimelineSchema, ohne Defaults - Altdaten bleiben wie sie
 *     sind): type, source, changes[{field,label,from,to}], reason, refs{...}, visibility, eventKey.
 *   - Jeder Eintrag einer Auftragsaenderung wird im SELBEN Schreibvorgang wie die Aenderung
 *     gespeichert: entry() + push(order, e) vor order.save()/saveOrderGuarded(), oder
 *     updateFor(e) im selben updateOne.
 *   - Wiederholte Anfragen erzeugen keinen zweiten Eintrag: eventKey wird pro Auftrag nur
 *     einmal gespeichert, und Eintraege, deren changes alle from === to haben, werden verworfen.
 *   - Kunden/Gaeste sehen ausschliesslich toCustomerView(timeline) (Positivliste, ohne Namen,
 *     Gruende, Aenderungsdetails oder interne Texte).
 *   - Keine Zeitstempel werden erfunden: buildMilestones() leitet Meilensteine nur aus echten
 *     Ereignissen ab; fehlende Zeitpunkte heissen "Zeitpunkt nicht erfasst", nie erreichte
 *     Stufen "Übersprungen – nicht erfasst" - nie "Abgeschlossen".
 *
 * Dieses Modul haengt nur vom reinen Geldformatierer utils/money.js ab (resolveActor laedt das
 * User-Modell lazy).
 */

const money = require('./money');

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

// Eintragsarten (Filter in GET /api/orders/:id/history?types=...).
const TYPES = [
  'status', 'workflow', 'device', 'services', 'pricing', 'parts', 'staff', 'inspection',
  'quote', 'communication', 'payment', 'invoice', 'shipping', 'note',
];

// Filtergruppen fuer die Oberflaeche (Chips). types = enthaltene Eintragsarten.
const TYPE_GROUPS = [
  { id: 'status', label: 'Status & Workflow', types: ['status', 'workflow'] },
  { id: 'device', label: 'Gerät & Leistungen', types: ['device', 'services', 'parts'] },
  { id: 'pricing', label: 'Preise & Rabatte', types: ['pricing'] },
  { id: 'staff', label: 'Personal', types: ['staff'] },
  { id: 'inspection', label: 'Prüfung & Angebot', types: ['inspection', 'quote'] },
  { id: 'communication', label: 'Kommunikation', types: ['communication', 'note'] },
  { id: 'finance', label: 'Zahlung & Rechnung', types: ['payment', 'invoice'] },
  { id: 'shipping', label: 'Versand', types: ['shipping'] },
];

const TYPE_LABELS = {
  status: 'Status',
  workflow: 'Workflow',
  device: 'Gerät',
  services: 'Leistungen',
  pricing: 'Preise',
  parts: 'Ersatzteile',
  staff: 'Personal',
  inspection: 'Prüfung',
  quote: 'Kostenvoranschlag',
  communication: 'Kommunikation',
  payment: 'Zahlung',
  invoice: 'Rechnung',
  shipping: 'Versand',
  note: 'Notiz',
};

// Order.status -> deutsches Label (Verlauf/Meilensteine). Unbekannte Werte bleiben lesbar.
const STATUS_LABELS_DE = {
  pending: 'Ausstehend',
  'diagnostic-assessment': 'Diagnosebewertung',
  'in-progress': 'Reparatur in Bearbeitung',
  paused: 'Pausiert',
  'quality-check': 'Qualitätskontrolle',
  'ready-for-pickup': 'Reparatur abgeschlossen – bereit zur Rückgabe',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  // Altwerte (nie im Order-Enum, aber in alten Verlaufstexten)
  diagnosed: 'Diagnose abgeschlossen',
  'awaiting-parts': 'Wartet auf Teile',
  'on-hold': 'Angehalten',
};

const WORKFLOW_STATUS_LABELS_DE = {
  'not-started': 'nicht gestartet',
  'in-progress': 'in Bearbeitung',
  'on-hold': 'pausiert',
  completed: 'abgeschlossen',
};

const SHIPPING_STATUS_LABELS_DE = {
  pending: 'In Vorbereitung',
  'label-created': 'Label erstellt',
  shipped: 'Versendet',
  'in-transit': 'In Zustellung',
  'out-for-delivery': 'Heute in Zustellung',
  delivered: 'Zugestellt',
  failed: 'Fehlgeschlagen',
};

const statusLabelDe = (status) => STATUS_LABELS_DE[String(status || '')] || String(status || '–');

/**
 * KEY_META: Maschinenschluessel (klein geschrieben) -> { type, label, customer?, statusTo? }.
 *   customer: true      -> fuer Kunden/Gaeste sichtbar (Altdaten ohne visibility)
 *   customer: 'status'  -> sichtbar, aber NUR als Statuslabel (ohne Beschreibung/Notiz)
 *   statusTo            -> Altschluessel, der einen Statuswechsel auf diesen Wert bedeutet
 * Die Schluessel der Workflow-/Inspektionsschreiber (repairWorkflowService,
 * deviceInspectionService) stehen ebenfalls hier, damit Titel und Kundensicht stimmen.
 * Einzelne Schluessel sind reserviert und haben noch keinen Schreiber (jeweils markiert).
 */
const KEY_META = {
  // --- Status ---
  'order received': { type: 'status', label: 'Auftrag erhalten', customer: true },
  'order status updated': { type: 'status', label: 'Status geändert', customer: 'status' },
  // Storno aufheben (nur Admin, mit Grund): fuer Kunden wie ein Statuswechsel (nur Bezeichnung)
  'order reopened': { type: 'status', label: 'Stornierung aufgehoben', customer: 'status' },
  'order status changed': { type: 'status', label: 'Status geändert', customer: 'status' },
  // Altschluessel aus OrderService.updateStatus (status.charAt(0).toUpperCase() + ...replace('-', ' '))
  pending: { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'pending' },
  'diagnostic assessment': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'diagnostic-assessment' },
  'in progress': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'in-progress' },
  paused: { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'paused' },
  'quality check': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'quality-check' },
  completed: { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'completed' },
  'ready for-pickup': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'ready-for-pickup' },
  'ready for pickup': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'ready-for-pickup' },
  cancelled: { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'cancelled' },
  diagnosed: { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'diagnosed' },
  'awaiting parts': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'awaiting-parts' },
  'on hold': { type: 'status', label: 'Status geändert', customer: 'status', statusTo: 'on-hold' },
  'repair in progress': { type: 'status', label: 'Reparatur begonnen', customer: 'status', statusTo: 'in-progress' },
  'order ready': { type: 'status', label: 'Reparatur abgeschlossen', customer: true, statusTo: 'ready-for-pickup' },
  'order paused for customer': { type: 'status', label: 'Pausiert – Rückmeldung des Kunden erwartet', customer: 'status', statusTo: 'paused' },
  'order resumed': { type: 'status', label: 'Auftrag fortgesetzt', customer: 'status' },

  // --- Personal ---
  'staff assigned': { type: 'staff', label: 'Personal zugewiesen' },
  'add-on staff assigned': { type: 'staff', label: 'Personal für Zusatzleistung zugewiesen' },
  'staff notified': { type: 'staff', label: 'Personal benachrichtigt' },

  // --- Leistungen / Preise ---
  'add-on service added': { type: 'services', label: 'Zusatzleistung hinzugefügt' },
  'add-on service updated': { type: 'services', label: 'Zusatzleistung geändert' },
  'add-on service removed': { type: 'services', label: 'Zusatzleistung entfernt' },
  'order services changed': { type: 'services', label: 'Leistungen geändert' },
  'order products changed': { type: 'services', label: 'Produkte geändert' },
  'order price changed': { type: 'pricing', label: 'Preis geändert' },

  // --- Ersatzteile ---
  'epart assigned': { type: 'parts', label: 'Ersatzteil zugewiesen' },
  'epart removed': { type: 'parts', label: 'Ersatzteil entfernt' },
  'epart status updated': { type: 'parts', label: 'Ersatzteilstatus geändert' },
  'epart need list added': { type: 'parts', label: 'Ersatzteil auf Bedarfsliste gesetzt' },

  // --- Geraet ---
  'device changed': { type: 'device', label: 'Gerät korrigiert' },
  'device change': { type: 'device', label: 'Gerät korrigiert' },
  'device change confirmed': { type: 'device', label: 'Gerätewechsel bestätigt' },
  'device change not confirmed': { type: 'device', label: 'Gerätewechsel nicht bestätigt' },

  // --- Template-Workflows ---
  'workflow assigned': { type: 'workflow', label: 'Workflow zugewiesen' },
  'workflow started': { type: 'workflow', label: 'Workflow gestartet' },
  'workflow task assigned': { type: 'workflow', label: 'Workflow-Aufgabe zugewiesen' },
  'workflow step completed': { type: 'workflow', label: 'Workflow-Schritt abgeschlossen' },
  'workflow step skipped': { type: 'workflow', label: 'Workflow-Schritt übersprungen' },
  'workflow step reopened': { type: 'workflow', label: 'Workflow-Schritt erneut geöffnet' },
  'workflow paused': { type: 'workflow', label: 'Workflow pausiert' },
  'workflow resumed': { type: 'workflow', label: 'Workflow fortgesetzt' },
  'workflow status updated': { type: 'workflow', label: 'Workflow-Status geändert' },
  'workflow navigation': { type: 'workflow', label: 'Workflow-Schritt gewechselt' },
  'workflow removed': { type: 'workflow', label: 'Workflow entfernt' },
  'workflow completed': { type: 'workflow', label: 'Workflow abgeschlossen' },

  // --- Reparatur-Workflow des Technikers (RepairWorkflow; Schreiber: repairWorkflowService) ---
  'repair workflow started': { type: 'workflow', label: 'Reparatur gestartet' },
  'repair workflow paused': { type: 'workflow', label: 'Reparatur pausiert' },
  'repair workflow resumed': { type: 'workflow', label: 'Reparatur fortgesetzt' },
  'repair workflow incident': { type: 'workflow', label: 'Zwischenfall gemeldet' },
  'repair workflow incident resolved': { type: 'workflow', label: 'Zwischenfall erledigt' },
  'repair workflow completed': { type: 'workflow', label: 'Reparatur abgeschlossen', customer: true },
  'repair workflow reopened': { type: 'workflow', label: 'Reparatur wieder aufgenommen' },

  // --- Eingangspruefung / Kostenvoranschlag (Schreiber: deviceInspectionService) ---
  'inspection started': { type: 'inspection', label: 'Eingangsprüfung gestartet' },
  'inspection completed': { type: 'inspection', label: 'Eingangsprüfung abgeschlossen' },
  'repair quote updated': { type: 'quote', label: 'Kostenvoranschlag aktualisiert' },
  // reserviert, derzeit ohne Schreiber:
  'repair quote accepted': { type: 'quote', label: 'Kostenvoranschlag angenommen' },
  'repair quote rejected': { type: 'quote', label: 'Kostenvoranschlag abgelehnt' },
  'unlock verified': { type: 'inspection', label: 'Entsperrdaten bestätigt' },
  'unlock incorrect': { type: 'inspection', label: 'Entsperrdaten falsch' },
  'unlock unverifiable': { type: 'inspection', label: 'Entsperrdaten nicht prüfbar' },
  'unlock update requested': { type: 'inspection', label: 'Neue Entsperrdaten angefordert' },

  // --- Versand ---
  'pickup confirmed': { type: 'shipping', label: 'Abholung bestätigt', customer: true },
  'shipping label created': { type: 'shipping', label: 'Versandlabel an Kunden erstellt', customer: true },
  'inbound label created': { type: 'shipping', label: 'DHL-Einsendelabel erstellt', customer: true },
  'booking inbound label created': { type: 'shipping', label: 'DHL-Einsendelabel erstellt', customer: true },
  'return label created': { type: 'shipping', label: 'DHL-Einsendelabel erstellt', customer: true },
  'shipping label prepared': { type: 'shipping', label: 'DHL-Einsendelabel vorbereitet', customer: true },
  'shipping label reconciliation required': { type: 'shipping', label: 'Abgleich des Versandlabels erforderlich' },
  'shipping label reconciled': { type: 'shipping', label: 'Versandlabel abgeglichen' },
  'shipping label orphaned': { type: 'shipping', label: 'Überzähliges Versandlabel' },
  'inbound label reconciliation required': { type: 'shipping', label: 'Abgleich des Einsendelabels erforderlich' },
  'inbound label reconciled': { type: 'shipping', label: 'Einsendelabel abgeglichen' },
  'inbound label orphaned': { type: 'shipping', label: 'Überzähliges Einsendelabel' },
  'legacy inbound label moved': { type: 'shipping', label: 'Einsendelabel (Altbestand) getrennt' },
  'return status updated': { type: 'shipping', label: 'Einsendestatus aktualisiert' },
  'shipping status updated': { type: 'shipping', label: 'Versandstatus aktualisiert' },

  // --- Lesemodell (nur GET /api/orders/:id/history; nie gespeichert) ---
  'order revision': { type: 'services', label: 'Änderungsbeleg' },
  'invoice created': { type: 'invoice', label: 'Rechnung erstellt' },
  'credit note created': { type: 'invoice', label: 'Gutschrift erstellt' },
  'invoice action': { type: 'invoice', label: 'Rechnungsaktion' },
  'payment recorded': { type: 'payment', label: 'Zahlung erfasst' },
  'refund recorded': { type: 'payment', label: 'Erstattung erfasst' },

  // --- Buchung (Booking.timeline, nur fuer die Gast-Projektion) ---
  'booking created': { type: 'status', label: 'Buchung erstellt', customer: true },
};

const normalizeKey = (key) => String(key || '').trim().toLowerCase();

// Schluessel mit variablem Anteil.
const metaFor = (key) => {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  if (KEY_META[normalized]) return KEY_META[normalized];
  if (normalized.startsWith('versandstatus:') || normalized.startsWith('shipping status:')) {
    return { type: 'shipping', label: null, customer: true, dynamic: 'shipping-status' };
  }
  if (normalized.startsWith('status changed to ')) {
    return { type: 'status', label: 'Status geändert', customer: 'status', dynamic: 'booking-status' };
  }
  return null;
};

const toIdString = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id !== undefined && value._id !== value) return toIdString(value._id);
  }
  return String(value).trim();
};

const isObjectIdLike = (value) => OBJECT_ID_PATTERN.test(toIdString(value));

// ---------------------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------------------

/**
 * Akteur normalisieren. Akzeptiert { id, name }, ein User-Dokument/req.user
 * ({ _id, name, firstName, lastName, email }), eine reine ID oder nichts (System).
 */
const normalizeActor = (actor) => {
  if (!actor) return { id: 'system', name: 'System' };
  if (typeof actor === 'string' || (typeof actor === 'object' && typeof actor.toHexString === 'function')) {
    const id = toIdString(actor);
    return id && id !== 'system' ? { id, name: 'Mitarbeiter' } : { id: 'system', name: 'System' };
  }
  const id = toIdString(actor.id || actor._id) || 'system';
  const name = String(
    actor.name
    || [actor.firstName, actor.lastName].filter(Boolean).join(' ')
    || actor.email
    || (id === 'system' ? 'System' : 'Mitarbeiter')
  ).trim();
  return { id, name: name || 'Mitarbeiter' };
};

// Akteur aus einer ID laden (Name fuer den Verlauf). Ohne ID: System.
const resolveActor = async (actorId) => {
  if (actorId && typeof actorId === 'object' && !(typeof actorId.toHexString === 'function') && (actorId.name || actorId.firstName)) {
    return normalizeActor(actorId);
  }
  const id = toIdString(actorId);
  if (!id || id === 'system' || !OBJECT_ID_PATTERN.test(id)) return { id: 'system', name: 'System' };
  try {
    // eslint-disable-next-line global-require
    const User = require('../models/User');
    const user = await User.findById(id).select('name firstName lastName email').lean();
    if (!user) return { id, name: 'Mitarbeiter' };
    return normalizeActor({ ...user, id });
  } catch (error) {
    return { id, name: 'Mitarbeiter' };
  }
};

const plainValue = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
  if (Array.isArray(value)) return value.map(plainValue);
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => { out[key] = plainValue(value[key]); });
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
};

const sameValue = (left, right) => JSON.stringify(plainValue(left)) === JSON.stringify(plainValue(right));

// changes normalisieren; Eintraege mit from === to werden verworfen.
const normalizeChanges = (changes) => {
  if (!Array.isArray(changes)) return [];
  return changes
    .filter((change) => change && change.field)
    .map((change) => ({
      field: String(change.field),
      ...(change.label ? { label: String(change.label) } : {}),
      from: plainValue(change.from),
      to: plainValue(change.to),
    }))
    .filter((change) => !sameValue(change.from, change.to));
};

const REF_ID_FIELDS = [
  'revisionId', 'invoiceId', 'paymentId', 'inspectionId', 'workflowId', 'workflowStepId',
  'repairWorkflowId', 'communicationId', 'complaintId', 'bookingId',
];

const cleanRefs = (refs) => {
  if (!refs || typeof refs !== 'object') return null;
  const out = {};
  REF_ID_FIELDS.forEach((field) => {
    if (isObjectIdLike(refs[field])) out[field] = toIdString(refs[field]);
  });
  if (refs.trackingNumber) out.trackingNumber = String(refs.trackingNumber);
  if (refs.revisionNumber !== undefined && Number.isFinite(Number(refs.revisionNumber))) {
    out.revisionNumber = Number(refs.revisionNumber);
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Baut einen Verlaufseintrag (reines Objekt fuer order.timeline.push / $push).
 * Rueckgabe null, wenn changes uebergeben wurden, aber keine echte Aenderung enthalten
 * (from === to) - ausser force: true.
 *
 * @param {Object} input
 * @param {string} input.key          stabiler Maschinenschluessel (-> timeline.status)
 * @param {string} [input.type]       eine von TYPES (Standard: aus KEY_META)
 * @param {string} [input.description] deutscher Text (Standard: Label aus KEY_META)
 * @param {Object|string} [input.actor] { id, name } | User | ID
 * @param {string} [input.source]     z. B. 'Statusmenü', 'Gerätewechsel-Dialog', 'DHL', 'Kunde'
 * @param {Array}  [input.changes]    [{ field, label, from, to }]
 * @param {string} [input.reason]     Grund (nur Personal)
 * @param {Object} [input.refs]       { revisionId, invoiceId, paymentId, inspectionId, workflowId,
 *                                      workflowStepId, repairWorkflowId, communicationId,
 *                                      complaintId, bookingId, trackingNumber, revisionNumber }
 * @param {'staff'|'customer'} [input.visibility='staff']
 * @param {string} [input.eventKey]   Idempotenzschluessel (pro Auftrag einmalig)
 * @param {Date}   [input.at]         Zeitpunkt (Standard: jetzt)
 * @param {string[]} [input.photos]
 */
const entry = ({
  key, type, description, actor, source, changes, reason, refs, visibility, eventKey, at, photos, force,
} = {}) => {
  if (!key) throw new Error('orderHistory.entry: key fehlt');
  const meta = metaFor(key);
  const normalizedChanges = normalizeChanges(changes);
  if (Array.isArray(changes) && changes.length > 0 && normalizedChanges.length === 0 && !force) {
    return null;
  }
  const actorInfo = normalizeActor(actor);
  const timestamp = at ? new Date(at) : new Date();
  const result = {
    status: String(key),
    description: String(description || meta?.label || key).slice(0, 4000),
    completedAt: Number.isFinite(timestamp.getTime()) ? timestamp : new Date(),
    staffId: actorInfo.id || 'system',
    staffName: actorInfo.name || 'System',
    type: TYPES.includes(type) ? type : (meta?.type || 'note'),
    visibility: visibility === 'customer' ? 'customer' : 'staff',
  };
  if (source) result.source = String(source);
  if (normalizedChanges.length) result.changes = normalizedChanges;
  if (reason && String(reason).trim()) result.reason = String(reason).trim().slice(0, 2000);
  const cleanedRefs = cleanRefs(refs);
  if (cleanedRefs) result.refs = cleanedRefs;
  if (eventKey) result.eventKey = String(eventKey);
  if (Array.isArray(photos) && photos.length) result.photos = photos.map(String);
  return result;
};

const hasEventKey = (orderOrTimeline, eventKey) => {
  if (!eventKey) return false;
  const timeline = Array.isArray(orderOrTimeline) ? orderOrTimeline : (orderOrTimeline?.timeline || []);
  return timeline.some((item) => item && item.eventKey === String(eventKey));
};

/**
 * Haengt einen Eintrag an order.timeline an (Dokument wird danach vom Aufrufer gespeichert).
 * Rueckgabe false, wenn e null ist oder der eventKey schon existiert.
 */
const push = (order, e) => {
  if (!order || !e) return false;
  if (!Array.isArray(order.timeline)) order.timeline = [];
  if (e.eventKey && hasEventKey(order, e.eventKey)) return false;
  order.timeline.push(e);
  return true;
};

/**
 * Fuer updateOne-Schreiber: { filter, update } - mit eventKey nur, wenn er noch fehlt.
 *   const { filter, update } = updateFor(e, { _id: orderId });
 *   await Order.updateOne(filter, { ...update, $set: {...} });
 */
const updateFor = (e, baseFilter = {}) => {
  if (!e) return { filter: null, update: null };
  const filter = { ...baseFilter };
  if (e.eventKey) filter['timeline.eventKey'] = { $ne: e.eventKey };
  return { filter, update: { $push: { timeline: e } } };
};

/**
 * Akteursfelder fuer bestehende $push-Objekte (DHL-Track, HIST-16):
 *   { status: 'Shipping Label Created', description, completedAt,
 *     ...labelActorFields(req.user) }   -> staffId, staffName, source: 'DHL', type: 'shipping'
 * Ohne Akteur (Hintergrundjob) bleibt es 'DHL Parcel Integration'.
 */
const labelActorFields = (actor, { source = 'DHL', fallbackName = 'DHL Parcel Integration' } = {}) => {
  const info = actor ? normalizeActor(actor) : { id: 'system', name: fallbackName };
  return {
    staffId: info.id || 'system',
    staffName: info.id === 'system' && !actor ? fallbackName : info.name,
    source,
    type: 'shipping',
  };
};

// Idempotenzschluessel der Workflow-/Inspektionsschreiber (gleiches Format wie in der Leseprojektion).
const repairWorkflowEventKey = (workflowId, transition, at) =>
  `repairwf:${toIdString(workflowId)}:${transition}:${at ? new Date(at).getTime() : 0}`;
const inspectionEventKey = (kind, inspectionId) => `inspection-${kind}:${toIdString(inspectionId)}`;

// ---------------------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------------------

// Gemeinsames Geldformat (server/utils/money.js); kein Betrag -> '–' statt "0,00 €".
const formatEuroDe = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '–';
  return money.formatEuroDe(number);
};

let dateFormatter = null;
const formatDateTimeDe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    if (!dateFormatter) {
      dateFormatter = new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    }
    return dateFormatter.format(date);
  } catch (error) {
    return date.toISOString();
  }
};

const isoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const MONEY_FIELD = /(^|\.)(totalCost|price|priceAtOrder|amount|discount|total)$/i;

const formatChangeValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '–';
  if (field === 'status') return statusLabelDe(value);
  if (MONEY_FIELD.test(field) && Number.isFinite(Number(value))) return formatEuroDe(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ') : '–';
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Statuswechsel eines Eintrags (neu: changes; alt: Schluessel oder englischer Text).
const statusChangeOf = (e) => {
  if (!e) return null;
  const change = Array.isArray(e.changes) ? e.changes.find((item) => item && item.field === 'status') : null;
  if (change) return { from: change.from || null, to: change.to || null };
  const meta = metaFor(e.status);
  if (meta?.statusTo) {
    const parsed = String(e.description || '').match(/from ([a-z-]+) to ([a-z-]+)/i);
    return { from: parsed ? parsed[1] : null, to: meta.statusTo };
  }
  if (meta?.dynamic === 'booking-status') {
    return { from: null, to: String(e.status).slice('status changed to '.length).trim() };
  }
  if (normalizeKey(e.status) === 'order status updated') {
    const parsed = String(e.description || '').match(/(?:order )?status changed from ([a-z-]+) to ([a-z-]+)/i);
    if (parsed) return { from: parsed[1], to: parsed[2] };
  }
  return null;
};

const titleFor = (e) => {
  const meta = metaFor(e?.status);
  if (meta?.dynamic === 'shipping-status') {
    const raw = String(e.status);
    const value = raw.slice(raw.indexOf(':') + 1).trim();
    return `Versandstatus: ${SHIPPING_STATUS_LABELS_DE[value] || value}`;
  }
  if (meta?.label) return meta.label;
  return String(e?.status || 'Eintrag');
};

const workflowStatusDe = (value) => WORKFLOW_STATUS_LABELS_DE[String(value || '')] || String(value || '–');

// Bekannte englische Alttexte -> deutsch (nur Anzeige; gespeichert wird nichts).
const LEGACY_DESCRIPTION_RULES = [
  [/^Status changed from ([a-z-]+) to ([a-z-]+)$/i, (m) => `Status geändert: ${statusLabelDe(m[1])} → ${statusLabelDe(m[2])}`],
  [/^Order status changed from ([a-z-]+) to ([a-z-]+) due to workflow status update$/i,
    (m) => `Status geändert: ${statusLabelDe(m[1])} → ${statusLabelDe(m[2])} (durch Workflow-Änderung)`],
  [/^Order placed by customer$/i, () => 'Auftrag vom Kunden aufgegeben'],
  [/^Device inspection has been initiated by technician$/i, () => 'Eingangsprüfung durch Techniker gestartet'],
  [/^Assigned to: (.*)$/i, (m) => `Zugewiesen an: ${m[1]}`],
  [/^Workflow "(.*)" started by (.*)$/i, (m) => `Workflow „${m[1]}“ gestartet von ${m[2]}`],
  [/^Order status updated to "Repair in Progress" and assigned to (.*) upon workflow initiation$/i,
    (m) => `Reparatur begonnen (Workflow gestartet), zugewiesen an ${m[1]}`],
  [/^Step "(.*)" completed in workflow "(.*)" \(actual (\d+) min vs estimated (\d+) min\)$/i,
    (m) => `Schritt „${m[1]}“ im Workflow „${m[2]}“ abgeschlossen (tatsächlich ${m[3]} Min., geplant ${m[4]} Min.)`],
  [/^Step "(.*)" completed in workflow "(.*)" \(actual (\d+) min\)$/i,
    (m) => `Schritt „${m[1]}“ im Workflow „${m[2]}“ abgeschlossen (tatsächlich ${m[3]} Min.)`],
  [/^Step "(.*)" skipped in workflow "(.*)"\. Reason: (.*)$/i,
    (m) => `Schritt „${m[1]}“ im Workflow „${m[2]}“ übersprungen. Grund: ${m[3] === 'Not provided' ? 'nicht angegeben' : m[3]}`],
  [/^Workflow "(.*)" status changed from ([a-z-]+) to ([a-z-]+)(?: - Reason: (.*))?$/i,
    (m) => `Workflow „${m[1]}“: ${workflowStatusDe(m[2])} → ${workflowStatusDe(m[3])}${m[4] ? `. Grund: ${m[4]}` : ''}`],
  [/^Workflow "(.*)" removed from order$/i, (m) => `Workflow „${m[1]}“ entfernt`],
  [/^Device changed from (.*) to (.*)$/i, (m) => `Gerät geändert: ${m[1]} → ${m[2]}`],
];

const descriptionDe = (e) => {
  const text = String(e?.description || '').trim();
  if (!text) return '';
  if (e.type) return text; // neue Eintraege werden deutsch geschrieben
  for (const [pattern, render] of LEGACY_DESCRIPTION_RULES) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return text;
};

const effectiveType = (e) => (TYPES.includes(e?.type) ? e.type : (metaFor(e?.status)?.type || 'note'));

const DEFAULT_SOURCES = {
  shipping: 'Versand',
  workflow: 'Workflow',
  inspection: 'Prüfung',
};

const isCustomerVisible = (e) => {
  if (!e) return false;
  if (e.visibility === 'staff') return false;
  if (e.visibility === 'customer') return true;
  return Boolean(metaFor(e.status)?.customer);
};

const linkFor = (e, { orderId } = {}) => {
  const refs = e?.refs || {};
  if (refs.paymentId && e?.type === 'payment') {
    return { kind: 'payment', id: String(refs.paymentId), label: 'Zahlung anzeigen', href: null, apiUrl: null };
  }
  if (refs.invoiceId) {
    return { kind: 'invoice', id: String(refs.invoiceId), label: 'Rechnung öffnen', href: null, apiUrl: `/api/invoices/${refs.invoiceId}/pdf` };
  }
  if (refs.paymentId) return { kind: 'payment', id: String(refs.paymentId), label: 'Zahlung anzeigen', href: null, apiUrl: null };
  if (refs.inspectionId && orderId) {
    return { kind: 'inspection', id: String(refs.inspectionId), label: 'Prüfbericht öffnen', href: `/inspection/${orderId}`, apiUrl: null };
  }
  if (refs.revisionId) {
    return {
      kind: 'revision',
      id: String(refs.revisionId),
      label: refs.revisionNumber ? `Änderungsbeleg #${refs.revisionNumber}` : 'Änderungsbeleg',
      href: null,
      apiUrl: orderId ? `/api/orders/${orderId}/revisions` : null,
    };
  }
  if (refs.communicationId && orderId) {
    return { kind: 'communication', id: String(refs.communicationId), label: 'Konversation öffnen', href: `/orders/${orderId}#order-communication`, apiUrl: null };
  }
  if (refs.trackingNumber) {
    return { kind: 'tracking', id: String(refs.trackingNumber), label: 'Sendung verfolgen', href: null, apiUrl: orderId ? `/api/orders/${orderId}/shipments` : null };
  }
  return null;
};

/**
 * Personalsicht eines Eintrags (GET /api/orders/:id/history fuer staff/admin).
 */
const toView = (e, { orderId, origin = 'timeline' } = {}) => {
  const type = effectiveType(e);
  const at = isoOrNull(e?.completedAt || e?.at);
  const changes = (Array.isArray(e?.changes) ? e.changes : []).map((change) => ({
    field: change.field,
    label: change.label || change.field,
    from: change.from === undefined ? null : change.from,
    to: change.to === undefined ? null : change.to,
    fromText: formatChangeValue(change.field, change.from),
    toText: formatChangeValue(change.field, change.to),
  }));
  const statusChange = statusChangeOf(e);
  if (!changes.some((change) => change.field === 'status') && statusChange && statusChange.to && type === 'status') {
    changes.push({
      field: 'status',
      label: 'Auftragsstatus',
      from: statusChange.from,
      to: statusChange.to,
      fromText: statusChange.from ? statusLabelDe(statusChange.from) : '–',
      toText: statusLabelDe(statusChange.to),
    });
  }
  const refs = e?.refs && typeof e.refs === 'object' ? plainValue(typeof e.refs.toObject === 'function' ? e.refs.toObject() : e.refs) : null;
  return {
    id: toIdString(e?._id) || (e?.eventKey ? `evt:${e.eventKey}` : ''),
    at,
    timeKnown: Boolean(at),
    timeNote: at ? null : 'Zeitpunkt nicht erfasst',
    key: String(e?.status || ''),
    type,
    typeLabel: TYPE_LABELS[type] || type,
    title: titleFor(e),
    description: descriptionDe(e),
    actor: {
      id: e?.staffId && e.staffId !== 'system' ? String(e.staffId) : null,
      name: e?.staffName || 'System',
    },
    source: e?.source || DEFAULT_SOURCES[type] || (e?.staffId && e.staffId !== 'system' ? 'Personal' : 'System'),
    changes,
    reason: e?.reason || null,
    refs: refs && Object.keys(refs).length ? refs : null,
    link: linkFor(e, { orderId }),
    visibility: isCustomerVisible(e) ? 'customer' : 'staff',
    eventKey: e?.eventKey || null,
    origin,
    photos: Array.isArray(e?.photos) && e.photos.length ? e.photos : undefined,
  };
};

// Kundensicht eines Eintrags: nur Titel, neutraler Text und Zeitpunkt.
const CUSTOMER_TEXTS = {
  'order received': 'Ihr Auftrag ist bei uns eingegangen.',
  'pickup confirmed': 'Die Abholung Ihres Geräts wurde bestätigt.',
  // Neutral: in Booking.timeline kann dieser Schluessel auch das Einsendelabel meinen.
  'shipping label created': 'Ein DHL-Versandlabel wurde erstellt.',
  'inbound label created': 'Ihr DHL-Einsendelabel wurde erstellt.',
  'booking inbound label created': 'Ihr DHL-Einsendelabel wurde erstellt.',
  'return label created': 'Ihr DHL-Einsendelabel wurde erstellt.',
  'shipping label prepared': 'Ihr DHL-Einsendelabel wird vorbereitet.',
  'order ready': 'Die Reparatur ist abgeschlossen.',
  'repair workflow completed': 'Die Reparatur ist abgeschlossen.',
  'booking created': 'Ihre Buchung ist bei uns eingegangen.',
};

const toCustomerEntry = (e) => {
  const meta = metaFor(e.status);
  const key = normalizeKey(e.status);
  const statusChange = statusChangeOf(e);
  const isStatusEntry = meta?.customer === 'status' || (e.type === 'status' && statusChange);
  let title = key === 'shipping label created' ? 'Versandlabel erstellt' : titleFor(e);
  let description = CUSTOMER_TEXTS[key] || '';
  if (isStatusEntry) {
    title = 'Status geändert';
    description = statusChange?.to ? `Neuer Status: ${statusLabelDe(statusChange.to)}` : '';
  }
  return {
    _id: toIdString(e._id) || undefined,
    status: String(e.status || ''),
    title,
    description,
    completedAt: isoOrNull(e.completedAt),
    type: effectiveType(e),
  };
};

/**
 * Kunden-/Gastprojektion eines Verlaufs (Positivliste). Nie: staffId, staffName, reason,
 * changes, refs, interne Beschreibungen.
 */
const toCustomerView = (timeline) => (Array.isArray(timeline) ? timeline : [])
  .filter((e) => e && isCustomerVisible(e))
  .map(toCustomerEntry);

// Interne Auftragsfelder, die Gaeste nie erhalten (Arbeitsplanung, Bearbeitungsstand, Sperren).
const GUEST_INTERNAL_ORDER_FIELDS = [
  'staffNotes', 'eParts', 'ePartNeedListEntries', 'workflows', 'assignedStaff',
  'pricingConditions', 'revisionCount', 'editRevision', 'shippingLabelCreationInProgress',
  'unlockPattern', 'unlockCode',
];

/**
 * Personalbezogene Auftragsfelder fuer Kunden und Gaeste (HIST-15/K04) als Ueberschreibungen
 * zum Einmischen ({ ...order, ...customerOrderOverrides(order) } oder Object.assign):
 *   pickupConfirmation -> nur { confirmedAt } (kein Mitarbeitername/-ID)
 *   unlockConfirmation -> nur { confirmationStatus, confirmedAt } (keine interne Pruefnotiz,
 *                         kein Name); Gaeste erhalten sie gar nicht
 *   addOns[].assignedStaff entfernt
 *   Gaeste zusaetzlich: GUEST_INTERNAL_ORDER_FIELDS entfernt.
 * undefined-Werte fallen bei JSON-Ausgabe weg.
 */
const customerOrderOverrides = (order, { guest = false } = {}) => {
  const overrides = {};
  if (!order || typeof order !== 'object') return overrides;
  if (order.pickupConfirmation !== undefined) {
    overrides.pickupConfirmation = order.pickupConfirmation?.confirmedAt
      ? { confirmedAt: order.pickupConfirmation.confirmedAt }
      : undefined;
  }
  if (order.unlockConfirmation !== undefined) {
    overrides.unlockConfirmation = !guest && order.unlockConfirmation?.confirmationStatus
      ? {
        confirmationStatus: order.unlockConfirmation.confirmationStatus,
        confirmedAt: order.unlockConfirmation.confirmedAt || null,
      }
      : undefined;
  }
  if (Array.isArray(order.addOns)) {
    overrides.addOns = order.addOns.map((addon) => {
      if (!addon || typeof addon !== 'object') return addon;
      const plain = typeof addon.toObject === 'function' ? addon.toObject() : addon;
      const { assignedStaff, ...rest } = plain;
      return rest;
    });
  }
  if (guest) {
    GUEST_INTERNAL_ORDER_FIELDS.forEach((field) => { overrides[field] = undefined; });
  }
  return overrides;
};

// ---------------------------------------------------------------------------------------
// Meilensteine (ehrliche Projektion, HIST-1)
// ---------------------------------------------------------------------------------------

const STAGES = [
  { id: 'order-received', label: 'Auftrag erhalten' },
  { id: 'diagnostic', label: 'Eingangsprüfung' },
  { id: 'repair', label: 'Reparatur' },
  { id: 'quality-check', label: 'Qualitätsprüfung' },
  { id: 'pickup', label: 'Reparatur abgeschlossen' },
  { id: 'return', label: 'Rückgabe' },
];

const STATUS_TO_STAGE = {
  'diagnostic-assessment': 'diagnostic',
  'in-progress': 'repair',
  'quality-check': 'quality-check',
  'ready-for-pickup': 'pickup',
  completed: 'pickup',
};

const KEY_TO_STAGES = {
  'inspection started': ['diagnostic'],
  'inspection completed': ['diagnostic'],
  'workflow started': ['repair'],
  'repair workflow started': ['repair'],
  'repair in progress': ['repair'],
  'order ready': ['pickup'],
  'repair workflow completed': ['pickup'],
  'pickup confirmed': ['return'],
};

const stagesOfEntry = (e) => {
  const stages = new Set(KEY_TO_STAGES[normalizeKey(e?.status)] || []);
  const change = statusChangeOf(e);
  if (change?.to && STATUS_TO_STAGE[change.to]) stages.add(STATUS_TO_STAGE[change.to]);
  return [...stages];
};

const isDeliveredEntry = (e) => {
  const key = normalizeKey(e?.status);
  return key === 'versandstatus: zugestellt' || key === 'shipping status: delivered';
};

/**
 * Meilensteine aus echten Ereignissen.
 * Rueckgabe { stages, currentStage, orderStatus, progress, paused, cancelled }; je Stufe:
 *   { id, label, state: 'reached'|'current'|'skipped'|'pending',
 *     status (Altfeld: reached->'completed', current->'in-progress', skipped->'skipped', pending->'pending'),
 *     reachedAt (ISO|null), timeKnown, date (de-DE 'TT.MM.JJJJ, HH:MM' | null), detail|null,
 *     note|null ('Zeitpunkt nicht erfasst' | 'Übersprungen – nicht erfasst'),
 *     actorName|null + sourceEntryId|null (nur Personalsicht) }
 */
const buildMilestones = (order, { forCustomer = false } = {}) => {
  const timeline = (Array.isArray(order?.timeline) ? order.timeline : []).filter(Boolean);
  const events = {};
  const remember = (stageId, e, at, actorName, detail) => {
    const ts = at ? new Date(at).getTime() : NaN;
    const existing = events[stageId];
    if (!existing) {
      events[stageId] = { at: Number.isFinite(ts) ? new Date(ts) : null, actorName, entryId: toIdString(e?._id) || null, detail };
      return;
    }
    // fruehestes Ereignis mit Zeitpunkt gewinnt
    if (Number.isFinite(ts) && (!existing.at || ts < existing.at.getTime())) {
      events[stageId] = { at: new Date(ts), actorName, entryId: toIdString(e?._id) || null, detail: detail || existing.detail };
    }
  };

  remember('order-received', null, order?.createdAt, null, null);
  let shippingStarted = null;
  timeline.forEach((e) => {
    stagesOfEntry(e).forEach((stageId) => remember(stageId, e, e.completedAt, e.staffName || null, null));
    const key = normalizeKey(e.status);
    if (key === 'shipping label created' && !shippingStarted) shippingStarted = e;
    if (isDeliveredEntry(e)) remember('return', e, e.completedAt, null, 'Zugestellt');
  });
  if (order?.pickupConfirmation?.confirmedAt) {
    remember('return', null, order.pickupConfirmation.confirmedAt, order.pickupConfirmation.confirmedByName || null, 'Abgeholt');
  }
  if (events.return && !events.return.detail) events.return.detail = 'Abgeholt';

  const status = String(order?.status || 'pending');
  // Rueckgabe ohne Abholung/Zustellereignis: eine erfasste Zustellung am Auftrag (actualDelivery)
  // oder - bei abgeschlossenem Auftrag - das erstellte Versandlabel an den Kunden ist das echte
  // Ereignis (statt "Übersprungen"). Bei 'ready-for-pickup' bleibt die Rueckgabe aktuell.
  if (!events.return && order?.actualDelivery) {
    remember('return', null, order.actualDelivery, null, 'Zugestellt');
  }
  if (!events.return && shippingStarted && status !== 'ready-for-pickup') {
    remember('return', shippingStarted, shippingStarted.completedAt, shippingStarted.staffName || null, 'Versandlabel erstellt');
  }
  const indexOf = (id) => STAGES.findIndex((stage) => stage.id === id);
  let currentId = null;
  let paused = false;
  const cancelled = status === 'cancelled';
  if (status === 'pending') currentId = 'order-received';
  else if (status === 'diagnostic-assessment') currentId = 'diagnostic';
  else if (status === 'in-progress') currentId = 'repair';
  else if (status === 'quality-check') currentId = 'quality-check';
  else if (status === 'ready-for-pickup') currentId = events.return ? null : 'return';
  else if (status === 'paused') {
    paused = true;
    // Aktuelle Stufe = letzte Stufe mit echtem Ereignis; ohne Ereignis 'Auftrag erhalten'
    // (keine erfundene Reparaturstufe).
    currentId = ['quality-check', 'repair', 'diagnostic'].find((id) => events[id]) || 'order-received';
  }
  // completed: alle Stufen liegen davor (keine aktuelle Stufe).
  // cancelled: keine aktuelle Stufe; offene Stufen bleiben offen.
  let currentIndex;
  if (currentId) currentIndex = indexOf(currentId);
  else if (status === 'completed' || (status === 'ready-for-pickup' && events.return)) currentIndex = STAGES.length;
  else if (cancelled) {
    currentIndex = -1;
    STAGES.forEach((stage, index) => { if (events[stage.id]) currentIndex = index; });
    currentIndex += 1; // Stufen vor der letzten erreichten gelten als uebersprungen
  } else currentIndex = 0;

  const stages = STAGES.map((stage, index) => {
    const event = events[stage.id] || null;
    let state;
    if (stage.id === currentId) state = 'current';
    else if (index < currentIndex) state = event ? 'reached' : 'skipped';
    else state = 'pending';
    if (state === 'pending' && stage.id === 'order-received') state = 'reached';

    const showEvent = state === 'reached' || state === 'current';
    const reachedAt = showEvent && event?.at ? event.at.toISOString() : null;
    let detail = showEvent ? (event?.detail || null) : null;
    if (state === 'current') {
      if (paused) detail = 'Pausiert';
      else if (stage.id === 'return') detail = shippingStarted ? 'Versandlabel erstellt' : 'Bereit zur Rückgabe';
    }
    let note = null;
    if (state === 'skipped') note = 'Übersprungen – nicht erfasst';
    else if (showEvent && !reachedAt && (state === 'reached' || event)) note = 'Zeitpunkt nicht erfasst';
    else if (state === 'current' && !event && stage.id !== 'return') note = 'Zeitpunkt nicht erfasst';

    const view = {
      id: stage.id,
      label: stage.label,
      state,
      status: { reached: 'completed', current: 'in-progress', skipped: 'skipped', pending: 'pending' }[state],
      reachedAt,
      timeKnown: Boolean(reachedAt),
      date: reachedAt ? formatDateTimeDe(reachedAt) : null,
      detail,
      note,
    };
    if (!forCustomer) {
      view.actorName = showEvent ? (event?.actorName || null) : null;
      view.sourceEntryId = showEvent ? (event?.entryId || null) : null;
    }
    return view;
  });

  let currentStage = currentId;
  if (!currentStage) {
    const lastReached = [...stages].reverse().find((stage) => stage.state === 'reached');
    currentStage = lastReached ? lastReached.id : 'order-received';
  }

  return {
    stages,
    currentStage,
    orderStatus: status,
    progress: Number(order?.progress || 0),
    paused,
    cancelled,
  };
};

/**
 * Kunde hat Entsperrdaten nachgereicht (HIST-13): setzt den Auftrag fort, wenn die LETZTE
 * Statusaenderung die Pause 'Order Paused For Customer' war und der Auftrag noch pausiert ist.
 * Mutiert das Dokument (Aufrufer speichert); Rueckgabe true, wenn fortgesetzt wurde.
 * Ziel-Status = Status vor der Pause (changes.from), sonst 'in-progress'.
 */
const resumeIfPausedForCustomer = (order, actor) => {
  if (!order || order.status !== 'paused') return false;
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const lastStatusEntry = [...timeline].reverse().find((e) => e && (effectiveType(e) === 'status'));
  if (!lastStatusEntry || normalizeKey(lastStatusEntry.status) !== 'order paused for customer') return false;
  const change = statusChangeOf(lastStatusEntry);
  const target = change?.from && change.from !== 'paused' ? change.from : 'in-progress';
  const e = entry({
    key: 'Order Resumed',
    type: 'status',
    description: `Auftrag fortgesetzt: Entsperrdaten vom Kunden aktualisiert (${statusLabelDe('paused')} → ${statusLabelDe(target)})`,
    actor,
    source: 'Kunde',
    changes: [{ field: 'status', label: 'Auftragsstatus', from: 'paused', to: target }],
    visibility: 'customer',
    eventKey: `unlock-resume:${toIdString(lastStatusEntry._id) || new Date(lastStatusEntry.completedAt || 0).getTime()}`,
  });
  if (!push(order, e)) return false;
  order.status = target;
  return true;
};

module.exports = {
  TYPES,
  TYPE_GROUPS,
  TYPE_LABELS,
  KEY_META,
  STATUS_LABELS_DE,
  STAGES,
  statusLabelDe,
  metaFor,
  normalizeActor,
  resolveActor,
  entry,
  push,
  hasEventKey,
  updateFor,
  labelActorFields,
  repairWorkflowEventKey,
  inspectionEventKey,
  statusChangeOf,
  titleFor,
  descriptionDe,
  effectiveType,
  isCustomerVisible,
  toView,
  toCustomerView,
  customerOrderOverrides,
  GUEST_INTERNAL_ORDER_FIELDS,
  buildMilestones,
  resumeIfPausedForCustomer,
  formatDateTimeDe,
  formatEuroDe,
};
