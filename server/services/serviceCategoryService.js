const ServiceCategory = require('../models/ServiceCategory');
const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');

class ServiceCategoryService {
  // Get all categories with optional filtering
  static async getCategories(filters = {}) {
    try {
      console.log('ServiceCategoryService: Getting categories with filters:', filters);

      const { type, isActive, search } = filters;
      const query = {};

      if (type) {
        query.type = type;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true' || isActive === true;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const categories = await ServiceCategory.find(query).sort({ order: 1, name: 1 });

      console.log(`ServiceCategoryService: Found ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error('ServiceCategoryService: Error getting categories:', error);
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  // Get a single category by ID
  static async getCategoryById(categoryId) {
    try {
      console.log('ServiceCategoryService: Getting category by ID:', categoryId);

      const category = await ServiceCategory.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      console.log('ServiceCategoryService: Category found:', category.name);
      return category;
    } catch (error) {
      console.error('ServiceCategoryService: Error getting category:', error);
      throw new Error(`Failed to get category: ${error.message}`);
    }
  }

  // Create a new category
  static async createCategory(categoryData) {
    try {
      console.log('ServiceCategoryService: Creating category:', categoryData.name);

      // Check if category with same name and type already exists
      const existingCategory = await ServiceCategory.findOne({
        name: categoryData.name,
        type: categoryData.type
      });

      if (existingCategory) {
        throw new Error(`Category with name "${categoryData.name}" already exists for type "${categoryData.type}"`);
      }

      const category = new ServiceCategory(categoryData);
      await category.save();

      console.log('ServiceCategoryService: Category created successfully:', category._id);
      return category;
    } catch (error) {
      console.error('ServiceCategoryService: Error creating category:', error);
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  // Update a category
  static async updateCategory(categoryId, updateData) {
    try {
      console.log('ServiceCategoryService: Updating category:', categoryId);

      // Check if updating name would create a duplicate
      if (updateData.name) {
        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
          throw new Error('Category not found');
        }

        const existingCategory = await ServiceCategory.findOne({
          name: updateData.name,
          type: category.type,
          _id: { $ne: categoryId }
        });

        if (existingCategory) {
          throw new Error(`Category with name "${updateData.name}" already exists for this type`);
        }
      }

      const category = await ServiceCategory.findByIdAndUpdate(
        categoryId,
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      );

      if (!category) {
        throw new Error('Category not found');
      }

      console.log('ServiceCategoryService: Category updated successfully');
      return category;
    } catch (error) {
      console.error('ServiceCategoryService: Error updating category:', error);
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  // Delete a category (with validation)
  static async deleteCategory(categoryId) {
    try {
      console.log('ServiceCategoryService: Deleting category:', categoryId);

      const category = await ServiceCategory.findById(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Check if category is in use
      const inUseCheck = await this.isCategoryInUse(category.name, category.type);

      if (inUseCheck.inUse) {
        throw new Error(`Cannot delete category "${category.name}". It is currently used by ${inUseCheck.count} ${category.type === 'repair' ? 'repair services' : 'add-on services'}. Please reassign these services to another category first.`);
      }

      await ServiceCategory.findByIdAndDelete(categoryId);

      console.log('ServiceCategoryService: Category deleted successfully');
      return { success: true, message: 'Category deleted successfully' };
    } catch (error) {
      console.error('ServiceCategoryService: Error deleting category:', error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  // Hard delete ALL categories (used by admin bulk-delete UI)
  static async deleteAllCategories() {
    try {
      console.log('ServiceCategoryService: Hard deleting ALL categories');
      const result = await ServiceCategory.deleteMany({});
      console.log(`ServiceCategoryService: Deleted ${result.deletedCount} categories`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('ServiceCategoryService: Error deleting all categories:', error);
      throw new Error(`Failed to delete all categories: ${error.message}`);
    }
  }

  // Soft delete (deactivate) a category
  static async deactivateCategory(categoryId) {
    try {
      console.log('ServiceCategoryService: Deactivating category:', categoryId);

      const category = await ServiceCategory.findByIdAndUpdate(
        categoryId,
        { isActive: false, updatedAt: Date.now() },
        { new: true }
      );

      if (!category) {
        throw new Error('Category not found');
      }

      console.log('ServiceCategoryService: Category deactivated successfully');
      return category;
    } catch (error) {
      console.error('ServiceCategoryService: Error deactivating category:', error);
      throw new Error(`Failed to deactivate category: ${error.message}`);
    }
  }

  // Reactivate a category
  static async activateCategory(categoryId) {
    try {
      console.log('ServiceCategoryService: Activating category:', categoryId);

      const category = await ServiceCategory.findByIdAndUpdate(
        categoryId,
        { isActive: true, updatedAt: Date.now() },
        { new: true }
      );

      if (!category) {
        throw new Error('Category not found');
      }

      console.log('ServiceCategoryService: Category activated successfully');
      return category;
    } catch (error) {
      console.error('ServiceCategoryService: Error activating category:', error);
      throw new Error(`Failed to activate category: ${error.message}`);
    }
  }

  // Check if a category is in use
  static async isCategoryInUse(categoryName, type) {
    try {
      console.log(`ServiceCategoryService: Checking if category "${categoryName}" is in use`);

      let count = 0;

      if (type === 'repair') {
        count = await Service.countDocuments({ category: categoryName });
      } else if (type === 'addon') {
        count = await AddOnService.countDocuments({ category: categoryName });
      }

      console.log(`ServiceCategoryService: Category is used by ${count} services`);
      return { inUse: count > 0, count };
    } catch (error) {
      console.error('ServiceCategoryService: Error checking category usage:', error);
      throw new Error(`Failed to check category usage: ${error.message}`);
    }
  }

  // Get category usage statistics
  static async getCategoryStatistics() {
    try {
      console.log('ServiceCategoryService: Getting category statistics');

      const categories = await ServiceCategory.find({ isActive: true });
      const statistics = [];

      for (const category of categories) {
        let count = 0;

        if (category.type === 'repair') {
          count = await Service.countDocuments({ category: category.name, isActive: true });
        } else if (category.type === 'addon') {
          count = await AddOnService.countDocuments({ category: category.name, isActive: true });
        }

        statistics.push({
          _id: category._id,
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon,
          serviceCount: count,
          isActive: category.isActive
        });
      }

      console.log(`ServiceCategoryService: Retrieved statistics for ${statistics.length} categories`);
      return statistics;
    } catch (error) {
      console.error('ServiceCategoryService: Error getting category statistics:', error);
      throw new Error(`Failed to get category statistics: ${error.message}`);
    }
  }

  // Reorder categories
  static async reorderCategories(categoryOrders) {
    try {
      console.log('ServiceCategoryService: Reordering categories');

      const updatePromises = categoryOrders.map(({ categoryId, order }) =>
        ServiceCategory.findByIdAndUpdate(
          categoryId,
          { order, updatedAt: Date.now() },
          { new: true }
        )
      );

      const updatedCategories = await Promise.all(updatePromises);

      console.log(`ServiceCategoryService: Reordered ${updatedCategories.length} categories`);
      return updatedCategories;
    } catch (error) {
      console.error('ServiceCategoryService: Error reordering categories:', error);
      throw new Error(`Failed to reorder categories: ${error.message}`);
    }
  }
}

module.exports = ServiceCategoryService;
