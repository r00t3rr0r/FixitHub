import api from './api';

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  author: {
    _id: string;
    name: string;
    avatar: string;
    bio: string;
  };
  category: BlogCategory;
  tags: BlogTag[];
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  publishedAt?: string;
  scheduledAt?: string;
  readTime: number;
  views: number;
  likes: number;
  isLiked: boolean;
  isFeatured: boolean;
  featuredOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  createdAt: string;
  updatedAt: string;
  workflow: {
    currentStage: 'draft' | 'review' | 'approved' | 'published';
    assignedReviewer?: string;
    reviewNotes?: string;
    revisionHistory: BlogRevision[];
  };
  comments: BlogComment[];
  commentsCount: number;
  performance: {
    views: number;
    likes: number;
    shares: number;
    avgReadTime: number;
    bounceRate: number;
  };
}

export interface BlogCategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string;
  children?: BlogCategory[];
  postCount: number;
  seoTitle?: string;
  seoDescription?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export interface BlogTag {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  postCount: number;
  color?: string;
  isActive: boolean;
  createdAt: string;
}

export interface BlogAuthor {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  expertise: string[];
  postCount: number;
  totalViews: number;
  isActive: boolean;
  joinedAt: string;
}

export interface BlogComment {
  _id: string;
  postId: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  content: string;
  status: 'pending' | 'approved' | 'spam' | 'rejected';
  parentId?: string;
  replies?: BlogComment[];
  createdAt: string;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNotes?: string;
}

export interface BlogRevision {
  _id: string;
  version: number;
  title: string;
  content: string;
  changes: string;
  createdBy: string;
  createdAt: string;
}

export interface BlogAnalytics {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  pendingReview: number;
  totalViews: number;
  totalComments: number;
  avgReadTime: number;
  topPosts: {
    _id: string;
    title: string;
    views: number;
    likes: number;
  }[];
  categoryStats: {
    category: string;
    postCount: number;
    views: number;
  }[];
  authorStats: {
    author: string;
    postCount: number;
    views: number;
  }[];
  monthlyStats: {
    month: string;
    posts: number;
    views: number;
  }[];
}

export interface CalendarEvent {
  _id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'publish' | 'deadline' | 'review' | 'meeting';
  postId?: string;
  description?: string;
  color: string;
}

// Description: Get blog analytics and dashboard data
// Endpoint: GET /api/admin/blog/analytics
// Request: { dateFrom?: string, dateTo?: string }
// Response: { analytics: BlogAnalytics }
export const getBlogAnalytics = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        analytics: {
          totalPosts: 156,
          publishedPosts: 124,
          draftPosts: 18,
          pendingReview: 14,
          totalViews: 45230,
          totalComments: 892,
          avgReadTime: 4.2,
          topPosts: [
            {
              _id: 'post1',
              title: 'How to Extend Your Phone Battery Life',
              views: 3420,
              likes: 156
            },
            {
              _id: 'post2',
              title: 'iPhone 15 vs Samsung Galaxy S24',
              views: 2890,
              likes: 134
            },
            {
              _id: 'post3',
              title: 'Water Damage Recovery Guide',
              views: 2156,
              likes: 98
            }
          ],
          categoryStats: [
            { category: 'Tips & Tricks', postCount: 45, views: 18500 },
            { category: 'Device Reviews', postCount: 32, views: 15200 },
            { category: 'Repair Guides', postCount: 28, views: 11530 }
          ],
          authorStats: [
            { author: 'Sarah Johnson', postCount: 34, views: 15600 },
            { author: 'Mike Chen', postCount: 28, views: 12400 },
            { author: 'Emily Rodriguez', postCount: 22, views: 9800 }
          ],
          monthlyStats: [
            { month: 'Jan 2024', posts: 12, views: 8500 },
            { month: 'Feb 2024', posts: 15, views: 9200 },
            { month: 'Mar 2024', posts: 18, views: 11300 }
          ]
        }
      });
    }, 500);
  });
};

