const User = require('../models/User');
const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');
const Inventory = require('../models/Inventory');
const { hashPassword } = require('../utils/password');

class SeedService {
  static async seedAdmin() {
    console.log('SeedService: Starting admin user seeding...');

    try {
      // Check if admin already exists
      const existingAdmin = await User.findOne({ email: 'admin@fixithub.com' });

      if (existingAdmin) {
        console.log('SeedService: Admin user already exists');
        return { success: true, message: 'Admin user already exists' };
      }

      // Create admin user
      const adminData = {
        email: 'admin@fixithub.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        phone: '+1-555-0100',
        isActive: true
      };

      const admin = await User.create(adminData);
      console.log('SeedService: Admin user created successfully with ID:', admin._id);

      return { success: true, message: 'Admin user created successfully', userId: admin._id };
    } catch (error) {
      console.error('SeedService: Error seeding admin user:', error);
      throw new Error(`Failed to seed admin user: ${error.message}`);
    }
  }

  static async seedServices() {
    console.log('SeedService: Starting services seeding...');

    try {
      const existingServices = await Service.countDocuments();

      if (existingServices > 0) {
        console.log('SeedService: Services already exist');
        return { success: true, message: 'Services already exist' };
      }

      const services = [
        {
          name: 'Screen Replacement',
          description: 'Professional screen replacement service for all device types',
          basePrice: 150,
          estimatedTime: '2-3 hours',
          category: 'Display',
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Battery Replacement',
          description: 'High-quality battery replacement with warranty',
          basePrice: 80,
          estimatedTime: '1-2 hours',
          category: 'Power',
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Camera Repair',
          description: 'Camera module repair and replacement',
          basePrice: 120,
          estimatedTime: '2-4 hours',
          category: 'Camera',
          isActive: true,
          knowledgeBaseArticles: []
        },
        {
          name: 'Charging Port Repair',
          description: 'Charging port cleaning and replacement',
          basePrice: 90,
          estimatedTime: '1-3 hours',
          category: 'Connectivity',
          isActive: true,
          knowledgeBaseArticles: []
        }
      ];

      const createdServices = await Service.insertMany(services);
      console.log('SeedService: Created', createdServices.length, 'services');

      return { success: true, message: `${createdServices.length} services created successfully` };
    } catch (error) {
      console.error('SeedService: Error seeding services:', error);
      throw new Error(`Failed to seed services: ${error.message}`);
    }
  }

  static async seedAddOnServices() {
    console.log('SeedService: Starting add-on services seeding...');

    try {
      const existingAddOns = await AddOnService.countDocuments();

      if (existingAddOns > 0) {
        console.log('SeedService: Add-on services already exist');
        return { success: true, message: 'Add-on services already exist' };
      }

      const addOnServices = [
        {
          name: 'Screen Protector Installation',
          description: 'Premium tempered glass screen protector installation',
          price: 25,
          category: 'Protection',
          estimatedTime: '15 minutes',
          isActive: true
        },
        {
          name: 'Device Cleaning',
          description: 'Complete device cleaning and sanitization',
          price: 15,
          category: 'Maintenance',
          estimatedTime: '30 minutes',
          isActive: true
        },
        {
          name: 'Data Backup',
          description: 'Complete data backup before repair',
          price: 35,
          category: 'Data',
          estimatedTime: '45 minutes',
          isActive: true
        },
        {
          name: 'Express Service',
          description: 'Priority repair service - same day completion',
          price: 50,
          category: 'Service',
          estimatedTime: 'Same day',
          isActive: true
        }
      ];

      const createdAddOns = await AddOnService.insertMany(addOnServices);
      console.log('SeedService: Created', createdAddOns.length, 'add-on services');

      return { success: true, message: `${createdAddOns.length} add-on services created successfully` };
    } catch (error) {
      console.error('SeedService: Error seeding add-on services:', error);
      throw new Error(`Failed to seed add-on services: ${error.message}`);
    }
  }

