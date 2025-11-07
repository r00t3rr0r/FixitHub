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
  User,
  Heart,
  Eye,
  Filter
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
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t"></div>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">{t('blogPage.title')}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('blogPage.subtitle')}
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('blogPage.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
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

      {/* Featured Post */}
      {filteredPosts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2">
              <img
                src={filteredPosts[0].featuredImage}
                alt={filteredPosts[0].title}
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
            <div className="md:w-1/2 p-6">
              <Badge className="mb-3">
                {typeof filteredPosts[0].category === 'string' 
                  ? filteredPosts[0].category 
                  : filteredPosts[0].category?.name || 'Uncategorized'}
              </Badge>
              <h2 className="text-2xl font-bold mb-3">
                <Link
                  to={`/blog/${filteredPosts[0]._id}`}
                  className="hover:text-primary transition-colors"
                >
                  {filteredPosts[0].title}
                </Link>
              </h2>
              <p className="text-muted-foreground mb-4">
                {filteredPosts[0].excerpt}
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={filteredPosts[0].author.avatar} />
                    <AvatarFallback>
                      {filteredPosts[0].author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {filteredPosts[0].author.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(filteredPosts[0].publishedAt || filteredPosts[0].createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {filteredPosts[0].readTime} min read
                  </span>
                </div>
              </div>
              <Button asChild>
                <Link to={`/blog/${filteredPosts[0]._id}`}>
                  {t('blogPage.readMore')}
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Blog Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPosts.slice(1).map((post) => (
          <Card key={post._id} className="group hover:shadow-lg transition-all duration-200">
            <div className="overflow-hidden rounded-t-lg">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-48 object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">
                  {typeof post.category === 'string' 
                    ? post.category 
                    : post.category?.name || 'Uncategorized'}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {post.views}
                </div>
              </div>
              <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                <Link to={`/blog/${post._id}`}>
                  {post.title}
                </Link>
              </CardTitle>
              <CardDescription className="line-clamp-3">
                {post.excerpt}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback className="text-xs">
                      {post.author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {post.author.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Heart className={`h-3 w-3 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  {post.likes}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime} {t('blogPage.minRead')}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {post.tags.slice(0, 3).map((tag) => (
                  <Badge key={typeof tag === 'string' ? tag : tag._id} variant="outline" className="text-xs">
                    {typeof tag === 'string' ? tag : tag.name}
                  </Badge>
                ))}
              </div>

              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to={`/blog/${post._id}`}>
                  {t('blogPage.readArticle')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">{t('blogPage.noArticles')}</h3>
            <p className="text-muted-foreground">
              {t('blogPage.noArticlesDesc')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}