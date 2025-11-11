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
const Invoice = require('../models/Invoice');
const Language = require('../models/Language');
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
          category: 'Repair',
          price: 149.99,
          estimatedTime: 60,
          deviceTypes: ['iPhone', 'Samsung', 'iPad'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Battery Replacement',
          description: 'Replace old or degraded batteries to restore device performance',
          category: 'Repair',
          price: 89.99,
          estimatedTime: 45,
          deviceTypes: ['iPhone', 'Samsung', 'MacBook'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Water Damage Repair',
          description: 'Comprehensive water damage assessment and repair service',
          category: 'Repair',
          price: 199.99,
          estimatedTime: 120,
          deviceTypes: ['iPhone', 'Samsung', 'iPad'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Data Recovery',
          description: 'Professional data recovery from damaged or corrupted devices',
          category: 'Data',
          price: 299.99,
          estimatedTime: 180,
          deviceTypes: ['iPhone', 'Samsung', 'MacBook', 'iPad'],
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Charging Port Repair',
          description: 'Fix charging port issues and connection problems',
          category: 'Repair',
          price: 79.99,
          estimatedTime: 30,
          deviceTypes: ['iPhone', 'Samsung'],
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
        return [];
      }

      const invoices = [
        {
          customerId: customers[0]._id,
          orderId: null, // Will be set when orders are created
          invoiceNumber: 'INV-2024-001',
          items: [
            {
              description: 'iPhone 13 Screen Replacement',
              quantity: 1,
              unitPrice: 149.99,
              total: 149.99
            },
            {
              description: 'Screen Protector Installation',
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
          orderId: null,
          invoiceNumber: 'INV-2024-002',
          items: [
            {
              description: 'Samsung Galaxy S21 Battery Replacement',
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

  static async seedAll() {
    try {
      console.log('SeedService.seedAll: Starting complete database seeding...');
      
      const results = {};
      
      // Seed in order of dependencies
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
}

module.exports = SeedService;