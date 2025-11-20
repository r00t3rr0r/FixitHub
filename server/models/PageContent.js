const mongoose = require('mongoose');

// Schema for component styling
const ComponentStyleSchema = new mongoose.Schema({
  // Layout & Positioning
  width: { type: String, default: 'auto' },
  height: { type: String, default: 'auto' },
  padding: { top: Number, right: Number, bottom: Number, left: Number },
  margin: { top: Number, right: Number, bottom: Number, left: Number },
  position: { type: String, enum: ['static', 'relative', 'absolute', 'fixed', 'sticky'], default: 'relative' },
  top: String,
  right: String,
  bottom: String,
  left: String,
  zIndex: Number,

  // Display & Flexbox
  display: { type: String, enum: ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'none'], default: 'block' },
  flexDirection: { type: String, enum: ['row', 'column', 'row-reverse', 'column-reverse'], default: 'row' },
  justifyContent: { type: String, enum: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'], default: 'flex-start' },
  alignItems: { type: String, enum: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'], default: 'stretch' },
  flexWrap: { type: String, enum: ['nowrap', 'wrap', 'wrap-reverse'], default: 'nowrap' },
  gap: String,

  // Background
  backgroundColor: String,
  backgroundImage: String,
  backgroundSize: { type: String, enum: ['auto', 'cover', 'contain'], default: 'cover' },
  backgroundPosition: { type: String, default: 'center' },
  backgroundRepeat: { type: String, enum: ['repeat', 'no-repeat', 'repeat-x', 'repeat-y'], default: 'no-repeat' },
  backgroundAttachment: { type: String, enum: ['scroll', 'fixed', 'local'], default: 'scroll' },
  gradient: String,

  // Border
  border: String,
  borderTop: String,
  borderRight: String,
  borderBottom: String,
  borderLeft: String,
  borderRadius: String,
  borderColor: String,
  borderWidth: String,
  borderStyle: { type: String, enum: ['none', 'solid', 'dashed', 'dotted', 'double'], default: 'solid' },

  // Typography
  fontSize: String,
  fontWeight: { type: String, enum: ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold'], default: 'normal' },
  fontFamily: String,
  lineHeight: String,
  letterSpacing: String,
  textAlign: { type: String, enum: ['left', 'center', 'right', 'justify'], default: 'left' },
  textDecoration: String,
  textTransform: { type: String, enum: ['none', 'uppercase', 'lowercase', 'capitalize'], default: 'none' },
  color: String,

  // Effects
  opacity: { type: Number, min: 0, max: 1, default: 1 },
  boxShadow: String,
  textShadow: String,
  filter: String,
  backdropFilter: String,
  transform: String,
  transition: String,

  // Overflow
  overflow: { type: String, enum: ['visible', 'hidden', 'scroll', 'auto'], default: 'visible' },
  overflowX: { type: String, enum: ['visible', 'hidden', 'scroll', 'auto'], default: 'visible' },
  overflowY: { type: String, enum: ['visible', 'hidden', 'scroll', 'auto'], default: 'visible' },

  // Custom CSS
  customCSS: String
}, { _id: false });

// Schema for responsive styles
const ResponsiveStylesSchema = new mongoose.Schema({
  mobile: { type: ComponentStyleSchema, default: () => ({}) },
  tablet: { type: ComponentStyleSchema, default: () => ({}) },
  desktop: { type: ComponentStyleSchema, default: () => ({}) }
}, { _id: false });

// Schema for component animations
const ComponentAnimationSchema = new mongoose.Schema({
  type: { type: String, enum: ['none', 'fade', 'slide', 'zoom', 'bounce', 'rotate', 'flip'], default: 'none' },
  duration: { type: Number, default: 300 },
  delay: { type: Number, default: 0 },
  easing: { type: String, default: 'ease-in-out' },
  trigger: { type: String, enum: ['load', 'scroll', 'hover', 'click'], default: 'scroll' },
  scrollOffset: { type: Number, default: 0 },
  repeat: { type: Boolean, default: false }
}, { _id: false });

// Schema for hover/active states
const ComponentStateStylesSchema = new mongoose.Schema({
  hover: { type: ComponentStyleSchema, default: () => ({}) },
  active: { type: ComponentStyleSchema, default: () => ({}) },
  focus: { type: ComponentStyleSchema, default: () => ({}) }
}, { _id: false });

// Main component schema
const ComponentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [
      'text', 'heading', 'paragraph', 'image', 'gallery', 'slideshow',
      'button', 'icon', 'video', 'form', 'card', 'list', 'table',
      'accordion', 'tabs', 'map', 'html', 'section', 'container',
      'column', 'row', 'divider', 'spacer', 'navbar', 'footer'
    ]
  },
  name: String,

  // Component content based on type
  content: mongoose.Schema.Types.Mixed,

  // Styling
  styles: { type: ComponentStyleSchema, default: () => ({}) },
  responsiveStyles: { type: ResponsiveStylesSchema, default: () => ({}) },
  stateStyles: { type: ComponentStateStylesSchema, default: () => ({}) },

  // Animations
  animation: { type: ComponentAnimationSchema, default: () => ({}) },

  // Visibility
  visibility: {
    desktop: { type: Boolean, default: true },
    tablet: { type: Boolean, default: true },
    mobile: { type: Boolean, default: true }
  },

  // Hierarchy
  parentId: { type: String, default: null },
  order: { type: Number, default: 0 },
  children: [{ type: String }],

  // Metadata
  locked: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  className: String,
  customAttributes: mongoose.Schema.Types.Mixed
}, { _id: false });

