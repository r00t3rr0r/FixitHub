import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO'
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const advantageIcons = [TrendingUp, Layers, Building2, Truck, Handshake, Users];

export function PartnerWerden() {
  const { t } = useTranslation();

  const advantages = [
    t('partnerPage.advantages.item1'),
    t('partnerPage.advantages.item2'),
    t('partnerPage.advantages.item3'),
    t('partnerPage.advantages.item4'),
    t('partnerPage.advantages.item5'),
    t('partnerPage.advantages.item6'),
  ];

  const steps = [
    t('partnerPage.steps.item1'),
    t('partnerPage.steps.item2'),
    t('partnerPage.steps.item3'),
    t('partnerPage.steps.item4'),
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
        title="Partner werden – Mit FixitHub Geld verdienen"
        description="Werden Sie FixitHub-Annahmepartner und profitieren Sie von unserem Netzwerk. Jetzt Partnerschaft anfragen und gemeinsam wachsen."
        canonical="/partner-werden"
      />
      <TopBar />
      <McRepairNav />

      <main className="container px-4 pt-8 pb-10 md:pt-10 md:pb-14">
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
                {t('partnerPage.badge')}
              </div>
              <h1 className="text-3xl font-bold leading-tight md:text-5xl">{t('partnerPage.title')}</h1>
              <p className="mt-5 text-sm leading-7 text-blue-50 md:text-base">
                {t('partnerPage.description')}
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm text-blue-50">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <MapPin className="h-4 w-4" />
                  {t('partnerPage.facts.centralWorkshop')}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                  <Building2 className="h-4 w-4" />
                  {t('partnerPage.facts.locations')}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                {t('partnerPage.advantages.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {advantages.map((item, index) => {
                const Icon = advantageIcons[index];

                return (
                <div
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
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--gray-700, #334155)' }}>
                    {item}
                  </p>
                </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                {t('partnerPage.steps.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(26,42,94,0.1)' }}>
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: 'var(--accent-yellow, #f5c518)', color: 'var(--primary-blue, #1a2a5e)' }}
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6" style={{ color: 'var(--gray-700, #334155)' }}>
                    {step}
                  </p>
                </div>
              ))}

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
                      <Mail className="h-4 w-4" />
                      {t('partnerPage.cta.contactButton')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/annahmestellen" className="inline-flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      {t('partnerPage.cta.locationsButton')}
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