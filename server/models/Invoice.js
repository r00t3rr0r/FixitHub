const mongoose = require('mongoose');
const CalculationHelper = require('../services/calculationHelper');
const DocumentSequence = require('./DocumentSequence');

const invoiceItemSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  unitGrossPrice: {
    type: Number
  },
  unitNetPrice: {
    type: Number
  },
  lineGrossTotal: {
    type: Number
  },
  lineNetTotal: {
    type: Number
  },
  taxRate: {
    type: Number,
    default: 19
  },
  total: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['service', 'addon', 'product', 'fee', 'discount'],
    required: true
  }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    immutable: true
  },
  // LEGACY: Altdokumente tragen hier ihr damaliges Präfix (z.B. 'VIP-', 'CN-').
  // Neue Dokumente setzen das Feld nicht mehr; die Nummer kommt ausschliesslich
  // aus DocumentSequence und ist nicht mehr vom Aufrufer beeinflussbar.
  numberPrefix: {
    type: String
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  repairOrderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  creditNoteOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  // Eingefrorene Nummer der Ursprungsrechnung, damit die Gutschrift ohne populate
  // auskommt (PDF, Export, Altdaten).
  creditNoteOfNumber: {
    type: String,
    default: ''
  },
  isCreditNote: {
    type: Boolean,
    default: false
  },
  correctionType: {
    type: String,
    enum: ['full_cancellation', 'partial_refund', 'price_adjustment', null],
    default: null
  },
  lockedAt: {
    type: Date
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  billingAddress: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    zip: {
      type: String,
      default: ''
    },
    zipCode: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    }
  },
  shippingAddress: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    zip: {
      type: String,
      default: ''
    },
    zipCode: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    }
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true
  },
  // Rechnungssumme-Konzept (Finale Basis für MwSt-Berechnung)
  invoiceGrossTotal: {
    type: Number
  },
  invoiceNetTotal: {
    type: Number
  },
  invoiceTaxTotal: {
    type: Number
  },
  taxRate: {
    type: Number,
    default: 19
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'],
    default: 'sent'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dunningLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  dunningStage: {
    type: String,
    enum: ['none', 'payment_reminder', 'dunning_notice', 'final_notice', 'collection'],
    default: 'none'
  },
  dunningNotifiedAt: {
    type: Date
  },
  originalDueDate: {
    type: Date
  },
  nextDunningDueDate: {
    type: Date
  },
  dunningHistory: [{
    stage: {
      type: String,
      enum: ['payment_reminder', 'dunning_notice', 'final_notice', 'collection'],
      required: true
    },
    executedAt: {
      type: Date,
      required: true
    },
    previousDueDate: Date,
    nextDueDate: Date,
    dunningRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DunningRun'
    },
    emailSentAt: Date,
    emailError: String
  }],
  dueDate: {
    type: Date,
    required: true
  },
  sentAt: {
    type: Date
  },
  approvedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'sepa', 'paypal', 'cash', null],
    default: null
  },
  cancelledAt: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  },
  template: {
    type: String,
    default: 'standard'
  },
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
  isReverseCharge: {
    type: Boolean,
    default: false
  },
  reverseChargeNotice: {
    type: String,
    default: 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge'
  },
  customerVatId: {
    type: String,
    default: '',
    trim: true
  },
  sellerVatId: {
    type: String,
    default: '',
    trim: true
  },
  zmRelevant: {
    type: Boolean,
    default: false
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

/**
 * Zentrale Summenberechnung - BRUTTO-FIRST.
 *
 * Alle Positionspreise (unitPrice/total) sind BRUTTO, also inkl. MwSt.
 *   netTotal   = bruttoNachRabatt / (1 + taxRate/100)
 *   taxTotal   = bruttoNachRabatt - netTotal        (MwSt wird herausgerechnet)
 *   grossTotal = netTotal + taxTotal
 * Der Rabatt wird genau einmal vom Brutto abgezogen und danach nie erneut vom Netto.
 *
 * Achtung: 'subtotal' ist der NETTO-Betrag, 'total' der BRUTTO-Betrag. Diese Namen
 * bleiben aus Kompatibilitätsgründen erhalten.
 *
 * Dieser Hook läuft bewusst auf 'validate' und nicht auf 'save': 'subtotal' und
 * 'total' sind required, und Mongoose validiert VOR den save-Hooks. Aufrufer
 * dürfen diese Felder daher weglassen.
 */
// Betragsrelevante Pfade. Nur ihre Aenderung darf eine Neuberechnung ausloesen.
const MONETARY_PATHS = ['items', 'total', 'subtotal', 'tax', 'discount', 'taxRate', 'isReverseCharge'];

invoiceSchema.pre('validate', function(next) {
  const monetaryTouched = MONETARY_PATHS.some((path) => this.isModified(path));

  // Unveraenderlichkeit (RECHNUNGSERSTELLUNG_SPEZIFIKATION.md, Abschnitt 3.2):
  // ein festgeschriebener Beleg (lockedAt) darf betragsrelevante Felder und Positionen
  // nicht mehr aendern. Ein Aenderungsversuch scheitert laut, statt still zu ueberschreiben.
  if (!this.isNew && this.lockedAt && !this.isModified('lockedAt') && monetaryTouched) {
    return next(new Error(
      'Diese Rechnung ist festgeschrieben und darf betragsmäßig nicht mehr geändert werden. '
      + 'Bitte erstellen Sie eine Gutschrift und stellen Sie eine neue Rechnung aus.'
    ));
  }

  // Bestandsbelege ohne betragsrelevante Aenderung bleiben unangetastet: ein Status-,
  // Mahn- oder Zahlungs-Update darf gespeicherte Betraege niemals neu ableiten.
  if (!this.isNew && !monetaryTouched) return next();

  const isReverseCharge = Boolean(this.isReverseCharge);
  if (isReverseCharge) {
    this.taxRate = 0;
    this.tax = 0;
    this.zmRelevant = true;
    if (!this.reverseChargeNotice) {
      this.reverseChargeNotice = 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge';
    }
  }

  const isCreditNote = Boolean(this.isCreditNote);
  // Rabatt wird immer als positiver Betrag gespeichert (Schema: min 0), auch bei Gutschriften.
  const discount = Number.isFinite(Number(this.discount)) ? Number(this.discount) : 0;
  // Der Steuersatz kommt ausschliesslich aus 'taxRate'. Er wird NIE aus einem mitgelieferten
  // (subtotal, tax, total)-Dreiklang zurueckgerechnet: die Betraege sind bereits auf zwei
  // Dezimalstellen gerundet, wodurch (tax/subtotal)*100 bei kleinen Summen 18,97-18,99 statt
  // 19 ergibt und der Beleg einen nicht existierenden Steuersatz ausweisen wuerde.
  // Aufrufer muessen den tatsaechlich gerechneten Satz setzen.
  const taxRate = isReverseCharge ? 0 : (Number.isFinite(Number(this.taxRate)) ? Number(this.taxRate) : 19);
  const taxDivisorForDocument = 1 + (taxRate / 100);

  // Beleg ohne Positionen (manuelle Sammelrechnung, Altbestand): die Betraege werden
  // aus dem gelieferten Brutto- bzw. Nettobetrag abgeleitet, statt an der
  // Pflichtfeldpruefung von 'total' zu scheitern.
  if (!this.items || this.items.length === 0) {
    let grossTotalWithoutItems = null;
    if (Number.isFinite(Number(this.total))) {
      grossTotalWithoutItems = CalculationHelper.round(Number(this.total));
    } else if (Number.isFinite(Number(this.subtotal))) {
      // 'subtotal' ist der NETTO-Betrag: Brutto aufschlagen und den Rabatt einmal abziehen.
      grossTotalWithoutItems = CalculationHelper.round(
        (Number(this.subtotal) * taxDivisorForDocument) - discount
      );
    }

    if (grossTotalWithoutItems === null) {
      return next(new Error(
        'Eine Rechnung benötigt mindestens eine Position oder einen Gesamtbetrag.'
      ));
    }

    if (!isCreditNote) grossTotalWithoutItems = Math.max(0, grossTotalWithoutItems);
    this.total = grossTotalWithoutItems;
    this.subtotal = CalculationHelper.round(grossTotalWithoutItems / taxDivisorForDocument);
    this.tax = isReverseCharge ? 0 : CalculationHelper.round(grossTotalWithoutItems - this.subtotal);
    this.invoiceGrossTotal = this.total;
    this.invoiceNetTotal = this.subtotal;
    this.invoiceTaxTotal = this.tax;
    return next();
  }

  const calculated = CalculationHelper.calculateInvoiceTotals(this.items, {
    taxRatePercent: taxRate,
    additionalDiscount: discount,
    isReverseCharge,
    allowNegative: isCreditNote
  });

  // Positions-Brutto/Netto werden immer neu abgeleitet, nie vom Aufrufer übernommen.
  // Der Positions-Steuersatz dagegen bleibt erhalten, wenn die Position einen eigenen
  // Satz mitbringt (echter Mischsatz-Beleg, Altdaten). Ueberschrieben wird er nur, wenn
  // die Position keinen eigenen Satz hat (Schema-Default) oder der Dokumentsatz eines
  // Bestandsbelegs bewusst geaendert wurde.
  // Hinweis: Netto/MwSt des Gesamtbelegs werden weiterhin mit dem Dokumentsatz
  // gerechnet; echte Mischsatz-Belege werden angezeigt, aber nicht je Satz summiert.
  const documentRateChanged = !this.isNew && this.isModified('taxRate');
  this.items.forEach((item, index) => {
    const calcItem = calculated.items[index];
    if (!calcItem) return;
    item.unitGrossPrice = calcItem.unitGrossPrice;
    item.unitNetPrice = calcItem.unitNetPrice;
    item.lineGrossTotal = calcItem.lineGrossTotal;
    item.lineNetTotal = calcItem.lineNetTotal;

    const hasOwnRate = Number.isFinite(Number(item.taxRate))
      && !(typeof item.$isDefault === 'function' && item.$isDefault('taxRate'));
    if (isReverseCharge) {
      item.taxRate = 0;
    } else if (hasOwnRate && !documentRateChanged) {
      item.taxRate = CalculationHelper.round(Number(item.taxRate));
    } else {
      item.taxRate = calcItem.taxRate;
    }
  });

  const hasExplicitTotal = Number.isFinite(Number(this.total));
  if (!hasExplicitTotal) {
    // Modus (a): kein Gesamtbetrag vorgegeben -> aus den Positionen ableiten.
    this.total = calculated.invoiceGrossTotal;
  }

  // Modus (b): ein vorgegebener Gesamtbetrag ist autoritatives BRUTTO (z.B. der
  // buchungsweite Auftragswert aus syncOrderAndBookingValue, der bei einem
  // Buchungsrabatt bewusst von der Positionssumme abweicht). Netto und MwSt werden
  // in beiden Fällen aus dem Brutto herausgerechnet; mitgelieferte subtotal/tax
  // Werte werden ignoriert.
  const grossTotal = CalculationHelper.round(this.total);
  const taxDivisor = taxDivisorForDocument;
  this.total = grossTotal;
  this.subtotal = CalculationHelper.round(grossTotal / taxDivisor);
  this.tax = isReverseCharge ? 0 : CalculationHelper.round(grossTotal - this.subtotal);

  this.invoiceGrossTotal = this.total;
  this.invoiceNetTotal = this.subtotal;
  this.invoiceTaxTotal = this.tax;

  next();
});

// Vergibt die Belegnummer atomar aus dem Nummernkreis (Rechnung / Gutschrift getrennt).
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const documentType = this.isCreditNote ? 'credit_note' : 'invoice';
    try {
      this.invoiceNumber = await DocumentSequence.allocateNumber(documentType, year);
    } catch (error) {
      // Bewusst kein Ersatzformat: lieber gar keine Rechnung als eine erfundene Nummer.
      return next(new Error(`Belegnummer konnte nicht vergeben werden: ${error.message}`));
    }
  }
  this.updatedAt = new Date();
  next();
});

// Populate customer and order info
invoiceSchema.pre(/^find/, function(next) {
  this.populate('customerId', 'customerNumber invoiceAddress paymentAddress addressAddition country company firstName lastName name email vatId')
      .populate('orderId', 'orderNumber deviceBrand deviceModel');
  next();
});

// Index for efficient queries
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ bookingId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
// Belegtyp-Filter der Listen (Rechnungen: isCreditNote != true, Gutschriften:
// isCreditNote = true) zusammen mit der Sortierung nach Anlagedatum - ohne den
// zusammengesetzten Index liest jede Seite der beiden Listen die ganze Sammlung.
invoiceSchema.index({ isCreditNote: 1, createdAt: -1 });
invoiceSchema.index({ creditNoteOf: 1 });
// invoiceNumber already has unique: true index, no need for duplicate
invoiceSchema.index({ dueDate: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;