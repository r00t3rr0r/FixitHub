import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RepairOrderConfigurator } from './RepairOrderConfigurator';

interface DeviceSelectionHeroProps {
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
}

export function DeviceSelectionHero({
  backgroundImage = 'https://www.mcrepair.de/bilder/home/banner/home_banner.jpg',
  title,
  subtitle
}: DeviceSelectionHeroProps) {
  const { t } = useTranslation();

  return (
    <section className="hero" id="hero">
      {/* Background gradient overlay */}
      <div className="hero-bg"></div>
      
      {/* Decorative circles */}
      <div className="hero-decoration hero-decoration-1"></div>
      <div className="hero-decoration hero-decoration-2"></div>
      
      {/* Hero woman decorative image */}
      <div className="hero-woman">
        <img src="/images/hero-woman-noBG.png" alt={t('home.hero.imageAlt')} loading="eager" />
      </div>

      <div className="hero-content container">
        <div className="hero-layout">
          {/* Left Column: Hero Text */}
          <div className="hero-text">
            {/* Badge */}
            <div className="hero-badge">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              {t('home.hero.badge')}
            </div>

            {/* Main Headline */}
            <h1 className="hero-title">
              {title || t('home.hero.titleLine1')}
              <br />
              <span>{subtitle || t('home.hero.titleLine2')}</span>
            </h1>

            {/* Secondary Helper Cards */}
            <div className="hero-helpers">
              <div className="hero-helper-card">
                <h4>{t('home.hero.helperDeviceTitle')}</h4>
                <p>{t('home.hero.helperDeviceDesc')}</p>
              </div>
              <a href="/vorabdiagnose" className="hero-helper-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <h4>{t('home.hero.helperRepairTitle')}</h4>
                <p>{t('home.hero.helperRepairDesc')}</p>
              </a>
            </div>

            <div className="hero-helpers" style={{ justifyContent: 'center', marginTop: '10px' }}>
              <Link
                to="/repair-request"
                className="hero-helper-card"
                style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 100%', width: '100%' }}
              >
                <h4>Individuelle Smartphone Reparatur anfragen</h4>
                <p style={{ whiteSpace: 'nowrap' }}>Gerät nicht gefunden? Senden Sie uns eine Reparaturanfrage – wir helfen Ihnen weiter.</p>
              </Link>
            </div>

          </div>

          {/* Right Column: Repair Order Configurator with all 5 steps */}
          <RepairOrderConfigurator />
        </div>
      </div>
    </section>
  );
}
