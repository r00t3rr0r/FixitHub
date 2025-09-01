console.log('Loading User model...');
const User = require('../models/User');
console.log('Loading Service model...');
const Service = require('../models/Service');
console.log('Loading AddOnService model...');
const AddOnService = require('../models/AddOnService');
console.log('Loading Inventory model...');
const Inventory = require('../models/Inventory');
console.log('Loading BlogPost models...');
const { BlogPost, BlogCategory, BlogTag } = require('../models/BlogPost');
console.log('Loading FAQ model...');
const FAQ = require('../models/FAQ');
console.log('Loading Device models...');
const { DeviceBrand, DeviceModel } = require('../models/Device');
console.log('Loading password utils...');
const { hashPassword } = require('../utils/password');

class SeedService {
  static async seedAdmin() {
    try {
      console.log('SeedService: Checking for admin user...');

      const existingAdmin = await User.findOne({ role: 'admin' });
      if (existingAdmin) {
        console.log('SeedService: Admin user already exists');
        return { success: true, message: 'Admin user already exists' };
      }

      const hashedPassword = await hashPassword('admin123');

      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@fixithub.com',
        password: hashedPassword,
        role: 'admin',
        phone: '+1234567890',
        address: {
          street: '123 Admin Street',
          city: 'Admin City',
          state: 'AC',
          zipCode: '12345',
          country: 'USA'
        },
        isActive: true
      });

      await adminUser.save();
      console.log('SeedService: Admin user created successfully');

