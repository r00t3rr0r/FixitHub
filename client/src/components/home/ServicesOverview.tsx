import { useTranslation } from 'react-i18next';

export function ServicesOverview() {
  const { t } = useTranslation();

  return (
    <div className="container">
      <div className="section-title">
        <h2>So einfach geht's</h2>
        <p>In 4 Schritten zum reparierten Gerät</p>
        <div className="accent-line"></div>
      </div>
      <div className="steps-grid">
        <div className="step-card">
          <div className="step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
              <path d="M9 8h6M9 12h4"></path>
            </svg>
          </div>
          <span className="step-number">1</span>
          <h4>Reparatur buchen</h4>
          <p>Gerät & Reparatur online wählen</p>
        </div>
        <div className="step-card">
          <div className="step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="M4 15h9"></path>
              <polyline points="10 12 13 15 10 18"></polyline>
            </svg>
          </div>
          <span className="step-number">2</span>
          <h4>Label erhalten</h4>
          <p>Versandlabel kostenlos per E-Mail</p>
        </div>
        <div className="step-card">
          <div className="step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <span className="step-number">3</span>
          <h4>Einsenden</h4>
          <p>Gerät sicher verpacken & absenden</p>
        </div>
        <div className="step-card">
          <div className="step-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <span className="step-number">4</span>
          <h4>Repariert zurück</h4>
          <p>Gerät repariert & versichert erhalten</p>
        </div>
      </div>
    </div>
  );
}
