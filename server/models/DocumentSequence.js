const mongoose = require('mongoose');

/**
 * DocumentSequence - atomarer, fortlaufender Nummernkreis pro Dokumenttyp und Jahr.
 *
 * Ersetzt das nicht-atomare countDocuments()+1 Schema. Jede Nummer wird genau einmal
 * vergeben; eine vergebene Nummer wird nie wiederverwendet (Lücken sind zulässig,
 * Duplikate nicht). Der Typ ist bewusst frei gehalten, damit weitere Belegarten
 * (Auftrag, Buchung, Reklamation) denselben Mechanismus nutzen können.
 */
const documentSequenceSchema = new mongoose.Schema({
  documentType: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true
  },
  sequence: {
    type: Number,
    default: 0
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

documentSequenceSchema.index({ documentType: 1, year: 1 }, { unique: true });

// Einzige Stelle, an der das Nummernformat definiert wird.
documentSequenceSchema.statics.PREFIXES = {
  invoice: 'INV',
  credit_note: 'INV-CN'
};

documentSequenceSchema.statics.formatNumber = function formatNumber(documentType, year, sequence) {
  const prefix = this.PREFIXES[documentType] || String(documentType || 'DOC').toUpperCase();
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Reserviert atomar die nächste Sequenznummer. Wirft bei Fehlschlag - es wird
 * bewusst KEINE Ersatznummer erfunden.
 */
documentSequenceSchema.statics.allocate = async function allocate(documentType, year) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await this.findOneAndUpdate(
        { documentType, year },
        { $inc: { sequence: 1 }, $set: { updatedAt: new Date() } },
        { new: true, upsert: true }
      );
      return counter.sequence;
    } catch (error) {
      // Zwei parallele Upserts können einmalig am Unique-Index kollidieren.
      if (error?.code !== 11000) throw error;
      lastError = error;
    }
  }
  throw lastError;
};

documentSequenceSchema.statics.allocateNumber = async function allocateNumber(documentType, year) {
  const sequence = await this.allocate(documentType, year);
  return this.formatNumber(documentType, year, sequence);
};

const DocumentSequence = mongoose.model('DocumentSequence', documentSequenceSchema);

module.exports = DocumentSequence;
