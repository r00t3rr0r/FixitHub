import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBlogPosts, type BlogPost } from '@/api/blog';

export function BlogSection() {
  const navigate = useNavigate();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const response = await getBlogPosts({ 
          status: 'published', 
          limit: 3,
          page: 1
        });
        setBlogPosts(response.posts || []);
      } catch (error) {
        console.error('Failed to fetch blog posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  const handleBlogClick = (slug: string) => {
    navigate(`/blog/${slug}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="section-title">
          <h2>Neueste Blogartikel</h2>
          <p>Tipps & Wissenswertes rund um Ihr Gerät</p>
          <div className="accent-line"></div>
        </div>
        <div className="blog-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="blog-card" style={{ opacity: 0.5 }}>
              <div className="blog-card-image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                </svg>
              </div>
              <div className="blog-card-body">
                <span className="blog-category">Laden...</span>
                <h4>Blogartikel wird geladen...</h4>
                <p>Bitte warten Sie einen Moment.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (blogPosts.length === 0) {
    return (
      <div className="container">
        <div className="section-title">
          <h2>Neueste Blogartikel</h2>
          <p>Tipps & Wissenswertes rund um Ihr Gerät</p>
          <div className="accent-line"></div>
        </div>
        <div className="blog-grid">
          <div className="blog-card">
            <div className="blog-card-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <path d="M12 18h.01"></path>
              </svg>
            </div>
            <div className="blog-card-body">
              <span className="blog-category">Info</span>
              <h4>Bald verfügbar</h4>
              <p>Wir bereiten interessante Blogartikel für Sie vor.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="section-title">
        <h2>Neueste Blogartikel</h2>
        <p>Tipps & Wissenswertes rund um Ihr Gerät</p>
        <div className="accent-line"></div>
      </div>
      <div className="blog-grid">
        {blogPosts.map((post) => (
          <div 
            key={post._id} 
            className="blog-card"
            onClick={() => handleBlogClick(post.slug)}
          >
            <div className="blog-card-image" style={post.featuredImage ? {
              backgroundImage: `url(${post.featuredImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {}}>
              {!post.featuredImage && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <path d="M12 18h.01"></path>
                </svg>
              )}
            </div>
            <div className="blog-card-body">
              <span className="blog-category">{post.category?.name || 'Allgemein'}</span>
              <h4>{post.title}</h4>
              <p>{post.excerpt}</p>
              <span className="blog-date">{formatDate(post.publishedAt || post.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
