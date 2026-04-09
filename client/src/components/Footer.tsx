import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-brand">
            <h3>
              Mc<span>Repair</span>.de
            </h3>
            <div className="footer-hotline" aria-label={t('home.footer.hotlineAriaLabel', 'Service-Hotline und Erreichbarkeit')}>
              <p className="footer-hotline-title">{t('home.footer.hotlineTitle', 'Service Hotline')}</p>
              <p className="footer-hotline-hours">{t('home.footer.hotlineHours', 'Mo.- Fr. 10.00 - 12:00 Uhr und 14:00 - 16:00 Uhr')}</p>
              <a className="footer-hotline-phone" href="tel:+4930403688951">
                {t('home.footer.hotlinePhone', 'Tel: 030 403 688 951')}
              </a>
            </div>
            
            {/* Social Media Icons */}
            <div className="footer-social">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <Facebook width={16} height={16} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Twitter width={16} height={16} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <Instagram width={16} height={16} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <Linkedin width={16} height={16} />
              </a>
            </div>
          </div>

          {/* Repair Services Column */}
          <div className="footer-col">
            <h4>{t('home.footer.repairTitle', 'Shop Service')}</h4>
            <ul>
              <li>
                <Link to="/faq">
                  {t('home.footer.faq', 'FAQ')}
                </Link>
              </li>
              <li>
                <Link to="/contact">
                  {t('home.footer.contact', 'Kontakt')}
                </Link>
              </li>
              <li>
                <Link to="/partner-werden">
                  {t('home.footer.becomePartner', 'Partner werden')}
                </Link>
              </li>
              <li>
                <Link to="/newsletter">
                  {t('home.footer.newsletter', 'Newsletter')}
                </Link>
              </li>
              <li>
                <Link to="/sitemap">
                  {t('home.footer.sitemap', 'Sitemap')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Informationen Column */}
          <div className="footer-col">
            <h4>{t('home.footer.serviceTitle', 'Informationen')}</h4>
            <ul>
              <li>
                <a href="/widerrufsrecht">
                  {t('home.footer.locations', 'Widerrufsrecht')}
                </a>
              </li>
              <li>
                <Link to="/new-order">
                  {t('home.footer.shippingRepair', 'Versand-Reparatur')}
                </Link>
              </li>
              <li>
                <Link to="/new-order">
                  {t('home.footer.deviceFinder', 'Geräte-Finder')}
                </Link>
              </li>
              <li>
                <Link to="/orders">
                  {t('home.footer.repairStatus', 'Reparatur-Status')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="footer-col">
            <h4>{t('home.footer.companyTitle', 'Unternehmen')}</h4>
            <ul>
              <li>
                <Link to="/about">
                  {t('home.footer.aboutUs', 'Über uns')}
                </Link>
              </li>
              <li>
                <a href="#careers">
                  {t('home.footer.careers', 'Karriere')}
                </a>
              </li>
              <li>
                <Link to="/blog">
                  {t('home.footer.blog', 'Blog')}
                </Link>
              </li>
              <li>
                <a href="#press">
                  {t('home.footer.press', 'Presse')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom - Payment Methods & Copyright */}
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} McRepair.de. {t('home.footer.allRightsReserved', 'Alle Rechte vorbehalten.')}
          </p>
          <div className="footer-bottom-links">
            <Link to="/imprint">{t('home.footer.imprint', 'Impressum')}</Link>
            <Link to="/privacy">{t('home.footer.privacyPolicy', 'Datenschutz')}</Link>
            <Link to="/terms">{t('home.footer.termsOfService', 'AGB')}</Link>
            <Link to="/widerrufsrecht">{t('home.footer.rightOfWithdrawal', 'Widerrufsrecht')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
