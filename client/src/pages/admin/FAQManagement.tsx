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
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HelpCircle className="h-8 w-8" />
            FAQ Management
          </h1>
          <p className="text-muted-foreground">
            Manage frequently asked questions and categories
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New FAQ</DialogTitle>
              <DialogDescription>
                Fill in the details below to create a new FAQ.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question *</Label>
                <Input
                  id="question"
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                  placeholder="Enter the FAQ question"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="answer">Answer *</Label>
                <Textarea
                  id="answer"
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  placeholder="Enter the FAQ answer"
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={faqForm.category}
                    onValueChange={(value) => setFaqForm({ ...faqForm, category: value })}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="order">Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={faqForm.order}
                    onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 0 })}
                    placeholder="Display order"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={faqForm.tags}
                  onChange={(e) => setFaqForm({ ...faqForm, tags: e.target.value })}
                  placeholder="Enter tags separated by commas"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetForm()
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFAQ}
                disabled={isCreating}
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total FAQs</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{faqs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Eye className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {faqs.reduce((total, faq) => total + (faq.views || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Helpful Votes</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {faqs.reduce((total, faq) => total + (faq.helpful || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
      <Card>
        <CardHeader>
          <CardTitle>FAQs</CardTitle>
          <CardDescription>Manage your frequently asked questions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(groupedFAQs).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No FAQs found. Create your first FAQ!
              </div>
            ) : (
              Object.entries(groupedFAQs).map(([category, categoryFAQs]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{category}</h3>
                    <Badge variant="secondary">{categoryFAQs.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {categoryFAQs.map((faq) => (
                      <div key={faq._id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{faq.question}</h4>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {faq.answer}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                              <span>Tags: {faq.tags.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={faq.isActive ? 'default' : 'secondary'}>
                            {faq.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(faq)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit FAQ</DialogTitle>
            <DialogDescription>
              Update the FAQ details below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-question">Question *</Label>
              <Input
                id="edit-question"
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder="Enter the FAQ question"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-answer">Answer *</Label>
              <Textarea
                id="edit-answer"
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder="Enter the FAQ answer"
                rows={6}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={faqForm.category}
                  onValueChange={(value) => setFaqForm({ ...faqForm, category: value })}
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="edit-order">Order</Label>
                <Input
                  id="edit-order"
                  type="number"
                  value={faqForm.order}
                  onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 0 })}
                  placeholder="Display order"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={faqForm.tags}
                onChange={(e) => setFaqForm({ ...faqForm, tags: e.target.value })}
                placeholder="Enter tags separated by commas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingFAQ(null)
                resetForm()
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditFAQ}
              disabled={isUpdating}
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