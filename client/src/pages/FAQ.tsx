import { useState, useEffect, useMemo } from 'react';
import { SEO } from '@/components/SEO'
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { getFAQs, FAQ as FAQType } from '@/api/faq';
import {
  HelpCircle,
  ChevronDown,
  Search,
  Loader2,
  BadgeCheck,
  Mail,
  Phone,
  ArrowRight,
  MessageSquare,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import './FAQ.css';

const categoryIcons: Record<string, any> = {
  'General': MessageSquare,
  'Repairs': Zap,
  'Pricing': Shield,
  'Warranty': Shield,
  'Shipping': Clock,
  'Account': BadgeCheck,
  'Technical': Zap,
};

export function FAQ() {
  const { t } = useTranslation();
  const [groupedFAQs, setGroupedFAQs] = useState<Record<string, FAQType[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  const categories = [
    { value: 'all', label: t('faq.allCategories') },
    { value: 'General', label: t('faq.categories.general') },
    { value: 'Repairs', label: t('faq.categories.repairs') },
    { value: 'Pricing', label: t('faq.categories.pricing') },
    { value: 'Warranty', label: t('faq.categories.warranty') },
    { value: 'Shipping', label: t('faq.categories.shipping') },
    { value: 'Account', label: t('faq.categories.account') },
    { value: 'Technical', label: t('faq.categories.technical') }
  ];

  useEffect(() => {
    fetchFAQs();
  }, [selectedCategory, searchTerm]);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const filters = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        isActive: true
      };

      const response = await getFAQs(filters);
      setGroupedFAQs(response.groupedFAQs || {});
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      if (prev.has(faqId)) {
        const newSet = new Set(prev);
        newSet.delete(faqId);
        return newSet;
      }
      // Only one FAQ open at a time
      return new Set([faqId]);
    });
  };

  /* ─────────────────────────────────────────────────────────────
     JSON-LD structured data – rebuilt whenever FAQs change
  ───────────────────────────────────────────────────────────── */
  const faqJsonLd = useMemo(() => {
    const allFAQs = Object.values(groupedFAQs).flat();

    const webPage = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://www.mcrepair.de/faq',
      url: 'https://www.mcrepair.de/faq',
      name: 'Häufig gestellte Fragen – Reparatur, Preise, Versand & Garantie | McRepair.de',
      description:
        'Antworten auf alle wichtigen Fragen rund um Smartphone- und Tablet-Reparatur bei McRepair.de: Reparaturablauf, Kosten, Garantie, Versand, Konto & mehr.',
      inLanguage: 'de-DE',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de/' },
          { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://www.mcrepair.de/faq' },
        ],
      },
      publisher: {
        '@type': 'Organization',
        '@id': 'https://www.mcrepair.de/#business',
        name: 'McRepair.de',
        url: 'https://www.mcrepair.de',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.mcrepair.de/logo.png',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: 'German',
          areaServed: 'DE',
        },
      },
    };

    if (allFAQs.length === 0) return [webPage];

    const faqPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://www.mcrepair.de/faq#faqpage',
      url: 'https://www.mcrepair.de/faq',
      name: 'Häufig gestellte Fragen | McRepair.de',
      mainEntity: allFAQs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    return [webPage, faqPage];
  }, [groupedFAQs]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(245,197,24,0.1) 0%, rgba(255,255,255,1) 24%, rgba(248,249,252,1) 66%, rgba(26,42,94,0.08) 100%)',
      }}
    >
      <SEO
        title="Häufig gestellte Fragen – Reparatur, Preise, Versand & Garantie | McRepair.de"
        description="Alle Antworten zu Smartphone- & Tablet-Reparatur bei McRepair.de: Reparaturablauf, Kostenvoranschlag, Garantie, Versand, Konto & Datenschutz – schnell & übersichtlich."
        canonical="/faq"
        keywords="FAQ, häufige Fragen, Reparatur FAQ, Smartphone Reparatur Fragen, Tablet Reparatur, Garantie Reparatur, Versand Reparatur, Kosten Reparatur, McRepair FAQ, Reparaturservice Fragen"
        jsonLd={faqJsonLd}
      />
      <TopBar />
      <McRepairNav />

      <main className="container px-4 pt-8 pb-10 md:pt-10 md:pb-14">
        {/* Hero Section */}
        <section
          className="overflow-hidden rounded-3xl border-0 shadow-xl"
          style={{ marginTop: '24px' }}
        >
          <div
            className="relative p-8 md:p-12"
            style={{
              background:
                'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)',
            }}
          >
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-yellow-300/20 blur-2xl" />

            <div className="relative z-10 max-w-3xl text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <BadgeCheck className="h-4 w-4" />
                {t('faq.badge') || 'Häufig gestellte Fragen'}
              </div>
              <h1 className="text-3xl font-bold leading-tight md:text-5xl">{t('faq.title')}</h1>
              <p className="mt-5 text-sm leading-7 text-blue-50 md:text-base">
                {t('faq.subtitle')}
              </p>
            </div>
          </div>
        </section>

        {/* Search and Category Filter */}
        <section className="mt-8">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="mb-6">
                <div className="faq-search-wrapper">
                  <Search className="faq-search-icon" />
                  <input
                    type="text"
                    placeholder={t('faq.searchPlaceholder')}
                    className="faq-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="faq-category-pills">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    className={`faq-category-pill ${selectedCategory === category.value ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Content */}
        <section
          className="mt-8"
          itemScope
          itemType="https://schema.org/FAQPage"
        >
          {loading ? (
            <div className="faq-loading">
              <Loader2 className="h-8 w-8 animate-spin text-mcrepair-accent" />
              <p>{t('faq.loading')}</p>
            </div>
          ) : Object.keys(groupedFAQs).length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <HelpCircle className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">{t('faq.noResults')}</h3>
                <p className="text-gray-500 mt-2">{t('faq.tryDifferentSearch')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedFAQs).map(([category, categoryFAQs]) => {
                const Icon = categoryIcons[category] || HelpCircle;
                return (
                  <div key={category}>
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          background: 'rgba(245, 197, 24, 0.18)',
                          color: 'var(--primary-blue, #1a2a5e)'
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                          {category}
                        </h2>
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(245, 197, 24, 0.1)',
                            color: 'var(--primary-blue, #1a2a5e)'
                          }}
                        >
                          {categoryFAQs.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {categoryFAQs.map((faq) => {
                        const isExpanded = expandedFAQs.has(faq._id);
                        return (
                          <div
                            key={faq._id}
                            className="rounded-lg border border-gray-200 transition-all duration-300 ease-out hover:border-gray-300 hover:shadow-md"
                            itemScope
                            itemType="https://schema.org/Question"
                            style={{
                              boxShadow: isExpanded
                                ? '0 8px 30px rgba(26, 42, 94, 0.12)'
                                : '0 1px 3px rgba(0, 0, 0, 0.08)',
                              borderColor: isExpanded
                                ? 'var(--primary-blue, #1a2a5e)'
                                : 'inherit',
                            }}
                          >
                            <button
                              className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4 transition-colors duration-200"
                              onClick={() => toggleFAQ(faq._id)}
                              aria-expanded={isExpanded}
                              aria-controls={`faq-answer-${faq._id}`}
                              id={`faq-question-${faq._id}`}
                              style={{
                                background: isExpanded
                                  ? 'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)'
                                  : 'transparent',
                              }}
                            >
                              <span
                                className={`font-semibold leading-6 transition-colors duration-200 text-sm md:text-base ${
                                  isExpanded ? 'text-white' : 'text-gray-900'
                                }`}
                                itemProp="name"
                              >
                                {faq.question}
                              </span>
                              <ChevronDown
                                className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                                style={{ color: isExpanded ? 'white' : 'currentColor' }}
                              />
                            </button>

                            {/*
                              Always rendered in DOM so search-engine crawlers can index
                              the answer text even without executing JavaScript.
                              Visual open/close is handled via CSS classes only.
                            */}
                            <div
                              id={`faq-answer-${faq._id}`}
                              role="region"
                              aria-labelledby={`faq-question-${faq._id}`}
                              className={`faq-answer-panel border-t ${
                                isExpanded ? 'faq-answer-expanded' : 'faq-answer-collapsed'
                              }`}
                              itemScope
                              itemType="https://schema.org/Answer"
                              style={{ borderColor: 'rgba(26, 42, 94, 0.1)' }}
                            >
                              <div
                                className="px-5 md:px-6 py-5 md:py-6"
                                style={{ background: 'var(--mcrepair-gray-50, #f5f6f8)' }}
                              >
                                <div className="text-gray-700 leading-relaxed text-sm md:text-base space-y-4">
                                  <p itemProp="text">{faq.answer}</p>
                                  {faq.tags && faq.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                                      {faq.tags.map((tag, index) => (
                                        <span
                                          key={index}
                                          className="inline-block px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200"
                                          style={{
                                            background: 'rgba(245, 197, 24, 0.12)',
                                            color: 'var(--primary-blue, #1a2a5e)',
                                          }}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CTA Section */}
        <section className="mt-12">
          <Card
            className="border-0 overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(26,42,94,0.08) 0%, rgba(245,197,24,0.16) 100%)',
            }}
          >
            <CardContent className="pt-8 md:pt-10 pb-8 md:pb-10">
              <div className="max-w-2xl mx-auto text-center">
                <h3 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('faq.stillNeedHelp')}
                </h3>
                <p className="text-gray-600 mb-6 text-sm md:text-base">
                  {t('faq.contactSupport')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="rounded-full" style={{ background: 'var(--primary-blue, #1a2a5e)' }}>
                    <a href="tel:+4912345678" className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {t('faq.callUs')}
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/contact" className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('faq.contactForm')}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
      <CookieBanner />
    </div>
  );
}
