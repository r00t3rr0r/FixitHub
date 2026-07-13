import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './BatteryDisposal.css';

const batteryJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://www.mcrepair.de/hinweise-zur-batterieentsorgung#webpage',
    url: 'https://www.mcrepair.de/hinweise-zur-batterieentsorgung',
    name: 'Hinweise zur Batterieentsorgung – McRepair.de',
    description:
      'Gesetzliche Hinweise zur Rücknahme und Entsorgung von Batterien und Akkus gemäß Batteriegesetz (BattG) und ElektroG. Informationen zu Batteriesymbolen (Pb, Cd, Hg) und Rückgabemöglichkeiten.',
    inLanguage: 'de-DE',
    isPartOf: { '@id': 'https://www.mcrepair.de/#website' },
    about: {
      '@type': 'Thing',
      name: 'Batterieentsorgung und Rücknahme gemäß BattG',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Batterieentsorgung',
          item: 'https://www.mcrepair.de/hinweise-zur-batterieentsorgung',
        },
      ],
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Was bedeutet das Symbol der durchgekreuzten Mülltonne auf einer Batterie?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Das Symbol der durchgekreuzten Mülltonne bedeutet, dass die Batterie nicht in den Hausmüll gegeben werden darf. Altbatterien müssen gesondert gesammelt und entsorgt werden – gemäß Batteriegesetz (BattG) können Sie Altbatterien kostenlos bei uns oder bei kommunalen Sammelstellen zurückgeben.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was bedeutet das Pb-Zeichen auf einer Batterie?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pb steht für Blei (Plumbum). Das Pb-Symbol auf einer Batterie weist darauf hin, dass die Batterie mehr als 0,004 Masseprozent Blei enthält.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was bedeutet das Cd-Zeichen auf einer Batterie?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Cd steht für Cadmium. Das Cd-Symbol auf einer Batterie weist darauf hin, dass die Batterie mehr als 0,002 Masseprozent Cadmium enthält.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was bedeutet das Hg-Zeichen auf einer Batterie?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Hg steht für Quecksilber (Hydrargyrum). Das Hg-Symbol auf einer Batterie weist darauf hin, dass die Batterie mehr als 0,0005 Masseprozent Quecksilber enthält.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie kann ich Altbatterien bei McRepair.de zurückgeben?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie können Altbatterien aus unserem Sortiment kostenlos an unser Versandlager zurücksenden: Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin. Alternativ können Batterien unabhängig von einer Kaufverpflichtung bei kommunalen Sammelstellen (z. B. Wertstoffhöfen) oder im stationären Handel abgegeben werden.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche gesetzlichen Regelungen gelten für die Batterieentsorgung?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Die Rücknahme- und Entsorgungspflichten für Batterien und Akkus sind im Batteriegesetz (BattG) sowie im Elektro- und Elektronikgerätegesetz (ElektroG) geregelt. Als Endnutzer sind Sie verpflichtet, Altbatterien einer ordnungsgemäßen Entsorgung zuzuführen.',
        },
      },
    ],
  },
];

export function BatteryDisposal() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Hinweise zur Batterieentsorgung – McRepair.de"
        description="Batterieentsorgung gemäß BattG & ElektroG: Rücknahmepflichten, Batteriesymbole (Pb, Cd, Hg) erklärt und kostenlose Rückgabe bei McRepair.de."
        canonical="/hinweise-zur-batterieentsorgung"
        keywords="Batterieentsorgung, Akkuentsorgung, BattG, ElektroG, Batterierücknahme, Pb Symbol Batterie, Cd Symbol Batterie, Hg Symbol Batterie, durchgekreuzte Mülltonne Batterie, Altbatterien entsorgen, McRepair Akkurücknahme"
        jsonLd={batteryJsonLd}
      />
      <TopBar />
      <McRepairNav />

      <main className="battery-page" aria-label="Hinweise zur Batterieentsorgung">
        <div className="container">
          <div className="battery-content">
            <header className="battery-header">
              <h1>{t('batteryDisposal.title', 'Hinweise zur Batterieentsorgung')}</h1>
            </header>

            {/* Legal Obligation */}
            <section className="battery-section" aria-labelledby="battery-obligation-heading">
              <h2 id="battery-obligation-heading" className="sr-only">Gesetzliche Hinweispflicht</h2>
              <div className="battery-info-box">
                <p>{t('batteryDisposal.intro')}</p>
                <p>{t('batteryDisposal.returnInfo')}</p>
              </div>
            </section>

            {/* Return Address */}
            <section className="battery-section" aria-labelledby="return-address-heading">
              <h2 id="return-address-heading">{t('batteryDisposal.returnAddressTitle', 'Rücksendeadresse')}</h2>
              <address
                className="battery-address"
                itemScope
                itemType="https://schema.org/PostalAddress"
                style={{ fontStyle: 'normal' }}
              >
                <span itemProp="name">Online Point GmbH</span><br />
                <span itemProp="streetAddress">Kurfürstenstr. 106</span><br />
                <span itemProp="postalCode">10787</span>{' '}
                <span itemProp="addressLocality">Berlin</span><br />
                <span itemProp="addressCountry">Deutschland</span>
              </address>
            </section>

            {/* Battery Symbols */}
            <section className="battery-section" aria-labelledby="symbols-heading">
              <h2 id="symbols-heading">{t('batteryDisposal.symbolsTitle', 'Batteriesymbole und ihre Bedeutung')}</h2>
              <p>{t('batteryDisposal.symbolsIntro')}</p>
              <ul className="battery-symbol-list">
                <li>
                  <strong>&#9854;</strong>{' '}
                  {t('batteryDisposal.symbolBin')}
                </li>
                <li>
                  <strong>Pb</strong> – {t('batteryDisposal.symbolPb')}
                </li>
                <li>
                  <strong>Cd</strong> – {t('batteryDisposal.symbolCd')}
                </li>
                <li>
                  <strong>Hg</strong> – {t('batteryDisposal.symbolHg')}
                </li>
              </ul>
            </section>

            {/* Additional Collection Points */}
            <section className="battery-section" aria-labelledby="collection-heading">
              <h2 id="collection-heading">{t('batteryDisposal.collectionTitle', 'Weitere Rückgabemöglichkeiten')}</h2>
              <p>{t('batteryDisposal.collectionInfo')}</p>
            </section>

            {/* Legal Basis & Final Note */}
            <section className="battery-section last-section" aria-labelledby="legal-basis-heading">
              <h2 id="legal-basis-heading" className="sr-only">Gesetzliche Grundlage</h2>
              <p className="battery-legal-note">
                <strong>{t('batteryDisposal.legalBasis', 'Gesetzliche Grundlage: Batteriegesetz (BattG), ElektroG')}</strong>
              </p>
              <p className="battery-final-note">
                {t('batteryDisposal.finalNote')}
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
