import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './ShippingAndPayment.css';

export function ShippingAndPayment() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Zahlung & Versand – FixitHub"
        description="Alle Zahlungsmethoden und Versandoptionen bei FixitHub auf einen Blick. Sicher bezahlen, schnell geliefert – jetzt informieren."
        canonical="/zahlung-und-versand"
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="shipping-payment-page">
        <div className="container">
          <div className="shipping-payment-content">
            {/* Header */}
            <header className="shipping-payment-header">
              <h1>{t('shippingPayment.title')}</h1>
              <p className="shipping-payment-subtitle">{t('shippingPayment.subtitle')}</p>
            </header>

            {/* How to send device section */}
            <section className="shipping-payment-part">
              <h2 className="part-title">{t('shippingPayment.howToSend.title')}</h2>
              
              <div className="steps-container">
                <div className="step-item">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h3>{t('shippingPayment.howToSend.step1Title')}</h3>
                    <p>{t('shippingPayment.howToSend.step1Desc')}</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h3>{t('shippingPayment.howToSend.step2Title')}</h3>
                    <p>{t('shippingPayment.howToSend.step2Desc')}</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h3>{t('shippingPayment.howToSend.step3Title')}</h3>
                    <p>{t('shippingPayment.howToSend.step3Desc')}</p>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h3>{t('shippingPayment.howToSend.step4Title')}</h3>
                    <p>{t('shippingPayment.howToSend.step4Desc')}</p>
                  </div>
                </div>
              </div>

              <p className="info-text">
                {t('shippingPayment.howToSend.moreInfo')} <a href="/faq">{t('shippingPayment.howToSend.faqLabel')}</a>.
              </p>
            </section>

            {/* Shipping Terms section */}
            <section className="shipping-payment-part">
              <h2 className="part-title">{t('shippingPayment.shippingTerms.title')}</h2>

              <div className="terms-list-section">
                <ul className="shipping-list">
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.germany')}:</strong> {t('shippingPayment.shippingTerms.germanyDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.eu')}:</strong> {t('shippingPayment.shippingTerms.euDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.nonEu')}:</strong> {t('shippingPayment.shippingTerms.nonEuDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.shippingTerms.tracking')}:</strong> {t('shippingPayment.shippingTerms.trackingDesc')}
                  </li>
                </ul>
              </div>
            </section>

            {/* Delivery times section */}
            <section className="shipping-payment-part">
              <h2 className="part-title">{t('shippingPayment.deliveryTimes.title')}</h2>

              <div className="terms-list-section">
                <ul className="shipping-list">
                  <li>{t('shippingPayment.deliveryTimes.info1')}</li>
                  <li>{t('shippingPayment.deliveryTimes.info2')}</li>
                  <li>{t('shippingPayment.deliveryTimes.info3')}</li>
                </ul>
              </div>
            </section>

            {/* Payment Methods section */}
            <section className="shipping-payment-part">
              <h2 className="part-title">{t('shippingPayment.paymentMethods.title')}</h2>

              <div className="info-box">
                <h3>{t('shippingPayment.paymentMethods.boxTitle')}</h3>
                <ul className="payment-list">
                  <li>
                    <strong>{t('shippingPayment.paymentMethods.invoice')}:</strong> {t('shippingPayment.paymentMethods.invoiceDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.paymentMethods.sepa')}:</strong> {t('shippingPayment.paymentMethods.sepaDesc')}
                  </li>
                  <li>
                    <strong>{t('shippingPayment.paymentMethods.creditCard')}:</strong> {t('shippingPayment.paymentMethods.creditCardDesc')}
                  </li>
                </ul>
              </div>
            </section>

            {/* Contact section */}
            <section className="shipping-payment-part">
              <h2 className="part-title">{t('shippingPayment.contact.title')}</h2>
              <p>{t('shippingPayment.contact.description')}</p>
              <div className="contact-box">
                <p><strong>{t('shippingPayment.contact.hotline')}:</strong> <a href="tel:+4930403688951">Tel: 030 403 688 951</a></p>
                <p><strong>{t('shippingPayment.contact.hours')}:</strong> {t('shippingPayment.contact.hoursText')}</p>
              </div>
            </section>

            {/* Express Note section */}
            <section className="shipping-payment-part last-section">
              <div className="note-box">
                <p className="note-title">{t('shippingPayment.expressNote.title')}</p>
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
