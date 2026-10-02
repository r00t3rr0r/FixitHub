const mongoose = require('mongoose');

// Schema for complaint comments/updates
const complaintCommentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  isInternal: {
    type: Boolean,
    default: false // Internal notes only visible to staff/admin
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const complaintSchema = new mongoose.Schema({
  complaintNumber: {
    type: String,
    unique: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
    default: null
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['quality', 'service', 'delivery', 'billing', 'communication', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: [
      'open',
      'in-progress',
      'pending-customer',
      'resolved',
      'closed',
      'pending_approval',
      'approved',
      'rejected',
      'acknowledged',
      'denied',
      'new_repair',
      'awaiting_payment'
    ],
    default: 'open'
  },
  workflowType: {
    type: String,
    enum: ['legacy', 'order-complaint'],
    default: 'legacy'
  },
  complaintReason: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  technicianReason: {
    type: String,
    default: ''
  },
  repairNotes: {
    type: String,
    default: ''
  },
  shippingLabelUrl: {
    type: String,
    default: ''
  },
  adminApprovedAt: {
    type: Date
  },
  adminApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  technicianName: {
    type: String,
    default: ''
  },
  newOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  extraCosts: {
    type: Number,
    default: 0,
    min: 0
  },
  serviceFee: {
    type: Number,
    default: 0,
    min: 0
  },
  partialRefund: {
    type: Number,
    default: 0,
    min: 0
  },
  additionalParts: [{
    name: {
      type: String,
      default: ''
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    cost: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  repairOffer: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    description: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date
    },
    acceptedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'none'],
      default: 'none'
    }
  },
  complaintLogs: [{
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actorName: {
      type: String,
      default: ''
    },
    actorRole: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      required: true
    },
    fromStatus: {
      type: String,
      default: ''
    },
    toStatus: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedToName: {
    type: String
  },
  comments: [complaintCommentSchema],
  resolution: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Reklamationsnummern (Format unveraendert CMP-JJJJ-NNNN) kommen aus dem atomaren DocumentSequence-
// Zaehler {documentType:'complaint', year}. Frueher: countDocuments()+1 -> doppelte Nummern (E11000) bei
// parallelen Reklamationen oder nach einer Loeschung; die Auftragsroute ueberschrieb die Nummer zudem
// mit "R<Auftrags-ID>". Der Zaehler wird pro Jahr einmal je Prozess auf die hoechste vorhandene Nummer
// angehoben (nie abgesenkt), damit Altbestaende nicht kollidieren.
const COMPLAINT_SEQUENCE_TYPE = 'complaint';
const complaintCounterAligned = new Map();
async function alignComplaintCounter(year) {
  const DocumentSequence = require('./DocumentSequence');
  const pattern = new RegExp(`^CMP-${year}-(\\d+)$`);
  const rows = await mongoose.model('Complaint').find({ complaintNumber: { $regex: `^CMP-${year}-\\d+$` } }, { complaintNumber: 1 }).lean();
  const maxExisting = rows.reduce((max, row) => {
    const match = pattern.exec(String(row.complaintNumber || ''));
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  if (maxExisting > 0) {
    try {
      await DocumentSequence.findOneAndUpdate(
        { documentType: COMPLAINT_SEQUENCE_TYPE, year },
        { $max: { sequence: maxExisting }, $set: { updatedAt: new Date() } },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      await DocumentSequence.updateOne({ documentType: COMPLAINT_SEQUENCE_TYPE, year }, { $max: { sequence: maxExisting } });
    }
  }
}
async function allocateComplaintNumber() {
  const DocumentSequence = require('./DocumentSequence');
  const year = new Date().getFullYear();
  if (!complaintCounterAligned.has(year)) {
    complaintCounterAligned.set(year, alignComplaintCounter(year).catch((error) => {
      complaintCounterAligned.delete(year);
      throw error;
    }));
  }
  await complaintCounterAligned.get(year);
  const sequence = await DocumentSequence.allocate(COMPLAINT_SEQUENCE_TYPE, year);
  return `CMP-${year}-${String(sequence).padStart(4, '0')}`;
}

// Generate complaint number before saving
complaintSchema.pre('save', async function(next) {
  if (this.isNew && !this.complaintNumber) {
    try {
      this.complaintNumber = await allocateComplaintNumber();
    } catch (error) {
      // Bewusst KEINE Ersatznummer erfinden (wie bei Rechnungen): die Anlage scheitert sichtbar.
      console.error('Complaint pre-save: Error allocating complaint number:', error);
      return next(error);
    }
  }

  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
complaintSchema.index({ bookingId: 1 });
complaintSchema.index({ customerId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ createdAt: -1 });
// complaintNumber already has unique: true index at line 36, no need for duplicate

// Populate customer and booking when querying
complaintSchema.pre(/^find/, function(next) {
  // Check if auto-populate should be skipped
  if (this.getOptions().skipAutoPopulate) {
    return next();
  }

  this.populate('customerId', 'firstName lastName email phone avatar')
      .populate('bookingId', 'bookingNumber status totalCost')
      .populate('orderId', 'orderNumber deviceBrand deviceModel')
      .populate('newOrderId', 'orderNumber status totalCost')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('technicianId', 'firstName lastName email role')
      .populate('adminApprovedBy', 'firstName lastName email role')
      .populate('resolvedBy', 'firstName lastName email');
  next();
});

// ---- Ausgabe an Clients ------------------------------------------------------------------
// Das Versandlabel liegt als base64-PDF in shippingLabelUrl (und in Altdaten zusaetzlich im
// Protokoll). Es gehoert NIE in normale JSON-Antworten (Listen, Polling, Benachrichtigungen):
// stattdessen hasShippingLabel + shippingTrackingNumber; das PDF liefert ausschliesslich
// GET /api/complaints/:id/shipping-label (Besitz- bzw. Rollenpruefung).
function isEmbeddedData(value) {
  return typeof value === 'string' && /^data:/i.test(value.trim());
}

function findLabelTrackingNumber(logs) {
  if (!Array.isArray(logs)) return null;
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index];
    if (entry && entry.action === 'admin_approved' && entry.metadata && entry.metadata.trackingNumber) {
      return String(entry.metadata.trackingNumber);
    }
  }
  return null;
}

function projectComplaintLabelData(ret) {
  if (!ret || typeof ret !== 'object') return ret;
  const label = typeof ret.shippingLabelUrl === 'string' ? ret.shippingLabelUrl.trim() : '';
  ret.hasShippingLabel = Boolean(label);
  if (isEmbeddedData(label)) {
    delete ret.shippingLabelUrl;
  }
  if (Array.isArray(ret.complaintLogs)) {
    ret.complaintLogs = ret.complaintLogs.map((entry) => {
      if (!entry || !entry.metadata || typeof entry.metadata !== 'object') return entry;
      const metadata = { ...entry.metadata };
      let changed = false;
      Object.keys(metadata).forEach((key) => {
        if (isEmbeddedData(metadata[key])) {
          delete metadata[key];
          metadata.shippingLabelStored = true;
          changed = true;
        }
      });
      return changed ? { ...entry, metadata } : entry;
    });
  }
  ret.shippingTrackingNumber = findLabelTrackingNumber(ret.complaintLogs);
  return ret;
}

complaintSchema.set('toJSON', {
  transform(doc, ret) {
    return projectComplaintLabelData(ret);
  }
});

/**
 * Einheitliche Client-Sicht einer Reklamation (eine Stelle fuer alle Routen).
 * includeInternal=false (Kunden): interne Kommentare (isInternal) werden entfernt.
 */
complaintSchema.statics.toClientView = function toClientView(complaint, { includeInternal = false } = {}) {
  if (!complaint) return complaint;
  const view = typeof complaint.toJSON === 'function'
    ? complaint.toJSON()
    : projectComplaintLabelData(JSON.parse(JSON.stringify(complaint)));
  if (!includeInternal && Array.isArray(view.comments)) {
    view.comments = view.comments.filter((comment) => comment && comment.isInternal !== true);
  }
  return view;
};

complaintSchema.statics.projectComplaintLabelData = projectComplaintLabelData;

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint;
