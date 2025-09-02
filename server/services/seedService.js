const User = require('../models/User');
const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');
const Inventory = require('../models/Inventory');
const Device = require('../models/Device');
const Product = require('../models/Product');
const { BlogPost, BlogCategory, BlogTag } = require('../models/BlogPost');
const FAQ = require('../models/FAQ');
const { LayoutTemplate } = require('../models/Homepage');
const { hashPassword } = require('../utils/password');

class SeedService {
  // Seed admin user
  static async seedAdmin() {
    try {
      const existingAdmin = await User.findOne({ role: 'admin' });
      if (existingAdmin) {
        return { success: true, message: 'Admin user already exists' };
      }

      const hashedPassword = await hashPassword('admin123');
      const admin = new User({
        name: 'System Admin',
        email: 'admin@fixithub.com',
        password: hashedPassword,
        role: 'admin',
        phone: '+1234567890',
        address: {
          street: '123 Admin Street',
          city: 'Admin City',
          state: 'Admin State',
          zipCode: '12345',
          country: 'USA'
        }
      });

      await admin.save();
      return { success: true, message: 'Admin user created successfully' };
    } catch (error) {
      throw new Error(`Failed to seed admin user: ${error.message}`);
    }
  }

  // Seed services
  static async seedServices() {
    try {
      const existingServices = await Service.countDocuments();
      if (existingServices > 0) {
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
          popularity: 95,
          isActive: true
        },
        {
          name: 'Battery Replacement',
          description: 'High-quality battery replacement with warranty',
          price: 89.99,
          estimatedTime: '1-2 hours',
          category: 'Power',
          deviceTypes: ['smartphone', 'tablet', 'laptop'],
          popularity: 88,
          isActive: true
        },
        {
          name: 'Water Damage Repair',
          description: 'Complete water damage assessment and repair',
          price: 199.99,
          estimatedTime: '1-2 days',
          category: 'Liquid Damage',
          deviceTypes: ['smartphone', 'tablet'],
          popularity: 75,
          isActive: true
        },
        {
          name: 'Charging Port Repair',
          description: 'Fix charging port issues and connectivity problems',
          price: 79.99,
          estimatedTime: '2-4 hours',
          category: 'Connectivity',
          deviceTypes: ['smartphone', 'tablet'],
          popularity: 82,
          isActive: true
        },
        {
          name: 'Camera Repair',
          description: 'Camera module replacement and repair',
          price: 129.99,
          estimatedTime: '2-3 hours',
          category: 'Camera',
          deviceTypes: ['smartphone', 'tablet'],
          popularity: 70,
          isActive: true
        },
        {
          name: 'Speaker Repair',
          description: 'Audio system repair and speaker replacement',
          price: 69.99,
          estimatedTime: '1-2 hours',
          category: 'Audio',
          deviceTypes: ['smartphone', 'tablet'],
          popularity: 65,
          isActive: true
        }
      ];

      await Service.insertMany(services);
      return { success: true, message: 'Services seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed services: ${error.message}`);
    }
  }

