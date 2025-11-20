const mongoose = require('mongoose');

const ColorSchemeSchema = new mongoose.Schema({
  primary: { type: String, default: '#3b82f6' },
  secondary: { type: String, default: '#8b5cf6' },
  accent: { type: String, default: '#f59e0b' },
  background: { type: String, default: '#ffffff' },
  text: { type: String, default: '#1f2937' },
  success: { type: String, default: '#10b981' },
  warning: { type: String, default: '#f59e0b' },
  error: { type: String, default: '#ef4444' },
  info: { type: String, default: '#3b82f6' }
}, { _id: false });

const TypographySchema = new mongoose.Schema({
  fontFamily: { type: String, default: 'Inter, system-ui, sans-serif' },
  baseFontSize: { type: Number, default: 16 },
  lineHeight: { type: Number, default: 1.5 },
  h1: { fontSize: Number, fontWeight: Number, lineHeight: Number },
  h2: { fontSize: Number, fontWeight: Number, lineHeight: Number },
  h3: { fontSize: Number, fontWeight: Number, lineHeight: Number },
  h4: { fontSize: Number, fontWeight: Number, lineHeight: Number },
  h5: { fontSize: Number, fontWeight: Number, lineHeight: Number },
  h6: { fontSize: Number, fontWeight: Number, lineHeight: Number }
}, { _id: false });

const SpacingSchema = new mongoose.Schema({
  xs: { type: Number, default: 4 },
  sm: { type: Number, default: 8 },
  md: { type: Number, default: 16 },
  lg: { type: Number, default: 24 },
  xl: { type: Number, default: 32 },
  xxl: { type: Number, default: 48 }
}, { _id: false });

const HeaderConfigSchema = new mongoose.Schema({
  logo: { type: String, default: '' },
  logoHeight: { type: Number, default: 40 },
  height: { type: Number, default: 64 },
  background: { type: String, default: '#ffffff' },
  position: { type: String, enum: ['static', 'sticky', 'fixed'], default: 'sticky' },
  transparent: { type: Boolean, default: false },
  showSearch: { type: Boolean, default: true },
  showLanguageSelector: { type: Boolean, default: true },
  showThemeToggle: { type: Boolean, default: true }
}, { _id: false });

const FooterConfigSchema = new mongoose.Schema({
  background: { type: String, default: '#1f2937' },
  textColor: { type: String, default: '#ffffff' },
  showSocialIcons: { type: Boolean, default: true },
  socialLinks: [{
    platform: String,
    url: String,
    icon: String
  }],
  columns: [{
    title: String,
    links: [{
      label: String,
      url: String
    }]
  }],
  copyright: { type: String, default: '© 2024 FixitHub. All rights reserved.' },
  showNewsletter: { type: Boolean, default: true }
}, { _id: false });

const NavigationMenuSchema = new mongoose.Schema({
  items: [{
    label: String,
    url: String,
    icon: String,
    children: [{
      label: String,
      url: String,
      icon: String
    }]
  }],
  mobileBreakpoint: { type: Number, default: 768 },
  showMegaMenu: { type: Boolean, default: false }
}, { _id: false });

const PageLayoutSchema = new mongoose.Schema({
  preset: {
    type: String,
    enum: ['one-column', 'two-column', 'three-column', 'grid', 'flex'],
    default: 'one-column'
  },
  maxWidth: { type: Number, default: 1280 },
  sidebar: {
    position: { type: String, enum: ['left', 'right', 'both', 'none'], default: 'none' },
    width: { type: Number, default: 280 }
  },
  contentPadding: { type: Number, default: 16 }
}, { _id: false });

const BreakpointSchema = new mongoose.Schema({
  mobile: { type: Number, default: 640 },
  tablet: { type: Number, default: 768 },
  desktop: { type: Number, default: 1024 },
  wide: { type: Number, default: 1280 }
}, { _id: false });

const AnimationSchema = new mongoose.Schema({
  enableScrollAnimations: { type: Boolean, default: true },
  enableHoverEffects: { type: Boolean, default: true },
  enableTransitions: { type: Boolean, default: true },
  enableParallax: { type: Boolean, default: false },
  transitionDuration: { type: Number, default: 300 },
  scrollAnimationType: {
    type: String,
    enum: ['fade', 'slide', 'zoom', 'bounce', 'none'],
    default: 'fade'
  }
}, { _id: false });

const SEOSettingsSchema = new mongoose.Schema({
  title: { type: String, default: 'FixitHub - Device Repair Services' },
  description: { type: String, default: 'Professional device repair services' },
  keywords: [{ type: String }],
  favicon: { type: String, default: '/favicon.ico' },
  enableIndexing: { type: Boolean, default: true },
  ogImage: { type: String, default: '' },
  twitterCard: { type: String, enum: ['summary', 'summary_large_image', 'app', 'player'], default: 'summary_large_image' }
}, { _id: false });

