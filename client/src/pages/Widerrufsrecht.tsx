import { TopBar } from '@/components/home/TopBar';
import { SEO } from '@/components/SEO'
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './Widerrufsrecht.css';

const BASE_URL = 'https://www.mcrepair.de';

const jsonLdSchemas = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}/widerrufsrecht`,
    name: 'Widerrufsrecht & Widerrufsformular',
    url: `${BASE_URL}/widerrufsrecht`,
    description:
      'Informationen zum gesetzlichen 14-tägigen Widerrufsrecht bei McRepair.de – Reparaturservice für Smartphones, Tablets und Laptops. Inklusive Muster-Widerrufsformular.',
    inLanguage: 'de-DE',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Widerrufsrecht', item: `${BASE_URL}/widerrufsrecht` },
      ],
    },
    publisher: {
      '@type': 'Organization',
      name: 'McRepair.de – Online Point GmbH',
      url: BASE_URL,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Kurfürstenstr. 106',
        addressLocality: 'Berlin',
        postalCode: '10787',
        addressCountry: 'DE',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+49-30-403688951',
        email: 'kontakt@mcrepair.de',
        contactType: 'customer service',
        availableLanguage: 'German',
      },
    },
    dateModified: '2025-01-01',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Wie lange ist die Widerrufsfrist bei McRepair?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie kann ich meinen Reparaturauftrag bei McRepair widerrufen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie müssen McRepair (Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin, E-Mail: kontakt@mcrepair.de, Tel.: 030 403 688 951) mittels einer eindeutigen Erklärung – z. B. per Brief, Fax oder E-Mail – über Ihren Widerruf informieren. Sie können dazu das Muster-Widerrufsformular auf dieser Seite nutzen.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wann erlischt das Widerrufsrecht bei einer Reparatur?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Das Widerrufsrecht erlischt, wenn der Reparaturservice vollständig erbracht wurde und Sie zuvor ausdrücklich zugestimmt haben, dass die Reparatur noch während der Widerrufsfrist beginnen darf, und gleichzeitig Ihre Kenntnis bestätigt haben, dass Sie mit vollständiger Leistungserbringung Ihr Widerrufsrecht verlieren.',
        },
      },
      {
        '@type': 'Question',
        name: 'Erhalte ich mein Geld zurück, wenn ich widerrufe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ja, bei einem wirksamen Widerruf erstatten wir alle erhaltenen Zahlungen einschließlich Lieferkosten unverzüglich, spätestens binnen 14 Tagen nach Eingang Ihres Widerrufs. Die Rückzahlung erfolgt über dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion genutzt haben.',
        },
      },
    ],
  },
];

export function Widerrufsrecht() {
  const { t } = useTranslation();

  const instructionParagraphs = [
    t('withdrawalPage.instruction.paragraphs.p1'),
    t('withdrawalPage.instruction.paragraphs.p2'),
    t('withdrawalPage.instruction.paragraphs.p3'),
    t('withdrawalPage.instruction.paragraphs.p4'),
    t('withdrawalPage.instruction.paragraphs.p5')
  ];

  const consequencesParagraphs = [
    t('withdrawalPage.consequences.paragraphs.p1'),
    t('withdrawalPage.consequences.paragraphs.p2')
  ];

  const exclusionsParagraphs = [
    t('withdrawalPage.exclusions.paragraphs.p1'),
    t('withdrawalPage.exclusions.paragraphs.p2')
  ];

  const formFields = [
    t('withdrawalPage.form.fields.orderedOnReceivedOn'),
    t('withdrawalPage.form.fields.consumerName'),
    t('withdrawalPage.form.fields.consumerAddress'),
    t('withdrawalPage.form.fields.consumerSignature'),
    t('withdrawalPage.form.fields.date')
  ];

  return (
    <>
      <SEO
        title="Widerrufsrecht & Widerrufsformular – 14 Tage kostenlos"
        description="Ihr gesetzliches 14-tägiges Widerrufsrecht bei McRepair.de: Reparaturauftrag widerrufen, Muster-Widerrufsformular ausfüllen und Kontaktdaten. Jetzt informieren."
        canonical="/widerrufsrecht"
        keywords="Widerrufsrecht, Widerruf Reparatur, Muster-Widerrufsformular, 14 Tage Widerrufsrecht, Widerrufsbelehrung, McRepair Widerruf, Reparaturauftrag widerrufen"
        jsonLd={jsonLdSchemas}
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="widerrufsrecht-page">
        <div className="container">
          {/* ── Breadcrumb Navigation (visible + machine-readable) ── */}
          <nav
            className="widerrufsrecht-breadcrumb"
            aria-label="Breadcrumb"
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            <ol>
              <li
                itemScope
                itemType="https://schema.org/ListItem"
                itemProp="itemListElement"
              >
                <Link to="/" itemProp="item">
                  <span itemProp="name">Startseite</span>
                </Link>
                <meta itemProp="position" content="1" />
              </li>
              <li aria-hidden="true" className="breadcrumb-separator">›</li>
              <li
                itemScope
                itemType="https://schema.org/ListItem"
                itemProp="itemListElement"
              >
                <span itemProp="name" aria-current="page">Widerrufsrecht</span>
                <meta itemProp="position" content="2" />
              </li>
            </ol>
          </nav>

          <article
            className="widerrufsrecht-content"
            itemScope
            itemType="https://schema.org/WebPage"
            lang="de"
          >
            <meta itemProp="url" content="https://www.mcrepair.de/widerrufsrecht" />
            <meta itemProp="inLanguage" content="de-DE" />

            {/* Header */}
            <header className="widerrufsrecht-header">
              <h1 itemProp="name">{t('withdrawalPage.title')}</h1>
              <p className="widerrufsrecht-subtitle">
                Gesetzliche Grundlage gemäß §&nbsp;355&nbsp;BGB – für Verbraucher
              </p>
            </header>

            {/* Consumer Definition */}
            <section
              className="widerrufsrecht-section"
              aria-labelledby="section-verbraucher"
              id="verbraucher-definition"
            >
              <h2 id="section-verbraucher">{t('withdrawalPage.consumer.title')}</h2>
              <p className="consumer-definition" itemProp="description">
                {t('withdrawalPage.consumer.definition')}
              </p>
            </section>

            {/* Widerrufsbelehrung */}
            <section
              className="widerrufsrecht-section"
              aria-labelledby="section-belehrung"
              id="widerrufsbelehrung"
            >
              <h2 id="section-belehrung">{t('withdrawalPage.instruction.title')}</h2>

              <h3>{t('withdrawalPage.instruction.rightTitle')}</h3>
              {instructionParagraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}

              {/* Contact address rendered as machine-readable <address> */}
              <address
                className="widerrufs-contact-address"
                itemScope
                itemType="https://schema.org/Organization"
                aria-label="Kontaktadresse für Widerruf"
              >
                <span itemProp="name"><strong>Online Point GmbH</strong></span><br />
                <span itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                  <span itemProp="streetAddress">Kurfürstenstr. 106</span>,{' '}
                  <span itemProp="postalCode">10787</span>{' '}
                  <span itemProp="addressLocality">Berlin</span>
                </span><br />
                Telefon:{' '}
                <a href="tel:+493040368895" itemProp="telephone">030 403 688 951</a><br />
                E-Mail:{' '}
                <a href="mailto:kontakt@mcrepair.de" itemProp="email">kontakt@mcrepair.de</a>
              </address>
            </section>

            {/* Folgen des Widerrufs */}
            <section
              className="widerrufsrecht-section"
              aria-labelledby="section-folgen"
              id="folgen-des-widerrufs"
            >
              <h3 id="section-folgen">{t('withdrawalPage.consequences.title')}</h3>
              {consequencesParagraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </section>

            {/* Ausschluss- bzw. Erlöschensgründe */}
            <section
              className="widerrufsrecht-section"
              aria-labelledby="section-ausschluss"
              id="ausschluss-erloeschensgruende"
            >
              <h3 id="section-ausschluss">{t('withdrawalPage.exclusions.title')}</h3>
              {exclusionsParagraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </section>

            {/* Muster-Widerrufsformular */}
            <section
              className="widerrufsrecht-section widerrufsrecht-form"
              aria-labelledby="section-formular"
              id="muster-widerrufsformular"
              itemScope
              itemType="https://schema.org/HowTo"
            >
              <meta itemProp="name" content="Muster-Widerrufsformular ausfüllen" />
              <meta itemProp="description" content="Anleitung zum Ausfüllen des Widerrufsformulars für McRepair-Reparaturaufträge" />
              <h2 id="section-formular">{t('withdrawalPage.form.title')}</h2>

              <p className="form-intro">
                {t('withdrawalPage.form.intro')}
              </p>

              <div className="form-content">
                <p><strong>{t('withdrawalPage.form.addressLine')}</strong></p>

                <p>
                  <strong>{t('withdrawalPage.form.declarationLine')}</strong>
                </p>

                <div className="form-fields">
                  {formFields.map((field, idx) => (
                    <p key={idx} itemProp="step" itemScope itemType="https://schema.org/HowToStep">
                      <span itemProp="text">{field}</span>
                    </p>
                  ))}
                </div>

                <p className="form-footer">{t('withdrawalPage.form.footer')}</p>
              </div>
            </section>

            {/* Related legal links */}
            <nav
              className="widerrufsrecht-related-links"
              aria-label="Verwandte rechtliche Seiten"
            >
              <h3 className="related-links-title">Weitere rechtliche Informationen</h3>
              <ul>
                <li><Link to="/terms">AGB und Kundeninformationen</Link></li>
                <li><Link to="/datenschutz">Datenschutzerklärung</Link></li>
                <li><Link to="/impressum">Impressum</Link></li>
              </ul>
            </nav>
          </article>
        </div>
      </div>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
