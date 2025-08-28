const FAQ = require('../models/FAQ');

class FAQService {
  // Get all FAQs with filtering
  static async getFAQs(filters = {}) {
    try {
      console.log('FAQService: Getting FAQs with filters:', filters);

      const {
        category,
        search,
        isActive = true,
        page = 1,
        limit = 50
      } = filters;

      // Build query
      const query = { isActive };

      if (category && category !== 'all') {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { question: { $regex: search, $options: 'i' } },
          { answer: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      const skip = (page - 1) * limit;

      const faqs = await FAQ.find(query)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ category: 1, order: 1, question: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalFAQs = await FAQ.countDocuments(query);
      const totalPages = Math.ceil(totalFAQs / limit);

      // Group FAQs by category
      const groupedFAQs = {};
      faqs.forEach(faq => {
        if (!groupedFAQs[faq.category]) {
          groupedFAQs[faq.category] = [];
        }
        groupedFAQs[faq.category].push(faq);
      });

      console.log(`FAQService: Retrieved ${faqs.length} FAQs`);
      return {
        faqs,
        groupedFAQs,
        totalPages,
        currentPage: parseInt(page),
        totalFAQs
      };
    } catch (error) {
      console.error('FAQService: Error getting FAQs:', error);
      throw error;
    }
  }

  // Get single FAQ
  static async getFAQ(id) {
    try {
      console.log('FAQService: Getting FAQ with ID:', id);

      const faq = await FAQ.findById(id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!faq) {
        throw new Error('FAQ not found');
      }

      // Increment view count
      await FAQ.findByIdAndUpdate(id, { $inc: { views: 1 } });

      console.log('FAQService: FAQ retrieved successfully');
      return faq;
    } catch (error) {
      console.error('FAQService: Error getting FAQ:', error);
      throw error;
    }
  }

  // Create FAQ
  static async createFAQ(faqData, userId) {
    try {
      console.log('FAQService: Creating FAQ:', faqData.question);

      const faq = new FAQ({
        ...faqData,
        createdBy: userId
      });

      await faq.save();

      const populatedFAQ = await FAQ.findById(faq._id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      console.log('FAQService: FAQ created successfully');
      return populatedFAQ;
    } catch (error) {
      console.error('FAQService: Error creating FAQ:', error);
      throw error;
    }
  }

  // Update FAQ
  static async updateFAQ(id, faqData, userId) {
    try {
      console.log('FAQService: Updating FAQ with ID:', id);

      const updatedFAQ = await FAQ.findByIdAndUpdate(
        id,
        {
          ...faqData,
          updatedBy: userId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      )
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!updatedFAQ) {
        throw new Error('FAQ not found');
      }

      console.log('FAQService: FAQ updated successfully');
      return updatedFAQ;
    } catch (error) {
      console.error('FAQService: Error updating FAQ:', error);
      throw error;
    }
  }

  // Delete FAQ
  static async deleteFAQ(id) {
    try {
      console.log('FAQService: Deleting FAQ with ID:', id);

      const faq = await FAQ.findByIdAndDelete(id);

      if (!faq) {
        throw new Error('FAQ not found');
      }

      console.log('FAQService: FAQ deleted successfully');
      return { success: true, message: 'FAQ deleted successfully' };
    } catch (error) {
      console.error('FAQService: Error deleting FAQ:', error);
      throw error;
    }
  }

  // Get FAQ categories with counts
  static async getCategories() {
    try {
      console.log('FAQService: Getting FAQ categories');

      const categories = await FAQ.aggregate([
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

      console.log(`FAQService: Retrieved ${categoryList.length} categories`);
      return categoryList;
    } catch (error) {
      console.error('FAQService: Error getting categories:', error);
      throw error;
    }
  }

  // Mark FAQ as helpful/not helpful
  static async markHelpful(id, isHelpful) {
    try {
      console.log('FAQService: Marking FAQ as helpful:', id, isHelpful);

      const updateField = isHelpful ? 'helpful' : 'notHelpful';
      const faq = await FAQ.findByIdAndUpdate(
        id,
        { $inc: { [updateField]: 1 } },
        { new: true }
      );

      if (!faq) {
        throw new Error('FAQ not found');
      }

      console.log('FAQService: FAQ helpfulness updated');
      return {
        success: true,
        helpful: faq.helpful,
        notHelpful: faq.notHelpful
      };
    } catch (error) {
      console.error('FAQService: Error marking FAQ as helpful:', error);
      throw error;
    }
  }
}

module.exports = FAQService;