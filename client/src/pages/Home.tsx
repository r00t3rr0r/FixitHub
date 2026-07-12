import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { DeviceSelectionHero } from '@/components/home/DeviceSelectionHero';
import { TrustRow } from '@/components/home/TrustRow';
import { ServicesOverview } from '@/components/home/ServicesOverview';
import { ShopSection } from '@/components/home/ShopSectionSimple';
import { SatisfiedCustomersSection } from '@/components/home/SatisfiedCustomersSection';
import { BlogSection } from '@/components/home/BlogSection';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { ScrollToTopButton } from '@/components/home/ScrollToTopButton';
import { saveDeviceInfo } from '@/utils/deviceDetection';
import { SEO } from '@/components/SEO'

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
      <SEO
        title="Smartphone Reparatur – Express-Service mit Garantie"
        description="Ihr Smartphone kaputt? Professionelle Smartphone Reparatur mit 12 Monaten Garantie – Displaytausch, Akkuwechsel, Wasserschaden & mehr. Express in 24h. Jetzt online buchen!"
        canonical="/"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Startseite", "item": "https://www.fixithub.de/" },
            { "@type": "ListItem", "position": 2, "name": "Smartphone Reparatur", "item": "https://www.fixithub.de/#hero" },
            { "@type": "ListItem", "position": 3, "name": "Reparaturprozess", "item": "https://www.fixithub.de/#process" }
          ]
        })}</script>
      </Helmet>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Hero Section with Device Selection */}
      <DeviceSelectionHero />

      {/* Trust Row - 4 Trust Icons */}
      <TrustRow />

      {/* Services Overview - Step by Step Process */}
      <section id="process" className="section">
        <ServicesOverview />
      </section>

      {/* Shop Section */}
      <section id="shop" className="section section-alt">
        <ShopSection />
      </section>

      {/* Satisfied Customers Section */}
      <section id="customers" className="section section-customers">
        <SatisfiedCustomersSection />
      </section>

      {/* Blog Section */}
      <section id="blog" className="section section-alt">
        <BlogSection />
      </section>

      {/* Footer with McRepair Design */}
      <Footer />

      {/* Cookie Consent Banner */}
      <CookieBanner />

      {/* Desktop Scroll to Top Button */}
      <ScrollToTopButton />
    </>
  );
}
