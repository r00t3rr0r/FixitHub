const User = require('../models/User');
const { BlogPost, BlogCategory, BlogTag } = require('../models/BlogPost');
const FAQ = require('../models/FAQ');
const { HomepageSection } = require('../models/Homepage');
const { WorkflowTemplate } = require('../models/Workflow');
const Language = require('../models/Language');
const SystemConfiguration = require('../models/SystemConfiguration');
const SEOSettings = require('../models/SEOSettings');
const { generatePasswordHash } = require('../utils/password');
const {
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
  getDefaultNotificationTemplates
} = require('./defaultNotificationTemplates');

/**
 * SeedService — focused seeding for FixitHub.
 *
 * Seeds (in execution order):
 *   1. System configuration (incl. e-mail / notification templates)
 *   2. Admin user
 *   3. Languages (English, German)
 *   4. Homepage template (sections)
 *   5. Workflow templates
 *   6. Blog (categories, tags, posts)
 *   7. FAQs
 *   8. SEO settings
 *
 * Removed (intentionally not seeded anymore):
 *   - test users, services, add-on services, service categories,
 *     device brands/models, inventory (parts), products, e-part orders,
 *     bookings, financial / invoice data, German content variants.
 */
class SeedService {
  // -----------------------------------------------------------------------
  // Admin user
  // -----------------------------------------------------------------------
  static async seedAdminUser() {
    try {
      console.log('SeedService.seedAdminUser: Starting admin user seeding...');

      const existingAdmin = await User.findOne({ email: 'admin@example.com' });
      if (existingAdmin) {
        existingAdmin.password = await generatePasswordHash('admin123');
        await existingAdmin.save();
        console.log('SeedService.seedAdminUser: Admin user already exists, password refreshed');
        return { message: 'Admin user already exists', user: existingAdmin };
      }

      const adminUser = new User({
        email: 'admin@example.com',
        password: await generatePasswordHash('admin123'),
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        phone: '+1-555-0001',
        role: 'admin',
        department: 'Administration',
        isActive: true
      });

      await adminUser.save();
      console.log('SeedService.seedAdminUser: Admin user created successfully:', adminUser._id);
      return { message: 'Admin user created successfully', user: adminUser };
    } catch (error) {
      console.error('SeedService.seedAdminUser: Error creating admin user:', error);
      throw error;
    }
  }

  static async seedAdmin() {
    return await this.seedAdminUser();
  }

