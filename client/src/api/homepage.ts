import api from './api';

export interface ContentBlock {
  _id: string;
  type: 'hero' | 'services' | 'testimonials' | 'cta' | 'gallery' | 'banner' | 'features' | 'stats' | 'html';
  title: string;
  content: any;
  settings: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    margin?: string;
    alignment?: 'left' | 'center' | 'right';
    animation?: string;
    customCSS?: string;
    // Advanced visual settings
    opacity?: number;
    borderRadius?: string;
    borderWidth?: string;
    borderColor?: string;
    borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
    boxShadow?: string;
    transform?: string;
    transition?: string;
    zIndex?: number;
    overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
    filter?: string;
    backdropFilter?: string;
    gradient?: {
      enabled: boolean;
      type: 'linear' | 'radial';
      direction: string;
      colors: string[];
    };
    visualEffects?: {
      blur?: number;
      brightness?: number;
      contrast?: number;
      saturate?: number;
      hueRotate?: number;
      sepia?: number;
      grayscale?: number;
    };
    hover?: {
      backgroundColor?: string;
      textColor?: string;
      transform?: string;
      opacity?: number;
      transition?: string;
    };
  };
  order: number;
  isVisible: boolean;
}

export interface HomepageSection {
  _id: string;
  name: string;
  blocks: ContentBlock[];
  layout: 'single' | 'two-column' | 'three-column' | 'grid';
  order: number;
  isActive: boolean;
  settings?: {
    backgroundColor?: string;
    textColor?: string;
    backgroundImage?: string;
    padding?: string;
    margin?: string;
    minHeight?: string;
    maxWidth?: string;
    gap?: string;
    opacity?: number;
    borderRadius?: string;
    borderWidth?: string;
    borderColor?: string;
    borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
    boxShadow?: string;
    transform?: string;
    transition?: string;
    zIndex?: number;
    overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
    filter?: string;
    backdropFilter?: string;
    gradient?: {
      enabled: boolean;
      type: 'linear' | 'radial';
      direction: string;
      colors: string[];
    };
    visualEffects?: {
      blur?: number;
      brightness?: number;
      contrast?: number;
      saturate?: number;
      hueRotate?: number;
      sepia?: number;
      grayscale?: number;
    };
    customHTML?: string;
    customCSS?: string;
  };
}

export interface LayoutTemplate {
  _id: string;
  name: string;
  description: string;
  preview: string;
  sections: HomepageSection[];
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    fontSize: string;
  };
  isDefault: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ABTestVariant {
  _id: string;
  name: string;
  description: string;
  template: LayoutTemplate;
  trafficPercentage: number;
  conversions: number;
  views: number;
  conversionRate: number;
  isActive: boolean;
}

