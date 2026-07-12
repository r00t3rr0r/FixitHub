import { TopBar } from '@/components/home/TopBar';
import { SEO } from '@/components/SEO'
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import './Privacy.css';

const PRIVACY_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Datenschutzerklärung – McRepair.de',
    description:
      'Vollständige Datenschutzerklärung gemäß DSGVO: Welche personenbezogenen Daten McRepair.de verarbeitet, auf welcher Rechtsgrundlage und welche Rechte Sie als Betroffener haben.',
    url: 'https://www.mcrepair.de/datenschutz',
    inLanguage: 'de',
    isPartOf: { '@type': 'WebSite', name: 'McRepair.de', url: 'https://www.mcrepair.de' },
    about: { '@type': 'Thing', name: 'Datenschutz & DSGVO' },
    dateModified: '2025-01-01',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de/' },
        { '@type': 'ListItem', position: 2, name: 'Datenschutzerklärung', item: 'https://www.mcrepair.de/datenschutz' },
      ],
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Online Point GmbH',
    alternateName: 'McRepair.de',
    url: 'https://www.mcrepair.de',
    logo: 'https://www.mcrepair.de/logo.png',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Kurfürstenstr. 106',
      addressLocality: 'Berlin',
      postalCode: '10787',
      addressCountry: 'DE',
    },
    telephone: '+493040368895',
    email: 'kontakt@mcrepair.de',
    sameAs: [
      'https://www.facebook.com/mcrepair',
      'https://www.instagram.com/mcrepair',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Welche Datenschutzrechte habe ich als Kunde?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO) und Datenübertragbarkeit (Art. 20 DSGVO). Widersprüche richten Sie an kontakt@mcrepair.de.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wer ist verantwortlich für die Datenverarbeitung bei McRepair.de?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Verantwortlich ist die Online Point GmbH, Kurfürstenstr. 106, 10787 Berlin, Deutschland. Telefon: 030 403 688 951, E-Mail: kontakt@mcrepair.de.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie lange werden meine Daten bei McRepair.de gespeichert?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Handelsbriefe und relevante Buchungsbelege werden gesetzeskonform 6 bis 10 Jahre aufbewahrt. Nach Ablauf der Fristen werden die Daten routinemäßig gelöscht.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie kann ich Cookies bei McRepair.de deaktivieren?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie können Cookies in Ihrem Browser verwalten oder deaktivieren: Chrome → Einstellungen > Datenschutz; Firefox → Einstellungen > Datenschutz & Sicherheit; Safari → Einstellungen > Datenschutz. Beachten Sie, dass bei deaktivierten Cookies nicht alle Website-Funktionen verfügbar sind.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wo kann ich mich über Datenschutzverstöße beschweren?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie können sich bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit beschweren: Friedrichstr. 219, 10969 Berlin, Telefon: 030 13889-0, mailbox@datenschutz-berlin.de, www.datenschutz-berlin.de.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Zahlungsdaten werden bei McRepair.de verarbeitet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Zahlungsdaten werden ausschließlich über zertifizierte Zahlungsdienstleister (u.a. PayPal) verarbeitet. McRepair.de speichert keine vollständigen Zahlungsdaten. Die Verarbeitung erfolgt gemäß Art. 6 Abs. 1 lit. b DSGVO zur Vertragserfüllung.',
        },
      },
      {
        '@type': 'Question',
        name: 'Werden meine Daten in Drittländer übermittelt?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bei der Nutzung bestimmter Dienste (Google Analytics, reCAPTCHA, Google Ads) können Daten in die USA übermittelt werden. Die Übermittlung erfolgt auf Grundlage des Angemessenheitsbeschlusses der EU-Kommission.',
        },
      },
    ],
  },
];

