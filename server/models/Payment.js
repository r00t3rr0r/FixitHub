const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  orderNumber: {
    type: String,
    default: ''
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerName: {
    type: String,
    default: ''
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  guestEmail: {
    type: String,
    default: ''
  },
  guestName: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer', 'invoice', 'sepa', 'cash', 'apple_pay', 'google_pay'],
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    default: () => `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  },
  paymentReference: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  allocatedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Idempotenzschluessel gegen Doppelbuchung. Wird entweder vom Aufrufer geliefert
  // oder serverseitig aus Vorgang + Betrag + Zahlart + Zeitfenster abgeleitet, damit
  // ein Doppelklick oder ein wiederholter Request keine zweite Zahlung erzeugt.
  idempotencyKey: {
    type: String,
    default: undefined
  },
  source: {
    type: String,
    enum: ['manual', 'gateway', 'checkout', 'paypal_import'],
    default: 'gateway'
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gatewayResponse: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  refundReason: {
    type: String
  },
  refundMode: {
    type: String,
    enum: ['gateway', 'manual']
  },
  refundGatewayProvider: {
    type: String,
    enum: ['stripe', 'paypal', 'square', 'authorize_net', 'manual']
  },
  refundGatewayReference: {
    type: String
  },
  // Einzelne Erstattungsvorgaenge. refundAmount ist die Summe der ABGESCHLOSSENEN
  // Eintraege; ein ausstehender oder fehlgeschlagener Eintrag zaehlt nie als erstattet.
  // idempotencyKey (Doppelklick/Retry) bzw. reference (Anbieter-Refund-ID, Webhook)
  // verhindern, dass derselbe Vorgang zweimal gebucht wird.
  refunds: [{
    idempotencyKey: { type: String },
    // PayPal-Request-Id dieses Versuchs. Eine Wiederholung DESSELBEN Versuchs sendet
    // dieselbe ID (PayPal erstattet dann nicht ein zweites Mal); ein neuer Versuch nach
    // endgueltiger Ablehnung bekommt eine neue.
    requestId: { type: String, default: '' },
    attempt: { type: Number, default: 1 },
    // true = PayPal hat nicht eindeutig geantwortet (Zeitueberschreitung/5xx). Der
    // Eintrag bleibt 'pending' und wird per Webhook oder Wiederholung abgeglichen.
    unresolved: { type: Boolean, default: false },
    lastCheckedAt: { type: Date },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
    mode: { type: String, enum: ['gateway', 'manual'] },
    provider: { type: String },
    reference: { type: String, default: '' },
    reason: { type: String, default: '' },
    error: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
  }],
  disputeReason: {
    type: String
  },
  disputeStatus: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate transaction ID if not provided
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  next();
});

// Populate customer and order info (only when customerId is present)
paymentSchema.pre(/^find/, function(next) {
  this.populate('orderId', 'orderNumber deviceBrand deviceModel');
  next();
});

// Index for efficient queries
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1, createdAt: -1 });
paymentSchema.index({ invoiceId: 1, createdAt: -1 });
paymentSchema.index({ guestEmail: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
// transactionId already has unique: true index, no need for duplicate
paymentSchema.index({ orderNumber: 1 });
// Sparse + unique: nur Dokumente MIT Schluessel werden auf Eindeutigkeit geprueft,
// Altbestand ohne das Feld bleibt unberuehrt. Dieser Index ist der eigentliche
// Doppelbuchungsschutz - er wirkt auch bei zwei gleichzeitigen Requests.
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
// Webhook-Zuordnung einer Anbieter-Erstattung zu ihrem Eintrag.
paymentSchema.index({ 'refunds.reference': 1 }, { sparse: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;