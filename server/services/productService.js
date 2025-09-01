const Product = require('../models/Product');

class ProductService {
  // Get all products with filtering
  static async getProducts(filters = {}) {
    console.log('ProductService: Getting products with filters:', filters);

    try {
      const query = { isActive: true };

      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }

      if (filters.brand && filters.brand !== 'all') {
        query.brand = filters.brand;
      }

      if (filters.inStock === 'true') {
        query.inStock = true;
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { brand: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      const products = await Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / limit);

      console.log('ProductService: Found', products.length, 'products');
      return {
        products,
        totalPages,
        currentPage: page,
        totalProducts
      };
    } catch (error) {
      console.error('ProductService: Error getting products:', error);
      throw error;
    }
  }

  // Get single product by ID
  static async getProductById(productId) {
    console.log('ProductService: Getting product by ID:', productId);

    try {
      const product = await Product.findOne({ _id: productId, isActive: true });

      if (!product) {
        throw new Error('Product not found');
      }

      console.log('ProductService: Product found:', product.name);
      return product;
    } catch (error) {
      console.error('ProductService: Error getting product by ID:', error);
      throw error;
    }
  }

  // Create new product
  static async createProduct(productData) {
    console.log('ProductService: Creating product:', productData.name);

    try {
      const product = new Product(productData);
      const savedProduct = await product.save();

      console.log('ProductService: Product created successfully with ID:', savedProduct._id);
      return savedProduct;
    } catch (error) {
      console.error('ProductService: Error creating product:', error);
      throw error;
    }
  }

  // Update product
  static async updateProduct(productId, updateData) {
    console.log('ProductService: Updating product:', productId);

    try {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, isActive: true },
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        throw new Error('Product not found');
      }

      console.log('ProductService: Product updated successfully');
      return updatedProduct;
    } catch (error) {
      console.error('ProductService: Error updating product:', error);
      throw error;
    }
  }

  // Delete product (soft delete)
  static async deleteProduct(productId) {
    console.log('ProductService: Deleting product:', productId);

    try {
      const deletedProduct = await Product.findOneAndUpdate(
        { _id: productId },
        { isActive: false },
        { new: true }
      );

      if (!deletedProduct) {
        throw new Error('Product not found');
      }

      console.log('ProductService: Product deleted successfully');
      return { success: true, message: 'Product deleted successfully' };
    } catch (error) {
      console.error('ProductService: Error deleting product:', error);
      throw error;
    }
  }

  // Get product categories
  static async getCategories() {
    console.log('ProductService: Getting product categories');

    try {
      const categories = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const categoryList = categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }));

      console.log('ProductService: Found', categoryList.length, 'categories');
      return categoryList;
    } catch (error) {
      console.error('ProductService: Error getting categories:', error);
      throw error;
    }
  }

  // Get product brands
  static async getBrands() {
    console.log('ProductService: Getting product brands');

    try {
      const brands = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$brand',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const brandList = brands.map(brand => ({
        name: brand._id,
        count: brand.count
      }));

      console.log('ProductService: Found', brandList.length, 'brands');
      return brandList;
    } catch (error) {
      console.error('ProductService: Error getting brands:', error);
      throw error;
    }
  }
}

module.exports = ProductService;