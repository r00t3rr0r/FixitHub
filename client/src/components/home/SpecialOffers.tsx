import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function SpecialOffers() {
  const { t } = useTranslation();

  return (
    <section className="section section-alt section-compact" id="offers">
      <div className="container">
        <div className="section-title section-title-sm">
          <h2>{t('home.specialOffers.title')}</h2>
          <div className="accent-line"></div>
        </div>
        <div className="offers-grid">
          {/* Offer 1: MyFirstPhone */}
          <div className="offer-card">
            <div className="offer-card-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
                <path d="M9 9l2 2 4-4"></path>
              </svg>
            </div>
            <div className="offer-card-content">
              <span className="offer-tag">{t('home.specialOffers.tag')}</span>
              <h3>MyFirstPhone</h3>
              <p>{t('home.specialOffers.myFirstPhoneDescription')}</p>
              <Link to="/offers/myfirstphone" className="offer-cta">
                {t('home.specialOffers.learnMore')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Link>
            </div>
          </div>

          {/* Offer 2: McStudent */}
          <div className="offer-card">
            <div className="offer-card-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c0 0 3 3 6 3s6-3 6-3v-5"></path>
              </svg>
            </div>
            <div className="offer-card-content">
              <span className="offer-tag">{t('home.specialOffers.tag')}</span>
              <h3>McStudent</h3>
              <p>{t('home.specialOffers.mcStudentDescription')}</p>
              <Link to="/offers/mcstudent" className="offer-cta">
                {t('home.specialOffers.learnMore')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
