import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { Package, Wrench, ThumbsUp } from 'lucide-react';
import './About.css';

const BASE_URL = 'https://www.mcrepair.de';

const aboutJsonLd = [
  // ── 1. WebPage (AboutPage) ────────────────────────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${BASE_URL}/ueber-uns#webpage`,
    url: `${BASE_URL}/ueber-uns`,
    name: 'Über uns – McRepair.de | Professionelle Smartphone- & Tablet-Reparatur',
    description:
      'McRepair.de – einer der führenden Reparaturdienstleister für Smartphones, Tablets und Notebooks in Deutschland. Über 350 Annahmestellen, zertifizierte Techniker, 1 Jahr Qualitätsgarantie.',
    inLanguage: 'de-DE',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    about: { '@id': `${BASE_URL}/#business` },
    breadcrumb: { '@id': `${BASE_URL}/ueber-uns#breadcrumb` },
    mainEntityOfPage: `${BASE_URL}/ueber-uns`,
  },

  // ── 2. WebSite ────────────────────────────────────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'McRepair.de',
    description: 'Professionelle Reparatur von Smartphones, Tablets und Notebooks in Deutschland.',
    inLanguage: 'de-DE',
    publisher: { '@id': `${BASE_URL}/#business` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/shop?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },

  // ── 3. Organization / LocalBusiness ──────────────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${BASE_URL}/#business`,
    name: 'McRepair.de – Online Point GmbH',
    legalName: 'Online Point GmbH',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${BASE_URL}/#logo`,
      url: `${BASE_URL}/logo.png`,
      width: 250,
      height: 60,
      caption: 'McRepair.de Logo',
    },
    image: `${BASE_URL}/og-default.jpg`,
    description:
      'McRepair.de ist einer der führenden Reparaturdienstleister in Deutschland für Smartphones, Tablets und Notebooks. Professionelle Reparaturen mit Qualitätsgarantie, bundesweitem Versand und über 350 Annahmestellen.',
    foundingDate: '2010',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Kurfürstenstr. 106',
      addressLocality: 'Berlin',
      postalCode: '10787',
      addressCountry: 'DE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 52.5019,
      longitude: 13.3542,
    },
    telephone: '+4930403688951',
    email: 'kontakt@mcrepair.de',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Deutschland',
    },
    serviceArea: {
      '@type': 'Country',
      name: 'Deutschland',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Reparaturleistungen',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Smartphone-Reparatur' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Tablet-Reparatur' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Notebook-Reparatur' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Displayreparatur' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Akkutausch' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Wasserschaden-Reparatur' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Datenrettung' } },
      ],
    },
    numberOfEmployees: { '@type': 'QuantitativeValue', minValue: 10, maxValue: 50 },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      bestRating: '5',
      worstRating: '1',
      reviewCount: '10000',
    },
    sameAs: [
      'https://www.facebook.com/mcrepair.de',
      'https://www.instagram.com/mcrepair.de',
      'https://twitter.com/mcrepairde',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+4930403688951',
        contactType: 'customer service',
        availableLanguage: 'German',
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '10:00',
          closes: '16:00',
        },
      },
    ],
  },

  // ── 4. BreadcrumbList ─────────────────────────────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}/ueber-uns#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Über uns', item: `${BASE_URL}/ueber-uns` },
    ],
  },

  // ── 5. HowTo – Reparaturablauf in 4 Schritten ────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${BASE_URL}/ueber-uns#howto`,
    name: 'So funktioniert die Reparatur bei McRepair.de',
    description:
      'In 4 einfachen Schritten zur professionellen Smartphone-, Tablet- oder Notebook-Reparatur: online buchen, Gerät einsenden, Reparatur durchführen lassen und repariertes Gerät zurückerhalten.',
    totalTime: 'P3D',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Gerät und Reparatur auswählen',
        text: 'Wählen Sie Ihr Gerät und die benötigte Reparatur aus unserem umfangreichen Angebot – Display, Akku, Wasserschaden, Datenrettung und mehr.',
        url: `${BASE_URL}/new-order`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Gerät kostenlos einsenden oder vorbeibringen',
        text: 'Nutzen Sie unseren kostenlosen DHL-Versandservice oder geben Sie Ihr Gerät an einer unserer über 350 Annahmestellen in Deutschland ab.',
        url: `${BASE_URL}/annahmestellen`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Wir reparieren es schnell und zuverlässig',
        text: 'Unsere zertifizierten Techniker reparieren Ihr Gerät in der Regel in 1–3 Werktagen, Express auch in 24 Stunden. Original- und Markenersatzteile inklusive.',
        url: `${BASE_URL}/ueber-uns`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Repariertes Gerät zurückerhalten',
        text: 'Ihr Gerät wird sicher per DHL an Sie zurückgeschickt oder kann an der Annahmestelle abgeholt werden – mit 1 Jahr Qualitätsgarantie.',
        url: `${BASE_URL}/ueber-uns`,
      },
    ],
    tool: [
      { '@type': 'HowToTool', name: 'Kostenloser DHL-Versand' },
      { '@type': 'HowToTool', name: 'Online-Buchungssystem' },
      { '@type': 'HowToTool', name: 'Echtzeit-Reparaturstatus' },
    ],
  },

  // ── 6. ItemList – Unterstützte Hersteller ─────────────────────────────────
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${BASE_URL}/ueber-uns#manufacturers`,
    name: 'Reparatur aller namhaften Hersteller',
    description:
      'McRepair.de führt Reparaturen für alle namhaften Smartphone-, Tablet- und Notebook-Hersteller durch.',
    numberOfItems: 8,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Apple Reparatur (iPhone, iPad, MacBook)', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 2, name: 'Samsung Reparatur (Galaxy, Note, Tab)', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 3, name: 'Sony Reparatur (Xperia)', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 4, name: 'Google Reparatur (Pixel)', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 5, name: 'Asus Reparatur', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 6, name: 'LG Reparatur', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 7, name: 'OnePlus Reparatur', url: `${BASE_URL}/new-order` },
      { '@type': 'ListItem', position: 8, name: 'Motorola Reparatur', url: `${BASE_URL}/new-order` },
    ],
  },
];

