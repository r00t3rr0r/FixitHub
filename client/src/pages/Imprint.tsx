import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Imprint.css';

const imprintJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://www.mcrepair.de/#organization',
    name: 'Online Point GmbH',
    legalName: 'Online Point GmbH',
    url: 'https://www.mcrepair.de',
    logo: 'https://www.mcrepair.de/logo.png',
    description: 'McRepair.de – professioneller Reparaturservice für Smartphones, Tablets und Notebooks in Berlin.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Kurfürstenstr. 106',
      addressLocality: 'Berlin',
      postalCode: '10787',
      addressCountry: 'DE',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+49-30-403688951',
        contactType: 'customer service',
        availableLanguage: 'German',
        contactOption: 'TollFree',
      },
      {
        '@type': 'ContactPoint',
        telephone: '+49-30-403688950',
        contactType: 'administration',
        availableLanguage: 'German',
      },
    ],
    email: 'kontakt@onlinepoint-gmbh.de',
    vatID: 'DE318981969',
    taxID: 'DE318981969',
    sameAs: ['https://www.mcrepair.de'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://www.mcrepair.de/impressum#webpage',
    url: 'https://www.mcrepair.de/impressum',
    name: 'Impressum – McRepair.de',
    description: 'Gesetzlich vorgeschriebene Pflichtangaben gemäß § 5 TMG für McRepair.de – betrieben durch Online Point GmbH, Berlin. Handelsregister HRB 136735 B, USt-ID DE318981969.',
    inLanguage: 'de-DE',
    isPartOf: { '@id': 'https://www.mcrepair.de/#website' },
    about: { '@id': 'https://www.mcrepair.de/#organization' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de' },
        { '@type': 'ListItem', position: 2, name: 'Impressum', item: 'https://www.mcrepair.de/impressum' },
      ],
    },
  },
];

export function Imprint() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Impressum – McRepair.de"
        description="Pflichtangaben gemäß § 5 TMG: Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin. USt-ID DE318981969, HRB 136735 B. Reparaturservice für Smartphones & Tablets."
        canonical="/impressum"
        keywords="Impressum, Online Point GmbH, McRepair, Handelsregister Berlin, HRB 136735 B, USt-ID DE318981969, Smartphone Reparatur Berlin, Geschäftsführer Julian Szymansky, TMG § 5"
        jsonLd={imprintJsonLd}
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <main className="imprint-page" aria-label="Impressum">
        <div className="container">
          <div
            className="imprint-content"
            itemScope
            itemType="https://schema.org/Organization"
          >
            {/* Hidden machine-readable org identity */}
            <meta itemProp="name" content="Online Point GmbH" />
            <meta itemProp="url" content="https://www.mcrepair.de" />
            <meta itemProp="legalName" content="Online Point GmbH" />

            {/* Header */}
            <header className="imprint-header">
              <h1>{t('imprint.title')}</h1>
            </header>

            {/* Legal Provider Information */}
            <section className="imprint-section" aria-labelledby="legal-provider-heading">
              <h2 id="legal-provider-heading">{t('imprint.legalProvider.heading')}</h2>
              <div
                className="company-info"
                itemScope
                itemType="https://schema.org/Organization"
              >
                <p><strong itemProp="legalName">{t('imprint.legalProvider.companyName')}</strong></p>
                <p itemProp="founder" itemScope itemType="https://schema.org/Person">
                  <span itemProp="name">{t('imprint.legalProvider.representative')}</span>
                </p>
                <address
                  itemProp="address"
                  itemScope
                  itemType="https://schema.org/PostalAddress"
                  style={{ fontStyle: 'normal' }}
                >
                  <span itemProp="streetAddress">{t('imprint.legalProvider.address')}</span><br />
                  <span itemProp="postalCode">10787</span>{' '}
                  <span itemProp="addressLocality">Berlin</span><br />
                  <span itemProp="addressCountry">{t('imprint.legalProvider.country')}</span>
                </address>
              </div>
            </section>

            {/* Contact Information */}
            <section className="imprint-section" aria-labelledby="contact-heading">
              <h2 id="contact-heading">{t('imprint.contact.heading')}</h2>
              <div className="contact-info">
                <p>
                  <strong>{t('imprint.contact.phoneService')}:</strong>{' '}
                  <a href="tel:+4930403688951" itemProp="telephone">030 403 688 951</a>
                </p>
                <p>
                  <strong>{t('imprint.contact.phoneAdmin')}:</strong>{' '}
                  <a href="tel:+4930403688950">030 403 688 950</a>
                </p>
                <p>
                  <strong>{t('imprint.contact.email')}:</strong>{' '}
                  <a href="mailto:kontakt@onlinepoint-gmbh.de" itemProp="email">kontakt@onlinepoint-gmbh.de</a>
                </p>
                <p>
                  <strong>{t('imprint.contact.vatId')}:</strong>{' '}
                  <span itemProp="vatID">DE318981969</span>
                </p>
              </div>
            </section>

            {/* Company Registration */}
            <section className="imprint-section" aria-labelledby="company-reg-heading">
              <h2 id="company-reg-heading">{t('imprint.companyReg.heading')}</h2>
              <div className="registry-info">
                <p>{t('imprint.companyReg.intro')}</p>
                <p><strong>{t('imprint.companyReg.regNumber')}:</strong> HRB 136735 B</p>
                <p><strong>{t('imprint.companyReg.companySeat')}:</strong> Berlin</p>
                <p><strong>{t('imprint.companyReg.lucidNumber')}:</strong> DE1709904514391</p>
              </div>
            </section>

            {/* Design & Development */}
            <section className="imprint-section" aria-labelledby="design-heading">
              <h2 id="design-heading">{t('imprint.design.heading')}</h2>
              <p>
                <a href="https://vais-concepts.de" target="_blank" rel="noopener noreferrer">
                  https://vais-concepts.de
                </a>
              </p>
            </section>

            {/* Alternative Dispute Resolution */}
            <section className="imprint-section" aria-labelledby="dispute-heading">
              <h2 id="dispute-heading">{t('imprint.disputeResolution.heading')}</h2>
              <div className="info-box">
                <p>
                  {t('imprint.disputeResolution.text1before')}
                  <a
                    href="https://ec.europa.eu/consumers/odr/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://ec.europa.eu/consumers/odr/
                  </a>
                  {t('imprint.disputeResolution.text1after')}
                </p>
                <p>{t('imprint.disputeResolution.text2')}</p>
              </div>
            </section>

            {/* Trademarks */}
            <section className="imprint-section last-section" aria-labelledby="trademarks-heading">
              <h2 id="trademarks-heading">{t('imprint.trademarks.heading')}</h2>
              <div className="trademarks-info">
                <p>{t('imprint.trademarks.iphone')}</p>
                <p>{t('imprint.trademarks.htc')}</p>
                <p>{t('imprint.trademarks.lg')}</p>
                <p>{t('imprint.trademarks.nokia')}</p>
                <p>{t('imprint.trademarks.samsung')}</p>
                <p>{t('imprint.trademarks.sonyEricsson')}</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