const ContentModuleSchema = new mongoose.Schema({
  textBlocks: {
    defaultAlignment: { type: String, enum: ['left', 'center', 'right', 'justify'], default: 'left' },
    defaultFontSize: { type: Number, default: 16 }
  },
  buttons: {
    defaultStyle: { type: String, enum: ['solid', 'outline', 'ghost', 'link'], default: 'solid' },
    defaultShape: { type: String, enum: ['rounded', 'square', 'pill'], default: 'rounded' },
    defaultSize: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' }
  },
  images: {
    defaultQuality: { type: Number, default: 80 },
    lazyLoad: { type: Boolean, default: true },
    defaultAspectRatio: { type: String, default: '16:9' }
  },
  forms: {
    defaultStyle: { type: String, enum: ['outlined', 'filled', 'underlined'], default: 'outlined' },
    enableValidation: { type: Boolean, default: true },
    targetEmail: { type: String, default: '' }
  }
}, { _id: false });

const IntegrationSchema = new mongoose.Schema({
  googleAnalytics: { type: String, default: '' },
  googleTagManager: { type: String, default: '' },
  facebookPixel: { type: String, default: '' },
  chatWidget: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['intercom', 'drift', 'zendesk', 'custom'], default: 'custom' },
    code: { type: String, default: '' }
  },
  cookieBanner: {
    enabled: { type: Boolean, default: true },
    message: { type: String, default: 'We use cookies to enhance your experience.' },
    position: { type: String, enum: ['top', 'bottom'], default: 'bottom' }
  }
}, { _id: false });

const PublishingSchema = new mongoose.Schema({
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  lastPublished: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  backupEnabled: { type: Boolean, default: true },
  autoBackup: { type: Boolean, default: true },
  backupFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' }
}, { _id: false });

const WebsiteSettingsSchema = new mongoose.Schema({
  // General Settings
  projectTitle: { type: String, required: true, default: 'FixitHub' },
  subdomain: { type: String, default: '' },
  customDomain: { type: String, default: '' },
  defaultLanguage: { type: String, default: 'en' },
  supportedLanguages: [{ type: String, default: ['en', 'de'] }],

  // SEO
  seo: { type: SEOSettingsSchema, default: () => ({}) },

  // Layout & Structure
  pageLayout: { type: PageLayoutSchema, default: () => ({}) },
  header: { type: HeaderConfigSchema, default: () => ({}) },
  footer: { type: FooterConfigSchema, default: () => ({}) },
  navigation: { type: NavigationMenuSchema, default: () => ({}) },

  // Visual Design
  colorScheme: { type: ColorSchemeSchema, default: () => ({}) },
  darkMode: {
    enabled: { type: Boolean, default: true },
    defaultMode: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    colorScheme: { type: ColorSchemeSchema, default: () => ({}) }
  },
  typography: { type: TypographySchema, default: () => ({}) },
  spacing: { type: SpacingSchema, default: () => ({}) },
  borderRadius: {
    sm: { type: Number, default: 4 },
    md: { type: Number, default: 8 },
    lg: { type: Number, default: 12 },
    xl: { type: Number, default: 16 }
  },
  shadows: {
    sm: { type: String, default: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
    md: { type: String, default: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    lg: { type: String, default: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
    xl: { type: String, default: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }
  },
  background: {
    type: { type: String, enum: ['solid', 'gradient', 'image', 'pattern'], default: 'solid' },
    value: { type: String, default: '#ffffff' },
    image: { type: String, default: '' },
    pattern: { type: String, default: '' }
  },

  // Content Modules
  contentModules: { type: ContentModuleSchema, default: () => ({}) },

  // Responsive Design
  breakpoints: { type: BreakpointSchema, default: () => ({}) },
  responsiveSettings: {
    hideOnMobile: [{ type: String }],
    hideOnTablet: [{ type: String }],
    hideOnDesktop: [{ type: String }],
    mobileTypography: { type: TypographySchema },
    mobileSpacing: { type: SpacingSchema }
  },

  // Animations & Interactions
  animations: { type: AnimationSchema, default: () => ({}) },

  // Advanced Customization
  customCSS: { type: String, default: '' },
  customJS: { type: String, default: '' },
  integrations: { type: IntegrationSchema, default: () => ({}) },

  // Publishing
  publishing: { type: PublishingSchema, default: () => ({}) },

  // Page Hierarchy
  pages: [{
    id: String,
    title: String,
    slug: String,
    parentId: { type: String, default: null },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    showInNavigation: { type: Boolean, default: true },
    metaTitle: String,
    metaDescription: String
  }]
}, {
  timestamps: true
});

// Ensure only one settings document exists
WebsiteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    console.log('No website settings found, creating default settings');
    settings = await this.create({});
  }
  return settings;
};

WebsiteSettingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.getSettings();
  Object.keys(updates).forEach(key => {
    if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
      settings[key] = { ...settings[key], ...updates[key] };
    } else {
      settings[key] = updates[key];
    }
  });
  await settings.save();
  console.log('Website settings updated successfully');
  return settings;
};

module.exports = mongoose.model('WebsiteSettings', WebsiteSettingsSchema);
