import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import './Imprint.css';

export function Imprint() {
  return (
    <>
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
              <h1>Impressum</h1>
            </header>

            {/* Legal Provider Information */}
            <section className="imprint-section">
              <h2>Gesetzliche Anbieterkennung</h2>
              <div className="company-info">
                <p><strong>Online Point GmbH</strong></p>
                <p>diese vertreten durch den Geschäftsführer Julian Szymansky</p>
                <p>
                  Kurfürstenstr. 106<br />
                  10787 Berlin<br />
                  Deutschland
                </p>
              </div>
            </section>

            {/* Contact Information */}
            <section className="imprint-section">
              <h2>Kontakt</h2>
              <div className="contact-info">
                <p><strong>Telefon Service:</strong> 030 403 688 951</p>
                <p><strong>Telefon Verwaltung:</strong> 030 403 688 950</p>
                <p><strong>E-Mail:</strong> <a href="mailto:kontakt@onlinepoint-gmbh.de">kontakt@onlinepoint-gmbh.de</a></p>
                <p><strong>Ust-ID.:</strong> DE318981969</p>
              </div>
            </section>

            {/* Company Registration */}
            <section className="imprint-section">
              <h2>Handelsregister</h2>
              <div className="registry-info">
                <p>eingetragen im Handelsregister des Amtsgerichtes Charlottenburg</p>
                <p><strong>Handelsregisternummer:</strong> HRB 136735 B</p>
                <p><strong>Sitz der Gesellschaft:</strong> Berlin</p>
                <p><strong>LUCID-Registrierungsnummer:</strong> DE1709904514391</p>
              </div>
            </section>

            {/* Design & Development */}
            <section className="imprint-section">
              <h2>Konzeption, Design & Umsetzung</h2>
              <p>
                <a href="https://vais-concepts.de" target="_blank" rel="noopener noreferrer">
                  https://vais-concepts.de
                </a>
              </p>
            </section>

            {/* Alternative Dispute Resolution */}
            <section className="imprint-section">
              <h2>Alternative Streitbeilegung</h2>
              <div className="info-box">
                <p>
                  Alternative Streitbeilegung gemäß Art. 14 Abs. 1 ODR-VO und § 36 VSBG: 
                  Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, 
                  die Sie unter <a href="http://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
                    http://ec.europa.eu/consumers/odr/
                  </a> finden.
                </p>
                <p>
                  Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle 
                  sind wir nicht verpflichtet und nicht bereit.
                </p>
              </div>
            </section>

            {/* Trademarks */}
            <section className="imprint-section last-section">
              <h2>Markenhinweise</h2>
              <div className="trademarks-info">
                <p>Die Marken <strong>iPhone</strong>, <strong>iPad</strong> sind eingetragene Warenzeichen von Apple Inc., Cupertino Calif., US.</p>
                <p>Die Marke <strong>HTC</strong> ist ein eingetragenes Warenzeichen von High Tech Computer Corporation, Taoyuan, TW.</p>
                <p>Die Marke <strong>LG</strong> ist ein eingetragenes Warenzeichen von LG Corp., Seoul/Soul, KR.</p>
                <p>Die Marke <strong>Nokia</strong> ist ein eingetragenes Warenzeichen von Nokia Corporation, Helsinki, FI.</p>
                <p>Die Marke <strong>Samsung</strong> ist ein eingetragenes Warenzeichen von Samsung Electronics Co., Ltd., Suwon Kyonggi, KR.</p>
                <p>Die Marke <strong>Sony Ericsson</strong> ist ein eingetragenes Warenzeichen von Sony Ericsson Mobile Communications AB, London, UK.</p>
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
