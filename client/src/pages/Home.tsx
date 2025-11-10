import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Smartphone, Tablet, Laptop, Monitor, Star, ArrowRight, CheckCircle, Users, Award, Clock, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

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
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FH</span>
            </div>
            <span className="text-xl font-bold">FixitHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#services" className="text-muted-foreground hover:text-foreground">{t('home.nav.services')}</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground">{t('home.nav.about')}</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground">{t('home.nav.contact')}</a>
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

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {t('home.hero.title')}
            <span className="text-primary block">{t('home.hero.titleHighlight')}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('home.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to={isAuthenticated ? "/new-order" : "/register"}>
                {isAuthenticated ? t('home.hero.bookRepair') : t('home.hero.bookRepair')}
              </Link>
            </Button>
            <Button size="lg" variant="outline">
              {t('home.hero.getQuote')}
            </Button>
          </div>
        </div>
      </section>

      {/* Device Types */}
      <section className="py-16">
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

      {/* Services */}
      <section id="services" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.services.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="relative">
                {service.popular && (
                  <Badge className="absolute -top-2 -right-2 bg-primary">{t('home.services.popular')}</Badge>
                )}
                <CardHeader>
                  <CardTitle>{service.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-primary">
                    {service.price}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    {t('home.services.learnMore')} <ArrowRight className="h-4 w-4 ml-2" />
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

      {/* Testimonials */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.testimonials.title')}</h2>
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
          <h2 className="text-3xl font-bold mb-4">{t('home.cta.title')}</h2>
          <p className="text-xl mb-8 opacity-90">
            {t('home.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Input
              placeholder={t('home.cta.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background text-foreground"
            />
            <Button variant="secondary">
              {t('home.cta.getStarted')}
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
                {t('home.footer.tagline')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.servicesTitle')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">{t('home.services.screenRepair')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.services.batteryReplacement')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.services.waterDamage')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.services.dataRecovery')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.companyTitle')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">{t('home.footer.aboutUs')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.footer.contact')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.footer.careers')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('navigation.blog')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('home.footer.supportTitle')}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">{t('home.footer.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.footer.warranty')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.footer.privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-foreground">{t('home.footer.termsOfService')}</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-muted-foreground">
            <p>{t('home.footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}