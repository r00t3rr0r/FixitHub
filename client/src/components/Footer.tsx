import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="py-12 border-t bg-gray-900 text-white relative">
      {/* Yellow gradient accent line above footer */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png"
                alt="FixitHub Logo"
                className="h-10 w-auto object-contain brightness-0 invert"
                onError={(e) => {
                  // Fallback to text logo
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-10 h-10 bg-yellow-400 rounded-lg items-center justify-center hidden">
                <span className="text-gray-900 font-bold text-sm">FH</span>
              </div>
              <span className="text-xl font-bold">FixitHub</span>
            </div>
            <p className="text-gray-400 text-sm">
              {t('home.footer.tagline')}
            </p>
          </div>

          {/* Services Column */}
          <div>
            <h3 className="font-semibold mb-4 text-white">{t('home.footer.servicesTitle')}</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.services.screenRepair')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.services.batteryReplacement')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.services.waterDamage')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.services.dataRecovery')}
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-semibold mb-4 text-white">{t('home.footer.companyTitle')}</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.aboutUs')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.contact')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.careers')}
                </a>
              </li>
              <li>
                <Link to="/blog" className="hover:text-white transition-colors duration-200">
                  {t('navigation.blog')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="font-semibold mb-4 text-white">{t('home.footer.supportTitle')}</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.helpCenter')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.warranty')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.privacyPolicy')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors duration-200">
                  {t('home.footer.termsOfService')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          <p>{t('home.footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
