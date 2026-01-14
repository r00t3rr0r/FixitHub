const PageContent = require('../models/PageContent');

class PageTemplateService {
  /**
   * Get all available page templates
   */
  static getTemplates() {
    return [
      {
        id: 'homepage_repair',
        name: 'Homepage - Repair Shop',
        category: 'homepage',
        description: 'Modern homepage template for device repair shops inspired by mcrepair.de',
        thumbnail: '/api/templates/homepage_repair/thumb',
        preview: '/api/templates/homepage_repair/preview'
      },
      {
        id: 'shop_grid',
        name: 'Shop - Product Grid',
        category: 'shop',
        description: 'Product grid layout with filters and categories',
        thumbnail: '/api/templates/shop_grid/thumb',
        preview: '/api/templates/shop_grid/preview'
      },
      {
        id: 'blog_list',
        name: 'Blog - Article List',
        category: 'blog',
        description: 'Blog listing page with featured articles',
        thumbnail: '/api/templates/blog_list/thumb',
        preview: '/api/templates/blog_list/preview'
      },
      {
        id: 'services_showcase',
        name: 'Services Showcase',
        category: 'services',
        description: 'Service listing with pricing and descriptions',
        thumbnail: '/api/templates/services_showcase/thumb',
        preview: '/api/templates/services_showcase/preview'
      },
      {
        id: 'contact_page',
        name: 'Contact Page',
        category: 'contact',
        description: 'Contact form with map and business information',
        thumbnail: '/api/templates/contact_page/thumb',
        preview: '/api/templates/contact_page/preview'
      }
    ];
  }

  /**
   * Get template by ID
   */
  static getTemplateById(templateId) {
    const templates = {
      homepage_repair: this.getHomepageRepairTemplate(),
      shop_grid: this.getShopGridTemplate(),
      blog_list: this.getBlogListTemplate(),
      services_showcase: this.getServicesShowcaseTemplate(),
      contact_page: this.getContactPageTemplate()
    };

    return templates[templateId] || null;
  }

