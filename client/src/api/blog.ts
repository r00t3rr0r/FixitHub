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
// Endpoint: GET /api/blog-posts/analytics
// Request: { dateFrom?: string, dateTo?: string }
// Response: { analytics: BlogAnalytics }
export const getBlogAnalytics = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/blog-posts/analytics', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all blog posts with advanced filtering
// Endpoint: GET /api/blog-posts
// Request: { status?: string, category?: string, author?: string, tag?: string, search?: string, page?: number, limit?: number }
// Response: { posts: BlogPost[], totalPages: number, currentPage: number, totalPosts: number }
export const getAdminBlogPosts = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/blog-posts', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get blog categories
// Endpoint: GET /api/blog-posts/categories/list
// Request: {}
// Response: { categories: BlogCategory[] }
export const getBlogCategories = async () => {
  try {
    const response = await api.get('/api/blog-posts/categories/list');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get blog tags
// Endpoint: GET /api/blog-posts/tags/list
// Request: {}
// Response: { tags: BlogTag[] }
export const getBlogTags = async () => {
  try {
    const response = await api.get('/api/blog-posts/tags/list');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get blog authors (mock implementation since backend route doesn't exist)
// Endpoint: GET /api/users (filtered for authors) - NOT IMPLEMENTED
// Request: { role?: 'staff' }
// Response: { authors: BlogAuthor[] }
export const getBlogAuthors = async () => {
  // Mock implementation since /api/users?role=staff doesn't exist
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        authors: [
          {
            _id: '1',
            name: 'Admin User',
            email: 'admin@fixithub.com',
            avatar: 'https://via.placeholder.com/40',
            bio: 'System Administrator and Content Manager',
            socialLinks: {
              twitter: '@fixithub',
              linkedin: 'fixithub',
              website: 'https://fixithub.com'
            },
            expertise: ['Device Repair', 'Technical Writing', 'Customer Support'],
            postCount: 5,
            totalViews: 1250,
            isActive: true,
            joinedAt: '2024-01-01T00:00:00.000Z'
          },
          {
            _id: '2',
            name: 'Tech Writer',
            email: 'writer@fixithub.com',
            avatar: 'https://via.placeholder.com/40',
            bio: 'Technical Content Specialist',
            socialLinks: {
              twitter: '@techwriter',
              website: 'https://techwriter.blog'
            },
            expertise: ['Technical Documentation', 'Repair Guides', 'Troubleshooting'],
            postCount: 12,
            totalViews: 3400,
            isActive: true,
            joinedAt: '2024-02-15T00:00:00.000Z'
          }
        ]
      });
    }, 500);
  });
  
  // Uncomment when backend route is implemented:
  // try {
  //   const response = await api.get('/api/users', { params: { role: 'staff' } });
  //   return { authors: response.data.users || [] };
  // } catch (error: any) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get blog comments with moderation
// Endpoint: GET /api/blog-posts/comments (not implemented yet)
// Request: { status?: string, postId?: string, page?: number, limit?: number }
// Response: { comments: BlogComment[], totalPages: number, currentPage: number }
export const getBlogComments = async (filters: any = {}) => {
  // Mock implementation for now since comments are not fully implemented
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        comments: [],
        totalPages: 0,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get editorial calendar events
// Endpoint: GET /api/blog-posts/calendar (not implemented yet)
// Request: { month?: string, year?: string }
// Response: { events: CalendarEvent[] }
export const getEditorialCalendar = async (filters: any = {}) => {
  // Mock implementation for now since calendar is not fully implemented
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ events: [] });
    }, 500);
  });
};

// Description: Create or update blog post
// Endpoint: POST /api/blog-posts
// Request: Partial<BlogPost>
// Response: { success: boolean, post: BlogPost }
export const createBlogPost = async (postData: Partial<BlogPost>) => {
  try {
    const response = await api.post('/api/blog-posts', postData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update blog post status
// Endpoint: PUT /api/blog-posts/:id/status
// Request: { status: string, reviewNotes?: string }
// Response: { success: boolean, message: string }
export const updatePostStatus = async (postId: string, status: string, reviewNotes?: string) => {
  try {
    const response = await api.put(`/api/blog-posts/${postId}/status`, { status, reviewNotes });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Moderate blog comment
// Endpoint: PUT /api/blog-posts/comments/:id/moderate (not implemented yet)
// Request: { status: string, notes?: string }
// Response: { success: boolean, message: string }
export const moderateComment = async (commentId: string, status: string, notes?: string) => {
  // Mock implementation for now
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
// Endpoint: POST /api/blog-posts/categories
// Request: Partial<BlogCategory>
// Response: { success: boolean, category: BlogCategory }
export const createCategory = async (categoryData: Partial<BlogCategory>) => {
  try {
    const response = await api.post('/api/blog-posts/categories', categoryData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create or update tag
// Endpoint: POST /api/blog-posts/tags
// Request: Partial<BlogTag>
// Response: { success: boolean, tag: BlogTag }
export const createTag = async (tagData: Partial<BlogTag>) => {
  try {
    const response = await api.post('/api/blog-posts/tags', tagData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update featured posts
// Endpoint: PUT /api/blog-posts/featured (not implemented yet)
// Request: { postIds: string[] }
// Response: { success: boolean, message: string }
export const updateFeaturedPosts = async (postIds: string[]) => {
  // Mock implementation for now
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
export const getBlogPosts = getAdminBlogPosts;

export const getBlogPost = async (id: string) => {
  try {
    const response = await api.get(`/api/blog-posts/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const toggleBlogPostLike = async (postId: string) => {
  try {
    const response = await api.post(`/api/blog-posts/${postId}/like`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};