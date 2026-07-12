import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
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
import { getRepairCatalog, type RepairCatalogDeviceType } from '@/api/seo'

export function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [repairCatalog, setRepairCatalog] = useState<RepairCatalogDeviceType[]>([]);

  // Detect and save device information on homepage load
  useEffect(() => {
    console.log('Home: Detecting and saving device information...');
    saveDeviceInfo();
  }, []);

  // Fetch repair catalog for crawlable link structure (no loading spinner needed)
  useEffect(() => {
    getRepairCatalog().then(setRepairCatalog).catch(() => {});
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

      {/*
        Crawlable repair catalog navigation (screen-reader only, not shown visually).
        Search engines follow these links to discover all device-type, manufacturer
        and model landing pages, which carry full structured data and service prices.
      */}
      {repairCatalog.length > 0 && (
        <nav aria-label="Reparaturkatalog – alle Gerätetypen und Hersteller" className="sr-only">
          <h2>Reparaturkatalog</h2>
          {repairCatalog.map((dt) => (
            <section key={dt.slug}>
              <h3>
                <Link to={`/reparatur/${dt.slug}`}>{dt.name} Reparatur</Link>
              </h3>
              <ul>
                {dt.manufacturers.map((mfr) => (
                  <li key={mfr.slug}>
                    <Link to={`/reparatur/${dt.slug}/${mfr.slug}`}>
                      {mfr.name} {dt.name} Reparatur
                    </Link>
                    <ul>
                      {mfr.models.map((model) => (
                        <li key={model.slug}>
                          <Link to={`/reparatur/${dt.slug}/${mfr.slug}/${model.slug}`}>
                            {mfr.name} {model.name} Reparatur
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}

      {/* Cookie Consent Banner */}
      <CookieBanner />

      {/* Desktop Scroll to Top Button */}
      <ScrollToTopButton />
    </>
  );
}
