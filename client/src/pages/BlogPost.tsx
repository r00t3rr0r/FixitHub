import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getBlogPost, toggleBlogPostLike, BlogPost as BlogPostType } from "@/api/blog"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Heart,
  Eye,
  Share2,
  User,
  Sparkles,
  TrendingUp
} from "lucide-react"

export function BlogPostPage() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<BlogPostType | null>(null)
  const [loading, setLoading] = useState(true)
  const [liking, setLiking] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return

      try {
        console.log("Fetching blog post:", id)
        const response = await getBlogPost(id)
        setPost((response as any).post)
      } catch (error) {
        console.error("Error fetching blog post:", error)
        toast({
          title: "Error",
          description: "Failed to load blog post",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id, toast])

  const handleLike = async () => {
    if (!post || !id) return

    try {
      setLiking(true)
      console.log("Toggling like for post:", id)
      const response = await toggleBlogPostLike(id)
      const data = response as any

      setPost({
        ...post,
        isLiked: data.isLiked,
        likes: data.likes
      })

      toast({
        title: data.isLiked ? "Liked!" : "Unliked",
        description: data.isLiked ? "Added to your liked posts" : "Removed from liked posts"
      })
    } catch (error: any) {
      console.error("Error toggling like:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive"
      })
    } finally {
      setLiking(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt,
          url: window.location.href
        })
      } catch (error) {
        console.log("Error sharing:", error)
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Link copied!",
        description: "Article link has been copied to clipboard"
      })
    }
  }

  if (loading) {
    return (
      <div className="section">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ height: '40px', width: '120px', background: '#e5e5e5', borderRadius: '6px', marginBottom: '24px' }}></div>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '300px', background: '#e5e5e5' }}></div>
            <div style={{ padding: '32px' }}>
              <div style={{ height: '32px', background: '#e5e5e5', borderRadius: '6px', marginBottom: '16px', width: '75%' }}></div>
              <div style={{ height: '20px', background: '#e5e5e5', borderRadius: '6px', marginBottom: '24px', width: '50%' }}></div>
              <div style={{ height: '16px', background: '#e5e5e5', borderRadius: '6px', marginBottom: '12px' }}></div>
              <div style={{ height: '16px', background: '#e5e5e5', borderRadius: '6px', marginBottom: '12px' }}></div>
              <div style={{ height: '16px', background: '#e5e5e5', borderRadius: '6px', width: '80%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="section">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '60px 40px', textAlign: 'center' }}>
            <Sparkles style={{ width: '64px', height: '64px', margin: '0 auto 20px', color: '#f5b800' }} />
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#2d3748', marginBottom: '12px' }}>Artikel nicht gefunden</h3>
            <p style={{ color: '#636e85', fontSize: '0.95rem', marginBottom: '24px' }}>
              Der gesuchte Blog-Artikel existiert nicht
            </p>
            <Button
              asChild
              style={{ background: '#f5b800', color: '#1a2a5e', fontWeight: '700', border: 'none' }}
              className="hover:opacity-90 transition-opacity"
            >
              <Link to="/blog">
                <ArrowLeft style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Zurück zum Blog
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Back Button */}
        <Button
          variant="ghost"
          asChild
          style={{ marginBottom: '24px', background: 'white', border: '1px solid #eceef3', fontWeight: '600' }}
          className="hover:bg-gray-50 transition-colors"
        >
          <Link to="/blog">
            <ArrowLeft style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Zurück zum Blog
          </Link>
        </Button>

        {/* Article */}
        <article>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #eceef3' }}>

            {/* Featured Image */}
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <img
                src={post.featuredImage}
                alt={post.title}
                style={{ width: '100%', height: '400px', objectFit: 'cover' }}
              />
            </div>

            {/* Header Section */}
            <div style={{ padding: '32px' }}>
              {/* Category and Meta */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <Badge style={{ background: '#f5b800', color: '#1a2a5e', fontWeight: '700', padding: '6px 12px', fontSize: '0.75rem' }}>
                  {post.category?.name || 'Allgemein'}
                </Badge>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: '#636e85' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye style={{ width: '16px', height: '16px', color: '#f5b800' }} />
                    {post.views} Aufrufe
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Heart style={{ width: '16px', height: '16px', color: post.isLiked ? '#ef4444' : '#f5b800', fill: post.isLiked ? '#ef4444' : 'none' }} />
                    {post.likes} Likes
                  </span>
                </div>
              </div>

              {/* Title */}
              <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#2d3748', marginBottom: '24px', lineHeight: '1.2' }}>
                {post.title}
              </h1>

              {/* Author and Date */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingTop: '20px', paddingBottom: '20px', borderTop: '2px solid #eceef3', borderBottom: '2px solid #eceef3', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Avatar style={{ width: '56px', height: '56px' }}>
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback style={{ background: '#f5b800', color: '#1a2a5e', fontWeight: '700', fontSize: '1.1rem' }}>
                      {post.author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '1rem', color: '#2d3748' }}>{post.author.name}</p>
                    <p style={{ fontSize: '0.85rem', color: '#636e85' }}>
                      {post.author.bio}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#636e85' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Calendar style={{ width: '16px', height: '16px', color: '#f5b800' }} />
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString('de-DE')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock style={{ width: '16px', height: '16px', color: '#f5b800' }} />
                    {post.readTime} min Lesezeit
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <Button
                  size="sm"
                  onClick={handleLike}
                  disabled={liking}
                  style={{ 
                    background: post.isLiked ? '#f5b800' : 'white',
                    color: post.isLiked ? '#1a2a5e' : '#636e85',
                    border: '1px solid #f5b800',
                    fontWeight: '700'
                  }}
                  className="hover:opacity-90 transition-opacity"
                >
                  <Heart style={{ width: '16px', height: '16px', marginRight: '8px', fill: post.isLiked ? 'currentColor' : 'none' }} />
                  {liking ? "..." : post.isLiked ? "Geliked" : "Liken"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  style={{ border: '1px solid #d8dce6', color: '#636e85', fontWeight: '700' }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <Share2 style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                  Teilen
                </Button>
              </div>

              {/* Content */}
              <div
                className="prose prose-lg max-w-none"
                style={{ color: '#636e85', lineHeight: '1.7' }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Tags */}
              <div style={{ paddingTop: '32px', borderTop: '2px solid #eceef3', marginTop: '32px' }}>
                <h4 style={{ fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2d3748', fontSize: '1rem' }}>
                  <Sparkles style={{ width: '18px', height: '18px', color: '#f5b800' }} />
                  Tags
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {post.tags.map((tag) => (
                    <Badge
                      key={typeof tag === 'string' ? tag : tag._id}
                      variant="outline"
                      style={{ fontSize: '0.8rem', border: '1px solid #f5b800', color: '#636e85', background: '#fffbf0', padding: '4px 12px' }}
                    >
                      {typeof tag === 'string' ? tag : tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Author Bio */}
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #eceef3', marginTop: '24px', padding: '32px' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#2d3748', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: '#f5b800', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User style={{ width: '20px', height: '20px', color: '#1a2a5e' }} />
            </div>
            Über den Autor
          </h3>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Avatar style={{ width: '80px', height: '80px', flexShrink: 0 }}>
              <AvatarImage src={post.author.avatar} />
              <AvatarFallback style={{ background: '#f5b800', color: '#1a2a5e', fontWeight: '700', fontSize: '1.5rem' }}>
                {post.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 style={{ fontWeight: '700', fontSize: '1.2rem', color: '#2d3748', marginBottom: '8px' }}>{post.author.name}</h4>
              <p style={{ color: '#636e85', fontSize: '0.95rem' }}>{post.author.bio}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
