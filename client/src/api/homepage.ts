import api from './api';

export interface ContentBlock {
  _id: string;
  type: 'hero' | 'services' | 'testimonials' | 'cta' | 'gallery' | 'banner' | 'features' | 'stats';
  title: string;
  content: any;
  settings: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    margin?: string;
    alignment?: 'left' | 'center' | 'right';
    animation?: string;
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
}

// Description: Get homepage sections and content blocks
// Endpoint: GET /api/admin/homepage/sections
// Request: {}
// Response: { sections: HomepageSection[] }
export const getHomepageSections = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        sections: [
          {
            _id: 'section1',
            name: 'Hero Section',
            blocks: [
              {
                _id: 'block1',
                type: 'hero',
                title: 'Hero Banner',
                content: {
                  heading: 'Professional Device Repair Services',
                  subheading: 'Fast, reliable, and affordable repair services for all your devices',
                  ctaText: 'Get Started',
                  ctaLink: '/new-order',
                  backgroundImage: 'https://via.placeholder.com/1920x800/3b82f6/ffffff?text=Hero+Background',
                  overlayOpacity: 0.5
                },
                settings: {
                  backgroundColor: '#3b82f6',
                  textColor: '#ffffff',
                  padding: '80px 0',
                  alignment: 'center'
                },
                order: 1,
                isVisible: true
              }
            ],
            layout: 'single',
            order: 1,
            isActive: true
          },
          {
            _id: 'section2',
            name: 'Services Section',
            blocks: [
              {
                _id: 'block2',
                type: 'services',
                title: 'Our Services',
                content: {
                  heading: 'Expert Repair Services',
                  description: 'We offer comprehensive repair services for all types of devices',
                  services: [
                    {
                      icon: 'smartphone',
                      title: 'Screen Repair',
                      description: 'Professional screen replacement with warranty'
                    },
                    {
                      icon: 'battery',
                      title: 'Battery Replacement',
                      description: 'High-quality battery replacement service'
                    },
                    {
                      icon: 'camera',
                      title: 'Camera Repair',
                      description: 'Camera module replacement and calibration'
                    }
                  ]
                },
                settings: {
                  backgroundColor: '#ffffff',
                  textColor: '#1f2937',
                  padding: '60px 0',
                  alignment: 'center'
                },
                order: 1,
                isVisible: true
              }
            ],
            layout: 'three-column',
            order: 2,
            isActive: true
          }
        ]
      });
    }, 500);
  });
};

// Description: Get available content block templates
// Endpoint: GET /api/admin/homepage/content-blocks
// Request: {}
// Response: { blocks: ContentBlock[] }
export const getContentBlockTemplates = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        blocks: [
          {
            _id: 'template1',
            type: 'hero',
            title: 'Hero Banner',
            content: {
              heading: 'Your Heading Here',
              subheading: 'Your subheading text',
              ctaText: 'Call to Action',
              ctaLink: '#'
            },
            settings: {
              backgroundColor: '#3b82f6',
              textColor: '#ffffff',
              padding: '80px 0',
              alignment: 'center'
            },
            order: 0,
            isVisible: true
          },
          {
            _id: 'template2',
            type: 'services',
            title: 'Services Grid',
            content: {
              heading: 'Our Services',
              services: []
            },
            settings: {
              backgroundColor: '#ffffff',
              textColor: '#1f2937',
              padding: '60px 0',
              alignment: 'center'
            },
            order: 0,
            isVisible: true
          },
          {
            _id: 'template3',
            type: 'testimonials',
            title: 'Customer Testimonials',
            content: {
              heading: 'What Our Customers Say',
              testimonials: []
            },
            settings: {
              backgroundColor: '#f9fafb',
              textColor: '#1f2937',
              padding: '60px 0',
              alignment: 'center'
            },
            order: 0,
            isVisible: true
          },
          {
            _id: 'template4',
            type: 'cta',
            title: 'Call to Action',
            content: {
              heading: 'Ready to Get Started?',
              description: 'Contact us today for professional repair services',
              ctaText: 'Get Quote',
              ctaLink: '/contact'
            },
            settings: {
              backgroundColor: '#10b981',
              textColor: '#ffffff',
              padding: '40px 0',
              alignment: 'center'
            },
            order: 0,
            isVisible: true
          }
        ]
      });
    }, 500);
  });
};

// Description: Get layout templates
// Endpoint: GET /api/admin/homepage/templates
// Request: {}
// Response: { templates: LayoutTemplate[] }
export const getLayoutTemplates = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        templates: [
          {
            _id: 'template1',
            name: 'Modern Business',
            description: 'Clean and professional layout for business websites',
            preview: 'https://via.placeholder.com/400x300/3b82f6/ffffff?text=Modern+Business',
            sections: [],
            colorScheme: {
              primary: '#3b82f6',
              secondary: '#1e40af',
              accent: '#10b981',
              background: '#ffffff',
              text: '#1f2937'
            },
            typography: {
              headingFont: 'Inter',
              bodyFont: 'Inter',
              fontSize: '16px'
            },
            isDefault: true
          },
          {
            _id: 'template2',
            name: 'Tech Startup',
            description: 'Modern and innovative design for tech companies',
            preview: 'https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Tech+Startup',
            sections: [],
            colorScheme: {
              primary: '#8b5cf6',
              secondary: '#7c3aed',
              accent: '#06b6d4',
              background: '#ffffff',
              text: '#1f2937'
            },
            typography: {
              headingFont: 'Poppins',
              bodyFont: 'Inter',
              fontSize: '16px'
            },
            isDefault: false
          }
        ]
      });
    }, 500);
  });
};

// Description: Save homepage sections
// Endpoint: PUT /api/admin/homepage/sections
// Request: { sections: HomepageSection[] }
// Response: { success: boolean, message: string }
export const saveHomepageSections = (sections: HomepageSection[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Homepage sections saved successfully'
      });
    }, 1000);
  });
};

// Description: Get A/B tests
// Endpoint: GET /api/admin/homepage/ab-tests
// Request: {}
// Response: { tests: ABTest[] }
export const getABTests = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        tests: [
          {
            _id: 'test1',
            name: 'Hero Section Test',
            description: 'Testing different hero section layouts',
            variants: [
              {
                _id: 'variant1',
                name: 'Original',
                description: 'Current hero section design',
                template: {} as LayoutTemplate,
                trafficPercentage: 50,
                conversions: 45,
                views: 1200,
                conversionRate: 3.75,
                isActive: true
              },
              {
                _id: 'variant2',
                name: 'New Design',
                description: 'Updated hero section with video background',
                template: {} as LayoutTemplate,
                trafficPercentage: 50,
                conversions: 62,
                views: 1180,
                conversionRate: 5.25,
                isActive: true
              }
            ],
            status: 'running',
            startDate: '2024-01-15T00:00:00Z',
            goal: 'Increase conversion rate',
            winner: 'variant2'
          }
        ]
      });
    }, 500);
  });
};

// Description: Create A/B test
// Endpoint: POST /api/admin/homepage/ab-tests
// Request: Partial<ABTest>
// Response: { success: boolean, test: ABTest }
export const createABTest = (testData: Partial<ABTest>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        test: {
          _id: 'test_' + Date.now(),
          ...testData,
          status: 'draft',
          variants: []
        }
      });
    }, 1000);
  });
};