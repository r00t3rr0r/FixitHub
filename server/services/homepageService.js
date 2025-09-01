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
            heading: 'Your Heading Here',
            subheading: 'Your subheading text',
            ctaText: 'Call to Action',
            ctaLink: '#',
            backgroundImage: '',
            overlayOpacity: 0.5
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
          _id: 'template_services',
          type: 'services',
          title: 'Services Grid',
          content: {
            heading: 'Our Services',
            description: 'Professional services for all your needs',
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
          _id: 'template_testimonials',
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
          _id: 'template_cta',
          type: 'cta',
          title: 'Call to Action',
          content: {
            heading: 'Ready to Get Started?',
            description: 'Contact us today for professional services',
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
}

module.exports = HomepageService;