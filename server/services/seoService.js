const SEOSettings = require('../models/SEOSettings');

class SEOService {
  // Get SEO settings for a specific page
  static async getSEOSettings(pageType, pageId = '') {
    console.log('SEOService: Getting SEO settings for:', { pageType, pageId });

    try {
      const settings = await SEOSettings.findOne({ pageType, pageId });

      if (!settings) {
        // Return default settings if none found
        return {
          pageType,
          pageId,
          title: '',
          description: '',
          keywords: [],
          ogTitle: '',
          ogDescription: '',
          ogImage: '',
          twitterTitle: '',
          twitterDescription: '',
          twitterImage: '',
          canonicalUrl: '',
          noIndex: false,
          noFollow: false
        };
      }

      console.log('SEOService: Found SEO settings');
      return settings;
    } catch (error) {
      console.error('SEOService: Error getting SEO settings:', error);
      throw error;
    }
  }

  // Get all SEO settings with filtering
  static async getAllSEOSettings(filters = {}) {
    console.log('SEOService: Getting all SEO settings with filters:', filters);

    try {
      const query = {};

      if (filters.pageType) {
        query.pageType = filters.pageType;
      }

      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { pageType: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      const settings = await SEOSettings.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email');

      const totalSettings = await SEOSettings.countDocuments(query);
      const totalPages = Math.ceil(totalSettings / limit);

      console.log('SEOService: Found', settings.length, 'SEO settings');
      return {
        settings,
        totalPages,
        currentPage: page,
        totalSettings
      };
    } catch (error) {
      console.error('SEOService: Error getting all SEO settings:', error);
      throw error;
    }
  }

  // Create or update SEO settings
  static async upsertSEOSettings(pageType, pageId, seoData, userId) {
    console.log('SEOService: Upserting SEO settings:', { pageType, pageId, seoData });

    try {
      const settings = await SEOSettings.findOneAndUpdate(
        { pageType, pageId },
        {
          ...seoData,
          pageType,
          pageId,
          updatedBy: userId,
          updatedAt: new Date()
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

      // Set createdBy if this is a new document
      if (!settings.createdBy) {
        settings.createdBy = userId;
        await settings.save();
      }

      console.log('SEOService: SEO settings upserted successfully');
      return settings;
    } catch (error) {
      console.error('SEOService: Error upserting SEO settings:', error);
      throw error;
    }
  }

  // Delete SEO settings
  static async deleteSEOSettings(settingsId) {
    console.log('SEOService: Deleting SEO settings:', settingsId);

    try {
      const deletedSettings = await SEOSettings.findByIdAndDelete(settingsId);

      if (!deletedSettings) {
        throw new Error('SEO settings not found');
      }

      console.log('SEOService: SEO settings deleted successfully');
      return { success: true, message: 'SEO settings deleted successfully' };
    } catch (error) {
      console.error('SEOService: Error deleting SEO settings:', error);
      throw error;
    }
  }

  // Generate sitemap data
  static async generateSitemapData() {
    console.log('SEOService: Generating sitemap data');

    try {
      const staticPages = [
        { url: '/', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
        { url: '/shop', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: '/new-order', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
        { url: '/faq', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: '/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: '/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: '/kontakt', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      ];

      // Include individual product pages
      let productPages = [];
      try {
        const Product = require('../models/Product');
        const products = await Product.find({ isActive: true }).select('_id updatedAt').lean();
        productPages = products.map((p) => ({
          url: `/shop/product/${p._id}`,
          lastModified: p.updatedAt || new Date(),
          changeFrequency: 'weekly',
          priority: 0.75,
        }));
        console.log('SEOService: Added', productPages.length, 'product URLs to sitemap');
      } catch (err) {
        console.warn('SEOService: Could not load products for sitemap:', err.message);
      }

      const sitemapData = [...staticPages, ...productPages];
      console.log('SEOService: Generated sitemap with', sitemapData.length, 'URLs');
      return sitemapData;
    } catch (error) {
      console.error('SEOService: Error generating sitemap data:', error);
      throw error;
    }
  }

  // Get SEO analytics
  static async getSEOAnalytics() {
    console.log('SEOService: Getting SEO analytics');

    try {
      const totalPages = await SEOSettings.countDocuments();
      const indexablePages = await SEOSettings.countDocuments({ noIndex: false });
      
      const pageTypeBreakdown = await SEOSettings.aggregate([
        {
          $group: {
            _id: '$pageType',
            count: { $sum: 1 }
          }
        }
      ]);

      const analytics = {
        totalPages,
        indexablePages,
        nonIndexablePages: totalPages - indexablePages,
        pageTypeBreakdown: pageTypeBreakdown.map(item => ({
          pageType: item._id,
          count: item.count
        })),
        lastUpdated: new Date()
      };

      console.log('SEOService: Generated SEO analytics');
      return analytics;
    } catch (error) {
      console.error('SEOService: Error getting SEO analytics:', error);
      throw error;
    }
  }
}

module.exports = SEOService;