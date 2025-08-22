import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Globe,
  Layout,
  Image,
  Type,
  Save,
  Eye,
  Plus,
  Edit
} from "lucide-react"

export function HomepageManagement() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Homepage Management
          </h1>
          <p className="text-muted-foreground">
            Customize your homepage content and layout
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Hero Section
          </CardTitle>
          <CardDescription>Main banner and call-to-action area</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero-title">Hero Title</Label>
            <Input
              id="hero-title"
              defaultValue="Professional Device Repair Services"
              placeholder="Enter hero title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-subtitle">Hero Subtitle</Label>
            <Textarea
              id="hero-subtitle"
              defaultValue="Fast, reliable, and affordable repair services for all your devices"
              placeholder="Enter hero subtitle"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-cta">Call-to-Action Button Text</Label>
            <Input
              id="hero-cta"
              defaultValue="Get Started"
              placeholder="Enter CTA text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-image">Hero Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="hero-image"
                placeholder="Enter image URL or upload"
                className="flex-1"
              />
              <Button variant="outline">
                <Image className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Services Section
          </CardTitle>
          <CardDescription>Highlight your main services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="services-title">Section Title</Label>
            <Input
              id="services-title"
              defaultValue="Our Services"
              placeholder="Enter section title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="services-description">Section Description</Label>
            <Textarea
              id="services-description"
              defaultValue="We offer comprehensive repair services for all types of devices"
              placeholder="Enter section description"
              rows={2}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Featured Services</Label>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
            <div className="space-y-2">
              {['Screen Repair', 'Battery Replacement', 'Water Damage'].map((service, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{service}</span>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testimonials Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Testimonials Section
          </CardTitle>
          <CardDescription>Customer reviews and testimonials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testimonials-title">Section Title</Label>
            <Input
              id="testimonials-title"
              defaultValue="What Our Customers Say"
              placeholder="Enter section title"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Featured Testimonials</Label>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Testimonial
              </Button>
            </div>
            <div className="space-y-2">
              {['John D. - "Excellent service!"', 'Sarah M. - "Quick and professional"'].map((testimonial, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{testimonial}</span>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}