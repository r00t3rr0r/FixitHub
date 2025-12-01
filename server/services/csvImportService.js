const User = require('../models/User');
const { generatePasswordHash } = require('../utils/password');

class CSVImportService {
  /**
   * Validates that all required fields are present in the column mapping
   */
  static validateColumnMapping(columnMapping) {
    const requiredFields = ['email', 'name'];
    const mappedFields = Object.values(columnMapping).filter(f => f !== null && f !== '');

    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        throw new Error(`Missing required field mapping: ${field}`);
      }
    }

    return true;
  }

  /**
   * Validates individual user data
   */
  static validateUserData(user) {
    const errors = [];

    // Email validation
    if (!user.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(user.email)) {
      errors.push(`Invalid email format: ${user.email}`);
    }

    // Name validation
    if (!user.name || user.name.trim() === '') {
      errors.push('Name is required');
    }

    // Role validation (if provided)
    if (user.role && !['customer', 'staff', 'admin'].includes(user.role)) {
      errors.push(`Invalid role: ${user.role}. Must be customer, staff, or admin`);
    }

    // Status validation (if provided)
    if (user.isActive !== undefined && typeof user.isActive !== 'boolean') {
      errors.push(`Invalid status value: ${user.isActive}. Must be true or false`);
    }

    // Customer status field validation (if provided)
    if (user.status && !['active', 'inactive', 'suspended', 'blocked'].includes(user.status)) {
      errors.push(`Invalid status: ${user.status}. Must be active, inactive, suspended, or blocked`);
    }

    // Salutation validation (if provided)
    if (user.salutation && !['', 'Mr', 'Ms', 'Mrs', 'Dr', 'Prof'].includes(user.salutation)) {
      errors.push(`Invalid salutation: ${user.salutation}. Must be Mr, Ms, Mrs, Dr, or Prof`);
    }

    // Discount validation (if provided)
    if (user.discount !== undefined) {
      const discount = parseFloat(user.discount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        errors.push(`Invalid discount: ${user.discount}. Must be a number between 0 and 100`);
      }
    }

    // Newsletter validation (if provided)
    if (user.newsletter !== undefined && typeof user.newsletter !== 'boolean') {
      errors.push(`Invalid newsletter value: ${user.newsletter}. Must be true or false`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if email is valid
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Checks for duplicate emails in the data and database
   */
  static async checkDuplicates(users) {
    const duplicates = [];
    const emailMap = new Map();

    // Check for duplicates within the CSV data
    for (const user of users) {
      const lowerEmail = user.email.toLowerCase();
      if (emailMap.has(lowerEmail)) {
        duplicates.push({
          email: user.email,
          type: 'duplicate_in_csv',
          message: `Duplicate email found in CSV: ${user.email}`
        });
      } else {
        emailMap.set(lowerEmail, true);
      }
    }

    // Check for duplicates in the database
    const existingEmails = await User.find(
      { email: { $in: Array.from(emailMap.keys()) } },
      { email: 1 }
    );

    const existingEmailSet = new Set(existingEmails.map(u => u.email.toLowerCase()));

    for (const user of users) {
      if (existingEmailSet.has(user.email.toLowerCase())) {
        duplicates.push({
          email: user.email,
          type: 'duplicate_in_database',
          message: `User with email already exists: ${user.email}`
        });
      }
    }

    return duplicates;
  }

  /**
   * Cleans and standardizes user data
   */
  static cleanUserData(rawData, columnMapping) {
    console.log('CSVImportService: Starting data cleaning and standardization');

    const cleanedData = [];

    for (const row of rawData) {
      const cleanedUser = {
        email: '',
        name: '',
        phone: row[columnMapping.phone] || '',
        role: 'customer',
        isActive: true,
        password: this.generateRandomPassword()
      };

      // Map required CSV columns to user fields
      if (columnMapping.email) {
        cleanedUser.email = (row[columnMapping.email] || '').trim().toLowerCase();
      }

      if (columnMapping.name) {
        cleanedUser.name = (row[columnMapping.name] || '').trim();
      }

      if (columnMapping.phone) {
        cleanedUser.phone = (row[columnMapping.phone] || '').trim();
      }

      if (columnMapping.role) {
        const role = (row[columnMapping.role] || '').trim().toLowerCase();
        if (['customer', 'staff', 'admin'].includes(role)) {
          cleanedUser.role = role;
        }
      }

      if (columnMapping.company) {
        cleanedUser.company = (row[columnMapping.company] || '').trim();
      }

      if (columnMapping.country) {
        cleanedUser.country = (row[columnMapping.country] || '').trim();
      }

      // Parse isActive status
      if (columnMapping.isActive) {
        const statusValue = (row[columnMapping.isActive] || '').trim().toLowerCase();
        cleanedUser.isActive = !['false', '0', 'inactive', 'disabled'].includes(statusValue);
      }

      // Map optional customer information fields
      if (columnMapping.customerNumber) {
        cleanedUser.customerNumber = (row[columnMapping.customerNumber] || '').trim();
      }

      if (columnMapping.customerGroup) {
        cleanedUser.customerGroup = (row[columnMapping.customerGroup] || '').trim();
      }

      if (columnMapping.salutation) {
        const salutationValue = (row[columnMapping.salutation] || '').trim();
        const validSalutations = ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof', ''];
        if (salutationValue && validSalutations.includes(salutationValue)) {
          cleanedUser.salutation = salutationValue;
        }
      }

      if (columnMapping.title) {
        cleanedUser.title = (row[columnMapping.title] || '').trim();
      }

      if (columnMapping.addressAddition) {
        cleanedUser.addressAddition = (row[columnMapping.addressAddition] || '').trim();
      }

      if (columnMapping.customerOrigin) {
        cleanedUser.customerOrigin = (row[columnMapping.customerOrigin] || '').trim();
      }

      if (columnMapping.postId) {
        cleanedUser.postId = (row[columnMapping.postId] || '').trim();
      }

      if (columnMapping.paymentMethod) {
        cleanedUser.paymentMethod = (row[columnMapping.paymentMethod] || '').trim();
      }

      if (columnMapping.paymentTerms) {
        cleanedUser.paymentTerms = (row[columnMapping.paymentTerms] || '').trim();
      }

      if (columnMapping.internalKey) {
        cleanedUser.internalKey = (row[columnMapping.internalKey] || '').trim();
      }

      // Parse discount (numeric value, 0-100)
      if (columnMapping.discount) {
        const discountValue = parseFloat((row[columnMapping.discount] || '0').trim());
        if (!isNaN(discountValue) && discountValue >= 0 && discountValue <= 100) {
          cleanedUser.discount = discountValue;
        }
      }

      // Parse status field
      if (columnMapping.status) {
        const statusValue = (row[columnMapping.status] || 'active').trim().toLowerCase();
        const validStatuses = ['active', 'inactive', 'suspended', 'blocked'];
        if (validStatuses.includes(statusValue)) {
          cleanedUser.status = statusValue;
        } else {
          cleanedUser.status = 'active';
        }
      }

      // Parse newsletter subscription (boolean)
      if (columnMapping.newsletter) {
        const newsletterValue = (row[columnMapping.newsletter] || 'false').trim().toLowerCase();
        cleanedUser.newsletter = !['false', '0', 'no'].includes(newsletterValue);
      }

      if (columnMapping.comment) {
        cleanedUser.comment = (row[columnMapping.comment] || '').trim();
      }

      cleanedData.push(cleanedUser);
    }

    console.log(`CSVImportService: Cleaned ${cleanedData.length} user records`);
    return cleanedData;
  }

  /**
   * Removes duplicate entries from user data
   */
  static removeDuplicates(users) {
    const seen = new Set();
    const unique = [];

    for (const user of users) {
      const key = user.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(user);
      }
    }

    console.log(`CSVImportService: Removed ${users.length - unique.length} duplicates`);
    return unique;
  }

  /**
   * Generates a random password for imported users
   */
  static generateRandomPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Escapes CSV field values
   */
  static escapeCSVField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    const fieldStr = String(field);
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
      return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    return fieldStr;
  }

  /**
   * Converts user objects to CSV format
   */
  static convertUsersToCSV(users) {
    console.log(`CSVImportService: Converting ${users.length} users to CSV format`);

    // Define CSV headers - all available fields
    const headers = [
      'Email',
      'Name',
      'Phone',
      'Role',
      'Active',
      'Customer Number',
      'Customer Group',
      'Salutation',
      'Title',
      'Company',
      'Country',
      'Address Addition',
      'Customer Origin',
      'Post ID',
      'Payment Method',
      'Payment Terms',
      'Internal Key',
      'Discount',
      'Status',
      'Newsletter',
      'Comment',
      'Created At',
      'Last Login At'
    ];

    // Create CSV header row
    const csvLines = [headers.map(h => this.escapeCSVField(h)).join(',')];

    // Add data rows
    for (const user of users) {
      const row = [
        this.escapeCSVField(user.email),
        this.escapeCSVField(user.name),
        this.escapeCSVField(user.phone || ''),
        this.escapeCSVField(user.role || 'customer'),
        this.escapeCSVField(user.isActive ? 'true' : 'false'),
        this.escapeCSVField(user.customerNumber || ''),
        this.escapeCSVField(user.customerGroup || ''),
        this.escapeCSVField(user.salutation || ''),
        this.escapeCSVField(user.title || ''),
        this.escapeCSVField(user.company || ''),
        this.escapeCSVField(user.country || ''),
        this.escapeCSVField(user.addressAddition || ''),
        this.escapeCSVField(user.customerOrigin || ''),
        this.escapeCSVField(user.postId || ''),
        this.escapeCSVField(user.paymentMethod || ''),
        this.escapeCSVField(user.paymentTerms || ''),
        this.escapeCSVField(user.internalKey || ''),
        this.escapeCSVField(user.discount || 0),
        this.escapeCSVField(user.status || 'active'),
        this.escapeCSVField(user.newsletter ? 'true' : 'false'),
        this.escapeCSVField(user.comment || ''),
        this.escapeCSVField(user.createdAt ? new Date(user.createdAt).toISOString() : ''),
        this.escapeCSVField(user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : '')
      ];

      csvLines.push(row.map(f => this.escapeCSVField(f)).join(','));
    }

    const csvContent = csvLines.join('\n');
    console.log(`CSVImportService: CSV conversion complete, ${csvLines.length} rows including header`);

    return csvContent;
  }

  /**
   * Processes CSV import with validation and duplicate checking
   */
  static async processCSVImport(parsedData, columnMapping, options = {}) {
    console.log('CSVImportService: Starting CSV import process');

    try {
      // Step 1: Validate column mapping
      this.validateColumnMapping(columnMapping);
      console.log('CSVImportService: Column mapping validated');

      // Step 2: Clean and standardize data
      const cleanedData = this.cleanUserData(parsedData, columnMapping);

      // Step 3: Remove duplicates from CSV
      const uniqueData = this.removeDuplicates(cleanedData);

      // Step 4: Check for duplicates with database
      const duplicates = await this.checkDuplicates(uniqueData);
      console.log(`CSVImportService: Found ${duplicates.length} duplicate entries`);

      // Step 5: Filter out duplicates if skipDuplicates option is true
      let dataToImport = uniqueData;
      if (options.skipDuplicates) {
        const duplicateEmails = new Set(duplicates.map(d => d.email.toLowerCase()));
        dataToImport = uniqueData.filter(u => !duplicateEmails.has(u.email.toLowerCase()));
        console.log(`CSVImportService: Skipped ${duplicates.length} duplicates, importing ${dataToImport.length} records`);
      } else if (duplicates.length > 0) {
        console.log(`CSVImportService: Import blocked - duplicates found`);
        return {
          success: false,
          duplicates,
          message: `Found ${duplicates.length} duplicate email(s). Please resolve duplicates or enable "Skip Duplicates" option.`
        };
      }

      // Step 6: Validate each user record
      const validationResults = [];
      for (const user of dataToImport) {
        const validation = this.validateUserData(user);
        if (!validation.isValid) {
          validationResults.push({
            email: user.email,
            errors: validation.errors
          });
        }
      }

      if (validationResults.length > 0) {
        console.log(`CSVImportService: Validation failed for ${validationResults.length} records`);
        return {
          success: false,
          validationErrors: validationResults,
          message: `Validation failed for ${validationResults.length} record(s).`
        };
      }

      console.log(`CSVImportService: All validations passed, ready to import ${dataToImport.length} users`);

      return {
        success: true,
        data: dataToImport,
        summary: {
          totalRows: parsedData.length,
          validRows: dataToImport.length,
          duplicateRows: duplicates.length,
          skippedRows: uniqueData.length - dataToImport.length
        }
      };
    } catch (error) {
      console.error(`CSVImportService: Error processing CSV import: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Imports validated users into the database
   */
  static async importUsers(users) {
    console.log(`CSVImportService: Starting import of ${users.length} users into database`);

    const results = {
      successful: [],
      failed: []
    };

    for (const userData of users) {
      try {
        // Hash password before saving
        const hashedPassword = await generatePasswordHash(userData.password);

        const newUser = new User({
          // Required fields
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          // Basic information
          phone: userData.phone,
          role: userData.role,
          isActive: userData.isActive,
          // Company information
          company: userData.company,
          country: userData.country,
          // Customer-specific fields
          customerNumber: userData.customerNumber || '',
          customerGroup: userData.customerGroup || '',
          salutation: userData.salutation || '',
          title: userData.title || '',
          addressAddition: userData.addressAddition || '',
          customerOrigin: userData.customerOrigin || '',
          postId: userData.postId || '',
          paymentMethod: userData.paymentMethod || '',
          paymentTerms: userData.paymentTerms || '',
          internalKey: userData.internalKey || '',
          discount: userData.discount || 0,
          status: userData.status || 'active',
          newsletter: userData.newsletter || false,
          comment: userData.comment || ''
        });

        await newUser.save();
        console.log(`CSVImportService: Successfully imported user: ${userData.email}`);
        results.successful.push({
          email: userData.email,
          message: 'User imported successfully'
        });
      } catch (error) {
        console.error(`CSVImportService: Failed to import user ${userData.email}: ${error.message}`, error);
        results.failed.push({
          email: userData.email,
          error: error.message
        });
      }
    }

    console.log(`CSVImportService: Import complete - ${results.successful.length} successful, ${results.failed.length} failed`);

    return {
      success: results.failed.length === 0,
      imported: results.successful.length,
      failed: results.failed.length,
      results
    };
  }
}

module.exports = CSVImportService;