// Description: Get all blog posts with advanced filtering
// Endpoint: GET /api/admin/blog/posts
// Request: { status?: string, category?: string, author?: string, tag?: string, search?: string, page?: number, limit?: number }
// Response: { posts: BlogPost[], totalPages: number, currentPage: number, totalPosts: number }
export const getAdminBlogPosts = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        posts: [
          {
            _id: 'post1',
            title: 'How to Extend Your Phone Battery Life: Expert Tips',
            slug: 'extend-phone-battery-life-expert-tips',
            excerpt: 'Learn professional techniques to maximize your smartphone battery performance and longevity with these proven strategies.',
            content: '<h2>Understanding Battery Health</h2><p>Your smartphone battery is one of its most critical components...</p>',
            featuredImage: 'https://via.placeholder.com/800x400/3b82f6/ffffff?text=Battery+Tips',
            author: {
              _id: 'author1',
              name: 'Sarah Johnson',
              avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
              bio: 'Senior Mobile Technician with 8+ years of experience in device repair and optimization.'
            },
            category: {
              _id: 'cat1',
              name: 'Tips & Tricks',
              slug: 'tips-tricks',
              description: 'Helpful advice for device maintenance and optimization',
              postCount: 45,
              isActive: true,
              order: 1,
              createdAt: '2024-01-01T00:00:00Z'
            },
            tags: [
              {
                _id: 'tag1',
                name: 'Battery',
                slug: 'battery',
                postCount: 23,
                color: '#10b981',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
              },
              {
                _id: 'tag2',
                name: 'Optimization',
                slug: 'optimization',
                postCount: 18,
                color: '#3b82f6',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
              }
            ],
            status: 'published',
            publishedAt: '2024-01-10T09:00:00Z',
            readTime: 5,
            views: 3420,
            likes: 156,
            isLiked: false,
            isFeatured: true,
            featuredOrder: 1,
            seoTitle: 'How to Extend Phone Battery Life - Expert Tips & Tricks',
            seoDescription: 'Learn professional techniques to maximize smartphone battery performance with our expert guide.',
            seoKeywords: ['battery life', 'smartphone', 'optimization', 'tips'],
            createdAt: '2024-01-08T10:00:00Z',
            updatedAt: '2024-01-10T09:00:00Z',
            workflow: {
              currentStage: 'published',
              revisionHistory: [
                {
                  _id: 'rev1',
                  version: 1,
                  title: 'How to Extend Your Phone Battery Life',
                  content: 'Initial draft content...',
                  changes: 'Initial creation',
                  createdBy: 'Sarah Johnson',
                  createdAt: '2024-01-08T10:00:00Z'
                }
              ]
            },
            comments: [],
            commentsCount: 23,
            performance: {
              views: 3420,
              likes: 156,
              shares: 45,
              avgReadTime: 4.8,
              bounceRate: 0.32
            }
          },
          {
            _id: 'post2',
            title: 'iPhone 15 vs Samsung Galaxy S24: Repair Cost Comparison',
            slug: 'iphone-15-vs-samsung-galaxy-s24-repair-costs',
            excerpt: 'A comprehensive breakdown of repair costs for the latest flagship smartphones to help you make informed decisions.',
            content: '<h2>Repair Cost Analysis</h2><p>When investing in a flagship smartphone...</p>',
            featuredImage: 'https://via.placeholder.com/800x400/8b5cf6/ffffff?text=Phone+Comparison',
            author: {
              _id: 'author2',
              name: 'Mike Chen',
              avatar: 'https://via.placeholder.com/100x100/f59e0b/ffffff?text=MC',
              bio: 'Mobile device analyst and repair specialist with expertise in cost analysis.'
            },
            category: {
              _id: 'cat2',
              name: 'Device Comparison',
              slug: 'device-comparison',
              description: 'In-depth comparisons of popular devices',
              postCount: 32,
              isActive: true,
              order: 2,
              createdAt: '2024-01-01T00:00:00Z'
            },
            tags: [
              {
                _id: 'tag3',
                name: 'iPhone',
                slug: 'iphone',
                postCount: 34,
                color: '#ef4444',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
              },
              {
                _id: 'tag4',
                name: 'Samsung',
                slug: 'samsung',
                postCount: 28,
                color: '#8b5cf6',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
              }
            ],
            status: 'pending_review',
            readTime: 7,
            views: 0,
            likes: 0,
            isLiked: false,
            isFeatured: false,
            createdAt: '2024-01-12T14:30:00Z',
            updatedAt: '2024-01-12T14:30:00Z',
            workflow: {
              currentStage: 'review',
              assignedReviewer: 'admin1',
              revisionHistory: []
            },
            comments: [],
            commentsCount: 0,
            performance: {
              views: 0,
              likes: 0,
              shares: 0,
              avgReadTime: 0,
              bounceRate: 0
            }
          }
        ],
        totalPages: 5,
        currentPage: 1,
        totalPosts: 156
      });
    }, 500);
  });
};

