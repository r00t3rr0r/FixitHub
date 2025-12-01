const Product = require('../models/Product');

class CSVProductImportService {
  /**
   * Validate column mapping
   */
  static validateColumnMapping(columnMapping) {
    console.log('Validating CSV product column mapping:', columnMapping);

    const requiredFields = ['name', 'category', 'price'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);

    if (missingFields.length > 0) {
      console.error('Missing required fields in column mapping:', missingFields);
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log('Column mapping validation successful');
    return true;
  }

  /**
   * Validate product data
   */
  static validateProductData(productData, rowIndex) {
    const errors = [];
    const warnings = [];

    // Validate name
    if (!productData.name || productData.name.trim() === '') {
      errors.push(`Row ${rowIndex}: Product name is required`);
    } else if (productData.name.length > 200) {
      errors.push(`Row ${rowIndex}: Product name must be less than 200 characters`);
    }

    // Validate category
    if (!productData.category || productData.category.trim() === '') {
      errors.push(`Row ${rowIndex}: Category is required`);
    }

    // Validate price
    if (productData.price === undefined || productData.price === null || productData.price === '') {
      errors.push(`Row ${rowIndex}: Price is required`);
    } else {
      const price = parseFloat(productData.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowIndex}: Price must be a valid positive number`);
      }
    }

    // Validate stock quantity (optional but must be valid if provided)
    if (productData.stockQuantity !== undefined && productData.stockQuantity !== null && productData.stockQuantity !== '') {
      const stock = parseInt(productData.stockQuantity);
      if (isNaN(stock) || stock < 0) {
        errors.push(`Row ${rowIndex}: Stock quantity must be a valid non-negative integer`);
      }
    }

    // Validate discount (optional but must be valid if provided)
    if (productData.discount !== undefined && productData.discount !== null && productData.discount !== '') {
      const discount = parseFloat(productData.discount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        warnings.push(`Row ${rowIndex}: Discount should be between 0 and 100`);
      }
    }

    // Validate weight (optional but must be valid if provided)
    if (productData.weight !== undefined && productData.weight !== null && productData.weight !== '') {
      const weight = parseFloat(productData.weight);
      if (isNaN(weight) || weight < 0) {
        warnings.push(`Row ${rowIndex}: Weight must be a valid positive number`);
      }
    }

    // Validate dimensions (optional but must be valid if provided)
    if (productData.dimensions) {
      if (productData.dimensions.length) {
        const length = parseFloat(productData.dimensions.length);
        if (isNaN(length) || length < 0) {
          warnings.push(`Row ${rowIndex}: Dimension length must be a valid positive number`);
        }
      }
      if (productData.dimensions.width) {
        const width = parseFloat(productData.dimensions.width);
        if (isNaN(width) || width < 0) {
          warnings.push(`Row ${rowIndex}: Dimension width must be a valid positive number`);
        }
      }
      if (productData.dimensions.height) {
        const height = parseFloat(productData.dimensions.height);
        if (isNaN(height) || height < 0) {
          warnings.push(`Row ${rowIndex}: Dimension height must be a valid positive number`);
        }
      }
    }

    // Validate SEO fields (optional but must meet standards if provided)
    if (productData.searchKeywords && productData.searchKeywords.length > 500) {
      warnings.push(`Row ${rowIndex}: Search keywords exceed 500 characters limit`);
    }

    if (productData.seoName && productData.seoName.length > 200) {
      warnings.push(`Row ${rowIndex}: SEO name exceeds 200 characters limit`);
    }

    if (productData.seoTitleTag) {
      if (productData.seoTitleTag.length > 60) {
        warnings.push(`Row ${rowIndex}: SEO title tag exceeds recommended 60 characters (${productData.seoTitleTag.length} chars)`);
      }
      if (productData.seoTitleTag.length < 30) {
        warnings.push(`Row ${rowIndex}: SEO title tag should be at least 30 characters for better search visibility (${productData.seoTitleTag.length} chars)`);
      }
    }

    if (productData.seoMetaKeywords && productData.seoMetaKeywords.length > 500) {
      warnings.push(`Row ${rowIndex}: SEO meta keywords exceed 500 characters limit`);
    }

    if (productData.seoMetaDescription) {
      if (productData.seoMetaDescription.length > 160) {
        warnings.push(`Row ${rowIndex}: SEO meta description exceeds recommended 160 characters (${productData.seoMetaDescription.length} chars)`);
      }
      if (productData.seoMetaDescription.length < 120) {
        warnings.push(`Row ${rowIndex}: SEO meta description should be at least 120 characters for better search visibility (${productData.seoMetaDescription.length} chars)`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Check for duplicates
   */
  static async checkDuplicates(products) {
    console.log(`Checking for duplicate products in ${products.length} rows`);

    const duplicates = [];
    const skuMap = new Map();
    const nameMap = new Map();

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Check for SKU duplicates within CSV
      if (product.sku) {
        if (skuMap.has(product.sku)) {
          duplicates.push({
            row: i + 2, // +2 for header and 0-index
            field: 'sku',
            value: product.sku,
            message: `Duplicate SKU found at rows ${skuMap.get(product.sku)} and ${i + 2}`
          });
        } else {
          skuMap.set(product.sku, i + 2);
        }

        // Check for SKU duplicates in database
        const existingProduct = await Product.findOne({ sku: product.sku, isDeleted: false });
        if (existingProduct) {
          duplicates.push({
            row: i + 2,
            field: 'sku',
            value: product.sku,
            message: `Product with SKU "${product.sku}" already exists in database`,
            existingId: existingProduct._id
          });
        }
      }

      // Check for name duplicates within CSV
      const nameLower = product.name.toLowerCase().trim();
      if (nameMap.has(nameLower)) {
        duplicates.push({
          row: i + 2,
          field: 'name',
          value: product.name,
          message: `Duplicate product name found at rows ${nameMap.get(nameLower)} and ${i + 2}`
        });
      } else {
        nameMap.set(nameLower, i + 2);
      }
    }

    console.log(`Found ${duplicates.length} duplicate entries`);
    return duplicates;
  }

  /**
   * Clean and prepare product data
   */
  static cleanProductData(productData) {
    const cleanedData = {
      name: productData.name?.trim(),
      description: productData.description?.trim() || '',
      category: productData.category?.trim(),
      brand: productData.brand?.trim() || '',
      price: parseFloat(productData.price) || 0,
      discount: productData.discount ? parseFloat(productData.discount) : 0,
      stockQuantity: productData.stockQuantity ? parseInt(productData.stockQuantity) : 0,
      lowStockThreshold: productData.lowStockThreshold ? parseInt(productData.lowStockThreshold) : 10,
      sku: productData.sku?.trim() || '',
      images: [],
      features: [],
      compatibility: [],
      weight: productData.weight ? parseFloat(productData.weight) : undefined,
      dimensions: {},
      tags: [],
      // SEO Fields
      searchKeywords: productData.searchKeywords?.trim() || undefined,
      seoName: productData.seoName?.trim() || undefined,
      seoTitleTag: productData.seoTitleTag?.trim() || undefined,
      seoMetaKeywords: productData.seoMetaKeywords?.trim() || undefined,
      seoMetaDescription: productData.seoMetaDescription?.trim() || undefined,
      isActive: true
    };

    // Parse images (comma-separated URLs)
    if (productData.images) {
      cleanedData.images = productData.images
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    }

    // Parse features (comma-separated)
    if (productData.features) {
      cleanedData.features = productData.features
        .split(',')
        .map(feature => feature.trim())
        .filter(feature => feature.length > 0);
    }

    // Parse compatibility (comma-separated)
    if (productData.compatibility) {
      cleanedData.compatibility = productData.compatibility
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }

    // Parse dimensions
    if (productData.dimensionLength) {
      cleanedData.dimensions.length = parseFloat(productData.dimensionLength);
    }
    if (productData.dimensionWidth) {
      cleanedData.dimensions.width = parseFloat(productData.dimensionWidth);
    }
    if (productData.dimensionHeight) {
      cleanedData.dimensions.height = parseFloat(productData.dimensionHeight);
    }

    // Parse tags (comma-separated)
    if (productData.tags) {
      cleanedData.tags = productData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    return cleanedData;
  }

  /**
   * Process CSV data and validate
   */
  static async processCSVImport(csvData, columnMapping) {
    console.log(`Processing CSV product import with ${csvData.length} rows`);

    try {
      // Validate column mapping
      this.validateColumnMapping(columnMapping);

      const validatedProducts = [];
      const errors = [];
      const warnings = [];

      // Process each row
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowIndex = i + 2; // +2 for header row and 0-index

        // Map CSV columns to product fields
        const productData = {};
        for (const [field, csvColumn] of Object.entries(columnMapping)) {
          if (csvColumn && row[csvColumn] !== undefined) {
            productData[field] = row[csvColumn];
          }
        }

        // Validate product data
        const validation = this.validateProductData(productData, rowIndex);

        if (validation.errors.length > 0) {
          errors.push(...validation.errors);
        } else {
          validatedProducts.push({
            rowIndex,
            data: productData,
            warnings: validation.warnings
          });
          if (validation.warnings.length > 0) {
            warnings.push(...validation.warnings);
          }
        }
      }

      // Check for duplicates
      const duplicates = await this.checkDuplicates(validatedProducts.map(p => p.data));

      console.log(`CSV validation complete: ${validatedProducts.length} valid, ${errors.length} errors, ${warnings.length} warnings, ${duplicates.length} duplicates`);

      return {
        valid: errors.length === 0,
        validatedProducts,
        errors,
        warnings,
        duplicates,
        totalRows: csvData.length,
        validRows: validatedProducts.length
      };
    } catch (error) {
      console.error('Error processing CSV import:', error);
      throw error;
    }
  }

  /**
   * Import products into database
   */
  static async importProducts(validatedProducts, options = {}) {
    console.log(`Starting product import of ${validatedProducts.length} products`);

    const { updateExisting = false, skipDuplicates = true } = options;

    const results = {
      successful: [],
      failed: [],
      updated: [],
      skipped: []
    };

    for (const item of validatedProducts) {
      try {
        const cleanedData = this.cleanProductData(item.data);

        // Check if product exists
        let existingProduct = null;
        if (cleanedData.sku) {
          existingProduct = await Product.findOne({ sku: cleanedData.sku, isDeleted: false });
        }

        if (existingProduct) {
          if (updateExisting) {
            // Update existing product
            Object.assign(existingProduct, cleanedData);
            await existingProduct.save();

            console.log(`Updated product: ${cleanedData.name} (SKU: ${cleanedData.sku})`);
            results.updated.push({
              row: item.rowIndex,
              productId: existingProduct._id,
              name: cleanedData.name,
              sku: cleanedData.sku
            });
          } else if (skipDuplicates) {
            console.log(`Skipped duplicate product: ${cleanedData.name} (SKU: ${cleanedData.sku})`);
            results.skipped.push({
              row: item.rowIndex,
              name: cleanedData.name,
              sku: cleanedData.sku,
              reason: 'Duplicate SKU'
            });
          } else {
            results.failed.push({
              row: item.rowIndex,
              name: cleanedData.name,
              error: 'Product with this SKU already exists'
            });
          }
        } else {
          // Create new product
          const newProduct = new Product(cleanedData);
          await newProduct.save();

          console.log(`Created new product: ${cleanedData.name} (ID: ${newProduct._id})`);
          results.successful.push({
            row: item.rowIndex,
            productId: newProduct._id,
            name: cleanedData.name,
            sku: cleanedData.sku
          });
        }
      } catch (error) {
        console.error(`Error importing product at row ${item.rowIndex}:`, error);
        results.failed.push({
          row: item.rowIndex,
          name: item.data.name,
          error: error.message
        });
      }
    }

    console.log(`Product import complete: ${results.successful.length} created, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.failed.length} failed`);

    return results;
  }
}

module.exports = CSVProductImportService;
