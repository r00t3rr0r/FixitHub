import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { getBlogPosts, BlogPost } from "@/api/blog"
import { getRepairServices, RepairService } from "@/api/services"
import { getHomepageSections, type HomepageSection, type ContentBlock } from "@/api/homepage"
import {
  Smartphone,
  Wrench,
  Shield,
  Clock,
  Star,
  CheckCircle,
  ArrowRight,
  Play,
  Users,
  Award,
  Zap,
  Heart,
  MessageSquare,
  Calendar
} from "lucide-react"

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([])
  const [services, setServices] = useState<RepairService[]>([])
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If user is authenticated, redirect to dashboard
    if (user) {
      navigate("/")
      return
    }

    const fetchHomeData = async () => {
      try {
        const [blogResponse, servicesResponse, sectionsResponse] = await Promise.all([
          getBlogPosts({ limit: 3, featured: true }),
          getRepairServices(),
          getHomepageSections()
        ])

        setFeaturedPosts((blogResponse as any).posts || [])
        setServices(((servicesResponse as any).services || []).slice(0, 6))
        setHomepageSections((sectionsResponse as any).sections || [])
      } catch (error) {
        console.error("Error fetching home data:", error)
        // Fall back to default content if API fails
        setHomepageSections([])
      } finally {
        setLoading(false)
      }
    }

    fetchHomeData()
  }, [user, navigate])

  if (user) {
    return null // Will redirect
  }

  const renderContentBlock = (block: ContentBlock) => {
    if (!block.isVisible) return null

    const blockStyle = {
      backgroundColor: block.settings.backgroundColor || '#ffffff',
      color: block.settings.textColor || '#000000',
      padding: block.settings.padding || '20px 0',
      margin: block.settings.margin || '0px',
      textAlign: block.settings.alignment || 'left' as any
    }

    switch (block.type) {
      case 'hero':
        return (
          <section key={block._id} className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white" style={blockStyle}>
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative container mx-auto px-6 py-24 lg:py-32">
              <div className="grid gap-12 lg:grid-cols-2 items-center">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Zap className="h-3 w-3 mr-1" />
                      Professional Repair Services
                    </Badge>
                    <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                      {block.content.heading || 'Fix Your Device'}
                      <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                        Like New Again
                      </span>
                    </h1>
                    <p className="text-xl text-blue-100 max-w-lg">
                      {block.content.subheading || 'Fast, reliable, and affordable repair services for all your devices. Expert technicians, quality parts, and warranty included.'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg" asChild>
                      <Link to={block.content.ctaLink || "/register"}>
                        <Smartphone className="h-5 w-5 mr-2" />
                        {block.content.ctaText || 'Start Repair Order'}
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                      <Link to="/login">
                        <Play className="h-5 w-5 mr-2" />
                        Watch Demo
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-8 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">10K+</div>
                      <div className="text-sm text-blue-200">Devices Repaired</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">4.9★</div>
                      <div className="text-sm text-blue-200">Customer Rating</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">24h</div>
                      <div className="text-sm text-blue-200">Average Turnaround</div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Free Diagnostics</h3>
                          <p className="text-sm text-blue-100">Complete device assessment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Warranty Included</h3>
                          <p className="text-sm text-blue-100">90-day repair guarantee</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Quick Turnaround</h3>
                          <p className="text-sm text-blue-100">Most repairs in 24 hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-20"></div>
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-20"></div>
                </div>
              </div>
            </div>
          </section>
        )

      case 'services':
        return (
          <section key={block._id} className="py-20 bg-white dark:bg-gray-800" style={blockStyle}>
            <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                <Badge className="mb-4" variant="outline">
                  <Wrench className="h-3 w-3 mr-1" />
                  Our Services
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  {block.content.heading || 'Expert Repair Services'}
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  {block.content.description || 'Professional repair services for all major device brands with quality parts and expert technicians'}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <Card key={service._id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                    <CardHeader>
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Smartphone className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="group-hover:text-blue-600 transition-colors">
                        {service.name}
                      </CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-2xl font-bold text-green-600">
                          ${service.price}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {service.estimatedTime}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {service.popularity}% satisfaction
                        </span>
                      </div>
                      <Button className="w-full group-hover:bg-blue-600 transition-colors" asChild>
                        <Link to="/register">
                          Get Quote
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )

      case 'testimonials':
        return (
          <section key={block._id} className="py-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800" style={blockStyle}>
            <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                <Badge className="mb-4" variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  Customer Reviews
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  {block.content.heading || 'What Our Customers Say'}
                </h2>
                <p className="text-xl text-muted-foreground">
                  Thousands of satisfied customers trust us with their devices
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-3">
                {(block.content.testimonials || [
                  {
                    name: "Sarah Johnson",
                    role: "Business Owner",
                    avatar: "https://via.placeholder.com/60x60/3b82f6/ffffff?text=SJ",
                    rating: 5,
                    review: "Incredible service! My iPhone was fixed in just 2 hours and works perfectly. The staff was professional and the price was very reasonable."
                  },
                  {
                    name: "Mike Chen",
                    role: "Student",
                    avatar: "https://via.placeholder.com/60x60/10b981/ffffff?text=MC",
                    rating: 5,
                    review: "Best repair shop in town! They fixed my laptop screen and it looks brand new. Fast service and great warranty coverage."
                  },
                  {
                    name: "Emily Davis",
                    role: "Teacher",
                    avatar: "https://via.placeholder.com/60x60/8b5cf6/ffffff?text=ED",
                    rating: 5,
                    review: "Amazing experience from start to finish. Online booking was easy, updates were frequent, and my device was ready ahead of schedule."
                  }
                ]).map((testimonial, index) => (
                  <Card key={index} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-gray-700 mb-6 italic">"{testimonial.review}"</p>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={testimonial.avatar} />
                          <AvatarFallback>{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{testimonial.name}</div>
                          <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )

      case 'cta':
        return (
          <section key={block._id} className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white" style={blockStyle}>
            <div className="container mx-auto px-6 text-center">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                  {block.content.heading || 'Ready to Fix Your Device?'}
                </h2>
                <p className="text-xl text-blue-100 mb-8">
                  {block.content.description || 'Join thousands of satisfied customers who trust us with their device repairs. Get started today with our free diagnostic service.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50" asChild>
                    <Link to={block.content.ctaLink || "/register"}>
                      <Smartphone className="h-5 w-5 mr-2" />
                      {block.content.ctaText || 'Start Your Repair'}
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                    <Link to="/login">
                      <Users className="h-5 w-5 mr-2" />
                      Login to Account
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )

      case 'html':
        return (
          <section key={block._id} style={blockStyle}>
            <div
              className="container mx-auto px-6"
              dangerouslySetInnerHTML={{ __html: block.content.html || '' }}
            />
          </section>
        )

      default:
        return null
    }
  }

  const renderSection = (section: HomepageSection) => {
    if (!section.isActive) return null

    return (
      <div key={section._id}>
        {section.blocks
          .sort((a, b) => a.order - b.order)
          .map(block => renderContentBlock(block))}
      </div>
    )
  }

  // Check if we have any active sections with visible blocks
  const hasActiveContent = homepageSections.some(section =>
    section.isActive && section.blocks.some(block => block.isVisible)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Dynamic Homepage Sections */}
      {hasActiveContent ? (
        <>
          {homepageSections
            .sort((a, b) => a.order - b.order)
            .map(section => renderSection(section))}

          {/* Blog Section - only show when there are active homepage sections */}
          {featuredPosts.length > 0 && (
            <section className="py-20 bg-white dark:bg-gray-800">
              <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                  <Badge className="mb-4" variant="outline">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Latest Articles
                  </Badge>
                  <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                    Repair Tips & Guides
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    Expert advice to help you maintain and care for your devices
                  </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                  {featuredPosts.map((post) => (
                    <Card key={post._id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="relative overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge>{post.category.name}</Badge>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-2 mb-4">
                          <Avatar>
                            <AvatarImage src={post.author.avatar} />
                            <AvatarFallback>
                              {post.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{post.author.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3 inline" />
                              {new Date(post.publishedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button asChild className="w-full">
                          <Link to={`/blog/${post.slug}`}>
                            Read More
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* Default Hero Section */}
          <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative container mx-auto px-6 py-24 lg:py-32">
              <div className="grid gap-12 lg:grid-cols-2 items-center">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Zap className="h-3 w-3 mr-1" />
                      Professional Repair Services
                    </Badge>
                    <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                      Fix Your Device
                      <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                        Like New Again
                      </span>
                    </h1>
                    <p className="text-xl text-blue-100 max-w-lg">
                      Fast, reliable, and affordable repair services for all your devices.
                      Expert technicians, quality parts, and warranty included.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg" asChild>
                      <Link to="/register">
                        <Smartphone className="h-5 w-5 mr-2" />
                        Start Repair Order
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                      <Link to="/login">
                        <Play className="h-5 w-5 mr-2" />
                        Watch Demo
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-8 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">10K+</div>
                      <div className="text-sm text-blue-200">Devices Repaired</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">4.9★</div>
                      <div className="text-sm text-blue-200">Customer Rating</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">24h</div>
                      <div className="text-sm text-blue-200">Average Turnaround</div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Free Diagnostics</h3>
                          <p className="text-sm text-blue-100">Complete device assessment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Warranty Included</h3>
                          <p className="text-sm text-blue-100">90-day repair guarantee</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Quick Turnaround</h3>
                          <p className="text-sm text-blue-100">Most repairs in 24 hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-20"></div>
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-20"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Default Services Section */}
          <section className="py-20 bg-white dark:bg-gray-800">
            <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                <Badge className="mb-4" variant="outline">
                  <Wrench className="h-3 w-3 mr-1" />
                  Our Services
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  Expert Repair Services
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Professional repair services for all major device brands with quality parts and expert technicians
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <Card key={service._id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                    <CardHeader>
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Smartphone className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="group-hover:text-blue-600 transition-colors">
                        {service.name}
                      </CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-2xl font-bold text-green-600">
                          ${service.price}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {service.estimatedTime}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {service.popularity}% satisfaction
                        </span>
                      </div>
                      <Button className="w-full group-hover:bg-blue-600 transition-colors" asChild>
                        <Link to="/register">
                          Get Quote
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Default Testimonials Section */}
          <section className="py-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                <Badge className="mb-4" variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  Customer Reviews
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  What Our Customers Say
                </h2>
                <p className="text-xl text-muted-foreground">
                  Thousands of satisfied customers trust us with their devices
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-3">
                {[
                  {
                    name: "Sarah Johnson",
                    role: "Business Owner",
                    avatar: "https://via.placeholder.com/60x60/3b82f6/ffffff?text=SJ",
                    rating: 5,
                    review: "Incredible service! My iPhone was fixed in just 2 hours and works perfectly. The staff was professional and the price was very reasonable."
                  },
                  {
                    name: "Mike Chen",
                    role: "Student",
                    avatar: "https://via.placeholder.com/60x60/10b981/ffffff?text=MC",
                    rating: 5,
                    review: "Best repair shop in town! They fixed my laptop screen and it looks brand new. Fast service and great warranty coverage."
                  },
                  {
                    name: "Emily Davis",
                    role: "Teacher",
                    avatar: "https://via.placeholder.com/60x60/8b5cf6/ffffff?text=ED",
                    rating: 5,
                    review: "Amazing experience from start to finish. Online booking was easy, updates were frequent, and my device was ready ahead of schedule."
                  }
                ].map((testimonial, index) => (
                  <Card key={index} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-gray-700 mb-6 italic">"{testimonial.review}"</p>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={testimonial.avatar} />
                          <AvatarFallback>{testimonial.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{testimonial.name}</div>
                          <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}