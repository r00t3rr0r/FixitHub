import { useEffect, useState } from "react"
import { SEO } from '@/components/SEO'
import { useParams, Link } from "react-router-dom"
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
  BookOpen
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
      <section className="section py-4 sm:py-6">
        <div className="container max-w-4xl">
          <div className="mb-4 h-9 w-32 animate-pulse rounded-md bg-slate-200" />
          <div className="overflow-hidden rounded-xl border border-[#eceef3] bg-white shadow-sm">
            <div className="h-48 animate-pulse bg-slate-100 sm:h-72" />
            <div className="space-y-3 p-4 sm:p-6">
              <div className="h-7 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!post) {
    return (
      <section className="section py-4 sm:py-6">
        <div className="container max-w-4xl">
          <div className="rounded-xl border border-[#eceef3] bg-white px-4 py-10 text-center shadow-sm sm:px-6">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-[#f5b800] sm:h-12 sm:w-12" />
            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Artikel nicht gefunden</h3>
            <p className="mt-2 text-sm text-slate-600">
              Der gesuchte Blog-Artikel existiert nicht.
            </p>
            <Button asChild className="mt-5 bg-[#f5b800] font-semibold text-[#1a2a5e] hover:bg-[#e7ad00]">
              <Link to="/blog" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Zurück zum Blog
              </Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section py-4 sm:py-6">
      {(() => {
        const BASE_URL = 'https://www.mcrepair.de'
        const seoTitle = post.seoTitle || post.title
        const rawDesc = post.seoDescription || post.excerpt
        const seoDesc = rawDesc.length > 160
          ? rawDesc.slice(0, 157).replace(/\s+\S*$/, '') + '…'
          : rawDesc
        const categoryName = post.category?.name || 'Allgemein'
        const canonicalPath = `/blog/${post.slug || post._id}`
        const canonicalUrl = `${BASE_URL}${canonicalPath}`
        const imageUrl = post.featuredImage || `${BASE_URL}/og-default.jpg`
        const publishedAt = post.publishedAt || post.createdAt
        const tagNames = post.tags.map((t) => (typeof t === 'string' ? t : t.name))
        const keywords = post.seoKeywords?.length
          ? post.seoKeywords.join(', ')
          : tagNames.join(', ')

        // Estimate word count from HTML content (strip tags)
        const wordCount = post.content
          ? post.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
          : undefined

        const blogPostingSchema = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: seoTitle.slice(0, 110),
          description: seoDesc,
          image: imageUrl,
          url: canonicalUrl,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
          datePublished: publishedAt,
          dateModified: post.updatedAt || publishedAt,
          author: {
            '@type': 'Person',
            name: post.author.name,
            description: post.author.bio || undefined,
          },
          publisher: {
            '@type': 'Organization',
            name: 'McRepair.de',
            logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
          },
          articleSection: categoryName,
          keywords: keywords || undefined,
          ...(wordCount ? { wordCount } : {}),
          ...(post.readTime ? { timeRequired: `PT${post.readTime}M` } : {}),
        }

        const breadcrumbSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
            { '@type': 'ListItem', position: 3, name: seoTitle.slice(0, 80), item: canonicalUrl },
          ],
        }

        return (
          <SEO
            title={`${seoTitle.slice(0, 60)} – McRepair.de Blog`}
            description={seoDesc}
            canonical={canonicalPath}
            ogType="article"
            ogImage={imageUrl}
            ogImageAlt={post.title}
            keywords={keywords || undefined}
            publishedTime={publishedAt}
            modifiedTime={post.updatedAt || publishedAt}
            articleAuthor={post.author.name}
            articleSection={categoryName}
            articleTags={tagNames.length ? tagNames : undefined}
            jsonLd={[blogPostingSchema, breadcrumbSchema]}
          />
        )
      })()}
      <div className="container max-w-4xl">
        <Button
          variant="ghost"
          asChild
          className="mb-4 border border-[#eceef3] bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Link to="/blog" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Blog
          </Link>
        </Button>

        <header className="mb-4 overflow-hidden rounded-2xl border border-[#1a2a5e] bg-[#1a2a5e] p-4 shadow-sm sm:mb-5 sm:p-6">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#f5b800]/40 bg-[#233575] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f5b800] sm:text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Blogartikel
          </p>
          <h1 className="text-xl font-bold leading-tight text-[#f5b800] sm:text-2xl md:text-3xl">
            {post.title}
          </h1>
        </header>

        <article className="overflow-hidden rounded-xl border border-[#eceef3] bg-white shadow-sm">
          <div className="relative h-48 overflow-hidden bg-slate-100 sm:h-72">
            {post.featuredImage ? (
              <img
                src={post.featuredImage}
                alt={post.title}
                className="h-full w-full object-cover"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <BookOpen className="h-10 w-10" />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Badge className="bg-[#fff8e1] text-xs font-semibold text-[#1a2a5e] hover:bg-[#fff8e1]">
                {post.category?.name || 'Allgemein'}
              </Badge>

              <div className="flex items-center gap-3 text-xs text-slate-500 sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4 text-[#f5b800]" />
                  {post.views} Aufrufe
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart
                    className={`h-4 w-4 ${post.isLiked ? 'fill-red-500 text-red-500' : 'text-[#f5b800]'}`}
                  />
                  {post.likes} Likes
                </span>
              </div>
            </div>

            <h1 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
              {post.title}
            </h1>

            <div className="my-4 flex flex-col gap-3 border-y border-[#eceef3] py-4 sm:my-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                  <AvatarImage src={post.author.avatar} />
                  <AvatarFallback className="bg-[#f5b800] text-sm font-bold text-[#1a2a5e] sm:text-base">
                    {post.author.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">{post.author.name}</p>
                  <p className="line-clamp-2 text-xs text-slate-600 sm:text-sm">
                    {post.author.bio}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-[#f5b800]" />
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString('de-DE')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4 text-[#f5b800]" />
                  {post.readTime} min Lesezeit
                </span>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleLike}
                disabled={liking}
                className={post.isLiked
                  ? 'h-8 bg-[#f5b800] px-3 text-xs font-semibold text-[#1a2a5e] hover:bg-[#e7ad00] sm:h-9 sm:px-4 sm:text-sm'
                  : 'h-8 border border-[#f5b800] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-[#fff8e1] sm:h-9 sm:px-4 sm:text-sm'}
              >
                <Heart className={`mr-1.5 h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                {liking ? '...' : post.isLiked ? 'Geliked' : 'Liken'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="h-8 border-[#d8dce6] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9 sm:px-4 sm:text-sm"
              >
                <Share2 className="mr-1.5 h-4 w-4" />
                Teilen
              </Button>
            </div>

            <div
              className="prose prose-sm max-w-none text-slate-700 prose-headings:text-slate-900 prose-a:text-[#1a2a5e] prose-strong:text-slate-900 [&_p]:text-[13px] [&_p]:leading-[1.65] [&_li]:text-[13px] [&_li]:leading-[1.6] [&_blockquote]:text-[13px]"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            <div className="mt-6 border-t border-[#eceef3] pt-5">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 sm:text-base">
                <Sparkles className="h-4 w-4 text-[#f5b800]" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge
                    key={typeof tag === 'string' ? tag : tag._id}
                    variant="outline"
                    className="border-[#f5b800]/40 bg-[#fffbf0] text-xs text-slate-600"
                  >
                    {typeof tag === 'string' ? tag : tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </article>

        <section className="mt-4 rounded-xl border border-[#eceef3] bg-white p-4 shadow-sm sm:mt-5 sm:p-6">
          <h3 className="mb-4 inline-flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f5b800]">
              <User className="h-4 w-4 text-[#1a2a5e]" />
            </span>
            Über den Autor
          </h3>

          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <AvatarImage src={post.author.avatar} />
              <AvatarFallback className="bg-[#f5b800] text-lg font-bold text-[#1a2a5e]">
                {post.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{post.author.name}</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{post.author.bio}</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
