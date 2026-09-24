const mongoose = require('mongoose');

/**
 * Historie der versendeten Zahlungsaufforderungen.
 *
 * Bewusst ein eigenes Dokument (kein Sub-Dokument der Rechnung): eine
 * Zahlungsaufforderung gehoert zum VORGANG (Buchung) und kann auch ohne Rechnung
 * entstehen; ausserdem soll sie pro Buchung und global auflistbar sein.
 *
 * Wichtig zur Semantik von `status`:
 *   'accepted_by_provider' bedeutet, dass der Mailserver die Nachricht ANGENOMMEN
 *   hat. Das ist KEINE Zustellbestaetigung und darf in der UI auch nicht so
 *   dargestellt werden.
 */
const paymentRequestSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },
  bookingNumber: {
    type: String,
    default: '',
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
  },
  invoiceNumber: {
    type: String,
    default: '',
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  // Tatsaechlich angeforderter Betrag.
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Offener Betrag zum Zeitpunkt der Anforderung (Beleg fuer die Nachvollziehbarkeit).
  openBalanceAtRequest: {
    type: Number,
    default: 0,
    min: 0,
  },
  channel: {
    type: String,
    enum: ['email'],
    default: 'email',
  },
  recipientEmail: {
    type: String,
    default: '',
  },
  recipientName: {
    type: String,
    default: '',
  },
  note: {
    type: String,
    default: '',
  },
  // Wurde der freie Hinweistext tatsaechlich mitgesendet? Die derzeit verwendete
  // Vorlage kennt keinen Platzhalter dafuer - das wird hier ehrlich festgehalten
  // statt dem Bearbeiter einen Versand vorzuspiegeln.
  noteDelivered: {
    type: Boolean,
    default: false,
  },
  templateName: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted_by_provider', 'failed', 'skipped_no_recipient'],
    default: 'pending',
    index: true,
  },
  providerMessageId: {
    type: String,
    default: '',
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  error: {
    type: String,
    default: '',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  requestedByName: {
    type: String,
    default: '',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  // Wiederholter Versand legt IMMER eine neue Zeile an und verweist auf das Original.
  resendOfId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentRequest',
  },
}, {
  timestamps: true,
  versionKey: false,
});

paymentRequestSchema.index({ bookingId: 1, requestedAt: -1 });
paymentRequestSchema.index({ invoiceId: 1, requestedAt: -1 });

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
