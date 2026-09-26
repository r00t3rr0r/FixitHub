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
  // Atomarer Anspruch "je Auftrag bzw. Buchung hoechstens EINE aktive Rechnung"
  // ('order:<id>', 'booking:<id>'). Gesetzt nur von den Erstellungswegen des
  // FinancialService (buildActiveBillingKeys) an AKTIVEN Rechnungen; ein partieller
  // Unique-Index (unten) laesst von zwei gleichzeitigen Anlagen genau eine durch.
  // Storno/Vollgutschrift ('cancelled'/'credited') geben den Anspruch frei, damit
  // "Storno + neue Rechnung" moeglich bleibt. Gutschriften und Altbestand tragen das
  // Feld nicht (default undefined, NIE ein leeres Array) - der Indexbau scheitert
  // deshalb nicht an doppelten Altrechnungen.
  activeBillingKeys: {
    type: [String],
    default: undefined
  },
  correctionType: {
    type: String,
    enum: ['full_cancellation', 'partial_refund', 'price_adjustment', null],
    default: null
  },
  lockedAt: {
    type: Date
  },
  // Stand bei Rechnungsstellung (einmalig beim Archivieren des PDFs festgehalten).
  // Spaetere Zahlungen aendern weder diese Werte noch das archivierte PDF - der
  // aktuelle Zahlungsstand kommt aus PaymentService (Liste/Detail/Kontoauszug).
  issueSnapshot: {
    capturedAt: { type: Date },
    openAmount: { type: Number },
    paidAmount: { type: Number },
    paymentMethod: { type: String },
    payments: [{
      _id: false,
      date: { type: Date },
      method: { type: String },
      amount: { type: Number }
    }]
  },
  // Archiviertes Belegdokument (PDF) - hier nur METADATEN. Die Bytes jeder Fassung liegen
  // unveraenderlich in der eigenen Sammlung InvoiceDocumentArchive (documentId), damit
  // das Rechnungsdokument bei wiederholten Neufassungen nicht unbegrenzt waechst
  // (Aufbewahrungsregel siehe models/InvoiceDocumentArchive.js). Aendert sich der
  // betragsrelevante Inhalt eines ausgestellten Belegs (Altweg syncOrderAndBookingValue),
  // entsteht eine neue Fassung; die bisherige wird in 'documentHistory' vermerkt.
  // LEGACY: 'data' (Inline-Bytes) tragen nur Altbelege; sie werden weiter gelesen und
  // nie mehr neu geschrieben (select: false).
  documentArchive: {
    data: { type: Buffer, select: false },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceDocumentArchive' },
    sha256: { type: String },
    size: { type: Number },
    fingerprint: { type: String },
    generatedAt: { type: Date },
    version: { type: Number }
  },
  // Ersetzte Fassungen (nur Metadaten + Verweis; begrenzt, die erste Fassung bleibt).
  // LEGACY: 'data' nur bei Altbelegen.
  documentHistory: {
    type: [{
      _id: false,
      data: { type: Buffer },
      documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceDocumentArchive' },
      sha256: { type: String },
      size: { type: Number },
      fingerprint: { type: String },
      generatedAt: { type: Date },
      supersededAt: { type: Date },
      version: { type: Number }
    }],
    select: false,
    default: undefined
  },
  // Storno eines ausgestellten Belegs bzw. Verwerfen eines Entwurfs. Der Ursprungsbeleg
  // bleibt unveraendert erhalten; ein Storno erzeugt eine Storno-Gutschrift
  // (INV-CN-..., correctionType 'full_cancellation'), die hier referenziert ist.
  cancellation: {
    kind: { type: String, enum: ['storno', 'draft_discarded'] },
    state: { type: String, enum: ['processing', 'completed'] },
    reason: { type: String },
    requestedAt: { type: Date },
    completedAt: { type: Date },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    previousStatus: { type: String },
    creditNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    creditNoteNumber: { type: String },
    // Zum Zeitpunkt des Stornos bereits zugeordnetes Geld - es bleibt verbucht und wird
    // als Guthaben/Erstattung offen ausgewiesen, nie automatisch erstattet.
    allocatedAtCancellation: { type: Number }
  },
  // Revisionsspur fuer Belegaktionen (Storno, Versand, Archivierung, Mahnung).
  auditTrail: [{
    _id: false,
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, default: '' },
    detail: { type: String, default: '' }
  }],
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
    emailError: String,
    // 'sent' = Stufe erreicht; 'failed' = Versand gescheitert, Stufe NICHT erreicht.
    // Altbestand ohne Feld: emailSentAt gesetzt = versendet.
    result: { type: String, enum: ['sent', 'failed'] },
    recipient: String,
    templateName: String,
    trigger: String,
    amountOpen: Number,
    source: { type: String, enum: ['automatic', 'manual'] },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Hinweis zum Schritt, z.B. "Stufe nicht übernommen" (Mail versendet, Rechnung aber
    // waehrend des Versands bezahlt oder storniert).
    note: String
  }],
  // Sperre waehrend EINES Mahnschritts: Cron und manueller Lauf koennen denselben Beleg
  // nicht gleichzeitig bearbeiten (kein doppelter Versand, keine doppelte Stufe).
  dunningLock: {
    token: { type: String },
    at: { type: Date }
  },
  // Letzter gescheiterter Versuch (sichtbar in der Mahnliste, erneut ausloesbar).
  dunningLastFailure: {
    at: { type: Date },
    stage: { type: String },
    error: { type: String }
  },
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
  // Zahlungsziel. Bei neuen Rechnungen wird der Text IMMER aus paymentDueDays
  // abgeleitet (siehe pre('validate')), damit Faelligkeitsdatum und Wortlaut nie
  // auseinanderlaufen koennen - frueher stand 'Net 30' (Schema-Default) neben einem
  // 7-Tage-Datum. Der Default bleibt nur fuer Altbestand ohne Frist erhalten.
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
  // Die EINE gespeicherte Zahlungsbedingung: Tage zwischen Rechnungsdatum und
  // Faelligkeit. Quelle ist das Kunden-/Gruppenprofil (resolveFinancialProfile) oder
  // ein ausdruecklich gewaehltes Faelligkeitsdatum.
  paymentDueDays: {
    type: Number,
    min: 0
  },
  // Technische Sperre waehrend einer Zahlungszuordnung (PaymentService.allocateAtomically):
  // nur ein Zuordnungslauf je Beleg gleichzeitig, damit zwei verschiedene Zahlungen nicht
  // denselben offenen Betrag belegen. Wird nach dem Lauf entfernt; eine verwaiste Sperre
  // verfaellt nach 30 Sekunden. Kein Belegfeld (nicht betragsrelevant, nicht im PDF).
  allocationLock: {
    token: { type: String },
    at: { type: Date }
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Deutscher Wortlaut des Zahlungsziels aus der Frist in Tagen.
function formatPaymentTerms(days) {
  const numeric = Math.max(0, Math.round(Number(days) || 0));
  if (numeric === 0) return 'Sofort fällig ohne Abzug';
  return `${numeric} ${numeric === 1 ? 'Tag' : 'Tage'} netto ohne Abzug`;
}

// Kalendertage zwischen zwei Zeitpunkten. Verglichen werden die Kalenderdaten, nicht
// die Uhrzeit: ein Faelligkeitsdatum aus einem Datumsfeld ('2026-10-01' = Mitternacht)
// darf gegenueber einem Rechnungsdatum um 12:10 Uhr keinen Tag verlieren.
function daysBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((endDay - startDay) / DAY_MS);
}

