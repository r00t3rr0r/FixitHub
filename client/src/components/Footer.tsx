import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t bg-gray-900 text-white relative">
      {/* Yellow gradient accent line above footer */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>

      <div className="container mx-auto px-4">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-8">
          {/* Brand Column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <img
                src="https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png"
                alt="FixitHub Logo"
                className="h-7 w-auto object-contain brightness-0 invert"
                onError={(e) => {
                  // Fallback to text logo
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-7 h-7 bg-yellow-400 rounded-lg items-center justify-center hidden flex-shrink-0">
                <span className="text-gray-900 font-bold text-xs leading-none">FH</span>
              </div>
              <span className="text-base font-bold leading-none">FixitHub</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              {t('home.footer.tagline')}
            </p>
          </div>

          {/* Services Column */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-sm leading-tight uppercase tracking-wide">
              {t('home.footer.servicesTitle')}
            </h3>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.services.screenRepair')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.services.batteryReplacement')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.services.waterDamage')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.services.dataRecovery')}
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-sm leading-tight uppercase tracking-wide">
              {t('home.footer.companyTitle')}
            </h3>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.aboutUs')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.contact')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.careers')}
                </a>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('navigation.blog')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-sm leading-tight uppercase tracking-wide">
              {t('home.footer.supportTitle')}
            </h3>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.helpCenter')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.warranty')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.privacyPolicy')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 text-xs hover:text-yellow-400 transition-colors duration-200"
                >
                  {t('home.footer.termsOfService')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="py-4 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-xs leading-relaxed">
            {t('home.footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
