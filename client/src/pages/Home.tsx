import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Smartphone, Tablet, Laptop, Monitor, Star, ArrowRight, CheckCircle, Users, Award, Clock, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { HeroSection } from '@/components/home/HeroSection';
import { ServicesOverview } from '@/components/home/ServicesOverview';
import { ShopSection } from '@/components/home/ShopSection';
import { BlogCarousel } from '@/components/home/BlogCarousel';
import { TestimonialsCarousel } from '@/components/home/TestimonialsCarousel';
import { AboutUsSection } from '@/components/home/AboutUsSection';
import { ContactSection } from '@/components/home/ContactSection';

export function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');

  const deviceTypes = [
    { icon: Smartphone, name: t('home.devices.smartphones'), description: t('home.devices.smartphonesDesc') },
    { icon: Tablet, name: t('home.devices.tablets'), description: t('home.devices.tabletsDesc') },
    { icon: Laptop, name: t('home.devices.laptops'), description: t('home.devices.laptopsDesc') },
    { icon: Monitor, name: t('home.devices.desktops'), description: t('home.devices.desktopsDesc') }
  ];

  const services = [
    { name: t('home.services.screenRepair'), price: `${t('home.services.from')} $89`, popular: true },
    { name: t('home.services.batteryReplacement'), price: `${t('home.services.from')} $59`, popular: false },
    { name: t('home.services.waterDamage'), price: `${t('home.services.from')} $129`, popular: false },
    { name: t('home.services.dataRecovery'), price: `${t('home.services.from')} $99`, popular: true }
  ];

  const features = [
    { icon: CheckCircle, title: t('home.features.qualityGuarantee'), description: t('home.features.qualityDesc') },
    { icon: Clock, title: t('home.features.fastTurnaround'), description: t('home.features.fastDesc') },
    { icon: Shield, title: t('home.features.certifiedTechs'), description: t('home.features.certifiedDesc') },
    { icon: Users, title: t('home.features.support247'), description: t('home.features.supportDesc') }
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
      <header className="border-b sticky top-0 z-50 bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FH</span>
            </div>
            <span className="text-xl font-bold">FixitHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors">{t('home.nav.services')}</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">{t('home.nav.about')}</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">{t('home.nav.contact')}</a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/dashboard">{t('navigation.dashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to="/login">{t('navigation.login')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">{t('home.nav.getStarted')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Background Image */}
      <HeroSection />

      {/* Services Overview - Step by Step */}
      <ServicesOverview />

      {/* Device Types */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.devices.title')}</h2>
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

      {/* Shop Section */}
      <ShopSection />

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.features.title')}</h2>
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

      {/* Blog Carousel */}
      <BlogCarousel />

      {/* Testimonials Carousel */}
      <TestimonialsCarousel />

      {/* About Us Section */}
      <AboutUsSection />

      {/* Contact Section */}
      <ContactSection />

      {/* Footer */}
      <footer className="py-12 border-t bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                  <span className="text-gray-900 font-bold text-sm">FH</span>
                </div>
                <span className="text-xl font-bold">FixitHub</span>
              </div>
              <p className="text-gray-400">
                {t('home.footer.tagline')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.servicesTitle')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('home.services.screenRepair')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.services.batteryReplacement')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.services.waterDamage')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.services.dataRecovery')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.companyTitle')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.aboutUs')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.contact')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.careers')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('navigation.blog')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.supportTitle')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.warranty')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.footer.termsOfService')}</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>{t('home.footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}