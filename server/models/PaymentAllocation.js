const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  allocatedAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  allocatedAt: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  },
  idempotencyKey: {
    type: String,
    default: undefined
  }
}, {
  timestamps: true,
  versionKey: false
});

// Zusammengesetzter Index fuer die Saldo-Berechnung (alle Zuordnungen einer Rechnung
// in Zuordnungsreihenfolge).
paymentAllocationSchema.index({ invoiceId: 1, allocatedAt: 1 });

// Idempotenzschluessel fuer maschinell erzeugte Zuordnungen (automatische
// Vorauszahlungs-Zuordnung, Webhook-Wiederholung). Bewusst SPARSE und nicht
// {paymentId, invoiceId}: mehrere Teilzuordnungen derselben Zahlung auf dieselbe
// Rechnung sind fachlich erlaubt, eine WIEDERHOLUNG desselben Vorgangs nicht.
paymentAllocationSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PaymentAllocation', paymentAllocationSchema);
