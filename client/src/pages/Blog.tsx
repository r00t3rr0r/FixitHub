import { useEffect, useState } from "react"
import { SEO } from '@/components/SEO'
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getBlogPosts, BlogPost, BlogCategory } from "@/api/blog"
import {
  BookOpen,
  Search,
  Calendar,
  Clock,
  Eye,
  Filter,
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
      <section className="section py-4 sm:py-6">
        <div className="container max-w-7xl">
          <div className="mb-4 rounded-2xl border border-[#eceef3] bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
            <div className="h-5 w-44 animate-pulse rounded bg-slate-200 sm:h-7 sm:w-64" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100 sm:w-3/4" />
          </div>

          <div className="mb-4 grid gap-2 rounded-xl border border-[#eceef3] bg-white p-3 shadow-sm sm:mb-6 sm:grid-cols-[1fr_220px] sm:gap-3 sm:p-4">
            <div className="h-9 animate-pulse rounded-md bg-slate-100" />
            <div className="h-9 animate-pulse rounded-md bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[#eceef3] bg-white shadow-sm">
                <div className="h-40 animate-pulse bg-slate-100 sm:h-44" />
                <div className="space-y-2 p-3 sm:p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section py-4 sm:py-6">
      <SEO
        title="Reparatur-Blog & Ratgeber – McRepair.de"
        description="Tipps, Anleitungen und News rund um Smartphone- & Tablet-Reparatur. Im McRepair.de Blog immer gut informiert."
        canonical="/blog"
        ogType="article"
      />
      <div className="container max-w-7xl">
        <div className="mb-4 overflow-hidden rounded-2xl border border-[#1a2a5e] bg-[#1a2a5e] p-4 shadow-sm sm:mb-6 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#f5b800]/40 bg-[#233575] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f5b800] sm:text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                McRepair Blog
              </p>
              <h1 className="text-xl font-bold leading-tight text-[#f5b800] sm:text-2xl md:text-3xl">
                {t('blogPage.title')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-100 sm:text-[15px]">
                {t('blogPage.description') || 'Tipps & Wissenswertes rund um Ihr Gerät'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-[#eceef3] bg-white p-3 shadow-sm sm:mb-6 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_220px] sm:gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t('blogPage.searchPlaceholder') || 'Artikel durchsuchen...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 border-[#d8dce6] bg-white pl-9 text-sm"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 border-[#d8dce6] bg-white text-sm">
                <Filter className="mr-1.5 h-4 w-4 text-[#f5b800]" />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <Link
              key={post._id}
              to={`/blog/${post._id}`}
              className="group overflow-hidden rounded-xl border border-[#eceef3] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b800]/50"
            >
              <div className="relative h-40 overflow-hidden bg-slate-100 sm:h-44">
                {post.featuredImage ? (
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <BookOpen className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4">
                <Badge className="mb-2 bg-[#fff8e1] text-[11px] font-semibold text-[#1a2a5e] hover:bg-[#fff8e1] sm:text-xs">
                  {typeof post.category === 'string' ? post.category : post.category?.name || 'Allgemein'}
                </Badge>

                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
                  {post.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  {post.excerpt}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 sm:text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString('de-DE')}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readTime} min
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {post.views}
                  </span>
                </div>

                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1a2a5e] sm:text-sm">
                  Weiterlesen
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="rounded-xl border border-[#eceef3] bg-white px-4 py-10 text-center shadow-sm sm:px-6">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-400 sm:h-12 sm:w-12" />
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
              {t('blogPage.noArticles')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {t('blogPage.noArticlesDesc')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
