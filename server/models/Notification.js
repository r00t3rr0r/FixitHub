const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['order_update', 'payment', 'message', 'system', 'assignment', 'reminder'],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  actionUrl: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Optionaler Ereignisschluessel gegen doppelte Benachrichtigungen (Doppelklick, Wiederholung,
  // zwei Erzeuger fuer dasselbe Ereignis). Eindeutig je Empfaenger ueber einen PARTIELLEN Index:
  // Benachrichtigungen ohne Schluessel (alle bisherigen) sind davon nicht betroffen.
  // Format: '<bereich>:<id>:<ereignis>', z. B. 'complaint:<id>:admin_approved'.
  dedupeKey: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  readAt: {
    type: Date
  }
}, {
  versionKey: false
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } }, name: 'userId_dedupeKey_partial_unique' }
);

const Notification = mongoose.model('Notification', notificationSchema);

// Dedupe-Anspruch fuer Benachrichtigungen, die OHNE In-App-Zeile verschickt werden (Empfaenger hat
// In-App abgeschaltet, nur E-Mail). Ohne diesen Eintrag gaebe es keine Zeile mit dem dedupeKey und
// jede Wiederholung wuerde die E-Mail erneut senden. Eindeutig je Empfaenger + Schluessel.
const notificationDedupeClaimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dedupeKey: { type: String, required: true },
  channel: { type: String, default: 'email' },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
notificationDedupeClaimSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });

const NotificationDedupeClaim = mongoose.models.NotificationDedupeClaim
  || mongoose.model('NotificationDedupeClaim', notificationDedupeClaimSchema);

module.exports = Notification;
module.exports.NotificationDedupeClaim = NotificationDedupeClaim;