/**
 * Zahlungsziel einer NEUEN Rechnung aus EINER Bedingung ableiten.
 *  - Ist ein Faelligkeitsdatum gesetzt, ist es massgeblich (ausdruecklich gewaehlt
 *    oder vom Aufrufer aus dem Profil berechnet); die Frist folgt dem Datum.
 *  - Ist nur die Frist gesetzt, folgt das Datum der Frist.
 *  - Der Text folgt in jedem Fall der Frist - ein mitgelieferter, abweichender Text
 *    ('Net 30' neben 7 Tagen) wird nicht uebernommen.
 * Gutschriften behalten ihren eigenen Text ('Sofort'), Bestandsbelege werden nie
 * umgeschrieben (Mahnlaeufe aendern dueDate nie; die Folgefrist steht in nextDunningDueDate).
 */
function applyPaymentTerms(doc) {
  if (!doc.isNew || doc.isCreditNote) return;
  const issuedAt = doc.createdAt || new Date();
  const hasDueDate = doc.dueDate && !Number.isNaN(new Date(doc.dueDate).getTime());
  const hasDays = Number.isFinite(Number(doc.paymentDueDays)) && doc.paymentDueDays !== null && doc.paymentDueDays !== '';

  if (hasDueDate) {
    doc.paymentDueDays = Math.max(0, daysBetween(issuedAt, doc.dueDate));
  } else if (hasDays) {
    doc.paymentDueDays = Math.max(0, Math.round(Number(doc.paymentDueDays)));
    doc.dueDate = new Date(new Date(issuedAt).getTime() + doc.paymentDueDays * DAY_MS);
  } else {
    return;
  }
  doc.paymentTerms = formatPaymentTerms(doc.paymentDueDays);
}

