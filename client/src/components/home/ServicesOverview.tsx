import { useTranslation } from 'react-i18next';

const stepNumberStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  fontWeight: 800,
  fontSize: '1.1rem',
  color: 'var(--primary-blue)',
  margin: '10px 0 8px',
  borderRadius: 0,
  background: 'none',
  width: '100%',
  height: 'auto',
  position: 'static',
  lineHeight: 1,
};

export function ServicesOverview() {
  const { t } = useTranslation();

  return (
    <div className="container">
      <div className="section-title">
        <h2>{t('home.servicesOverview.title')}</h2>
        <p>{t('home.servicesOverview.subtitle')}</p>
        <div className="accent-line"></div>
      </div>
      <div className="steps-grid">
        <div className="step-card">
          <div className="step-icon-image">
            <img src="/assets/steps/schritt1.png" alt="Step 1" />
          </div>
          <span style={stepNumberStyle}>1</span>
          <h4>{t('home.servicesOverview.step1Title')}</h4>
          <p>{t('home.servicesOverview.step1Description')}</p>
        </div>
        <div className="step-card">
          <div className="step-icon-image">
            <img src="/assets/steps/schritt2.png" alt="Step 2" />
          </div>
          <span style={stepNumberStyle}>2</span>
          <h4>{t('home.servicesOverview.step2Title')}</h4>
          <p>{t('home.servicesOverview.step2Description')}</p>
        </div>
        <div className="step-card">
          <div className="step-icon-image">
            <img src="/assets/steps/schritt3.png" alt="Step 3" />
          </div>
          <span style={stepNumberStyle}>3</span>
          <h4>{t('home.servicesOverview.step3Title')}</h4>
          <p>{t('home.servicesOverview.step3Description')}</p>
        </div>
        <div className="step-card">
          <div className="step-icon-image">
            <img src="/assets/steps/schritt4.png" alt="Step 4" />
          </div>
          <span style={stepNumberStyle}>4</span>
          <h4>{t('home.servicesOverview.step4Title')}</h4>
          <p>{t('home.servicesOverview.step4Description')}</p>
        </div>
      </div>
    </div>
  );
}