export interface ABTest {
  _id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  goal: string;
  winner?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Description: Get homepage sections and content blocks (public endpoint)
// Endpoint: GET /api/homepage/sections
// Request: {}
// Response: { success: boolean, sections: HomepageSection[] }
export const getHomepageSections = async () => {
  try {
    const response = await api.get('/api/homepage/sections');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available content block templates (admin only)
// Endpoint: GET /api/admin/homepage/content-blocks
// Request: {}
// Response: { success: boolean, blocks: ContentBlock[] }
export const getContentBlockTemplates = async () => {
  try {
    const response = await api.get('/api/admin/homepage/content-blocks');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get layout templates (admin only)
// Endpoint: GET /api/admin/homepage/templates
// Request: {}
// Response: { success: boolean, templates: LayoutTemplate[] }
export const getLayoutTemplates = async () => {
  try {
    const response = await api.get('/api/admin/homepage/templates');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Save homepage sections (admin only)
// Endpoint: PUT /api/admin/homepage/sections
// Request: { sections: HomepageSection[] }
// Response: { success: boolean, message: string }
export const saveHomepageSections = async (sections: HomepageSection[]) => {
  try {
    const response = await api.put('/api/admin/homepage/sections', { sections });
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get A/B tests (admin only)
// Endpoint: GET /api/admin/homepage/ab-tests
// Request: {}
// Response: { success: boolean, tests: ABTest[] }
export const getABTests = async () => {
  try {
    const response = await api.get('/api/admin/homepage/ab-tests');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create A/B test (admin only)
// Endpoint: POST /api/admin/homepage/ab-tests
// Request: Partial<ABTest>
// Response: { success: boolean, test: ABTest }
export const createABTest = async (testData: Partial<ABTest>) => {
  try {
    const response = await api.post('/api/admin/homepage/ab-tests', testData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create layout template (admin only)
// Endpoint: POST /api/admin/homepage/templates
// Request: Partial<LayoutTemplate>
// Response: { success: boolean, template: LayoutTemplate }
export const createLayoutTemplate = async (templateData: Partial<LayoutTemplate>) => {
  try {
    const response = await api.post('/api/admin/homepage/templates', templateData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update layout template (admin only)
// Endpoint: PUT /api/admin/homepage/templates/:id
// Request: Partial<LayoutTemplate>
// Response: { success: boolean, template: LayoutTemplate }
export const updateLayoutTemplate = async (templateId: string, templateData: Partial<LayoutTemplate>) => {
  try {
    const response = await api.put(`/api/admin/homepage/templates/${templateId}`, templateData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete layout template (admin only)
// Endpoint: DELETE /api/admin/homepage/templates/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteLayoutTemplate = async (templateId: string) => {
  try {
    const response = await api.delete(`/api/admin/homepage/templates/${templateId}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Set default template (admin only)
// Endpoint: POST /api/admin/homepage/templates/:id/set-default
// Request: {}
// Response: { success: boolean, template: LayoutTemplate }
export const setDefaultTemplate = async (templateId: string) => {
  try {
    const response = await api.post(`/api/admin/homepage/templates/${templateId}/set-default`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Initialize current homepage structure (admin only)
// Loads the default homepage configuration with all current sections
// Endpoint: POST /api/admin/homepage/initialize
// Request: {}
// Response: { success: boolean, sections: HomepageSection[] }
export const initializeCurrentHomepage = async () => {
  try {
    const response = await api.post('/api/admin/homepage/initialize');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get current homepage structure (admin only)
// Retrieves the editable homepage configuration
// Endpoint: GET /api/admin/homepage/current
// Request: {}
// Response: { success: boolean, sections: HomepageSection[] }
export const getCurrentHomepageStructure = async () => {
  try {
    const response = await api.get('/api/admin/homepage/current');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Default homepage sections template
export const getDefaultHomepageSections = (): HomepageSection[] => [
  {
    _id: 'section_topbar',
    name: 'Top Bar',
    blocks: [
      {
        _id: 'block_topbar',
        type: 'banner',
        title: 'Top Bar Info',
        content: {
          text: 'Hotline & Location Info',
          bannerType: 'info'
        },
        settings: {
          backgroundColor: '#ffffff',
          textColor: '#636e85',
          padding: '6px 0',
          margin: '0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 0,
    isActive: true,
    settings: {
      backgroundColor: '#ffffff',
      borderColor: '#d8dce6',
      borderWidth: '1px',
      borderStyle: 'solid'
    }
  },
  {
    _id: 'section_navigation',
    name: 'Main Navigation',
    blocks: [
      {
        _id: 'block_nav',
        type: 'banner',
        title: 'McRepair Navigation',
        content: {
          text: 'Sticky Navigation Bar',
          bannerType: 'info'
        },
        settings: {
          backgroundColor: '#1a2a5e',
          textColor: '#ffffff',
          padding: '16px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 1,
    isActive: true,
    settings: {
      backgroundColor: '#1a2a5e',
      padding: '0',
      position: 'sticky'
    }
  },
  {
    _id: 'section_hero',
    name: 'Hero Section',
    blocks: [
      {
        _id: 'block_hero',
        type: 'hero',
        title: 'Device Selection Hero',
        content: {
          heading: 'Reparaturlösung für dein Gerät',
          subheading: 'Schnell, zuverlässig und professionell',
          ctaText: 'Jetzt Reparatur starten',
          ctaLink: '/repair'
        },
        settings: {
          backgroundColor: '#ffffff',
          textColor: '#2d3748',
          padding: '80px 0',
          alignment: 'center'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 2,
    isActive: true,
    settings: {
      backgroundColor: '#ffffff',
      padding: '0'
    }
  },
  {
    _id: 'section_trust',
    name: 'Trust Section',
    blocks: [
      {
        _id: 'block_trust',
        type: 'features',
        title: 'Trust Row',
        content: {
          heading: 'Warum uns vertrauen?',
          maxItems: 4,
          displayStyle: 'icons'
        },
        settings: {
          backgroundColor: '#f8f9fc',
          textColor: '#2d3748',
          padding: '40px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 3,
    isActive: true,
    settings: {
      backgroundColor: '#f8f9fc',
      padding: '40px 0'
    }
  },
  {
    _id: 'section_offers',
    name: 'Special Offers',
    blocks: [
      {
        _id: 'block_offers',
        type: 'banner',
        title: 'Special Offers Section',
        content: {
          text: 'Spezielle Angebote und Promotionen',
          bannerType: 'promotion'
        },
        settings: {
          backgroundColor: '#f5b800',
          textColor: '#1a2a5e',
          padding: '40px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 4,
    isActive: true,
    settings: {
      backgroundColor: '#f5b800',
      padding: '40px 0'
    }
  },
  {
    _id: 'section_services',
    name: 'Services Overview',
    blocks: [
      {
        _id: 'block_services',
        type: 'services',
        title: 'Services Process',
        content: {
          heading: 'Unser Reparaturprozess',
          description: 'Folgen Sie unseren einfachen Schritten',
          displayType: 'static',
          maxItems: 6
        },
        settings: {
          backgroundColor: '#ffffff',
          textColor: '#2d3748',
          padding: '60px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 5,
    isActive: true,
    settings: {
      backgroundColor: '#ffffff',
      padding: '60px 0'
    }
  },
  {
    _id: 'section_shop',
    name: 'Shop Section',
    blocks: [
      {
        _id: 'block_shop',
        type: 'shop',
        title: 'Shop Products',
        content: {
          heading: 'Ersatzteile und Zubehör',
          description: 'Qualitätsprodukte für deine Reparatur',
          maxItems: 6,
          category: 'all'
        },
        settings: {
          backgroundColor: '#f8f9fc',
          textColor: '#2d3748',
          padding: '60px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 6,
    isActive: true,
    settings: {
      backgroundColor: '#f8f9fc',
      padding: '60px 0'
    }
  },
  {
    _id: 'section_blog',
    name: 'Blog Section',
    blocks: [
      {
        _id: 'block_blog',
        type: 'blog',
        title: 'Blog Posts',
        content: {
          heading: 'Tipps und Trick aus unserem Blog',
          maxItems: 3
        },
        settings: {
          backgroundColor: '#ffffff',
          textColor: '#2d3748',
          padding: '60px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 7,
    isActive: true,
    settings: {
      backgroundColor: '#ffffff',
      padding: '60px 0'
    }
  },
  {
    _id: 'section_cta',
    name: 'Call to Action',
    blocks: [
      {
        _id: 'block_cta',
        type: 'cta',
        title: 'Final CTA',
        content: {
          heading: 'Bereit für deine Reparatur?',
          description: 'Kontaktiere uns noch heute',
          buttonText: 'Jetzt buchen',
          buttonLink: '/booking'
        },
        settings: {
          backgroundColor: '#1a2a5e',
          textColor: '#ffffff',
          padding: '60px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 8,
    isActive: true,
    settings: {
      backgroundColor: '#1a2a5e',
      padding: '60px 0'
    }
  },
  {
    _id: 'section_footer',
    name: 'Footer',
    blocks: [
      {
        _id: 'block_footer',
        type: 'footer',
        title: 'Footer Section',
        content: {
          companyName: 'McRepair',
          tagline: 'Dein Reparaturexperte',
          copyright: '© 2024 McRepair. Alle Rechte vorbehalten.'
        },
        settings: {
          backgroundColor: '#1a202c',
          textColor: '#ffffff',
          padding: '40px 0'
        },
        order: 0,
        isVisible: true
      }
    ],
    layout: 'single',
    order: 9,
    isActive: true,
    settings: {
      backgroundColor: '#1a202c',
      padding: '40px 0'
    }
  }
];