invoiceSchema.pre('validate', function(next) {
  applyPaymentTerms(this);

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

// Stornierte und gutgeschriebene Belege beanspruchen keinen Auftrag/keine Buchung mehr.
const BILLING_KEY_RELEASING_STATUSES = ['cancelled', 'credited'];

invoiceSchema.pre('save', function(next) {
  if (this.activeBillingKeys !== undefined
    && (this.isCreditNote || BILLING_KEY_RELEASING_STATUSES.includes(String(this.status || '')))) {
    this.activeBillingKeys = undefined;
  }
  next();
});

// Dieselbe Freigabe fuer Status-Updates per Query (Storno-Abschluss, Entwurf verwerfen,
// Statuswechsel per updateOne): setzt ein Update den Status auf 'cancelled'/'credited',
// wird der Anspruch im selben atomaren Update entfernt.
invoiceSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return next();
  const nextStatus = update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'status')
    ? update.$set.status
    : update.status;
  if (BILLING_KEY_RELEASING_STATUSES.includes(String(nextStatus || ''))) {
    if (update.$set && Object.prototype.hasOwnProperty.call(update.$set, 'activeBillingKeys')) delete update.$set.activeBillingKeys;
    update.$unset = { ...(update.$unset || {}), activeBillingKeys: '' };
    this.setUpdate(update);
  }
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
// Je Auftrag/Buchung hoechstens eine aktive Rechnung (siehe activeBillingKeys). Partiell:
// nur Dokumente mit mindestens einem Schluessel sind im Index - Altbestand ohne Feld und
// leere Arrays bleiben aussen vor, doppelte Altrechnungen lassen den Indexbau nicht scheitern.
invoiceSchema.index(
  { activeBillingKeys: 1 },
  { unique: true, name: 'activeBillingKeys_unique', partialFilterExpression: { activeBillingKeys: { $type: 'string' } } }
);

/**
 * Anspruchsschluessel einer aktiven Rechnung aus ihren Bezuegen: jeder Auftrag
 * (orderId, repairOrderIds) und die Buchung. Eine Rechnung ohne Bezug beansprucht nichts.
 */
function buildActiveBillingKeys({ orderId, repairOrderIds, bookingId } = {}) {
  const idOf = (value) => {
    if (!value) return '';
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id && value._id !== value) return idOf(value._id);
    return String(value);
  };
  const keys = new Set();
  [orderId, ...(Array.isArray(repairOrderIds) ? repairOrderIds : [])]
    .map(idOf).filter(Boolean).forEach((id) => keys.add(`order:${id}`));
  const booking = idOf(bookingId);
  if (booking) keys.add(`booking:${booking}`);
  return keys.size > 0 ? [...keys] : undefined;
}

// E11000 genau dieses Index (paralleler zweiter Anlageversuch).
function isActiveBillingKeyConflict(error) {
  if (!error || error.code !== 11000) return false;
  if (error.keyPattern && Object.prototype.hasOwnProperty.call(error.keyPattern, 'activeBillingKeys')) return true;
  return /activeBillingKeys/.test(String(error.message || ''));
}

invoiceSchema.statics.buildActiveBillingKeys = buildActiveBillingKeys;
invoiceSchema.statics.isActiveBillingKeyConflict = isActiveBillingKeyConflict;

invoiceSchema.statics.formatPaymentTerms = formatPaymentTerms;

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;