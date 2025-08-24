const UserService = require('./userService.js');
const ServiceService = require('./serviceService.js');

class SeedService {
  static async seedAdmin() {
    try {
      console.log('SeedService.seedAdmin: Starting admin user seeding...');

      // Check if admin user already exists
      console.log('SeedService.seedAdmin: Checking if admin user already exists...');
      const existingAdmin = await UserService.getByEmail('admin@example.com');
      if (existingAdmin) {
        console.log('SeedService.seedAdmin: Admin user already exists, skipping creation');
        console.log('SeedService.seedAdmin: Existing admin user details:', {
          id: existingAdmin._id,
          email: existingAdmin.email,
          role: existingAdmin.role,
          name: existingAdmin.name
        });
        return { success: true, message: 'Admin user already exists', user: existingAdmin };
      }

      console.log('SeedService.seedAdmin: No existing admin user found, creating new one...');

      // Create admin user
      const adminData = {
        email: 'admin@example.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1 (555) 000-0000',
        role: 'admin'
      };

      console.log('SeedService.seedAdmin: Creating admin user with data:', {
        email: adminData.email,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: adminData.role,
        phone: adminData.phone
      });

      const adminUser = await UserService.create(adminData);
      console.log('SeedService.seedAdmin: Admin user created successfully with ID:', adminUser._id);
      console.log('SeedService.seedAdmin: Created admin user details:', {
        id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
        name: adminUser.name
      });

      return {
        success: true,
        message: 'Admin user created successfully',
        user: adminUser
      };
    } catch (err) {
      console.error('SeedService.seedAdmin: Error seeding admin user:', err);
      console.error('SeedService.seedAdmin: Error stack:', err.stack);
      throw new Error(`Error seeding admin user: ${err.message}`);
    }
  }

  static async seedServices() {
    try {
      console.log('SeedService: Starting repair services seeding...');

      const sampleServices = [
        {
          name: 'Screen Replacement',
          description: 'Complete screen and digitizer replacement with high-quality parts. Includes cleaning and quality testing. Warranty included.',
          price: 199,
          estimatedTime: '2-3 hours',
          category: 'Display',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel', 'OnePlus'],
          popularity: 95
        },
        {
          name: 'Battery Replacement',
          description: 'High-quality battery replacement with genuine or OEM equivalent parts. Includes battery health optimization and 1-year warranty.',
          price: 89,
          estimatedTime: '1-2 hours',
          category: 'Power',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel', 'OnePlus', 'Huawei'],
          popularity: 88
        },
        {
          name: 'Camera Repair',
          description: 'Professional camera module replacement and calibration. Includes front and rear camera testing and focus adjustment.',
          price: 149,
          estimatedTime: '2-4 hours',
          category: 'Camera',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
          popularity: 72
        },
        {
          name: 'Water Damage Repair',
          description: 'Comprehensive water damage assessment and repair service. Includes component cleaning, corrosion removal, and functionality testing.',
          price: 299,
          estimatedTime: '1-3 days',
          category: 'Emergency',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel', 'OnePlus'],
          popularity: 65
        },
        {
          name: 'Charging Port Repair',
          description: 'Charging port cleaning and replacement service. Fixes charging issues and loose connections.',
          price: 79,
          estimatedTime: '1-2 hours',
          category: 'Hardware',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel', 'OnePlus'],
          popularity: 78
        },
        {
          name: 'Speaker Repair',
          description: 'Speaker and microphone repair service. Includes earpiece, loudspeaker, and microphone replacement.',
          price: 99,
          estimatedTime: '1-3 hours',
          category: 'Hardware',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
          popularity: 55
        },
        {
          name: 'Software Troubleshooting',
          description: 'Comprehensive software diagnosis and repair. Includes OS reinstallation, app issues, and performance optimization.',
          price: 59,
          estimatedTime: '1-2 hours',
          category: 'Software',
          deviceTypes: ['iPhone', 'Samsung', 'Google Pixel', 'OnePlus', 'Huawei'],
          popularity: 42
        },
        {
          name: 'Home Button Repair',
          description: 'Home button and fingerprint sensor repair service. Includes button replacement and Touch ID calibration.',
          price: 119,
          estimatedTime: '2-3 hours',
          category: 'Hardware',
          deviceTypes: ['iPhone', 'Samsung'],
          popularity: 38
        }
      ];

      const createdServices = [];
      let skippedCount = 0;

      for (const serviceData of sampleServices) {
        try {
          // Check if service already exists
          const existingServices = await ServiceService.list();
          const exists = existingServices.some(service => service.name === serviceData.name);

          if (exists) {
            console.log(`SeedService: Service "${serviceData.name}" already exists, skipping`);
            skippedCount++;
            continue;
          }

          const service = await ServiceService.create(serviceData);
          createdServices.push(service);
          console.log(`SeedService: Created service "${service.name}" with ID: ${service._id}`);
        } catch (err) {
          console.error(`SeedService: Error creating service "${serviceData.name}":`, err);
        }
      }

      console.log(`SeedService: Services seeding completed. Created: ${createdServices.length}, Skipped: ${skippedCount}`);

      return {
        success: true,
        message: `Services seeded successfully. Created: ${createdServices.length}, Skipped: ${skippedCount}`,
        createdServices,
        createdCount: createdServices.length,
        skippedCount
      };
    } catch (err) {
      console.error('SeedService: Error seeding services:', err);
      throw new Error(`Error seeding services: ${err.message}`);
    }
  }
}

module.exports = SeedService;