import React, { useState, useRef } from 'react';
import { Phone, MapPin, User, LogOut, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LoginDialog } from './LoginDialog';

export function TopBar() {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const loginButtonRef = useRef<HTMLButtonElement>(null);

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLoginDialog(true);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <div className="top-bar">
        <div className="container">
          <div className="top-bar-left">
            <a href="tel:+4917012345678">
              <Phone width={14} height={14} />
              <span>{t('home.topBar.hotline', '0170 123 4567')}</span>
            </a>
            <a href="/annahmestellen">
              <MapPin width={14} height={14} />
              <span>{t('home.topBar.locations', 'Annahmestellen')}</span>
            </a>
            <a href="/vorabdiagnose" className="top-bar-diagnose-link">
              <ClipboardCheck width={14} height={14} />
              <span>{t('vorabdiagnose.title', 'Vorabdiagnose')}</span>
            </a>
          </div>
          <div className="top-bar-right">
            {isAuthenticated ? (
              <div className="top-bar-user-info">
                <User width={14} height={14} />
                <span className="user-email">{user?.email}</span>
                <button 
                  className="logout-button"
                  onClick={handleLogout}
                  title={t('userMenu.logout', 'Abmelden')}
                >
                  <LogOut width={14} height={14} />
                </button>
              </div>
            ) : (
              <button 
                ref={loginButtonRef}
                className="top-bar-login-button"
                onClick={handleLoginClick}
              >
                <User width={14} height={14} />
                <span>{t('home.topBar.login', 'Anmelden')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showLoginDialog && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 9998
          }} onClick={() => setShowLoginDialog(false)} />
          <LoginDialog 
            isOpen={showLoginDialog} 
            onClose={() => setShowLoginDialog(false)}
            anchorElement={loginButtonRef.current}
          />
        </>
      )}
    </>
  );
}