      return { success: true, message: 'Admin user created successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding admin user:', error);
      throw error;
    }
  }

  static async seedServices() {
    try {
      console.log('SeedService: Checking for services...');

      const existingServices = await Service.countDocuments();
      if (existingServices > 0) {
        console.log('SeedService: Services already exist');
        return { success: true, message: 'Services already exist' };
      }

      const services = [
        {
          name: 'Screen Replacement',
          description: 'Professional screen replacement for smartphones and tablets',
          price: 149.99,
          estimatedTime: '2-3 hours',
          category: 'Display',
          deviceTypes: ['smartphone', 'tablet'],
          isActive: true
        },
        {
          name: 'Battery Replacement',
          description: 'High-quality battery replacement service',
          price: 89.99,
          estimatedTime: '1-2 hours',
          category: 'Power',
          deviceTypes: ['smartphone', 'tablet', 'laptop'],
          isActive: true
        },
        {
          name: 'Water Damage Repair',
          description: 'Complete water damage assessment and repair',
          price: 199.99,
          estimatedTime: '1-2 days',
          category: 'Emergency',
          deviceTypes: ['smartphone', 'tablet'],
          isActive: true
        }
      ];

      await Service.insertMany(services);
      console.log('SeedService: Services seeded successfully');

      return { success: true, message: 'Services seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding services:', error);
      throw error;
    }
  }

  static async seedAddOnServices() {
    try {
      console.log('SeedService: Checking for add-on services...');

      const existingAddOns = await AddOnService.countDocuments();
      if (existingAddOns > 0) {
        console.log('SeedService: Add-on services already exist');
        return { success: true, message: 'Add-on services already exist' };
      }

      const addOnServices = [
        {
          name: 'Screen Protector Installation',
          description: 'Premium tempered glass screen protector installation',
          price: 29.99,
          estimatedTime: '15 minutes',
          category: 'Protection',
          compatibility: [
            { deviceType: 'smartphone', brands: ['Apple', 'Samsung', 'Google'] },
            { deviceType: 'tablet', brands: ['Apple', 'Samsung'] }
          ],
          isActive: true
        },
        {
          name: 'Device Cleaning',
          description: 'Professional device cleaning and sanitization',
          price: 19.99,
          estimatedTime: '10 minutes',
          category: 'Service',
          compatibility: [
            { deviceType: 'smartphone', brands: ['Apple', 'Samsung', 'Google'] },
            { deviceType: 'tablet', brands: ['Apple', 'Samsung'] }
          ],
          isActive: true
        },
        {
          name: 'Data Backup',
          description: 'Complete data backup before repair',
          price: 39.99,
          estimatedTime: '30 minutes',
          category: 'Data',
          compatibility: [
            { deviceType: 'smartphone', brands: ['Apple', 'Samsung', 'Google'] },
            { deviceType: 'tablet', brands: ['Apple', 'Samsung'] }
          ],
          isActive: true
        }
      ];

      await AddOnService.insertMany(addOnServices);
      console.log('SeedService: Add-on services seeded successfully');

      return { success: true, message: 'Add-on services seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding add-on services:', error);
      throw error;
    }
  }

  static async seedInventory() {
    try {
      console.log('SeedService: Checking for inventory...');

      const existingInventory = await Inventory.countDocuments();
      if (existingInventory > 0) {
        console.log('SeedService: Inventory already exists');
        return { success: true, message: 'Inventory already exists' };
      }

      const inventoryItems = [
        {
          itemName: 'iPhone 14 Screen Assembly',
          itemDescription: 'Original quality iPhone 14 screen replacement with digitizer',
          category: 'display',
          manufacturer: 'Apple',
          brand: 'iPhone',
          compatibleDevices: ['iPhone 14'],
          versions: [
            {
              versionType: 'original',
              versionId: 'IPH14-SCR-ORG',
              quantity: 25,
              minStockLevel: 5,
              reorderLevel: 10,
              unitCost: 89.99,
              sellingPrice: 149.99,
              storageLocation: 'A1-B2',
              supplierInfo: {
                name: 'TechParts Inc',
                contactPerson: 'John Smith',
                email: 'orders@techparts.com',
                phone: '+1-555-0123',
                address: '123 Tech Street, Silicon Valley, CA'
              },
              status: 'active'
            },
            {
              versionType: 'efficient',
              versionId: 'IPH14-SCR-EFF',
              quantity: 50,
              minStockLevel: 10,
              reorderLevel: 20,
              unitCost: 59.99,
              sellingPrice: 99.99,
              storageLocation: 'A1-B3',
              supplierInfo: {
                name: 'Quality Parts Co',
                contactPerson: 'Jane Doe',
                email: 'sales@qualityparts.com',
                phone: '+1-555-0456',
                address: '456 Parts Ave, Tech City, CA'
              },
              status: 'active'
            }
          ]
        },
        {
          itemName: 'Samsung Galaxy S23 Battery',
          itemDescription: 'High-capacity replacement battery for Samsung Galaxy S23',
          category: 'battery',
          manufacturer: 'Samsung',
          brand: 'Galaxy',
          compatibleDevices: ['Galaxy S23'],
          versions: [
            {
              versionType: 'original',
              versionId: 'SAM-S23-BAT-ORG',
              quantity: 30,
              minStockLevel: 8,
              reorderLevel: 15,
              unitCost: 45.99,
              sellingPrice: 79.99,
              storageLocation: 'B2-C1',
              supplierInfo: {
                name: 'Samsung Parts Direct',
                contactPerson: 'Mike Johnson',
                email: 'orders@samsungparts.com',
                phone: '+1-555-0789',
                address: '789 Samsung Blvd, Mobile City, CA'
              },
              status: 'active'
            }
          ]
        }
      ];

      await Inventory.insertMany(inventoryItems);
      console.log('SeedService: Inventory seeded successfully');

      return { success: true, message: 'Inventory seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding inventory:', error);
      throw error;
    }
  }

  static async seedDevices() {
    try {
      console.log('SeedService: Checking for device brands and models...');

      const existingBrands = await DeviceBrand.countDocuments();
      if (existingBrands > 0) {
        console.log('SeedService: Device brands already exist');
        return { success: true, message: 'Device brands already exist' };
      }

      // Create brands
      const brands = [
        {
          name: 'Apple',
          logo: 'https://via.placeholder.com/100x100/000000/ffffff?text=Apple'
        },
        {
          name: 'Samsung',
          logo: 'https://via.placeholder.com/100x100/1f4e79/ffffff?text=Samsung'
        },
        {
          name: 'Google',
          logo: 'https://via.placeholder.com/100x100/4285f4/ffffff?text=Google'
        },
        {
          name: 'OnePlus',
          logo: 'https://via.placeholder.com/100x100/eb0028/ffffff?text=OnePlus'
        },
        {
          name: 'Microsoft',
          logo: 'https://via.placeholder.com/100x100/00bcf2/ffffff?text=Microsoft'
        },
        {
          name: 'Dell',
          logo: 'https://via.placeholder.com/100x100/007db8/ffffff?text=Dell'
        },
        {
          name: 'HP',
          logo: 'https://via.placeholder.com/100x100/0096d6/ffffff?text=HP'
        },
        {
          name: 'Lenovo',
          logo: 'https://via.placeholder.com/100x100/e2231a/ffffff?text=Lenovo'
        }
      ];

      const createdBrands = await DeviceBrand.insertMany(brands);
      console.log('SeedService: Device brands created');

      // Create models
      const models = [
        // Apple smartphones
        { name: 'iPhone 15 Pro', brandId: createdBrands[0]._id, deviceType: 'smartphone' },
        { name: 'iPhone 15', brandId: createdBrands[0]._id, deviceType: 'smartphone' },
        { name: 'iPhone 14 Pro', brandId: createdBrands[0]._id, deviceType: 'smartphone' },
        { name: 'iPhone 14', brandId: createdBrands[0]._id, deviceType: 'smartphone' },

        // Apple tablets
        { name: 'iPad Pro 12.9"', brandId: createdBrands[0]._id, deviceType: 'tablet' },
        { name: 'iPad Air', brandId: createdBrands[0]._id, deviceType: 'tablet' },
        { name: 'iPad', brandId: createdBrands[0]._id, deviceType: 'tablet' },

        // Apple laptops
        { name: 'MacBook Pro 16"', brandId: createdBrands[0]._id, deviceType: 'laptop' },
        { name: 'MacBook Air', brandId: createdBrands[0]._id, deviceType: 'laptop' },

        // Apple smartwatches
        { name: 'Apple Watch Series 9', brandId: createdBrands[0]._id, deviceType: 'smartwatch' },
        { name: 'Apple Watch SE', brandId: createdBrands[0]._id, deviceType: 'smartwatch' },

        // Samsung smartphones
        { name: 'Galaxy S24 Ultra', brandId: createdBrands[1]._id, deviceType: 'smartphone' },
        { name: 'Galaxy S24', brandId: createdBrands[1]._id, deviceType: 'smartphone' },
        { name: 'Galaxy S23 Ultra', brandId: createdBrands[1]._id, deviceType: 'smartphone' },
        { name: 'Galaxy Note 20', brandId: createdBrands[1]._id, deviceType: 'smartphone' },

        // Samsung tablets
        { name: 'Galaxy Tab S9 Ultra', brandId: createdBrands[1]._id, deviceType: 'tablet' },
        { name: 'Galaxy Tab S9', brandId: createdBrands[1]._id, deviceType: 'tablet' },
        { name: 'Galaxy Tab A8', brandId: createdBrands[1]._id, deviceType: 'tablet' },

        // Samsung smartwatches
        { name: 'Galaxy Watch 6', brandId: createdBrands[1]._id, deviceType: 'smartwatch' },
        { name: 'Galaxy Watch 5', brandId: createdBrands[1]._id, deviceType: 'smartwatch' },

        // Google smartphones
        { name: 'Pixel 8 Pro', brandId: createdBrands[2]._id, deviceType: 'smartphone' },
        { name: 'Pixel 8', brandId: createdBrands[2]._id, deviceType: 'smartphone' },
        { name: 'Pixel 7 Pro', brandId: createdBrands[2]._id, deviceType: 'smartphone' },

        // OnePlus smartphones
        { name: 'OnePlus 12', brandId: createdBrands[3]._id, deviceType: 'smartphone' },
        { name: 'OnePlus 11', brandId: createdBrands[3]._id, deviceType: 'smartphone' },
        { name: 'OnePlus 10 Pro', brandId: createdBrands[3]._id, deviceType: 'smartphone' },

        // Microsoft tablets
        { name: 'Surface Pro 9', brandId: createdBrands[4]._id, deviceType: 'tablet' },
        { name: 'Surface Go 3', brandId: createdBrands[4]._id, deviceType: 'tablet' },

        // Dell laptops
        { name: 'XPS 13', brandId: createdBrands[5]._id, deviceType: 'laptop' },
        { name: 'Inspiron 15', brandId: createdBrands[5]._id, deviceType: 'laptop' },

        // HP laptops
        { name: 'Spectre x360', brandId: createdBrands[6]._id, deviceType: 'laptop' },
        { name: 'Pavilion 15', brandId: createdBrands[6]._id, deviceType: 'laptop' },

        // Lenovo laptops
        { name: 'ThinkPad X1 Carbon', brandId: createdBrands[7]._id, deviceType: 'laptop' },
        { name: 'IdeaPad 5', brandId: createdBrands[7]._id, deviceType: 'laptop' }
      ];

      await DeviceModel.insertMany(models);
      console.log('SeedService: Device models created');

      return { success: true, message: 'Device brands and models seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding devices:', error);
      throw error;
    }
  }

  static async seedBlogData() {
    try {
      console.log('SeedService: Checking for blog data...');

      const existingPosts = await BlogPost.countDocuments();
      if (existingPosts > 0) {
        console.log('SeedService: Blog data already exists');
        return { success: true, message: 'Blog data already exists' };
      }

      // Get admin user for author
      console.log('SeedService: Finding admin user for blog posts...');
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser) {
        throw new Error('Admin user not found. Please seed admin user first.');
      }
      console.log('SeedService: Admin user found:', adminUser.email);

      // Create categories
      console.log('SeedService: Creating blog categories...');
      const categories = [
        {
          name: 'Tips & Tricks',
          slug: 'tips-tricks',
          description: 'Helpful advice for device maintenance and optimization',
          order: 1,
          isActive: true
        },
        {
          name: 'Device Reviews',
          slug: 'device-reviews',
          description: 'In-depth reviews of the latest devices',
          order: 2,
          isActive: true
        },
        {
          name: 'Repair Guides',
          slug: 'repair-guides',
          description: 'Step-by-step repair instructions and guides',
          order: 3,
          isActive: true
        }
      ];

      const createdCategories = await BlogCategory.insertMany(categories);
      console.log('SeedService: Blog categories created:', createdCategories.length);

      // Create tags
      console.log('SeedService: Creating blog tags...');
      const tags = [
        { name: 'Battery', slug: 'battery', color: '#10b981', isActive: true },
        { name: 'Screen Repair', slug: 'screen-repair', color: '#3b82f6', isActive: true },
        { name: 'iPhone', slug: 'iphone', color: '#ef4444', isActive: true },
        { name: 'Samsung', slug: 'samsung', color: '#8b5cf6', isActive: true },
        { name: 'Water Damage', slug: 'water-damage', color: '#06b6d4', isActive: true }
      ];

      const createdTags = await BlogTag.insertMany(tags);
      console.log('SeedService: Blog tags created:', createdTags.length);

      // Create blog posts
      console.log('SeedService: Creating blog posts...');
      const posts = [
        {
          title: 'How to Extend Your Phone Battery Life: Expert Tips',
          slug: 'extend-phone-battery-life-expert-tips',
          excerpt: 'Learn professional techniques to maximize your smartphone battery performance and longevity with these proven strategies.',
          content: '<h2>Understanding Battery Health</h2><p>Your smartphone battery is one of its most critical components. Over time, all batteries degrade, but with proper care, you can significantly extend their lifespan.</p><h3>Key Tips for Battery Longevity</h3><ul><li>Avoid extreme temperatures</li><li>Don\'t let your battery drain completely</li><li>Use original chargers when possible</li><li>Enable battery optimization features</li></ul><p>Following these simple guidelines can help your battery last much longer and maintain better performance throughout its life.</p>',
          featuredImage: 'https://via.placeholder.com/800x400/10b981/ffffff?text=Battery+Tips',
          author: adminUser._id,
          category: createdCategories[0]._id,
          tags: [createdTags[0]._id, createdTags[2]._id],
          status: 'published',
          publishedAt: new Date(),
          isFeatured: true,
          featuredOrder: 1,
          seoTitle: 'How to Extend Phone Battery Life - Expert Tips & Tricks',
          seoDescription: 'Learn professional techniques to maximize smartphone battery performance with our expert guide.',
          seoKeywords: ['battery life', 'smartphone', 'optimization', 'tips']
        },
        {
          title: 'iPhone vs Samsung: Repair Cost Comparison 2024',
          slug: 'iphone-vs-samsung-repair-costs-2024',
          excerpt: 'A comprehensive breakdown of repair costs for iPhone and Samsung devices to help you make informed decisions.',
          content: '<h2>Repair Cost Analysis</h2><p>When choosing between iPhone and Samsung devices, repair costs are an important consideration.</p><h3>Screen Replacement Costs</h3><ul><li>iPhone 15: $279-$329</li><li>Samsung Galaxy S24: $249-$299</li></ul><h3>Battery Replacement</h3><ul><li>iPhone: $89-$99</li><li>Samsung: $79-$89</li></ul><p>While both brands offer quality devices, Samsung generally has slightly lower repair costs.</p>',
          featuredImage: 'https://via.placeholder.com/800x400/8b5cf6/ffffff?text=Phone+Comparison',
          author: adminUser._id,
          category: createdCategories[1]._id,
          tags: [createdTags[2]._id, createdTags[3]._id],
          status: 'published',
          publishedAt: new Date(Date.now() - 86400000), // 1 day ago
          isFeatured: false
        }
      ];

      const createdPosts = await BlogPost.insertMany(posts);
      console.log('SeedService: Blog posts created:', createdPosts.length);
      console.log('SeedService: Blog data seeded successfully');

      return { success: true, message: 'Blog data seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding blog data:', error);
      console.error('SeedService: Error stack:', error.stack);
      throw error;
    }
  }

  static async seedFAQData() {
    try {
      console.log('SeedService: Checking for FAQ data...');

      const existingFAQs = await FAQ.countDocuments();
      if (existingFAQs > 0) {
        console.log('SeedService: FAQ data already exists');
        return { success: true, message: 'FAQ data already exists' };
      }

      // Get admin user for creator
      console.log('SeedService: Finding admin user for FAQs...');
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser) {
        throw new Error('Admin user not found. Please seed admin user first.');
      }
      console.log('SeedService: Admin user found for FAQs:', adminUser.email);

      console.log('SeedService: Creating FAQs...');
      const faqs = [
        {
          question: 'How long does a typical repair take?',
          answer: 'Most repairs are completed within 2-4 hours. Complex repairs like water damage may take 1-2 business days. We\'ll provide you with an estimated completion time when you drop off your device.',
          category: 'General',
          order: 1,
          tags: ['repair time', 'general'],
          createdBy: adminUser._id
        },
        {
          question: 'Do you offer a warranty on repairs?',
          answer: 'Yes! We provide a 90-day warranty on all repairs. This covers any defects in parts or workmanship. The warranty does not cover new damage or normal wear and tear.',
          category: 'Warranty',
          order: 1,
          tags: ['warranty', 'guarantee'],
          createdBy: adminUser._id
        },
        {
          question: 'What should I do if my phone gets water damaged?',
          answer: 'Turn off your device immediately and do not try to charge it. Remove the battery if possible. Bring it to us as soon as possible - the sooner we can start the repair process, the better the chances of recovery.',
          category: 'Repairs',
          order: 1,
          tags: ['water damage', 'emergency'],
          createdBy: adminUser._id
        },
        {
          question: 'How much does a screen replacement cost?',
          answer: 'Screen replacement costs vary by device model. iPhone screens typically range from $149-$329, while Samsung screens range from $129-$299. Contact us for a specific quote for your device.',
          category: 'Pricing',
          order: 1,
          tags: ['screen replacement', 'pricing'],
          createdBy: adminUser._id
        },
        {
          question: 'Do I need to backup my data before repair?',
          answer: 'While we take every precaution to protect your data, we recommend backing up your device before any repair. We also offer a data backup service for an additional fee.',
          category: 'Technical',
          order: 1,
          tags: ['data backup', 'preparation'],
          createdBy: adminUser._id
        }
      ];

      const createdFAQs = await FAQ.insertMany(faqs);
      console.log('SeedService: FAQs created:', createdFAQs.length);
      console.log('SeedService: FAQ data seeded successfully');

      return { success: true, message: 'FAQ data seeded successfully' };
    } catch (error) {
      console.error('SeedService: Error seeding FAQ data:', error);
      console.error('SeedService: Error stack:', error.stack);
      throw error;
    }
  }
}

module.exports = SeedService;