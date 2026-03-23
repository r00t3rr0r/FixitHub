const { BlogPost, BlogCategory, BlogTag, BlogComment } = require('../models/BlogPost');
const User = require('../models/User');

class BlogService {
  // Get blog analytics
  static async getAnalytics(filters = {}) {
    try {
      console.log('BlogService: Getting blog analytics with filters:', filters);

      const totalPosts = await BlogPost.countDocuments();
      const publishedPosts = await BlogPost.countDocuments({ status: 'published' });
      const draftPosts = await BlogPost.countDocuments({ status: 'draft' });
      const pendingReview = await BlogPost.countDocuments({ status: 'pending_review' });

      // Get total views and performance metrics
      const performanceAgg = await BlogPost.aggregate([
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$performance.views' },
            totalLikes: { $sum: '$performance.likes' },
            avgReadTime: { $avg: '$readTime' }
          }
        }
      ]);

      const performance = performanceAgg[0] || { totalViews: 0, totalLikes: 0, avgReadTime: 0 };

      // Get top posts
      const topPosts = await BlogPost.find({ status: 'published' })
        .select('title performance.views performance.likes')
        .sort({ 'performance.views': -1 })
        .limit(5);

      // Get category stats
      const categoryStats = await BlogPost.aggregate([
        { $match: { status: 'published' } },
        {
          $lookup: {
            from: 'blogcategories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        {
          $group: {
            _id: '$categoryInfo.name',
            postCount: { $sum: 1 },
            views: { $sum: '$performance.views' }
          }
        },
        { $sort: { postCount: -1 } }
      ]);

      // Get author stats
      const authorStats = await BlogPost.aggregate([
        { $match: { status: 'published' } },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'authorInfo'
          }
        },
        { $unwind: '$authorInfo' },
        {
          $group: {
            _id: '$authorInfo.name',
            postCount: { $sum: 1 },
            views: { $sum: '$performance.views' }
          }
        },
        { $sort: { postCount: -1 } }
      ]);

      // Get monthly stats (last 12 months)
      const monthlyStats = await BlogPost.aggregate([
        {
          $match: {
            status: 'published',
            publishedAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$publishedAt' },
              month: { $month: '$publishedAt' }
            },
            posts: { $sum: 1 },
            views: { $sum: '$performance.views' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            month: {
              $concat: [
                { $arrayElemAt: [['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], { $subtract: ['$_id.month', 1] }] },
                ' ',
                { $toString: '$_id.year' }
              ]
            },
            posts: 1,
            views: 1
          }
        }
      ]);

      const analytics = {
        totalPosts,
        publishedPosts,
        draftPosts,
        pendingReview,
        totalViews: performance.totalViews,
        totalComments: 0, // Will be implemented when comments are added
        avgReadTime: Math.round(performance.avgReadTime * 10) / 10,
        topPosts: topPosts.map(post => ({
          _id: post._id,
          title: post.title,
          views: post.performance.views,
          likes: post.performance.likes
        })),
        categoryStats: categoryStats.map(stat => ({
          category: stat._id,
          postCount: stat.postCount,
          views: stat.views
        })),
        authorStats: authorStats.map(stat => ({
          author: stat._id,
          postCount: stat.postCount,
          views: stat.views
        })),
        monthlyStats
      };

      console.log('BlogService: Analytics retrieved successfully');
      return analytics;
    } catch (error) {
      console.error('BlogService: Error getting analytics:', error);
      throw error;
    }
  }

  // Get blog posts with filtering and pagination
  static async getPosts(filters = {}) {
    try {
      console.log('BlogService: Getting posts with filters:', filters);

      const {
        status,
        category,
        author,
        tag,
        search,
        page = 1,
        limit = 10
      } = filters;

      // Build query
      const query = {};
      
      if (status) query.status = status;
      if (category) query.category = category;
      if (author) query.author = author;
      if (tag) query.tags = { $in: [tag] };
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { excerpt: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const posts = await BlogPost.find(query)
        .populate('author', 'name email avatar bio')
        .populate('category', 'name slug description')
        .populate('tags', 'name slug color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalPosts = await BlogPost.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      console.log(`BlogService: Retrieved ${posts.length} posts`);
      return {
        posts,
        totalPages,
        currentPage: parseInt(page),
        totalPosts
      };
    } catch (error) {
      console.error('BlogService: Error getting posts:', error);
      throw error;
    }
  }

  // Get single blog post (by ID or slug)
  static async getPost(idOrSlug) {
    try {
      console.log('BlogService: Getting post with ID or Slug:', idOrSlug);

      let post;
      
      // Try to find by ID first (if it's a valid ObjectId)
      if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
        post = await BlogPost.findById(idOrSlug)
          .populate('author', 'name email avatar bio')
          .populate('category', 'name slug description')
          .populate('tags', 'name slug color');
      }
      
      // If not found or not a valid ObjectId, try to find by slug
      if (!post) {
        post = await BlogPost.findOne({ slug: idOrSlug })
          .populate('author', 'name email avatar bio')
          .populate('category', 'name slug description')
          .populate('tags', 'name slug color');
      }

      if (!post) {
        throw new Error('Blog post not found');
      }

      // Increment view count
      await BlogPost.findByIdAndUpdate(post._id, { 
        $inc: { 
          views: 1,
          'performance.views': 1 
        } 
      });

      console.log('BlogService: Post retrieved successfully');
      return post;
    } catch (error) {
      console.error('BlogService: Error getting post:', error);
      throw error;
    }
  }

  // Create blog post
  static async createPost(postData, authorId) {
    try {
      console.log('BlogService: Creating post:', postData.title);
      console.log('BlogService: Full postData received:', JSON.stringify(postData, null, 2));

      const post = new BlogPost({
        ...postData,
        author: authorId
      });

      console.log('BlogService: Created BlogPost instance');
      console.log('BlogService: Post title before save:', post.title);
      console.log('BlogService: Post slug before save:', post.slug);

      // Add initial revision
      post.workflow.revisionHistory.push({
        version: 1,
        title: post.title,
        content: post.content,
        changes: 'Initial creation',
        createdBy: authorId
      });

      console.log('BlogService: About to save post');
      await post.save();
      console.log('BlogService: Post saved successfully');

      const populatedPost = await BlogPost.findById(post._id)
        .populate('author', 'name email avatar bio')
        .populate('category', 'name slug description')
        .populate('tags', 'name slug color');

      console.log('BlogService: Post created successfully');
      return populatedPost;
    } catch (error) {
      console.error('BlogService: Error creating post:', error);
      throw error;
    }
  }

  // Update blog post
  static async updatePost(id, postData, userId) {
    try {
      console.log('BlogService: Updating post with ID:', id);

      const existingPost = await BlogPost.findById(id);
      if (!existingPost) {
        throw new Error('Blog post not found');
      }

      // Add revision if content changed
      if (postData.title !== existingPost.title || postData.content !== existingPost.content) {
        const newVersion = existingPost.workflow.revisionHistory.length + 1;
        existingPost.workflow.revisionHistory.push({
          version: newVersion,
          title: postData.title || existingPost.title,
          content: postData.content || existingPost.content,
          changes: postData.changes || 'Content updated',
          createdBy: userId
        });
      }

      const updatedPost = await BlogPost.findByIdAndUpdate(
        id,
        { ...postData, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate('author', 'name email avatar bio')
        .populate('category', 'name slug description')
        .populate('tags', 'name slug color');

      console.log('BlogService: Post updated successfully');
      return updatedPost;
    } catch (error) {
      console.error('BlogService: Error updating post:', error);
      throw error;
    }
  }

  // Update post status
  static async updatePostStatus(id, status, reviewNotes, userId) {
    try {
      console.log('BlogService: Updating post status:', id, status);

      const updateData = {
        status,
        updatedAt: new Date()
      };

      if (status === 'published' && !await BlogPost.findOne({ _id: id, publishedAt: { $exists: true } })) {
        updateData.publishedAt = new Date();
      }

      if (reviewNotes) {
        updateData['workflow.reviewNotes'] = reviewNotes;
        updateData['workflow.assignedReviewer'] = userId;
      }

      const post = await BlogPost.findByIdAndUpdate(id, updateData, { new: true });
      
      if (!post) {
        throw new Error('Blog post not found');
      }

      console.log('BlogService: Post status updated successfully');
      return { success: true, message: 'Post status updated successfully' };
    } catch (error) {
      console.error('BlogService: Error updating post status:', error);
      throw error;
    }
  }

  // Get categories
  static async getCategories() {
    try {
      console.log('BlogService: Getting categories');

      const categories = await BlogCategory.find({ isActive: true })
        .sort({ order: 1, name: 1 });

      // Get post counts for each category
      for (let category of categories) {
        const postCount = await BlogPost.countDocuments({ 
          category: category._id, 
          status: 'published' 
        });
        category.postCount = postCount;
      }

      console.log(`BlogService: Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error('BlogService: Error getting categories:', error);
      throw error;
    }
  }

  // Get tags
  static async getTags() {
    try {
      console.log('BlogService: Getting tags');

      const tags = await BlogTag.find({ isActive: true })
        .sort({ name: 1 });

      // Get post counts for each tag
      for (let tag of tags) {
        const postCount = await BlogPost.countDocuments({ 
          tags: tag._id, 
          status: 'published' 
        });
        tag.postCount = postCount;
      }

      console.log(`BlogService: Retrieved ${tags.length} tags`);
      return tags;
    } catch (error) {
      console.error('BlogService: Error getting tags:', error);
      throw error;
    }
  }

  // Create category
  static async createCategory(categoryData) {
    try {
      console.log('BlogService: Creating category:', categoryData.name);

      const category = new BlogCategory(categoryData);
      await category.save();

      console.log('BlogService: Category created successfully');
      return category;
    } catch (error) {
      console.error('BlogService: Error creating category:', error);
      throw error;
    }
  }

  // Create tag
  static async createTag(tagData) {
    try {
      console.log('BlogService: Creating tag:', tagData.name);

      const tag = new BlogTag(tagData);
      await tag.save();

      console.log('BlogService: Tag created successfully');
      return tag;
    } catch (error) {
      console.error('BlogService: Error creating tag:', error);
      throw error;
    }
  }

  // Toggle post like (for future implementation)
  static async toggleLike(postId, userId) {
    try {
      console.log('BlogService: Toggling like for post:', postId);

      // For now, just increment likes count
      // In a real implementation, you'd track user likes in a separate collection
      const post = await BlogPost.findByIdAndUpdate(
        postId,
        { 
          $inc: { 
            likes: 1,
            'performance.likes': 1 
          } 
        },
        { new: true }
      );

      if (!post) {
        throw new Error('Blog post not found');
      }

      console.log('BlogService: Like toggled successfully');
      return {
        success: true,
        isLiked: true,
        likes: post.likes
      };
    } catch (error) {
      console.error('BlogService: Error toggling like:', error);
      throw error;
    }
  }

  static async deletePost(id) {
    try {
      console.log('BlogService: Deleting post:', id);
      const post = await BlogPost.findByIdAndDelete(id);
      if (!post) {
        throw new Error('Blog post not found');
      }
      console.log('BlogService: Post deleted successfully');
      return { success: true, message: 'Post deleted successfully' };
    } catch (error) {
      console.error('BlogService: Error deleting post:', error);
      throw error;
    }
  }
}

module.exports = BlogService;