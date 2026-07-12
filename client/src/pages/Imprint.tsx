import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Imprint.css';

export function Imprint() {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title="Impressum – FixitHub"
        description="Gesetzlich vorgeschriebene Angaben zum Anbieter: FixitHub Reparaturservice – Kontaktdaten, Handelsregister und verantwortliche Person."
        canonical="/impressum"
      />
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="imprint-page">
        <div className="container">
          <div className="imprint-content">
            {/* Header */}
            <header className="imprint-header">
              <h1>{t('imprint.title')}</h1>
            </header>

            {/* Legal Provider Information */}
            <section className="imprint-section">
              <h2>{t('imprint.legalProvider.heading')}</h2>
              <div className="company-info">
                <p><strong>{t('imprint.legalProvider.companyName')}</strong></p>
                <p>{t('imprint.legalProvider.representative')}</p>
                <p>
                  {t('imprint.legalProvider.address')}<br />
                  {t('imprint.legalProvider.city')}<br />
                  {t('imprint.legalProvider.country')}
                </p>
              </div>
            </section>

            {/* Contact Information */}
            <section className="imprint-section">
              <h2>{t('imprint.contact.heading')}</h2>
              <div className="contact-info">
                <p><strong>{t('imprint.contact.phoneService')}:</strong> 030 403 688 951</p>
                <p><strong>{t('imprint.contact.phoneAdmin')}:</strong> 030 403 688 950</p>
                <p><strong>{t('imprint.contact.email')}:</strong> <a href="mailto:kontakt@onlinepoint-gmbh.de">kontakt@onlinepoint-gmbh.de</a></p>
                <p><strong>{t('imprint.contact.vatId')}:</strong> DE318981969</p>
              </div>
            </section>

            {/* Company Registration */}
            <section className="imprint-section">
              <h2>{t('imprint.companyReg.heading')}</h2>
              <div className="registry-info">
                <p>{t('imprint.companyReg.intro')}</p>
                <p><strong>{t('imprint.companyReg.regNumber')}:</strong> {t('imprint.companyReg.regNumberValue')}</p>
                <p><strong>{t('imprint.companyReg.companySeat')}:</strong> {t('imprint.companyReg.companySeatValue')}</p>
                <p><strong>{t('imprint.companyReg.lucidNumber')}:</strong> {t('imprint.companyReg.lucidNumberValue')}</p>
              </div>
            </section>

            {/* Design & Development */}
            <section className="imprint-section">
              <h2>{t('imprint.design.heading')}</h2>
              <p>
                <a href="https://vais-concepts.de" target="_blank" rel="noopener noreferrer">
                  https://vais-concepts.de
                </a>
              </p>
            </section>

            {/* Alternative Dispute Resolution */}
            <section className="imprint-section">
              <h2>{t('imprint.disputeResolution.heading')}</h2>
              <div className="info-box">
                <p>
                  {t('imprint.disputeResolution.text1before')}
                  <a href="http://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
                    http://ec.europa.eu/consumers/odr/
                  </a>
                  {t('imprint.disputeResolution.text1after')}
                </p>
                <p>{t('imprint.disputeResolution.text2')}</p>
              </div>
            </section>

            {/* Trademarks */}
            <section className="imprint-section last-section">
              <h2>{t('imprint.trademarks.heading')}</h2>
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
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}
