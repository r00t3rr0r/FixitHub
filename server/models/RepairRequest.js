const mongoose = require('mongoose');

// Ursprüngliche Geräteangabe des Kunden (einmal bei Anlage geschrieben, nie überschrieben).
// Gleiche Benennung wie Order.reportedDevice (deviceType statt "type", siehe dort).
const reportedDeviceSchema = new mongoose.Schema({
  deviceType: { type: String, default: '' },
  brand: { type: String, default: '' },
  model: { type: String, default: '' },
  modelNumber: { type: String, default: '' },
  deviceModelId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceModel' },
  source: { type: String, enum: ['catalog', 'manual'] },
  capturedAt: { type: Date },
}, { _id: false });

// Kostenvoranschlag. Optional und additiv: Altbestände ohne quote werden beim Lesen
// kompatibel behandelt (estimatedCost > 0 => gilt als veröffentlicht, siehe
// RepairRequestService.getEffectiveQuote). Der Status der Anfrage (enum unten) bleibt
// unverändert; "approved" bedeutet seit diesem Feld "Kostenvoranschlag angenommen".
const quoteSchema = new mongoose.Schema({
  amount: { type: Number, min: 0, default: 0 }, // brutto, EUR; 0 € ist ein gültiger Kostenvoranschlag
  description: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'declined'], default: 'draft' },
  version: { type: Number, default: 0 }, // +1 bei jedem Versand
  legacy: { type: Boolean, default: false }, // aus Altbestand (estimatedCost) übernommen
  draftUpdatedAt: { type: Date },
  draftUpdatedByName: { type: String, default: '' },
  publishedAt: { type: Date },
  publishedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedByName: { type: String, default: '' },
  feedbackMessageId: { type: mongoose.Schema.Types.ObjectId },
  respondedAt: { type: Date },
  respondedByName: { type: String, default: '' },
  responseChannel: { type: String, enum: ['customer', 'guest'] },
  // Ergebnis des E-Mail-Versands an den Kunden: 'accepted' = vom Mailserver angenommen
  // (keine Zustellbestätigung), 'failed' = fehlgeschlagen.
  emailStatus: { type: String, enum: ['accepted', 'failed'] },
  emailError: { type: String, default: '' },
  emailSentAt: { type: Date },
}, { _id: false });

const repairRequestSchema = new mongoose.Schema({
  // Request Number
  requestNumber: {
    type: String,
    required: true,
    unique: true,
  },

  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },

  // Guest fields
  isGuest: {
    type: Boolean,
    default: false,
  },
  guestTrackingToken: {
    type: String,
    index: { sparse: true, unique: true },
  },
  // Vor-/Nachname des Gastes getrennt (für die Umwandlung in einen Gast-Auftrag).
  // Altbestand ohne diese Felder: customerName wird beim Umwandeln am ersten Leerzeichen geteilt.
  guestFirstName: { type: String, default: undefined },
  guestLastName: { type: String, default: undefined },

  // Device Information
  deviceType: {
    type: String,
    required: true,
  },
  deviceBrand: {
    type: String,
    required: true,
  },
  deviceModel: {
    type: String,
    required: true,
  },
  deviceModelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceModel',
  },
  // Herkunft der aktuellen Gerätedaten: 'catalog' (deviceModelId geprüft) oder 'manual'.
  // Altbestand ohne Feld: deviceModelId vorhanden => catalog, sonst manual (Lese-Kompatibilität).
  deviceSource: {
    type: String,
    enum: ['catalog', 'manual'],
  },
  reportedDevice: {
    type: reportedDeviceSchema,
    default: undefined,
  },

  // Questionnaire Responses
  issueDescription: {
    type: String,
    required: true,
  },
  issueOccurredDate: {
    type: String,
    required: false,
    default: '',
  },
  repairAttempts: {
    type: String,
    default: '',
  },
  modelNumber: {
    type: String,
    default: '',
  },

  // Extended Information (Zusätzliche Informationen)
  waterDamage: {
    type: String,
    enum: ['no', 'yes', 'unsure'],
    default: 'no',
  },
  previousRepairDetails: {
    type: String,
    default: '',
  },
  itemCondition: {
    type: String,
    enum: ['original', 'refurbished', 'unsure'],
    default: 'unsure',
  },

  // Image Uploads
  images: [{
    type: String,
  }],

  // Status Management
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'approved', 'rejected', 'converted'],
    default: 'pending',
  },

  // Staff Assignment
  assignedStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedStaffName: {
    type: String,
    default: '',
  },

  // Communication Thread
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  }],

  // Converted Order Information
  convertedToOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  convertedAt: {
    type: Date,
  },
  convertedByStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  convertedByStaffName: {
    type: String,
    default: '',
  },
  // Atomare Sperre für "In Auftrag umwandeln" (verhindert Doppelumwandlung).
  conversionStartedAt: {
    type: Date,
  },

  // Admin Notes
  adminNotes: [{
    // Additiv: Verlaufseinträge, die der Kunde/Gast auslöst (z. B. Antwort auf den
    // Kostenvoranschlag), haben keine Mitarbeiter-ID. Altbestand ohne actorType = 'staff'.
    actorType: {
      type: String,
      enum: ['staff', 'customer', 'guest', 'system'],
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function requiredForStaffNotes() {
        return !this.actorType || this.actorType === 'staff';
      },
    },
    staffName: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  // Estimated Cost
  estimatedCost: {
    type: Number,
    min: 0,
    default: 0,
  },

  // Kostenvoranschlag mit Veröffentlichungsgrenze (siehe quoteSchema oben).
  quote: {
    type: quoteSchema,
    default: undefined,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // Review Deadline
  reviewDeadline: {
    type: Date,
  },
}, {
  versionKey: false
});

// Auto-generate request number BEFORE validation
repairRequestSchema.pre('validate', async function(next) {
  if (this.isNew && !this.requestNumber) {
    try {
      const count = await this.constructor.countDocuments();
      this.requestNumber = `RR-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
      console.log(`Generated request number: ${this.requestNumber}`);
    } catch (error) {
      console.error('Error generating request number:', error);
      return next(error);
    }
  }
  next();
});

// Update timestamp on save
repairRequestSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

// Index for faster queries
// Note: requestNumber already has a unique index from schema definition (line 8)
// repairRequestSchema.index({ requestNumber: 1 }); // Removed to avoid duplicate index warning
repairRequestSchema.index({ customerId: 1 });
repairRequestSchema.index({ status: 1 });
repairRequestSchema.index({ createdAt: -1 });

const RepairRequest = mongoose.model('RepairRequest', repairRequestSchema);

module.exports = RepairRequest;
