import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BookOpen,
  Mail,
  Phone,
  Search,
  Menu,
  X,
  MapPin,
  User,
  LogOut,
  ChevronDown,
  Smartphone,
  Tablet,
  Laptop,
  Gamepad2,
  ShoppingBag,
  Calendar,
  FileText,
  MessageSquare,
  Wrench,
  AlertTriangle
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
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const [navMode, setNavMode] = useState<'full' | 'partial' | 'compact'>('full');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState<keyof DeviceMenuData | null>(null);
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
  const mobileMenuCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollLockTopRef = useRef(0);
  const navInnerRef = useRef<HTMLDivElement | null>(null);
  const navLogoRef = useRef<HTMLAnchorElement | null>(null);
  const navLinksRef = useRef<HTMLDivElement | null>(null);
  const navRightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.pageYOffset > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Switch into compact nav mode when there is not enough horizontal space.
  useEffect(() => {
    const updateCompactMode = () => {
      const viewportWidth = window.innerWidth;

      // Deterministic hysteresis zones avoid visual flip-flops while resizing.
      const enterCompactViewport = 930;
      const leaveCompactViewport = 1020;
      const leavePartialToFullViewport = 1380;
      const leaveFullToPartialViewport = 1280;

      // Three-level behavior:
      // full: all links visible
      // partial: key links visible, remaining links available in dropdown
      // compact: full dropdown
      setNavMode((prev) => {
        if (prev === 'compact') {
          if (viewportWidth >= leaveCompactViewport) {
            return 'partial';
          }
          return 'compact';
        }

        if (prev === 'partial') {
          if (viewportWidth <= enterCompactViewport) {
            return 'compact';
          }
          if (viewportWidth >= leavePartialToFullViewport) {
            return 'full';
          }
          return 'partial';
        }

        if (viewportWidth <= leaveFullToPartialViewport) {
          if (viewportWidth <= enterCompactViewport) {
            return 'compact';
          }
          return 'partial';
        }

        return 'full';
      });
    };

    let rafId: number | null = null;

    const scheduleCompactModeUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        updateCompactMode();
        rafId = null;
      });
    };

    scheduleCompactModeUpdate();

    window.addEventListener('resize', scheduleCompactModeUpdate);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', scheduleCompactModeUpdate);
    };
  }, []);

  useEffect(() => {
    if (navMode === 'full') {
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
      setMobileCategoryOpen(null);
      setSearchOpen(false);
    }
  }, [navMode]);

  const isDropdownNav = navMode !== 'full';
  const isCompactNav = navMode === 'compact';

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

  const closeMobileMenu = (onClosed?: () => void) => {
    if (!mobileMenuOpen) {
      if (onClosed) onClosed();
      return;
    }
    setMobileMenuClosing(true);
    if (mobileMenuCloseTimerRef.current) {
      clearTimeout(mobileMenuCloseTimerRef.current);
    }
    mobileMenuCloseTimerRef.current = setTimeout(() => {
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
      setMobileCategoryOpen(null);
      if (onClosed) onClosed();
      mobileMenuCloseTimerRef.current = null;
    }, 180);
  };

  const toggleMobileMenu = () => {
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }
    setMobileMenuClosing(false);
    setMobileMenuOpen(true);
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
  };

  // Prevent background scroll when mobile menu is open/closing (mobile-safe, incl. iOS)
  useEffect(() => {
    if (mobileMenuOpen || mobileMenuClosing) {
      scrollLockTopRef.current = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollLockTopRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.classList.add('mobile-menu-open');
    } else {
      const top = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
      if (top) {
        const restoredY = Math.abs(parseInt(top, 10)) || scrollLockTopRef.current;
        window.scrollTo(0, restoredY);
      }
      setMobileCategoryOpen(null);
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen, mobileMenuClosing]);

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
      if (mobileMenuCloseTimerRef.current) {
        clearTimeout(mobileMenuCloseTimerRef.current);
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
    closeMobileMenu();

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
    closeMobileMenu();

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

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileMenu(() => setShowLoginDialog(true));
  };

  const handleMobileSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMobileMenu(() => setSearchOpen(true));
  };

  const handleMobileLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMobileMenu(() => {
      logout();
      navigate('/');
    });
  };

  const handleCategoryClick = (e: React.MouseEvent, category: keyof DeviceMenuData) => {
    if (isDropdownNav || mobileMenuOpen) {
      e.preventDefault();
      setMobileCategoryOpen((prev) => (prev === category ? null : category));
    }
  };

  const renderMobileDeviceDropdown = (category: keyof DeviceMenuData) => {
    const manufacturers = Object.entries(deviceMenuData[category]);

    if (loadingDevices) {
      return <div className="nav-mobile-dropdown-empty">{t('home.nav.loadingDevices')}</div>;
    }

    if (manufacturers.length === 0) {
      return <div className="nav-mobile-dropdown-empty">{t('home.nav.noDevices')}</div>;
    }

    return (
      <div className="nav-mobile-dropdown">
        {manufacturers.map(([manufacturer, models]) => (
          <div key={manufacturer} className="nav-mobile-dropdown-group">
            <div className="nav-mobile-dropdown-title">{manufacturer}</div>
            {models.map((model) => (
              <Link
                key={model}
                to="/"
                className="nav-mobile-dropdown-link"
                onClick={() => handleDeviceClick(category, manufacturer, model)}
              >
                {model}
              </Link>
            ))}
            <Link
              to="/"
              className="nav-mobile-dropdown-link nav-mobile-dropdown-link-all"
              onClick={() => handleShowAllModels(category, manufacturer)}
            >
              {t('home.nav.allModels', 'Alle Modelle')} →
            </Link>
          </div>
        ))}
      </div>
    );
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
              {t('home.nav.loadingDevices')}
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
              {t('home.nav.noDevices')}
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
    <nav className={`main-nav ${scrolled ? 'scrolled' : ''} ${isDropdownNav ? 'dropdown-nav' : ''} ${isCompactNav ? 'compact-nav' : ''} ${navMode === 'partial' ? 'partial-nav' : ''}`} id="mainNav">
      <div className="nav-inner" ref={navInnerRef}>
        {/* Logo */}
        <Link to="/" className="nav-logo" ref={navLogoRef}>
          <div className="nav-logo-text">
            Mc<span>Repair</span>.de
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div
          className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''} ${mobileMenuClosing ? 'mobile-closing' : ''}`}
          id="navLinks"
          ref={navLinksRef}
        >
          {mobileMenuOpen && (
            <div className="nav-mobile-user-priority">
              <div className="nav-mobile-section-title">
                {isAuthenticated ? t('navigation.accountArea', 'Mein Bereich') : t('navigation.accountAccess', 'Konto')}
              </div>
              {isAuthenticated ? (
                <>
                  <Link to="/bookings" onClick={() => closeMobileMenu()}>
                    <Calendar width={16} height={16} />
                    {t('navigation.bookings', 'Buchungen')}
                  </Link>
                  <Link to="/my-repair-requests" onClick={() => closeMobileMenu()}>
                    <Wrench width={16} height={16} />
                    {t('home.nav.repairRequests')}
                  </Link>
                  <Link to="/my-complaints" onClick={() => closeMobileMenu()}>
                    <AlertTriangle width={16} height={16} />
                    {t('home.nav.complaints')}
                  </Link>
                  <Link to="/invoices" onClick={() => closeMobileMenu()}>
                    <FileText width={16} height={16} />
                    {t('navigation.invoices', 'Rechnungen')}
                  </Link>
                  <Link to="/notifications" onClick={() => closeMobileMenu()}>
                    <Bell width={16} height={16} />
                    {t('navigation.notifications', 'Benachrichtigungen')}
                  </Link>
                  <Link to="/messages" onClick={() => closeMobileMenu()}>
                    <MessageSquare width={16} height={16} />
                    {t('navigation.messages', 'Nachrichten')}
                  </Link>
                  <Link to="/profile" onClick={() => closeMobileMenu()}>
                    <User width={16} height={16} />
                    {t('navigation.profile', 'Profil')}
                  </Link>
                  <button className="nav-mobile-logout" onClick={handleMobileLogout}>
                    <LogOut width={16} height={16} />
                    {t('navigation.logout', 'Abmelden')}
                  </button>
                </>
              ) : (
                <button
                  ref={loginButtonRef}
                  onClick={handleLoginClick}
                >
                  <User width={16} height={16} />
                  {t('home.topBar.login', 'Anmelden')}
                </button>
              )}
            </div>
          )}

          {mobileMenuOpen && (
            <div className="nav-mobile-section-title nav-mobile-section-title-spaced">
              {t('home.nav.repairCategories')}
            </div>
          )}

          {/* Smartphone */}
          <div 
            className="nav-item-with-dropdown nav-category-item nav-priority-link"
            onMouseEnter={() => handleMouseEnter('smartphone')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#smartphone" className="nav-link" onClick={(e) => handleCategoryClick(e, 'smartphone')}>
              <Smartphone width={16} height={16} />
              {t('home.nav.smartphone', 'Smartphone')}
              {mobileMenuOpen && (
                <ChevronDown
                  width={16}
                  height={16}
                  className={`nav-mobile-caret ${mobileCategoryOpen === 'smartphone' ? 'open' : ''}`}
                />
              )}
            </a>
            {activeDropdown === 'smartphone' && renderDeviceDropdown('smartphone')}
            {mobileMenuOpen && mobileCategoryOpen === 'smartphone' && renderMobileDeviceDropdown('smartphone')}
          </div>

          {/* Tablet */}
          <div 
            className="nav-item-with-dropdown nav-category-item nav-priority-link"
            onMouseEnter={() => handleMouseEnter('tablet')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#tablet" className="nav-link" onClick={(e) => handleCategoryClick(e, 'tablet')}>
              <Tablet width={16} height={16} />
              {t('home.nav.tablet', 'Tablet')}
              {mobileMenuOpen && (
                <ChevronDown
                  width={16}
                  height={16}
                  className={`nav-mobile-caret ${mobileCategoryOpen === 'tablet' ? 'open' : ''}`}
                />
              )}
            </a>
            {activeDropdown === 'tablet' && renderDeviceDropdown('tablet')}
            {mobileMenuOpen && mobileCategoryOpen === 'tablet' && renderMobileDeviceDropdown('tablet')}
          </div>

          {/* Notebook */}
          <div 
            className="nav-item-with-dropdown nav-category-item nav-partial-hidden"
            onMouseEnter={() => handleMouseEnter('notebook')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#notebook" className="nav-link" onClick={(e) => handleCategoryClick(e, 'notebook')}>
              <Laptop width={16} height={16} />
              {t('home.nav.notebook', 'Notebook')}
              {mobileMenuOpen && (
                <ChevronDown
                  width={16}
                  height={16}
                  className={`nav-mobile-caret ${mobileCategoryOpen === 'notebook' ? 'open' : ''}`}
                />
              )}
            </a>
            {activeDropdown === 'notebook' && renderDeviceDropdown('notebook')}
            {mobileMenuOpen && mobileCategoryOpen === 'notebook' && renderMobileDeviceDropdown('notebook')}
          </div>

          {/* Konsole */}
          <div 
            className="nav-item-with-dropdown nav-category-item nav-partial-hidden"
            onMouseEnter={() => handleMouseEnter('konsole')}
            onMouseLeave={handleMouseLeave}
          >
            <a href="#konsole" className="nav-link" onClick={(e) => handleCategoryClick(e, 'konsole')}>
              <Gamepad2 width={16} height={16} />
              {t('home.nav.konsole', 'Konsole')}
              {mobileMenuOpen && (
                <ChevronDown
                  width={16}
                  height={16}
                  className={`nav-mobile-caret ${mobileCategoryOpen === 'konsole' ? 'open' : ''}`}
                />
              )}
            </a>
            {activeDropdown === 'konsole' && renderDeviceDropdown('konsole')}
            {mobileMenuOpen && mobileCategoryOpen === 'konsole' && renderMobileDeviceDropdown('konsole')}
          </div>

          {/* Shop */}
          <a href="#shop" className="nav-link nav-category-item nav-priority-link" onClick={closeMobileMenu}>
            <ShoppingBag width={16} height={16} />
            {t('home.nav.shop', 'Shop')}
          </a>

          <Link to="/contact" className="nav-link nav-category-item nav-partial-hidden" onClick={() => closeMobileMenu()}>
            <Mail width={16} height={16} />
            {t('home.nav.contact', 'Kontakt')}
          </Link>

          {/* Mobile Extras (only shown in mobile menu) */}
          <div className="nav-mobile-extras">
            <div className="nav-mobile-secondary-links" aria-label={t('home.nav.moreOptions')}>
              <div className="nav-mobile-section-title nav-mobile-section-title-spaced">
                {t('home.nav.moreOptions')}
              </div>
              <button className="nav-mobile-secondary-link" onClick={handleMobileSearchClick}>
                <Search width={16} height={16} />
                {t('common.search', 'Suche')}
              </button>
              <a className="nav-mobile-secondary-link" href="tel:+4917012345678">
                <Phone width={16} height={16} />
                {t('home.topBar.hotline', '0170 123 4567')}
              </a>
              <a className="nav-mobile-secondary-link" href="/annahmestellen">
                <MapPin width={16} height={16} />
                {t('home.topBar.locations', 'Annahmestellen')}
              </a>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="nav-right" ref={navRightRef}>
          {/* Desktop Search - Using NavbarSearch Component */}
          <div className="nav-search hidden lg:block">
            <NavbarSearch />
          </div>

          {/* Mobile Search Toggle */}
          <button
            className={`nav-search-toggle ${searchOpen ? 'active' : ''}`}
            onClick={toggleSearch}
            aria-label={t('home.nav.toggleSearch')}
          >
            <Search width={18} height={18} />
          </button>

          {/* Language Selector */}
          <div className="language-selector-component">
            <LanguageSelector />
          </div>

          {/* Cart */}
          <div className="nav-cart-trigger">
            <CartIcon />
          </div>

          {/* Notifications (if authenticated) */}
          {isAuthenticated && !isDropdownNav && (
            <div className="notification-bell-component">
              <NotificationBell />
            </div>
          )}

          {/* Profile (if authenticated) */}
          {isAuthenticated && !isDropdownNav && (
            <div className="nav-profile-trigger">
              <ProfileDropdown />
            </div>
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
