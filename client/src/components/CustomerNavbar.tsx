import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CartIcon } from '@/components/CartIcon';
import { ProfileDropdown } from '@/components/ProfileDropdown';

export function CustomerNavbar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload logo image for fade-in effect
  useEffect(() => {
    const img = new Image();
    img.src = 'https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png';
    img.onload = () => {
      console.log('CustomerNavbar: Shop logo loaded successfully');
      setLogoLoaded(true);
    };
    img.onerror = () => {
      console.error('CustomerNavbar: Failed to load shop logo');
      setLogoLoaded(true); // Show placeholder if image fails
    };
  }, []);

  return (
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
                console.error('CustomerNavbar: Logo image failed to load');
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

        {/* Navigation links - hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="/#services"
            className="text-gray-600 hover:text-yellow-600 transition-colors duration-200 font-medium relative group"
          >
            {t('home.nav.services')}
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
          </a>
          <a
            href="/#about"
            className="text-gray-600 hover:text-yellow-600 transition-colors duration-200 font-medium relative group"
          >
            {t('home.nav.about')}
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
          </a>
          <a
            href="/#contact"
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
  );
}
