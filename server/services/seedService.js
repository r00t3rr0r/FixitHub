const User = require('../models/User');
const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');
const Inventory = require('../models/Inventory');
const Device = require('../models/Device');
const { DeviceModel, DeviceBrand } = require('../models/Device');
const Product = require('../models/Product');
const { BlogPost, BlogCategory, BlogTag } = require('../models/BlogPost');
const FAQ = require('../models/FAQ');
const { HomepageSection, LayoutTemplate } = require('../models/Homepage');
const { WorkflowTemplate } = require('../models/Workflow');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Language = require('../models/Language');
const SystemConfiguration = require('../models/SystemConfiguration');
const ServiceCategory = require('../models/ServiceCategory');
const { generatePasswordHash } = require('../utils/password');

class SeedService {
  static async seedAdminUser() {
    try {
      console.log('SeedService.seedAdminUser: Starting admin user seeding...');
      
      // Check if admin user already exists
      const existingAdmin = await User.findOne({ email: 'admin@example.com' });
      if (existingAdmin) {
        console.log('SeedService.seedAdminUser: Admin user already exists, updating password...');
        // Update the password to ensure it's correct
        existingAdmin.password = await generatePasswordHash('admin123');
        await existingAdmin.save();
        console.log('SeedService.seedAdminUser: Admin password updated successfully');
        return { message: 'Admin user already exists' };
      }

      console.log('SeedService.seedAdminUser: Creating new admin user...');
      const adminPassword = await generatePasswordHash('admin123');
      
      const adminUser = new User({
        email: 'admin@example.com',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        phone: '+1-555-0001',
        role: 'admin',
        department: 'Administration',
        specializations: ['System Management', 'User Management'],
        addOnCapabilities: ['All Services'],
        employmentStartDate: new Date('2023-01-01'),
        skills: [
          { name: 'System Administration', level: 'expert' },
          { name: 'User Management', level: 'expert' },
          { name: 'Analytics', level: 'advanced' }
        ],
        isActive: true,
        avatar: 'https://via.placeholder.com/150x150/dc2626/ffffff?text=AU'
      });

      await adminUser.save();
      console.log('SeedService.seedAdminUser: Admin user created successfully with ID:', adminUser._id);
      return { message: 'Admin user created successfully' };
    } catch (error) {
      console.error('SeedService.seedAdminUser: Error creating admin user:', error);
      throw error;
    }
  }

  static async seedTestUsers() {
    try {
      console.log('SeedService.seedTestUsers: Starting test users seeding...');
      
      const testUsers = [
        {
          email: 'customer@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          phone: '+1-555-0002',
          role: 'customer',
          avatar: 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=JD'
        },
        {
          email: 'staff@example.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          name: 'Jane Smith',
          phone: '+1-555-0003',
          role: 'staff',
          department: 'Technical',
          specializations: ['iPhone Repair', 'Samsung Repair', 'Screen Replacement'],
          addOnCapabilities: ['Screen Protector Installation', 'Data Transfer', 'Cleaning'],
          employmentStartDate: new Date('2023-02-01'),
          skills: [
            { name: 'Mobile Repair', level: 'expert' },
            { name: 'Screen Replacement', level: 'advanced' },
            { name: 'Data Recovery', level: 'intermediate' }
          ],
          isActive: true,
          avatar: 'https://via.placeholder.com/150x150/10b981/ffffff?text=JS'
        }
      ];

      const createdUsers = [];

      for (const userData of testUsers) {
        console.log(`SeedService.seedTestUsers: Processing user ${userData.email}...`);
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`SeedService.seedTestUsers: User ${userData.email} already exists, updating password...`);
          // Update the password to ensure it's correct
          existingUser.password = await generatePasswordHash(userData.password);
          await existingUser.save();
          console.log(`SeedService.seedTestUsers: User ${userData.email} password updated successfully`);
          createdUsers.push(existingUser);
          continue;
        }

        console.log(`SeedService.seedTestUsers: Creating new user ${userData.email}...`);
        const hashedPassword = await generatePasswordHash(userData.password);
        
        const user = new User({
          ...userData,
          password: hashedPassword
        });

        await user.save();
        console.log(`SeedService.seedTestUsers: User ${userData.email} created successfully with ID:`, user._id);
        createdUsers.push(user);
      }

