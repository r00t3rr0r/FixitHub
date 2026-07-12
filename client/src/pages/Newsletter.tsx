import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { Footer } from '@/components/Footer';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Bell, Gift, Wrench, ShieldCheck, ChevronDown, ChevronUp, Mail, Lock } from 'lucide-react';

const BASE_URL = 'https://www.mcrepair.de';

const benefits = [
  {
    icon: Gift,
    title: 'Exklusive Rabattcodes',
    desc: 'Als Abonnent erhalten Sie regelmäßig exklusive Gutscheine und Rabattaktionen für Reparaturen aller Art.',
  },
  {
    icon: Wrench,
    title: 'Reparaturtipps & Ratgeber',
    desc: 'Praxisnahe Tipps zur Pflege und Reparatur Ihres Smartphones, Tablets oder Notebooks direkt in Ihr Postfach.',
  },
  {
    icon: Bell,
    title: 'Neue Services zuerst erfahren',
    desc: 'Wir informieren Sie als Erstes über neue Reparaturservices, Marktsupport und Standorteröffnungen.',
  },
  {
    icon: ShieldCheck,
    title: 'Datenschutz garantiert',
    desc: 'Ihre E-Mail-Adresse wird ausschließlich für den Newsletter verwendet. Abmeldung jederzeit, kein Spam.',
  },
];

const faqs = [
  {
    q: 'Wie oft erscheint der McRepair-Newsletter?',
    a: 'Unser Newsletter erscheint in der Regel ein- bis zweimal pro Monat. Sie werden ausschließlich bei relevanten Angeboten und wichtigen News kontaktiert.',
  },
  {
    q: 'Kann ich den Newsletter jederzeit abbestellen?',
    a: 'Ja, die Abmeldung ist jederzeit kostenlos möglich – direkt über den Abmelde-Link in jeder E-Mail oder über das Formular auf dieser Seite.',
  },
  {
    q: 'Was beinhaltet der McRepair-Newsletter?',
    a: 'Der Newsletter informiert über Reparaturangebote, exklusive Rabattcodes, neue Serviceleistungen, Gerätepflegetipps sowie Neuigkeiten rund um McRepair.de.',
  },
  {
    q: 'Wie werden meine Daten verwendet?',
    a: 'Ihre E-Mail-Adresse wird ausschließlich für den Versand unseres Newsletters genutzt. Eine Weitergabe an Dritte findet nicht statt. Weitere Informationen finden Sie in unserer Datenschutzerklärung.',
  },
  {
    q: 'Ist der Newsletter kostenlos?',
    a: 'Ja, das Abonnement unseres Newsletters ist vollständig kostenlos und unverbindlich.',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}/newsletter#webpage`,
    url: `${BASE_URL}/newsletter`,
    name: 'McRepair Newsletter abonnieren – Reparaturtipps & Angebote',
    description:
      'Abonnieren Sie den kostenlosen McRepair.de-Newsletter und erhalten Sie exklusive Rabattcodes, Reparaturtipps, neue Servicemeldungen und aktuelle Angebote direkt in Ihr Postfach.',
    inLanguage: 'de-DE',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    breadcrumb: { '@id': `${BASE_URL}/newsletter#breadcrumb` },
    mainEntity: { '@id': `${BASE_URL}/newsletter#subscribe-action` },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'McRepair.de',
    description: 'Professionelle Smartphone-, Tablet- und Notebook-Reparaturen in Deutschland',
    inLanguage: 'de-DE',
    publisher: { '@id': `${BASE_URL}/#organization` },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'McRepair.de',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Bundesweites Netzwerk für professionelle Smartphone- und Elektronik-Reparaturen',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'DE',
    },
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    sameAs: [
      'https://www.facebook.com/McRepair',
      'https://www.instagram.com/mcrepair.de',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}/newsletter#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Newsletter', item: `${BASE_URL}/newsletter` },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${BASE_URL}/newsletter#subscribe-action`,
    name: 'McRepair Newsletter-Abonnement',
    serviceType: 'E-Mail-Newsletter',
    description:
      'Kostenloser Newsletter mit Reparaturtipps, exklusiven Rabattcodes und Neuigkeiten rund um Smartphone-, Tablet- und Notebook-Reparaturen.',
    provider: { '@id': `${BASE_URL}/#organization` },
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    url: `${BASE_URL}/newsletter`,
    offers: {
      '@type': 'Offer',
      name: 'Kostenloser Newsletter',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Gratis-Abonnement mit exklusiven Angeboten und Reparaturtipps',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Newsletter-Inhalte',
      itemListElement: [
        { '@type': 'Offer', name: 'Exklusive Rabattcodes & Gutscheine' },
        { '@type': 'Offer', name: 'Reparaturtipps & Ratgeber' },
        { '@type': 'Offer', name: 'Neue Services & Standorte' },
        { '@type': 'Offer', name: 'Aktuelle Sonderaktionen' },
      ],
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${BASE_URL}/newsletter#faq`,
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
];

