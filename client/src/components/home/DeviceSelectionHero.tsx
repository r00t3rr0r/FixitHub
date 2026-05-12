import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [bookingNumber, setBookingNumber] = useState('');
  const [trackEmail, setTrackEmail] = useState('');

  const handleTrackBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumber.trim() && trackEmail.trim()) {
      navigate(`/track-order/booking?bookingNumber=${encodeURIComponent(bookingNumber.trim())}&email=${encodeURIComponent(trackEmail.trim())}`);
    }
  };

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
                <h4>Gerät nicht dabei? Reparatur nicht gefunden?</h4>
                <p style={{ whiteSpace: 'nowrap' }}>Stellen Sie uns eine individuelle Reparaturanfrage über unser Reparaturanfrageformular.</p>
              </Link>
            </div>

            {/* Booking Tracker Bar */}
            <form className="hero-tracking-bar" onSubmit={handleTrackBooking}>
              <div className="hero-tracking-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                type="text"
                className="hero-tracking-input"
                placeholder={t('home.hero.trackingBookingPlaceholder')}
                value={bookingNumber}
                onChange={(e) => setBookingNumber(e.target.value)}
              />
              <input
                type="email"
                className="hero-tracking-input"
                placeholder={t('home.hero.trackingEmailPlaceholder')}
                value={trackEmail}
                onChange={(e) => setTrackEmail(e.target.value)}
              />
              <button type="submit" className="hero-tracking-btn" disabled={!bookingNumber.trim() || !trackEmail.trim()}>
                {t('home.hero.trackingButton')}
              </button>
            </form>
          </div>

          {/* Right Column: Repair Order Configurator with all 5 steps */}
          <RepairOrderConfigurator />
        </div>
      </div>
    </section>
  );
}