export function About() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Über uns – McRepair.de | Smartphone- & Tablet-Reparatur Experten"
        description="McRepair.de – professionelle Reparatur von Smartphones, Tablets & Notebooks. Über 350 Annahmestellen, zertifizierte Techniker, 1 Jahr Garantie & kostenloser Versand."
        canonical="/ueber-uns"
        keywords="McRepair, Smartphone Reparatur, Handy Reparatur, Tablet Reparatur, Notebook Reparatur, Display Reparatur, Akkutausch, Wasserschaden, Datenrettung, Berlin, Deutschland, Annahmestellen, Reparatur Service, Apple Reparatur, Samsung Reparatur"
        ogImage={`${BASE_URL}/bilder/ueberuns/galerie/mcrepair_werkstatt.jpg`}
        jsonLd={aboutJsonLd}
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <main className="about-page" itemScope itemType="https://schema.org/AboutPage">
        {/* Machine-readable feature summary for search engines */}
        <div className="sr-only" aria-hidden="true">
          <p>McRepair.de – professioneller Reparaturservice für Smartphones, Tablets und Notebooks in Deutschland.</p>
          <ul>
            <li>Smartphone-Reparatur: Display, Akku, Kamera, Ladeanschluss, Wasserschaden, Datenrettung</li>
            <li>Tablet-Reparatur: iPad, Samsung Galaxy Tab, Android Tablets</li>
            <li>Notebook-Reparatur: MacBook, Windows Laptops, Asus, Lenovo, Dell</li>
            <li>Express-Reparatur: 24-Stunden-Service verfügbar</li>
            <li>Kostenloser DHL-Versand: Hin- und Rücksendung gratis</li>
            <li>Über 350 Annahmestellen in ganz Deutschland</li>
            <li>1 Jahr Qualitätsgarantie auf alle Reparaturen</li>
            <li>Zertifizierte Techniker mit über 20 Jahren Erfahrung</li>
            <li>Unterstützte Hersteller: Apple, Samsung, Sony, Google, Asus, LG, OnePlus, Motorola, HTC, Huawei</li>
            <li>Online-Reparaturstatus-Tracking in Echtzeit</li>
            <li>Sichere Verpackung und DHL-versicherter Transport</li>
            <li>Transparente Festpreise ohne versteckte Kosten</li>
          </ul>
        </div>

        <div className="container">
          <div className="about-content" itemProp="mainContentOfPage">
            {/* Header */}
            <header className="about-header" itemProp="name" content="Über McRepair.de">
              <h1 itemProp="headline">{t('aboutPage.header.title')}</h1>
              <div className="accent-line"></div>
              <p className="about-intro" itemProp="description">{t('aboutPage.header.intro')}</p>
            </header>

            {/* How it works */}
            <section
              className="about-section steps-section"
              aria-label="Reparaturablauf in 4 Schritten"
              itemScope
              itemType="https://schema.org/HowTo"
            >
              <h2 className="section-title-center" itemProp="name">{t('aboutPage.steps.title')}</h2>
              <div className="steps-grid">
                <div className="step-card" itemScope itemType="https://schema.org/HowToStep" itemProp="step">
                  <div className="step-number" aria-hidden="true">1</div>
                  <div className="step-icon" aria-hidden="true">
                    <Package />
                  </div>
                  <h3 itemProp="name">{t('aboutPage.steps.step1Title')}</h3>
                  <p itemProp="text">{t('aboutPage.steps.step1Desc')}</p>
                </div>
                <div className="step-card" itemScope itemType="https://schema.org/HowToStep" itemProp="step">
                  <div className="step-number" aria-hidden="true">2</div>
                  <div className="step-icon" aria-hidden="true">
                    <Package />
                  </div>
                  <h3 itemProp="name">{t('aboutPage.steps.step2Title')}</h3>
                  <p itemProp="text">{t('aboutPage.steps.step2Desc')}</p>
                </div>
                <div className="step-card" itemScope itemType="https://schema.org/HowToStep" itemProp="step">
                  <div className="step-number" aria-hidden="true">3</div>
                  <div className="step-icon" aria-hidden="true">
                    <Wrench />
                  </div>
                  <h3 itemProp="name">{t('aboutPage.steps.step3Title')}</h3>
                  <p itemProp="text">{t('aboutPage.steps.step3Desc')}</p>
                </div>
                <div className="step-card" itemScope itemType="https://schema.org/HowToStep" itemProp="step">
                  <div className="step-number" aria-hidden="true">4</div>
                  <div className="step-icon" aria-hidden="true">
                    <ThumbsUp />
                  </div>
                  <h3 itemProp="name">{t('aboutPage.steps.step4Title')}</h3>
                  <p itemProp="text">{t('aboutPage.steps.step4Desc')}</p>
                </div>
              </div>
            </section>

            {/* What does McRepair do? */}
            <section
              className="about-section"
              aria-label="Was macht McRepair?"
              itemScope
              itemType="https://schema.org/Service"
            >
              <h2 itemProp="name">{t('aboutPage.whatWeDo.title')}</h2>
              <h3 className="subtitle">{t('aboutPage.whatWeDo.subtitle')}</h3>
              <p itemProp="description">{t('aboutPage.whatWeDo.text')}</p>
              <span className="sr-only" itemProp="provider" itemScope itemType="https://schema.org/Organization">
                <span itemProp="name">McRepair.de – Online Point GmbH</span>
                <span itemProp="url">https://www.mcrepair.de</span>
              </span>
            </section>

            {/* What sets us apart */}
            <section
              className="about-section highlight-section"
              aria-label="Unsere Stärken"
              itemScope
              itemType="https://schema.org/Organization"
            >
              <h2>{t('aboutPage.whyUs.title')}</h2>
              <div className="highlight-box">
                <h3 itemProp="description">{t('aboutPage.whyUs.highlightTitle')}</h3>
                <p>{t('aboutPage.whyUs.highlightText')}</p>
              </div>
              {/* Machine-readable trust signals */}
              <ul className="sr-only">
                <li>Über 350 Annahmestellen bundesweit</li>
                <li>Kostenloser DHL-Versand hin und zurück</li>
                <li>1 Jahr Qualitätsgarantie auf alle Reparaturen</li>
                <li>Qualitativ hochwertige Originalersatzteile</li>
                <li>Zertifizierte Reparaturtechniker</li>
                <li>Reparatur mit Datenerhalt</li>
              </ul>
            </section>

            {/* Gallery */}
            <section className="about-section gallery-section" aria-label="Einblick in unsere Werkstatt">
              <h2 className="section-title-center">{t('aboutPage.gallery.title')}</h2>
              <div className="gallery-collage" role="list">
                <div className="gallery-item gallery-large" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_werkstatt.jpg"
                    alt={t('aboutPage.gallery.altWorkshop')}
                    loading="lazy"
                    width="800"
                    height="600"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-medium" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur.jpg"
                    alt={t('aboutPage.gallery.altLaptop')}
                    loading="lazy"
                    width="400"
                    height="300"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-medium" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur2.jpg"
                    alt={t('aboutPage.gallery.altLaptop2')}
                    loading="lazy"
                    width="400"
                    height="300"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-small" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur3.jpg"
                    alt={t('aboutPage.gallery.altPhone3')}
                    loading="lazy"
                    width="300"
                    height="200"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-small" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur2.jpg"
                    alt={t('aboutPage.gallery.altPhone2')}
                    loading="lazy"
                    width="300"
                    height="200"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-medium" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur.jpg"
                    alt={t('aboutPage.gallery.altPhone')}
                    loading="lazy"
                    width="400"
                    height="300"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-small" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch.jpg"
                    alt={t('aboutPage.gallery.altBattery')}
                    loading="lazy"
                    width="300"
                    height="200"
                    itemProp="photo"
                  />
                </div>
                <div className="gallery-item gallery-small" role="listitem">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch2.jpg"
                    alt={t('aboutPage.gallery.altBattery2')}
                    loading="lazy"
                    width="300"
                    height="200"
                    itemProp="photo"
                  />
                </div>
              </div>
            </section>

            {/* Drop-off Locations */}
            <section
              className="about-section locations-section"
              aria-label="Annahmestellen in Deutschland"
              itemScope
              itemType="https://schema.org/LocalBusiness"
            >
              <div className="locations-content">
                <div className="locations-text">
                  <h2 itemProp="name">{t('aboutPage.locations.title')}</h2>
                  <h3 className="subtitle">{t('aboutPage.locations.subtitle')}</h3>
                  <p itemProp="description">{t('aboutPage.locations.text1')}</p>
                  <p>{t('aboutPage.locations.text2')}</p>
                  <p>
                    <strong>{t('aboutPage.locations.text3Bold')}</strong>
                    {t('aboutPage.locations.text3Rest')}
                  </p>
                  <span className="sr-only" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                    <span itemProp="streetAddress">Kurfürstenstr. 106</span>,
                    <span itemProp="addressLocality">Berlin</span>,
                    <span itemProp="postalCode">10787</span>,
                    <span itemProp="addressCountry">Deutschland</span>
                  </span>
                </div>
                <div className="locations-image">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/deutschland_annahmestellen.jpg"
                    alt={t('aboutPage.locations.mapAlt')}
                    loading="lazy"
                    width="600"
                    height="500"
                    itemProp="image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Manufacturers */}
            <section
              className="about-section manufacturers-section"
              aria-label="Unterstützte Gerätehersteller"
            >
              <h2 className="section-title-center">{t('aboutPage.manufacturers.title')}</h2>
              <p className="manufacturers-intro">{t('aboutPage.manufacturers.intro')}</p>
              <ul className="manufacturers-grid" role="list" aria-label="Herstellerliste">
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">Sony</div>
                  <p>{t('aboutPage.manufacturers.sonyRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">Google</div>
                  <p>{t('aboutPage.manufacturers.googleRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">Apple</div>
                  <p>{t('aboutPage.manufacturers.appleRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">Asus</div>
                  <p>{t('aboutPage.manufacturers.asusRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">LG</div>
                  <p>{t('aboutPage.manufacturers.lgRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">OnePlus</div>
                  <p>{t('aboutPage.manufacturers.oneplusRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">Motorola</div>
                  <p>{t('aboutPage.manufacturers.motorolaRepair')}</p>
                </li>
                <li className="manufacturer-card" itemScope itemType="https://schema.org/Brand">
                  <div className="manufacturer-name" itemProp="name">HTC</div>
                  <p>{t('aboutPage.manufacturers.htcRepair')}</p>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