// Description: Get blog categories
// Endpoint: GET /api/admin/blog/categories
// Request: {}
// Response: { categories: BlogCategory[] }
export const getBlogCategories = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        categories: [
          {
            _id: 'cat1',
            name: 'Tips & Tricks',
            slug: 'tips-tricks',
            description: 'Helpful advice for device maintenance and optimization',
            postCount: 45,
            seoTitle: 'Device Tips & Tricks - FixitHub Blog',
            seoDescription: 'Expert tips and tricks for maintaining and optimizing your devices',
            isActive: true,
            order: 1,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'cat2',
            name: 'Device Comparison',
            slug: 'device-comparison',
            description: 'In-depth comparisons of popular devices',
            postCount: 32,
            isActive: true,
            order: 2,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'cat3',
            name: 'Repair Guides',
            slug: 'repair-guides',
            description: 'Step-by-step repair instructions and guides',
            postCount: 28,
            isActive: true,
            order: 3,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get blog tags
// Endpoint: GET /api/admin/blog/tags
// Request: {}
// Response: { tags: BlogTag[] }
export const getBlogTags = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        tags: [
          {
            _id: 'tag1',
            name: 'Battery',
            slug: 'battery',
            description: 'Posts about battery maintenance and replacement',
            postCount: 23,
            color: '#10b981',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'tag2',
            name: 'Screen Repair',
            slug: 'screen-repair',
            description: 'Screen replacement and repair guides',
            postCount: 34,
            color: '#3b82f6',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'tag3',
            name: 'iPhone',
            slug: 'iphone',
            description: 'iPhone-specific content and guides',
            postCount: 45,
            color: '#ef4444',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get blog authors
// Endpoint: GET /api/admin/blog/authors
// Request: {}
// Response: { authors: BlogAuthor[] }
export const getBlogAuthors = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        authors: [
          {
            _id: 'author1',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
            bio: 'Senior Mobile Technician with 8+ years of experience in device repair and optimization.',
            socialLinks: {
              twitter: 'https://twitter.com/sarahtech',
              linkedin: 'https://linkedin.com/in/sarahjohnson'
            },
            expertise: ['Battery Repair', 'Screen Replacement', 'iOS Troubleshooting'],
            postCount: 34,
            totalViews: 15600,
            isActive: true,
            joinedAt: '2023-03-15T00:00:00Z'
          },
          {
            _id: 'author2',
            name: 'Mike Chen',
            email: 'mike.chen@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/f59e0b/ffffff?text=MC',
            bio: 'Mobile device analyst and repair specialist with expertise in cost analysis.',
            socialLinks: {
              linkedin: 'https://linkedin.com/in/mikechen',
              website: 'https://mikechen.tech'
            },
            expertise: ['Device Analysis', 'Cost Comparison', 'Android Repair'],
            postCount: 28,
            totalViews: 12400,
            isActive: true,
            joinedAt: '2023-06-20T00:00:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get blog comments with moderation
// Endpoint: GET /api/admin/blog/comments
// Request: { status?: string, postId?: string, page?: number, limit?: number }
// Response: { comments: BlogComment[], totalPages: number, currentPage: number }
export const getBlogComments = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        comments: [
          {
            _id: 'comment1',
            postId: 'post1',
            author: {
              name: 'John Doe',
              email: 'john.doe@example.com',
              avatar: 'https://via.placeholder.com/50x50/3b82f6/ffffff?text=JD'
            },
            content: 'Great article! These battery tips really helped extend my phone\'s battery life.',
            status: 'approved',
            createdAt: '2024-01-11T10:30:00Z',
            moderatedBy: 'admin1',
            moderatedAt: '2024-01-11T11:00:00Z'
          },
          {
            _id: 'comment2',
            postId: 'post1',
            author: {
              name: 'Jane Smith',
              email: 'jane.smith@example.com'
            },
            content: 'This is spam content with promotional links...',
            status: 'spam',
            createdAt: '2024-01-11T14:20:00Z',
            moderatedBy: 'admin1',
            moderatedAt: '2024-01-11T14:25:00Z',
            moderationNotes: 'Contains promotional links and spam content'
          },
          {
            _id: 'comment3',
            postId: 'post2',
            author: {
              name: 'Tech Enthusiast',
              email: 'tech@example.com'
            },
            content: 'Looking forward to reading this comparison. When will it be published?',
            status: 'pending',
            createdAt: '2024-01-12T16:45:00Z'
          }
        ],
        totalPages: 3,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get editorial calendar events
// Endpoint: GET /api/admin/blog/calendar
// Request: { month?: string, year?: string }
// Response: { events: CalendarEvent[] }
export const getEditorialCalendar = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const events = [
        {
          _id: 'event1',
          title: 'Publish: Battery Tips Article',
          start: new Date(2024, 0, 15, 9, 0),
          end: new Date(2024, 0, 15, 10, 0),
          type: 'publish',
          postId: 'post1',
          description: 'Scheduled publication of battery optimization guide',
          color: '#10b981'
        },
        {
          _id: 'event2',
          title: 'Review Deadline: iPhone vs Samsung',
          start: new Date(2024, 0, 18, 17, 0),
          end: new Date(2024, 0, 18, 18, 0),
          type: 'deadline',
          postId: 'post2',
          description: 'Final review deadline for comparison article',
          color: '#f59e0b'
        },
        {
          _id: 'event3',
          title: 'Editorial Meeting',
          start: new Date(2024, 0, 20, 14, 0),
          end: new Date(2024, 0, 20, 15, 30),
          type: 'meeting',
          description: 'Weekly editorial planning meeting',
          color: '#8b5cf6'
        }
      ];
      
      resolve({ events });
    }, 500);
  });
};

// Description: Create or update blog post
// Endpoint: POST /api/admin/blog/posts
// Request: Partial<BlogPost>
// Response: { success: boolean, post: BlogPost }
export const createBlogPost = (postData: Partial<BlogPost>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        post: {
          _id: 'post_' + Date.now(),
          ...postData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Update blog post status
// Endpoint: PUT /api/admin/blog/posts/:id/status
// Request: { status: string, reviewNotes?: string }
// Response: { success: boolean, message: string }
export const updatePostStatus = (postId: string, status: string, reviewNotes?: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Post status updated successfully'
      });
    }, 500);
  });
};

