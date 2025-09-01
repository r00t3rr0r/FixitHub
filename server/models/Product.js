const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  images: [{
    type: String,
    required: true
  }],
  category: {
    type: String,
    required: true,
    enum: ['Accessories', 'Cases', 'Chargers', 'Cables', 'Screen Protectors', 'Batteries', 'Tools', 'Parts']
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockCount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  features: [{
    type: String
  }],
  compatibility: [{
    type: String
  }],
  sku: {
    type: String,
    unique: true,
    uppercase: true
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  isActive: {
    type: Boolean,
    default: true
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

// Generate SKU before saving if not provided
productSchema.pre('save', async function(next) {
  if (this.isNew && !this.sku) {
    try {
      const categoryPrefix = this.category.substring(0, 3).toUpperCase();
      const count = await mongoose.model('Product').countDocuments({ category: this.category });
      this.sku = `${categoryPrefix}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating SKU:', error);
      this.sku = `PRD-${Date.now()}`;
    }
  }

  // Update stock status
  this.inStock = this.stockCount > 0;
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ inStock: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;