const mongoose = require('mongoose');

/**
 * InvoiceDocumentArchive - die archivierten PDF-Fassungen eines ausgestellten Belegs.
 *
 * Frueher lagen die PDF-Bytes direkt im Invoice-Dokument (documentArchive.data) und JEDE
 * ersetzte Fassung wurde mit ihren vollen Bytes an documentHistory angehaengt. Wiederholte
 * Neufassungen liessen die Rechnung so unbegrenzt auf das 16-MB-Limit von MongoDB
 * zuwachsen - danach waere JEDES Speichern dieser Rechnung gescheitert.
 *
 * Aufbewahrungsregel (FinancialService.ensureInvoiceDocument):
 *  - Jede archivierte Fassung (auch jede spaetere Neufassung) liegt hier als EIN eigenes
 *    Dokument mit Bytes und sha256. Nichts davon wird ueberschrieben oder geloescht -
 *    insbesondere die Bytes der ausgestellten Fassung bleiben unveraendert erhalten.
 *  - Das Invoice-Dokument traegt nur noch Metadaten: documentArchive (aktuelle Fassung,
 *    Verweis documentId) und documentHistory (Hash/Version/Verweis, begrenzt; die erste,
 *    ausgestellte Fassung bleibt dort immer vermerkt).
 *  - Altbestand mit Inline-Bytes wird unveraendert gelesen; erst bei der naechsten
 *    Neufassung werden seine Inline-Bytes hierher ausgelagert.
 * Einzige Ausnahme vom "nie loeschen": ein Datensatz, der bei einem verlorenen
 * Parallelwettlauf entstand und nie von einer Rechnung referenziert (also nie
 * ausgeliefert) wurde, wird vom Verlierer wieder entfernt.
 */
const invoiceDocumentArchiveSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    immutable: true
  },
  version: {
    type: Number,
    required: true,
    immutable: true
  },
  sha256: {
    type: String,
    required: true,
    immutable: true
  },
  size: {
    type: Number,
    immutable: true
  },
  fingerprint: {
    type: String,
    immutable: true
  },
  generatedAt: {
    type: Date,
    immutable: true
  },
  data: {
    type: Buffer,
    required: true,
    immutable: true
  },
  // 'generated' = von ensureInvoiceDocument erzeugt; 'legacy_inline' = aus einem
  // Altbeleg (Inline-Bytes) unveraendert uebernommen.
  source: {
    type: String,
    enum: ['generated', 'legacy_inline'],
    default: 'generated',
    immutable: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  versionKey: false
});

invoiceDocumentArchiveSchema.index({ invoiceId: 1, version: 1 });

const InvoiceDocumentArchive = mongoose.model('InvoiceDocumentArchive', invoiceDocumentArchiveSchema);

module.exports = InvoiceDocumentArchive;
