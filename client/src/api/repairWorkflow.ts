import api from './api';
import { readyCustomerMessage, type ReturnMethod } from '../lib/returnMethod';

export type RepairWorkflowStatus = 'pending-confirmation' | 'in-progress' | 'paused' | 'completed' | 'incident';

// Ergebnis einer ausdruecklichen Kundenbenachrichtigung (In-App + E-Mail) - getrennt vom Speichererfolg.
export interface RepairCustomerNotification {
  status: 'sent' | 'failed' | 'skipped' | 'duplicate';
  reason?: string; // z. B. 'no_contact' | 'no_customer_account' (Altwert) | 'order_cancelled' | 'preferences' | 'not_requested' | 'already_sent'
  error?: string;
  inApp?: boolean;
  email?: string;
  message?: string;
  at?: string;
}

export interface RepairWorkflow {
  _id: string;
  orderId: string | { _id: string; orderNumber: string };
  customerId?: string | { _id: string; name: string; email: string };
  technicianId?: string | { _id: string; name: string; email: string };
  inspectionId?: string;
  status: RepairWorkflowStatus;
  approvalData?: {
    internalNotes?: string;
    orderChanges?: unknown;
    notifyCustomer?: boolean;
    customerMessage?: string;
    customerNotification?: RepairCustomerNotification;
    approvedAt?: string;
    approvedByTechnicianId?: string;
    approvedByTechnicianName?: string;
  };
  timerData?: {
    startedAt?: string;
    pausedAt?: string;
    resumedAt?: string;
    completedAt?: string;
    currentPauseReason?: string;
    currentPausedByTechnicianName?: string;
    totalPausedMs?: number;
    totalWorkMs?: number;
    pauseHistory?: Array<{
      pausedAt?: string;
      resumedAt?: string;
      durationMs?: number;
      reason?: string;
      pausedByTechnicianName?: string;
      resumedByTechnicianName?: string;
    }>;
  };
  incidents?: Array<{
    _id?: string;
    type: string;
    status?: 'reported' | 'escalated' | 'resolved';
    reason?: string;
    notes?: string;
    timestamp: string;
    emailSentAt?: string;
    customerNotification?: RepairCustomerNotification;
    reportedByTechnicianName?: string;
    resolvedAt?: string;
    resolvedByTechnicianName?: string;
    resolutionNote?: string;
  }>;
  reopenHistory?: Array<{ reopenedAt?: string; reason?: string; technicianName?: string; gapMs?: number }>;
  completionNotification?: RepairCustomerNotification;
  lastStatusChangeAt?: string;
  metadata?: {
    elapsedTimeMs?: number;
    completedByTechnicianName?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Antwort aller Zustandswechsel (POST approve/pause/resume/complete/incidents/reopen/sync-order):
 * orderStatus = Auftragsstatus nach dem Abgleich, warnings = deutsche Hinweise (Auftragsstatus nicht
 * aktualisiert, Kunde nicht benachrichtigt ...), customerNotification = Ergebnis der Benachrichtigung.
 */
export interface RepairTransitionResult {
  success: boolean;
  workflow: RepairWorkflow;
  message?: string;
  orderStatus?: string | null;
  orderStatusChanged?: boolean;
  warnings: string[];
  customerNotification?: RepairCustomerNotification;
}

// Deutsche Servermeldung bevorzugen (data.message / data.error), sonst die technische Meldung.
const toError = (error: any, fallback: string) =>
  new Error(error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback);

const post = async (url: string, body: Record<string, unknown> | undefined, fallback: string): Promise<RepairTransitionResult> => {
  try {
    const response = await api.post(url, body || {});
    const data = response?.data || {};
    return { ...data, warnings: Array.isArray(data.warnings) ? data.warnings : [] } as RepairTransitionResult;
  } catch (error: any) {
    throw toError(error, fallback);
  }
};

// Kundentexte (Vorschlag im Dialog). Dieselben Standardtexte nutzt der Server, wenn kein Text
// mitgeschickt wird (server/services/repairWorkflowService.js defaultCustomerMessage). Nie interne Notizen.
export const defaultRepairCustomerMessage = (
  kind: 'approve' | 'complete' | 'incident',
  order?: { orderNumber?: string; deviceBrand?: string; deviceModel?: string } | null,
  incidentType?: string,
  // Nur für 'complete': Rückgabeweg aus lib/returnMethod (Versand / Abholung / unbekannt = neutral).
  returnMethod: ReturnMethod = 'unknown'
) => {
  const device = [order?.deviceBrand, order?.deviceModel].filter(Boolean).join(' ').trim();
  const subject = `Ihres Geräts${device ? ` (${device})` : ''}${order?.orderNumber ? ` zu Auftrag ${order.orderNumber}` : ''}`;
  if (kind === 'approve') return `Die Reparatur ${subject} hat begonnen. Wir informieren Sie, sobald sie abgeschlossen ist.`;
  if (kind === 'complete') return readyCustomerMessage(returnMethod, subject);
  const texts: Record<string, string> = {
    defective_part: `Bei der Reparatur ${subject} wurde ein defektes Ersatzteil festgestellt. Wir beschaffen Ersatz; dadurch kann sich die Reparatur verzögern.`,
    spare_part_needed: `Für die Reparatur ${subject} wird ein zusätzliches Ersatzteil benötigt. Wir melden uns, sobald es eingetroffen ist.`,
    customer_info: `Wir haben eine Rückfrage zur Reparatur ${subject}. Bitte antworten Sie uns über die Nachrichten in Ihrem Kundenkonto.`,
    other_repair: `Bei der Reparatur ${subject} wurde ein weiterer Schaden festgestellt. Wir melden uns mit einem Vorschlag zum weiteren Vorgehen.`,
    technician_handover: `Die Reparatur ${subject} wird von einem anderen Techniker weitergeführt. Für Sie ändert sich nichts.`,
    needs_time: `Die Reparatur ${subject} benötigt etwas mehr Zeit als geplant. Wir informieren Sie, sobald sie abgeschlossen ist.`,
  };
  return texts[incidentType || ''] || `Es gibt eine neue Information zur Reparatur ${subject}.`;
};

/** Kurzer deutscher Text zum Benachrichtigungsergebnis (fuer Hinweise/Toasts). null = nichts anzuzeigen. */
export const describeCustomerNotification = (notification?: RepairCustomerNotification | null) => {
  if (!notification) return null;
  switch (notification.status) {
    case 'sent':
      if (notification.inApp === false && notification.email === 'sent') {
        return { tone: 'success' as const, title: 'Kunde wurde benachrichtigt', description: 'E-Mail an den Gastkunden gesendet (Gastauftrag ohne Kundenkonto).' };
      }
      return { tone: 'success' as const, title: 'Kunde wurde benachrichtigt', description: notification.email === 'sent' ? 'Benachrichtigung im Kundenkonto und E-Mail gesendet.' : 'Benachrichtigung im Kundenkonto erstellt.' };
    case 'duplicate':
      return { tone: 'info' as const, title: 'Kunde bereits benachrichtigt', description: 'Es wurde keine zweite Nachricht gesendet.' };
    case 'failed':
      // In-App-Zeile angekommen, nur die E-Mail scheiterte: ehrlich benennen; die Wiederholung sendet nur die E-Mail.
      if (notification.inApp === true && notification.email === 'failed') {
        return { tone: 'error' as const, title: 'E-Mail an den Kunden fehlgeschlagen', description: `Gespeichert und im Kundenkonto benachrichtigt, aber die E-Mail konnte nicht gesendet werden${notification.error ? `: ${notification.error}` : '.'} „Benachrichtigung erneut senden“ wiederholt nur die E-Mail.` };
      }
      return { tone: 'error' as const, title: 'Kunde wurde nicht benachrichtigt', description: `Gespeichert, aber die Nachricht konnte nicht gesendet werden${notification.error ? `: ${notification.error}` : '.'}` };
    case 'skipped':
      if (notification.reason === 'no_customer_account') {
        return { tone: 'warning' as const, title: 'Kunde wurde nicht benachrichtigt', description: 'Gastauftrag ohne Kundenkonto – bitte den Kunden auf anderem Weg informieren.' };
      }
      if (notification.reason === 'no_contact') {
        return { tone: 'warning' as const, title: 'Kunde wurde nicht benachrichtigt', description: 'Für diesen Gastauftrag ist keine E-Mail-Adresse hinterlegt – bitte den Kunden auf anderem Weg informieren.' };
      }
      if (notification.reason === 'order_cancelled') {
        return { tone: 'warning' as const, title: 'Kunde wurde nicht benachrichtigt', description: 'Der Auftrag ist storniert – es wurde keine Nachricht gesendet.' };
      }
      if (notification.reason === 'preferences') {
        return { tone: 'warning' as const, title: 'Kunde wurde nicht benachrichtigt', description: 'Der Kunde hat Benachrichtigungen abgeschaltet.' };
      }
      return null;
    default:
      return null;
  }
};

export const initializeRepairWorkflow = async (orderId: string, customerId?: string, inspectionId?: string) => {
  return api.post(`/api/repair-workflows/${orderId}/init`, {
    customerId,
    inspectionId,
  });
};

export const getRepairWorkflow = async (orderId: string) => {
  try {
    const response = await api.get(`/api/repair-workflows/${orderId}`);
    return response.data;
  } catch (error: any) {
    // If 404, no repair workflow exists yet (return null instead of error)
    if (error?.response?.status === 404) {
      return { workflow: null };
    }
    throw toError(error, 'Reparatur-Workflow konnte nicht geladen werden.');
  }
};

// Endpoint: POST /api/repair-workflows/:orderId/approve
// Request: { internalNotes (nur Team), orderChanges, notifyCustomer, customerMessage (Text an den Kunden) }
export const approveRepairStart = async (
  orderId: string,
  internalNotes: string,
  orderChanges: Record<string, unknown> | string | null,
  notifyCustomer: boolean,
  customerMessage?: string
) => post(`/api/repair-workflows/${orderId}/approve`, {
  internalNotes,
  orderChanges,
  notifyCustomer,
  customerMessage: notifyCustomer ? customerMessage : undefined,
}, 'Die Reparatur konnte nicht gestartet werden.');

export const pauseRepair = async (orderId: string, pauseReason?: string) =>
  post(`/api/repair-workflows/${orderId}/pause`, { pauseReason }, 'Die Reparatur konnte nicht pausiert werden.');

export const resumeRepair = async (orderId: string) =>
  post(`/api/repair-workflows/${orderId}/resume`, {}, 'Die Reparatur konnte nicht fortgesetzt werden.');

// Endpoint: POST /api/repair-workflows/:orderId/complete  { notifyCustomer?, customerMessage? }
export const completeRepair = async (orderId: string, options: { notifyCustomer?: boolean; customerMessage?: string } = {}) =>
  post(`/api/repair-workflows/${orderId}/complete`, {
    notifyCustomer: options.notifyCustomer === true,
    customerMessage: options.notifyCustomer ? options.customerMessage : undefined,
  }, 'Die Reparatur konnte nicht abgeschlossen werden.');

// Endpoint: POST /api/repair-workflows/:orderId/incidents
// Request: { incidentType, reason (intern), additionalData { notes (intern), ... }, notifyCustomer, customerMessage }
export const reportIncident = async (
  orderId: string,
  incidentType: string,
  reason: string,
  additionalData?: Record<string, unknown>,
  options: { notifyCustomer?: boolean; customerMessage?: string } = {}
) => post(`/api/repair-workflows/${orderId}/incidents`, {
  incidentType,
  reason,
  additionalData,
  notifyCustomer: options.notifyCustomer === true,
  customerMessage: options.notifyCustomer ? options.customerMessage : undefined,
}, 'Der Zwischenfall konnte nicht gemeldet werden.');

export const resolveRepairIncident = async (orderId: string, incidentId: string, note?: string) =>
  post(`/api/repair-workflows/${orderId}/incidents/${incidentId}/resolve`, { note }, 'Der Zwischenfall konnte nicht als erledigt markiert werden.');

// Endpoint: POST /api/repair-workflows/:orderId/reopen  { reason } - 409 sobald ein Versandlabel existiert
export const reopenRepair = async (orderId: string, reason: string) =>
  post(`/api/repair-workflows/${orderId}/reopen`, { reason }, 'Die Reparatur konnte nicht wieder aufgenommen werden.');

// Endpoint: POST /api/repair-workflows/:orderId/sync-order (Auftragsstatus erneut abgleichen, idempotent)
export const syncRepairOrder = async (orderId: string) =>
  post(`/api/repair-workflows/${orderId}/sync-order`, {}, 'Der Auftragsstatus konnte nicht abgeglichen werden.');

// Endpoint: POST /api/repair-workflows/:orderId/notify-customer { target, incidentId?, customerMessage? }
export const retryRepairCustomerNotification = async (
  orderId: string,
  target: 'approval' | 'completion' | 'incident',
  incidentId?: string,
  customerMessage?: string
) => post(`/api/repair-workflows/${orderId}/notify-customer`, { target, incidentId, customerMessage: customerMessage || undefined }, 'Die Benachrichtigung konnte nicht gesendet werden.');

export const getInactiveWorkflows = async (thresholdHours: number = 3) => {
  return api.get('/api/repair-workflows/admin/inactive', {
    params: {
      thresholdHours,
    },
  });
};
