import { TopBar } from '@/components/home/TopBar';
import { SEO } from '@/components/SEO'
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';
import './Privacy.css';

export function Privacy() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Datenschutzerklärung – McRepair.de"
        description="Erfahren Sie, wie McRepair.de Ihre Daten schützt und verarbeitet. Transparente Datenschutzerklärung gemäß DSGVO."
        canonical="/datenschutz"
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="privacy-page">
        <div className="container">
          <div className="privacy-content">
            {/* Header */}
            <header className="privacy-header">
              <h1>{t('privacyPage.title')}</h1>
            </header>

            <section className="privacy-section">
              <p>{t('privacyPage.intro')}</p>
              <p className="definition-highlight">{t('privacyPage.definition')}</p>
            </section>

            <section className="privacy-section">
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

            <section className="privacy-section">
              <h2>{t('privacyPage.serverLogs.title')}</h2>
              <p>{t('privacyPage.serverLogs.text')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.serverLogs.legalBasis')}
              </div>
            </section>

            <section className="privacy-section">
              <h2>{t('privacyPage.contactForm.title')}</h2>
              <p>{t('privacyPage.contactForm.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.contactForm.legalBasis')}
              </div>
              <p>{t('privacyPage.contactForm.text2')}</p>
            </section>

            <section className="privacy-section">
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

            <section className="privacy-section">
              <h2>{t('privacyPage.account.title')}</h2>
              <p>{t('privacyPage.account.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.account.legalBasis')}
              </div>
              <p>{t('privacyPage.account.text2')}</p>
            </section>

            <section className="privacy-section">
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

            <section className="privacy-section">
              <h2>{t('privacyPage.reviews.title')}</h2>
              <p>{t('privacyPage.reviews.text1')}</p>
              <p>{t('privacyPage.reviews.text2')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.reviews.legalBasis')}
              </div>
              <p>{t('privacyPage.reviews.text3')}</p>
              <p>{t('privacyPage.reviews.text4')}</p>
            </section>

            <section className="privacy-section">
              <h2>{t('privacyPage.newsletter.title')}</h2>
              <p>{t('privacyPage.newsletter.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.newsletter.legalBasis')}
              </div>
              <p>{t('privacyPage.newsletter.text2')}</p>
            </section>

            <section className="privacy-section">
              <h2>{t('privacyPage.shippingStatus.title')}</h2>
              <p>{t('privacyPage.shippingStatus.text1')}</p>
              <div className="legal-basis">
                <strong>{t('privacyPage.labels.legalBasis')}</strong> {t('privacyPage.shippingStatus.legalBasis')}
              </div>
              <p>{t('privacyPage.shippingStatus.text2')}</p>
            </section>

            <section className="privacy-section">
              <h2>{t('privacyPage.erp.title')}</h2>
              <p>{t('privacyPage.erp.text')}</p>
            </section>

            <section className="privacy-section">
              <h2>{t('privacyPage.paypal.title')}</h2>
              <p>
                {t('privacyPage.paypal.text')}{' '}
                <a href="https://www.paypal.com/de/webapps/mpp/ua/privacy-prev?locale.x=de_DE" target="_blank" rel="noopener noreferrer">https://www.paypal.com/de/webapps/mpp/ua/privacy-prev</a>
              </p>
            </section>

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
              <h2>{t('privacyPage.youtube.title')}</h2>
              <p>{t('privacyPage.youtube.text1')}</p>
              <p>{t('privacyPage.youtube.text2')}</p>
              <p>{t('privacyPage.youtube.moreInfo')} <a href="https://www.youtube.com/t/privacy" target="_blank" rel="noopener noreferrer">https://www.youtube.com/t/privacy</a></p>
            </section>

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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

            <section className="privacy-section">
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
      </div>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
