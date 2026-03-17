import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getBlogPosts, BlogPost, BlogCategory } from "@/api/blog"
import {
  BookOpen,
  Search,
  Calendar,
  Clock,
  Heart,
  Eye,
  Filter,
  Sparkles,
  TrendingUp,
  ArrowRight
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from 'react-i18next'

export function Blog() {
  const { t } = useTranslation()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchBlogData = async () => {
      try {
        console.log("Fetching blog posts...")
        const response = await getBlogPosts()
        const data = response as any
        setPosts(data.posts || [])
        setCategories(data.categories || [])
        setFilteredPosts(data.posts || [])
      } catch (error) {
        console.error("Error fetching blog posts:", error)
        toast({
          title: t('common.error'),
          description: t('blogManagement.failedToLoadPosts'),
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBlogData()
  }, [toast, t])

  useEffect(() => {
    let filtered = posts

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.tags.some(tag => {
          const tagName = typeof tag === 'string' ? tag : tag.name;
          return tagName.toLowerCase().includes(searchTerm.toLowerCase());
        })
      )
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter(post => {
        const categoryName = typeof post.category === 'string' ? post.category : post.category?.name;
        return categoryName === categoryFilter;
      })
    }

    setFilteredPosts(filtered)
  }, [posts, searchTerm, categoryFilter])

  if (loading) {
    return (
      <div className="section">
        <div className="container">
          <div className="section-title">
            <h2>{t('blogPage.title')}</h2>
            <p>{t('blogPage.description') || 'Tipps & Wissenswertes rund um Ihr Gerät'}</p>
            <div className="accent-line"></div>
          </div>

          {/* Search and filters skeleton */}
          <div style={{ marginBottom: '32px', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', height: '40px', background: '#e5e5e5', borderRadius: '6px' }}></div>
              <div style={{ width: '180px', height: '40px', background: '#e5e5e5', borderRadius: '6px' }}></div>
            </div>
          </div>

          {/* Blog posts grid skeleton */}
          <div className="blog-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="blog-card" style={{ opacity: 0.5 }}>
                <div className="blog-card-image" style={{ background: 'white' }}>
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
      </div>
    )
  }

  return (
    <div className="section">
      <div className="container">
        {/* Header with design system styling */}
        <div className="section-title">
          <h2>{t('blogPage.title')}</h2>
          <p>{t('blogPage.description') || 'Tipps & Wissenswertes rund um Ihr Gerät'}</p>
          <div className="accent-line"></div>
        </div>

        {/* Search and Filters */}
        <div style={{ 
          marginBottom: '32px', 
          padding: '20px', 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          border: '1px solid #eceef3' 
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                width: '18px', 
                height: '18px', 
                color: '#8892a8' 
              }} />
              <Input
                placeholder={t('blogPage.searchPlaceholder') || 'Artikel durchsuchen...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '40px', height: '40px', border: '1px solid #d8dce6', borderRadius: '6px' }}
                className="bg-white"
              />
            </div>
            <div style={{ width: '180px' }}>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger style={{ height: '40px', border: '1px solid #d8dce6', borderRadius: '6px' }} className="bg-white">
                  <Filter style={{ width: '16px', height: '16px', marginRight: '8px', color: '#f5b800' }} />
                  <SelectValue placeholder={t('blogPage.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('blogPage.allCategories')}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category._id} value={category.name}>
                      {category.name} ({category.postCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Blog Posts Grid using design system */}
        <div className="blog-grid">
          {filteredPosts.map((post) => (
            <div 
              key={post._id} 
              className="blog-card"
              onClick={() => window.location.href = `/blog/${post._id}`}
            >
              <div 
                className="blog-card-image" 
                style={post.featuredImage ? {
                  backgroundImage: `url(${post.featuredImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : { background: 'white' }}
              >
                {!post.featuredImage && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <path d="M12 18h.01"></path>
                  </svg>
                )}
              </div>
              <div className="blog-card-body">
                <span className="blog-category">
                  {typeof post.category === 'string'
                    ? post.category
                    : post.category?.name || 'Allgemein'}
                </span>
                <h4>{post.title}</h4>
                <p>{post.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.72rem', color: '#8892a8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar style={{ width: '12px', height: '12px' }} />
                    <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>
                  <span>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    <span>{post.readTime} min</span>
                  </div>
                  <span>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye style={{ width: '12px', height: '12px' }} />
                    <span>{post.views}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <BookOpen style={{ width: '64px', height: '64px', margin: '0 auto 20px', color: '#8892a8' }} />
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#2d3748', marginBottom: '8px' }}>
              {t('blogPage.noArticles')}
            </h3>
            <p style={{ color: '#636e85', fontSize: '0.95rem' }}>
              {t('blogPage.noArticlesDesc')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