// Section definitions for the Table of Contents
const TOC_SECTIONS = [
  { id: 'verantwortlicher', labelKey: 'privacyPage.controller.title' },
  { id: 'server-logfiles', labelKey: 'privacyPage.serverLogs.title' },
  { id: 'kontaktformular', labelKey: 'privacyPage.contactForm.title' },
  { id: 'recaptcha', labelKey: 'privacyPage.recaptcha.title' },
  { id: 'kundenkonto', labelKey: 'privacyPage.account.title' },
  { id: 'bestellungen', labelKey: 'privacyPage.orders.title' },
  { id: 'kundenbewertungen', labelKey: 'privacyPage.reviews.title' },
  { id: 'newsletter', labelKey: 'privacyPage.newsletter.title' },
  { id: 'versandstatus', labelKey: 'privacyPage.shippingStatus.title' },
  { id: 'warenwirtschaft', labelKey: 'privacyPage.erp.title' },
  { id: 'paypal', labelKey: 'privacyPage.paypal.title' },
  { id: 'cookies', labelKey: 'privacyPage.cookies.title' },
  { id: 'google-analytics', labelKey: 'privacyPage.analytics.title' },
  { id: 'remarketing', labelKey: 'privacyPage.remarketing.title' },
  { id: 'conversion-tracking', labelKey: 'privacyPage.conversionTracking.title' },
  { id: 'facebook-remarketing', labelKey: 'privacyPage.facebook.title' },
  { id: 'google-adsense', labelKey: 'privacyPage.adsense.title' },
  { id: 'bing-ads', labelKey: 'privacyPage.bingAds.title' },
  { id: 'social-plugins', labelKey: 'privacyPage.social.title' },
  { id: 'youtube', labelKey: 'privacyPage.youtube.title' },
  { id: 'google-maps', labelKey: 'privacyPage.maps.title' },
  { id: 'aufbewahrungsfristen', labelKey: 'privacyPage.retention.title' },
  { id: 'betroffenenrechte', labelKey: 'privacyPage.rights.title' },
  { id: 'beschwerderecht', labelKey: 'privacyPage.complaint.title' },
];

