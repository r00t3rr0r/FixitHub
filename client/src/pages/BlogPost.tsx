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
      <div
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{
          backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
        }}
      >
        {/* Dark overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

        <div className="relative z-10 max-w-5xl mx-auto space-y-6">
          <div className="h-10 w-32 bg-white/20 backdrop-blur-sm rounded animate-pulse"></div>
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden animate-pulse">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <div className="h-64 md:h-96 bg-gray-200 rounded-t"></div>
            <CardHeader>
              <div className="h-10 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{
          backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="text-center py-16">
              <Sparkles className="h-24 w-24 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-2xl font-bold mb-2 text-gray-900">Post not found</h3>
              <p className="text-gray-700 mb-6 text-lg font-medium">
                The blog post you're looking for doesn't exist
              </p>
              <Button
                asChild
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 border border-yellow-300"
              >
                <Link to="/blog">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Blog
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
      }}
    >
      {/* Dark overlay with gradient for better content visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

      {/* Content wrapper with relative positioning */}
      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        {/* Back Button with enhanced styling */}
        <Button
          variant="ghost"
          asChild
          className="bg-white/90 hover:bg-white backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 font-bold border border-yellow-400"
        >
          <Link to="/blog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>
        </Button>

        {/* Article with enhanced styling */}
        <article>
          <Card className="group border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>

            {/* Featured Image with enhanced hover effect */}
            <div className="relative overflow-hidden">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-64 md:h-96 object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/10 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
            </div>

            <CardHeader className="space-y-4 p-8">
              {/* Category and Meta */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 font-bold shadow-lg px-4 py-2 text-sm">
                  {post.category?.name || 'Uncategorized'}
                </Badge>
                <div className="flex items-center gap-6 text-sm text-gray-700 font-medium">
                  <span className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                    <Eye className="h-4 w-4 text-yellow-600" />
                    {post.views} views
                  </span>
                  <span className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                    <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-red-500 text-red-500' : 'text-yellow-600'}`} />
                    {post.likes} likes
                  </span>
                </div>
              </div>

              {/* Title with enhanced typography */}
              <CardTitle className="text-4xl md:text-5xl leading-tight font-bold text-gray-900">
                {post.title}
              </CardTitle>

              {/* Author and Date with enhanced styling */}
              <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t-2 border-yellow-400/30">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 ring-4 ring-yellow-400 ring-offset-2 shadow-lg">
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback className="bg-yellow-400 text-gray-900 font-bold text-lg">
                      {post.author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-lg text-gray-900">{post.author.name}</p>
                    <p className="text-sm text-gray-700 font-medium">
                      {post.author.bio}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-700 font-medium">
                  <div className="flex items-center gap-2 mb-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                    <Calendar className="h-4 w-4 text-yellow-600" />
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    {post.readTime} min read
                  </div>
                </div>
              </div>

              {/* Actions with enhanced buttons */}
              <div className="flex items-center gap-3 pt-4 border-t-2 border-yellow-400/30">
                <Button
                  variant={post.isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={liking}
                  className={`${
                    post.isLiked
                      ? "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 border-yellow-300"
                      : "border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                  } font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110`}
                >
                  <Heart className={`h-4 w-4 mr-2 ${post.isLiked ? 'fill-current' : ''}`} />
                  {liking ? "..." : post.isLiked ? "Liked" : "Like"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-8">
              {/* Content with enhanced typography */}
              <div
                className="prose prose-lg prose-gray dark:prose-invert max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:font-medium prose-a:text-yellow-600 prose-a:font-semibold prose-strong:text-gray-900 prose-strong:font-bold"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Tags with enhanced styling */}
              <div className="pt-8 border-t-2 border-yellow-400/30">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-gray-900 text-lg">
                  <Sparkles className="h-5 w-5 text-yellow-600" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Badge
                      key={typeof tag === 'string' ? tag : tag._id}
                      variant="outline"
                      className="text-sm border-yellow-400 text-yellow-800 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200 shadow-sm font-bold px-3 py-1"
                    >
                      {typeof tag === 'string' ? tag : tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </article>

        {/* Author Bio with enhanced styling */}
        <Card className="group border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <User className="h-6 w-6 text-gray-900" />
              </div>
              About the Author
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex gap-6">
              <Avatar className="w-20 h-20 ring-4 ring-yellow-400 ring-offset-2 shadow-xl flex-shrink-0">
                <AvatarImage src={post.author.avatar} />
                <AvatarFallback className="bg-yellow-400 text-gray-900 font-bold text-2xl">
                  {post.author.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-bold text-2xl text-gray-900 mb-2">{post.author.name}</h4>
                <p className="text-gray-700 text-lg font-medium">{post.author.bio}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: "Popular Posts",
              description: "Check out trending articles",
              color: "from-purple-500 to-purple-600"
            },
            {
              icon: Sparkles,
              title: "Latest Updates",
              description: "Stay informed with new content",
              color: "from-yellow-500 to-yellow-600"
            },
            {
              icon: Heart,
              title: "Share & Like",
              description: "Support quality content",
              color: "from-red-500 to-red-600"
            }
          ].map((info, index) => (
            <Card
              key={index}
              className="border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/30 transition-all duration-300 hover:scale-110 overflow-hidden group"
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.15}s both`
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
              <CardContent className="pt-6 text-center">
                <div className="relative inline-block mb-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${info.color} rounded-full flex items-center justify-center mx-auto shadow-2xl group-hover:scale-125 transition-transform duration-500`}>
                    <info.icon className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-br ${info.color} blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full`}></div>
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-1">{info.title}</h3>
                <p className="text-sm text-gray-700 font-medium">{info.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Enhanced custom animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