  static async getAdminUser() {
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const result = await this.seedAdminUser();
      admin = result.user;
    }
    return admin;
  }

  // -----------------------------------------------------------------------
  // System configuration (includes e-mail / notification templates)
  // -----------------------------------------------------------------------
  static async seedSystemConfiguration() {
    try {
      console.log('SeedService.seedSystemConfiguration: Starting system configuration seeding...');

      const existingConfig = await SystemConfiguration.findOne({});
      if (existingConfig) {
        console.log('SeedService.seedSystemConfiguration: System configuration already exists');
        return { message: 'System configuration verified' };
      }

      const systemConfig = new SystemConfiguration({
        siteName: 'FixitHub',
        adminEmail: 'admin@fixithub.com',
        timezone: 'UTC',
        maintenanceMode: false,
        templateLinkSettings: {
          mode: 'localhost',
          localhostBaseUrl: 'http://localhost:5173',
          productionBaseUrl: 'https://50mj9v47-5173.euw.devtunnels.ms',
        },
        integrations: [],
        notificationTemplates: getDefaultNotificationTemplates(),
        notificationTemplateDefaultsVersion: DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
        emailSettings: {
          smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
          smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
          smtpUsername: process.env.SMTP_USER || '',
          smtpPassword: process.env.SMTP_PASS || '',
          requiresAuthentication: true,
          requiresTLS: true,
          enableNotifications: true
        },
        securitySettings: {
          passwordMinLength: 8,
          requireSpecialChar: true,
          requireNumber: true,
          requireUppercase: true,
          sessionTimeout: 3600000,
          maxLoginAttempts: 5,
          lockoutDuration: 900000
        }
      });

      await systemConfig.save();
      console.log('SeedService.seedSystemConfiguration: System configuration created successfully');
      return { message: 'System configuration created successfully' };
    } catch (error) {
      console.error('SeedService.seedSystemConfiguration: Error creating system configuration:', error);
      throw error;
    }
  }

  /**
   * Force-refresh the e-mail / notification templates inside the
   * system configuration document. Useful when templates change
   * between releases.
   */
  static async seedNotificationTemplates({ force = false } = {}) {
    try {
      console.log('SeedService.seedNotificationTemplates: Starting notification template seeding...');

      let config = await SystemConfiguration.findOne({});
      if (!config) {
        await this.seedSystemConfiguration();
        config = await SystemConfiguration.findOne({});
      }

      const upToDate =
        Array.isArray(config.notificationTemplates) &&
        config.notificationTemplates.length > 0 &&
        config.notificationTemplateDefaultsVersion === DEFAULT_NOTIFICATION_TEMPLATE_VERSION;

      if (upToDate && !force) {
        console.log('SeedService.seedNotificationTemplates: Templates already up-to-date, skipping');
        return { message: 'Notification templates already up-to-date' };
      }

      config.notificationTemplates = getDefaultNotificationTemplates();
      config.notificationTemplateDefaultsVersion = DEFAULT_NOTIFICATION_TEMPLATE_VERSION;
      await config.save();

      console.log(
        `SeedService.seedNotificationTemplates: Seeded ${config.notificationTemplates.length} templates`
      );
      return {
        message: `Notification templates seeded (${config.notificationTemplates.length})`,
        count: config.notificationTemplates.length
      };
    } catch (error) {
      console.error('SeedService.seedNotificationTemplates: Error seeding templates:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Languages
  // -----------------------------------------------------------------------
  static async seedLanguages() {
    try {
      console.log('SeedService.seedLanguages: Starting language seeding...');

      const existingLanguages = await Language.countDocuments();
      if (existingLanguages > 0) {
        console.log('SeedService.seedLanguages: Languages already exist, skipping');
        return { message: 'Languages already seeded' };
      }

      const languages = [
        { code: 'en', name: 'English', nativeName: 'English', isActive: true, isDefault: true,  direction: 'ltr', translations: [] },
        { code: 'de', name: 'German',  nativeName: 'Deutsch', isActive: true, isDefault: false, direction: 'ltr', translations: [] }
      ];
      const created = await Language.insertMany(languages);
      console.log(`SeedService.seedLanguages: Created ${created.length} languages`);
      return { message: `Created ${created.length} languages` };
    } catch (error) {
      console.error('SeedService.seedLanguages: Error seeding languages:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Homepage template
  // -----------------------------------------------------------------------
  static async seedHomepageTemplate() {
    try {
      console.log('SeedService.seedHomepageTemplate: Starting homepage template seeding...');

      const existing = await HomepageSection.countDocuments();
      if (existing > 0) {
        console.log('SeedService.seedHomepageTemplate: Homepage template already exists, skipping');
        return { message: 'Homepage template already exists' };
      }

      const sections = [
        {
          name: 'Hero Section', type: 'hero',
          title: 'Professional Device Repair Services',
          content: 'Get your devices fixed by certified technicians with genuine parts and warranty coverage.',
          settings: {
            backgroundColor: '#3b82f6', textColor: '#ffffff',
            buttonText: 'Get Started', buttonLink: '/new-order',
            backgroundImage: 'https://via.placeholder.com/1920x800/3b82f6/ffffff?text=Hero+Section'
          },
          isActive: true, order: 1
        },
        {
          name: 'Services Overview', type: 'services',
          title: 'Our Repair Services',
          content: 'We specialize in repairing all major device brands with quick turnaround times.',
          settings: { backgroundColor: '#ffffff', textColor: '#1f2937', showPricing: true, layout: 'grid' },
          isActive: true, order: 2
        },
        {
          name: 'Why Choose Us', type: 'features',
          title: 'Why Choose FixitHub?',
          content: 'Professional service, genuine parts, and customer satisfaction guaranteed.',
          settings: {
            backgroundColor: '#f9fafb', textColor: '#1f2937',
            features: ['Certified Technicians', 'Genuine Parts', '90-Day Warranty', 'Quick Turnaround']
          },
          isActive: true, order: 3
        },
        {
          name: 'Customer Testimonials', type: 'testimonials',
          title: 'What Our Customers Say',
          content: 'Read reviews from satisfied customers who trust us with their device repairs.',
          settings: { backgroundColor: '#ffffff', textColor: '#1f2937', showRatings: true, autoplay: true },
          isActive: true, order: 4
        },
        {
          name: 'Call to Action', type: 'cta',
          title: 'Ready to Fix Your Device?',
          content: 'Get a free quote today and experience our professional repair services.',
          settings: {
            backgroundColor: '#10b981', textColor: '#ffffff',
            buttonText: 'Get Free Quote', buttonLink: '/new-order', centered: true
          },
          isActive: true, order: 5
        }
      ];

      const created = await HomepageSection.insertMany(sections);
      console.log(`SeedService.seedHomepageTemplate: Created ${created.length} sections`);
      return { message: `Homepage template created (${created.length} sections)` };
    } catch (error) {
      console.error('SeedService.seedHomepageTemplate: Error creating homepage template:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Workflows
  // -----------------------------------------------------------------------
  static async seedWorkflows() {
    try {
      console.log('SeedService.seedWorkflows: Starting workflow seeding...');

      const existingNames = new Set(
        (await WorkflowTemplate.find({}, 'name').lean()).map((w) => w.name)
      );

      const workflows = [
        {
          name: 'Standard Repair Process',
          description: 'Default end-to-end workflow covering intake, diagnosis, repair and quality control.',
          deviceTypes: [],
          serviceTypes: [],
          isActive: true,
          steps: [
            {
              name: 'Device Intake & Inspection',
              description: 'Visually inspect the device, document existing damage and run an initial diagnosis.',
              estimatedTime: 15,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              tools: ['Inspection Lamp', 'Camera', 'Diagnostic Software'],
              skills: ['Visual Inspection', 'Documentation'],
              checklistItems: [
                'Check for water damage indicators',
                'Document all existing scratches and dents',
                'Test core functionality (if possible)',
                'Take photos of the device condition'
              ],
              formFields: [
                {
                  id: 'device_condition',
                  name: 'device_condition',
                  label: 'Device Condition',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'excellent', label: 'Excellent' },
                    { value: 'good', label: 'Good' },
                    { value: 'fair', label: 'Fair' },
                    { value: 'poor', label: 'Poor' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              position: { x: 0, y: 0 }
            },
            {
              name: 'Repair Execution',
              description: 'Perform the repair using approved parts and tools.',
              estimatedTime: 60,
              isRequired: true,
              order: 2,
              category: 'repair',
              tools: ['Tool Kit', 'Replacement Parts'],
              skills: ['Soldering', 'Disassembly'],
              checklistItems: [
                'Use ESD-safe workstation',
                'Replace required components',
                'Clean device internals'
              ],
              formFields: [],
              position: { x: 200, y: 0 }
            },
            {
              name: 'Quality Control',
              description: 'Validate the repair, run functional tests and prepare the device for handover.',
              estimatedTime: 20,
              isRequired: true,
              order: 3,
              category: 'quality',
              tools: ['Diagnostic Software', 'Multimeter'],
              skills: ['Functional Testing', 'QA'],
              checklistItems: [
                'Run full diagnostics',
                'Verify all sensors and buttons',
                'Sign off the QA checklist'
              ],
              formFields: [
                {
                  id: 'qa_passed',
                  name: 'qa_passed',
                  label: 'QA Passed?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              position: { x: 400, y: 0 }
            }
          ]
        },
        {
          name: 'Quick Diagnostic',
          description: 'Lightweight diagnostic workflow for walk-in inspections.',
          deviceTypes: [],
          serviceTypes: [],
          isActive: true,
          steps: [
            {
              name: 'Initial Diagnosis',
              description: 'Quick assessment to identify symptoms and likely root causes.',
              estimatedTime: 10,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              tools: ['Diagnostic Software'],
              skills: ['Diagnosis'],
              checklistItems: ['Identify reported symptoms', 'Run quick diagnostic suite'],
              formFields: [],
              position: { x: 0, y: 0 }
            },
            {
              name: 'Quote & Handover',
              description: 'Provide an estimate to the customer and finalise the case.',
              estimatedTime: 5,
              isRequired: true,
              order: 2,
              category: 'completion',
              tools: [],
              skills: ['Customer Communication'],
              checklistItems: ['Generate quote', 'Communicate with customer'],
              formFields: [],
              position: { x: 200, y: 0 }
            }
          ]
        }
      ];

      const toInsert = workflows.filter((w) => !existingNames.has(w.name));
      if (toInsert.length === 0) {
        console.log('SeedService.seedWorkflows: All workflow templates already present, skipping');
        return { message: 'Workflow templates already present', count: 0 };
      }

      const created = await WorkflowTemplate.insertMany(toInsert);
      console.log(`SeedService.seedWorkflows: Created ${created.length} workflow templates`);
      return { message: `Workflow templates created (${created.length})`, count: created.length };
    } catch (error) {
      console.error('SeedService.seedWorkflows: Error seeding workflows:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Blog (categories, tags, posts)
  // -----------------------------------------------------------------------
  static async seedBlogData() {
    try {
      console.log('SeedService.seedBlogData: Starting blog data seeding...');

      const existingPosts = await BlogPost.countDocuments();
      if (existingPosts > 0) {
        console.log('SeedService.seedBlogData: Blog posts already exist, skipping');
        return { message: 'Blog posts already exist' };
      }

      const admin = await this.getAdminUser();

      // Categories
      const categoryDefs = [
        { name: 'Tips',         slug: 'tips',         description: 'Tips and tricks for device care' },
        { name: 'Repair Guide', slug: 'repair-guide', description: 'Step-by-step repair guides' },
        { name: 'News',         slug: 'news',         description: 'Industry news and updates' }
      ];
      const categoryDocs = {};
      for (const def of categoryDefs) {
        let cat = await BlogCategory.findOne({ slug: def.slug });
        if (!cat) cat = await BlogCategory.create(def);
        categoryDocs[def.slug] = cat;
      }

      // Tags
      const tagDefs = [
        { name: 'battery',     slug: 'battery' },
        { name: 'maintenance', slug: 'maintenance' },
        { name: 'screen',      slug: 'screen' },
        { name: 'water-damage', slug: 'water-damage' }
      ];
      const tagDocs = {};
      for (const def of tagDefs) {
        let tag = await BlogTag.findOne({ slug: def.slug });
        if (!tag) tag = await BlogTag.create(def);
        tagDocs[def.slug] = tag;
      }

      const posts = [
        {
          title: 'How to Extend Your Phone Battery Life',
          excerpt: 'Discover proven methods to extend your phone battery life and reduce the need for repairs.',
          content: 'Learn practical tips to maximize your smartphone battery life and avoid frequent replacements...',
          author: admin._id,
          category: categoryDocs['tips']._id,
          tags: [tagDocs['battery']._id, tagDocs['maintenance']._id],
          status: 'published',
          featuredImage: 'https://via.placeholder.com/800x400/3b82f6/ffffff?text=Battery+Tips',
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Signs Your Phone Screen Needs Replacement',
          excerpt: 'Learn to recognise when your phone screen damage requires professional attention.',
          content: 'Identify the warning signs that indicate your phone screen needs professional replacement...',
          author: admin._id,
          category: categoryDocs['repair-guide']._id,
          tags: [tagDocs['screen']._id],
          status: 'published',
          featuredImage: 'https://via.placeholder.com/800x400/ef4444/ffffff?text=Screen+Repair',
          publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Water Damage: What to Do Immediately',
          excerpt: 'Essential first-aid steps for water-damaged devices to prevent further damage.',
          content: 'Quick action steps to take when your device gets water damaged to minimise repair costs...',
          author: admin._id,
          category: categoryDocs['repair-guide']._id,
          tags: [tagDocs['water-damage']._id],
          status: 'published',
          featuredImage: 'https://via.placeholder.com/800x400/06b6d4/ffffff?text=Water+Damage',
          publishedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        }
      ];

      // Use Model.create() (not insertMany) so pre-save middleware runs (slug, readTime).
      const created = await BlogPost.create(posts);
      console.log(`SeedService.seedBlogData: Created ${created.length} blog posts`);
      return { message: `Blog posts created (${created.length})`, count: created.length };
    } catch (error) {
      console.error('SeedService.seedBlogData: Error creating blog posts:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // FAQs
  // -----------------------------------------------------------------------
  static async seedFAQs() {
    try {
      console.log('SeedService.seedFAQs: Starting FAQ seeding...');

      const existing = await FAQ.countDocuments();
      if (existing > 0) {
        console.log('SeedService.seedFAQs: FAQs already exist, skipping');
        return { message: 'FAQs already exist' };
      }

      const admin = await this.getAdminUser();

      const faqs = [
        {
          question: 'How long does a typical screen repair take?',
          answer: 'Most screen repairs are completed within 1-2 hours. Exact time depends on the device model and parts availability.',
          category: 'Repairs',
          tags: ['screen', 'duration'],
          isActive: true,
          order: 1,
          createdBy: admin._id
        },
        {
          question: 'Do you offer warranty on repairs?',
          answer: 'Yes, we provide a 90-day warranty on all repair work, covering defects in parts and workmanship.',
          category: 'Warranty',
          tags: ['warranty'],
          isActive: true,
          order: 2,
          createdBy: admin._id
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept cash, credit cards (Visa, MasterCard, American Express), debit cards and PayPal.',
          category: 'Pricing',
          tags: ['payment'],
          isActive: true,
          order: 3,
          createdBy: admin._id
        },
        {
          question: 'Do I need an appointment for a repair?',
          answer: 'Appointments are recommended for faster service, but walk-ins are welcome.',
          category: 'General',
          tags: ['appointment'],
          isActive: true,
          order: 4,
          createdBy: admin._id
        },
        {
          question: 'How do I track my repair status?',
          answer: 'You can track your repair status by logging into your account and visiting the order tracking page.',
          category: 'Technical',
          tags: ['tracking'],
          isActive: true,
          order: 5,
          createdBy: admin._id
        }
      ];

      const created = await FAQ.create(faqs);
      console.log(`SeedService.seedFAQs: Created ${created.length} FAQs`);
      return { message: `FAQs created (${created.length})`, count: created.length };
    } catch (error) {
      console.error('SeedService.seedFAQs: Error creating FAQs:', error);
      throw error;
    }
  }

  static async seedFAQData() {
    return await this.seedFAQs();
  }

  // -----------------------------------------------------------------------
  // SEO settings
  // -----------------------------------------------------------------------
  static async seedSEOSettings() {
    try {
      console.log('SeedService.seedSEOSettings: Starting SEO settings seeding...');

      const existing = await SEOSettings.countDocuments();
      if (existing > 0) {
        console.log('SeedService.seedSEOSettings: SEO settings already exist, skipping');
        return { message: 'SEO settings already exist' };
      }

      const admin = await this.getAdminUser();

      const settings = [
        {
          pageType: 'global',
          pageId: '',
          title: 'FixitHub – Professional Device Repair',
          description: 'Certified technicians, genuine parts and a 90-day warranty for all device repairs.',
          keywords: ['device repair', 'phone repair', 'tablet repair', 'laptop repair', 'fixithub'],
          openGraph: {
            title: 'FixitHub – Professional Device Repair',
            description: 'Fast, certified device repairs with a 90-day warranty.',
            type: 'website'
          },
          twitterCard: { card: 'summary_large_image' },
          robots: { index: true, follow: true },
          priority: 1.0,
          changeFreq: 'weekly',
          isActive: true,
          createdBy: admin._id
        },
        {
          pageType: 'homepage',
          pageId: 'home',
          title: 'FixitHub – Fast & Reliable Device Repair',
          description: 'Book a repair online and have your device fixed by certified technicians within hours.',
          keywords: ['book repair', 'phone repair near me', 'fixithub home'],
          openGraph: { type: 'website' },
          twitterCard: { card: 'summary_large_image' },
          robots: { index: true, follow: true },
          priority: 1.0,
          changeFreq: 'weekly',
          isActive: true,
          createdBy: admin._id
        },
        {
          pageType: 'page',
          pageId: 'blog',
          title: 'FixitHub Blog – Repair Tips & Guides',
          description: 'Tips, guides and news about device care, repairs and maintenance from the FixitHub team.',
          keywords: ['repair blog', 'device care tips', 'how to repair'],
          openGraph: { type: 'website' },
          twitterCard: { card: 'summary' },
          robots: { index: true, follow: true },
          priority: 0.7,
          changeFreq: 'weekly',
          isActive: true,
          createdBy: admin._id
        },
        {
          pageType: 'page',
          pageId: 'faq',
          title: 'FixitHub FAQ – Frequently Asked Questions',
          description: 'Answers to the most common questions about our repair services, warranty, payments and more.',
          keywords: ['faq', 'help', 'questions', 'support'],
          openGraph: { type: 'website' },
          twitterCard: { card: 'summary' },
          robots: { index: true, follow: true },
          priority: 0.6,
          changeFreq: 'monthly',
          isActive: true,
          createdBy: admin._id
        }
      ];

      const created = await SEOSettings.create(settings);
      console.log(`SeedService.seedSEOSettings: Created ${created.length} SEO settings entries`);
      return { message: `SEO settings created (${created.length})`, count: created.length };
    } catch (error) {
      console.error('SeedService.seedSEOSettings: Error creating SEO settings:', error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Single-command bootstrap
  // -----------------------------------------------------------------------
  static async seedAll() {
    try {
      console.log('SeedService.seedAll: Starting complete seeding...');

      const results = {};
      results.systemConfiguration = await this.seedSystemConfiguration();
      results.notificationTemplates = await this.seedNotificationTemplates();
      results.adminUser = await this.seedAdminUser();
      results.languages = await this.seedLanguages();
      results.homepageTemplate = await this.seedHomepageTemplate();
      results.workflows = await this.seedWorkflows();
      results.blog = await this.seedBlogData();
      results.faqs = await this.seedFAQs();
      results.seo = await this.seedSEOSettings();

      console.log('SeedService.seedAll: Seeding finished');
      return results;
    } catch (error) {
      console.error('SeedService.seedAll: Error during seeding:', error);
      throw error;
    }
  }
}

module.exports = SeedService;
