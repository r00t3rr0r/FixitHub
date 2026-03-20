import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wrench,
  Package,
  BookOpen,
  Phone,
  Search,
  Menu,
  X,
  MapPin,
  User,
  Smartphone,
  Tablet,
  Laptop,
  Gamepad2,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ForceLightMode } from '@/components/ForceLightMode';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CartIcon } from '@/components/CartIcon';
import { NotificationBell } from '@/components/NotificationBell';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { NavbarSearch } from '@/components/NavbarSearch';
import { LoginDialog } from './LoginDialog';
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType,
  DeviceModel
} from '@/api/devices';

interface DeviceMenuData {
  smartphone: { [manufacturer: string]: string[] };
  tablet: { [manufacturer: string]: string[] };
  notebook: { [manufacturer: string]: string[] };
  konsole: { [manufacturer: string]: string[] };
}

export function McRepairNav() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const [deviceMenuData, setDeviceMenuData] = useState<DeviceMenuData>({
    smartphone: {},
    tablet: {},
    notebook: {},
    konsole: {}
  });
  const [loadingDevices, setLoadingDevices] = useState(true);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.pageYOffset > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load device menu data from API
  useEffect(() => {
    const loadDeviceMenuData = async () => {
      try {
        setLoadingDevices(true);
        const response = await getDeviceTypes();
        const deviceTypes = (response as any).deviceTypes || [];

        const menuData: DeviceMenuData = {
          smartphone: {},
          tablet: {},
          notebook: {},
          konsole: {}
        };

        // Map device type names to menu categories
        const categoryMap: { [key: string]: keyof DeviceMenuData } = {
          'smartphone': 'smartphone',
          'tablet': 'tablet',
          'notebook': 'notebook',
          'laptop': 'notebook',
          'konsole': 'konsole',
          'console': 'konsole',
          'gaming console': 'konsole'
        };

        // Load manufacturers and models for each device type
        for (const deviceType of deviceTypes) {
          const category = categoryMap[deviceType.name.toLowerCase()];
          if (!category) continue;

          try {
            const manufacturersResponse = await getManufacturersByDeviceType(deviceType._id);
            const manufacturers = (manufacturersResponse as any).manufacturers || [];

            for (const manufacturer of manufacturers) {
              try {
                const modelsResponse = await getModelsByTypeAndManufacturer(
                  deviceType._id,
                  manufacturer._id
                );
                const models = (modelsResponse as any).models || [];

                // Only take first 3 models for the dropdown menu
                const modelNames = models.slice(0, 3).map((m: DeviceModel) => m.name);

                if (modelNames.length > 0) {
                  if (!menuData[category][manufacturer.name]) {
                    menuData[category][manufacturer.name] = [];
                  }
                  menuData[category][manufacturer.name] = modelNames;
                }
              } catch (error) {
                console.error(`Error loading models for ${manufacturer.name}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error loading manufacturers for ${deviceType.name}:`, error);
          }
        }

        setDeviceMenuData(menuData);
      } catch (error) {
        console.error('Error loading device menu data:', error);
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDeviceMenuData();
  }, []);

  // Load device menu data from API
  useEffect(() => {
    const loadDeviceMenuData = async () => {
      try {
        setLoadingDevices(true);
        const response = await getDeviceTypes();
        const deviceTypes = (response as any).deviceTypes || [];

        const menuData: DeviceMenuData = {
          smartphone: {},
          tablet: {},
          notebook: {},
          konsole: {}
        };

        // Map device type names to menu categories
        const categoryMap: { [key: string]: keyof DeviceMenuData } = {
          'smartphone': 'smartphone',
          'tablet': 'tablet',
          'notebook': 'notebook',
          'laptop': 'notebook',
          'konsole': 'konsole',
          'console': 'konsole',
          'gaming console': 'konsole'
        };

        // Load manufacturers and models for each device type
        for (const deviceType of deviceTypes) {
          const category = categoryMap[deviceType.name.toLowerCase()];
          if (!category) continue;

          try {
            const manufacturersResponse = await getManufacturersByDeviceType(deviceType._id);
            const manufacturers = (manufacturersResponse as any).manufacturers || [];

            for (const manufacturer of manufacturers) {
              try {
                const modelsResponse = await getModelsByTypeAndManufacturer(
                  deviceType._id,
                  manufacturer._id
                );
                const models = (modelsResponse as any).models || [];

                // Only take first 3 models for the dropdown menu
                const modelNames = models.slice(0, 3).map((m: DeviceModel) => m.name);

                if (modelNames.length > 0) {
                  if (!menuData[category][manufacturer.name]) {
                    menuData[category][manufacturer.name] = [];
                  }
                  menuData[category][manufacturer.name] = modelNames;
                }
              } catch (error) {
                console.error(`Error loading models for ${manufacturer.name}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error loading manufacturers for ${deviceType.name}:`, error);
          }
        }

        setDeviceMenuData(menuData);
      } catch (error) {
        console.error('Error loading device menu data:', error);
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDeviceMenuData();
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
    }

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  const handleMouseEnter = (menuName: string) => {
    // Clear any pending close timer
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveDropdown(menuName);
  };

  const handleMouseLeave = () => {
    // Add a small delay before closing to allow mouse to move to dropdown
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150); // 150ms delay
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleDeviceClick = (category: string, manufacturer: string, model: string) => {
    // Store device selection info in sessionStorage for RepairOrderConfigurator to pick up
    const deviceInfo = {
      searchQuery: `${manufacturer} ${model}`,
      deviceType: category,
      manufacturer: manufacturer,
      modelName: model
    };
    
    sessionStorage.setItem('navDeviceSelection', JSON.stringify(deviceInfo));
    setActiveDropdown(null);
    setMobileMenuOpen(false);

    // Dispatch custom event to notify RepairOrderConfigurator
    window.dispatchEvent(new CustomEvent('navDeviceSelected'));

    // If already on homepage, scroll to configurator; otherwise navigate to homepage
    if (location.pathname === '/') {
      // Small delay to ensure sessionStorage is set and event is processed
      setTimeout(() => {
        const configurator = document.getElementById('repair-order-configurator');
        if (configurator) {
          configurator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // Navigate to homepage - RepairOrderConfigurator will pick up the selection
      navigate('/');
    }
  };

  const handleShowAllModels = (category: string, manufacturer: string) => {
    // Store device selection info with showAllModels flag
    const deviceInfo = {
      deviceType: category,
      manufacturer: manufacturer,
      showAllModels: true
    };
    
    sessionStorage.setItem('navDeviceSelection', JSON.stringify(deviceInfo));
    setActiveDropdown(null);
    setMobileMenuOpen(false);

    // Dispatch custom event to notify RepairOrderConfigurator
    window.dispatchEvent(new CustomEvent('navDeviceSelected'));

    // If already on homepage, scroll to configurator; otherwise navigate to homepage
    if (location.pathname === '/') {
      setTimeout(() => {
        const configurator = document.getElementById('repair-order-configurator');
        if (configurator) {
          configurator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      navigate('/');
    }
  };

  const handleBookRepairClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);

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

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLoginDialog(true);
  };

  const renderDeviceDropdown = (category: keyof DeviceMenuData) => {
    const manufacturers = Object.entries(deviceMenuData[category]);

    if (loadingDevices) {
      return (
        <div 
          className="nav-dropdown-menu"
          onMouseEnter={() => {
            // Clear close timer when mouse enters dropdown
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="nav-dropdown-inner">
            <div className="text-center py-4 text-muted-foreground">
              Lade Geräte...
            </div>
          </div>
        </div>
      );
    }

    if (manufacturers.length === 0) {
      return (
        <div 
          className="nav-dropdown-menu"
          onMouseEnter={() => {
            // Clear close timer when mouse enters dropdown
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="nav-dropdown-inner">
            <div className="text-center py-4 text-muted-foreground">
              Keine Geräte verfügbar
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        className="nav-dropdown-menu"
        onMouseEnter={() => {
          // Clear close timer when mouse enters dropdown
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
        }}
        onMouseLeave={handleMouseLeave}
      >
        <div className="nav-dropdown-inner">
          {manufacturers.map(([manufacturer, models]) => (
            <div key={manufacturer} className="nav-dropdown-column">
              <div className="nav-dropdown-header">{manufacturer}</div>
              <ul className="nav-dropdown-list">
                {models.map((model) => (
                  <li key={model}>
                    <Link 
                      to="/"
                      onClick={() => handleDeviceClick(category, manufacturer, model)}
                    >
                      {model}
                    </Link>
                  </li>
                ))}
                <li className="nav-dropdown-all-models">
                  <Link 
                    to="/"
                    onClick={() => handleShowAllModels(category, manufacturer)}
                  >
                    {t('home.nav.allModels', 'Alle Modelle')} →
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
    <ForceLightMode />
    <nav className={`main-nav ${scrolled ? 'scrolled' : ''}`} id="mainNav">
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <div className="nav-logo-text">
            Mc<span>Repair</span>.de
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`} id="navLinks">
          {/* Smartphone */}
          <div 
            className="nav-item-with-dropdown"
            onMouseEnter={() => handleMouseEnter('smartphone')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#smartphone" className="nav-link">
              <Smartphone width={16} height={16} />
              {t('home.nav.smartphone', 'Smartphone')}
            </a>
            {activeDropdown === 'smartphone' && renderDeviceDropdown('smartphone')}
          </div>

          {/* Tablet */}
          <div 
            className="nav-item-with-dropdown"
            onMouseEnter={() => handleMouseEnter('tablet')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#tablet" className="nav-link">
              <Tablet width={16} height={16} />
              {t('home.nav.tablet', 'Tablet')}
            </a>
            {activeDropdown === 'tablet' && renderDeviceDropdown('tablet')}
          </div>

          {/* Notebook */}
          <div 
            className="nav-item-with-dropdown"
            onMouseEnter={() => handleMouseEnter('notebook')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#notebook" className="nav-link">
              <Laptop width={16} height={16} />
              {t('home.nav.notebook', 'Notebook')}
            </a>
            {activeDropdown === 'notebook' && renderDeviceDropdown('notebook')}
          </div>

          {/* Konsole */}
          <div 
            className="nav-item-with-dropdown"
            onMouseEnter={() => handleMouseEnter('konsole')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#konsole" className="nav-link">
              <Gamepad2 width={16} height={16} />
              {t('home.nav.konsole', 'Konsole')}
            </a>
            {activeDropdown === 'konsole' && renderDeviceDropdown('konsole')}
          </div>

          {/* Shop */}
          <a href="#shop" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
            <ShoppingBag width={16} height={16} />
            {t('home.nav.shop', 'Shop')}
          </a>

          {/* Mobile Extras (only shown in mobile menu) */}
          <div className="nav-mobile-extras">
            <a href="tel:+4917012345678">
              <Phone width={16} height={16} />
              {t('home.topBar.hotline', '0170 123 4567')}
            </a>
            <a href="/src/McRepair-Design-System/annahmestellen.html">
              <MapPin width={16} height={16} />
              {t('home.topBar.locations', 'Annahmestellen')}
            </a>
            {!isAuthenticated && (
              <button 
                ref={loginButtonRef}
                onClick={handleLoginClick}
              >
                <User width={16} height={16} />
                {t('home.topBar.login', 'Anmelden')}
              </button>
            )}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="nav-right">
          {/* Desktop Search - Using NavbarSearch Component */}
          <div className="nav-search hidden lg:block">
            <NavbarSearch />
          </div>

          {/* Mobile Search Toggle */}
          <button
            className={`nav-search-toggle lg:hidden ${searchOpen ? 'active' : ''}`}
            onClick={toggleSearch}
            aria-label="Toggle search"
          >
            <Search width={18} height={18} />
          </button>

          {/* Language Selector */}
          <LanguageSelector />

          {/* Cart */}
          <CartIcon />

          {/* Notifications (if authenticated) */}
          {isAuthenticated && <NotificationBell />}

          {/* CTA Button or Profile */}
          {isAuthenticated ? (
            <ProfileDropdown />
          ) : (
            <a href="#" onClick={handleBookRepairClick} className="nav-cta">
              <Wrench width={16} height={16} />
              <span>{t('home.nav.bookRepair', 'Reparatur buchen')}</span>
            </a>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="nav-mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X width={24} height={24} />
            ) : (
              <Menu width={24} height={24} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      <div className={`nav-search-overlay ${searchOpen ? 'open' : ''}`}>
        <div className="container mx-auto px-4 py-4">
          <NavbarSearch />
        </div>
      </div>

      {/* Login Dialog */}
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
    </nav>
    </>
  );
}
