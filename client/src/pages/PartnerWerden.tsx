import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  Handshake,
  Layers,
  Mail,
  MapPin,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const BASE_URL = 'https://www.mcrepair.de';
const advantageIcons = [TrendingUp, Layers, Building2, Truck, Handshake, Users];

export function PartnerWerden() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const advantages = [
    t('partnerPage.advantages.item1'),
    t('partnerPage.advantages.item2'),
    t('partnerPage.advantages.item3'),
    t('partnerPage.advantages.item4'),
    t('partnerPage.advantages.item5'),
    t('partnerPage.advantages.item6'),
  ];

  const steps = [
    { text: t('partnerPage.steps.item1'), short: t('partnerPage.steps.item1Short') },
    { text: t('partnerPage.steps.item2'), short: t('partnerPage.steps.item2Short') },
    { text: t('partnerPage.steps.item3'), short: t('partnerPage.steps.item3Short') },
    { text: t('partnerPage.steps.item4'), short: t('partnerPage.steps.item4Short') },
  ];

  const faqs = [
    { q: t('partnerPage.faq.q1Question'), a: t('partnerPage.faq.q1Answer') },
    { q: t('partnerPage.faq.q2Question'), a: t('partnerPage.faq.q2Answer') },
    { q: t('partnerPage.faq.q3Question'), a: t('partnerPage.faq.q3Answer') },
    { q: t('partnerPage.faq.q4Question'), a: t('partnerPage.faq.q4Answer') },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'McRepair.de',
      url: BASE_URL,
      logo: `${BASE_URL}/logo.png`,
      description: t('partnerPage.description'),
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
      areaServed: 'DE',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${BASE_URL}/partner-werden#service`,
      name: t('partnerPage.badge'),
      serviceType: 'Handelsvertretung',
      description: t('partnerPage.description'),
      provider: { '@id': `${BASE_URL}/#organization` },
      areaServed: { '@type': 'Country', name: 'Deutschland' },
      url: `${BASE_URL}/partner-werden`,
      offers: {
        '@type': 'Offer',
        description: t('partnerPage.faq.q2Answer'),
        price: '0',
        priceCurrency: 'EUR',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Partner werden', item: `${BASE_URL}/partner-werden` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: t('partnerPage.steps.schemaName'),
      description: t('partnerPage.steps.schemaDescription'),
      step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.short,
        text: s.text,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(245,197,24,0.1) 0%, rgba(255,255,255,1) 24%, rgba(248,249,252,1) 66%, rgba(26,42,94,0.08) 100%)',
      }}
    >
      <SEO
        title="Partner werden – Mit McRepair.de Geld verdienen"
        description="Werden Sie McRepair.de-Annahmepartner und profitieren Sie von unserem bundesweiten Netzwerk mit 350+ Standorten. Kostenfreie Anmeldung, attraktive Provisionen, professioneller Support."
        canonical="/partner-werden"
        keywords="McRepair Partner, Annahmestelle werden, Smartphone Reparatur Partner, Handyreparatur Franchise, Reparatur Partnerprogramm Deutschland, Annahmepartner Reparatur, McRepair Partnerprogramm"
        jsonLd={jsonLd}
      />
      <TopBar />
      <McRepairNav />

      <main className="container px-4 pt-8 pb-10 md:pt-10 md:pb-14">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          className="overflow-hidden rounded-3xl border-0 shadow-xl"
          aria-labelledby="partner-hero-heading"
          style={{ marginTop: '24px' }}
        >
          <div
            className="relative p-8 md:p-12"
            style={{
              background:
                'linear-gradient(135deg, var(--primary-blue, #1a2a5e) 0%, var(--primary-blue-light, #2f57b0) 100%)',
            }}
          >
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-yellow-300/20 blur-2xl" aria-hidden="true" />

            <div className="relative z-10 max-w-3xl text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {t('partnerPage.badge')}
              </div>
              <h1
                id="partner-hero-heading"
                className="text-3xl font-bold leading-tight md:text-5xl"
              >
                {t('partnerPage.title')}
              </h1>
              <p className="mt-5 text-sm leading-7 text-blue-50 md:text-base">
                {t('partnerPage.description')}
              </p>
              <ul className="mt-7 flex flex-wrap gap-3 text-sm text-blue-50" aria-label="Fakten">
                <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('partnerPage.facts.centralWorkshop')}
                </li>
                <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {t('partnerPage.facts.locations')}
                </li>
                <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  {t('partnerPage.facts.experience')}
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Intro text ───────────────────────────────────────────────── */}
        <section
          className="mt-8 rounded-2xl border-0 bg-white p-6 shadow-md md:p-8"
          aria-labelledby="partner-intro-heading"
        >
          <h2
            id="partner-intro-heading"
            className="text-xl font-bold md:text-2xl"
            style={{ color: 'var(--primary-blue, #1a2a5e)' }}
          >
            {t('partnerPage.intro.heading')}
          </h2>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--gray-700, #334155)' }}>
            {t('partnerPage.intro.text')}
          </p>
        </section>

        {/* ── Advantages + Steps ───────────────────────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

          {/* Advantages */}
          <Card className="border-0 shadow-lg" aria-labelledby="advantages-heading">
            <CardHeader className="pb-2">
              <h2
                id="advantages-heading"
                className="text-2xl font-semibold leading-none tracking-tight"
                style={{ color: 'var(--primary-blue, #1a2a5e)' }}
              >
                {t('partnerPage.advantages.title')}
              </h2>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {advantages.map((item, index) => {
                  const Icon = advantageIcons[index];
                  return (
                    <li
                      key={item}
                      className="rounded-2xl border p-4"
                      style={{
                        borderColor: 'rgba(26, 42, 94, 0.1)',
                        background: 'rgba(248, 250, 252, 0.9)',
                      }}
                    >
                      <div
                        className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: 'rgba(245, 197, 24, 0.18)', color: 'var(--primary-blue, #1a2a5e)' }}
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm leading-6" style={{ color: 'var(--gray-700, #334155)' }}>
                        {item}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card className="border-0 shadow-lg" aria-labelledby="steps-heading">
            <CardHeader className="pb-2">
              <h2
                id="steps-heading"
                className="text-2xl font-semibold leading-none tracking-tight"
                style={{ color: 'var(--primary-blue, #1a2a5e)' }}
              >
                {t('partnerPage.steps.title')}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li
                    key={step.text}
                    className="flex items-start gap-3 rounded-2xl border p-4"
                    style={{ borderColor: 'rgba(26,42,94,0.1)' }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: 'var(--accent-yellow, #f5c518)', color: 'var(--primary-blue, #1a2a5e)' }}
                      aria-label={`Schritt ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6" style={{ color: 'var(--gray-700, #334155)' }}>
                      {step.text}
                    </p>
                  </li>
                ))}
              </ol>

              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(26,42,94,0.08) 0%, rgba(245,197,24,0.16) 100%)',
                }}
              >
                <p className="text-sm leading-6" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  {t('partnerPage.cta.description')}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="rounded-full" style={{ background: 'var(--primary-blue, #1a2a5e)' }}>
                    <Link to="/contact" className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {t('partnerPage.cta.contactButton')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/annahmestellen" className="inline-flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      {t('partnerPage.cta.locationsButton')}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section
          className="mt-10"
          aria-labelledby="faq-heading"
          itemScope
          itemType="https://schema.org/FAQPage"
        >
          <h2
            id="faq-heading"
            className="mb-5 text-2xl font-bold"
            style={{ color: 'var(--primary-blue, #1a2a5e)' }}
          >
            {t('partnerPage.faq.title')}
          </h2>
          <div className="space-y-3">
            {faqs.map(({ q, a }, i) => (
              <div
                key={q}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                style={{ borderColor: 'rgba(26,42,94,0.1)' }}
                itemScope
                itemProp="mainEntity"
                itemType="https://schema.org/Question"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span
                    className="text-sm font-semibold leading-6 md:text-base"
                    style={{ color: 'var(--primary-blue, #1a2a5e)' }}
                    itemProp="name"
                  >
                    {q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--primary-blue, #1a2a5e)' }}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  hidden={openFaq !== i}
                  className="border-t px-5 py-4"
                  style={{ borderColor: 'rgba(26,42,94,0.1)' }}
                  itemScope
                  itemProp="acceptedAnswer"
                  itemType="https://schema.org/Answer"
                >
                  <p
                    className="text-sm leading-7"
                    style={{ color: 'var(--gray-700, #334155)' }}
                    itemProp="text"
                  >
                    {a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <Footer />
      <CookieBanner />
    </div>
  );
}