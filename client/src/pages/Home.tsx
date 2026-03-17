import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { DeviceSelectionHero } from '@/components/home/DeviceSelectionHero';
import { TrustRow } from '@/components/home/TrustRow';
import { SpecialOffers } from '@/components/home/SpecialOffers';
import { ServicesOverview } from '@/components/home/ServicesOverview';
import { ShopSection } from '@/components/home/ShopSectionSimple';
import { BlogSection } from '@/components/home/BlogSection';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { MobileCTAFab } from '@/components/home/MobileCTAFab';
import { saveDeviceInfo } from '@/utils/deviceDetection';

export function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  // Detect and save device information on homepage load
  useEffect(() => {
    console.log('Home: Detecting and saving device information...');
    saveDeviceInfo();
  }, []);

  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Hero Section with Device Selection */}
      <DeviceSelectionHero />

      {/* Trust Row - 4 Trust Icons */}
      <TrustRow />

      {/* Special Offers Section */}
      <SpecialOffers />

      {/* Services Overview - Step by Step Process */}
      <section id="process" className="section">
        <ServicesOverview />
      </section>

      {/* Shop Section */}
      <section id="shop" className="section section-alt">
        <ShopSection />
      </section>

      {/* Blog Section */}
      <section id="blog" className="section">
        <BlogSection />
      </section>

      {/* Footer with McRepair Design */}
      <Footer />

      {/* Cookie Consent Banner */}
      <CookieBanner />

      {/* Mobile Floating CTA Button */}
      <MobileCTAFab />
    </>
  );
}
