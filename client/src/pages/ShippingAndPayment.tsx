import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './ShippingAndPayment.css';

const SHIPPING_PAYMENT_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Zahlung & Versand – McRepair.de',
    description:
      'Alles zu Versandoptionen, Zahlungsarten und Lieferzeiten beim McRepair Online-Reparaturservice: Kostenloser DHL-Versand in Deutschland, Zahlung per Kreditkarte, SEPA oder Rechnung.',
    url: 'https://www.mcrepair.de/zahlung-und-versand',
    inLanguage: 'de-DE',
    isPartOf: { '@type': 'WebSite', name: 'McRepair.de', url: 'https://www.mcrepair.de' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Zahlung & Versand',
          item: 'https://www.mcrepair.de/zahlung-und-versand',
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
        name: 'Wie schicke ich mein Gerät zur Reparatur ein?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Reparatur online buchen und kostenlose DHL-Paketmarke per E-Mail erhalten. Gerät sicher verpacken und im DHL Paketshop abgeben. Wir reparieren Ihr Gerät in 1–3 Werktagen (24h bei Expressreparatur). Das reparierte Gerät wird mit 1 Jahr Qualitätsgarantie an Ihre Wunschadresse zurückgesandt.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Versandkosten fallen bei McRepair an?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Lieferungen innerhalb Deutschlands sind vollständig kostenlos. Für Rücksendungen ins EU-Ausland fallen 13,99 € für DHL WeltPaket an. Außerhalb der EU können wir leider nicht liefern.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie lange dauert die Lieferung nach der Reparatur?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Lieferungen innerhalb Deutschlands dauern in der Regel 1–3 Werktage. Bei Auslandslieferungen innerhalb der EU rechnen Sie mit 2–5 Werktagen. An Sonn- und Feiertagen erfolgt keine Zustellung.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Zahlungsarten akzeptiert McRepair?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'McRepair akzeptiert Zahlung per Kreditkarte (Belastung bei Versand), SEPA-Basislastschrift, SEPA-Firmenlastschrift sowie Rechnung (ausschließlich für Behörden und Unternehmen, zahlbar innerhalb von 7 Tagen).',
        },
      },
      {
        '@type': 'Question',
        name: 'Gibt es eine Sendungsverfolgung für mein repariertes Gerät?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ja. Nach Abschluss der Reparatur erhalten Sie automatisch eine E-Mail mit Ihrer DHL-Sendungsnummer. Das Paket ist bei Beschädigung oder Verlust bis zu 500 € transportversichert.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was ist die McRepair 24h Express-Reparatur?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Mit der optionalen McRepair Express-Reparatur garantieren wir, dass Ihr Smartphone noch am selben Tag (Geräteeingang) repariert und wieder versendet wird. Kein Expressversand – die Laufzeit des Rückpakets bleibt standard.',
        },
      },
    ],
  },
]

