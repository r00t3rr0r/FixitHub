const mongoose = require('mongoose');

const pauseHistorySchema = new mongoose.Schema({
  pausedAt: Date,
  resumedAt: Date,
  durationMs: Number,
  reason: String,
  pausedByTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  pausedByTechnicianName: String,
  resumedByTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resumedByTechnicianName: String,
}, { _id: true });

// Ergebnis einer ausdruecklichen Kundenbenachrichtigung (In-App + E-Mail). Additiv, ohne Defaults.
const customerNotificationSchema = new mongoose.Schema({
  status: String,
  reason: String,
  error: String,
  message: String,
  inApp: Boolean,
  email: String,
  at: Date,
}, { _id: false });

// Wiederaufnahme eines abgeschlossenen Reparatur-Workflows (HIST-11). gapMs = Zeit zwischen
// Abschluss und Wiederaufnahme; sie zaehlt als Pausenzeit (totalPausedMs), nicht als Arbeitszeit.
const reopenSchema = new mongoose.Schema({
  reopenedAt: Date,
  previousCompletedAt: Date,
  gapMs: Number,
  reason: String,
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  technicianName: String,
}, { _id: true });

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['defective_part', 'spare_part_needed', 'customer_info', 'other_repair', 'technician_handover', 'needs_time'],
    required: true,
  },
  status: {
    type: String,
    enum: ['reported', 'escalated', 'resolved'],
    default: 'reported',
  },
  reason: String,
  notes: String,
  additionalData: mongoose.Schema.Types.Mixed,
  // Nur gesetzt, wenn die Kundenbenachrichtigung nachweislich zugestellt wurde
  // (EmailService meldet success). Bei customer_info ist das der Beginn von
  // "Warten auf Kundenrückmeldung".
  emailSentAt: Date,
  // Autorisierte Erledigung (z. B. telefonisch geklärt). Eine Kundenantwort im
  // Kommunikationsverlauf beendet das Warten ebenfalls, ohne dieses Feld zu setzen.
  resolvedAt: Date,
  resolvedByTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedByTechnicianName: String,
  resolutionNote: String,
  // Ergebnis der ausdruecklichen Kundenbenachrichtigung (NOTIF-5), getrennt vom Speichererfolg:
  // status 'sent' | 'failed' | 'skipped' | 'duplicate'; message = der an den Kunden gesendete Text.
  customerNotification: customerNotificationSchema,
  reportedByTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reportedByTechnicianName: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const repairWorkflowSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceInspection',
    required: false,
  },

  status: {
    type: String,
    enum: ['pending-confirmation', 'in-progress', 'paused', 'completed', 'incident'],
    default: 'pending-confirmation',
  },

  approvalData: {
    internalNotes: String,
    orderChanges: mongoose.Schema.Types.Mixed,
    notifyCustomer: {
      type: Boolean,
      default: false,
    },
    approvedAt: Date,
    approvedByTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedByTechnicianName: String,
    // Text an den Kunden (nie die internen Notizen) und Ergebnis der Benachrichtigung.
    customerMessage: String,
    customerNotification: customerNotificationSchema,
  },

  timerData: {
    startedAt: Date,
    pausedAt: Date,
    resumedAt: Date,
    completedAt: Date,
    currentPauseReason: String,
    currentPausedByTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    currentPausedByTechnicianName: String,
    totalPausedMs: {
      type: Number,
      default: 0,
    },
    totalWorkMs: {
      type: Number,
      default: 0,
    },
    pauseHistory: [pauseHistorySchema],
  },

  incidents: [incidentSchema],

  reopenHistory: [reopenSchema],

  // Benachrichtigung "Reparatur abgeschlossen" (ausdruecklich im Abschlussdialog gewaehlt).
  completionNotification: customerNotificationSchema,

  lastStatusChangeAt: {
    type: Date,
    default: Date.now,
  },

  metadata: {
    elapsedTimeMs: Number,
    completedByTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedByTechnicianName: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { versionKey: false });

repairWorkflowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

repairWorkflowSchema.index({ orderId: 1 });
repairWorkflowSchema.index({ technicianId: 1 });
repairWorkflowSchema.index({ customerId: 1 });
repairWorkflowSchema.index({ status: 1 });
repairWorkflowSchema.index({ lastStatusChangeAt: 1 });

module.exports = mongoose.model('RepairWorkflow', repairWorkflowSchema);
