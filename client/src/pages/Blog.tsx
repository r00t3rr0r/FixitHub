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
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70"></div>

        <div className="relative z-10 space-y-6 py-8 px-4 md:px-6 lg:px-8">
          {/* Header skeleton */}
          <div className="text-center space-y-2 mb-2">
            <div className="h-8 w-48 bg-white/20 backdrop-blur-sm rounded-lg animate-pulse mx-auto"></div>
            <div className="h-10 w-64 bg-white/20 backdrop-blur-sm rounded-lg animate-pulse mx-auto mt-3"></div>
            <div className="h-4 w-96 bg-white/20 backdrop-blur-sm rounded animate-pulse mx-auto"></div>
          </div>

          {/* Search and filters skeleton */}
          <Card className="border-0 shadow-lg bg-white/96 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 h-9 md:h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="sm:w-44 md:w-48 h-9 md:h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>

          {/* Featured post skeleton */}
          <Card className="border-0 shadow-lg bg-white/96 backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <div className="md:flex">
              <div className="md:w-1/2 h-56 md:h-80 bg-gray-200 animate-pulse"></div>
              <div className="md:w-1/2 p-6 md:p-8 space-y-3 md:space-y-4">
                <div className="h-5 bg-gray-200 rounded w-16 animate-pulse"></div>
                <div className="h-7 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded w-24 animate-pulse mt-4"></div>
              </div>
            </div>
          </Card>

          {/* Blog posts grid skeleton */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/96 backdrop-blur-md overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
                <div className="h-40 md:h-44 bg-gray-200 animate-pulse"></div>
                <CardHeader className="pb-2 pt-4">
                  <div className="h-5 bg-gray-200 rounded w-20 animate-pulse mb-2"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-full animate-pulse mt-2"></div>
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
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70"></div>

      {/* Content wrapper with relative positioning */}
      <div className="relative z-10 space-y-6 py-8 px-4 md:px-6 lg:px-8">
        {/* Header with enhanced contrast and spacing */}
        <div className="text-center space-y-2 mb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-yellow-400" />
            <span className="text-sm md:text-base font-semibold text-yellow-300 tracking-widest uppercase">
              {t('blogPage.subtitle')}
            </span>
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-yellow-400" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl tracking-tight">
            {t('blogPage.title')}
          </h1>
          <p className="text-sm md:text-base text-white/80 drop-shadow-lg max-w-2xl mx-auto">
            {t('blogPage.description') || 'Discover expert insights, repair guides, and the latest technology trends'}
          </p>
        </div>

        {/* Search and Filters Card with enhanced glass effect */}
        <Card className="border-0 shadow-lg bg-white/96 backdrop-blur-md hover:shadow-yellow-500/15 transition-all duration-300 overflow-hidden sticky top-20 z-20">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-md"></div>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-500 group-hover:text-yellow-600 transition-colors duration-200" />
                  <Input
                    placeholder={t('blogPage.searchPlaceholder') || 'Search articles...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 md:pl-10 h-9 md:h-10 border-gray-300 focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200 bg-white shadow-sm text-sm md:text-base"
                  />
                </div>
              </div>
              <div className="sm:w-44 md:w-48">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 md:h-10 border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white shadow-sm text-sm md:text-base">
                    <Filter className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2 text-yellow-600" />
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
          <Card className="group border-0 shadow-2xl bg-white/97 backdrop-blur-md hover:shadow-yellow-500/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-lg"></div>
            <div className="md:flex">
              <div className="md:w-1/2 relative overflow-hidden bg-gray-200 min-h-80">
                <img
                  src={filteredPosts[0].featuredImage}
                  alt={filteredPosts[0].title}
                  className="w-full h-64 md:h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/20 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-yellow-500 border-0 shadow-xl text-gray-900 font-bold px-3 py-1.5 text-xs md:text-sm">
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  Featured
                </Badge>
              </div>
              <div className="md:w-1/2 p-6 md:p-8 space-y-3 md:space-y-4 flex flex-col justify-between">
                <div className="space-y-3 md:space-y-4">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 font-bold shadow-lg px-3 py-1 text-xs md:text-sm w-fit">
                    {typeof filteredPosts[0].category === 'string'
                      ? filteredPosts[0].category
                      : filteredPosts[0].category?.name || 'Uncategorized'}
                  </Badge>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 group-hover:text-yellow-600 transition-colors duration-300 line-clamp-3">
                    <Link to={`/blog/${filteredPosts[0]._id}`}>
                      {filteredPosts[0].title}
                    </Link>
                  </h2>
                  <p className="text-gray-700 text-sm md:text-base leading-relaxed line-clamp-3">
                    {filteredPosts[0].excerpt}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9 md:w-10 md:h-10 ring-2 ring-yellow-400 ring-offset-2">
                        <AvatarImage src={filteredPosts[0].author.avatar} />
                        <AvatarFallback className="bg-yellow-400 text-gray-900 font-bold text-xs md:text-sm">
                          {filteredPosts[0].author.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-xs md:text-sm font-bold text-gray-900 block">
                          {filteredPosts[0].author.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-yellow-600" />
                            {new Date(filteredPosts[0].publishedAt || filteredPosts[0].createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-yellow-600" />
                            {filteredPosts[0].readTime} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-yellow-300 text-sm md:text-base h-10 md:h-11"
                  >
                    <Link to={`/blog/${filteredPosts[0]._id}`}>
                      {t('blogPage.readMore')}
                      <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Blog Posts Grid with enhanced cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.slice(1).map((post, index) => (
            <Card
              key={post._id}
              className="group border-0 shadow-lg bg-white/96 backdrop-blur-md hover:shadow-yellow-500/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              style={{
                animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`
              }}
            >
              {/* Enhanced gradient top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-md"></div>

              <div className="relative overflow-hidden bg-gray-200">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-40 md:h-44 object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Enhanced hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/15 group-hover:via-transparent group-hover:to-transparent transition-all duration-700"></div>
              </div>

              <CardHeader className="pb-2 pt-4">
                <div className="space-y-2 mb-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-yellow-50 text-yellow-800 border-yellow-300 font-semibold shadow-sm text-xs px-2 py-0.5"
                    >
                      {typeof post.category === 'string'
                        ? post.category
                        : post.category?.name || 'Uncategorized'}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3 text-yellow-600" />
                        {post.views}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className={`h-3 w-3 ${post.isLiked ? 'fill-red-500 text-red-500' : 'text-yellow-600'}`} />
                        {post.likes}
                      </span>
                    </div>
                  </div>
                </div>
                <CardTitle className="line-clamp-2 group-hover:text-yellow-600 transition-colors duration-300 font-bold text-base md:text-lg leading-snug">
                  <Link to={`/blog/${post._id}`}>
                    {post.title}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2 text-gray-700 font-medium text-xs md:text-sm leading-relaxed mt-1">
                  {post.excerpt}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 ring-1.5 ring-yellow-400 flex-shrink-0">
                      <AvatarImage src={post.author.avatar} />
                      <AvatarFallback className="text-xs bg-yellow-400 text-gray-900 font-bold">
                        {post.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {post.author.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5 text-yellow-600" />
                          {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5 text-yellow-600" />
                          {post.readTime}m
                        </span>
                      </div>
                    </div>
                  </div>

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={typeof tag === 'string' ? tag : tag._id}
                          variant="outline"
                          className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200 shadow-sm px-2 py-0.5"
                        >
                          {typeof tag === 'string' ? tag : tag.name}
                        </Badge>
                      ))}
                      {post.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 bg-gray-50 px-2 py-0.5">
                          +{post.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800 hover:border-yellow-500 transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-xs mt-2"
                >
                  <Link to={`/blog/${post._id}`}>
                    {t('blogPage.readArticle')}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="col-span-full">
            <Card className="border-0 shadow-lg bg-white/96 backdrop-blur-md overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
              <CardContent className="text-center py-16 space-y-4">
                <div className="relative inline-block">
                  <BookOpen className="h-20 w-20 md:h-24 md:w-24 mx-auto text-gray-400" />
                  <div className="absolute inset-0 bg-yellow-400/20 blur-2xl rounded-full animate-pulse"></div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900">{t('blogPage.noArticles')}</h3>
                  <p className="text-gray-700 text-sm md:text-base font-medium max-w-md mx-auto">
                    {t('blogPage.noArticlesDesc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Enhanced Benefits section */}
        {filteredPosts.length > 0 && (
          <div className="pt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: BookOpen,
                  title: t('blogPage.benefit1Title') || "Expert Insights",
                  description: t('blogPage.benefit1Desc') || "Professional device repair tips",
                  color: "from-blue-500 to-blue-600"
                },
                {
                  icon: Sparkles,
                  title: t('blogPage.benefit2Title') || "Latest Updates",
                  description: t('blogPage.benefit2Desc') || "Stay informed about tech trends",
                  color: "from-yellow-500 to-yellow-600"
                },
                {
                  icon: TrendingUp,
                  title: t('blogPage.benefit3Title') || "Trending Topics",
                  description: t('blogPage.benefit3Desc') || "Popular repair guides & news",
                  color: "from-green-500 to-green-600"
                }
              ].map((benefit, index) => (
                <Card
                  key={index}
                  className="border-0 shadow-md bg-white/96 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
                  style={{
                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 shadow-md"></div>
                  <CardContent className="pt-6 text-center space-y-3">
                    <div className="relative inline-block">
                      <div className={`w-16 h-16 bg-gradient-to-br ${benefit.color} rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <benefit.icon className="h-8 w-8 text-white drop-shadow-lg" />
                      </div>
                      <div className={`absolute inset-0 bg-gradient-to-br ${benefit.color} blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 rounded-full`}></div>
                    </div>
                    <div>
                      <h3 className="font-bold text-base md:text-lg text-gray-900">{benefit.title}</h3>
                      <p className="text-xs md:text-sm text-gray-600 font-medium mt-1 leading-relaxed">{benefit.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