  static async seedInventory() {
    console.log('SeedService: Starting inventory seeding...');

    try {
      const existingInventory = await Inventory.countDocuments();

      if (existingInventory > 0) {
        console.log('SeedService: Inventory items already exist');
        return { success: true, message: 'Inventory items already exist' };
      }

      const inventoryItems = [
        {
          itemName: 'iPhone 15 Pro OLED Display',
          itemDescription: 'Original quality OLED display assembly with digitizer for iPhone 15 Pro',
          category: 'display',
          sku: 'DIS-0001',
          barcode: '123456789001',
          manufacturer: 'Apple',
          brand: 'Apple',
          compatibleDevices: ['iPhone 15 Pro'],
          versions: [
            {
              versionType: 'original',
              versionId: 'DIS-0001-V1',
              quantity: 15,
              minStockLevel: 5,
              reorderLevel: 10,
              quantityOnOrder: 0,
              unitCost: 180,
              sellingPrice: 250,
              discounts: 0,
              storageLocation: 'A1-B2',
              supplierInfo: {
                name: 'TechParts Inc',
                contactPerson: 'John Smith',
                email: 'orders@techparts.com',
                phone: '+1-555-0123',
                address: '123 Tech Street, Silicon Valley, CA'
              },
              leadTime: 3,
              status: 'active',
              lowStockAlert: false,
              notes: 'High-quality original replacement',
              images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=iPhone+Display']
            },
            {
              versionType: 'efficient',
              versionId: 'DIS-0001-V2',
              quantity: 25,
              minStockLevel: 10,
              reorderLevel: 15,
              quantityOnOrder: 0,
              unitCost: 120,
              sellingPrice: 180,
              discounts: 0,
              storageLocation: 'A1-B3',
              supplierInfo: {
                name: 'Quality Parts Co',
                contactPerson: 'Jane Doe',
                email: 'sales@qualityparts.com',
                phone: '+1-555-0124',
                address: '456 Parts Avenue, Tech City, CA'
              },
              leadTime: 5,
              status: 'active',
              lowStockAlert: false,
              notes: 'Good quality alternative',
              images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Efficient+Display']
            }
          ],
          specifications: new Map([
            ['Screen Size', '6.1 inches'],
            ['Resolution', '2556x1179'],
            ['Technology', 'OLED']
          ])
        },
        {
          itemName: 'Samsung Galaxy S24 Battery',
          itemDescription: 'High capacity lithium-ion battery for Samsung Galaxy S24 series',
          category: 'battery',
          sku: 'BAT-0001',
          barcode: '123456789002',
          manufacturer: 'Samsung',
          brand: 'Samsung',
          compatibleDevices: ['Galaxy S24', 'Galaxy S24+'],
          versions: [
            {
              versionType: 'original',
              versionId: 'BAT-0001-V1',
              quantity: 3,
              minStockLevel: 10,
              reorderLevel: 15,
              quantityOnOrder: 20,
              unitCost: 45,
              sellingPrice: 75,
              discounts: 0,
              storageLocation: 'B2-C1',
              supplierInfo: {
                name: 'PowerCell Solutions',
                contactPerson: 'Mike Johnson',
                email: 'orders@powercell.com',
                phone: '+1-555-0125',
                address: '789 Battery Lane, Power City, TX'
              },
              leadTime: 7,
              status: 'active',
              lowStockAlert: true,
              notes: 'Original Samsung battery',
              images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Samsung+Battery']
            }
          ],
          specifications: new Map([
            ['Capacity', '4000mAh'],
            ['Voltage', '3.85V'],
            ['Type', 'Li-ion']
          ])
        },
        {
          itemName: 'Universal Repair Tool Kit',
          itemDescription: 'Professional repair tool kit with screwdrivers, spudgers, and opening tools',
          category: 'tool',
          sku: 'TOL-0001',
          barcode: '123456789003',
          manufacturer: 'RepairPro',
          brand: 'RepairPro',
          compatibleDevices: ['Universal'],
          versions: [
            {
              versionType: 'efficient',
              versionId: 'TOL-0001-V1',
              quantity: 12,
              minStockLevel: 3,
              reorderLevel: 5,
              quantityOnOrder: 0,
              unitCost: 25,
              sellingPrice: 45,
              discounts: 10,
              storageLocation: 'C1-D1',
              supplierInfo: {
                name: 'Tool Masters',
                contactPerson: 'Sarah Wilson',
                email: 'sales@toolmasters.com',
                phone: '+1-555-0126',
                address: '321 Tool Street, Repair Town, NY'
              },
              leadTime: 2,
              status: 'active',
              lowStockAlert: false,
              notes: 'Complete professional tool set',
              images: ['https://via.placeholder.com/300x300/f59e0b/ffffff?text=Tool+Kit']
            }
          ],
          specifications: new Map([
            ['Pieces', '32'],
            ['Material', 'Hardened Steel'],
            ['Case', 'Magnetic Storage']
          ])
        }
      ];

      const createdInventory = await Inventory.insertMany(inventoryItems);
      console.log('SeedService: Created', createdInventory.length, 'inventory items');

      return { success: true, message: `${createdInventory.length} inventory items created successfully` };
    } catch (error) {
      console.error('SeedService: Error seeding inventory:', error);
      throw new Error(`Failed to seed inventory: ${error.message}`);
    }
  }
}

module.exports = SeedService;