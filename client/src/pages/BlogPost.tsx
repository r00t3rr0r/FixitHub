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
  User
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
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <div className="h-64 bg-muted rounded-t"></div>
          <CardHeader>
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">Post not found</h3>
            <p className="text-muted-foreground mb-4">
              The blog post you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link to="/blog">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Blog
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/blog">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blog
        </Link>
      </Button>

      {/* Article */}
      <article>
        <Card>
          {/* Featured Image */}
          <div className="overflow-hidden rounded-t-lg">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-64 md:h-96 object-cover"
            />
          </div>

          <CardHeader className="space-y-4">
            {/* Category and Meta */}
            <div className="flex items-center justify-between">
              <Badge>{post.category?.name || 'Uncategorized'}</Badge>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {post.views} views
                </span>
                <span className="flex items-center gap-1">
                  <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  {post.likes} likes
                </span>
              </div>
            </div>

            {/* Title */}
            <CardTitle className="text-3xl md:text-4xl leading-tight">
              {post.title}
            </CardTitle>

            {/* Author and Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={post.author.avatar} />
                  <AvatarFallback>
                    {post.author.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{post.author.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {post.author.bio}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {post.readTime} min read
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                variant={post.isLiked ? "default" : "outline"}
                size="sm"
                onClick={handleLike}
                disabled={liking}
              >
                <Heart className={`h-4 w-4 mr-2 ${post.isLiked ? 'fill-current' : ''}`} />
                {liking ? "..." : post.isLiked ? "Liked" : "Like"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Content */}
            <div
              className="prose prose-gray dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            <div className="pt-6 border-t">
              <h4 className="font-semibold mb-3">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={typeof tag === 'string' ? tag : tag._id} variant="outline">
                    {typeof tag === 'string' ? tag : tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </article>

      {/* Author Bio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            About the Author
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={post.author.avatar} />
              <AvatarFallback>
                {post.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold text-lg">{post.author.name}</h4>
              <p className="text-muted-foreground">{post.author.bio}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}