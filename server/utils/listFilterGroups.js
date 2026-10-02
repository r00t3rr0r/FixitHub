/**
 * Filtergruppen der Admin-Listen, die das Dashboard verlinkt (ORD-4).
 *
 * EINE Regel je Gruppe: die Listen-Route (Filter) und der Dashboard-Zaehler
 * (server/routes/adminDashboardRoutes.js getDashboardKpis) bauen ihre Abfrage aus DIESEN
 * Funktionen. Dadurch ist die Dashboard-Zahl immer gleich der Gesamtzahl der gefilterten Liste.
 *
 * Reklamationen (GET /api/complaints):
 *   status=offen            -> alle offenen Status (COMPLAINT_OPEN_STATUSES)
 *   status=a,b              -> einer der genannten Status
 *   priority=high-urgent    -> Priorität hoch oder dringend
 * EPart-Bestellungen (GET /api/epart-orders):
 *   status=aktiv            -> nicht erhalten und nicht storniert
 *   status=ausstehend       -> Entwurf, offen oder bestellt (noch nicht versendet)
 *   status=verzoegert       -> aktiv und erwartetes Lieferdatum überschritten
 * Alle Werte werden als Text gelesen (kein Objekt aus der Query, keine Operator-Injektion).
 */

const COMPLAINT_OPEN_STATUSES = ['pending_approval', 'approved', 'acknowledged', 'new_repair', 'open', 'in-progress', 'pending-customer'];
const COMPLAINT_URGENT_PRIORITIES = ['high', 'urgent'];

const EPART_CLOSED_STATUSES = ['received', 'cancelled'];
const EPART_PENDING_STATUSES = ['draft', 'pending', 'confirmed'];
const EPART_GROUPS = ['aktiv', 'ausstehend', 'verzoegert'];

const asText = (value) => (Array.isArray(value) || (value && typeof value === 'object') ? '' : String(value ?? '').trim());

const splitList = (value) => asText(value).split(',').map((part) => part.trim()).filter(Boolean);

/** Bedingung fuer Complaint.status oder undefined (kein Filter). */
function complaintStatusClause(status) {
  const text = asText(status);
  if (!text || text === 'all') return undefined;
  if (text === 'offen') return { $in: COMPLAINT_OPEN_STATUSES };
  const values = splitList(text);
  return values.length > 1 ? { $in: values } : values[0];
}

/** Bedingung fuer Complaint.priority oder undefined. */
function complaintPriorityClause(priority) {
  const text = asText(priority);
  if (!text || text === 'all') return undefined;
  if (text === 'high-urgent') return { $in: COMPLAINT_URGENT_PRIORITIES };
  const values = splitList(text);
  return values.length > 1 ? { $in: values } : values[0];
}

/** Statusfilter einer EPart-Liste auf die Abfrage anwenden (mutiert query). */
function applyEPartStatusFilter(query, status, now = new Date()) {
  const text = asText(status);
  if (!text || text === 'all') return query;
  if (text === 'aktiv') {
    query.status = { $nin: EPART_CLOSED_STATUSES };
  } else if (text === 'ausstehend') {
    query.status = { $in: EPART_PENDING_STATUSES };
  } else if (text === 'verzoegert') {
    query.status = { $nin: EPART_CLOSED_STATUSES };
    query.expectedDeliveryDate = { $lt: now };
  } else {
    query.status = text;
  }
  return query;
}

module.exports = {
  COMPLAINT_OPEN_STATUSES,
  COMPLAINT_URGENT_PRIORITIES,
  EPART_CLOSED_STATUSES,
  EPART_PENDING_STATUSES,
  EPART_GROUPS,
  complaintStatusClause,
  complaintPriorityClause,
  applyEPartStatusFilter,
};