  // Seed add-on services
  static async seedAddOnServices() {
    try {
      const existingAddOns = await AddOnService.countDocuments();
      if (existingAddOns > 0) {
        return { success: true, message: 'Add-on services already exist' };
      }

      const addOnServices = [
        {
          name: 'Screen Protector Installation',
          description: 'Premium tempered glass screen protector installation',
          price: 24.99,
          category: 'Protection',
          estimatedTime: '15 minutes',
          isActive: true,
          popularity: 90
        },
        {
          name: 'Phone Case',
          description: 'Protective case for your device',
          price: 19.99,
          category: 'Protection',
          estimatedTime: '5 minutes',
          isActive: true,
          popularity: 85
        },
        {
          name: 'Data Backup Service',
          description: 'Complete data backup and transfer service',
          price: 39.99,
          category: 'Data',
          estimatedTime: '30 minutes',
          isActive: true,
          popularity: 75
        },
        {
          name: 'Express Service',
          description: 'Priority repair service - completed within 4 hours',
          price: 49.99,
          category: 'Service',
          estimatedTime: '0 minutes',
          isActive: true,
          popularity: 60
        },
        {
          name: 'Extended Warranty',
          description: '6-month extended warranty on repairs',
          price: 29.99,
          category: 'Warranty',
          estimatedTime: '0 minutes',
          isActive: true,
          popularity: 55
        },
        {
          name: 'Device Cleaning',
          description: 'Professional device cleaning and sanitization',
          price: 14.99,
          category: 'Maintenance',
          estimatedTime: '10 minutes',
          isActive: true,
          popularity: 70
        }
      ];

      await AddOnService.insertMany(addOnServices);
      return { success: true, message: 'Add-on services seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed add-on services: ${error.message}`);
    }
  }

  // Seed inventory
  static async seedInventory() {
    try {
      const existingInventory = await Inventory.countDocuments();
      if (existingInventory > 0) {
        return { success: true, message: 'Inventory already exists' };
      }

      const inventoryItems = [
        {
          name: 'iPhone 13 Screen Assembly',
          description: 'Complete LCD screen assembly for iPhone 13',
          category: 'Screens',
          manufacturer: 'Apple',
          brand: 'iPhone',
          versions: [
            {
              type: 'Original',
              quantity: 25,
              minimumStock: 5,
              reorderLevel: 10,
              unitCost: 89.99,
              sellingPrice: 149.99,
              storageLocation: 'A1-B2',
              supplierInfo: 'Apple Parts Direct',
              leadTime: 7,
              status: 'active'
            },
            {
              type: 'Efficient',
              quantity: 50,
              minimumStock: 10,
              reorderLevel: 20,
              unitCost: 45.99,
              sellingPrice: 99.99,
              storageLocation: 'A1-B3',
              supplierInfo: 'TechParts Plus',
              leadTime: 3,
              status: 'active'
            }
          ]
        },
        {
          name: 'Samsung Galaxy S21 Battery',
          description: 'Lithium-ion battery for Samsung Galaxy S21',
          category: 'Batteries',
          manufacturer: 'Samsung',
          brand: 'Galaxy',
          versions: [
            {
              type: 'Original',
              quantity: 30,
              minimumStock: 8,
              reorderLevel: 15,
              unitCost: 29.99,
              sellingPrice: 59.99,
              storageLocation: 'B2-C1',
              supplierInfo: 'Samsung Parts',
              leadTime: 5,
              status: 'active'
            }
          ]
        }
      ];

      await Inventory.insertMany(inventoryItems);
      return { success: true, message: 'Inventory seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed inventory: ${error.message}`);
    }
  }

  // Seed devices
  static async seedDevices() {
    try {
      const existingDevices = await Device.countDocuments();
      if (existingDevices > 0) {
        return { success: true, message: 'Devices already exist' };
      }

      const devices = [
        {
          brand: 'Apple',
          name: 'iPhone',
          models: [
            { name: 'iPhone 14 Pro Max', releaseYear: 2022, isActive: true },
            { name: 'iPhone 14 Pro', releaseYear: 2022, isActive: true },
            { name: 'iPhone 14', releaseYear: 2022, isActive: true },
            { name: 'iPhone 13 Pro Max', releaseYear: 2021, isActive: true },
            { name: 'iPhone 13 Pro', releaseYear: 2021, isActive: true },
            { name: 'iPhone 13', releaseYear: 2021, isActive: true },
            { name: 'iPhone 12 Pro Max', releaseYear: 2020, isActive: true },
            { name: 'iPhone 12 Pro', releaseYear: 2020, isActive: true },
            { name: 'iPhone 12', releaseYear: 2020, isActive: true }
          ]
        },
        {
          brand: 'Samsung',
          name: 'Galaxy',
          models: [
            { name: 'Galaxy S23 Ultra', releaseYear: 2023, isActive: true },
            { name: 'Galaxy S23+', releaseYear: 2023, isActive: true },
            { name: 'Galaxy S23', releaseYear: 2023, isActive: true },
            { name: 'Galaxy S22 Ultra', releaseYear: 2022, isActive: true },
            { name: 'Galaxy S22+', releaseYear: 2022, isActive: true },
            { name: 'Galaxy S22', releaseYear: 2022, isActive: true },
            { name: 'Galaxy Note 20 Ultra', releaseYear: 2020, isActive: true }
          ]
        },
        {
          brand: 'Google',
          name: 'Pixel',
          models: [
            { name: 'Pixel 7 Pro', releaseYear: 2022, isActive: true },
            { name: 'Pixel 7', releaseYear: 2022, isActive: true },
            { name: 'Pixel 6 Pro', releaseYear: 2021, isActive: true },
            { name: 'Pixel 6', releaseYear: 2021, isActive: true }
          ]
        }
      ];

      await Device.insertMany(devices);
      return { success: true, message: 'Devices seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed devices: ${error.message}`);
    }
  }

  // Seed products
  static async seedProducts() {
    try {
      const existingProducts = await Product.countDocuments();
      if (existingProducts > 0) {
        return { success: true, message: 'Products already exist' };
      }

      const products = [
        {
          name: 'Premium Screen Protector',
          description: 'Tempered glass screen protector with 9H hardness',
          price: 24.99,
          category: 'Accessories',
          brand: 'TechGuard',
          images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=Screen+Protector'],
          specifications: {
            material: 'Tempered Glass',
            thickness: '0.33mm',
            hardness: '9H'
          },
          compatibility: ['iPhone', 'Samsung Galaxy'],
          inStock: true,
          stockQuantity: 150,
          isActive: true
        },
        {
          name: 'Wireless Charging Pad',
          description: 'Fast wireless charging pad compatible with all Qi devices',
          price: 39.99,
          category: 'Chargers',
          brand: 'PowerTech',
          images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Wireless+Charger'],
          specifications: {
            power: '15W',
            compatibility: 'Qi-enabled devices',
            cable: 'USB-C included'
          },
          compatibility: ['iPhone', 'Samsung Galaxy', 'Google Pixel'],
          inStock: true,
          stockQuantity: 75,
          isActive: true
        },
        {
          name: 'Phone Repair Tool Kit',
          description: 'Professional repair tool kit with precision screwdrivers',
          price: 29.99,
          category: 'Tools',
          brand: 'RepairPro',
          images: ['https://via.placeholder.com/300x300/8b5cf6/ffffff?text=Tool+Kit'],
          specifications: {
            pieces: '32 pieces',
            case: 'Magnetic case included',
            warranty: '1 year'
          },
          compatibility: ['All devices'],
          inStock: true,
          stockQuantity: 50,
          isActive: true
        }
      ];

      await Product.insertMany(products);
      return { success: true, message: 'Products seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed products: ${error.message}`);
    }
  }

  // Seed blog data
  static async seedBlogData() {
    try {
      const existingPosts = await BlogPost.countDocuments();
      if (existingPosts > 0) {
        return { success: true, message: 'Blog data already exists' };
      }

      // Create categories
      const categories = await BlogCategory.insertMany([
        { name: 'Repair Tips', slug: 'repair-tips', description: 'Tips and tricks for device repairs' },
        { name: 'Device Care', slug: 'device-care', description: 'How to take care of your devices' },
        { name: 'News', slug: 'news', description: 'Latest news in tech repair industry' }
      ]);

      // Create tags
      const tags = await BlogTag.insertMany([
        { name: 'iPhone', slug: 'iphone' },
        { name: 'Android', slug: 'android' },
        { name: 'Screen Repair', slug: 'screen-repair' },
        { name: 'Battery', slug: 'battery' },
        { name: 'Water Damage', slug: 'water-damage' }
      ]);

      // Get admin user for author
      const admin = await User.findOne({ role: 'admin' });

      // Create blog posts
      const blogPosts = [
        {
          title: 'How to Prevent Water Damage to Your Phone',
          slug: 'prevent-water-damage-phone',
          excerpt: 'Learn essential tips to protect your smartphone from water damage and what to do if it gets wet.',
          content: 'Water damage is one of the most common causes of smartphone failure. Here are essential tips to protect your device...',
          featuredImage: 'https://via.placeholder.com/600x400/3b82f6/ffffff?text=Water+Damage+Prevention',
          category: categories[1]._id,
          tags: [tags[4]._id],
          author: admin._id,
          status: 'published',
          publishedAt: new Date(),
          readTime: 5,
          views: 1250,
          likes: 89,
          isFeatured: true
        },
        {
          title: 'Signs Your Phone Battery Needs Replacement',
          slug: 'phone-battery-replacement-signs',
          excerpt: 'Discover the warning signs that indicate your phone battery is failing and needs professional replacement.',
          content: 'Phone batteries degrade over time, but knowing when to replace them can save you from unexpected shutdowns...',
          featuredImage: 'https://via.placeholder.com/600x400/10b981/ffffff?text=Battery+Replacement',
          category: categories[0]._id,
          tags: [tags[3]._id],
          author: admin._id,
          status: 'published',
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          readTime: 4,
          views: 980,
          likes: 67,
          isFeatured: true
        },
        {
          title: 'Professional Screen Repair vs DIY: Making the Right Choice',
          slug: 'professional-vs-diy-screen-repair',
          excerpt: 'Compare the pros and cons of professional screen repair versus DIY solutions to make an informed decision.',
          content: 'When your phone screen cracks, you face a choice: attempt a DIY repair or seek professional help...',
          featuredImage: 'https://via.placeholder.com/600x400/8b5cf6/ffffff?text=Screen+Repair',
          category: categories[0]._id,
          tags: [tags[2]._id],
          author: admin._id,
          status: 'published',
          publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          readTime: 6,
          views: 756,
          likes: 45,
          isFeatured: false
        }
      ];

      await BlogPost.insertMany(blogPosts);
      return { success: true, message: 'Blog data seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed blog data: ${error.message}`);
    }
  }

  // Seed FAQ data
  static async seedFAQData() {
    try {
      const existingFAQs = await FAQ.countDocuments();
      if (existingFAQs > 0) {
        return { success: true, message: 'FAQ data already exists' };
      }

      const faqs = [
        {
          question: 'How long does a typical phone repair take?',
          answer: 'Most common repairs like screen replacement or battery replacement take 1-3 hours. More complex issues like water damage can take 1-2 days.',
          category: 'General',
          isActive: true,
          helpfulCount: 45
        },
        {
          question: 'Do you provide warranty on repairs?',
          answer: 'Yes, we provide a 90-day warranty on all repairs. This covers any issues related to the repair work performed.',
          category: 'Warranty',
          isActive: true,
          helpfulCount: 38
        },
        {
          question: 'What should I do if my phone gets water damage?',
          answer: 'Turn off your device immediately, do not charge it, and bring it to us as soon as possible. The faster we can assess the damage, the better the chances of recovery.',
          category: 'Emergency',
          isActive: true,
          helpfulCount: 52
        },
        {
          question: 'Do I need to backup my data before repair?',
          answer: 'We recommend backing up your data before any repair. While we take care to preserve your data, repairs can sometimes result in data loss.',
          category: 'Data',
          isActive: true,
          helpfulCount: 29
        }
      ];

      await FAQ.insertMany(faqs);
      return { success: true, message: 'FAQ data seeded successfully' };
    } catch (error) {
      throw new Error(`Failed to seed FAQ data: ${error.message}`);
    }
  }

  // Seed homepage template
  static async seedHomepageTemplate() {
    try {
      const existingTemplate = await LayoutTemplate.findOne({ isDefault: true });
      if (existingTemplate) {
        return { success: true, message: 'Default homepage template already exists' };
      }

      const admin = await User.findOne({ role: 'admin' });
      if (!admin) {
        throw new Error('Admin user not found. Please seed admin user first.');
      }

      const defaultTemplate = new LayoutTemplate({
        name: 'Default Homepage Template',
        description: 'Default homepage layout with hero, services, testimonials, and CTA sections',
        sections: [
          {
            name: 'Hero Section',
            blocks: [
              {
                type: 'hero',
                title: 'Hero Banner',
                content: {
                  heading: 'Fix Your Device Like New Again',
                  subheading: 'Fast, reliable, and affordable repair services for all your devices. Expert technicians, quality parts, and warranty included.',
                  ctaText: 'Start Repair Order',
                  ctaLink: '/register',
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
              }
            ],
            layout: 'single',
            order: 0,
            isActive: true
          },
          {
            name: 'Services Section',
            blocks: [
              {
                type: 'services',
                title: 'Our Services',
                content: {
                  heading: 'Expert Repair Services',
                  description: 'Professional repair services for all major device brands with quality parts and expert technicians',
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
              }
            ],
            layout: 'single',
            order: 1,
            isActive: true
          },
          {
            name: 'Testimonials Section',
            blocks: [
              {
                type: 'testimonials',
                title: 'Customer Testimonials',
                content: {
                  heading: 'What Our Customers Say',
                  testimonials: [
                    {
                      name: 'Sarah Johnson',
                      role: 'Business Owner',
                      avatar: 'https://via.placeholder.com/60x60/3b82f6/ffffff?text=SJ',
                      rating: 5,
                      review: 'Incredible service! My iPhone was fixed in just 2 hours and works perfectly. The staff was professional and the price was very reasonable.'
                    },
                    {
                      name: 'Mike Chen',
                      role: 'Student',
                      avatar: 'https://via.placeholder.com/60x60/10b981/ffffff?text=MC',
                      rating: 5,
                      review: 'Best repair shop in town! They fixed my laptop screen and it looks brand new. Fast service and great warranty coverage.'
                    },
                    {
                      name: 'Emily Davis',
                      role: 'Teacher',
                      avatar: 'https://via.placeholder.com/60x60/8b5cf6/ffffff?text=ED',
                      rating: 5,
                      review: 'Amazing experience from start to finish. Online booking was easy, updates were frequent, and my device was ready ahead of schedule.'
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
              }
            ],
            layout: 'single',
            order: 2,
            isActive: true
          },
          {
            name: 'Call to Action Section',
            blocks: [
              {
                type: 'cta',
                title: 'Call to Action',
                content: {
                  heading: 'Ready to Fix Your Device?',
                  description: 'Join thousands of satisfied customers who trust us with their device repairs. Get started today with our free diagnostic service.',
                  ctaText: 'Start Your Repair',
                  ctaLink: '/register'
                },
                settings: {
                  backgroundColor: '#10b981',
                  textColor: '#ffffff',
                  padding: '60px 0',
                  alignment: 'center'
                },
                order: 0,
                isVisible: true
              }
            ],
            layout: 'single',
            order: 3,
            isActive: true
          }
        ],
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
        isDefault: true,
        createdBy: admin._id
      });

      await defaultTemplate.save();
      return { success: true, message: 'Default homepage template created successfully' };
    } catch (error) {
      throw new Error(`Failed to seed homepage template: ${error.message}`);
    }
  }
}

module.exports = SeedService;