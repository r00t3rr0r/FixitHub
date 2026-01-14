const mongoose = require('mongoose');

const translationKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  }
});

const languageSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  nativeName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  direction: {
    type: String,
    enum: ['ltr', 'rtl'],
    default: 'ltr'
  },
  translations: [translationKeySchema],
  icon: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure only one default language exists
languageSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    console.log(`Language Model: Setting ${this.code} as default language`);
    // Remove default flag from all other languages
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Index for faster queries
// code already has unique: true index at line 22, no need for duplicate
languageSchema.index({ isActive: 1 });
languageSchema.index({ isDefault: 1 });

const Language = mongoose.model('Language', languageSchema);

module.exports = Language;
