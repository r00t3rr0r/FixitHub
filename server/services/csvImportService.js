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

      // Map CSV columns to user fields
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
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          company: userData.company,
          country: userData.country,
          role: userData.role,
          isActive: userData.isActive,
          password: hashedPassword
        });

        await newUser.save();
        results.successful.push({
          email: userData.email,
          message: 'User imported successfully'
        });
      } catch (error) {
        console.error(`CSVImportService: Failed to import user ${userData.email}: ${error.message}`);
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