export function Privacy() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Datenschutzerklärung – DSGVO-konforme Datenschutzinformationen"
        description="Vollständige Datenschutzerklärung von McRepair.de: Erfahren Sie, welche Daten wir verarbeiten, auf welcher Rechtsgrundlage und wie Sie Ihre Rechte nach DSGVO geltend machen können."
        canonical="/datenschutz"
        keywords="Datenschutzerklärung, DSGVO, Datenschutz McRepair, personenbezogene Daten, Datenschutzrechte, Cookies, Google Analytics Opt-out, Betroffenenrechte, Datenschutzbeauftragter"
        jsonLd={PRIVACY_JSON_LD}
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <main className="privacy-page">
        <div className="container">
          <div className="privacy-content">
            {/* Header */}
            <header className="privacy-header">
              <h1>{t('privacyPage.title')}</h1>
            </header>

            {/* Table of Contents – crawlable internal nav for search engines */}
            <nav className="privacy-toc" aria-label="Inhaltsverzeichnis Datenschutzerklärung">
              <h2 className="privacy-toc__heading">Inhaltsverzeichnis</h2>
              <ol className="privacy-toc__list">
                {TOC_SECTIONS.map((s) => (
                  <li key={s.id} className="privacy-toc__item">
                    <a href={`#${s.id}`} className="privacy-toc__link">
                      {t(s.labelKey)}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <section className="privacy-section" aria-labelledby="privacy-intro">
              <p id="privacy-intro">{t('privacyPage.intro')}</p>
              <p className="definition-highlight">{t('privacyPage.definition')}</p>
            </section>

            <section id="verantwortlicher" className="privacy-section">
              <h2>{t('privacyPage.controller.title')}</h2>
              <div className="contact-info">
                <p><strong>Online Point GmbH</strong><br />
                Kurfürstenstr. 106<br />
                10787 Berlin<br />
                {t('privacyPage.controller.country')}</p>
                <p>
                  <strong>{t('privacyPage.controller.phoneLabel')}</strong> 030 403 688 951<br />
                  <strong>{t('privacyPage.controller.emailLabel')}</strong> kontakt@mcrepair.de
                </p>
              </div>
            </section>

            <section id="server-logfiles" className="privacy-section">
              <h2>{t('privacyPage.serverLogs.title')}</h2>
              <p>{t('privacyPage.serverLogs.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.serverLogs.legalBasis')}
              </div>
            </section>

            <section id="kontaktformular" className="privacy-section">
              <h2>{t('privacyPage.contactForm.title')}</h2>
              <p>{t('privacyPage.contactForm.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.contactForm.legalBasis')}
              </div>
              <p>{t('privacyPage.contactForm.text2')}</p>
            </section>

            <section id="recaptcha" className="privacy-section">
              <h2>{t('privacyPage.recaptcha.title')}</h2>
              <p>{t('privacyPage.recaptcha.text1')}</p>
              <p>{t('privacyPage.recaptcha.text2')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.recaptcha.legalBasis')}<br />
                <strong>{t('privacyPage.labels.dataTransfer')}</strong> {t('privacyPage.recaptcha.transfer')}
              </div>
              <p>
                {t('privacyPage.recaptcha.moreInfo')}{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>
              </p>
            </section>

            <section id="kundenkonto" className="privacy-section">
              <h2>{t('privacyPage.account.title')}</h2>
              <p>{t('privacyPage.account.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.account.legalBasis')}
              </div>
              <p>{t('privacyPage.account.text2')}</p>
            </section>

            <section id="bestellungen" className="privacy-section">
              <h2>{t('privacyPage.orders.title')}</h2>
              <p>{t('privacyPage.orders.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.orders.legalBasis')}
              </div>
              <p>{t('privacyPage.orders.text2')}</p>
              <ul className="category-list">
                <li>{t('privacyPage.orders.recipients.shipping')}</li>
                <li>{t('privacyPage.orders.recipients.payment')}</li>
                <li>{t('privacyPage.orders.recipients.erp')}</li>
                <li>{t('privacyPage.orders.recipients.orderProcessing')}</li>
                <li>{t('privacyPage.orders.recipients.hosting')}</li>
                <li>{t('privacyPage.orders.recipients.it')}</li>
                <li>{t('privacyPage.orders.recipients.dropshipping')}</li>
              </ul>
              <p>{t('privacyPage.orders.text3')}</p>
            </section>

            <section id="kundenbewertungen" className="privacy-section">
              <h2>{t('privacyPage.reviews.title')}</h2>
              <p>{t('privacyPage.reviews.text1')}</p>
              <p>{t('privacyPage.reviews.text2')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.reviews.legalBasis')}
              </div>
              <p>{t('privacyPage.reviews.text3')}</p>
              <p>{t('privacyPage.reviews.text4')}</p>
            </section>

            <section id="newsletter" className="privacy-section">
              <h2>{t('privacyPage.newsletter.title')}</h2>
              <p>{t('privacyPage.newsletter.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.newsletter.legalBasis')}
              </div>
              <p>{t('privacyPage.newsletter.text2')}</p>
            </section>

            <section id="versandstatus" className="privacy-section">
              <h2>{t('privacyPage.shippingStatus.title')}</h2>
              <p>{t('privacyPage.shippingStatus.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.shippingStatus.legalBasis')}
              </div>
              <p>{t('privacyPage.shippingStatus.text2')}</p>
            </section>

            <section id="warenwirtschaft" className="privacy-section">
              <h2>{t('privacyPage.erp.title')}</h2>
              <p>{t('privacyPage.erp.text')}</p>
            </section>

            <section id="paypal" className="privacy-section">
              <h2>{t('privacyPage.paypal.title')}</h2>
              <p>
                {t('privacyPage.paypal.text')}{' '}
                <a href="https://www.paypal.com/de/webapps/mpp/ua/privacy-prev?locale.x=de_DE" target="_blank" rel="noopener noreferrer">https://www.paypal.com/de/webapps/mpp/ua/privacy-prev</a>
              </p>
            </section>

            <section id="cookies" className="privacy-section">
              <h2>{t('privacyPage.cookies.title')}</h2>
              <p>{t('privacyPage.cookies.text1')}</p>
              <p>{t('privacyPage.cookies.text2')}</p>
              <p>{t('privacyPage.cookies.text3')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.cookies.legalBasis')}
              </div>
              <p>{t('privacyPage.cookies.text4')}</p>
              <p>{t('privacyPage.cookies.text5')}</p>
              <p>{t('privacyPage.cookies.text6')}</p>
              <div className="browser-settings">
                <h3>{t('privacyPage.cookies.browserTitle')}</h3>
                <ul>
                  <li><a href="https://support.google.com/accounts/answer/61416?hl=de" target="_blank" rel="noopener noreferrer">{t('privacyPage.cookies.browserChrome')}</a></li>
                  <li><a href="https://support.microsoft.com/de-de/help/17442/windows-internet-explorer-delete-manage-cookies" target="_blank" rel="noopener noreferrer">{t('privacyPage.cookies.browserIe')}</a></li>
                  <li><a href="https://support.mozilla.org/de/kb/cookies-erlauben-und-ablehnen" target="_blank" rel="noopener noreferrer">{t('privacyPage.cookies.browserFirefox')}</a></li>
                  <li><a href="https://support.apple.com/de-de/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">{t('privacyPage.cookies.browserSafari')}</a></li>
                </ul>
              </div>
            </section>

            <section id="google-analytics" className="privacy-section">
              <h2>{t('privacyPage.analytics.title')}</h2>
              <p>{t('privacyPage.analytics.text1')}</p>
              <p>{t('privacyPage.analytics.text2')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.analytics.legalBasis')}<br />
                <strong>{t('privacyPage.labels.dataTransfer')}</strong> {t('privacyPage.analytics.transfer')}
              </div>
              <p>
                {t('privacyPage.analytics.optOut')}{' '}
                <a href="https://tools.google.com/dlpage/gaoptout?hl=de" target="_blank" rel="noopener noreferrer">{t('privacyPage.analytics.optOutLinkLabel')}</a>
              </p>
              <p>
                {t('privacyPage.analytics.moreInfo')}{' '}
                <a href="https://www.google.com/analytics/terms/de.html" target="_blank" rel="noopener noreferrer">Google Analytics Terms</a>{' '}
                {t('privacyPage.labels.and')} <a href="https://www.google.de/intl/de/policies/" target="_blank" rel="noopener noreferrer">Google Policies</a>.
              </p>
            </section>

            <section id="remarketing" className="privacy-section">
              <h2>{t('privacyPage.remarketing.title')}</h2>
              <p>{t('privacyPage.remarketing.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.remarketing.legalBasis')}<br />
                <strong>{t('privacyPage.labels.dataTransfer')}</strong> {t('privacyPage.remarketing.transfer')}
              </div>
              <p>
                {t('privacyPage.remarketing.optOut')}{' '}
                <a href="https://support.google.com/ads/answer/7395996?hl=de" target="_blank" rel="noopener noreferrer">{t('privacyPage.remarketing.optOutLinkLabel')}</a>
              </p>
              <p>
                {t('privacyPage.remarketing.networkOptOut')}{' '}
                <a href="https://www.networkadvertising.org/choices/" target="_blank" rel="noopener noreferrer">https://www.networkadvertising.org/choices/</a>.
              </p>
              <p>
                {t('privacyPage.remarketing.moreInfo')}{' '}
                <a href="https://www.google.com/privacy/ads/" target="_blank" rel="noopener noreferrer">https://www.google.com/privacy/ads/</a>
              </p>
            </section>

            <section id="conversion-tracking" className="privacy-section">
              <h2>{t('privacyPage.conversionTracking.title')}</h2>
              <p>{t('privacyPage.conversionTracking.text1')}</p>
              <p>{t('privacyPage.conversionTracking.text2')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.conversionTracking.legalBasis')}
              </div>
              <p>
                {t('privacyPage.conversionTracking.moreInfo')}{' '}
                <a href="https://www.google.de/policies/privacy/" target="_blank" rel="noopener noreferrer">https://www.google.de/policies/privacy/</a>
              </p>
            </section>

            <section id="facebook-remarketing" className="privacy-section">
              <h2>{t('privacyPage.facebook.title')}</h2>
              <p>{t('privacyPage.facebook.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.facebook.legalBasis')}
              </div>
              <p>
                {t('privacyPage.facebook.moreInfo')}{' '}
                <a href="https://www.facebook.com/about/privacy/" target="_blank" rel="noopener noreferrer">https://www.facebook.com/about/privacy/</a>.
              </p>
            </section>

            <section id="google-adsense" className="privacy-section">
              <h2>{t('privacyPage.adsense.title')}</h2>
              <p>{t('privacyPage.adsense.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.adsense.legalBasis')}
              </div>
              <p>
                {t('privacyPage.adsense.optOut')}{' '}
                <a href="https://support.google.com/ads/answer/7395996?hl=de" target="_blank" rel="noopener noreferrer">{t('privacyPage.adsense.optOutLinkLabel')}</a>
              </p>
              <p>
                {t('privacyPage.adsense.moreInfo')}{' '}
                <a href="https://www.google.com/policies/technologies/ads/" target="_blank" rel="noopener noreferrer">https://www.google.com/policies/technologies/ads/</a>
              </p>
            </section>

            <section id="bing-ads" className="privacy-section">
              <h2>{t('privacyPage.bingAds.title')}</h2>
              <p>{t('privacyPage.bingAds.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.bingAds.legalBasis')}<br />
                <strong>{t('privacyPage.labels.privacyInfo')}</strong> {t('privacyPage.bingAds.privacyInfo')}
              </div>
              <p>
                {t('privacyPage.bingAds.moreInfo')}{' '}
                <a href="https://privacy.microsoft.com/de-de/privacystatement" target="_blank" rel="noopener noreferrer">https://privacy.microsoft.com/de-de/privacystatement</a>
              </p>
            </section>

            <section id="social-plugins" className="privacy-section">
              <h2>{t('privacyPage.social.title')}</h2>
              <p>{t('privacyPage.social.text1')}</p>
              <p>{t('privacyPage.social.text2')}</p>
              <p>{t('privacyPage.social.text3')}</p>
              <h3>{t('privacyPage.social.networksTitle')}</h3>
              <ul className="social-list">
                <li><strong>Google+</strong> - <a href="https://www.google.com/intl/de/+/policy/+1button.html" target="_blank" rel="noopener noreferrer">{t('privacyPage.social.privacyLabel')}</a></li>
                <li><strong>Facebook</strong> - <a href="https://www.facebook.com/policy.php" target="_blank" rel="noopener noreferrer">{t('privacyPage.social.privacyLabel')}</a></li>
                <li><strong>Twitter</strong> - <a href="https://twitter.com/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPage.social.privacyLabel')}</a></li>
                <li><strong>Instagram</strong> - <a href="https://help.instagram.com/155833707900388" target="_blank" rel="noopener noreferrer">{t('privacyPage.social.privacyLabel')}</a></li>
                <li><strong>XING</strong> - <a href="https://www.xing.com/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPage.social.privacyLabel')}</a></li>
              </ul>
            </section>

            <section id="youtube" className="privacy-section">
              <h2>{t('privacyPage.youtube.title')}</h2>
              <p>{t('privacyPage.youtube.text1')}</p>
              <p>{t('privacyPage.youtube.text2')}</p>
              <p>{t('privacyPage.youtube.moreInfo')} <a href="https://www.youtube.com/t/privacy" target="_blank" rel="noopener noreferrer">https://www.youtube.com/t/privacy</a></p>
            </section>

            <section id="google-maps" className="privacy-section">
              <h2>{t('privacyPage.maps.title')}</h2>
              <p>{t('privacyPage.maps.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.maps.legalBasis')}<br />
                <strong>{t('privacyPage.labels.dataTransfer')}</strong> {t('privacyPage.maps.transfer')}
              </div>
              <p>
                {t('privacyPage.maps.moreInfo')}{' '}
                <a href="https://www.google.com/privacypolicy.html" target="_blank" rel="noopener noreferrer">https://www.google.com/privacypolicy.html</a>.
              </p>
            </section>

            <section id="aufbewahrungsfristen" className="privacy-section">
              <h2>{t('privacyPage.retention.title')}</h2>
              <p>{t('privacyPage.retention.text')}</p>
              <div className="info-box">
                <h3>{t('privacyPage.retention.boxTitle')}</h3>
                <ul>
                  <li><strong>{t('privacyPage.retention.commercialLabel')}</strong> {t('privacyPage.retention.commercialValue')}</li>
                  <li><strong>{t('privacyPage.retention.taxLabel')}</strong> {t('privacyPage.retention.taxValue')}</li>
                </ul>
              </div>
            </section>

            <section id="betroffenenrechte" className="privacy-section">
              <h2>{t('privacyPage.rights.title')}</h2>
              <p>{t('privacyPage.rights.intro')}</p>
              <ul className="rights-list">
                <li><strong>{t('privacyPage.rights.items.access')}</strong> (Art. 15 DSGVO)</li>
                <li><strong>{t('privacyPage.rights.items.rectification')}</strong> (Art. 16 DSGVO)</li>
                <li><strong>{t('privacyPage.rights.items.erasure')}</strong> (Art. 17 DSGVO)</li>
                <li><strong>{t('privacyPage.rights.items.restriction')}</strong> (Art. 18 DSGVO)</li>
                <li><strong>{t('privacyPage.rights.items.portability')}</strong> (Art. 20 DSGVO)</li>
              </ul>
              <p>{t('privacyPage.rights.objection')}</p>
              <div className="contact-highlight">
                <p><strong>{t('privacyPage.rights.contactStrong')}</strong><br />
                {t('privacyPage.rights.contactText')}</p>
              </div>
            </section>

            <section id="beschwerderecht" className="privacy-section">
              <h2>{t('privacyPage.complaint.title')}</h2>
              <p>{t('privacyPage.complaint.text')}</p>
              <div className="authority-info">
                <h3>{t('privacyPage.complaint.authorityTitle')}</h3>
                <p>
                  <strong>{t('privacyPage.complaint.authorityName')}</strong><br />
                  Friedrichstr. 219<br />
                  10969 Berlin<br />
                  <br />
                  {t('privacyPage.controller.phoneLabel')} 030 13889-0<br />
                  {t('privacyPage.controller.emailLabel')} mailbox@datenschutz-berlin.de<br />
                  {t('privacyPage.labels.website')} <a href="https://www.datenschutz-berlin.de" target="_blank" rel="noopener noreferrer">www.datenschutz-berlin.de</a>
                </p>
              </div>
            </section>

            <section className="privacy-section last-section">
              <p className="last-updated">
                <strong>{t('privacyPage.updatedLabel')}</strong> {t('privacyPage.updatedValue')}
              </p>
              <p className="final-note">
                {t('privacyPage.finalNote')}
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