export function ShippingAndPayment() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Zahlung & Versand – Versandkosten, Zahlungsarten & Lieferzeiten"
        description="Kostenloser DHL-Versand ✓ Zahlung per Kreditkarte, SEPA & Rechnung ✓ 1–3 Werktage Lieferzeit ✓ Sendungsverfolgung inklusive. Alle Versand- & Zahlungsinfos bei McRepair."
        canonical="/zahlung-und-versand"
        keywords="Versand McRepair, Zahlungsarten, Lieferzeiten, kostenloser DHL-Versand, Kreditkarte, SEPA Lastschrift, Reparatur einsenden, Sendungsverfolgung, Expressreparatur, Versandkosten"
        jsonLd={SHIPPING_PAYMENT_JSON_LD}
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="shipping-payment-page">
        <div className="container">
          {/* Breadcrumb – visible + schema.org microdata for crawlers */}
          <nav aria-label="Breadcrumb" className="shipping-payment-breadcrumb">
            <ol
              itemScope
              itemType="https://schema.org/BreadcrumbList"
              className="shipping-payment-breadcrumb-list"
            >
              <li
                itemScope
                itemProp="itemListElement"
                itemType="https://schema.org/ListItem"
              >
                <a itemProp="item" href="/">
                  <span itemProp="name">Startseite</span>
                </a>
                <meta itemProp="position" content="1" />
              </li>
              <li aria-hidden="true" className="shipping-payment-breadcrumb-sep">›</li>
              <li
                itemScope
                itemProp="itemListElement"
                itemType="https://schema.org/ListItem"
              >
                <span itemProp="name" aria-current="page">Zahlung &amp; Versand</span>
                <meta itemProp="position" content="2" />
              </li>
            </ol>
          </nav>

          <div className="shipping-payment-content">
            {/* Header */}
            <header className="shipping-payment-header">
              <h1>{t('shippingPayment.title')}</h1>
              <p className="shipping-payment-subtitle">{t('shippingPayment.subtitle')}</p>
            </header>

            {/* How to send device section */}
            <section
              className="shipping-payment-part"
              aria-labelledby="section-how-to-send"
              itemScope
              itemType="https://schema.org/HowTo"
            >
              <h2 id="section-how-to-send" className="part-title" itemProp="name">
                {t('shippingPayment.howToSend.title')}
              </h2>

              {/* Semantic ordered list for steps – crawlers recognise step sequence */}
              <ol className="steps-container" aria-label="Schritte zum Einsenden Ihres Geräts">
                <li
                  className="step-item"
                  itemScope
                  itemProp="step"
                  itemType="https://schema.org/HowToStep"
                >
                  <div className="step-number" aria-hidden="true">1</div>
                  <div className="step-content">
                    <h3 itemProp="name">{t('shippingPayment.howToSend.step1Title')}</h3>
                    <p itemProp="text">{t('shippingPayment.howToSend.step1Desc')}</p>
                  </div>
                </li>

                <li
                  className="step-item"
                  itemScope
                  itemProp="step"
                  itemType="https://schema.org/HowToStep"
                >
                  <div className="step-number" aria-hidden="true">2</div>
                  <div className="step-content">
                    <h3 itemProp="name">{t('shippingPayment.howToSend.step2Title')}</h3>
                    <p itemProp="text">{t('shippingPayment.howToSend.step2Desc')}</p>
                  </div>
                </li>

                <li
                  className="step-item"
                  itemScope
                  itemProp="step"
                  itemType="https://schema.org/HowToStep"
                >
                  <div className="step-number" aria-hidden="true">3</div>
                  <div className="step-content">
                    <h3 itemProp="name">{t('shippingPayment.howToSend.step3Title')}</h3>
                    <p itemProp="text">{t('shippingPayment.howToSend.step3Desc')}</p>
                  </div>
                </li>

                <li
                  className="step-item"
                  itemScope
                  itemProp="step"
                  itemType="https://schema.org/HowToStep"
                >
                  <div className="step-number" aria-hidden="true">4</div>
                  <div className="step-content">
                    <h3 itemProp="name">{t('shippingPayment.howToSend.step4Title')}</h3>
                    <p itemProp="text">{t('shippingPayment.howToSend.step4Desc')}</p>
                  </div>
                </li>
              </ol>

              <p className="info-text">
                {t('shippingPayment.howToSend.moreInfo')}{' '}
                <a href="/faq" rel="noopener">{t('shippingPayment.howToSend.faqLabel')}</a>.
              </p>
            </section>

            {/* Shipping Terms section */}
            <section
              className="shipping-payment-part"
              aria-labelledby="section-shipping-terms"
            >
              <h2 id="section-shipping-terms" className="part-title">
                {t('shippingPayment.shippingTerms.title')}
              </h2>

              <div className="terms-list-section">
                <ul className="shipping-list">
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.germany')}:</strong>{' '}
                    {t('shippingPayment.shippingTerms.germanyDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.eu')}:</strong>{' '}
                    {t('shippingPayment.shippingTerms.euDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.nonEu')}:</strong>{' '}
                    {t('shippingPayment.shippingTerms.nonEuDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.tracking')}:</strong>{' '}
                    {t('shippingPayment.shippingTerms.trackingDesc')}
                  </li>
                </ul>
              </div>
            </section>

            {/* Delivery times section */}
            <section
              className="shipping-payment-part"
              aria-labelledby="section-delivery-times"
            >
              <h2 id="section-delivery-times" className="part-title">
                {t('shippingPayment.deliveryTimes.title')}
              </h2>

              <div className="terms-list-section">
                <ul className="shipping-list">
                  <li>{t('shippingPayment.deliveryTimes.info1')}</li>
                  <li>{t('shippingPayment.deliveryTimes.info2')}</li>
                  <li>{t('shippingPayment.deliveryTimes.info3')}</li>
                </ul>
              </div>
            </section>

            {/* Payment Methods section – schema.org PaymentMethod microdata */}
            <section
              className="shipping-payment-part"
              aria-labelledby="section-payment-methods"
              itemScope
              itemType="https://schema.org/Service"
            >
              <meta itemProp="serviceType" content="Zahlungsabwicklung" />
              <meta itemProp="provider" content="McRepair.de" />

              <h2 id="section-payment-methods" className="part-title" itemProp="name">
                {t('shippingPayment.paymentMethods.title')}
              </h2>

              <div className="info-box">
                <h3>{t('shippingPayment.paymentMethods.boxTitle')}</h3>
                <ul className="payment-list">
                  <li itemScope itemType="https://schema.org/PaymentMethod">
                    <strong>{t('shippingPayment.paymentMethods.invoice')}:</strong>{' '}
                    <span itemProp="description">{t('shippingPayment.paymentMethods.invoiceDesc')}</span>
                  </li>
                  <li itemScope itemType="https://schema.org/PaymentMethod">
                    <strong>{t('shippingPayment.paymentMethods.sepa')}:</strong>{' '}
                    <span itemProp="description">{t('shippingPayment.paymentMethods.sepaDesc')}</span>
                  </li>
                  <li itemScope itemType="https://schema.org/PaymentMethod">
                    <strong>{t('shippingPayment.paymentMethods.creditCard')}:</strong>{' '}
                    <span itemProp="description">{t('shippingPayment.paymentMethods.creditCardDesc')}</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Contact section */}
            <section
              className="shipping-payment-part"
              aria-labelledby="section-contact"
            >
              <h2 id="section-contact" className="part-title">
                {t('shippingPayment.contact.title')}
              </h2>
              <p>{t('shippingPayment.contact.description')}</p>
              <address className="contact-box">
                <p>
                  <strong>{t('shippingPayment.contact.hotline')}:</strong>{' '}
                  <a href="tel:+4930403688951" aria-label="McRepair Service-Hotline anrufen">
                    Tel: 030 403 688 951
                  </a>
                </p>
                <p>
                  <strong>{t('shippingPayment.contact.hours')}:</strong>{' '}
                  <time>{t('shippingPayment.contact.hoursText')}</time>
                </p>
              </address>
            </section>

            {/* Express Note section */}
            <section
              className="shipping-payment-part last-section"
              aria-labelledby="section-express-note"
            >
              <div className="note-box">
                <p id="section-express-note" className="note-title">
                  {t('shippingPayment.expressNote.title')}
                </p>
                <p>{t('shippingPayment.expressNote.description')}</p>
              </div>

              <p className="shipping-cost-note">
                <em>{t('shippingPayment.shippingCostNote')}</em>
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}