// Description: Moderate blog comment
// Endpoint: PUT /api/admin/blog/comments/:id/moderate
// Request: { status: string, notes?: string }
// Response: { success: boolean, message: string }
export const moderateComment = (commentId: string, status: string, notes?: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Comment moderated successfully'
      });
    }, 500);
  });
};

// Description: Create or update category
// Endpoint: POST /api/admin/blog/categories
// Request: Partial<BlogCategory>
// Response: { success: boolean, category: BlogCategory }
export const createCategory = (categoryData: Partial<BlogCategory>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        category: {
          _id: 'cat_' + Date.now(),
          ...categoryData,
          createdAt: new Date().toISOString()
        }
      });
    }, 800);
  });
};

// Description: Create or update tag
// Endpoint: POST /api/admin/blog/tags
// Request: Partial<BlogTag>
// Response: { success: boolean, tag: BlogTag }
export const createTag = (tagData: Partial<BlogTag>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        tag: {
          _id: 'tag_' + Date.now(),
          ...tagData,
          createdAt: new Date().toISOString()
        }
      });
    }, 800);
  });
};

// Description: Update featured posts
// Endpoint: PUT /api/admin/blog/featured
// Request: { postIds: string[] }
// Response: { success: boolean, message: string }
export const updateFeaturedPosts = (postIds: string[]) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Featured posts updated successfully'
      });
    }, 500);
  });
};

// Legacy exports for backward compatibility
export const getBlogPosts = getBlogAnalytics;
export const getBlogPost = (id: string) => getAdminBlogPosts({ id });
export const toggleBlogPostLike = (postId: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        isLiked: true,
        likes: 90
      });
    }, 300);
  });
};