// Section schema (groups of components)
const SectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['hero', 'features', 'gallery', 'cta', 'contact', 'footer', 'custom'], default: 'custom' },
  components: [ComponentSchema],
  styles: { type: ComponentStyleSchema, default: () => ({}) },
  responsiveStyles: { type: ResponsiveStylesSchema, default: () => ({}) },
  backgroundVideo: String,
  parallax: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  isFullWidth: { type: Boolean, default: false },
  containerMaxWidth: String
}, { _id: false });

// Main page content schema
const PageContentSchema = new mongoose.Schema({
  pageId: { type: String, required: true, unique: true, index: true },
  pageTitle: { type: String, required: true },
  pageSlug: { type: String, required: true },

  // Page structure
  sections: [SectionSchema],

  // Global page styles
  globalStyles: {
    backgroundColor: String,
    backgroundImage: String,
    fontFamily: String,
    colorScheme: {
      primary: String,
      secondary: String,
      accent: String,
      text: String,
      background: String
    }
  },

  // SEO for this specific page
  seo: {
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
    ogImage: String,
    ogTitle: String,
    ogDescription: String
  },

  // Custom scripts for this page
  customCSS: String,
  customJS: String,
  customHeadHTML: String,

  // Version control
  version: { type: Number, default: 1 },
  isDraft: { type: Boolean, default: true },
  publishedVersion: { type: Number, default: 0 },
  lastPublished: Date,

  // History for undo/redo
  history: [{
    timestamp: Date,
    sections: [SectionSchema],
    action: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
PageContentSchema.index({ pageSlug: 1 });
PageContentSchema.index({ isDraft: 1 });

// Methods
PageContentSchema.methods.publish = function() {
  this.isDraft = false;
  this.publishedVersion = this.version;
  this.lastPublished = new Date();
  return this.save();
};

PageContentSchema.methods.createVersion = function(userId, action = 'update') {
  // Keep only last 50 versions
  if (this.history.length >= 50) {
    this.history = this.history.slice(-49);
  }

  this.history.push({
    timestamp: new Date(),
    sections: this.sections,
    action,
    userId
  });

  this.version += 1;
  return this.save();
};

PageContentSchema.methods.restoreVersion = function(versionIndex) {
  if (versionIndex < 0 || versionIndex >= this.history.length) {
    throw new Error('Invalid version index');
  }

  const historicalVersion = this.history[versionIndex];
  this.sections = historicalVersion.sections;
  this.version += 1;

  return this.save();
};

// Static methods
PageContentSchema.statics.getByPageId = async function(pageId) {
  let pageContent = await this.findOne({ pageId });
  if (!pageContent) {
    console.log('No page content found for page:', pageId);
    return null;
  }
  return pageContent;
};

PageContentSchema.statics.createPage = async function(pageData, userId) {
  console.log('Creating new page content for:', pageData.pageSlug);

  const pageContent = await this.create({
    pageId: pageData.pageId || `page_${Date.now()}`,
    pageTitle: pageData.pageTitle,
    pageSlug: pageData.pageSlug,
    sections: pageData.sections || [],
    createdBy: userId,
    updatedBy: userId
  });

  return pageContent;
};

PageContentSchema.statics.duplicatePage = async function(pageId, newPageData, userId) {
  const originalPage = await this.findOne({ pageId });
  if (!originalPage) {
    throw new Error('Original page not found');
  }

  const duplicatedPage = await this.create({
    pageId: newPageData.pageId || `page_${Date.now()}`,
    pageTitle: newPageData.pageTitle || `${originalPage.pageTitle} (Copy)`,
    pageSlug: newPageData.pageSlug,
    sections: JSON.parse(JSON.stringify(originalPage.sections)), // Deep clone
    globalStyles: originalPage.globalStyles,
    customCSS: originalPage.customCSS,
    customJS: originalPage.customJS,
    seo: originalPage.seo,
    createdBy: userId,
    updatedBy: userId
  });

  return duplicatedPage;
};

module.exports = mongoose.model('PageContent', PageContentSchema);
