import { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next'
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  User,
  Heart,
  MessageSquare,
  Loader2,
  ExternalLink
} from "lucide-react"
import {
  getAdminBlogPosts,
  getBlogCategories,
  getBlogAuthors,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  createCategory,
  BlogPost,
  BlogCategory,
  BlogAuthor
} from "@/api/blog"

export function BlogManagement() {
  const { t } = useTranslation()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [_authors, setAuthors] = useState<BlogAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const { toast } = useToast()

  // Form state for new blog post
  const [newPost, setNewPost] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    tags: '',
    status: 'draft',
    featuredImage: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [postsResponse, categoriesResponse, authorsResponse] = await Promise.all([
        getAdminBlogPosts(),
        getBlogCategories(),
        getBlogAuthors()
      ])

      setPosts(postsResponse.posts || [])
      setCategories(categoriesResponse.categories || [])
      setAuthors((authorsResponse as any).authors || [])
    } catch (error) {
      console.error("Error fetching blog data:", error)
      toast({
        title: t('common.error'),
        description: t('blogManagement.failedToLoadPosts'),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      setIsCreatingCategory(true)
      const name = newCategoryName.trim()
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const response = await createCategory({ name, slug })
      if (response.category) {
        setCategories(prev => [...prev, response.category])
        toast({ title: t('common.success'), description: `Category "${response.category.name}" created` })
        setNewCategoryName('')
        setIsCategoryDialogOpen(false)
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || "Failed to create category", variant: "destructive" })
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleCreatePost = async () => {
    try {
      if (!newPost.title || !newPost.content || !newPost.category) {
        toast({
          title: t('common.error'),
          description: "Please fill in all required fields (Title, Content, Category)",
          variant: "destructive"
        })
        return
      }

      setIsCreating(true)

      const postData = {
        ...newPost,
        tags: [],
        seoKeywords: newPost.seoKeywords ? newPost.seoKeywords.split(',').map(keyword => keyword.trim()) : []
      }

      const response = await createBlogPost(postData as any)

      if (response.success) {
        toast({
          title: t('common.success'),
          description: t('blogManagement.postCreatedSuccess'),
        })

        setIsCreateDialogOpen(false)
        setNewPost({
          title: '',
          excerpt: '',
          content: '',
          category: '',
          tags: '',
          status: 'draft',
          featuredImage: '',
          seoTitle: '',
          seoDescription: '',
          seoKeywords: ''
        })

        // Refresh the posts list
        fetchData()
      }
    } catch (error: any) {
      console.error("Error creating blog post:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('blogManagement.failedToCreatePost'),
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditPost = (post: BlogPost) => {
    // Ensure all values are defined to prevent controlled/uncontrolled input warnings
    setEditingPost({
      ...post,
      featuredImage: post.featuredImage || '',
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
      seoKeywords: post.seoKeywords || []
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePost = async () => {
    try {
      if (!editingPost || !editingPost.title || !editingPost.content || !editingPost.category) {
        toast({
          title: t('common.error'),
          description: "Please fill in all required fields (Title, Content, Category)",
          variant: "destructive"
        })
        return
      }

      setIsUpdating(true)

      const postData = {
        title: editingPost.title,
        excerpt: editingPost.excerpt,
        content: editingPost.content,
        category: typeof editingPost.category === 'string' ? editingPost.category : editingPost.category._id,
        // Don't update tags - they require ObjectId references and need separate handling
        status: editingPost.status,
        featuredImage: editingPost.featuredImage || '',
        seoTitle: editingPost.seoTitle || '',
        seoDescription: editingPost.seoDescription || '',
        seoKeywords: Array.isArray(editingPost.seoKeywords) ? editingPost.seoKeywords : []
      }

      const response = await updateBlogPost(editingPost._id, postData as any)

      if (response.success) {
        toast({
          title: t('common.success'),
          description: t('blogManagement.postUpdated'),
        })

        setIsEditDialogOpen(false)
        setEditingPost(null)

        // Refresh the posts list
        fetchData()
      }
    } catch (error: any) {
      console.error("Error updating blog post:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('blogManagement.failedToUpdatePost'),
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(t('blogManagement.confirmDelete'))) return
    try {
      const response = await deleteBlogPost(postId)
      if (response.success) {
        toast({ title: t('common.success'), description: t('blogManagement.postDeleted') })
        setPosts(prev => prev.filter(p => p._id !== postId))
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('blogManagement.failedToDeletePost'), variant: "destructive" })
    }
  }

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.author?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-lg bg-[#1a2a5e] px-4 py-3 text-white shadow-sm">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {t('blogManagement.title')}
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
            {t('blogManagement.description')}
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 px-3 text-sm bg-white text-[#1a2a5e] hover:bg-blue-50">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('blogManagement.createNewPost')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="bg-[#1a2a5e] px-5 py-3 border-b border-blue-900/40 space-y-1">
              <DialogTitle className="text-white text-base">{t('blogManagement.createNewPost')}</DialogTitle>
              <DialogDescription className="text-blue-100 text-xs sm:text-sm">
                Fill in the details below to create a new blog post.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs">{t('blogManagement.fieldTitle')} *</Label>
                  <Input
                    id="title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="Enter blog post title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs">{t('blogManagement.category')} *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={newPost.category}
                      onValueChange={(value) => setNewPost({ ...newPost, category: value })}
                    >
                      <SelectTrigger className="h-9 text-sm flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" className="h-9 px-2" onClick={() => setIsCategoryDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="excerpt" className="text-xs">{t('blogManagement.excerpt')}</Label>
                <Textarea
                  id="excerpt"
                  value={newPost.excerpt}
                  onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
                  placeholder="Brief description of the blog post"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content" className="text-xs">{t('blogManagement.content')} *</Label>
                <Textarea
                  id="content"
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="Write your blog post content here"
                  rows={6}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tags" className="text-xs">{t('blogManagement.tags')}</Label>
                  <Input
                    id="tags"
                    value={newPost.tags}
                    onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                    placeholder="Enter tags separated by commas"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="featuredImage" className="text-xs">{t('blogManagement.featuredImage')}</Label>
                  <Input
                    id="featuredImage"
                    value={newPost.featuredImage}
                    onChange={(e) => setNewPost({ ...newPost, featuredImage: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs">{t('blogManagement.status')}</Label>
                <Select
                  value={newPost.status}
                  onValueChange={(value) => setNewPost({ ...newPost, status: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('blogManagement.draft')}</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="published">{t('blogManagement.published')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SEO Section */}
              <div className="space-y-3 border-t pt-3">
                <h4 className="font-semibold text-sm">SEO Settings</h4>
                <div className="space-y-1.5">
                  <Label htmlFor="seoTitle" className="text-xs">{t('blogManagement.seoTitle')}</Label>
                  <Input
                    id="seoTitle"
                    value={newPost.seoTitle}
                    onChange={(e) => setNewPost({ ...newPost, seoTitle: e.target.value })}
                    placeholder="SEO optimized title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seoDescription" className="text-xs">{t('blogManagement.seoDescription')}</Label>
                  <Textarea
                    id="seoDescription"
                    value={newPost.seoDescription}
                    onChange={(e) => setNewPost({ ...newPost, seoDescription: e.target.value })}
                    placeholder="SEO meta description"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seoKeywords" className="text-xs">SEO Keywords</Label>
                  <Input
                    id="seoKeywords"
                    value={newPost.seoKeywords}
                    onChange={(e) => setNewPost({ ...newPost, seoKeywords: e.target.value })}
                    placeholder="Enter keywords separated by commas"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t px-4 py-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
                className="h-9 px-3 text-sm"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={isCreating}
                className="h-9 px-3 text-sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  t('blogManagement.createNewPost')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-5 py-3 border-b border-blue-900/40 space-y-1">
            <DialogTitle className="text-white text-base">{t('blogManagement.editPost')}</DialogTitle>
            <DialogDescription className="text-blue-100 text-xs sm:text-sm">
              Update the details of your blog post.
            </DialogDescription>
          </DialogHeader>

          {editingPost && (
            <div className="grid gap-3 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title" className="text-xs">{t('blogManagement.fieldTitle')} *</Label>
                  <Input
                    id="edit-title"
                    value={editingPost.title}
                    onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                    placeholder="Enter blog post title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-category" className="text-xs">{t('blogManagement.category')} *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={typeof editingPost.category === 'string' ? editingPost.category : editingPost.category._id}
                      onValueChange={(value) => setEditingPost({ ...editingPost, category: value as any })}
                    >
                      <SelectTrigger className="h-9 text-sm flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" className="h-9 px-2" onClick={() => setIsCategoryDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-excerpt" className="text-xs">{t('blogManagement.excerpt')}</Label>
                <Textarea
                  id="edit-excerpt"
                  value={editingPost.excerpt}
                  onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                  placeholder="Brief description of the blog post"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-content" className="text-xs">{t('blogManagement.content')} *</Label>
                <Textarea
                  id="edit-content"
                  value={editingPost.content}
                  onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                  placeholder="Write your blog post content here"
                  rows={6}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tags" className="text-xs">{t('blogManagement.tags')} (read-only)</Label>
                  <Input
                    id="edit-tags"
                    value={
                      Array.isArray(editingPost.tags) 
                        ? editingPost.tags.map(tag => typeof tag === 'string' ? tag : tag.name).join(', ')
                        : ''
                    }
                    disabled
                    placeholder="Tags cannot be edited here"
                    className="bg-muted h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-featuredImage" className="text-xs">{t('blogManagement.featuredImage')}</Label>
                  <Input
                    id="edit-featuredImage"
                    value={editingPost.featuredImage}
                    onChange={(e) => setEditingPost({ ...editingPost, featuredImage: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status" className="text-xs">{t('blogManagement.status')}</Label>
                <Select
                  value={editingPost.status}
                  onValueChange={(value) => setEditingPost({ ...editingPost, status: value as any })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('blogManagement.draft')}</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="published">{t('blogManagement.published')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SEO Section */}
              <div className="space-y-3 border-t pt-3">
                <h4 className="font-semibold text-sm">SEO Settings</h4>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-seoTitle" className="text-xs">{t('blogManagement.seoTitle')}</Label>
                  <Input
                    id="edit-seoTitle"
                    value={editingPost.seoTitle || ''}
                    onChange={(e) => setEditingPost({ ...editingPost, seoTitle: e.target.value })}
                    placeholder="SEO optimized title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-seoDescription" className="text-xs">{t('blogManagement.seoDescription')}</Label>
                  <Textarea
                    id="edit-seoDescription"
                    value={editingPost.seoDescription || ''}
                    onChange={(e) => setEditingPost({ ...editingPost, seoDescription: e.target.value })}
                    placeholder="SEO meta description"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-seoKeywords" className="text-xs">SEO Keywords</Label>
                  <Input
                    id="edit-seoKeywords"
                    value={
                      Array.isArray(editingPost.seoKeywords) 
                        ? editingPost.seoKeywords.join(', ')
                        : ''
                    }
                    onChange={(e) => setEditingPost({ ...editingPost, seoKeywords: e.target.value.split(',').map(k => k.trim()) as any })}
                    placeholder="Enter keywords separated by commas"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t px-4 py-3 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingPost(null)
              }}
              disabled={isUpdating}
              className="h-9 px-3 text-sm"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpdatePost}
              disabled={isUpdating}
              className="h-9 px-3 text-sm"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                t('common.update')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-xs font-medium">{t('blogManagement.totalPosts')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{posts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-xs font-medium">{t('blogManagement.publishedPosts')}</CardTitle>
            <Eye className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">
              {posts.filter(post => post.status === 'published').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-xs font-medium">{t('blogManagement.draftPosts')}</CardTitle>
            <Edit className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">
              {posts.filter(post => post.status === 'draft').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-xs font-medium">{t('blogManagement.views')}</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">
              {posts.reduce((total, post) => total + (post.views || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('blogManagement.searchPosts')}
              className="pl-10 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Articles List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('blogManagement.posts')}</CardTitle>
          <CardDescription className="text-sm">{t('blogManagement.description')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {t('blogManagement.noBlogPostsFound')}
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post._id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Link 
                      to={`/blog/${post._id}`}
                      className="group"
                    >
                      <h3 className="text-sm sm:text-base font-semibold group-hover:text-primary transition-colors cursor-pointer flex items-center gap-2 leading-snug">
                        {post.title}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {post.author?.name || 'Unknown Author'}
                      </span>
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.views || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.likes || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post.commentsCount || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className="text-[11px]" variant={post.status === 'published' ? 'default' : 'secondary'}>
                      {post.status}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link to={`/blog/${post._id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPost(post)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeletePost(post._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-category-name" className="text-xs">Category Name *</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Technology, Tutorials..."
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCategoryDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCategoryName.trim()}>
              {isCreatingCategory ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}