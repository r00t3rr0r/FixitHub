import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { generateAvatarPlaceholder, generateImagePlaceholder } from "@/utils/placeholders"
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Eye,
  Star,
  Clock,
  User,
  Tag,
  Filter,
  FileText,
  Video,
  Image,
  Download
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface KnowledgeArticle {
  _id: string
  title: string
  content: string
  category: string
  tags: string[]
  author: {
    name: string
    avatar: string
  }
  rating: number
  views: number
  lastUpdated: string
  type: 'guide' | 'troubleshooting' | 'procedure' | 'faq'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedReadTime: number
  attachments: {
    type: 'image' | 'video' | 'document'
    url: string
    name: string
  }[]
}

export function KnowledgeBase() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [filteredArticles, setFilteredArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        // Mock data for knowledge base articles
        const mockArticles: KnowledgeArticle[] = [
          {
            _id: '1',
            title: 'iPhone Screen Replacement Procedure',
            content: 'Complete step-by-step guide for replacing iPhone screens...',
            category: 'Screen Repair',
            tags: ['iPhone', 'Screen', 'Replacement', 'Tools'],
            author: {
              name: 'Sarah Johnson',
              avatar: generateAvatarPlaceholder('SJ', 40)
            },
            rating: 4.8,
            views: 1247,
            lastUpdated: '2024-01-15T10:30:00Z',
            type: 'guide',
            difficulty: 'intermediate',
            estimatedReadTime: 12,
            attachments: [
              {
                type: 'video',
                url: 'https://example.com/video1.mp4',
                name: 'Screen Replacement Demo'
              },
              {
                type: 'image',
                url: generateImagePlaceholder('Tools Required', 400, 300),
                name: 'Required Tools'
              }
            ]
          },
          {
            _id: '2',
            title: 'Water Damage Assessment Checklist',
            content: 'How to properly assess water damage in mobile devices...',
            category: 'Water Damage',
            tags: ['Water Damage', 'Assessment', 'Checklist'],
            author: {
              name: 'Mike Chen',
              avatar: generateAvatarPlaceholder('MC', 40)
            },
            rating: 4.9,
            views: 892,
            lastUpdated: '2024-01-12T14:20:00Z',
            type: 'procedure',
            difficulty: 'beginner',
            estimatedReadTime: 8,
            attachments: [
              {
                type: 'document',
                url: 'https://example.com/checklist.pdf',
                name: 'Water Damage Checklist.pdf'
              }
            ]
          },
          {
            _id: '3',
            title: 'Troubleshooting Battery Issues',
            content: 'Common battery problems and their solutions...',
            category: 'Battery Repair',
            tags: ['Battery', 'Troubleshooting', 'Diagnostics'],
            author: {
              name: 'Emily Rodriguez',
              avatar: generateAvatarPlaceholder('ER', 40)
            },
            rating: 4.7,
            views: 654,
            lastUpdated: '2024-01-10T09:15:00Z',
            type: 'troubleshooting',
            difficulty: 'beginner',
            estimatedReadTime: 6,
            attachments: []
          }
        ]

        setArticles(mockArticles)
        setFilteredArticles(mockArticles)
      } catch (error) {
        console.error("Error fetching knowledge base:", error)
        toast({
          title: "Error",
          description: "Failed to load knowledge base articles",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [toast])

  useEffect(() => {
    let filtered = articles

    if (searchTerm) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(article => article.category === categoryFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(article => article.type === typeFilter)
    }

    setFilteredArticles(filtered)
  }, [articles, searchTerm, categoryFilter, typeFilter])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500 text-white'
      case 'intermediate':
        return 'bg-yellow-500 text-black'
      case 'advanced':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guide':
        return <BookOpen className="h-4 w-4" />
      case 'troubleshooting':
        return <Search className="h-4 w-4" />
      case 'procedure':
        return <FileText className="h-4 w-4" />
      case 'faq':
        return <User className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Access repair guides, procedures, and troubleshooting resources
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Article
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles, guides, and procedures..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Screen Repair">Screen Repair</SelectItem>
                  <SelectItem value="Battery Repair">Battery Repair</SelectItem>
                  <SelectItem value="Water Damage">Water Damage</SelectItem>
                  <SelectItem value="Camera Repair">Camera Repair</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="guide">Guides</SelectItem>
                  <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                  <SelectItem value="procedure">Procedures</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredArticles.map((article) => (
          <Card key={article._id} className="group hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getTypeIcon(article.type)}
                  <Badge variant="outline">{article.type}</Badge>
                </div>
                <Badge className={getDifficultyColor(article.difficulty)}>
                  {article.difficulty}
                </Badge>
              </div>
              <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                {article.title}
              </CardTitle>
              <CardDescription className="line-clamp-3">
                {article.content}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {article.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Tag className="h-2 w-2 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {article.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{article.tags.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{article.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{article.views}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{article.estimatedReadTime}min</span>
                  </div>
                </div>
              </div>

              {article.attachments.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Attachments:</span>
                  <div className="flex gap-1">
                    {article.attachments.map((attachment, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {attachment.type === 'video' && <Video className="h-2 w-2 mr-1" />}
                        {attachment.type === 'image' && <Image className="h-2 w-2 mr-1" />}
                        {attachment.type === 'document' && <FileText className="h-2 w-2 mr-1" />}
                        {attachment.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs">
                    {article.author.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs text-muted-foreground">{article.author.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}