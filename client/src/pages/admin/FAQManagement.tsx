import { useState, useEffect } from "react"
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
  HelpCircle,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from "lucide-react"
import {
  getFAQs,
  getFAQCategories,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  FAQ,
  FAQCategory
} from "@/api/faq"

export function FAQManagement() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [groupedFAQs, setGroupedFAQs] = useState<Record<string, FAQ[]>>({})
  const [categories, setCategories] = useState<FAQCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null)
  const { toast } = useToast()

  // Form state for new/edit FAQ
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'General',
    order: 0,
    tags: '',
    isActive: true
  })

  const faqCategories = [
    'General',
    'Repairs', 
    'Pricing',
    'Warranty',
    'Shipping',
    'Account',
    'Technical'
  ]

  const compactCardClass = 'border-slate-200 shadow-sm'
  const compactCardHeaderClass = 'px-4 py-3 pb-2'
  const compactCardTitleClass = 'text-base font-semibold'
  const compactCardDescriptionClass = 'text-xs text-muted-foreground'
  const compactInputClass = 'h-8 text-xs'
  const compactTextareaClass = 'min-h-[120px] text-sm leading-snug'
  const compactSelectTriggerClass = 'h-8 text-xs'
  const compactButtonClass = 'h-8 px-3 text-xs'
  const compactIconButtonClass = 'h-8 w-8 p-0'
  const compactDialogContentClass = 'max-h-[88vh] max-w-2xl overflow-y-auto gap-0 border-slate-200 p-4 text-sm shadow-xl sm:p-5 [&>button]:right-3 [&>button]:top-3 [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:bg-white/10 [&>button]:hover:text-white'
  const compactDialogHeaderClass = '-mx-4 -mt-4 border-b border-[#2a3f7e] bg-[#1a2a5e] px-4 py-2.5 text-left text-white sm:-mx-5 sm:-mt-5 sm:px-5'
  const compactDialogTitleClass = 'text-base font-semibold text-white'
  const compactDialogDescriptionClass = 'text-xs text-[#d8dce6]'
  const compactDialogBodyClass = 'grid gap-3 py-4'
  const compactLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600'
  const sectionBadgeClass = 'border border-[#d7def7] bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#1a2a5e]'

  useEffect(() => {
    fetchData()
  }, [selectedCategory, searchTerm])

  const fetchData = async () => {
    try {
      setLoading(true)
      const filters = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined
      }

      const [faqsResponse, categoriesResponse] = await Promise.all([
        getFAQs(filters),
        getFAQCategories()
      ])

      setFaqs(faqsResponse.faqs || [])
      setGroupedFAQs(faqsResponse.groupedFAQs || {})
      setCategories(categoriesResponse.categories || [])
    } catch (error) {
      console.error("Error fetching FAQ data:", error)
      toast({
        title: "Error",
        description: "Failed to load FAQ data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFAQ = async () => {
    try {
      if (!faqForm.question || !faqForm.answer) {
        toast({
          title: "Validation Error",
          description: "Please fill in both question and answer fields",
          variant: "destructive"
        })
        return
      }

      setIsCreating(true)

      const faqData = {
        ...faqForm,
        tags: faqForm.tags ? faqForm.tags.split(',').map(tag => tag.trim()) : []
      }

      const response = await createFAQ(faqData)

      if (response.success) {
        toast({
          title: "Success",
          description: "FAQ created successfully",
        })

        setIsCreateDialogOpen(false)
        resetForm()
        fetchData()
      }
    } catch (error: any) {
      console.error("Error creating FAQ:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create FAQ",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditFAQ = async () => {
    try {
      if (!editingFAQ || !faqForm.question || !faqForm.answer) {
        toast({
          title: "Validation Error",
          description: "Please fill in both question and answer fields",
          variant: "destructive"
        })
        return
      }

      setIsUpdating(true)

      const faqData = {
        ...faqForm,
        tags: faqForm.tags ? faqForm.tags.split(',').map(tag => tag.trim()) : []
      }

      const response = await updateFAQ(editingFAQ._id, faqData)

      if (response.success) {
        toast({
          title: "Success",
          description: "FAQ updated successfully",
        })

        setIsEditDialogOpen(false)
        setEditingFAQ(null)
        resetForm()
        fetchData()
      }
    } catch (error: any) {
      console.error("Error updating FAQ:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update FAQ",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteFAQ = async (faqId: string) => {
    try {
      const response = await deleteFAQ(faqId)

      if (response.success) {
        toast({
          title: "Success",
          description: "FAQ deleted successfully",
        })
        fetchData()
      }
    } catch (error: any) {
      console.error("Error deleting FAQ:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete FAQ",
        variant: "destructive"
      })
    }
  }

  const openEditDialog = (faq: FAQ) => {
    setEditingFAQ(faq)
    setFaqForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      tags: faq.tags.join(', '),
      isActive: faq.isActive
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFaqForm({
      question: '',
      answer: '',
      category: 'General',
      order: 0,
      tags: '',
      isActive: true
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#0f1d45] bg-[#1a2a5e] px-4 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <HelpCircle className="h-6 w-6" />
            FAQ Management
          </h1>
          <p className="text-xs text-blue-100 sm:text-sm">
            Manage frequently asked questions and categories
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 bg-white px-3 text-sm font-medium text-[#1a2a5e] hover:bg-[#f7f9ff]">
              <Plus className="mr-1.5 h-4 w-4" />
              New FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className={compactDialogContentClass}>
            <DialogHeader className={compactDialogHeaderClass}>
              <DialogTitle className={compactDialogTitleClass}>Create New FAQ</DialogTitle>
              <DialogDescription className={compactDialogDescriptionClass}>
                Fill in the details below to create a new FAQ.
              </DialogDescription>
            </DialogHeader>

            <div className={compactDialogBodyClass}>
              <div className="space-y-1.5">
                <Label htmlFor="question" className={compactLabelClass}>Question *</Label>
                <Input
                  id="question"
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                  placeholder="Enter the FAQ question"
                  className={compactInputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="answer" className={compactLabelClass}>Answer *</Label>
                <Textarea
                  id="answer"
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  placeholder="Enter the FAQ answer"
                  rows={5}
                  className={compactTextareaClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className={compactLabelClass}>Category</Label>
                  <Select
                    value={faqForm.category}
                    onValueChange={(value) => setFaqForm({ ...faqForm, category: value })}
                  >
                    <SelectTrigger className={compactSelectTriggerClass}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {faqCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order" className={compactLabelClass}>Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={faqForm.order}
                    onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 0 })}
                    placeholder="Display order"
                    className={compactInputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags" className={compactLabelClass}>Tags</Label>
                <Input
                  id="tags"
                  value={faqForm.tags}
                  onChange={(e) => setFaqForm({ ...faqForm, tags: e.target.value })}
                  placeholder="Enter tags separated by commas"
                  className={compactInputClass}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-200 px-0 pt-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetForm()
                }}
                disabled={isCreating}
                className={compactButtonClass}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFAQ}
                disabled={isCreating}
                className={compactButtonClass}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create FAQ'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className={compactCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1.5">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total FAQs</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-xl font-bold text-slate-900">{faqs.length}</div>
          </CardContent>
        </Card>
        <Card className={compactCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1.5">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Categories</CardTitle>
            <Eye className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-xl font-bold text-slate-900">{categories.length}</div>
          </CardContent>
        </Card>
        <Card className={compactCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1.5">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-xl font-bold text-slate-900">
              {faqs.reduce((total, faq) => total + (faq.views || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card className={compactCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1.5">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Helpful Votes</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-xl font-bold text-slate-900">
              {faqs.reduce((total, faq) => total + (faq.helpful || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={compactCardClass}>
        <CardHeader className={compactCardHeaderClass}>
          <CardTitle className={compactCardTitleClass}>Filters</CardTitle>
          <CardDescription className={compactCardDescriptionClass}>Search and narrow down categories quickly.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                className="h-8 pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-[190px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {faqCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* FAQs List */}
      <Card className={compactCardClass}>
        <CardHeader className={compactCardHeaderClass}>
          <CardTitle className={compactCardTitleClass}>FAQs</CardTitle>
          <CardDescription className={compactCardDescriptionClass}>Compact overview of questions, answers and engagement.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-4">
            {Object.keys(groupedFAQs).length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm text-muted-foreground">
                No FAQs found. Create your first FAQ!
              </div>
            ) : (
              Object.entries(groupedFAQs).map(([category, categoryFAQs]) => (
                <div key={category} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{category}</h3>
                    <Badge variant="secondary" className={sectionBadgeClass}>{categoryFAQs.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {categoryFAQs.map((faq) => (
                      <div key={faq._id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-2">
                            <h4 className="text-sm font-medium leading-snug text-slate-900">{faq.question}</h4>
                            <Badge variant={faq.isActive ? 'default' : 'secondary'} className="h-5 px-1.5 text-[11px]">
                              {faq.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                            {faq.answer}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {faq.views || 0} views
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {faq.helpful || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              {faq.notHelpful || 0}
                            </span>
                            {faq.tags.length > 0 && (
                              <span className="truncate">Tags: {faq.tags.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 self-end lg:self-center">
                          <Button variant="ghost" size="icon" className={compactIconButtonClass} onClick={() => openEditDialog(faq)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className={compactIconButtonClass}
                            onClick={() => handleDeleteFAQ(faq._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={compactDialogContentClass}>
          <DialogHeader className={compactDialogHeaderClass}>
            <DialogTitle className={compactDialogTitleClass}>Edit FAQ</DialogTitle>
            <DialogDescription className={compactDialogDescriptionClass}>
              Update the FAQ details below.
            </DialogDescription>
          </DialogHeader>

          <div className={compactDialogBodyClass}>
            <div className="space-y-1.5">
              <Label htmlFor="edit-question" className={compactLabelClass}>Question *</Label>
              <Input
                id="edit-question"
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder="Enter the FAQ question"
                className={compactInputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-answer" className={compactLabelClass}>Answer *</Label>
              <Textarea
                id="edit-answer"
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder="Enter the FAQ answer"
                rows={5}
                className={compactTextareaClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-category" className={compactLabelClass}>Category</Label>
                <Select
                  value={faqForm.category}
                  onValueChange={(value) => setFaqForm({ ...faqForm, category: value })}
                >
                  <SelectTrigger className={compactSelectTriggerClass}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {faqCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-order" className={compactLabelClass}>Order</Label>
                <Input
                  id="edit-order"
                  type="number"
                  value={faqForm.order}
                  onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 0 })}
                  placeholder="Display order"
                  className={compactInputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-tags" className={compactLabelClass}>Tags</Label>
              <Input
                id="edit-tags"
                value={faqForm.tags}
                onChange={(e) => setFaqForm({ ...faqForm, tags: e.target.value })}
                placeholder="Enter tags separated by commas"
                className={compactInputClass}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-200 px-0 pt-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingFAQ(null)
                resetForm()
              }}
              disabled={isUpdating}
              className={compactButtonClass}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditFAQ}
              disabled={isUpdating}
              className={compactButtonClass}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update FAQ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}