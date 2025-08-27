const mongoose = require('mongoose');

const supplierInfoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  phone: {
    type: String,
    default: '',
  },
  address: {
    type: String,
    default: '',
  },
}, { _id: false });

const versionSchema = new mongoose.Schema({
  versionType: {
    type: String,
    enum: ['original', 'cheap', 'efficient'],
    required: true,
  },
  versionId: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  minStockLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 5,
  },
  reorderLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 10,
  },
  quantityOnOrder: {
    type: Number,
    default: 0,
    min: 0,
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0,
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discounts: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  storageLocation: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v && v.trim().length > 0;
      },
      message: 'Storage location cannot be empty'
    }
  },
  supplierInfo: supplierInfoSchema,
  leadTime: {
    type: Number,
    default: 7, // days
    min: 0,
  },
  expirationDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'discontinued', 'out-of-stock'],
    default: 'active',
  },
  lowStockAlert: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
    default: '',
  },
  images: [{
    type: String,
  }],
}, { _id: true });

const inventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  itemDescription: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['display', 'battery', 'camera', 'speaker', 'microphone', 'charging-port', 'button', 'sensor', 'tool', 'adhesive', 'screw', 'other'],
  },
  sku: {
    type: String,
    unique: true,
    uppercase: true,
  },
  barcode: {
    type: String,
    default: '',
  },
  manufacturer: {
    type: String,
    required: true,
  },
  brand: {
    type: String,
    required: true,
  },
  compatibleDevices: [{
    type: String,
  }],
  versions: [versionSchema],
  specifications: {
    type: Map,
    of: String,
  },
  dateAdded: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  lastOrderDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  versionKey: false,
  timestamps: { createdAt: 'dateAdded', updatedAt: 'lastUpdated' }
});

// Generate SKU before saving if not provided
inventorySchema.pre('save', async function(next) {
  if (this.isNew && !this.sku) {
    try {
      const categoryPrefix = this.category.substring(0, 3).toUpperCase();
      const count = await mongoose.model('Inventory').countDocuments({ category: this.category });
      this.sku = `${categoryPrefix}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating SKU:', error);
      this.sku = `INV-${Date.now()}`;
    }
  }

  // Update low stock alerts for all versions
  this.versions.forEach(version => {
    version.lowStockAlert = version.quantity <= version.minStockLevel;
  });

  next();
});

// Index for better query performance
inventorySchema.index({ category: 1 });
inventorySchema.index({ brand: 1 });
inventorySchema.index({ sku: 1 });
inventorySchema.index({ 'versions.lowStockAlert': 1 });

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;