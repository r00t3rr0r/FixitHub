const { LayoutTemplate, ABTest } = require('../models/Homepage');

class HomepageService {
  // Get homepage sections (from default template)
  static async getHomepageSections() {
    console.log('HomepageService: Getting homepage sections');

    try {
      const defaultTemplate = await LayoutTemplate.findOne({ isDefault: true });

      if (!defaultTemplate) {
        console.log('HomepageService: No default template found, returning empty sections');
        return { sections: [] };
      }

      console.log('HomepageService: Found default template with', defaultTemplate.sections.length, 'sections');
      return { sections: defaultTemplate.sections };
    } catch (error) {
      console.error('HomepageService: Error getting homepage sections:', error);
      throw error;
    }
  }

  // Get content block templates
  static async getContentBlockTemplates() {
    console.log('HomepageService: Getting content block templates');

    try {
      const templates = [
        {
          _id: 'template_hero',
          type: 'hero',
          title: 'Hero Banner',
          content: {
            heading: 'Fix Your Device Like New Again',
            subheading: 'Fast, reliable, and affordable repair services for all your devices. Expert technicians, quality parts, and warranty included.',
            ctaText: 'Start Repair Order',
            ctaLink: '/register',
            secondaryCtaText: 'Watch Demo',
            secondaryCtaLink: '/login',
            backgroundImage: '',
            overlayOpacity: 0.5,
            stats: [
              { value: '10K+', label: 'Devices Repaired' },
              { value: '4.9★', label: 'Customer Rating' },
              { value: '24h', label: 'Average Turnaround' }
            ],
            features: [
              { icon: 'CheckCircle', title: 'Free Diagnostics', description: 'Complete device assessment' },
              { icon: 'Shield', title: 'Warranty Included', description: '90-day repair guarantee' },
              { icon: 'Clock', title: 'Quick Turnaround', description: 'Most repairs in 24 hours' }
            ]
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
          _id: 'template_about',
          type: 'about',
          title: 'About Section',
          content: {
            heading: 'About RepairService',
            description: 'We are a leading repair service company dedicated to bringing your devices back to life with professional expertise and quality parts.',
            services: [
              { icon: 'Smartphone', title: 'Phone Repair', description: 'Screen replacement, battery repair, water damage recovery' },
              { icon: 'Laptop', title: 'Computer Repair', description: 'Hardware diagnostics, software troubleshooting, data recovery' },
              { icon: 'Tablet', title: 'Tablet Repair', description: 'Screen repair, charging port fix, performance optimization' },
              { icon: 'Headphones', title: 'Audio Devices', description: 'Headphone repair, speaker fix, microphone replacement' },
              { icon: 'Watch', title: 'Wearables', description: 'Smartwatch repair, fitness tracker fix, band replacement' },
              { icon: 'GameController', title: 'Gaming Devices', description: 'Console repair, controller fix, gaming accessories' }
            ],
            companyInfo: {
              founded: '2020',
              experience: '5+ Years',
              technicians: '50+ Experts',
              locations: '10+ Cities'
            }
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
          _id: 'template_services',
          type: 'services',
          title: 'Services Grid',
          content: {
            heading: 'Our Repair Services',
            description: 'Professional repair services for all major device brands with quality parts and expert technicians',
            displayType: 'dynamic', // 'dynamic' fetches from API, 'static' uses predefined list
            maxItems: 6,
            showPricing: true,
            showRating: true,
            showEstimatedTime: true,
            ctaText: 'Get Quote',
            ctaLink: '/register'
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
          _id: 'template_blog',
          type: 'blog',
          title: 'Blog Section',
          content: {
            heading: 'Repair Tips & Guides',
            description: 'Expert advice to help you maintain and care for your devices',
            displayType: 'dynamic', // 'dynamic' fetches from API, 'static' uses predefined list
            maxItems: 3,
            showFeatured: true,
            showAuthor: true,
            showDate: true,
            showExcerpt: true,
            ctaText: 'View All Articles',
            ctaLink: '/blog'
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
          _id: 'template_shop',
          type: 'shop',
          title: 'Shop Section',
          content: {
            heading: 'Featured Products',
            description: 'Quality repair parts, accessories, and kits for all your device needs',
            displayType: 'dynamic', // 'dynamic' fetches from API, 'static' uses predefined list
            maxItems: 6,
            showFeatured: true,
            showPrice: true,
            showRating: true,
            showStock: true,
            ctaText: 'Add to Cart',
            shopCtaText: 'View All Products',
            shopCtaLink: '/shop'
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
          _id: 'template_testimonials',
          type: 'testimonials',
          title: 'Customer Testimonials',
          content: {
            heading: 'What Our Customers Say',
            description: 'Thousands of satisfied customers trust us with their devices',
            testimonials: [
              {
                name: "Sarah Johnson",
                role: "Business Owner",
                avatar: "https://via.placeholder.com/60x60/3b82f6/ffffff?text=SJ",
                rating: 5,
                review: "Incredible service! My iPhone was fixed in just 2 hours and works perfectly. The staff was professional and the price was very reasonable."
              },
              {
                name: "Mike Chen",
                role: "Student",
                avatar: "https://via.placeholder.com/60x60/10b981/ffffff?text=MC",
                rating: 5,
                review: "Best repair shop in town! They fixed my laptop screen and it looks brand new. Fast service and great warranty coverage."
              },
              {
                name: "Emily Davis",
                role: "Teacher",
                avatar: "https://via.placeholder.com/60x60/8b5cf6/ffffff?text=ED",
                rating: 5,
                review: "Amazing experience from start to finish. Online booking was easy, updates were frequent, and my device was ready ahead of schedule."
              }
            ]
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
          _id: 'template_contact',
          type: 'contact',
          title: 'Contact & Booking',
          content: {
            heading: 'Get Your Device Repaired Today',
            description: 'Contact us for a free quote or book your repair service online',
            showContactForm: true,
            showBookingWidget: true,
            showContactInfo: true,
            showMap: true,
            contactInfo: {
              phone: '+1 (555) 123-4567',
              email: 'info@repairservice.com',
              address: '123 Repair Street, Tech City, TC 12345',
              hours: {
                weekdays: '9:00 AM - 7:00 PM',
                weekends: '10:00 AM - 5:00 PM'
              }
            },
            formFields: [
              { name: 'name', label: 'Full Name', type: 'text', required: true },
              { name: 'email', label: 'Email Address', type: 'email', required: true },
              { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
              { name: 'device', label: 'Device Type', type: 'select', required: true, options: ['iPhone', 'Android', 'Laptop', 'Tablet', 'Other'] },
              { name: 'issue', label: 'Issue Description', type: 'textarea', required: true }
            ],
            ctaText: 'Book Repair',
            ctaLink: '/register'
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
          _id: 'template_cta',
          type: 'cta',
          title: 'Call to Action',
          content: {
            heading: 'Ready to Fix Your Device?',
            description: 'Join thousands of satisfied customers who trust us with their device repairs. Get started today with our free diagnostic service.',
            ctaText: 'Start Your Repair',
            ctaLink: '/register',
            secondaryCtaText: 'Login to Account',
            secondaryCtaLink: '/login',
            features: [
              'Free diagnostic service',
              '90-day warranty included',
              'Expert certified technicians',
              'Same-day service available'
            ]
          },
          settings: {
            backgroundColor: '#10b981',
            textColor: '#ffffff',
            padding: '60px 0',
            alignment: 'center'
          },
          order: 0,
          isVisible: true
        },
        {
          _id: 'template_footer',
          type: 'footer',
          title: 'Footer',
          content: {
            companyName: 'RepairService',
            tagline: 'Professional device repair services you can trust',
            logo: '/logo.png',
            navigation: {
              main: [
                { label: 'Home', link: '/' },
                { label: 'Services', link: '/services' },
                { label: 'Blog', link: '/blog' },
                { label: 'Shop', link: '/shop' },
                { label: 'Contact', link: '/contact' }
              ],
              services: [
                { label: 'Phone Repair', link: '/services/phone' },
                { label: 'Computer Repair', link: '/services/computer' },
                { label: 'Tablet Repair', link: '/services/tablet' },
                { label: 'Data Recovery', link: '/services/data-recovery' }
              ],
              support: [
                { label: 'FAQ', link: '/faq' },
                { label: 'Warranty', link: '/warranty' },
                { label: 'Track Repair', link: '/track' },
                { label: 'Support', link: '/support' }
              ]
            },
            socialMedia: [
              { platform: 'facebook', url: 'https://facebook.com/repairservice', icon: 'Facebook' },
              { platform: 'twitter', url: 'https://twitter.com/repairservice', icon: 'Twitter' },
              { platform: 'instagram', url: 'https://instagram.com/repairservice', icon: 'Instagram' },
              { platform: 'linkedin', url: 'https://linkedin.com/company/repairservice', icon: 'Linkedin' }
            ],
            newsletter: {
              enabled: true,
              title: 'Stay Updated',
              description: 'Get repair tips and special offers delivered to your inbox',
              placeholder: 'Enter your email address'
            },
            contactInfo: {
              phone: '+1 (555) 123-4567',
              email: 'info@repairservice.com',
              address: '123 Repair Street, Tech City, TC 12345'
            },
            copyright: '© 2024 RepairService. All rights reserved.',
            legalLinks: [
              { label: 'Privacy Policy', link: '/privacy' },
              { label: 'Terms of Service', link: '/terms' },
              { label: 'Cookie Policy', link: '/cookies' }
            ]
          },
          settings: {
            backgroundColor: '#1f2937',
            textColor: '#ffffff',
            padding: '40px 0 20px 0',
            alignment: 'left'
          },
          order: 0,
          isVisible: true
        },
        {
          _id: 'template_html',
          type: 'html',
          title: 'Custom HTML',
          content: {
            html: '<div class="custom-content"><h2>Custom HTML Content</h2><p>Add your custom HTML here</p></div>'
          },
          settings: {
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            padding: '20px 0',
            alignment: 'left'
          },
          order: 0,
          isVisible: true
        }
      ];

      console.log('HomepageService: Returning', templates.length, 'content block templates');
      return { blocks: templates };
    } catch (error) {
      console.error('HomepageService: Error getting content block templates:', error);
      throw error;
    }
  }

  // Get layout templates
  static async getLayoutTemplates() {
    console.log('HomepageService: Getting layout templates');

    try {
      const templates = await LayoutTemplate.find({}).populate('createdBy', 'name email');
      console.log('HomepageService: Found', templates.length, 'layout templates');
      return { templates };
    } catch (error) {
      console.error('HomepageService: Error getting layout templates:', error);
      throw error;
    }
  }

  // Save homepage sections (update default template)
  static async saveHomepageSections(sections, userId) {
    console.log('HomepageService: Saving homepage sections for user:', userId);

    try {
      let defaultTemplate = await LayoutTemplate.findOne({ isDefault: true });

      if (!defaultTemplate) {
        // Create default template if it doesn't exist
        defaultTemplate = new LayoutTemplate({
          name: 'Default Template',
          description: 'Default homepage template',
          sections: sections,
          isDefault: true,
          createdBy: userId
        });
      } else {
        defaultTemplate.sections = sections;
        defaultTemplate.updatedAt = new Date();
      }

      await defaultTemplate.save();
      console.log('HomepageService: Homepage sections saved successfully');
      return { success: true, message: 'Homepage sections saved successfully' };
    } catch (error) {
      console.error('HomepageService: Error saving homepage sections:', error);
      throw error;
    }
  }

  // Get A/B tests
  static async getABTests() {
    console.log('HomepageService: Getting A/B tests');

    try {
      const tests = await ABTest.find({})
        .populate('createdBy', 'name email')
        .populate('variants.template');

      console.log('HomepageService: Found', tests.length, 'A/B tests');
      return { tests };
    } catch (error) {
      console.error('HomepageService: Error getting A/B tests:', error);
      throw error;
    }
  }

  // Create A/B test
  static async createABTest(testData, userId) {
    console.log('HomepageService: Creating A/B test:', testData.name);

    try {
      const abTest = new ABTest({
        ...testData,
        createdBy: userId,
        status: 'draft',
        variants: []
      });

      await abTest.save();
      console.log('HomepageService: A/B test created successfully with ID:', abTest._id);
      return { success: true, test: abTest };
    } catch (error) {
      console.error('HomepageService: Error creating A/B test:', error);
      throw error;
    }
  }

  // Create layout template
  static async createLayoutTemplate(templateData, userId) {
    console.log('HomepageService: Creating layout template:', templateData.name);

    try {
      const template = new LayoutTemplate({
        ...templateData,
        createdBy: userId
      });

      await template.save();
      console.log('HomepageService: Layout template created successfully with ID:', template._id);
      return { success: true, template };
    } catch (error) {
      console.error('HomepageService: Error creating layout template:', error);
      throw error;
    }
  }

  // Update layout template
  static async updateLayoutTemplate(templateId, templateData) {
    console.log('HomepageService: Updating layout template:', templateId);

    try {
      const template = await LayoutTemplate.findByIdAndUpdate(
        templateId,
        { ...templateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!template) {
        throw new Error('Layout template not found');
      }

      console.log('HomepageService: Layout template updated successfully');
      return { success: true, template };
    } catch (error) {
      console.error('HomepageService: Error updating layout template:', error);
      throw error;
    }
  }

  // Delete layout template
  static async deleteLayoutTemplate(templateId) {
    console.log('HomepageService: Deleting layout template:', templateId);

    try {
      const template = await LayoutTemplate.findById(templateId);

      if (!template) {
        throw new Error('Layout template not found');
      }

      if (template.isDefault) {
        throw new Error('Cannot delete default template');
      }

      await LayoutTemplate.findByIdAndDelete(templateId);
      console.log('HomepageService: Layout template deleted successfully');
      return { success: true, message: 'Layout template deleted successfully' };
    } catch (error) {
      console.error('HomepageService: Error deleting layout template:', error);
      throw error;
    }
  }

  // Set default template
  static async setDefaultTemplate(templateId) {
    console.log('HomepageService: Setting default template:', templateId);

    try {
      // Remove default flag from all templates
      await LayoutTemplate.updateMany({}, { isDefault: false });

      // Set new default template
      const template = await LayoutTemplate.findByIdAndUpdate(
        templateId,
        { isDefault: true, updatedAt: new Date() },
        { new: true }
      );

      if (!template) {
        throw new Error('Layout template not found');
      }

      console.log('HomepageService: Default template set successfully');
      return { success: true, template };
    } catch (error) {
      console.error('HomepageService: Error setting default template:', error);
      throw error;
    }
  }

  // Get current homepage structure (for admin editing)
  static async getCurrentHomepageStructure() {
    console.log('HomepageService: Getting current homepage structure for admin');

    try {
      const defaultTemplate = await LayoutTemplate.findOne({ isDefault: true });

      if (!defaultTemplate) {
        console.log('HomepageService: No default template found, returning empty sections');
        return { success: true, sections: [] };
      }

      console.log('HomepageService: Found default template with', defaultTemplate.sections.length, 'sections');
      return { success: true, sections: defaultTemplate.sections };
    } catch (error) {
      console.error('HomepageService: Error getting current homepage structure:', error);
      throw error;
    }
  }

  // Initialize current homepage structure (create default if not exists)
  static async initializeCurrentHomepage(defaultSections, userId) {
    console.log('HomepageService: Initializing current homepage structure');

    try {
      // Check if default template exists
      let defaultTemplate = await LayoutTemplate.findOne({ isDefault: true });

      if (defaultTemplate) {
        console.log('HomepageService: Default template already exists');
        return { success: true, sections: defaultTemplate.sections };
      }

      // Create default template with provided sections
      defaultTemplate = new LayoutTemplate({
        name: 'Default Homepage',
        description: 'Default homepage layout with all sections',
        sections: defaultSections,
        isDefault: true,
        isPublished: true,
        createdBy: userId
      });

      await defaultTemplate.save();
      console.log('HomepageService: Default homepage template initialized successfully');
      return { success: true, sections: defaultTemplate.sections };
    } catch (error) {
      console.error('HomepageService: Error initializing current homepage:', error);
      throw error;
    }
  }
}

module.exports = HomepageService;