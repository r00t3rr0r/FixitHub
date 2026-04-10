import { useTranslation } from 'react-i18next';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { Package, Wrench, ThumbsUp } from 'lucide-react';
import './About.css';

export function About() {
  const { t } = useTranslation();

  return (
    <>
      {/* Top Bar - Info bar with Hotline, Locations, Login */}
      <TopBar />

      {/* Main Navigation - Sticky McRepair Navigation */}
      <McRepairNav />

      {/* Main Content */}
      <div className="about-page">
        <div className="container">
          <div className="about-content">
            {/* Header */}
            <header className="about-header">
              <h1>{t('aboutPage.header.title')}</h1>
              <div className="accent-line"></div>
              <p className="about-intro">{t('aboutPage.header.intro')}</p>
            </header>

            {/* How it works */}
            <section className="about-section steps-section">
              <h2 className="section-title-center">{t('aboutPage.steps.title')}</h2>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <div className="step-icon">
                    <Package />
                  </div>
                  <h3>{t('aboutPage.steps.step1Title')}</h3>
                  <p>{t('aboutPage.steps.step1Desc')}</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <div className="step-icon">
                    <Package />
                  </div>
                  <h3>{t('aboutPage.steps.step2Title')}</h3>
                  <p>{t('aboutPage.steps.step2Desc')}</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <div className="step-icon">
                    <Wrench />
                  </div>
                  <h3>{t('aboutPage.steps.step3Title')}</h3>
                  <p>{t('aboutPage.steps.step3Desc')}</p>
                </div>
                <div className="step-card">
                  <div className="step-number">4</div>
                  <div className="step-icon">
                    <ThumbsUp />
                  </div>
                  <h3>{t('aboutPage.steps.step4Title')}</h3>
                  <p>{t('aboutPage.steps.step4Desc')}</p>
                </div>
              </div>
            </section>

            {/* What does McRepair do? */}
            <section className="about-section">
              <h2>{t('aboutPage.whatWeDo.title')}</h2>
              <h3 className="subtitle">{t('aboutPage.whatWeDo.subtitle')}</h3>
              <p>{t('aboutPage.whatWeDo.text')}</p>
            </section>

            {/* What sets us apart */}
            <section className="about-section highlight-section">
              <h2>{t('aboutPage.whyUs.title')}</h2>
              <div className="highlight-box">
                <h3>{t('aboutPage.whyUs.highlightTitle')}</h3>
                <p>{t('aboutPage.whyUs.highlightText')}</p>
              </div>
            </section>

            {/* Gallery */}
            <section className="about-section gallery-section">
              <h2 className="section-title-center">{t('aboutPage.gallery.title')}</h2>
              <div className="gallery-collage">
                <div className="gallery-item gallery-large">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_werkstatt.jpg"
                    alt={t('aboutPage.gallery.altWorkshop')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur.jpg"
                    alt={t('aboutPage.gallery.altLaptop')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_laptop_reparatur2.jpg"
                    alt={t('aboutPage.gallery.altLaptop2')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur3.jpg"
                    alt={t('aboutPage.gallery.altPhone3')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur2.jpg"
                    alt={t('aboutPage.gallery.altPhone2')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-medium">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_handy_reparatur.jpg"
                    alt={t('aboutPage.gallery.altPhone')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch.jpg"
                    alt={t('aboutPage.gallery.altBattery')}
                    loading="lazy"
                  />
                </div>
                <div className="gallery-item gallery-small">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/galerie/mcrepair_akkutausch2.jpg"
                    alt={t('aboutPage.gallery.altBattery2')}
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

            {/* Drop-off Locations */}
            <section className="about-section locations-section">
              <div className="locations-content">
                <div className="locations-text">
                  <h2>{t('aboutPage.locations.title')}</h2>
                  <h3 className="subtitle">{t('aboutPage.locations.subtitle')}</h3>
                  <p>{t('aboutPage.locations.text1')}</p>
                  <p>{t('aboutPage.locations.text2')}</p>
                  <p>
                    <strong>{t('aboutPage.locations.text3Bold')}</strong>
                    {t('aboutPage.locations.text3Rest')}
                  </p>
                </div>
                <div className="locations-image">
                  <img
                    src="https://www.mcrepair.de/bilder/ueberuns/deutschland_annahmestellen.jpg"
                    alt={t('aboutPage.locations.mapAlt')}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Manufacturers */}
            <section className="about-section manufacturers-section">
              <h2 className="section-title-center">{t('aboutPage.manufacturers.title')}</h2>
              <p className="manufacturers-intro">{t('aboutPage.manufacturers.intro')}</p>
              <div className="manufacturers-grid">
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Sony</div>
                  <p>{t('aboutPage.manufacturers.sonyRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Google</div>
                  <p>{t('aboutPage.manufacturers.googleRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Apple</div>
                  <p>{t('aboutPage.manufacturers.appleRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Asus</div>
                  <p>{t('aboutPage.manufacturers.asusRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">LG</div>
                  <p>{t('aboutPage.manufacturers.lgRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">OnePlus</div>
                  <p>{t('aboutPage.manufacturers.oneplusRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">Motorola</div>
                  <p>{t('aboutPage.manufacturers.motorolaRepair')}</p>
                </div>
                <div className="manufacturer-card">
                  <div className="manufacturer-name">HTC</div>
                  <p>{t('aboutPage.manufacturers.htcRepair')}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer with McRepair Design */}
      <Footer />
    </>
  );
}
