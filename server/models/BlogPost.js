const mongoose = require('mongoose');

const blogRevisionSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true,
    default: 1
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  changes: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const blogCommentSchema = new mongoose.Schema({
  author: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    avatar: String
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'spam', 'rejected'],
    default: 'pending'
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogComment'
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  moderationNotes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const blogCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory'
  },
  seoTitle: String,
  seoDescription: String,
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const blogTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  color: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    unique: true
  },
  excerpt: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  featuredImage: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory',
    required: true
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogTag'
  }],
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  scheduledAt: Date,
  readTime: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredOrder: Number,
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  workflow: {
    currentStage: {
      type: String,
      enum: ['draft', 'review', 'approved', 'published'],
      default: 'draft'
    },
    assignedReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: String,
    revisionHistory: [blogRevisionSchema]
  },
  performance: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    avgReadTime: {
      type: Number,
      default: 0
    },
    bounceRate: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to generate slug and update timestamps
blogPostSchema.pre('save', function(next) {
  console.log('BlogPost pre-save middleware triggered');
  console.log('this.isNew:', this.isNew);
  console.log('this.isModified("title"):', this.isModified('title'));
  console.log('this.title:', this.title);
  console.log('this.slug before generation:', this.slug);

  // Generate slug if it's a new document or if title was modified
  if (this.isNew || this.isModified('title')) {
    console.log('Condition met for slug generation');
    if (!this.slug || this.isModified('title')) {
      console.log('Generating slug from title:', this.title);
      this.slug = this.title.toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-');
      console.log('Generated slug:', this.slug);
    }
  } else {
    console.log('Condition NOT met for slug generation');
  }

  console.log('this.slug after generation:', this.slug);

  this.updatedAt = new Date();

  // Calculate read time (average 200 words per minute)
  if (this.isModified('content')) {
    const wordCount = this.content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / 200);
  }

  next();
});

// Virtual for comments count
blogPostSchema.virtual('commentsCount', {
  ref: 'BlogComment',
  localField: '_id',
  foreignField: 'postId',
  count: true
});

// Virtual for isLiked (will be set dynamically based on user)
blogPostSchema.virtual('isLiked').get(function() {
  return this._isLiked || false;
});

blogPostSchema.virtual('isLiked').set(function(value) {
  this._isLiked = value;
});

// Indexes for better performance
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ author: 1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ tags: 1 });
blogPostSchema.index({ slug: 1 });

// Virtual for postCount in categories and tags
blogCategorySchema.virtual('postCount', {
  ref: 'BlogPost',
  localField: '_id',
  foreignField: 'category',
  count: true
});

blogTagSchema.virtual('postCount', {
  ref: 'BlogPost',
  localField: '_id',
  foreignField: 'tags',
  count: true
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
const BlogCategory = mongoose.model('BlogCategory', blogCategorySchema);
const BlogTag = mongoose.model('BlogTag', blogTagSchema);
const BlogComment = mongoose.model('BlogComment', blogCommentSchema);

module.exports = {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogComment
};