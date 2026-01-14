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
      <div
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{
          backgroundImage: "url('https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg')"
        }}
      >
        {/* Dark overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>

        <div className="relative z-10 space-y-8">
          {/* Header skeleton */}
          <div className="text-center space-y-4">
            <div className="h-14 w-96 bg-white/20 backdrop-blur-sm rounded-lg animate-pulse mx-auto"></div>
            <div className="h-6 w-[600px] bg-white/20 backdrop-blur-sm rounded animate-pulse mx-auto"></div>
          </div>

          {/* Search and filters skeleton */}
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="sm:w-48 h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>

          {/* Featured post skeleton */}
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <div className="md:flex">
              <div className="md:w-1/2 h-64 md:h-96 bg-gray-200 animate-pulse"></div>
              <div className="md:w-1/2 p-8 space-y-4">
                <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
              </div>
            </div>
          </Card>

          {/* Blog posts grid skeleton */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <div className="h-48 bg-gray-200 animate-pulse"></div>
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
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
      <div className="relative z-10 space-y-8">
        {/* Header with enhanced contrast */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl">
            {t('blogPage.title')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-lg flex items-center justify-center gap-3">
            <Sparkles className="h-6 w-6 text-yellow-400" />
            {t('blogPage.subtitle')}
          </p>
        </div>

        {/* Search and Filters Card with enhanced glass effect */}
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-hover:text-yellow-600 transition-colors duration-200" />
                  <Input
                    placeholder={t('blogPage.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200 bg-white shadow-sm"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm">
                    <Filter className="h-4 w-4 mr-2 text-yellow-600" />
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
          </CardContent>
        </Card>

        {/* Featured Post with enhanced styling */}
        {filteredPosts.length > 0 && (
          <Card className="group border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
            <div className="md:flex">
              <div className="md:w-1/2 relative overflow-hidden">
                <img
                  src={filteredPosts[0].featuredImage}
                  alt={filteredPosts[0].title}
                  className="w-full h-64 md:h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/20 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-yellow-500 border-0 shadow-xl text-gray-900 font-bold px-4 py-2 text-sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Featured
                </Badge>
              </div>
              <div className="md:w-1/2 p-8 space-y-4">
                <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 font-bold shadow-lg px-3 py-1">
                  {typeof filteredPosts[0].category === 'string'
                    ? filteredPosts[0].category
                    : filteredPosts[0].category?.name || 'Uncategorized'}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 group-hover:text-yellow-600 transition-colors duration-300">
                  <Link to={`/blog/${filteredPosts[0]._id}`}>
                    {filteredPosts[0].title}
                  </Link>
                </h2>
                <p className="text-gray-700 text-lg font-medium line-clamp-3">
                  {filteredPosts[0].excerpt}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-yellow-400 ring-offset-2">
                      <AvatarImage src={filteredPosts[0].author.avatar} />
                      <AvatarFallback className="bg-yellow-400 text-gray-900 font-bold">
                        {filteredPosts[0].author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-bold text-gray-900">
                      {filteredPosts[0].author.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-700 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-yellow-600" />
                      {new Date(filteredPosts[0].publishedAt || filteredPosts[0].createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      {filteredPosts[0].readTime} min
                    </span>
                  </div>
                </div>
                <Button
                  asChild
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 border border-yellow-300"
                >
                  <Link to={`/blog/${filteredPosts[0]._id}`}>
                    {t('blogPage.readMore')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Blog Posts Grid with enhanced cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.slice(1).map((post, index) => (
            <Card
              key={post._id}
              className="group border-0 shadow-2xl bg-white/95 backdrop-blur-md hover:shadow-yellow-500/30 hover:scale-105 transition-all duration-300 overflow-hidden"
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.06}s both`
              }}
            >
              {/* Enhanced gradient top border */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>

              <div className="relative overflow-hidden">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-125"
                />
                {/* Enhanced hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/20 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
              </div>

              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant="secondary"
                    className="bg-yellow-50 text-yellow-800 border-yellow-400 font-bold shadow-sm"
                  >
                    {typeof post.category === 'string'
                      ? post.category
                      : post.category?.name || 'Uncategorized'}
                  </Badge>
                  <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4 text-yellow-600" />
                      {post.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-red-500 text-red-500' : 'text-yellow-600'}`} />
                      {post.likes}
                    </span>
                  </div>
                </div>
                <CardTitle className="line-clamp-2 group-hover:text-yellow-600 transition-colors duration-300 font-bold text-xl">
                  <Link to={`/blog/${post._id}`}>
                    {post.title}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-3 text-gray-700 font-medium">
                  {post.excerpt}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 ring-2 ring-yellow-400">
                      <AvatarImage src={post.author.avatar} />
                      <AvatarFallback className="text-xs bg-yellow-400 text-gray-900 font-bold">
                        {post.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-700 font-bold">
                      {post.author.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-700 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-yellow-600" />
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-yellow-600" />
                    {post.readTime} {t('blogPage.minRead')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {post.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={typeof tag === 'string' ? tag : tag._id}
                      variant="outline"
                      className="text-xs border-yellow-400 text-yellow-800 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200 shadow-sm"
                    >
                      {typeof tag === 'string' ? tag : tag.name}
                    </Badge>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800 hover:border-yellow-500 transition-all duration-200 font-bold shadow-sm hover:shadow-md hover:scale-105"
                >
                  <Link to={`/blog/${post._id}`}>
                    {t('blogPage.readArticle')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="col-span-full">
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
              <CardContent className="text-center py-16">
                <div className="relative inline-block">
                  <BookOpen className="h-24 w-24 mx-auto mb-4 text-gray-400" />
                  <div className="absolute inset-0 bg-yellow-400/30 blur-2xl rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-2xl font-semibold mb-2 text-gray-900">{t('blogPage.noArticles')}</h3>
                <p className="text-gray-700 text-lg font-medium">
                  {t('blogPage.noArticlesDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Enhanced Benefits section */}
        {filteredPosts.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3 mt-8">
            {[
              {
                icon: BookOpen,
                title: "Expert Insights",
                description: "Professional device repair tips",
                color: "from-blue-500 to-blue-600"
              },
              {
                icon: Sparkles,
                title: "Latest Updates",
                description: "Stay informed about tech trends",
                color: "from-yellow-500 to-yellow-600"
              },
              {
                icon: TrendingUp,
                title: "Trending Topics",
                description: "Popular repair guides & news",
                color: "from-green-500 to-green-600"
              }
            ].map((benefit, index) => (
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
                    <div className={`w-20 h-20 bg-gradient-to-br ${benefit.color} rounded-full flex items-center justify-center mx-auto shadow-2xl group-hover:scale-125 transition-transform duration-500`}>
                      <benefit.icon className="h-10 w-10 text-white drop-shadow-lg" />
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-br ${benefit.color} blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full`}></div>
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-base text-gray-700 font-medium">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
