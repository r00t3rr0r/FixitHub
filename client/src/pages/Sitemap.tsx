import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO'
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  FileCheck,
  FileSearch,
  HelpCircle,
  Map,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Sitemap.css';

interface QuickLinkDef {
  to: string;
  key: string;
  icon: LucideIcon;
}

interface SectionLinkDef {
  to: string;
  key: string;
}

interface SectionDef {
  id: string;
  sectionKey: string;
  icon: LucideIcon;
  links: SectionLinkDef[];
}

const quickLinkDefs: QuickLinkDef[] = [
  { to: '/new-order',     key: 'startRepair',  icon: Wrench },
  { to: '/vorabdiagnose', key: 'preDiagnosis', icon: FileSearch },
  { to: '/faq',           key: 'faq',          icon: HelpCircle },
  { to: '/contact',       key: 'contact',      icon: FileCheck },
];

const sectionDefs: SectionDef[] = [
  {
    id: 'repair',
    sectionKey: 'repair',
    icon: Wrench,
    links: [
      { to: '/',               key: 'home' },
      { to: '/new-order',      key: 'newOrder' },
      { to: '/repair-request', key: 'repairRequest' },
      { to: '/vorabdiagnose',  key: 'preDiagnosis' },
      { to: '/annahmestellen', key: 'locations' },
      { to: '/shop',           key: 'shop' },
    ],
  },
  {
    id: 'support',
    sectionKey: 'support',
    icon: HelpCircle,
    links: [
      { to: '/faq',                 key: 'faq' },
      { to: '/track-order',         key: 'trackOrder' },
      { to: '/track-order/booking', key: 'trackBooking' },
      { to: '/contact',             key: 'contact' },
      { to: '/newsletter',          key: 'newsletter' },
    ],
  },
  {
    id: 'company',
    sectionKey: 'company',
    icon: Sparkles,
    links: [
      { to: '/about',          key: 'about' },
      { to: '/partner-werden', key: 'partnerWerden' },
      { to: '/blog',           key: 'blog' },
    ],
  },
  {
    id: 'legal',
    sectionKey: 'legal',
    icon: ShieldCheck,
    links: [
      { to: '/imprint',        key: 'imprint' },
      { to: '/privacy',        key: 'privacy' },
      { to: '/terms',          key: 'terms' },
      { to: '/widerrufsrecht', key: 'withdrawal' },
    ],
  },
];

const totalLinks = sectionDefs.reduce((n, s) => n + s.links.length, 0);

export function Sitemap() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Sitemap – McRepair.de Seitenübersicht"
        description="Vollständige Seitenstruktur von McRepair.de: Reparaturservice, Webshop, Blog, Kundenportal, rechtliche Seiten und mehr – schnell finden, was Sie suchen."
        canonical="/sitemap"
        noindex={true}
      />
      <TopBar />
      <McRepairNav />

      <div className="sitemap-page">
        <div className="container sitemap-shell">

          {/* ── Hero ── */}
          <section className="sitemap-hero">
            <div className="sitemap-hero-copy">
              <div className="sitemap-badge">
                <Map />
                {t('sitemapPage.badge')}
              </div>
              <h1>{t('sitemapPage.title')}</h1>
              <p>{t('sitemapPage.description')}</p>

              <nav className="sitemap-anchor-nav" aria-label={t('sitemapPage.ariaNav')}>
                {sectionDefs.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="sitemap-anchor-link">
                    {t(`sitemapPage.sections.${s.sectionKey}.title`)}
                  </a>
                ))}
              </nav>
            </div>

            <aside className="sitemap-hero-panel">
              <h2>{t('sitemapPage.quickLinksTitle')}</h2>
              <p>{t('sitemapPage.quickLinksSubtitle')}</p>

              <div className="sitemap-quick-grid">
                {quickLinkDefs.map((ql) => {
                  const Icon = ql.icon;
                  return (
                    <Link key={ql.to} to={ql.to} className="sitemap-quick-card">
                      <div className="sitemap-quick-icon">
                        <Icon />
                      </div>
                      <div className="sitemap-quick-copy">
                        <h3>{t(`sitemapPage.quickLinks.${ql.key}.title`)}</h3>
                        <p>{t(`sitemapPage.quickLinks.${ql.key}.description`)}</p>
                      </div>
                      <ArrowRight className="sitemap-arrow" />
                    </Link>
                  );
                })}
              </div>
            </aside>
          </section>

          {/* ── Overview banner ── */}
          <section className="sitemap-overview-card">
            <div>
              <h2>{t('sitemapPage.overviewTitle')}</h2>
              <p>{t('sitemapPage.overviewDescription')}</p>
            </div>
            <div className="sitemap-overview-stats">
              <div>
                <strong>{totalLinks}</strong>
                <span>{t('sitemapPage.statsPages')}</span>
              </div>
              <div>
                <strong>{sectionDefs.length}</strong>
                <span>{t('sitemapPage.statsSections')}</span>
              </div>
            </div>
          </section>

          {/* ── Section grid ── */}
          <div className="sitemap-section-grid">
            {sectionDefs.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id} id={section.id} className="sitemap-section-card">
                  <header className="sitemap-section-header">
                    <div className="sitemap-section-icon">
                      <Icon />
                    </div>
                    <div>
                      <h2>{t(`sitemapPage.sections.${section.sectionKey}.title`)}</h2>
                      <p>{t(`sitemapPage.sections.${section.sectionKey}.description`)}</p>
                    </div>
                  </header>

                  <div className="sitemap-link-list">
                    {section.links.map((link) => (
                      <Link key={link.to} to={link.to} className="sitemap-link-card">
                        <div>
                          <span className="sitemap-link-title">
                            {t(`sitemapPage.links.${link.key}.label`)}
                          </span>
                          <p>{t(`sitemapPage.links.${link.key}.description`)}</p>
                        </div>
                        <span className="sitemap-link-meta">
                          {link.to}
                          <ArrowRight />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ── CTA ── */}
          <section className="sitemap-cta-card">
            <div>
              <h2>{t('sitemapPage.ctaTitle')}</h2>
              <p>{t('sitemapPage.ctaDescription')}</p>
            </div>
            <div className="sitemap-cta-actions">
              <Link to="/new-order" className="sitemap-cta-button primary">
                {t('sitemapPage.ctaStartRepair')}
              </Link>
              <Link to="/contact" className="sitemap-cta-button secondary">
                {t('sitemapPage.ctaContact')}
              </Link>
            </div>
          </section>

        </div>
      </div>

      <Footer />
    </>
  );
}