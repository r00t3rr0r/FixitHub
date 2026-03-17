import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function MobileCTAFab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [positionTop, setPositionTop] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      const scrollingDown = currentScroll > lastScroll;

      // Show FAB after scrolling 120px
      if (currentScroll > 120) {
        setVisible(true);
        setPositionTop(!scrollingDown); // Top when scrolling up, bottom when scrolling down
      } else {
        setVisible(false);
      }

      setLastScroll(currentScroll);
    };

    // Use requestAnimationFrame for smooth performance
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScroll]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If already on homepage, scroll to configurator; otherwise navigate to homepage
    if (location.pathname === '/') {
      const configurator = document.getElementById('repair-order-configurator');
      if (configurator) {
        configurator.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate('/');
      // After navigation, scroll to configurator
      setTimeout(() => {
        const configurator = document.getElementById('repair-order-configurator');
        if (configurator) {
          configurator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={`mobile-cta-fab ${visible ? 'visible' : ''} ${
        positionTop ? 'position-top' : 'position-bottom'
      }`}
    >
      <Wrench width={16} height={16} />
      <span>{t('home.nav.bookRepair', 'Reparatur buchen')}</span>
    </a>
  );
}