export default function Newsletter() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [unsubscribeEmail, setUnsubscribeEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unsubmitting, setUnsubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscribeEmail.trim()) {
      toast({ title: t('newsletter.emailRequired', 'E-Mail erforderlich'), description: t('newsletter.emailRequiredDesc', 'Bitte geben Sie Ihre E-Mail-Adresse ein.'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast({ title: t('newsletter.success', 'Erfolg'), description: t('newsletter.subscribeSuccess', 'Sie haben den Newsletter erfolgreich abonniert.') });
      setSubscribeEmail('');
      setSubmitting(false);
    }, 1200);
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unsubscribeEmail.trim()) {
      toast({ title: t('newsletter.emailRequired', 'E-Mail erforderlich'), description: t('newsletter.emailRequiredDesc', 'Bitte geben Sie Ihre E-Mail-Adresse ein.'), variant: 'destructive' });
      return;
    }
    setUnsubmitting(true);
    setTimeout(() => {
      toast({ title: t('newsletter.unsubscribeSuccess', 'Abmeldung erfolgreich'), description: t('newsletter.unsubscribeSuccessDesc', 'Sie wurden vom Newsletter abgemeldet.') });
      setUnsubscribeEmail('');
      setUnsubmitting(false);
    }, 1200);
  };

  return (
    <div style={{ background: 'linear-gradient(180deg, var(--off-white, #f8f9fc) 0%, var(--white, #ffffff) 24%, var(--gray-50, #f5f6f8) 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO
        title="Newsletter abonnieren – Reparaturtipps & Exklusivangebote | McRepair.de"
        description="Jetzt den kostenlosen McRepair-Newsletter abonnieren: exklusive Rabattcodes, Reparaturtipps für Smartphone & Tablet, neue Services und aktuelle Sonderaktionen. Kostenlos, unverbindlich & jederzeit kündbar."
        canonical="/newsletter"
        keywords="McRepair Newsletter, Newsletter Reparatur, Smartphone Reparatur Newsletter, Handy Reparatur Angebote, Reparaturtipps Newsletter, Rabattcode Reparatur, McRepair Gutschein, Newsletter abonnieren, Newsletter abmelden"
        jsonLd={jsonLd}
      />
      <TopBar />
      <McRepairNav />

      <main className="flex-1 py-10 px-4" itemScope itemType="https://schema.org/WebPage">

        {/* ── Breadcrumb ───────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="max-w-2xl mx-auto mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-gray-500" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" className="hover:text-blue-600 transition-colors" itemProp="item">
                <span itemProp="name">Startseite</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <li aria-hidden="true" className="text-gray-300">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="text-gray-700 font-medium" itemProp="name">Newsletter</span>
              <meta itemProp="position" content="2" />
              <link itemProp="item" href={`${BASE_URL}/newsletter`} />
            </li>
          </ol>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <header className="max-w-2xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>Kostenlos &amp; jederzeit kündbar</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight" itemProp="name">
            McRepair Newsletter –<br className="hidden md:block" /> Immer die besten Reparaturangebote
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto" itemProp="description">
            Abonnieren Sie unseren Newsletter und erhalten Sie exklusive Rabattcodes, nützliche Reparaturtipps für Ihr Smartphone, Tablet oder Notebook sowie Neuigkeiten rund um McRepair.de direkt in Ihr Postfach.
          </p>
        </header>

        {/* ── Benefits ────────────────────────────────────────────────── */}
        <section aria-labelledby="benefits-heading" className="max-w-2xl mx-auto mb-10">
          <h2 id="benefits-heading" className="text-xl font-semibold text-gray-800 text-center mb-6">
            Was Sie als Abonnent erhalten
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <span className="mt-0.5 flex-shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Forms ───────────────────────────────────────────────────── */}
        <div className="w-full max-w-lg mx-auto space-y-10">

          {/* Subscribe */}
          <section aria-labelledby="subscribe-heading">
            <Card className="shadow-xl border-0">
              <CardHeader className="pb-2 text-center" style={{ background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                <CardTitle id="subscribe-heading" className="text-white text-2xl">
                  {t('newsletter.subscribeTitle', 'Newsletter abonnieren')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-2">
                <form className="space-y-4" onSubmit={handleSubscribe} aria-label="Newsletter abonnieren">
                  <p className="text-gray-700 text-center text-base">
                    {t('newsletter.subscribeDesc', 'Um sich für unseren Newsletter anzumelden, tragen Sie bitte hier Ihre E-Mail-Adresse ein und klicken anschließend auf')}{' '}
                    <strong>{t('newsletter.subscribeBtn', 'abonnieren')}</strong>.
                    <br />
                    <span className="text-xs text-gray-500">({t('newsletter.unsubscribeAnytime', 'Abmeldung jederzeit möglich')})</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="newsletter-email">{t('newsletter.email', 'E-Mail-Adresse')}</Label>
                    <Input
                      id="newsletter-email"
                      type="email"
                      value={subscribeEmail}
                      onChange={e => setSubscribeEmail(e.target.value)}
                      placeholder={t('newsletter.emailPlaceholder', 'name@beispiel.de')}
                      autoComplete="email"
                      required
                      aria-required="true"
                      aria-describedby="subscribe-privacy-note"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    style={{ background: 'var(--primary-blue)', color: 'white' }}
                    disabled={submitting}
                    aria-busy={submitting}
                  >
                    {submitting ? t('newsletter.subscribing', 'Abonniere...') : t('newsletter.subscribeBtn', 'Jetzt kostenlos abonnieren')}
                  </Button>
                  <p id="subscribe-privacy-note" className="text-xs text-gray-500 text-center pt-1 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    Ihre Daten sind sicher. Kein Spam, Abmeldung jederzeit möglich.{' '}
                    <Link to="/datenschutz" className="underline hover:text-blue-600">Datenschutzerklärung</Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Unsubscribe */}
          <section aria-labelledby="unsubscribe-heading">
            <Card className="shadow-xl border-0">
              <CardHeader className="pb-2 text-center" style={{ background: 'linear-gradient(135deg, #f5c518, #ffe066)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                <CardTitle id="unsubscribe-heading" className="text-[#1a2a5e] text-2xl">
                  {t('newsletter.unsubscribeTitle', 'Newsletter abmelden')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-2">
                <form className="space-y-4" onSubmit={handleUnsubscribe} aria-label="Newsletter abmelden">
                  <p className="text-gray-700 text-center text-base">
                    {t('newsletter.unsubscribeDesc', 'Zum Abmelden des Newsletters tragen Sie bitte Ihre E-Mail-Adresse im unten stehenden Feld ein. Klicken Sie anschließend auf')}{' '}
                    <strong>{t('newsletter.unsubscribeBtn', 'abmelden')}</strong>.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="newsletter-unsubscribe-email">{t('newsletter.email', 'E-Mail-Adresse')}</Label>
                    <Input
                      id="newsletter-unsubscribe-email"
                      type="email"
                      value={unsubscribeEmail}
                      onChange={e => setUnsubscribeEmail(e.target.value)}
                      placeholder={t('newsletter.emailPlaceholder', 'name@beispiel.de')}
                      autoComplete="email"
                      required
                      aria-required="true"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    style={{ background: '#f5c518', color: '#1a2a5e' }}
                    disabled={unsubmitting}
                    aria-busy={unsubmitting}
                  >
                    {unsubmitting ? t('newsletter.unsubscribing', 'Melde ab...') : t('newsletter.unsubscribeBtn', 'Vom Newsletter abmelden')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="max-w-2xl mx-auto mt-14 mb-6" itemScope itemType="https://schema.org/FAQPage">
          <h2 id="faq-heading" className="text-xl font-semibold text-gray-800 text-center mb-6">
            Häufige Fragen zum Newsletter
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                itemScope
                itemProp="mainEntity"
                itemType="https://schema.org/Question"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-gray-800 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span itemProp="name">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                  }
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                  hidden={openFaq !== i}
                  itemScope
                  itemProp="acceptedAnswer"
                  itemType="https://schema.org/Answer"
                >
                  <p className="px-5 pb-4 pt-0 text-gray-600 text-sm" itemProp="text">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust / GDPR note ────────────────────────────────────────── */}
        <aside className="max-w-2xl mx-auto mt-6 mb-2 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 flex gap-3 items-start text-sm text-blue-800">
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" aria-hidden="true" />
          <p>
            <strong>Datenschutz &amp; DSGVO:</strong> Wir verarbeiten Ihre Daten gemäß der{' '}
            <Link to="/datenschutz" className="underline font-medium hover:text-blue-600">Datenschutzerklärung</Link>.
            Ihre E-Mail-Adresse wird ausschließlich für den Newsletter verwendet und nicht an Dritte weitergegeben. Sie können sich jederzeit mit einem Klick abmelden.
          </p>
        </aside>

      </main>
      <Footer />
    </div>
  );
}
