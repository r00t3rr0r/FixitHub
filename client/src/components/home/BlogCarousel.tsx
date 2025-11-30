import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, User, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getBlogPosts } from '@/api/blog';
import { useToast } from '@/hooks/useToast';

interface BlogPost {
  _id: string;
  title: string;
  excerpt?: string;
  content?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  image?: string;
  category?: string;
  publishedAt?: string;
  views?: number;
  readTime?: number;
}

interface BlogCarouselProps {
  title?: string;
  maxItems?: number;
  posts?: BlogPost[];
}

export function BlogCarousel({ title, maxItems = 3, posts: initialPosts }: BlogCarouselProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts || []);
  const [loading, setLoading] = useState(!initialPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { toast: showToast } = useToast();

  useEffect(() => {
    if (!initialPosts) {
      fetchBlogPosts();
    }
  }, [initialPosts]);

  const fetchBlogPosts = async () => {
    try {
      setLoading(true);
      const response = await getBlogPosts({ limit: maxItems, page: 1 });
      setPosts(response.posts || []);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      showToast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load blog posts'
      });
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, posts.length - 2));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(1, posts.length - 2)) % Math.max(1, posts.length - 2));
  };

  if (loading) {
    return (
      <section className="relative py-20 overflow-hidden bg-white">
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-yellow-400 border-t-gray-900 rounded-full"></div>
          <p className="text-gray-600 mt-4">{t('common.loading')}</p>
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  const visiblePosts = posts.slice(currentIndex, currentIndex + 3);

  return (
    <section className="relative py-24 overflow-hidden bg-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 animate-slideIn">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title || t('home.blog.title')}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full mb-4"></div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('home.blog.subtitle')}
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {visiblePosts.map((post, index) => (
              <div
                key={post._id}
                className="animate-scaleIn group"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <Card className="h-full overflow-hidden bg-white border border-gray-200 hover:border-yellow-400/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  {/* Featured Image */}
                  {post.image && (
                    <div className="relative h-40 bg-gray-200 overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                      />
                      {post.category && (
                        <Badge className="absolute top-4 right-4 bg-yellow-400 text-gray-900">
                          {post.category}
                        </Badge>
                      )}
                    </div>
                  )}

                  <CardHeader>
                    {/* Title */}
                    <CardTitle className="line-clamp-2 hover:text-yellow-500 transition-colors text-gray-900">
                      {post.title}
                    </CardTitle>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                      {post.publishedAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(post.publishedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {post.readTime && (
                        <span>{post.readTime} {t('home.blog.minRead')}</span>
                      )}
                      {post.views && (
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{post.views}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Author */}
                    {post.author && (
                      <div className="flex items-center gap-3 mb-4 pt-4 border-t border-gray-200">
                        {post.author.avatar && (
                          <img
                            src={post.author.avatar}
                            alt={post.author.name}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {post.author.name}
                          </p>
                        </div>
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}

                    {/* Read More Button */}
                    <Button
                      variant="outline"
                      className="w-full border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-gray-900 font-semibold transition-all duration-300 hover:scale-105"
                      asChild
                    >
                      <Link to={`/blog/${post._id}`}>{t('home.blog.readMore')}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          {posts.length > 3 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-all duration-300 hover:scale-110 shadow-lg"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute -right-6 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-all duration-300 hover:scale-110 shadow-lg"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Indicators */}
          <div className="flex justify-center gap-2 mt-8 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            {Array.from({ length: Math.max(1, posts.length - 2) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'bg-yellow-400 w-8' : 'bg-gray-300 w-2'
                }`}
              />
            ))}
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-12 animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
          <Button
            size="lg"
            variant="outline"
            className="border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-gray-900 font-semibold"
            asChild
          >
            <Link to="/blog">{t('home.blog.viewAll')}</Link>
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-30px);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.6s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
