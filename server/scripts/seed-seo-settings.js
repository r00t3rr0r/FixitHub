const mongoose = require('mongoose');
require('dotenv').config();

const SEOSettings = require('../models/SEOSettings');
const User = require('../models/User');

const seoData = [
  // Global Settings
  {
    pageType: 'global',
    pageId: '',
    title: 'FixitHub - Professioneller Handy & Tablet Reparaturservice',
    description: 'Schnelle und zuverlässige Reparatur für Smartphones, Tablets und Laptops. Kostenlose Diagnose, Express-Service verfügbar. Jetzt Termin vereinbaren!',
    keywords: ['Handy Reparatur', 'Smartphone Reparatur', 'Display Reparatur', 'iPhone Reparatur', 'Samsung Reparatur', 'Tablet Reparatur', 'Laptop Reparatur', 'Akku Tausch', 'Wasserschaden Reparatur'],
    canonicalUrl: 'https://fixithub.de',
    openGraph: {
      title: 'FixitHub - Professioneller Geräte-Reparaturservice',
      description: 'Ihr vertrauenswürdiger Partner für schnelle und professionelle Reparaturen. Express-Service, faire Preise, Garantie.',
      image: 'https://fixithub.de/og-image-main.jpg',
      type: 'website',
      url: 'https://fixithub.de'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'FixitHub - Professionelle Geräte-Reparatur',
      description: 'Schnelle Reparatur für Smartphones, Tablets & Laptops. Kostenlose Diagnose.',
      image: 'https://fixithub.de/twitter-card-main.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'FixitHub',
      description: 'Professioneller Reparaturservice für mobile Geräte',
      telephone: '+49-xxx-xxxxxxx',
      priceRange: '€€',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'DE'
      }
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 1.0,
    changeFreq: 'daily',
    isActive: true
  },
  
  // Homepage
  {
    pageType: 'homepage',
    pageId: '',
    title: 'FixitHub - Ihre Werkstatt für Handy & Tablet Reparatur',
    description: 'Professionelle Reparatur innerhalb 24h. Display-Tausch, Akku-Wechsel, Wasserschaden-Rettung. Kostenlose Diagnose & 12 Monate Garantie. Jetzt online buchen!',
    keywords: ['Handy Reparatur Service', 'Display Reparatur', 'Smartphone Display Wechsel', 'iPhone Display Reparatur', 'Express Reparatur', 'Handy Werkstatt', 'Mobile Reparatur'],
    canonicalUrl: 'https://fixithub.de/',
    openGraph: {
      title: 'FixitHub - Express Reparaturservice für Smartphones & Tablets',
      description: 'Reparatur in 24h ✓ Kostenlose Diagnose ✓ 12 Monate Garantie ✓ Faire Preise',
      image: 'https://fixithub.de/og-image-homepage.jpg',
      type: 'website',
      url: 'https://fixithub.de/'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'FixitHub - Express Reparaturservice',
      description: 'Reparatur in 24h ✓ Kostenlose Diagnose ✓ 12 Monate Garantie',
      image: 'https://fixithub.de/twitter-homepage.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Homepage',
      description: 'FixitHub Reparaturservice Homepage'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 1.0,
    changeFreq: 'daily',
    isActive: true
  },
  
  // Shop Page
  {
    pageType: 'page',
    pageId: 'shop',
    title: 'Reparaturservice buchen - Alle Geräte & Services | FixitHub',
    description: 'Wählen Sie Ihr Gerät und buchen Sie den passenden Reparaturservice. Faire Festpreise, schnelle Bearbeitung, professionelle Technik. Jetzt online buchen!',
    keywords: ['Reparatur buchen', 'Handy Reparatur Preis', 'iPhone Reparatur Kosten', 'Display Reparatur Preis', 'Reparaturservice online buchen'],
    canonicalUrl: 'https://fixithub.de/shop',
    openGraph: {
      title: 'Reparaturservice online buchen | FixitHub',
      description: 'Transparente Festpreise ✓ Schnelle Bearbeitung ✓ Alle Marken & Modelle',
      image: 'https://fixithub.de/og-image-shop.jpg',
      type: 'website',
      url: 'https://fixithub.de/shop'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'Reparaturservice buchen | FixitHub',
      description: 'Transparente Festpreise für alle Reparaturen',
      image: 'https://fixithub.de/twitter-shop.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Reparaturservices',
      description: 'Übersicht aller verfügbaren Reparaturservices'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.9,
    changeFreq: 'weekly',
    isActive: true
  },
  
  // About Page
  {
    pageType: 'page',
    pageId: 'about',
    title: 'Über uns - Ihr professioneller Reparaturservice | FixitHub',
    description: 'Erfahren Sie mehr über FixitHub: Unser erfahrenes Team, modernste Technik und unser Qualitätsversprechen. Seit Jahren Ihr vertrauenswürdiger Partner.',
    keywords: ['Über FixitHub', 'Reparaturwerkstatt', 'Professionelle Reparatur', 'Handy Werkstatt Team'],
    canonicalUrl: 'https://fixithub.de/about',
    openGraph: {
      title: 'Über FixitHub - Ihr Reparatur-Experte',
      description: 'Erfahrenes Team ✓ Modernste Technik ✓ Qualitätsversprechen',
      image: 'https://fixithub.de/og-image-about.jpg',
      type: 'website',
      url: 'https://fixithub.de/about'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'Über FixitHub',
      description: 'Ihr vertrauenswürdiger Reparatur-Partner',
      image: 'https://fixithub.de/twitter-about.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Über uns'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.7,
    changeFreq: 'monthly',
    isActive: true
  },
  
  // Contact Page
  {
    pageType: 'page',
    pageId: 'contact',
    title: 'Kontakt - FixitHub Reparaturservice | Kostenlose Beratung',
    description: 'Kontaktieren Sie uns für eine kostenlose Beratung. Telefon, E-Mail oder Live-Chat. Schnelle Antworten auf Ihre Fragen zu Reparaturen und Preisen.',
    keywords: ['Kontakt Reparaturservice', 'Reparatur Beratung', 'FixitHub Kontakt', 'Reparatur Anfrage'],
    canonicalUrl: 'https://fixithub.de/contact',
    openGraph: {
      title: 'Kontakt | FixitHub Reparaturservice',
      description: 'Kostenlose Beratung ✓ Schnelle Antworten ✓ Persönlicher Service',
      image: 'https://fixithub.de/og-image-contact.jpg',
      type: 'website',
      url: 'https://fixithub.de/contact'
    },
    twitterCard: {
      card: 'summary',
      title: 'Kontakt | FixitHub',
      description: 'Wir helfen Ihnen gerne weiter',
      image: 'https://fixithub.de/twitter-contact.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Kontakt'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.6,
    changeFreq: 'monthly',
    isActive: true
  },
  
  // Blog Overview
  {
    pageType: 'page',
    pageId: 'blog',
    title: 'Ratgeber & News - Tipps zur Gerätepflege | FixitHub Blog',
    description: 'Expertentipps zur Smartphone-Pflege, aktuelle News zu Reparaturen und praktische Anleitungen. Bleiben Sie informiert mit dem FixitHub Ratgeber.',
    keywords: ['Handy Ratgeber', 'Smartphone Tipps', 'Reparatur News', 'Gerätepflege', 'Handy Pflege Tipps'],
    canonicalUrl: 'https://fixithub.de/blog',
    openGraph: {
      title: 'FixitHub Blog - Ratgeber & News',
      description: 'Expertentipps, News und Anleitungen rund um Smartphone-Reparatur',
      image: 'https://fixithub.de/og-image-blog.jpg',
      type: 'website',
      url: 'https://fixithub.de/blog'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'FixitHub Ratgeber',
      description: 'Tipps und News zu Smartphone-Reparaturen',
      image: 'https://fixithub.de/twitter-blog.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'FixitHub Blog'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.8,
    changeFreq: 'weekly',
    isActive: true
  },
  
  // FAQ Page
  {
    pageType: 'page',
    pageId: 'faq',
    title: 'Häufig gestellte Fragen (FAQ) - Reparaturservice | FixitHub',
    description: 'Antworten auf häufige Fragen zu Reparaturen, Preisen, Garantie und Ablauf. Finden Sie schnell die Informationen, die Sie benötigen.',
    keywords: ['FAQ Reparatur', 'Reparatur Fragen', 'Garantie Reparatur', 'Reparatur Ablauf', 'Handy Reparatur FAQ'],
    canonicalUrl: 'https://fixithub.de/faq',
    openGraph: {
      title: 'FAQ - Häufige Fragen | FixitHub',
      description: 'Schnelle Antworten auf Ihre Fragen zu Reparaturen',
      image: 'https://fixithub.de/og-image-faq.jpg',
      type: 'website',
      url: 'https://fixithub.de/faq'
    },
    twitterCard: {
      card: 'summary',
      title: 'FAQ | FixitHub',
      description: 'Häufig gestellte Fragen',
      image: 'https://fixithub.de/twitter-faq.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      name: 'Häufig gestellte Fragen'
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.7,
    changeFreq: 'monthly',
    isActive: true
  },
  
  // Privacy Policy
  {
    pageType: 'page',
    pageId: 'privacy',
    title: 'Datenschutzerklärung | FixitHub',
    description: 'Informationen zum Datenschutz und zur Verarbeitung Ihrer personenbezogenen Daten bei FixitHub. DSGVO-konform.',
    keywords: ['Datenschutz', 'DSGVO', 'Datenschutzerklärung', 'Datensicherheit'],
    canonicalUrl: 'https://fixithub.de/privacy',
    openGraph: {
      title: 'Datenschutzerklärung | FixitHub',
      description: 'Informationen zum Datenschutz',
      image: 'https://fixithub.de/og-image-legal.jpg',
      type: 'website',
      url: 'https://fixithub.de/privacy'
    },
    twitterCard: {
      card: 'summary',
      title: 'Datenschutz | FixitHub',
      description: 'Datenschutzerklärung',
      image: 'https://fixithub.de/twitter-legal.jpg'
    },
    schemaMarkup: {},
    robots: {
      index: true,
      follow: false,
      noarchive: true,
      nosnippet: false
    },
    priority: 0.3,
    changeFreq: 'yearly',
    isActive: true
  },
  
  // Terms of Service
  {
    pageType: 'page',
    pageId: 'terms',
    title: 'AGB - Allgemeine Geschäftsbedingungen | FixitHub',
    description: 'Allgemeine Geschäftsbedingungen für Reparaturservices von FixitHub. Rechtliche Informationen zu Verträgen, Garantie und Haftung.',
    keywords: ['AGB', 'Geschäftsbedingungen', 'Nutzungsbedingungen', 'Reparatur AGB'],
    canonicalUrl: 'https://fixithub.de/terms',
    openGraph: {
      title: 'AGB | FixitHub',
      description: 'Allgemeine Geschäftsbedingungen',
      image: 'https://fixithub.de/og-image-legal.jpg',
      type: 'website',
      url: 'https://fixithub.de/terms'
    },
    twitterCard: {
      card: 'summary',
      title: 'AGB | FixitHub',
      description: 'Geschäftsbedingungen',
      image: 'https://fixithub.de/twitter-legal.jpg'
    },
    schemaMarkup: {},
    robots: {
      index: true,
      follow: false,
      noarchive: true,
      nosnippet: false
    },
    priority: 0.3,
    changeFreq: 'yearly',
    isActive: true
  },
  
  // Generic Service Template
  {
    pageType: 'service',
    pageId: 'display-repair',
    title: 'Display Reparatur - Schnell & Professionell | FixitHub',
    description: 'Professionelle Display-Reparatur für alle Smartphone-Modelle. Original-Ersatzteile, Express-Service in 24h, 12 Monate Garantie. Ab 49€. Jetzt buchen!',
    keywords: ['Display Reparatur', 'Bildschirm Reparatur', 'Display Wechsel', 'Display Austausch', 'Handy Display kaputt'],
    canonicalUrl: 'https://fixithub.de/services/display-repair',
    openGraph: {
      title: 'Display Reparatur ab 49€ | FixitHub',
      description: 'Original-Ersatzteile ✓ 24h Express ✓ 12 Monate Garantie',
      image: 'https://fixithub.de/og-image-display-repair.jpg',
      type: 'product',
      url: 'https://fixithub.de/services/display-repair'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'Display Reparatur | FixitHub',
      description: 'Schnelle & professionelle Display-Reparatur',
      image: 'https://fixithub.de/twitter-display-repair.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Display Reparatur',
      description: 'Professionelle Display-Reparatur',
      provider: {
        '@type': 'LocalBusiness',
        name: 'FixitHub'
      }
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.9,
    changeFreq: 'weekly',
    isActive: true
  },
  
  // Generic Blog Post Template
  {
    pageType: 'blog_post',
    pageId: 'smartphone-care-tips',
    title: '10 Tipps zur optimalen Smartphone-Pflege | FixitHub Ratgeber',
    description: 'So schützen Sie Ihr Smartphone vor Schäden: Die besten Tipps zu Display-Schutz, Akku-Pflege und Wasserschutz. Verlängern Sie die Lebensdauer Ihres Geräts!',
    keywords: ['Smartphone Pflege', 'Handy schützen', 'Display Schutz', 'Akku Pflege', 'Smartphone Tipps'],
    canonicalUrl: 'https://fixithub.de/blog/smartphone-care-tips',
    openGraph: {
      title: '10 Tipps zur optimalen Smartphone-Pflege',
      description: 'Schützen Sie Ihr Smartphone vor Schäden - Expertentipps',
      image: 'https://fixithub.de/og-image-blog-smartphone-care.jpg',
      type: 'article',
      url: 'https://fixithub.de/blog/smartphone-care-tips'
    },
    twitterCard: {
      card: 'summary_large_image',
      title: 'Smartphone-Pflege Tipps',
      description: 'Die besten Tipps zum Schutz Ihres Smartphones',
      image: 'https://fixithub.de/twitter-blog-smartphone-care.jpg'
    },
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: '10 Tipps zur optimalen Smartphone-Pflege',
      author: {
        '@type': 'Organization',
        name: 'FixitHub'
      }
    },
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    priority: 0.6,
    changeFreq: 'monthly',
    isActive: true
  },
  
  // Customer Portal
  {
    pageType: 'page',
    pageId: 'customer-portal',
    title: 'Mein Konto - Aufträge verwalten | FixitHub',
    description: 'Verwalten Sie Ihre Reparaturaufträge, verfolgen Sie den Status und greifen Sie auf Ihre Rechnungen zu. Ihr persönlicher Kundenbereich.',
    keywords: ['Kundenportal', 'Auftrag verfolgen', 'Reparatur Status', 'Mein Konto'],
    canonicalUrl: 'https://fixithub.de/customer-portal',
    openGraph: {
      title: 'Kundenportal | FixitHub',
      description: 'Verwalten Sie Ihre Reparaturaufträge',
      image: 'https://fixithub.de/og-image-portal.jpg',
      type: 'website',
      url: 'https://fixithub.de/customer-portal'
    },
    twitterCard: {
      card: 'summary',
      title: 'Kundenportal | FixitHub',
      description: 'Ihr persönlicher Bereich',
      image: 'https://fixithub.de/twitter-portal.jpg'
    },
    schemaMarkup: {},
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true
    },
    priority: 0.2,
    changeFreq: 'never',
    isActive: true
  }
];

async function seedSEOSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✓ Connected to MongoDB');

    // Find an admin user to assign as creator
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.error('✗ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`✓ Using admin user: ${adminUser.email}`);

    // Clear existing SEO settings (optional)
    const existingCount = await SEOSettings.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠ Found ${existingCount} existing SEO settings.`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Delete existing settings? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'y') {
        await SEOSettings.deleteMany({});
        console.log('✓ Deleted existing SEO settings');
      }
    }

    // Insert SEO settings
    let created = 0;
    let updated = 0;

    for (const seoSetting of seoData) {
      const existing = await SEOSettings.findOne({
        pageType: seoSetting.pageType,
        pageId: seoSetting.pageId
      });

      if (existing) {
        await SEOSettings.findByIdAndUpdate(existing._id, {
          ...seoSetting,
          updatedBy: adminUser._id,
          updatedAt: new Date()
        });
        updated++;
        console.log(`↻ Updated: ${seoSetting.pageType}/${seoSetting.pageId || 'default'}`);
      } else {
        await SEOSettings.create({
          ...seoSetting,
          createdBy: adminUser._id,
          updatedBy: adminUser._id
        });
        created++;
        console.log(`✓ Created: ${seoSetting.pageType}/${seoSetting.pageId || 'default'}`);
      }
    }

    console.log('\n========================================');
    console.log('SEO Settings Seeding Complete!');
    console.log('========================================');
    console.log(`✓ Created: ${created} new settings`);
    console.log(`↻ Updated: ${updated} existing settings`);
    console.log(`━ Total: ${created + updated} SEO settings configured`);
    console.log('========================================\n');

    // Summary
    const totalSettings = await SEOSettings.countDocuments();
    const indexablePages = await SEOSettings.countDocuments({ 'robots.index': true });
    const pageTypes = await SEOSettings.aggregate([
      { $group: { _id: '$pageType', count: { $sum: 1 } } }
    ]);

    console.log('📊 Summary:');
    console.log(`   Total SEO Settings: ${totalSettings}`);
    console.log(`   Indexable Pages: ${indexablePages}`);
    console.log(`   Non-indexable Pages: ${totalSettings - indexablePages}`);
    console.log('\n   By Page Type:');
    pageTypes.forEach(type => {
      console.log(`   - ${type._id}: ${type.count}`);
    });

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding SEO settings:', error);
    process.exit(1);
  }
}

// Run the seeding
seedSEOSettings();
