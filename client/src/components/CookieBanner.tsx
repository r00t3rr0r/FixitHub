import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie } from 'lucide-react';

export function CookieBanner() {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consentData = localStorage.getItem('mcrepair-cookie-consent');
    if (!consentData) {
      // Show banner after 800ms delay
      setTimeout(() => {
        setShowBanner(true);
      }, 800);
    } else {
      // Show FAB if consent already given
      setShowFab(true);
      
      // Load preferences
      try {
        const preferences = JSON.parse(consentData);
        setFunctional(preferences.functional || false);
        setAnalytics(preferences.analytics || false);
        setMarketing(preferences.marketing || false);
      } catch (error) {
        console.error('Error parsing cookie preferences:', error);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const preferences = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    
    localStorage.setItem('mcrepair-cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('mcrepair-cookie-consent-date', new Date().toISOString());
    
    setShowBanner(false);
    setTimeout(() => setShowFab(true), 400);
  };

  const handleSavePreferences = () => {
    const preferences = {
      necessary: true,
      functional,
      analytics,
      marketing
    };
    
    localStorage.setItem('mcrepair-cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('mcrepair-cookie-consent-date', new Date().toISOString());
    
    setShowBanner(false);
    setTimeout(() => setShowFab(true), 400);
  };

  const handleRejectAll = () => {
    const preferences = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    
    localStorage.setItem('mcrepair-cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('mcrepair-cookie-consent-date', new Date().toISOString());
    
    setShowBanner(false);
    setTimeout(() => setShowFab(true), 400);
  };

  const handleReopenSettings = () => {
    setShowFab(false);
    setShowBanner(true);
  };

  return (
    <>
      {/* Cookie Banner */}
      <div className={`cookie-banner ${showBanner ? 'visible' : ''}`}>
        <div className="cookie-banner-backdrop" onClick={() => setShowBanner(false)}></div>
        
        <div className="cookie-banner-dialog">
          {/* Header */}
          <div className="cookie-banner-header">
            <div className="cookie-banner-icon">
              <Cookie width={24} height={24} />
            </div>
            <div>
              <h3>{t('cookies.title', 'Cookie-Einstellungen')}</h3>
              <p className="cookie-banner-subtitle">
                {t('cookies.subtitle', 'Wir schätzen Ihre Privatsphäre')}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="cookie-banner-text">
            {t('cookies.description', 'Wir verwenden Cookies, um Ihre Erfahrung auf unserer Website zu verbessern. Wählen Sie, welche Cookies Sie akzeptieren möchten.')}
          </p>

          {/* Cookie Options */}
          <div className="cookie-options">
            {/* Necessary (always on) */}
            <label className="cookie-option">
              <input
                type="checkbox"
                checked={true}
                disabled
              />
              <div className="cookie-option-info">
                <span className="cookie-option-name">
                  {t('cookies.necessary', 'Notwendig')}
                </span>
                <span className="cookie-option-desc">
                  {t('cookies.necessaryDesc', 'Für Grundfunktionen erforderlich')}
                </span>
              </div>
              <span className="cookie-option-badge required">
                {t('cookies.required', 'Erforderlich')}
              </span>
            </label>

            {/* Functional */}
            <label className="cookie-option">
              <input
                type="checkbox"
                id="cookie-functional"
                checked={functional}
                onChange={(e) => setFunctional(e.target.checked)}
              />
              <div className="cookie-option-info">
                <span className="cookie-option-name">
                  {t('cookies.functional', 'Funktional')}
                </span>
                <span className="cookie-option-desc">
                  {t('cookies.functionalDesc', 'Erweiterte Funktionen')}
                </span>
              </div>
            </label>

            {/* Analytics */}
            <label className="cookie-option">
              <input
                type="checkbox"
                id="cookie-analytics"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              <div className="cookie-option-info">
                <span className="cookie-option-name">
                  {t('cookies.analytics', 'Analytik')}
                </span>
                <span className="cookie-option-desc">
                  {t('cookies.analyticsDesc', 'Website-Nutzung analysieren')}
                </span>
              </div>
            </label>

            {/* Marketing */}
            <label className="cookie-option">
              <input
                type="checkbox"
                id="cookie-marketing"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              <div className="cookie-option-info">
                <span className="cookie-option-name">
                  {t('cookies.marketing', 'Marketing')}
                </span>
                <span className="cookie-option-desc">
                  {t('cookies.marketingDesc', 'Personalisierte Werbung')}
                </span>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="cookie-banner-actions">
            <button
              className="cookie-btn-accept"
              onClick={handleAcceptAll}
            >
              {t('cookies.acceptAll', 'Alle akzeptieren')}
            </button>
            <button
              className="cookie-btn-save"
              onClick={handleSavePreferences}
            >
              {t('cookies.saveSelection', 'Auswahl speichern')}
            </button>
          </div>

          <button
            className="cookie-btn-reject"
            onClick={handleRejectAll}
          >
            {t('cookies.onlyNecessary', 'Nur notwendige')}
          </button>

          {/* Footer Links */}
          <div className="cookie-banner-footer">
            <a href="/privacy">
              {t('cookies.privacyPolicy', 'Datenschutzerklärung')}
            </a>
            <a href="/imprint">
              {t('cookies.imprint', 'Impressum')}
            </a>
          </div>
        </div>
      </div>

      {/* Cookie FAB (floating action button) */}
      <button
        className={`cookie-fab ${showFab ? 'visible' : ''}`}
        onClick={handleReopenSettings}
        aria-label={t('cookies.settings', 'Cookie-Einstellungen')}
      >
        <Cookie width={22} height={22} />
      </button>
    </>
  );
}
