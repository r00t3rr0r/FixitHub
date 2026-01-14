import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { DeviceSelectionHero } from '@/components/home/DeviceSelectionHero';
import { ServicesOverview } from '@/components/home/ServicesOverview';
import { DevicesSection } from '@/components/home/DevicesSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { ShopSection } from '@/components/home/ShopSection';
import { BlogCarousel } from '@/components/home/BlogCarousel';
import { TestimonialsCarousel } from '@/components/home/TestimonialsCarousel';
import { AboutUsSection } from '@/components/home/AboutUsSection';
import { ContactSection } from '@/components/home/ContactSection';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CartIcon } from '@/components/CartIcon';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { saveDeviceInfo } from '@/utils/deviceDetection';

export function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload logo image for fade-in effect
  useEffect(() => {
    const img = new Image();
    img.src = 'https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png';
    img.onload = () => {
      console.log('Home: Shop logo loaded successfully');
      setLogoLoaded(true);
    };
    img.onerror = () => {
      console.error('Home: Failed to load shop logo');
      setLogoLoaded(true); // Show placeholder if image fails
    };
  }, []);

  // Detect and save device information on homepage load
  useEffect(() => {
    console.log('Home: Detecting and saving device information...');
    saveDeviceInfo();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header with Animations */}
      <header className="border-b sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo with fade-in animation */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="relative transition-all duration-300 group-hover:scale-105"
              style={{
                opacity: logoLoaded ? 1 : 0,
                transform: logoLoaded ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
              }}
            >
              <img
                src="https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png"
                alt="FixitHub Logo"
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  console.error('Home: Logo image failed to load');
                  // Show fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Fallback logo if image fails */}
              <div
                className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center"
                style={{ display: 'none' }}
              >
                <span className="text-gray-900 font-bold text-lg">FH</span>
              </div>

              {/* Subtle glow effect on hover */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-yellow-400 blur-md -z-10" />
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:inline-block group-hover:text-yellow-600 transition-colors duration-200">
              FixitHub
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#services"
              className="text-gray-600 hover:text-yellow-600 transition-colors duration-200 font-medium relative group"
            >
              {t('home.nav.services')}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#about"
              className="text-gray-600 hover:text-yellow-600 transition-colors duration-200 font-medium relative group"
            >
              {t('home.nav.about')}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
            </a>
            <a
              href="#contact"
              className="text-gray-600 hover:text-yellow-600 transition-colors duration-200 font-medium relative group"
            >
              {t('home.nav.contact')}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
            </a>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Language Selector with hover effect */}
            <LanguageSelector />

            {/* Shopping Cart with item count and bounce animation */}
            <CartIcon />

            {/* Auth-based navigation */}
            {isAuthenticated ? (
              <ProfileDropdown />
            ) : (
              <>
                <Button
                  variant="outline"
                  asChild
                  className="hidden sm:inline-flex border-gray-300 hover:border-yellow-400 hover:text-yellow-600 transition-all duration-200"
                >
                  <Link to="/login">{t('navigation.login')}</Link>
                </Button>
                <Button
                  asChild
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Link to="/register">{t('home.nav.getStarted')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Device Selection */}
      <DeviceSelectionHero />

      {/* Services Overview - Step by Step */}
      <ServicesOverview />

      {/* Device Types */}
      <DevicesSection />

      {/* Shop Section */}
      <ShopSection />

      {/* Features */}
      <FeaturesSection />

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
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png"
                  alt="FixitHub Logo"
                  className="h-10 w-auto object-contain brightness-0 invert"
                  onError={(e) => {
                    // Fallback to text logo
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-10 h-10 bg-yellow-400 rounded-lg items-center justify-center hidden">
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