      console.log('SeedService.seedTestUsers: All test users processed successfully');
      return createdUsers;
    } catch (error) {
      console.error('SeedService.seedTestUsers: Error creating test users:', error);
      throw error;
    }
  }

  static async seedServices() {
    try {
      console.log('SeedService.seedServices: Starting services seeding...');
      
      const existingServices = await Service.countDocuments();
      if (existingServices > 0) {
        console.log('SeedService.seedServices: Services already exist, skipping...');
        return { message: 'Services already exist' };
      }

      const services = [
        {
          name: 'Screen Replacement',
          description: 'Professional screen replacement for cracked or damaged displays',
          category: 'Display',
          price: 149.99,
          estimatedTime: '60',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Battery Replacement',
          description: 'Replace old or degraded batteries to restore device performance',
          category: 'Power',
          price: 89.99,
          estimatedTime: '45',
          deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Water Damage Repair',
          description: 'Comprehensive water damage assessment and repair service',
          category: 'Emergency',
          price: 199.99,
          estimatedTime: '120',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Data Recovery',
          description: 'Professional data recovery from damaged or corrupted devices',
          category: 'Software',
          price: 299.99,
          estimatedTime: '180',
          deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Camera Repair',
          description: 'Fix camera issues and replace camera modules',
          category: 'Camera',
          price: 129.99,
          estimatedTime: '90',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        }
      ];

      const createdServices = await Service.insertMany(services);
      console.log('SeedService.seedServices: Services created successfully, count:', createdServices.length);
      return { message: `Services created successfully, count: ${createdServices.length}` };
    } catch (error) {
      console.error('SeedService.seedServices: Error creating services:', error);
      throw error;
    }
  }

  static async seedAddOnServices() {
    try {
      console.log('SeedService.seedAddOnServices: Starting add-on services seeding...');
      
      const existingAddOns = await AddOnService.countDocuments();
      if (existingAddOns > 0) {
        console.log('SeedService.seedAddOnServices: Add-on services already exist, skipping...');
        return { message: 'Add-on services already exist' };
      }

      const addOnServices = [
        {
          name: 'Screen Protector Installation',
          description: 'Professional installation of tempered glass screen protector',
          category: 'Protection',
          price: 29.99,
          estimatedTime: 10,
          deviceTypes: ['iPhone', 'Samsung', 'iPad'],
          isActive: true,
          compatibleServices: [],
          inventoryRequired: true
        },
        {
          name: 'Device Cleaning',
          description: 'Thorough cleaning and sanitization of your device',
          category: 'Maintenance',
          price: 19.99,
          estimatedTime: 15,
          deviceTypes: ['iPhone', 'Samsung', 'iPad', 'MacBook'],
          isActive: true,
          compatibleServices: [],
          inventoryRequired: false
        },
        {
          name: 'Data Transfer',
          description: 'Transfer data from old device to repaired device',
          category: 'Data',
          price: 49.99,
          estimatedTime: 30,
          deviceTypes: ['iPhone', 'Samsung', 'iPad'],
          isActive: true,
          compatibleServices: [],
          inventoryRequired: false
        },
        {
          name: 'Express Service',
          description: 'Priority repair service with faster turnaround time',
          category: 'Service',
          price: 99.99,
          estimatedTime: 0,
          deviceTypes: ['iPhone', 'Samsung', 'iPad', 'MacBook'],
          isActive: true,
          compatibleServices: [],
          inventoryRequired: false
        },
        {
          name: 'Extended Warranty',
          description: '6-month extended warranty on repair work',
          category: 'Warranty',
          price: 79.99,
          estimatedTime: 0,
          deviceTypes: ['iPhone', 'Samsung', 'iPad', 'MacBook'],
          isActive: true,
          compatibleServices: [],
          inventoryRequired: false
        }
      ];

      const createdAddOns = await AddOnService.insertMany(addOnServices);
      console.log('SeedService.seedAddOnServices: Add-on services created successfully, count:', createdAddOns.length);
      return { message: `Add-on services created successfully, count: ${createdAddOns.length}` };
    } catch (error) {
      console.error('SeedService.seedAddOnServices: Error creating add-on services:', error);
      throw error;
    }
  }

  static async seedInventory() {
    try {
      console.log('SeedService.seedInventory: Starting inventory seeding...');
      
      const existingInventory = await Inventory.countDocuments();
      if (existingInventory > 0) {
        console.log('SeedService.seedInventory: Inventory already exists, skipping...');
        return { message: 'Inventory already exists' };
      }

      const inventoryItems = [
        {
          name: 'iPhone 13 Screen Assembly',
          description: 'Original quality screen assembly for iPhone 13',
          category: 'Screens',
          manufacturer: 'Apple',
          brand: 'Apple',
          versions: [
            {
              type: 'Original',
              quantity: 25,
              minStockLevel: 5,
              reorderLevel: 10,
              unitCost: 120.00,
              sellingPrice: 180.00,
              storageLocation: 'A1-01',
              supplierInfo: 'Apple Authorized Distributor',
              leadTime: 7,
              status: 'active'
            },
            {
              type: 'Efficient',
              quantity: 50,
              minStockLevel: 10,
              reorderLevel: 20,
              unitCost: 80.00,
              sellingPrice: 120.00,
              storageLocation: 'A1-02',
              supplierInfo: 'Certified Parts Supplier',
              leadTime: 5,
              status: 'active'
            }
          ]
        },
        {
          name: 'Samsung Galaxy S21 Battery',
          description: 'High-capacity battery for Samsung Galaxy S21',
          category: 'Batteries',
          manufacturer: 'Samsung',
          brand: 'Samsung',
          versions: [
            {
              type: 'Original',
              quantity: 30,
              minStockLevel: 8,
              reorderLevel: 15,
              unitCost: 45.00,
              sellingPrice: 70.00,
              storageLocation: 'B2-01',
              supplierInfo: 'Samsung Parts Division',
              leadTime: 10,
              status: 'active'
            }
          ]
        },
        {
          name: 'Tempered Glass Screen Protector',
          description: 'Universal tempered glass screen protector',
          category: 'Accessories',
          manufacturer: 'Generic',
          brand: 'FixitHub',
          versions: [
            {
              type: 'Standard',
              quantity: 100,
              minStockLevel: 20,
              reorderLevel: 40,
              unitCost: 2.50,
              sellingPrice: 15.99,
              storageLocation: 'C3-01',
              supplierInfo: 'Bulk Accessories Supplier',
              leadTime: 3,
              status: 'active'
            }
          ]
        }
      ];

      const createdInventory = await Inventory.insertMany(inventoryItems);
      console.log('SeedService.seedInventory: Inventory created successfully, count:', createdInventory.length);
      return { message: `Inventory created successfully, count: ${createdInventory.length}` };
    } catch (error) {
      console.error('SeedService.seedInventory: Error creating inventory:', error);
      throw error;
    }
  }

  static async seedDevices() {
    try {
      console.log('SeedService.seedDevices: Starting devices seeding...');

      const existingBrands = await DeviceBrand.countDocuments();
      if (existingBrands > 0) {
        console.log('SeedService.seedDevices: Devices already exist, skipping...');
        return { message: 'Devices already exist' };
      }

      // Brand and model data
      const devicesData = [
        {
          brand: 'Apple',
          models: [
            { name: 'iPhone 14 Pro Max', deviceType: 'smartphone' },
            { name: 'iPhone 14 Pro', deviceType: 'smartphone' },
            { name: 'iPhone 14', deviceType: 'smartphone' },
            { name: 'iPhone 13 Pro Max', deviceType: 'smartphone' },
            { name: 'iPhone 13 Pro', deviceType: 'smartphone' },
            { name: 'iPhone 13', deviceType: 'smartphone' },
            { name: 'iPad Pro 12.9"', deviceType: 'tablet' },
            { name: 'MacBook Pro 16"', deviceType: 'laptop' }
          ]
        },
        {
          brand: 'Samsung',
          models: [
            { name: 'Galaxy S23 Ultra', deviceType: 'smartphone' },
            { name: 'Galaxy S23+', deviceType: 'smartphone' },
            { name: 'Galaxy S23', deviceType: 'smartphone' },
            { name: 'Galaxy S22 Ultra', deviceType: 'smartphone' },
            { name: 'Galaxy Tab S8', deviceType: 'tablet' }
          ]
        },
        {
          brand: 'Google',
          models: [
            { name: 'Pixel 7 Pro', deviceType: 'smartphone' },
            { name: 'Pixel 7', deviceType: 'smartphone' },
            { name: 'Pixel 6 Pro', deviceType: 'smartphone' }
          ]
        },
        {
          brand: 'Microsoft',
          models: [
            { name: 'Surface Laptop 5', deviceType: 'laptop' },
            { name: 'Surface Pro 9', deviceType: 'tablet' }
          ]
        }
      ];

      // Create brands and models
      for (const brandData of devicesData) {
        console.log(`SeedService.seedDevices: Creating brand: ${brandData.brand}`);

        // Create brand
        const brand = new DeviceBrand({
          name: brandData.brand,
          logo: `https://via.placeholder.com/100x100/3b82f6/ffffff?text=${brandData.brand}`,
          isActive: true
        });
        const savedBrand = await brand.save();
        console.log(`SeedService.seedDevices: Brand ${brandData.brand} created with ID:`, savedBrand._id);

        // Create models for this brand
        const models = brandData.models.map(modelData => ({
          name: modelData.name,
          brandId: savedBrand._id,
          deviceType: modelData.deviceType,
          image: `https://via.placeholder.com/200x200/10b981/ffffff?text=${encodeURIComponent(modelData.name)}`,
          specifications: {},
          isActive: true
        }));

        const savedModels = await DeviceModel.insertMany(models);
        console.log(`SeedService.seedDevices: Created ${savedModels.length} models for ${brandData.brand}`);
      }

      console.log('SeedService.seedDevices: Devices seeding completed successfully');
      return { message: 'Devices seeded successfully' };
    } catch (error) {
      console.error('SeedService.seedDevices: Error creating devices:', error);
      throw error;
    }
  }

  static async seedProducts() {
    try {
      console.log('SeedService.seedProducts: Starting products seeding...');
      
      const existingProducts = await Product.countDocuments();
      if (existingProducts > 0) {
        console.log('SeedService.seedProducts: Products already exist, skipping...');
        return { message: 'Products already exist' };
      }

      const products = [
        {
          name: 'iPhone 13 Pro Case',
          description: 'Premium protective case for iPhone 13 Pro',
          category: 'Cases',
          brand: 'FixitHub',
          price: 39.99,
          costPrice: 15.00,
          stock: 75,
          minStock: 10,
          images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=Case'],
          specifications: {
            material: 'TPU + PC',
            color: 'Black',
            weight: '50g'
          },
          tags: ['iPhone', 'Case', 'Protection'],
          isActive: true,
          isFeatured: true
        },
        {
          name: 'Wireless Charging Pad',
          description: 'Fast wireless charging pad compatible with all Qi devices',
          category: 'Chargers',
          brand: 'FixitHub',
          price: 49.99,
          costPrice: 20.00,
          stock: 50,
          minStock: 8,
          images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Charger'],
          specifications: {
            power: '15W',
            compatibility: 'Qi-enabled devices',
            cable: 'USB-C included'
          },
          tags: ['Wireless', 'Charging', 'Fast'],
          isActive: true,
          isFeatured: true
        },
        {
          name: 'Screen Cleaning Kit',
          description: 'Professional screen cleaning kit with microfiber cloth',
          category: 'Accessories',
          brand: 'FixitHub',
          price: 19.99,
          costPrice: 5.00,
          stock: 100,
          minStock: 15,
          images: ['https://via.placeholder.com/300x300/f59e0b/ffffff?text=Kit'],
          specifications: {
            includes: 'Cleaning solution, microfiber cloth, brush',
            size: 'Compact travel size'
          },
          tags: ['Cleaning', 'Maintenance', 'Kit'],
          isActive: true,
          isFeatured: false
        }
      ];

      const createdProducts = await Product.insertMany(products);
      console.log('SeedService.seedProducts: Products created successfully, count:', createdProducts.length);
      return { message: `Products created successfully, count: ${createdProducts.length}` };
    } catch (error) {
      console.error('SeedService.seedProducts: Error creating products:', error);
      throw error;
    }
  }

  static async seedBlogData() {
    try {
      console.log('SeedService.seedBlogData: Starting blog data seeding...');
      
      const existingPosts = await BlogPost.countDocuments();
      if (existingPosts > 0) {
        console.log('SeedService.seedBlogData: Blog posts already exist, skipping...');
        return { message: 'Blog posts already exist' };
      }

      const blogPosts = [
        {
          title: 'How to Extend Your Phone Battery Life',
          slug: 'extend-phone-battery-life',
          content: 'Learn practical tips to maximize your smartphone battery life and avoid frequent replacements...',
          excerpt: 'Discover proven methods to extend your phone battery life and reduce the need for repairs.',
          author: 'FixitHub Team',
          status: 'published',
          categories: ['Tips', 'Battery'],
          tags: ['battery', 'maintenance', 'tips'],
          featuredImage: 'https://via.placeholder.com/800x400/3b82f6/ffffff?text=Battery+Tips',
          readTime: 5,
          views: 1250,
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Signs Your Phone Screen Needs Replacement',
          slug: 'phone-screen-replacement-signs',
          content: 'Identify the warning signs that indicate your phone screen needs professional replacement...',
          excerpt: 'Learn to recognize when your phone screen damage requires professional attention.',
          author: 'Tech Expert',
          status: 'published',
          categories: ['Repair', 'Screen'],
          tags: ['screen', 'repair', 'damage'],
          featuredImage: 'https://via.placeholder.com/800x400/ef4444/ffffff?text=Screen+Repair',
          readTime: 3,
          views: 890,
          publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Water Damage: What to Do Immediately',
          slug: 'water-damage-immediate-steps',
          content: 'Quick action steps to take when your device gets water damaged to minimize repair costs...',
          excerpt: 'Essential first aid steps for water-damaged devices to prevent further damage.',
          author: 'Repair Specialist',
          status: 'published',
          categories: ['Emergency', 'Water Damage'],
          tags: ['water damage', 'emergency', 'first aid'],
          featuredImage: 'https://via.placeholder.com/800x400/06b6d4/ffffff?text=Water+Damage',
          readTime: 4,
          views: 2100,
          publishedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        }
      ];

      const createdPosts = await BlogPost.insertMany(blogPosts);
      console.log('SeedService.seedBlogData: Blog posts created successfully, count:', createdPosts.length);
      return { message: `Blog posts created successfully, count: ${createdPosts.length}` };
    } catch (error) {
      console.error('SeedService.seedBlogData: Error creating blog posts:', error);
      throw error;
    }
  }

  static async seedFAQs() {
    try {
      console.log('SeedService.seedFAQs: Starting FAQs seeding...');
      
      const existingFAQs = await FAQ.countDocuments();
      if (existingFAQs > 0) {
        console.log('SeedService.seedFAQs: FAQs already exist, skipping...');
        return { message: 'FAQs already exist' };
      }

      const faqs = [
        {
          question: 'How long does a typical screen repair take?',
          answer: 'Most screen repairs are completed within 1-2 hours. However, the exact time depends on the device model and availability of parts.',
          category: 'Repair Time',
          tags: ['screen repair', 'timing', 'duration'],
          isPublished: true,
          helpfulCount: 45,
          order: 1
        },
        {
          question: 'Do you offer warranty on repairs?',
          answer: 'Yes, we provide a 90-day warranty on all repair work. This covers any defects in parts or workmanship.',
          category: 'Warranty',
          tags: ['warranty', 'guarantee', 'coverage'],
          isPublished: true,
          helpfulCount: 38,
          order: 2
        },
        {
          question: 'Can you recover data from a water-damaged phone?',
          answer: 'In many cases, yes. Our data recovery success rate for water-damaged devices is approximately 85%. We recommend bringing your device in as soon as possible.',
          category: 'Data Recovery',
          tags: ['water damage', 'data recovery', 'success rate'],
          isPublished: true,
          helpfulCount: 62,
          order: 3
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept cash, credit cards (Visa, MasterCard, American Express), debit cards, and PayPal. Payment is due upon completion of the repair.',
          category: 'Payment',
          tags: ['payment', 'methods', 'billing'],
          isPublished: true,
          helpfulCount: 29,
          order: 4
        },
        {
          question: 'Do I need an appointment for a repair?',
          answer: 'While appointments are not required, we recommend scheduling one to ensure faster service. Walk-ins are welcome but may experience longer wait times.',
          category: 'Scheduling',
          tags: ['appointment', 'scheduling', 'walk-in'],
          isPublished: true,
          helpfulCount: 33,
          order: 5
        }
      ];

      const createdFAQs = await FAQ.insertMany(faqs);
      console.log('SeedService.seedFAQs: FAQs created successfully, count:', createdFAQs.length);
      return { message: `FAQs created successfully, count: ${createdFAQs.length}` };
    } catch (error) {
      console.error('SeedService.seedFAQs: Error creating FAQs:', error);
      throw error;
    }
  }

  static async seedFAQData() {
    return await this.seedFAQs();
  }

  static async seedLanguages() {
    try {
      console.log('SeedService.seedLanguages: Starting language seeding...');

      const existingLanguages = await Language.countDocuments();
      if (existingLanguages > 0) {
        console.log('SeedService.seedLanguages: Languages already exist, skipping...');
        return { message: 'Languages already seeded' };
      }

      console.log('SeedService.seedLanguages: Creating default languages (English and German)...');

      const languages = [
        {
          code: 'en',
          name: 'English',
          nativeName: 'English',
          isActive: true,
          isDefault: true,
          direction: 'ltr',
          translations: []
        },
        {
          code: 'de',
          name: 'German',
          nativeName: 'Deutsch',
          isActive: true,
          isDefault: false,
          direction: 'ltr',
          translations: []
        }
      ];

      const createdLanguages = await Language.insertMany(languages);
      console.log(`SeedService.seedLanguages: Created ${createdLanguages.length} languages successfully`);

      return { message: `Created ${createdLanguages.length} languages successfully` };
    } catch (error) {
      console.error('SeedService.seedLanguages: Error seeding languages:', error);
      throw error;
    }
  }

  static async seedHomepageTemplate() {
    try {
      console.log('SeedService.seedHomepageTemplate: Starting homepage template seeding...');
      
      const existingHomepage = await HomepageSection.countDocuments();
      if (existingHomepage > 0) {
        console.log('SeedService.seedHomepageTemplate: Homepage template already exists, skipping...');
        return { message: 'Homepage template already exists' };
      }

      const homepageData = [
        {
          name: 'Hero Section',
          type: 'hero',
          title: 'Professional Device Repair Services',
          content: 'Get your devices fixed by certified technicians with genuine parts and warranty coverage.',
          settings: {
            backgroundColor: '#3b82f6',
            textColor: '#ffffff',
            buttonText: 'Get Started',
            buttonLink: '/new-order',
            backgroundImage: 'https://via.placeholder.com/1920x800/3b82f6/ffffff?text=Hero+Section'
          },
          isActive: true,
          order: 1
        },
        {
          name: 'Services Overview',
          type: 'services',
          title: 'Our Repair Services',
          content: 'We specialize in repairing all major device brands with quick turnaround times.',
          settings: {
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            showPricing: true,
            layout: 'grid'
          },
          isActive: true,
          order: 2
        },
        {
          name: 'Why Choose Us',
          type: 'features',
          title: 'Why Choose FixitHub?',
          content: 'Professional service, genuine parts, and customer satisfaction guaranteed.',
          settings: {
            backgroundColor: '#f9fafb',
            textColor: '#1f2937',
            features: [
              'Certified Technicians',
              'Genuine Parts',
              '90-Day Warranty',
              'Quick Turnaround'
            ]
          },
          isActive: true,
          order: 3
        },
        {
          name: 'Customer Testimonials',
          type: 'testimonials',
          title: 'What Our Customers Say',
          content: 'Read reviews from satisfied customers who trust us with their device repairs.',
          settings: {
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            showRatings: true,
            autoplay: true
          },
          isActive: true,
          order: 4
        },
        {
          name: 'Call to Action',
          type: 'cta',
          title: 'Ready to Fix Your Device?',
          content: 'Get a free quote today and experience our professional repair services.',
          settings: {
            backgroundColor: '#10b981',
            textColor: '#ffffff',
            buttonText: 'Get Free Quote',
            buttonLink: '/new-order',
            centered: true
          },
          isActive: true,
          order: 5
        }
      ];

      const createdHomepage = await HomepageSection.insertMany(homepageData);
      console.log('SeedService.seedHomepageTemplate: Homepage template created successfully, count:', createdHomepage.length);
      return { message: `Homepage template created successfully, count: ${createdHomepage.length}` };
    } catch (error) {
      console.error('SeedService.seedHomepageTemplate: Error creating homepage template:', error);
      throw error;
    }
  }

  static async seedFinancialData() {
    try {
      console.log('SeedService.seedFinancialData: Starting financial data seeding...');
      
      const existingInvoices = await Invoice.countDocuments();
      if (existingInvoices > 0) {
        console.log('SeedService.seedFinancialData: Financial data already exists, skipping...');
        return { message: 'Financial data already exists' };
      }

      // Get test users for invoice creation
      const customers = await User.find({ role: 'customer' }).limit(2);
      if (customers.length === 0) {
        console.log('SeedService.seedFinancialData: No customers found, skipping financial data seeding');
        return { message: 'No customers found' };
      }

      // Get bookings for invoices (required)
      const bookings = await Booking.find().limit(2);
      if (bookings.length === 0) {
        console.log('SeedService.seedFinancialData: No bookings found, skipping invoice creation (bookingId is required)');
        return { message: 'No bookings found, invoices require bookingId' };
      }

      const invoices = [
        {
          customerId: customers[0]._id,
          customerName: customers[0].name,
          customerEmail: customers[0].email,
          bookingId: bookings.length > 0 ? bookings[0]._id : null,
          orderId: null, // Will be set when orders are created
          invoiceNumber: 'INV-2024-001',
          items: [
            {
              description: 'iPhone 13 Screen Replacement',
              type: 'service',
              quantity: 1,
              unitPrice: 149.99,
              total: 149.99
            },
            {
              description: 'Screen Protector Installation',
              type: 'addon',
              quantity: 1,
              unitPrice: 29.99,
              total: 29.99
            }
          ],
          subtotal: 179.98,
          taxRate: 0.08,
          taxAmount: 14.40,
          total: 194.38,
          status: 'paid',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        },
        {
          customerId: customers.length > 1 ? customers[1]._id : customers[0]._id,
          customerName: customers.length > 1 ? customers[1].name : customers[0].name,
          customerEmail: customers.length > 1 ? customers[1].email : customers[0].email,
          bookingId: bookings.length > 1 ? bookings[1]._id : (bookings.length > 0 ? bookings[0]._id : null),
          orderId: null,
          invoiceNumber: 'INV-2024-002',
          items: [
            {
              description: 'Samsung Galaxy S21 Battery Replacement',
              type: 'service',
              quantity: 1,
              unitPrice: 89.99,
              total: 89.99
            }
          ],
          subtotal: 89.99,
          taxRate: 0.08,
          taxAmount: 7.20,
          total: 97.19,
          status: 'pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ];

      const createdInvoices = await Invoice.insertMany(invoices);
      console.log('SeedService.seedFinancialData: Financial data created successfully, count:', createdInvoices.length);
      return { message: `Financial data created successfully, count: ${createdInvoices.length}` };
    } catch (error) {
      console.error('SeedService.seedFinancialData: Error creating financial data:', error);
      throw error;
    }
  }

  static async seedGermanData() {
    try {
      console.log('SeedService.seedGermanData: Starting German data seeding...');

      const results = {};

      // Seed German services
      results.germanServices = await this.seedGermanServices();
      results.germanAddOnServices = await this.seedGermanAddOnServices();
      results.germanInventory = await this.seedGermanInventory();
      results.germanDevices = await this.seedGermanDevices();
      results.germanProducts = await this.seedGermanProducts();
      results.germanBlogData = await this.seedGermanBlogData();
      results.germanFAQs = await this.seedGermanFAQs();
      results.germanHomepageTemplate = await this.seedGermanHomepageTemplate();
      results.germanWorkflows = await this.seedGermanWorkflows();

      console.log('SeedService.seedGermanData: German data seeding finished successfully');
      return results;
    } catch (error) {
      console.error('SeedService.seedGermanData: Error during German data seeding:', error);
      throw error;
    }
  }

  static async seedGermanServices() {
    try {
      console.log('SeedService.seedGermanServices: Starting German services seeding...');

      // Check if German services already exist by name
      const existingGermanService = await Service.findOne({ name: 'Bildschirmersatz' });
      if (existingGermanService) {
        console.log('SeedService.seedGermanServices: German services already exist, skipping...');
        return { message: 'German services already exist' };
      }

      const germanServices = [
        {
          name: 'Bildschirmersatz',
          description: 'Professioneller Austausch von beschädigten oder gebrochenen Bildschirmen',
          category: 'Display',
          price: 149.99,
          estimatedTime: '60',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Batterieaustausch',
          description: 'Ersetzen Sie alte oder verschlissene Batterien, um die Geräteleisstung wiederherzustellen',
          category: 'Power',
          price: 89.99,
          estimatedTime: '45',
          deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Wasserschaden-Reparatur',
          description: 'Umfassende Wasserschaden-Bewertung und Reparaturservice',
          category: 'Emergency',
          price: 199.99,
          estimatedTime: '120',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Datenrettung',
          description: 'Professionelle Datenrettung von beschädigten oder beschädigten Geräten',
          category: 'Software',
          price: 299.99,
          estimatedTime: '180',
          deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Kamerarepatur',
          description: 'Kameraprobleme beheben und Kameramodule austauschen',
          category: 'Camera',
          price: 129.99,
          estimatedTime: '90',
          deviceTypes: ['Smartphone', 'Tablet'],
          isActive: true,
          knowledgeBaseArticles: []
        }
      ];

      const createdServices = await Service.insertMany(germanServices);
      console.log('SeedService.seedGermanServices: German services created successfully, count:', createdServices.length);
      return { message: `German services created successfully, count: ${createdServices.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanServices: Error creating German services:', error);
      throw error;
    }
  }

  static async seedGermanAddOnServices() {
    try {
      console.log('SeedService.seedGermanAddOnServices: Starting German add-on services seeding...');

      const existingGermanAddOn = await AddOnService.findOne({ name: 'Displayschutzfolie Installation' });
      if (existingGermanAddOn) {
        console.log('SeedService.seedGermanAddOnServices: German add-on services already exist, skipping...');
        return { message: 'German add-on services already exist' };
      }

      const germanAddOnServices = [
        {
          name: 'Displayschutzfolie Installation',
          description: 'Professionelle Installation von gehärteter Glasschutzfolie',
          category: 'Protection',
          price: 29.99,
          estimatedTime: '10 Minuten',
          isActive: true,
          popularity: 75,
          bundleDiscount: 0,
          compatibility: [
            { deviceType: 'Smartphone', brands: ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'OnePlus'] },
            { deviceType: 'Tablet', brands: ['Apple', 'Samsung', 'Huawei'] }
          ]
        },
        {
          name: 'Gerätereinigung',
          description: 'Gründliche Reinigung und Desinfektion Ihres Geräts',
          category: 'Service',
          price: 19.99,
          estimatedTime: '15 Minuten',
          isActive: true,
          popularity: 60,
          bundleDiscount: 0,
          compatibility: [
            { deviceType: 'Smartphone', brands: [] },
            { deviceType: 'Tablet', brands: [] },
            { deviceType: 'Notebook', brands: [] },
            { deviceType: 'Konsole', brands: [] }
          ]
        },
        {
          name: 'Datentransfer',
          description: 'Übertragen Sie Daten vom alten Gerät zum reparierten Gerät',
          category: 'Data',
          price: 49.99,
          estimatedTime: '30 Minuten',
          isActive: true,
          popularity: 85,
          bundleDiscount: 5,
          compatibility: [
            { deviceType: 'Smartphone', brands: ['Apple', 'Samsung', 'Huawei', 'Xiaomi'] },
            { deviceType: 'Tablet', brands: ['Apple', 'Samsung'] }
          ]
        },
        {
          name: 'Express-Service',
          description: 'Prioritätsreparaturservice mit schnellerem Bearbeitungszeitraum (1-2 Werktage statt 3-5)',
          category: 'Service',
          price: 99.99,
          estimatedTime: '1-2 Werktage',
          isActive: true,
          popularity: 90,
          bundleDiscount: 0,
          compatibility: [
            { deviceType: 'Smartphone', brands: [] },
            { deviceType: 'Tablet', brands: [] },
            { deviceType: 'Notebook', brands: [] },
            { deviceType: 'Konsole', brands: [] }
          ]
        },
        {
          name: 'Erweiterte Garantie',
          description: '6 Monate erweiterte Garantie auf alle Reparaturarbeiten',
          category: 'Warranty',
          price: 79.99,
          estimatedTime: '0 Minuten',
          isActive: true,
          popularity: 70,
          bundleDiscount: 10,
          compatibility: [
            { deviceType: 'Smartphone', brands: [] },
            { deviceType: 'Tablet', brands: [] },
            { deviceType: 'Notebook', brands: [] },
            { deviceType: 'Konsole', brands: [] }
          ]
        },
        {
          name: 'Versicherungsschutz',
          description: '12 Monate Versicherungsschutz gegen Sturzschäden und Wasserschäden',
          category: 'Insurance',
          price: 149.99,
          estimatedTime: '0 Minuten',
          isActive: true,
          popularity: 65,
          bundleDiscount: 15,
          compatibility: [
            { deviceType: 'Smartphone', brands: [] },
            { deviceType: 'Tablet', brands: [] }
          ]
        },
        {
          name: 'Datenrettung',
          description: 'Professionelle Datenrettung von defekten oder beschädigten Geräten',
          category: 'Data',
          price: 199.99,
          estimatedTime: '2-4 Werktage',
          isActive: true,
          popularity: 55,
          bundleDiscount: 0,
          compatibility: [
            { deviceType: 'Smartphone', brands: [] },
            { deviceType: 'Tablet', brands: [] },
            { deviceType: 'Notebook', brands: [] }
          ]
        }
      ];

      const createdAddOns = await AddOnService.insertMany(germanAddOnServices);
      console.log('SeedService.seedGermanAddOnServices: German add-on services created successfully, count:', createdAddOns.length);
      return { message: `German add-on services created successfully, count: ${createdAddOns.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanAddOnServices: Error creating German add-on services:', error);
      throw error;
    }
  }

  static async seedGermanInventory() {
    try {
      console.log('SeedService.seedGermanInventory: Starting German inventory seeding...');

      const existingGermanInventory = await Inventory.findOne({ itemName: 'iPhone 13 Bildschirmmodul' });
      if (existingGermanInventory) {
        console.log('SeedService.seedGermanInventory: German inventory already exists, skipping...');
        return { message: 'German inventory already exist' };
      }

      const germanInventoryItems = [
        {
          itemName: 'iPhone 13 Bildschirmmodul',
          itemDescription: 'Originalqualität Bildschirmmodul für iPhone 13',
          category: 'display',
          manufacturer: 'Apple',
          brand: 'Apple',
          sku: 'DE-IP13-SCR-DE',
          versions: [
            {
              versionType: 'original',
              versionId: 'IP13-SCR-001',
              quantity: 25,
              minStockLevel: 5,
              reorderLevel: 10,
              unitCost: 120.00,
              sellingPrice: 180.00,
              storageLocation: 'A1-01',
              supplierInfo: {
                name: 'Apple Autorisierter Distributor'
              }
            },
            {
              versionType: 'efficient',
              versionId: 'IP13-SCR-002',
              quantity: 50,
              minStockLevel: 10,
              reorderLevel: 20,
              unitCost: 80.00,
              sellingPrice: 120.00,
              storageLocation: 'A1-02',
              supplierInfo: {
                name: 'Zertifizierter Teile-Supplier'
              }
            }
          ]
        },
        {
          itemName: 'Samsung Galaxy S21 Akku',
          itemDescription: 'Hochkapazitäts-Akku für Samsung Galaxy S21',
          category: 'battery',
          manufacturer: 'Samsung',
          brand: 'Samsung',
          sku: 'DE-SAM-BAT-DE',
          versions: [
            {
              versionType: 'original',
              versionId: 'SAM-BAT-001',
              quantity: 30,
              minStockLevel: 8,
              reorderLevel: 15,
              unitCost: 45.00,
              sellingPrice: 70.00,
              storageLocation: 'B2-01',
              supplierInfo: {
                name: 'Samsung Teile-Abteilung'
              }
            }
          ]
        }
      ];

      const createdInventory = await Inventory.insertMany(germanInventoryItems);
      console.log('SeedService.seedGermanInventory: German inventory created successfully, count:', createdInventory.length);
      return { message: `German inventory created successfully, count: ${createdInventory.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanInventory: Error creating German inventory:', error);
      throw error;
    }
  }

  static async seedGermanDevices() {
    try {
      console.log('SeedService.seedGermanDevices: Starting German devices seeding...');

      // Check if Fairphone already exists
      const existingFairphone = await DeviceBrand.findOne({ name: 'Fairphone' });
      if (existingFairphone) {
        console.log('SeedService.seedGermanDevices: German devices already exist, skipping...');
        return { message: 'German devices already exist' };
      }

      console.log('SeedService.seedGermanDevices: Fairphone brand not found, creating...');
      const brand = new DeviceBrand({
        name: 'Fairphone',
        logo: 'https://via.placeholder.com/100x100/10b981/ffffff?text=Fairphone',
        isActive: true
      });
      const savedBrand = await brand.save();
      console.log(`SeedService.seedGermanDevices: Created brand Fairphone with ID:`, savedBrand._id);

      const models = [
        { name: 'Fairphone 5', deviceType: 'smartphone' },
        { name: 'Fairphone 4', deviceType: 'smartphone' }
      ].map(modelData => ({
        name: modelData.name,
        brandId: savedBrand._id,
        deviceType: modelData.deviceType,
        image: `https://via.placeholder.com/200x200/06b6d4/ffffff?text=${encodeURIComponent(modelData.name)}`,
        specifications: {},
        isActive: true
      }));

      const savedModels = await DeviceModel.insertMany(models);
      console.log(`SeedService.seedGermanDevices: Created ${savedModels.length} models for Fairphone`);

      console.log('SeedService.seedGermanDevices: German devices seeding completed successfully');
      return { message: 'German devices seeded successfully' };
    } catch (error) {
      console.error('SeedService.seedGermanDevices: Error creating German devices:', error);
      throw error;
    }
  }

  static async seedGermanProducts() {
    try {
      console.log('SeedService.seedGermanProducts: Starting German products seeding...');

      const existingGermanProduct = await Product.findOne({ name: 'iPhone 13 Pro Schutzhülle' });
      if (existingGermanProduct) {
        console.log('SeedService.seedGermanProducts: German products already exist, skipping...');
        return { message: 'German products already exist' };
      }

      const germanProducts = [
        {
          name: 'iPhone 13 Pro Schutzhülle (DE)',
          description: 'Premium Schutzhülle für iPhone 13 Pro',
          category: 'Cases',
          brand: 'FixitHub',
          price: 39.99,
          costPrice: 15.00,
          stockCount: 75,
          sku: 'DE-IP13-CASE-001',
          images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=Hülle'],
          inStock: true,
          isActive: true
        },
        {
          name: 'Kabelloses Ladepad (DE)',
          description: 'Schnelles kabelloses Ladepad kompatibel mit allen Qi-Geräten',
          category: 'Chargers',
          brand: 'FixitHub',
          price: 49.99,
          costPrice: 20.00,
          stockCount: 50,
          sku: 'DE-CHARGER-001',
          images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Ladegerät'],
          inStock: true,
          isActive: true
        },
        {
          name: 'Bildschirm-Reinigungsset (DE)',
          description: 'Professionelles Bildschirm-Reinigungsset mit Mikrofaser-Tuch',
          category: 'Accessories',
          brand: 'FixitHub',
          price: 19.99,
          costPrice: 5.00,
          stockCount: 100,
          sku: 'DE-CLEAN-001',
          images: ['https://via.placeholder.com/300x300/f59e0b/ffffff?text=Set'],
          inStock: true,
          isActive: true
        }
      ];

      const createdProducts = await Product.insertMany(germanProducts);
      console.log('SeedService.seedGermanProducts: German products created successfully, count:', createdProducts.length);
      return { message: `German products created successfully, count: ${createdProducts.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanProducts: Error creating German products:', error);
      throw error;
    }
  }

  static async seedGermanBlogData() {
    try {
      console.log('SeedService.seedGermanBlogData: Starting German blog data seeding (skipped - complex schema)...');
      // Blog seeding skipped due to complex category relationships
      // Categories need to be created first as separate objects with unique references
      return { message: 'German blog posts skipped (requires category setup)' };
    } catch (error) {
      console.error('SeedService.seedGermanBlogData: Error creating German blog posts:', error);
      throw error;
    }
  }

  static async seedGermanFAQs() {
    try {
      console.log('SeedService.seedGermanFAQs: Starting German FAQs seeding...');

      const existingGermanFAQ = await FAQ.findOne({ question: 'Wie lange dauert eine typische Bildschirmreparatur?' });
      if (existingGermanFAQ) {
        console.log('SeedService.seedGermanFAQs: German FAQs already exist, skipping...');
        return { message: 'German FAQs already exist' };
      }

      // Get admin user for createdBy reference
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser) {
        console.log('SeedService.seedGermanFAQs: No admin user found for FAQ creator, skipping...');
        return { message: 'No admin user found' };
      }

      const germanFAQs = [
        {
          question: 'Wie lange dauert eine typische Bildschirmreparatur?',
          answer: 'Die meisten Bildschirmreparaturen werden innerhalb von 1-2 Stunden abgeschlossen. Die genaue Zeit hängt vom Gerätemodell und der Teile-Verfügbarkeit ab.',
          category: 'General',
          tags: [],
          isActive: true,
          createdBy: adminUser._id,
          order: 1
        },
        {
          question: 'Bieten Sie Garantie auf Reparaturen?',
          answer: 'Ja, wir bieten eine 90-Tage-Garantie auf alle Reparaturarbeiten. Dies deckt alle Mängel in Teilen oder Verarbeitung ab.',
          category: 'Warranty',
          tags: [],
          isActive: true,
          createdBy: adminUser._id,
          order: 2
        },
        {
          question: 'Können Sie Daten von einem wassergeschädigten Telefon retten?',
          answer: 'In vielen Fällen ja. Unsere Datenrettungsquote für wassergeschädigte Geräte beträgt etwa 85%. Wir empfehlen, Ihr Gerät so schnell wie möglich zu bringen.',
          category: 'Technical',
          tags: [],
          isActive: true,
          createdBy: adminUser._id,
          order: 3
        },
        {
          question: 'Welche Zahlungsmethoden akzeptieren Sie?',
          answer: 'Wir akzeptieren Bargeld, Kreditkarten (Visa, MasterCard, American Express), Debitkarten und PayPal. Die Zahlung ist nach Abschluss der Reparatur fällig.',
          category: 'General',
          tags: [],
          isActive: true,
          createdBy: adminUser._id,
          order: 4
        },
        {
          question: 'Brauche ich einen Termin für eine Reparatur?',
          answer: 'Termine sind nicht erforderlich, aber wir empfehlen, einen zu vereinbaren, um einen schnelleren Service zu gewährleisten. Laufkundschaft ist willkommen, kann aber längere Wartezeiten erfordern.',
          category: 'Account',
          tags: [],
          isActive: true,
          createdBy: adminUser._id,
          order: 5
        }
      ];

      const createdFAQs = await FAQ.insertMany(germanFAQs);
      console.log('SeedService.seedGermanFAQs: German FAQs created successfully, count:', createdFAQs.length);
      return { message: `German FAQs created successfully, count: ${createdFAQs.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanFAQs: Error creating German FAQs:', error);
      throw error;
    }
  }

  static async seedGermanHomepageTemplate() {
    try {
      console.log('SeedService.seedGermanHomepageTemplate: Starting German homepage template seeding...');

      const existingGermanHomepage = await HomepageSection.findOne({ title: 'Professionelle Gerätereparaturservices' });
      if (existingGermanHomepage) {
        console.log('SeedService.seedGermanHomepageTemplate: German homepage template already exists, skipping...');
        return { message: 'German homepage template already exists' };
      }

      const germanHomepageData = [
        {
          name: 'Held Sektion (Deutsch)',
          type: 'hero',
          title: 'Professionelle Gerätereparaturservices',
          content: 'Lassen Sie Ihre Geräte von zertifizierten Technikern mit Originalersatzteilen und Garantieabdeckung reparieren.',
          settings: {
            backgroundColor: '#3b82f6',
            textColor: '#ffffff',
            buttonText: 'Jetzt anfangen',
            buttonLink: '/new-order',
            backgroundImage: 'https://via.placeholder.com/1920x800/3b82f6/ffffff?text=Hero+Sektion'
          },
          isActive: true,
          order: 1
        },
        {
          name: 'Services Übersicht (Deutsch)',
          type: 'services',
          title: 'Unsere Reparaturservices',
          content: 'Wir spezialisieren uns auf die Reparatur aller großen Gerätemarken mit schnellen Bearbeitungszeiten.',
          settings: {
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            showPricing: true,
            layout: 'grid'
          },
          isActive: true,
          order: 2
        },
        {
          name: 'Warum FixitHub (Deutsch)',
          type: 'features',
          title: 'Warum FixitHub wählen?',
          content: 'Professioneller Service, Originalersatzteile und Kundenzufriedenheit garantiert.',
          settings: {
            backgroundColor: '#f9fafb',
            textColor: '#1f2937',
            features: [
              'Zertifizierte Techniker',
              'Originalersatzteile',
              '90-Tage-Garantie',
              'Schnelle Bearbeitung'
            ]
          },
          isActive: true,
          order: 3
        },
        {
          name: 'Kundenaussagen (Deutsch)',
          type: 'testimonials',
          title: 'Was unsere Kunden sagen',
          content: 'Lesen Sie Bewertungen von zufriedenen Kunden, die uns ihre Gerätereparaturen anvertrauen.',
          settings: {
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            showRatings: true,
            autoplay: true
          },
          isActive: true,
          order: 4
        },
        {
          name: 'Aufruf zum Handeln (Deutsch)',
          type: 'cta',
          title: 'Bereit, Ihr Gerät zu reparieren?',
          content: 'Erhalten Sie noch heute ein kostenloses Angebot und erleben Sie unsere professionellen Reparaturservices.',
          settings: {
            backgroundColor: '#10b981',
            textColor: '#ffffff',
            buttonText: 'Kostenloses Angebot erhalten',
            buttonLink: '/new-order',
            centered: true
          },
          isActive: true,
          order: 5
        }
      ];

      const createdHomepage = await HomepageSection.insertMany(germanHomepageData);
      console.log('SeedService.seedGermanHomepageTemplate: German homepage template created successfully, count:', createdHomepage.length);
      return { message: `German homepage template created successfully, count: ${createdHomepage.length}` };
    } catch (error) {
      console.error('SeedService.seedGermanHomepageTemplate: Error creating German homepage template:', error);
      throw error;
    }
  }

  static async seedSystemConfiguration() {
    try {
      console.log('SeedService.seedSystemConfiguration: Starting system configuration seeding...');

      // Check if system configuration already exists
      const existingConfig = await SystemConfiguration.findOne({});
      if (existingConfig) {
        console.log('SeedService.seedSystemConfiguration: System configuration already exists');

        // Check if DHL integration exists
        const dhlIntegrationIndex = existingConfig.integrations?.findIndex(
          integration => integration.provider === 'DHL' && integration.type === 'shipping'
        );

        // Check if DHL Returns integration exists
        const dhlReturnsIntegrationIndex = existingConfig.integrations?.findIndex(
          integration => integration.name === 'DHL Returns' && integration.type === 'shipping'
        );

        if (dhlIntegrationIndex === -1 || dhlIntegrationIndex === undefined) {
          console.log('SeedService.seedSystemConfiguration: Adding DHL integration to existing configuration...');

          // Add DHL integration
          existingConfig.integrations = existingConfig.integrations || [];
          existingConfig.integrations.push({
            name: 'DHL Shipping',
            type: 'shipping',
            provider: 'DHL',
            apiKey: process.env.DHL_API_KEY || 'FXeDS8NuE39knXv2wzjwvZTqLfRTMik1',
            apiSecret: process.env.DHL_API_SECRET || 'LlLIqLo7v06IPc6G',
            endpoint: process.env.DHL_API_URL || 'https://api-sandbox.dhl.com/parcel/de/shipping/v2',
            settings: {
              accountNumber: process.env.DHL_ACCOUNT_NUMBER || '2222222222',
              billingNumber: process.env.DHL_BILLING_NUMBER || '22222222220101',
              defaultServiceType: 'P',
              sandbox: false
            },
            isActive: true,
            testStatus: 'pending'
          });

          await existingConfig.save();
          console.log('SeedService.seedSystemConfiguration: DHL integration added successfully');
        } else {
          console.log('SeedService.seedSystemConfiguration: Updating existing DHL integration with new credentials...');

          // Update existing DHL integration with new credentials
          existingConfig.integrations[dhlIntegrationIndex].apiKey = process.env.DHL_API_KEY || 'FXeDS8NuE39knXv2wzjwvZTqLfRTMik1';
          existingConfig.integrations[dhlIntegrationIndex].apiSecret = process.env.DHL_API_SECRET || 'LlLIqLo7v06IPc6G';
          existingConfig.integrations[dhlIntegrationIndex].endpoint = process.env.DHL_API_URL || 'https://api-sandbox.dhl.com/parcel/de/shipping/v2';
          existingConfig.integrations[dhlIntegrationIndex].settings = existingConfig.integrations[dhlIntegrationIndex].settings || {};
          existingConfig.integrations[dhlIntegrationIndex].settings.accountNumber = process.env.DHL_ACCOUNT_NUMBER || '2222222222';
          existingConfig.integrations[dhlIntegrationIndex].settings.billingNumber = process.env.DHL_BILLING_NUMBER || '22222222220101';
          existingConfig.integrations[dhlIntegrationIndex].settings.defaultServiceType = 'P';
          existingConfig.integrations[dhlIntegrationIndex].settings.sandbox = false;
          existingConfig.integrations[dhlIntegrationIndex].isActive = true;

          existingConfig.markModified('integrations');
          await existingConfig.save();
          console.log('SeedService.seedSystemConfiguration: DHL integration updated successfully with new API credentials');
        }

        // Add or update DHL Returns integration
        if (dhlReturnsIntegrationIndex === -1 || dhlReturnsIntegrationIndex === undefined) {
          console.log('SeedService.seedSystemConfiguration: Adding DHL Returns integration to existing configuration...');

          // Add DHL Returns integration
          existingConfig.integrations.push({
            name: 'DHL Returns',
            type: 'shipping',
            provider: 'DHL',
            apiKey: process.env.DHL_RETURNS_USERNAME || 'test_username',
            apiSecret: process.env.DHL_RETURNS_PASSWORD || 'test_password',
            endpoint: process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com',
            credentials: {
              apiKey: process.env.DHL_RETURNS_USERNAME || 'test_username',
              apiSecret: process.env.DHL_RETURNS_PASSWORD || 'test_password',
              apiEndpoint: process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com',
              accountId: process.env.DHL_RETURNS_RECEIVER_ID || '12345678901234'
            },
            metadata: {
              clientId: process.env.DHL_RETURNS_CLIENT_ID || '',
              clientSecret: process.env.DHL_RETURNS_CLIENT_SECRET || '',
              environment: process.env.DHL_RETURNS_ENV || 'sandbox'
            },
            settings: {
              autoGenerateLabel: true,
              defaultLabelType: 'BOTH', // PDF and QR code
              updateBookingStatus: true
            },
            isActive: true,
            testStatus: 'pending'
          });

          existingConfig.markModified('integrations');
          await existingConfig.save();
          console.log('SeedService.seedSystemConfiguration: DHL Returns integration added successfully');
        } else {
          console.log('SeedService.seedSystemConfiguration: Updating existing DHL Returns integration...');

          // Update existing DHL Returns integration
          existingConfig.integrations[dhlReturnsIntegrationIndex].apiKey = process.env.DHL_RETURNS_USERNAME || 'test_username';
          existingConfig.integrations[dhlReturnsIntegrationIndex].apiSecret = process.env.DHL_RETURNS_PASSWORD || 'test_password';
          existingConfig.integrations[dhlReturnsIntegrationIndex].endpoint = process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com';
          existingConfig.integrations[dhlReturnsIntegrationIndex].credentials = existingConfig.integrations[dhlReturnsIntegrationIndex].credentials || {};
          existingConfig.integrations[dhlReturnsIntegrationIndex].credentials.apiKey = process.env.DHL_RETURNS_USERNAME || 'test_username';
          existingConfig.integrations[dhlReturnsIntegrationIndex].credentials.apiSecret = process.env.DHL_RETURNS_PASSWORD || 'test_password';
          existingConfig.integrations[dhlReturnsIntegrationIndex].credentials.apiEndpoint = process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com';
          existingConfig.integrations[dhlReturnsIntegrationIndex].credentials.accountId = process.env.DHL_RETURNS_RECEIVER_ID || '12345678901234';
          existingConfig.integrations[dhlReturnsIntegrationIndex].metadata = existingConfig.integrations[dhlReturnsIntegrationIndex].metadata || {};
          existingConfig.integrations[dhlReturnsIntegrationIndex].metadata.clientId = process.env.DHL_RETURNS_CLIENT_ID || '';
          existingConfig.integrations[dhlReturnsIntegrationIndex].metadata.clientSecret = process.env.DHL_RETURNS_CLIENT_SECRET || '';
          existingConfig.integrations[dhlReturnsIntegrationIndex].metadata.environment = process.env.DHL_RETURNS_ENV || 'sandbox';
          existingConfig.integrations[dhlReturnsIntegrationIndex].settings = existingConfig.integrations[dhlReturnsIntegrationIndex].settings || {};
          existingConfig.integrations[dhlReturnsIntegrationIndex].settings.autoGenerateLabel = true;
          existingConfig.integrations[dhlReturnsIntegrationIndex].settings.defaultLabelType = 'BOTH';
          existingConfig.integrations[dhlReturnsIntegrationIndex].settings.updateBookingStatus = true;
          existingConfig.integrations[dhlReturnsIntegrationIndex].isActive = true;

          existingConfig.markModified('integrations');
          await existingConfig.save();
          console.log('SeedService.seedSystemConfiguration: DHL Returns integration updated successfully');
        }

        return { message: 'System configuration verified' };
      }

      console.log('SeedService.seedSystemConfiguration: Creating new system configuration...');

      // Create new system configuration with DHL integration
      const systemConfig = new SystemConfiguration({
        siteName: 'FixitHub',
        adminEmail: 'admin@fixithub.com',
        timezone: 'UTC',
        maintenanceMode: false,
        integrations: [
          {
            name: 'DHL Shipping',
            type: 'shipping',
            provider: 'DHL',
            apiKey: process.env.DHL_API_KEY || 'FXeDS8NuE39knXv2wzjwvZTqLfRTMik1',
            apiSecret: process.env.DHL_API_SECRET || 'LlLIqLo7v06IPc6G',
            endpoint: process.env.DHL_API_URL || 'https://api-sandbox.dhl.com/parcel/de/shipping/v2',
            settings: {
              accountNumber: process.env.DHL_ACCOUNT_NUMBER || '2222222222',
              billingNumber: process.env.DHL_BILLING_NUMBER || '22222222220101',
              defaultServiceType: 'P',
              sandbox: false
            },
            isActive: true,
            testStatus: 'pending'
          },
          {
            name: 'DHL Returns',
            type: 'shipping',
            provider: 'DHL',
            apiKey: process.env.DHL_RETURNS_USERNAME || 'test_username',
            apiSecret: process.env.DHL_RETURNS_PASSWORD || 'test_password',
            endpoint: process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com',
            credentials: {
              apiKey: process.env.DHL_RETURNS_USERNAME || 'test_username',
              apiSecret: process.env.DHL_RETURNS_PASSWORD || 'test_password',
              apiEndpoint: process.env.DHL_RETURNS_API_URL || 'https://api-sandbox.dhl.com',
              accountId: process.env.DHL_RETURNS_RECEIVER_ID || '12345678901234'
            },
            metadata: {
              clientId: process.env.DHL_RETURNS_CLIENT_ID || '',
              clientSecret: process.env.DHL_RETURNS_CLIENT_SECRET || '',
              environment: process.env.DHL_RETURNS_ENV || 'sandbox'
            },
            settings: {
              autoGenerateLabel: true,
              defaultLabelType: 'BOTH',
              updateBookingStatus: true
            },
            isActive: true,
            testStatus: 'pending'
          }
        ],
        notificationTemplates: [],
        emailSettings: {
          provider: 'SendGrid',
          apiKey: process.env.SENDGRID_API_KEY || '',
          fromEmail: 'noreply@fixithub.com',
          fromName: 'FixitHub'
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

  static async seedAll() {
    try {
      console.log('SeedService.seedAll: Starting complete database seeding...');

      const results = {};

      // Seed in order of dependencies
      results.systemConfiguration = await this.seedSystemConfiguration();
      results.adminUser = await this.seedAdminUser();
      results.testUsers = await this.seedTestUsers();
      results.services = await this.seedServices();
      results.addOnServices = await this.seedAddOnServices();
      results.inventory = await this.seedInventory();
      results.devices = await this.seedDevices();
      results.products = await this.seedProducts();
      results.blogData = await this.seedBlogData();
      results.faqs = await this.seedFAQs();
      results.homepageTemplate = await this.seedHomepageTemplate();
      results.financialData = await this.seedFinancialData();

      console.log('SeedService.seedAll: Complete database seeding finished successfully');
      return results;
    } catch (error) {
      console.error('SeedService.seedAll: Error during complete seeding:', error);
      throw error;
    }
  }

  static async seedAdmin() {
    return await this.seedAdminUser();
  }

  static async verifyTestUsers() {
    try {
      console.log('SeedService.verifyTestUsers: Verifying test user credentials...');

      const testCredentials = [
        { email: 'admin@example.com', password: 'admin123' },
        { email: 'customer@example.com', password: 'password123' },
        { email: 'staff@example.com', password: 'password123' }
      ];

      const UserService = require('./userService');
      const results = [];

      for (const creds of testCredentials) {
        try {
          console.log(`SeedService.verifyTestUsers: Testing login for ${creds.email}...`);
          const user = await UserService.authenticateWithPassword(creds.email, creds.password);
          if (user) {
            console.log(`SeedService.verifyTestUsers: ✓ Login successful for ${creds.email}`);
            results.push({ email: creds.email, status: 'success', role: user.role });
          } else {
            console.log(`SeedService.verifyTestUsers: ✗ Login failed for ${creds.email}`);
            results.push({ email: creds.email, status: 'failed', error: 'Authentication failed' });
          }
        } catch (error) {
          console.error(`SeedService.verifyTestUsers: ✗ Error testing ${creds.email}:`, error.message);
          results.push({ email: creds.email, status: 'error', error: error.message });
        }
      }

      console.log('SeedService.verifyTestUsers: Verification complete');
      return results;
    } catch (error) {
      console.error('SeedService.verifyTestUsers: Error during verification:', error);
      throw error;
    }
  }

  // —GERMAN_WORKFLOWS_SEEDING (file `server/services/seedService.js`) —
  // Description: Seed 5 example German workflows for repair and quality check processes available for all device and service types
  static async seedGermanWorkflows() {
    try {
      console.log('SeedService.seedGermanWorkflows: Starting German workflows seeding...');

      // Check if German workflows already exist
      const existingGermanWorkflows = await WorkflowTemplate.findOne({ name: /Allgemeiner/ });
      if (existingGermanWorkflows) {
        console.log('SeedService.seedGermanWorkflows: German workflows already exist, skipping...');
        return [];
      }

      const germanWorkflows = [
        {
          name: 'Allgemeiner Reparaturprozess',
          description: 'Vollständiger Workflow für alle Reparaturen mit Qualitätskontrolle. Dieser Workflow ist für alle Gerätetypen und Dienstleistungen verfügbar.',
          deviceTypes: [], // Empty array means available for all device types
          serviceTypes: [], // Empty array means available for all service types
          isActive: true,
          steps: [
            {
              name: 'Geräteüberprüfung und Diagnose',
              description: 'Überprüfen Sie den Gerätezustand und dokumentieren Sie bereits vorhandene Schäden',
              estimatedTime: 15,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              dependencies: [],
              tools: ['Inspektionslampe', 'Kamera', 'Diagnosesoftware'],
              skills: ['Sichtprüfung', 'Dokumentation', 'Diagnose'],
              checklistItems: [
                'Überprüfen Sie auf Wasserschäden',
                'Dokumentieren Sie alle vorhandenen Kratzer und Dellen',
                'Testen Sie die Funktionalität (soweit möglich)',
                'Machen Sie Fotos des Gerätezustands'
              ],
              formFields: [
                {
                  id: 'device_condition',
                  name: 'device_condition',
                  label: 'Gerätezustand',
                  type: 'select',
                  required: true,
                  placeholder: 'Wählen Sie den Gerätezustand',
                  options: [
                    { value: 'excellent', label: 'Ausgezeichnet' },
                    { value: 'good', label: 'Gut' },
                    { value: 'fair', label: 'Befriedigend' },
                    { value: 'poor', label: 'Schlecht' }
                  ],
                  order: 1
                },
                {
                  id: 'damage_description',
                  name: 'damage_description',
                  label: 'Beschreibung der Schäden',
                  type: 'textarea',
                  required: true,
                  placeholder: 'Beschreiben Sie alle vorhandenen Schäden im Detail',
                  validation: { minLength: 10, maxLength: 500 },
                  order: 2
                },
                {
                  id: 'water_damage_indicator',
                  name: 'water_damage_indicator',
                  label: 'Wasserschaden-Indikator erkannt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 3
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 0 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: true,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Ersatzteil-Vorbereitung',
              description: 'Bereiten Sie alle notwendigen Ersatzteile und Werkzeuge vor',
              estimatedTime: 10,
              isRequired: true,
              order: 2,
              category: 'repair',
              dependencies: ['device_condition'],
              tools: ['Ersatzteile', 'Werkzeugset'],
              skills: ['Teileverwaltung', 'Vorbereitung'],
              checklistItems: [
                'Überprüfen Sie die Ersatzteilkompatibilität',
                'Verifizieren Sie die Verfügbarkeit aller Teile',
                'Bereiten Sie das Werkzeugset vor',
                'Überprüfen Sie Verfallsdaten und Qualität'
              ],
              formFields: [
                {
                  id: 'parts_available',
                  name: 'parts_available',
                  label: 'Sind alle erforderlichen Ersatzteile verfügbar?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                },
                {
                  id: 'parts_serial',
                  name: 'parts_serial',
                  label: 'Seriennummern der Ersatzteile',
                  type: 'text',
                  required: false,
                  placeholder: 'Geben Sie die Seriennummern ein',
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 100 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Reparaturausführung',
              description: 'Führen Sie die eigentliche Reparatur nach Herstellervorgaben durch',
              estimatedTime: 45,
              isRequired: true,
              order: 3,
              category: 'repair',
              dependencies: ['parts_available'],
              tools: ['Verschiedene Werkzeuge', 'Ersatzteile'],
              skills: ['Reparaturtechnik', 'Handwerkliche Fähigkeiten'],
              checklistItems: [
                'Folgen Sie den Schritt-für-Schritt-Anweisungen',
                'Verwenden Sie die richtigen Werkzeuge',
                'Dokumentieren Sie jeden Schritt',
                'Achten Sie auf Sicherheit'
              ],
              formFields: [
                {
                  id: 'repair_steps_completed',
                  name: 'repair_steps_completed',
                  label: 'Reparaturschritte abgeschlossen',
                  type: 'checkbox',
                  required: true,
                  options: [
                    { value: 'disassembly', label: 'Demontage' },
                    { value: 'cleaning', label: 'Reinigung' },
                    { value: 'component_replacement', label: 'Komponentenwechsel' },
                    { value: 'reassembly', label: 'Wieder zusammenbauen' }
                  ],
                  order: 1
                },
                {
                  id: 'repair_notes',
                  name: 'repair_notes',
                  label: 'Reparaturnotizen',
                  type: 'textarea',
                  required: false,
                  placeholder: 'Notizen zu besonderen Problemen oder Beobachtungen',
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 200 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: true
              }
            },
            {
              name: 'Funktionsprüfung',
              description: 'Testen Sie alle Gerätfunktionen, um sicherzustellen, dass die Reparatur erfolgreich war',
              estimatedTime: 20,
              isRequired: true,
              order: 4,
              category: 'quality',
              dependencies: [],
              tools: ['Testsoftware', 'Multimeter', 'Testgeräte'],
              skills: ['Funktionsprüfung', 'Problemdiagnose'],
              checklistItems: [
                'Testen Sie das Hauptproblem (das behoben wurde)',
                'Testen Sie alle Sensoren',
                'Überprüfen Sie die Konnektivität (WiFi, Bluetooth)',
                'Führen Sie Stresstests durch'
              ],
              formFields: [
                {
                  id: 'primary_issue_resolved',
                  name: 'primary_issue_resolved',
                  label: 'Wurde das Hauptproblem behoben?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' },
                    { value: 'partial', label: 'Teilweise' }
                  ],
                  order: 1
                },
                {
                  id: 'test_results',
                  name: 'test_results',
                  label: 'Testergebnisse',
                  type: 'textarea',
                  required: true,
                  placeholder: 'Dokumentieren Sie alle Testergebnisse',
                  validation: { minLength: 10 },
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 300 },
              canSkip: false,
              requiresApproval: true,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            },
            {
              name: 'Endkontrolle und Verpackung',
              description: 'Führen Sie eine abschließende Kontrolle durch und verpacken Sie das Gerät sicher',
              estimatedTime: 10,
              isRequired: true,
              order: 5,
              category: 'completion',
              dependencies: [],
              tools: ['Mikrofasertuch', 'Verpackungsmaterial', 'Kamera'],
              skills: ['Reinigung', 'Verpackung', 'Finale Kontrolle'],
              checklistItems: [
                'Reinigen Sie das Gerät gründlich',
                'Entfernen Sie alle Fingerabdrücke',
                'Verpacken Sie das Gerät sicher',
                'Erstellen Sie ein Abschlussprotokoll'
              ],
              formFields: [
                {
                  id: 'device_cleaned',
                  name: 'device_cleaned',
                  label: 'Ist das Gerät gereinigt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                },
                {
                  id: 'packaging_secure',
                  name: 'packaging_secure',
                  label: 'Ist die Verpackung sicher?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 2
                },
                {
                  id: 'final_notes',
                  name: 'final_notes',
                  label: 'Abschließende Notizen',
                  type: 'textarea',
                  required: false,
                  placeholder: 'Weitere Notizen für den Kunden',
                  order: 3
                }
              ],
              requiresFormCompletion: true,
              automationRules: [
                {
                  trigger: 'step_completion',
                  action: 'update_status',
                  actionData: { orderStatus: 'ready-for-pickup' },
                  isActive: true
                }
              ],
              position: { x: 0, y: 400 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            }
          ],
          estimatedTotalTime: 100,
          globalAutomationRules: [],
          workflowSettings: {
            allowParallelSteps: false,
            requireStrictOrder: true,
            autoProgressOnCompletion: true
          }
        },
        {
          name: 'Allgemeine Qualitätskontrolle',
          description: 'Umfassender Qualitätskontroll-Workflow für alle Reparaturen. Dieser Workflow ist für alle Gerätetypen und Dienstleistungen verfügbar.',
          deviceTypes: [], // Empty array means available for all device types
          serviceTypes: [], // Empty array means available for all service types
          isActive: true,
          steps: [
            {
              name: 'Visuelle Inspektion',
              description: 'Führen Sie eine detaillierte visuelle Kontrolle des reparierten Geräts durch',
              estimatedTime: 15,
              isRequired: true,
              order: 1,
              category: 'quality',
              dependencies: [],
              tools: ['Inspektionslampe', 'Lupe', 'Kamera'],
              skills: ['Visuelle Inspektion', 'Detailbeobachtung'],
              checklistItems: [
                'Überprüfen Sie auf Kratzer oder Beschädigungen',
                'Prüfen Sie auf falsch ausgerichtete Teile',
                'Überprüfen Sie die Spaltmaße',
                'Dokumentieren Sie alle Mängel'
              ],
              formFields: [
                {
                  id: 'visual_quality_rating',
                  name: 'visual_quality_rating',
                  label: 'Visuelle Qualitätsbewertung',
                  type: 'select',
                  required: true,
                  options: [
                    { value: '5', label: 'Hervorragend - Keine Mängel' },
                    { value: '4', label: 'Sehr gut - Minimale Mängel' },
                    { value: '3', label: 'Gut - Akzeptable Mängel' },
                    { value: '2', label: 'Befriedigend - Mehrere Mängel' },
                    { value: '1', label: 'Unzureichend - Nicht akzeptabel' }
                  ],
                  order: 1
                },
                {
                  id: 'defects_found',
                  name: 'defects_found',
                  label: 'Gefundene Mängel',
                  type: 'textarea',
                  required: false,
                  placeholder: 'Beschreiben Sie alle visuellen Mängel',
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 0 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: true,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Funktionale Tests',
              description: 'Führen Sie umfassende Funktionstests aller Gerätekomponenten durch',
              estimatedTime: 25,
              isRequired: true,
              order: 2,
              category: 'quality',
              dependencies: [],
              tools: ['Testsoftware', 'Testgeräte', 'Multimeter'],
              skills: ['Funktionstests', 'Fehlerdiagnose'],
              checklistItems: [
                'Testen Sie alle Tasten und Schalter',
                'Überprüfen Sie Display/Touchscreen',
                'Testen Sie Lautsprecher und Mikrofon',
                'Überprüfen Sie Batterie/Ladung',
                'Testen Sie Verbindungen (USB, Kopfhörer, etc.)'
              ],
              formFields: [
                {
                  id: 'button_functionality',
                  name: 'button_functionality',
                  label: 'Funktionieren alle Tasten?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'partial', label: 'Teilweise' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                },
                {
                  id: 'display_functionality',
                  name: 'display_functionality',
                  label: 'Funktioniert das Display korrekt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'partial', label: 'Teilweise' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 2
                },
                {
                  id: 'audio_functionality',
                  name: 'audio_functionality',
                  label: 'Funktioniert das Audio (Lautsprecher/Mikrofon) korrekt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'partial', label: 'Teilweise' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 3
                },
                {
                  id: 'connectivity_functionality',
                  name: 'connectivity_functionality',
                  label: 'Funktionieren alle Verbindungen?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'partial', label: 'Teilweise' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 4
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 100 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Sicherheits- und Sicherheitsprüfung',
              description: 'Überprüfen Sie die Sicherheit und Stabilität des Geräts',
              estimatedTime: 15,
              isRequired: true,
              order: 3,
              category: 'quality',
              dependencies: [],
              tools: ['Sicherheitstestwerkzeuge', 'Antivirus-Software'],
              skills: ['Sicherheitsprüfung', 'Risikoanalyse'],
              checklistItems: [
                'Überprüfen Sie auf Überwärmung',
                'Überprüfen Sie die Batterie auf Schwellungen',
                'Führen Sie einen Antivirus-Scan durch',
                'Überprüfen Sie auf Spannungsprobleme'
              ],
              formFields: [
                {
                  id: 'safety_concerns',
                  name: 'safety_concerns',
                  label: 'Gibt es Sicherheitsbedenken?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                },
                {
                  id: 'safety_details',
                  name: 'safety_details',
                  label: 'Sicherheitsbedenken - Details',
                  type: 'textarea',
                  required: false,
                  placeholder: 'Beschreiben Sie alle Sicherheitsbedenken',
                  isConditional: true,
                  conditionalLogic: {
                    dependsOn: 'safety_concerns',
                    condition: 'equals',
                    value: 'yes'
                  },
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 200 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Leistungsprüfung',
              description: 'Testen Sie die Leistung des Geräts unter Last',
              estimatedTime: 20,
              isRequired: true,
              order: 4,
              category: 'quality',
              dependencies: [],
              tools: ['Benchmark-Software', 'Benchmark-Tools'],
              skills: ['Leistungstests', 'Benchmarking'],
              checklistItems: [
                'Führen Sie CPU-Benchmarks durch',
                'Führen Sie GPU-Benchmarks durch (falls zutreffend)',
                'Testen Sie die Speicherleistung',
                'Überprüfen Sie auf Drosselung'
              ],
              formFields: [
                {
                  id: 'performance_acceptable',
                  name: 'performance_acceptable',
                  label: 'Ist die Leistung akzeptabel?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'excellent', label: 'Ausgezeichnet' },
                    { value: 'good', label: 'Gut' },
                    { value: 'acceptable', label: 'Akzeptabel' },
                    { value: 'poor', label: 'Schlecht' }
                  ],
                  order: 1
                },
                {
                  id: 'performance_notes',
                  name: 'performance_notes',
                  label: 'Leistungsnotizen',
                  type: 'textarea',
                  required: false,
                  placeholder: 'Geben Sie alle Leistungsergebnisse an',
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 300 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Qualitätsbestätigung und Genehmigung',
              description: 'Geben Sie die abschließende Qualitätsbestätigung ab',
              estimatedTime: 10,
              isRequired: true,
              order: 5,
              category: 'completion',
              dependencies: [],
              tools: ['Qualitätscheckliste'],
              skills: ['Qualitätsbewertung', 'Entscheidungsfindung'],
              checklistItems: [
                'Überprüfen Sie alle Test-Ergebnisse',
                'Dokumentieren Sie die Qualitätsentscheidung',
                'Erhalten Sie die entsprechende Genehmigung'
              ],
              formFields: [
                {
                  id: 'quality_approval',
                  name: 'quality_approval',
                  label: 'Qualitätsbestätigung',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'approved', label: 'Genehmigt - Bereit zur Abgabe' },
                    { value: 'rework_required', label: 'Überarbeitung erforderlich' },
                    { value: 'rejected', label: 'Abgelehnt' }
                  ],
                  order: 1
                },
                {
                  id: 'quality_comments',
                  name: 'quality_comments',
                  label: 'Qualitätskommentare',
                  type: 'textarea',
                  required: true,
                  placeholder: 'Geben Sie Kommentare zur Qualitätsentscheidung an',
                  validation: { minLength: 5 },
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [
                {
                  trigger: 'form_submission',
                  condition: JSON.stringify({ field: 'quality_approval', value: 'approved' }),
                  action: 'update_status',
                  actionData: { orderStatus: 'quality-approved' },
                  isActive: true
                }
              ],
              position: { x: 0, y: 400 },
              canSkip: false,
              requiresApproval: true,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            }
          ],
          estimatedTotalTime: 85,
          globalAutomationRules: [],
          workflowSettings: {
            allowParallelSteps: false,
            requireStrictOrder: true,
            autoProgressOnCompletion: false
          }
        },
        {
          name: 'Wasserschaden-Wiederherstellung',
          description: 'Spezialisierter Workflow für die Behandlung und Wiederherstellung von Wasserschäden an Geräten',
          deviceTypes: [],
          serviceTypes: [],
          isActive: true,
          steps: [
            {
              name: 'Wasserschaden-Diagnose',
              description: 'Diagnostizieren Sie den Umfang und die Art des Wasserschadens',
              estimatedTime: 20,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              dependencies: [],
              tools: ['Multimeter', 'Inspektionslampe', 'Diagnosesoftware'],
              skills: ['Wasserschaden-Diagnose', 'Elektronik-Kenntnisse'],
              checklistItems: [
                'Überprüfen Sie die Wasserschaden-Indikatoren',
                'Suchen Sie nach Korrosionsspuren',
                'Überprüfen Sie auf Flüssigkeitsrückstände',
                'Testen Sie die Funktion der kritischen Komponenten'
              ],
              formFields: [
                {
                  id: 'water_damage_extent',
                  name: 'water_damage_extent',
                  label: 'Ausmaß des Wasserschadens',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'minimal', label: 'Minimal - Oberflächlich' },
                    { value: 'moderate', label: 'Moderat - Teilweise eindringen' },
                    { value: 'severe', label: 'Schwer - Tiefes Eindringen' },
                    { value: 'critical', label: 'Kritisch - Umfangreiche Beschädigung' }
                  ],
                  order: 1
                },
                {
                  id: 'damage_type',
                  name: 'damage_type',
                  label: 'Art der Flüssigkeit',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'fresh_water', label: 'Süßwasser' },
                    { value: 'salt_water', label: 'Salzwasser' },
                    { value: 'other_liquid', label: 'Andere Flüssigkeit' }
                  ],
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 0 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: true,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Trocknung und Reinigung',
              description: 'Trocknen und reinigen Sie alle betroffenen Komponenten',
              estimatedTime: 60,
              isRequired: true,
              order: 2,
              category: 'repair',
              dependencies: [],
              tools: ['Destilliertes Wasser', 'Isopropylalkohol', 'Druckluft', 'Wärmequelle'],
              skills: ['Reinigung', 'Trocknung', 'Detailarbeit'],
              checklistItems: [
                'Disassemblieren Sie das Gerät sorgfältig',
                'Spülen Sie mit destilliertem Wasser',
                'Wischen Sie mit Isopropylalkohol ab',
                'Trocknen Sie gründlich mit Druckluft',
                'Verwenden Sie bei Bedarf Wärmequelle'
              ],
              formFields: [
                {
                  id: 'drying_method',
                  name: 'drying_method',
                  label: 'Verwendete Trocknungsmethode',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'air_dry', label: 'Lufttrocknung' },
                    { value: 'compressed_air', label: 'Druckluft' },
                    { value: 'heat', label: 'Wärmetrocknung' },
                    { value: 'combined', label: 'Kombiniert' }
                  ],
                  order: 1
                },
                {
                  id: 'drying_duration',
                  name: 'drying_duration',
                  label: 'Trocknungsdauer (in Stunden)',
                  type: 'number',
                  required: true,
                  validation: { min: 1, max: 168 },
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 100 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: true
              }
            },
            {
              name: 'Komponentenbewertung',
              description: 'Bewerten Sie alle Komponenten auf Beschädigungen oder Austausch',
              estimatedTime: 30,
              isRequired: true,
              order: 3,
              category: 'diagnostic',
              dependencies: [],
              tools: ['Multimeter', 'Inspektionsgeräte'],
              skills: ['Komponentenbewertung', 'Fehlerdiagnose'],
              checklistItems: [
                'Überprüfen Sie Kondensatoren auf Beschädigungen',
                'Prüfen Sie auf Korrosion auf Leiterplatten',
                'Testen Sie wichtige Halbleiter',
                'Überprüfen Sie Stromversorgungskomponenten'
              ],
              formFields: [
                {
                  id: 'components_damaged',
                  name: 'components_damaged',
                  label: 'Beschädigte Komponenten',
                  type: 'multiselect',
                  required: false,
                  options: [
                    { value: 'battery', label: 'Batterie' },
                    { value: 'motherboard', label: 'Hauptplatine' },
                    { value: 'display', label: 'Display' },
                    { value: 'ports', label: 'Anschlüsse' },
                    { value: 'speakers', label: 'Lautsprecher' },
                    { value: 'microphone', label: 'Mikrofon' },
                    { value: 'other', label: 'Sonstige' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 200 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Komponentenaustausch und -reparatur',
              description: 'Tauschen oder reparieren Sie beschädigte Komponenten',
              estimatedTime: 45,
              isRequired: false,
              order: 4,
              category: 'repair',
              dependencies: ['components_damaged'],
              tools: ['Ersatzkomponenten', 'Lötkolben', 'Werkzeuge'],
              skills: ['Komponentenaustausch', 'Löten'],
              checklistItems: [
                'Entfernen Sie beschädigte Komponenten sorgfältig',
                'Installieren Sie Ersatzkomponenten',
                'Prüfen Sie auf Verbindungsfehler',
                'Testen Sie nach jedem Austausch'
              ],
              formFields: [
                {
                  id: 'replacement_completed',
                  name: 'replacement_completed',
                  label: 'Komponentenaustausch abgeschlossen',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 300 },
              canSkip: true,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Funktionsprüfung nach Wasserschaden',
              description: 'Testen Sie alle Funktionen nach der Wasserschaden-Behandlung',
              estimatedTime: 25,
              isRequired: true,
              order: 5,
              category: 'quality',
              dependencies: [],
              tools: ['Testsoftware', 'Testgeräte'],
              skills: ['Funktionstests', 'Diagnose'],
              checklistItems: [
                'Testen Sie die Stromversorgung',
                'Testen Sie alle Kommunikationsfunktionen',
                'Überprüfen Sie auf Korrosionsprobleme',
                'Durchführen Sie Stresstests'
              ],
              formFields: [
                {
                  id: 'device_operational',
                  name: 'device_operational',
                  label: 'Funktioniert das Gerät betriebsbereit?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'limited', label: 'Begrenzt' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 400 },
              canSkip: false,
              requiresApproval: true,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            }
          ],
          estimatedTotalTime: 180,
          globalAutomationRules: [],
          workflowSettings: {
            allowParallelSteps: false,
            requireStrictOrder: true,
            autoProgressOnCompletion: false
          }
        },
        {
          name: 'Batteriewechsel und -kalibrierung',
          description: 'Spezialisierter Workflow für sicheren Batteriewechsel und Kalibrierung',
          deviceTypes: [],
          serviceTypes: [],
          isActive: true,
          steps: [
            {
              name: 'Batterie-Diagnose',
              description: 'Diagnostizieren Sie den aktuellen Batteriezustand',
              estimatedTime: 15,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              dependencies: [],
              tools: ['Batterie-Tester', 'Diagnosesoftware'],
              skills: ['Batterie-Diagnostik', 'Dateninterpretation'],
              checklistItems: [
                'Führen Sie Batterie-Gesundheitstests durch',
                'Dokumentieren Sie die Batteriekapazität',
                'Überprüfen Sie auf Schwellungen oder Beschädigungen',
                'Überprüfen Sie das Ladeverhalten'
              ],
              formFields: [
                {
                  id: 'battery_health',
                  name: 'battery_health',
                  label: 'Batteriegesundheit (%)',
                  type: 'number',
                  required: true,
                  validation: { min: 0, max: 100 },
                  order: 1
                },
                {
                  id: 'battery_capacity',
                  name: 'battery_capacity',
                  label: 'Batteriekapazität (mAh)',
                  type: 'number',
                  required: true,
                  validation: { min: 0 },
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 0 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: true,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Batterie-Austausch',
              description: 'Sicherer Austausch der alten Batterie gegen eine neue',
              estimatedTime: 25,
              isRequired: true,
              order: 2,
              category: 'repair',
              dependencies: [],
              tools: ['Schraubendreher', 'Hebel', 'Wärmequelle', 'Sicherheitshandschuhe'],
              skills: ['Batterie-Austausch', 'Sicherheitsprotokolle'],
              checklistItems: [
                'Schalten Sie das Gerät vollständig aus',
                'Trennen Sie den Batterie-Anschluss zuerst',
                'Wenden Sie bei Bedarf Wärme an',
                'Entfernen Sie die Batterie sicher',
                'Entsorgen Sie die alte Batterie ordnungsgemäß'
              ],
              formFields: [
                {
                  id: 'new_battery_model',
                  name: 'new_battery_model',
                  label: 'Modell der neuen Batterie',
                  type: 'text',
                  required: true,
                  placeholder: 'Geben Sie das Modell an (z.B. BL-T7)',
                  order: 1
                },
                {
                  id: 'old_battery_disposed',
                  name: 'old_battery_disposed',
                  label: 'Alte Batterie ordnungsgemäß entsorgt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 100 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: true
              }
            },
            {
              name: 'Batterie-Kalibrierung und Test',
              description: 'Kalibrieren und testen Sie die neue Batterie',
              estimatedTime: 35,
              isRequired: true,
              order: 3,
              category: 'quality',
              dependencies: [],
              tools: ['Ladegerät', 'Batterie-Tester', 'Diagnosesoftware'],
              skills: ['Batterie-Kalibrierung', 'Batterie-Tests'],
              checklistItems: [
                'Testen Sie die Ladefunktion',
                'Stellen Sie sicher, dass die Batterie erkannt wird',
                'Überprüfen Sie die Ladegeschwindigkeit',
                'Führen Sie einen vollständigen Lade-/Entladezyklus durch',
                'Überprüfen Sie, ob die Batteriegesundheit 100% erreicht'
              ],
              formFields: [
                {
                  id: 'battery_recognized',
                  name: 'battery_recognized',
                  label: 'Wird die neue Batterie erkannt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 1
                },
                {
                  id: 'charge_speed',
                  name: 'charge_speed',
                  label: 'Ladegeschwindigkeit',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'very_fast', label: 'Sehr schnell' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'slow', label: 'Langsam' }
                  ],
                  order: 2
                },
                {
                  id: 'battery_health_percentage',
                  name: 'battery_health_percentage',
                  label: 'Neue Batteriegesundheit (%)',
                  type: 'number',
                  required: true,
                  validation: { min: 0, max: 100 },
                  order: 3
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 200 },
              canSkip: false,
              requiresApproval: true,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            }
          ],
          estimatedTotalTime: 75,
          globalAutomationRules: [],
          workflowSettings: {
            allowParallelSteps: false,
            requireStrictOrder: true,
            autoProgressOnCompletion: true
          }
        },
        {
          name: 'Display-Reparatur und -Kalibrierung',
          description: 'Umfassender Workflow für Display-Austausch, Kalibrierung und Farbtest',
          deviceTypes: [],
          serviceTypes: [],
          isActive: true,
          steps: [
            {
              name: 'Display-Diagnose',
              description: 'Diagnostizieren Sie den Display-Fehler und die Art der Beschädigung',
              estimatedTime: 15,
              isRequired: true,
              order: 1,
              category: 'diagnostic',
              dependencies: [],
              tools: ['Inspektionslampe', 'Testsoftware'],
              skills: ['Display-Diagnose', 'Fehleridentifikation'],
              checklistItems: [
                'Überprüfen Sie auf Risse oder Bruchstellen',
                'Testen Sie die Touch-Empfindlichkeit',
                'Überprüfen Sie auf tote Pixel',
                'Testen Sie die Farbwiedergabe'
              ],
              formFields: [
                {
                  id: 'display_issue_type',
                  name: 'display_issue_type',
                  label: 'Art des Display-Problems',
                  type: 'multiselect',
                  required: true,
                  options: [
                    { value: 'cracked', label: 'Risse/Bruch' },
                    { value: 'dead_pixels', label: 'Tote Pixel' },
                    { value: 'color_issues', label: 'Farbprobleme' },
                    { value: 'touch_unresponsive', label: 'Touch nicht reagierend' },
                    { value: 'brightness_issues', label: 'Helligkeit-Probleme' }
                  ],
                  order: 1
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 0 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: true,
                onComplete: false,
                onDelay: false
              }
            },
            {
              name: 'Display-Austausch',
              description: 'Sorgfältige Entfernung und Ersatz des Displays',
              estimatedTime: 35,
              isRequired: true,
              order: 2,
              category: 'repair',
              dependencies: [],
              tools: ['Wärmequelle', 'Saugnapf', 'Hebel', 'Neues Display', 'Klebstoff'],
              skills: ['Display-Austausch', 'Heizanwendung', 'Handwerkliche Fähigkeiten'],
              checklistItems: [
                'Wenden Sie Wärme an, um den Klebstoff zu lockern',
                'Verwenden Sie Saugnapf zum Abheben des Displays',
                'Trennen Sie vorsichtig die Flex-Kabel ab',
                'Entfernen Sie alle Klebstoffreste',
                'Installieren Sie das neue Display'
              ],
              formFields: [
                {
                  id: 'display_model',
                  name: 'display_model',
                  label: 'Modell des neuen Displays',
                  type: 'text',
                  required: true,
                  placeholder: 'Geben Sie das Display-Modell an',
                  order: 1
                },
                {
                  id: 'adhesive_removed',
                  name: 'adhesive_removed',
                  label: 'Alter Klebstoff vollständig entfernt?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 2
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 100 },
              canSkip: false,
              requiresApproval: false,
              notificationSettings: {
                onStart: false,
                onComplete: false,
                onDelay: true
              }
            },
            {
              name: 'Display-Kalibrierung und Farbtest',
              description: 'Kalibrieren und testen Sie das neue Display auf Farbe und Helligkeit',
              estimatedTime: 20,
              isRequired: true,
              order: 3,
              category: 'quality',
              dependencies: [],
              tools: ['Testsoftware', 'Farbtester', 'Helligkeitsmessgerät'],
              skills: ['Display-Kalibrierung', 'Farbtests', 'Qualitätskontrolle'],
              checklistItems: [
                'Führen Sie Farbtests durch',
                'Überprüfen Sie die Helligkeit',
                'Testen Sie die Touch-Empfindlichkeit über das gesamte Display',
                'Überprüfen Sie auf tote Pixel oder Hot Spots'
              ],
              formFields: [
                {
                  id: 'display_color_quality',
                  name: 'display_color_quality',
                  label: 'Display-Farbqualität',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'excellent', label: 'Ausgezeichnet' },
                    { value: 'good', label: 'Gut' },
                    { value: 'acceptable', label: 'Akzeptabel' },
                    { value: 'poor', label: 'Schlecht' }
                  ],
                  order: 1
                },
                {
                  id: 'touch_sensitivity',
                  name: 'touch_sensitivity',
                  label: 'Touch-Empfindlichkeit',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'excellent', label: 'Ausgezeichnet' },
                    { value: 'good', label: 'Gut' },
                    { value: 'acceptable', label: 'Akzeptabel' },
                    { value: 'poor', label: 'Schlecht' }
                  ],
                  order: 2
                },
                {
                  id: 'dead_pixels_found',
                  name: 'dead_pixels_found',
                  label: 'Tote Pixel gefunden?',
                  type: 'radio',
                  required: true,
                  options: [
                    { value: 'yes', label: 'Ja' },
                    { value: 'no', label: 'Nein' }
                  ],
                  order: 3
                }
              ],
              requiresFormCompletion: true,
              automationRules: [],
              position: { x: 0, y: 200 },
              canSkip: false,
              requiresApproval: true,
              notificationSettings: {
                onStart: false,
                onComplete: true,
                onDelay: false
              }
            }
          ],
          estimatedTotalTime: 70,
          globalAutomationRules: [],
          workflowSettings: {
            allowParallelSteps: false,
            requireStrictOrder: true,
            autoProgressOnCompletion: true
          }
        }
      ];

      const createdWorkflows = [];

      for (const workflowData of germanWorkflows) {
        try {
          const workflow = new WorkflowTemplate(workflowData);
          await workflow.save();
          createdWorkflows.push(workflow);
          console.log(`SeedService.seedGermanWorkflows: Created German workflow: ${workflow.name}`);
        } catch (error) {
          console.error(`SeedService.seedGermanWorkflows: Error creating workflow ${workflowData.name}:`, error.message);
          throw error;
        }
      }

      console.log(`SeedService.seedGermanWorkflows: German workflows created successfully, count: ${createdWorkflows.length}`);
      return createdWorkflows;
    } catch (error) {
      console.error('SeedService.seedGermanWorkflows: Error creating German workflows:', error);
      throw error;
    }
  }
  // —END_OF_GERMAN_WORKFLOWS_SEEDING—

  static async seedServiceCategories() {
    try {
      console.log('SeedService.seedServiceCategories: Starting service categories seeding...');

      // Check if categories already exist
      const existingCategories = await ServiceCategory.countDocuments();
      if (existingCategories > 0) {
        console.log('SeedService.seedServiceCategories: Service categories already exist, skipping...');
        return { message: 'Service categories already exist' };
      }

      console.log('SeedService.seedServiceCategories: Creating initial service categories...');

      // Repair service categories (matching the old enum values)
      const repairCategories = [
        {
          name: 'Display',
          description: 'Screen and display related repairs including LCD, OLED, and touch digitizer replacements',
          type: 'repair',
          icon: 'Monitor',
          color: '#3b82f6',
          order: 1,
          isActive: true
        },
        {
          name: 'Power',
          description: 'Battery, charging port, and power-related repairs',
          type: 'repair',
          icon: 'Battery',
          color: '#10b981',
          order: 2,
          isActive: true
        },
        {
          name: 'Camera',
          description: 'Front and rear camera repairs and replacements',
          type: 'repair',
          icon: 'Camera',
          color: '#8b5cf6',
          order: 3,
          isActive: true
        },
        {
          name: 'Emergency',
          description: 'Urgent repairs for critical device failures',
          type: 'repair',
          icon: 'AlertCircle',
          color: '#ef4444',
          order: 4,
          isActive: true
        },
        {
          name: 'Hardware',
          description: 'Physical component repairs including buttons, speakers, and microphones',
          type: 'repair',
          icon: 'Cpu',
          color: '#f59e0b',
          order: 5,
          isActive: true
        },
        {
          name: 'Software',
          description: 'Software-related services including OS updates and troubleshooting',
          type: 'repair',
          icon: 'Code',
          color: '#06b6d4',
          order: 6,
          isActive: true
        }
      ];

      // Add-on service categories (matching the old enum values)
      const addonCategories = [
        {
          name: 'Protection',
          description: 'Protective accessories like screen protectors and cases',
          type: 'addon',
          icon: 'Shield',
          color: '#3b82f6',
          order: 1,
          isActive: true
        },
        {
          name: 'Service',
          description: 'Additional service options like express repair and priority support',
          type: 'addon',
          icon: 'Zap',
          color: '#f59e0b',
          order: 2,
          isActive: true
        },
        {
          name: 'Warranty',
          description: 'Extended warranty and coverage options',
          type: 'addon',
          icon: 'FileCheck',
          color: '#10b981',
          order: 3,
          isActive: true
        },
        {
          name: 'Accessory',
          description: 'Device accessories like chargers, cables, and adapters',
          type: 'addon',
          icon: 'Package',
          color: '#8b5cf6',
          order: 4,
          isActive: true
        },
        {
          name: 'Data',
          description: 'Data backup, transfer, and recovery services',
          type: 'addon',
          icon: 'Database',
          color: '#06b6d4',
          order: 5,
          isActive: true
        }
      ];

      const allCategories = [...repairCategories, ...addonCategories];

      const createdCategories = await ServiceCategory.insertMany(allCategories);
      console.log(`SeedService.seedServiceCategories: Created ${createdCategories.length} service categories successfully`);

      return { message: `Service categories created successfully, count: ${createdCategories.length}` };
    } catch (error) {
      console.error('SeedService.seedServiceCategories: Error creating service categories:', error);
      throw error;
    }
  }
}

module.exports = SeedService;