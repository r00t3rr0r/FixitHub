import api from './api';

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Typography {
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  h1?: { fontSize: number; fontWeight: number; lineHeight: number };
  h2?: { fontSize: number; fontWeight: number; lineHeight: number };
  h3?: { fontSize: number; fontWeight: number; lineHeight: number };
  h4?: { fontSize: number; fontWeight: number; lineHeight: number };
  h5?: { fontSize: number; fontWeight: number; lineHeight: number };
  h6?: { fontSize: number; fontWeight: number; lineHeight: number };
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface HeaderConfig {
  logo: string;
  logoHeight: number;
  height: number;
  background: string;
  position: 'static' | 'sticky' | 'fixed';
  transparent: boolean;
  showSearch: boolean;
  showLanguageSelector: boolean;
  showThemeToggle: boolean;
}

export interface FooterConfig {
  background: string;
  textColor: string;
  showSocialIcons: boolean;
  socialLinks: Array<{ platform: string; url: string; icon: string }>;
  columns: Array<{ title: string; links: Array<{ label: string; url: string }> }>;
  copyright: string;
  showNewsletter: boolean;
}

export interface NavigationMenu {
  items: Array<{
    label: string;
    url: string;
    icon: string;
    children?: Array<{ label: string; url: string; icon: string }>;
  }>;
  mobileBreakpoint: number;
  showMegaMenu: boolean;
}

export interface PageLayout {
  preset: 'one-column' | 'two-column' | 'three-column' | 'grid' | 'flex';
  maxWidth: number;
  sidebar: {
    position: 'left' | 'right' | 'both' | 'none';
    width: number;
  };
  contentPadding: number;
}

export interface SEOSettings {
  title: string;
  description: string;
  keywords: string[];
  favicon: string;
  enableIndexing: boolean;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player';
}

export interface ContentModules {
  textBlocks: {
    defaultAlignment: 'left' | 'center' | 'right' | 'justify';
    defaultFontSize: number;
  };
  buttons: {
    defaultStyle: 'solid' | 'outline' | 'ghost' | 'link';
    defaultShape: 'rounded' | 'square' | 'pill';
    defaultSize: 'sm' | 'md' | 'lg';
  };
  images: {
    defaultQuality: number;
    lazyLoad: boolean;
    defaultAspectRatio: string;
  };
  forms: {
    defaultStyle: 'outlined' | 'filled' | 'underlined';
    enableValidation: boolean;
    targetEmail: string;
  };
}

export interface Animations {
  enableScrollAnimations: boolean;
  enableHoverEffects: boolean;
  enableTransitions: boolean;
  enableParallax: boolean;
  transitionDuration: number;
  scrollAnimationType: 'fade' | 'slide' | 'zoom' | 'bounce' | 'none';
}

export interface Integrations {
  googleAnalytics: string;
  googleTagManager: string;
  facebookPixel: string;
  chatWidget: {
    enabled: boolean;
    provider: 'intercom' | 'drift' | 'zendesk' | 'custom';
    code: string;
  };
  cookieBanner: {
    enabled: boolean;
    message: string;
    position: 'top' | 'bottom';
  };
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  parentId?: string | null;
  order: number;
  isPublished: boolean;
  showInNavigation: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

export interface WebsiteSettings {
  _id?: string;
  projectTitle: string;
  subdomain: string;
  customDomain: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  seo: SEOSettings;
  pageLayout: PageLayout;
  header: HeaderConfig;
  footer: FooterConfig;
  navigation: NavigationMenu;
  colorScheme: ColorScheme;
  darkMode: {
    enabled: boolean;
    defaultMode: 'light' | 'dark' | 'system';
    colorScheme: ColorScheme;
  };
  typography: Typography;
  spacing: Spacing;
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  background: {
    type: 'solid' | 'gradient' | 'image' | 'pattern';
    value: string;
    image: string;
    pattern: string;
  };
  contentModules: ContentModules;
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };
  responsiveSettings: {
    hideOnMobile: string[];
    hideOnTablet: string[];
    hideOnDesktop: string[];
    mobileTypography?: Typography;
    mobileSpacing?: Spacing;
  };
  animations: Animations;
  customCSS: string;
  customJS: string;
  integrations: Integrations;
  publishing: {
    status: 'draft' | 'published';
    lastPublished?: Date;
    publishedBy?: string;
    version: number;
    backupEnabled: boolean;
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
  };
  pages: Page[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Description: Get website settings
// Endpoint: GET /api/website-settings
// Request: {}
// Response: { settings: WebsiteSettings }
export const getWebsiteSettings = async () => {
  try {
    const response = await api.get('/api/website-settings');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching website settings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update website settings (bulk)
// Endpoint: PUT /api/website-settings
// Request: { updates: Partial<WebsiteSettings> }
// Response: { settings: WebsiteSettings }
export const updateWebsiteSettings = async (updates: Partial<WebsiteSettings>) => {
  try {
    const response = await api.put('/api/website-settings', updates);
    return response.data;
  } catch (error: any) {
    console.error('Error updating website settings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update general settings
// Endpoint: PUT /api/website-settings/general
// Request: { projectTitle, subdomain, customDomain, defaultLanguage, supportedLanguages }
// Response: { settings: WebsiteSettings }
export const updateGeneralSettings = async (data: {
  projectTitle: string;
  subdomain: string;
  customDomain: string;
  defaultLanguage: string;
  supportedLanguages: string[];
}) => {
  try {
    const response = await api.put('/api/website-settings/general', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating general settings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update SEO settings
// Endpoint: PUT /api/website-settings/seo
// Request: SEOSettings
// Response: { settings: WebsiteSettings }
export const updateSEOSettings = async (data: SEOSettings) => {
  try {
    const response = await api.put('/api/website-settings/seo', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating SEO settings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update page layout
// Endpoint: PUT /api/website-settings/page-layout
// Request: PageLayout
// Response: { settings: WebsiteSettings }
export const updatePageLayout = async (data: PageLayout) => {
  try {
    const response = await api.put('/api/website-settings/page-layout', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating page layout:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update header configuration
// Endpoint: PUT /api/website-settings/header
// Request: HeaderConfig
// Response: { settings: WebsiteSettings }
export const updateHeaderConfig = async (data: HeaderConfig) => {
  try {
    const response = await api.put('/api/website-settings/header', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating header:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update footer configuration
// Endpoint: PUT /api/website-settings/footer
// Request: FooterConfig
// Response: { settings: WebsiteSettings }
export const updateFooterConfig = async (data: FooterConfig) => {
  try {
    const response = await api.put('/api/website-settings/footer', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating footer:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update navigation menu
// Endpoint: PUT /api/website-settings/navigation
// Request: NavigationMenu
// Response: { settings: WebsiteSettings }
export const updateNavigationMenu = async (data: NavigationMenu) => {
  try {
    const response = await api.put('/api/website-settings/navigation', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating navigation:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update color scheme
// Endpoint: PUT /api/website-settings/color-scheme
// Request: ColorScheme
// Response: { settings: WebsiteSettings }
export const updateColorScheme = async (data: ColorScheme) => {
  try {
    const response = await api.put('/api/website-settings/color-scheme', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating color scheme:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update typography
// Endpoint: PUT /api/website-settings/typography
// Request: Typography
// Response: { settings: WebsiteSettings }
export const updateTypography = async (data: Typography) => {
  try {
    const response = await api.put('/api/website-settings/typography', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating typography:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update animations
// Endpoint: PUT /api/website-settings/animations
// Request: Animations
// Response: { settings: WebsiteSettings }
export const updateAnimations = async (data: Animations) => {
  try {
    const response = await api.put('/api/website-settings/animations', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating animations:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update custom CSS
// Endpoint: PUT /api/website-settings/custom-css
// Request: { css: string }
// Response: { settings: WebsiteSettings }
export const updateCustomCSS = async (css: string) => {
  try {
    const response = await api.put('/api/website-settings/custom-css', { css });
    return response.data;
  } catch (error: any) {
    console.error('Error updating custom CSS:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update custom JavaScript
// Endpoint: PUT /api/website-settings/custom-js
// Request: { js: string }
// Response: { settings: WebsiteSettings }
export const updateCustomJS = async (js: string) => {
  try {
    const response = await api.put('/api/website-settings/custom-js', { js });
    return response.data;
  } catch (error: any) {
    console.error('Error updating custom JS:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update integrations
// Endpoint: PUT /api/website-settings/integrations
// Request: Integrations
// Response: { settings: WebsiteSettings }
export const updateIntegrations = async (data: Integrations) => {
  try {
    const response = await api.put('/api/website-settings/integrations', data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating integrations:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Publish website
// Endpoint: POST /api/website-settings/publish
// Request: {}
// Response: { settings: WebsiteSettings, message: string }
export const publishWebsite = async () => {
  try {
    const response = await api.post('/api/website-settings/publish');
    return response.data;
  } catch (error: any) {
    console.error('Error publishing website:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create backup
// Endpoint: POST /api/website-settings/backup
// Request: {}
// Response: { success: boolean, backup: object, timestamp: Date }
export const createBackup = async () => {
  try {
    const response = await api.post('/api/website-settings/backup');
    return response.data;
  } catch (error: any) {
    console.error('Error creating backup:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Export settings
// Endpoint: GET /api/website-settings/export
// Request: { format?: 'json' | 'html' | 'zip' }
// Response: { data: object, mimeType: string }
export const exportSettings = async (format: 'json' | 'html' | 'zip' = 'json') => {
  try {
    const response = await api.get('/api/website-settings/export', { params: { format } });
    return response.data;
  } catch (error: any) {
    console.error('Error exporting settings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update page hierarchy
// Endpoint: PUT /api/website-settings/pages
// Request: { pages: Page[] }
// Response: { settings: WebsiteSettings }
export const updatePages = async (pages: Page[]) => {
  try {
    const response = await api.put('/api/website-settings/pages', { pages });
    return response.data;
  } catch (error: any) {
    console.error('Error updating pages:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add new page
// Endpoint: POST /api/website-settings/pages
// Request: Partial<Page>
// Response: { settings: WebsiteSettings }
export const addPage = async (pageData: Omit<Page, 'id' | 'order'>) => {
  try {
    const response = await api.post('/api/website-settings/pages', pageData);
    return response.data;
  } catch (error: any) {
    console.error('Error adding page:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update specific page
// Endpoint: PUT /api/website-settings/pages/:pageId
// Request: Partial<Page>
// Response: { settings: WebsiteSettings }
export const updatePage = async (pageId: string, pageData: Partial<Page>) => {
  try {
    const response = await api.put(`/api/website-settings/pages/${pageId}`, pageData);
    return response.data;
  } catch (error: any) {
    console.error('Error updating page:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete page
// Endpoint: DELETE /api/website-settings/pages/:pageId
// Request: {}
// Response: { settings: WebsiteSettings }
export const deletePage = async (pageId: string) => {
  try {
    const response = await api.delete(`/api/website-settings/pages/${pageId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting page:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Reorder pages
// Endpoint: POST /api/website-settings/pages/reorder
// Request: { pageIds: string[] }
// Response: { settings: WebsiteSettings }
export const reorderPages = async (pageIds: string[]) => {
  try {
    const response = await api.post('/api/website-settings/pages/reorder', { pageIds });
    return response.data;
  } catch (error: any) {
    console.error('Error reordering pages:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