  /**
   * Homepage - Repair Shop Template (mcrepair.de inspired)
   */
  static getHomepageRepairTemplate() {
    return {
      pageTitle: 'Homepage',
      pageSlug: 'home',
      sections: [
        // Hero Section
        {
          id: 'hero_section',
          name: 'Hero Section',
          type: 'hero',
          components: [
            {
              id: 'hero_bg',
              type: 'container',
              name: 'Hero Background',
              content: {},
              styles: {
                backgroundColor: '#0f172a',
                backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                padding: { top: 80, right: 20, bottom: 80, left: 20 },
                minHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              },
              order: 0
            },
            {
              id: 'hero_heading',
              type: 'heading',
              name: 'Main Heading',
              content: {
                text: 'Professional Device Repair',
                level: 'h1'
              },
              styles: {
                color: '#ffffff',
                fontSize: '3.5rem',
                fontWeight: '800',
                textAlign: 'center',
                marginBottom: '20px',
                lineHeight: '1.2'
              },
              animations: {
                entrance: 'fadeInUp',
                duration: 800,
                delay: 0
              },
              order: 1
            },
            {
              id: 'hero_subheading',
              type: 'paragraph',
              name: 'Subheading',
              content: {
                text: 'Fast, Reliable & Affordable Repairs for All Your Devices'
              },
              styles: {
                color: '#94a3b8',
                fontSize: '1.5rem',
                textAlign: 'center',
                marginBottom: '40px'
              },
              animations: {
                entrance: 'fadeInUp',
                duration: 800,
                delay: 200
              },
              order: 2
            },
            {
              id: 'hero_cta',
              type: 'button',
              name: 'CTA Button',
              content: {
                text: 'Get Your Repair Quote',
                url: '/new-order',
                variant: 'default'
              },
              styles: {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '1.125rem',
                padding: { top: 16, right: 40, bottom: 16, left: 40 },
                borderRadius: '8px',
                fontWeight: '600',
                boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
              },
              animations: {
                entrance: 'fadeInUp',
                duration: 800,
                delay: 400,
                hover: 'scale'
              },
              order: 3
            }
          ],
          styles: {
            backgroundColor: '#0f172a',
            padding: { top: 0, right: 0, bottom: 0, left: 0 }
          },
          order: 0
        },

        // Services Section
        {
          id: 'services_section',
          name: 'Our Services',
          type: 'features',
          components: [
            {
              id: 'services_heading',
              type: 'heading',
              name: 'Section Heading',
              content: {
                text: 'What We Repair',
                level: 'h2'
              },
              styles: {
                color: '#1e293b',
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '60px'
              },
              animations: {
                entrance: 'fadeIn',
                duration: 600
              },
              order: 0
            },
            {
              id: 'service_grid',
              type: 'container',
              name: 'Services Grid',
              content: {},
              styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '30px',
                padding: { top: 0, right: 20, bottom: 0, left: 20 }
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
            padding: { top: 80, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1280px',
          order: 1
        },

        // Why Choose Us Section
        {
          id: 'features_section',
          name: 'Why Choose Us',
          type: 'features',
          components: [
            {
              id: 'features_heading',
              type: 'heading',
              name: 'Section Heading',
              content: {
                text: 'Why Choose FixitHub?',
                level: 'h2'
              },
              styles: {
                color: '#ffffff',
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              animations: {
                entrance: 'fadeIn',
                duration: 600
              },
              order: 0
            },
            {
              id: 'features_subtitle',
              type: 'paragraph',
              name: 'Section Subtitle',
              content: {
                text: 'Professional service you can trust'
              },
              styles: {
                color: '#94a3b8',
                fontSize: '1.25rem',
                textAlign: 'center',
                marginBottom: '60px'
              },
              animations: {
                entrance: 'fadeIn',
                duration: 600,
                delay: 200
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#1e293b',
            padding: { top: 80, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1280px',
          order: 2
        },

        // CTA Section
        {
          id: 'cta_section',
          name: 'Call to Action',
          type: 'cta',
          components: [
            {
              id: 'cta_heading',
              type: 'heading',
              name: 'CTA Heading',
              content: {
                text: 'Ready to Fix Your Device?',
                level: 'h2'
              },
              styles: {
                color: '#1e293b',
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              order: 0
            },
            {
              id: 'cta_text',
              type: 'paragraph',
              name: 'CTA Text',
              content: {
                text: 'Get started with your repair order in just a few clicks'
              },
              styles: {
                color: '#64748b',
                fontSize: '1.25rem',
                textAlign: 'center',
                marginBottom: '40px'
              },
              order: 1
            },
            {
              id: 'cta_button',
              type: 'button',
              name: 'CTA Button',
              content: {
                text: 'Start Repair Order',
                url: '/new-order',
                variant: 'default'
              },
              styles: {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '1.125rem',
                padding: { top: 16, right: 40, bottom: 16, left: 40 },
                borderRadius: '8px',
                fontWeight: '600'
              },
              animations: {
                hover: 'scale'
              },
              order: 2
            }
          ],
          styles: {
            backgroundColor: '#f8fafc',
            padding: { top: 80, right: 40, bottom: 80, left: 40 },
            textAlign: 'center'
          },
          containerMaxWidth: '1280px',
          order: 3
        }
      ],
      globalStyles: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        backgroundColor: '#ffffff',
        textColor: '#1e293b'
      }
    };
  }

  /**
   * Shop Page Template
   */
  static getShopGridTemplate() {
    return {
      pageTitle: 'Shop',
      pageSlug: 'shop',
      sections: [
        // Header Section
        {
          id: 'shop_header',
          name: 'Shop Header',
          type: 'hero',
          components: [
            {
              id: 'shop_heading',
              type: 'heading',
              name: 'Page Heading',
              content: {
                text: 'Shop Accessories & Parts',
                level: 'h1'
              },
              styles: {
                color: '#1e293b',
                fontSize: '3rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              order: 0
            },
            {
              id: 'shop_subtitle',
              type: 'paragraph',
              name: 'Subtitle',
              content: {
                text: 'Quality parts and accessories for all your devices'
              },
              styles: {
                color: '#64748b',
                fontSize: '1.25rem',
                textAlign: 'center'
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#f8fafc',
            padding: { top: 60, right: 40, bottom: 60, left: 40 }
          },
          order: 0
        },

        // Products Grid Section
        {
          id: 'products_grid',
          name: 'Products Grid',
          type: 'gallery',
          components: [
            {
              id: 'products_container',
              type: 'container',
              name: 'Products Container',
              content: {
                text: 'Products will be loaded dynamically from the shop'
              },
              styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '30px',
                padding: { top: 40, right: 20, bottom: 40, left: 20 }
              },
              order: 0
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
            padding: { top: 40, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1400px',
          order: 1
        }
      ],
      globalStyles: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        backgroundColor: '#ffffff',
        textColor: '#1e293b'
      }
    };
  }

  /**
   * Blog List Template
   */
  static getBlogListTemplate() {
    return {
      pageTitle: 'Blog',
      pageSlug: 'blog',
      sections: [
        // Blog Header
        {
          id: 'blog_header',
          name: 'Blog Header',
          type: 'hero',
          components: [
            {
              id: 'blog_heading',
              type: 'heading',
              name: 'Page Heading',
              content: {
                text: 'Blog & News',
                level: 'h1'
              },
              styles: {
                color: '#1e293b',
                fontSize: '3rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              order: 0
            },
            {
              id: 'blog_subtitle',
              type: 'paragraph',
              name: 'Subtitle',
              content: {
                text: 'Tips, guides, and news about device repair and technology'
              },
              styles: {
                color: '#64748b',
                fontSize: '1.25rem',
                textAlign: 'center'
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#f8fafc',
            padding: { top: 60, right: 40, bottom: 60, left: 40 }
          },
          order: 0
        },

        // Blog Articles
        {
          id: 'blog_articles',
          name: 'Blog Articles',
          type: 'gallery',
          components: [
            {
              id: 'articles_container',
              type: 'container',
              name: 'Articles Container',
              content: {
                text: 'Blog articles will be loaded dynamically'
              },
              styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '40px',
                padding: { top: 40, right: 20, bottom: 40, left: 20 }
              },
              order: 0
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
            padding: { top: 40, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1280px',
          order: 1
        }
      ],
      globalStyles: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        backgroundColor: '#ffffff',
        textColor: '#1e293b'
      }
    };
  }

  /**
   * Services Showcase Template
   */
  static getServicesShowcaseTemplate() {
    return {
      pageTitle: 'Our Services',
      pageSlug: 'services',
      sections: [
        // Services Header
        {
          id: 'services_header',
          name: 'Services Header',
          type: 'hero',
          components: [
            {
              id: 'services_heading',
              type: 'heading',
              name: 'Page Heading',
              content: {
                text: 'Professional Repair Services',
                level: 'h1'
              },
              styles: {
                color: '#ffffff',
                fontSize: '3rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              order: 0
            },
            {
              id: 'services_subtitle',
              type: 'paragraph',
              name: 'Subtitle',
              content: {
                text: 'Expert repairs for smartphones, tablets, laptops, and more'
              },
              styles: {
                color: '#94a3b8',
                fontSize: '1.25rem',
                textAlign: 'center'
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#1e293b',
            backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: { top: 80, right: 40, bottom: 80, left: 40 }
          },
          order: 0
        },

        // Services List
        {
          id: 'services_list',
          name: 'Services List',
          type: 'features',
          components: [
            {
              id: 'services_container',
              type: 'container',
              name: 'Services Container',
              content: {
                text: 'Services will be loaded dynamically'
              },
              styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '30px'
              },
              order: 0
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
            padding: { top: 60, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1280px',
          order: 1
        }
      ],
      globalStyles: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        backgroundColor: '#ffffff',
        textColor: '#1e293b'
      }
    };
  }

  /**
   * Contact Page Template
   */
  static getContactPageTemplate() {
    return {
      pageTitle: 'Contact Us',
      pageSlug: 'contact',
      sections: [
        // Contact Header
        {
          id: 'contact_header',
          name: 'Contact Header',
          type: 'hero',
          components: [
            {
              id: 'contact_heading',
              type: 'heading',
              name: 'Page Heading',
              content: {
                text: 'Get in Touch',
                level: 'h1'
              },
              styles: {
                color: '#1e293b',
                fontSize: '3rem',
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: '20px'
              },
              order: 0
            },
            {
              id: 'contact_subtitle',
              type: 'paragraph',
              name: 'Subtitle',
              content: {
                text: 'We\'re here to help with all your device repair needs'
              },
              styles: {
                color: '#64748b',
                fontSize: '1.25rem',
                textAlign: 'center'
              },
              order: 1
            }
          ],
          styles: {
            backgroundColor: '#f8fafc',
            padding: { top: 60, right: 40, bottom: 60, left: 40 }
          },
          order: 0
        },

        // Contact Form Section
        {
          id: 'contact_form',
          name: 'Contact Form',
          type: 'contact',
          components: [
            {
              id: 'form_container',
              type: 'form',
              name: 'Contact Form',
              content: {
                fields: [
                  { name: 'name', type: 'text', label: 'Your Name', required: true },
                  { name: 'email', type: 'email', label: 'Email Address', required: true },
                  { name: 'phone', type: 'tel', label: 'Phone Number' },
                  { name: 'message', type: 'textarea', label: 'Message', required: true }
                ],
                submitText: 'Send Message'
              },
              styles: {
                maxWidth: '600px',
                margin: '0 auto'
              },
              order: 0
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
            padding: { top: 60, right: 40, bottom: 80, left: 40 }
          },
          containerMaxWidth: '1280px',
          order: 1
        }
      ],
      globalStyles: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        backgroundColor: '#ffffff',
        textColor: '#1e293b'
      }
    };
  }

  /**
   * Apply template to page
   */
  static async applyTemplate(pageId, templateId, userId) {
    try {
      console.log(`Applying template ${templateId} to page ${pageId}`);

      const templateData = this.getTemplateById(templateId);
      if (!templateData) {
        throw new Error('Template not found');
      }

      // Create or update PageContent with template data
      const pageContent = await PageContent.findOne({ pageId });

      if (pageContent) {
        // Update existing page
        pageContent.sections = templateData.sections;
        pageContent.globalStyles = templateData.globalStyles;
        pageContent.updatedBy = userId;
        await pageContent.save();
      } else {
        // Create new page
        await PageContent.createPage({
          pageId,
          pageTitle: templateData.pageTitle,
          pageSlug: templateData.pageSlug,
          sections: templateData.sections,
          globalStyles: templateData.globalStyles
        }, userId);
      }

      console.log(`Template ${templateId} applied successfully to page ${pageId}`);
      return { success: true, message: 'Template applied successfully' };
    } catch (error) {
      console.error('Error applying template:', error);
      throw error;
    }
  }
}

module.exports = PageTemplateService;
