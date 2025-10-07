import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Smartphone, Tablet, Laptop, Monitor, Star, ArrowRight, CheckCircle, Users, Award, Clock, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Home() {
  const [email, setEmail] = useState('');

  const deviceTypes = [
    { icon: Smartphone, name: 'Smartphones', description: 'iPhone, Samsung, Google Pixel' },
    { icon: Tablet, name: 'Tablets', description: 'iPad, Android tablets' },
    { icon: Laptop, name: 'Laptops', description: 'MacBook, Windows laptops' },
    { icon: Monitor, name: 'Desktops', description: 'iMac, PC repairs' }
  ];

  const services = [
    { name: 'Screen Repair', price: 'From $89', popular: true },
    { name: 'Battery Replacement', price: 'From $59', popular: false },
    { name: 'Water Damage', price: 'From $129', popular: false },
    { name: 'Data Recovery', price: 'From $99', popular: true }
  ];

  const features = [
    { icon: CheckCircle, title: 'Quality Guarantee', description: '90-day warranty on all repairs' },
    { icon: Clock, title: 'Fast Turnaround', description: 'Most repairs completed same day' },
    { icon: Shield, title: 'Certified Technicians', description: 'Expert technicians with years of experience' },
    { icon: Users, title: '24/7 Support', description: 'Customer support whenever you need it' }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      rating: 5,
      comment: 'Excellent service! My iPhone was repaired quickly and works perfectly.',
      device: 'iPhone 13 Pro'
    },
    {
      name: 'Mike Chen',
      rating: 5,
      comment: 'Professional staff and fair pricing. Highly recommend!',
      device: 'Samsung Galaxy S22'
    },
    {
      name: 'Emily Davis',
      rating: 5,
      comment: 'Saved my laptop with water damage. Great work!',
      device: 'MacBook Air'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FH</span>
            </div>
            <span className="text-xl font-bold">FixitHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#services" className="text-muted-foreground hover:text-foreground">Services</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground">About</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Professional Device Repair
            <span className="text-primary block">You Can Trust</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Expert repair services for smartphones, tablets, laptops, and more. 
            Fast turnaround, quality guarantee, and transparent pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Book Repair Now</Link>
            </Button>
            <Button size="lg" variant="outline">
              Get Quote
            </Button>
          </div>
        </div>
      </section>

      {/* Device Types */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">We Repair All Devices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {deviceTypes.map((device, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <device.icon className="h-12 w-12 mx-auto text-primary mb-4" />
                  <CardTitle>{device.name}</CardTitle>
                  <CardDescription>{device.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="relative">
                {service.popular && (
                  <Badge className="absolute -top-2 -right-2 bg-primary">Popular</Badge>
                )}
                <CardHeader>
                  <CardTitle>{service.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-primary">
                    {service.price}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    Learn More <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose FixitHub?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <feature.icon className="h-12 w-12 mx-auto text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What Our Customers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <CardDescription>"{testimonial.comment}"</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.device}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Your Device Fixed?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of satisfied customers who trust FixitHub with their device repairs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Input
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background text-foreground"
            />
            <Button variant="secondary">
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">FH</span>
                </div>
                <span className="text-xl font-bold">FixitHub</span>
              </div>
              <p className="text-muted-foreground">
                Professional device repair services you can trust.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Screen Repair</a></li>
                <li><a href="#" className="hover:text-foreground">Battery Replacement</a></li>
                <li><a href="#" className="hover:text-foreground">Water Damage</a></li>
                <li><a href="#" className="hover:text-foreground">Data Recovery</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About Us</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Warranty</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-muted-foreground">
            <p>&copy; 2024 FixitHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}