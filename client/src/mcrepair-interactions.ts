/**
 * McRepair Homepage Interactive Functions
 * Handles all dynamic behavior for the McRepair design
 */

// ============================================
// 1. NAVIGATION SCROLL EFFECTS
// ============================================

/**
 * Add scroll shadow to navigation on scroll
 */
export function initStickyNav(): void {
  const mainNav = document.querySelector('.main-nav');
  
  if (!mainNav) return;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    // Add scrolled class for shadow effect
    if (currentScroll > 50) {
      mainNav.classList.add('scrolled');
    } else {
      mainNav.classList.remove('scrolled');
    }
  });
}

// ============================================
// 2. MOBILE MENU TOGGLE
// ============================================

/**
 * Toggle mobile navigation menu
 */
export function initMobileMenu(): void {
  const mobileToggle = document.querySelector('.nav-mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (!mobileToggle || !navLinks) return;

  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    
    // Update aria-expanded for accessibility
    const isOpen = navLinks.classList.contains('mobile-open');
    mobileToggle.setAttribute('aria-expanded', isOpen.toString());
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && !target.closest('.main-nav')) {
      navLinks.classList.remove('mobile-open');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
      mobileToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ============================================
// 3. MOBILE SEARCH OVERLAY
// ============================================

/**
 * Toggle mobile search overlay
 */
export function initMobileSearch(): void {
  const searchToggle = document.querySelector('.nav-search-toggle');
  const searchOverlay = document.querySelector('.nav-search-overlay');
  
  if (!searchToggle || !searchOverlay) return;

  searchToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    searchOverlay.classList.toggle('open');
    searchToggle.classList.toggle('active');
    
    // Focus on search input when opened
    if (searchOverlay.classList.contains('open')) {
      const input = searchOverlay.querySelector('input');
      setTimeout(() => input?.focus(), 100);
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && !target.closest('.nav-search-overlay') && !target.closest('.nav-search-toggle')) {
      searchOverlay.classList.remove('open');
      searchToggle.classList.remove('active');
    }
  });
}

// ============================================
// 4. REPAIR CONFIGURATOR
// ============================================

interface Extra {
  name: string;
  price: number;
}

interface ConfiguratorState {
  deviceType: string | null;
  brand: string | null;
  model: string | null;
  repairType: string | null;
  extras: Extra[];
  price: number;
  estimatedTime: string;
}

/**
 * Multi-step repair configurator with device preview
 */
export function initConfigurator(): void {
  const configurator = document.querySelector('.configurator');
  if (!configurator) return;

  let currentStep = 1;
  const totalSteps = 4;
  
  const state: ConfiguratorState = {
    deviceType: null,
    brand: null,
    model: null,
    repairType: null,
    extras: [],
    price: 0,
    estimatedTime: '60 Min.'
  };

  // Step navigation
  function goToStep(step: number): void {
    if (step < 1 || step > totalSteps) return;
    
    currentStep = step;
    
    // Update step indicators
    document.querySelectorAll('.config-step-indicator').forEach((indicator, index) => {
      const stepNum = index + 1;
      indicator.classList.remove('active', 'completed');
      
      if (stepNum === currentStep) {
        indicator.classList.add('active');
      } else if (stepNum < currentStep) {
        indicator.classList.add('completed');
      }
    });

    // Update step content
    document.querySelectorAll('.config-step-content').forEach((content, index) => {
      if (index + 1 === currentStep) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Show/hide device preview panel
    updateDevicePreview();
  }

  // Device type selection
  document.querySelectorAll('.device-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.device-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      const deviceType = (card as HTMLElement).dataset.device;
      state.deviceType = deviceType || null;
      
      // Auto-advance to next step
      setTimeout(() => goToStep(2), 300);
    });
  });

  // Brand/Model selection
  const brandSelect = document.querySelector('#brand-select') as HTMLSelectElement | null;
  const modelSelect = document.querySelector('#model-select') as HTMLSelectElement | null;
  
  if (brandSelect) {
    brandSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      state.brand = target.value;
      // In a real app, this would populate models based on brand
      if (modelSelect) {
        modelSelect.disabled = false;
      }
    });
  }

  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      state.model = target.value;
      updateDevicePreview();
    });
  }

  // Repair type selection
  document.querySelectorAll('.repair-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.repair-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      const htmlCard = card as HTMLElement;
      state.repairType = htmlCard.dataset.repair || null;
      state.price = parseInt(htmlCard.dataset.price || '0') || 0;
      
      updateDevicePreview();
    });
  });

  // Extras selection
  document.querySelectorAll('.extras-option input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const extraName = target.dataset.extra || '';
      const extraPrice = parseInt(target.dataset.price || '0') || 0;
      
      if (target.checked) {
        state.extras.push({ name: extraName, price: extraPrice });
      } else {
        state.extras = state.extras.filter(ex => ex.name !== extraName);
      }
      
      updateResult();
    });
  });

  // Navigation buttons
  document.querySelectorAll('.config-nav-btn.back').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(currentStep - 1);
    });
  });

  document.querySelectorAll('.config-nav-btn.next').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(currentStep + 1);
    });
  });

  // Update device preview panel
  function updateDevicePreview(): void {
    const previewPanel = document.querySelector('.device-preview-panel');
    if (!previewPanel) return;

    const hasSelection = state.brand && state.model;
    
    if (hasSelection) {
      previewPanel.classList.add('visible');
      
      // Update preview content
      const modelText = previewPanel.querySelector('.device-preview-panel-model');
      if (modelText) {
        modelText.textContent = `${state.brand} ${state.model}`;
      }

      // Update problems list (example)
      const problemsList = previewPanel.querySelector('.device-preview-panel-list');
      if (problemsList && state.repairType) {
        problemsList.innerHTML = `<li>${state.repairType}</li>`;
      }
    } else {
      previewPanel.classList.remove('visible');
    }
  }

  // Update result section
  function updateResult(): void {
    const totalPrice = state.price + state.extras.reduce((sum, ex) => sum + ex.price, 0);
    
    const priceElement = document.querySelector('.config-result-item .value');
    if (priceElement) {
      priceElement.textContent = `€${totalPrice}`;
    }
  }

  // Initialize at step 1
  goToStep(1);
}

// ============================================
// 5. MOBILE FLOATING CTA
// ============================================

/**
 * Show/hide mobile floating CTA button based on scroll
 */
export function initMobileCTA(): void {
  const fabButton = document.querySelector('.mobile-cta-fab');
  if (!fabButton) return;

  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    const scrollingDown = currentScroll > lastScroll;
    
    // Show FAB after scrolling down 300px
    if (currentScroll > 300) {
      fabButton.classList.add('visible');
      
      // Position based on scroll direction
      if (scrollingDown) {
        fabButton.classList.remove('position-top');
        fabButton.classList.add('position-bottom');
      } else {
        fabButton.classList.remove('position-bottom');
        fabButton.classList.add('position-top');
      }
    } else {
      fabButton.classList.remove('visible');
    }
    
    lastScroll = currentScroll;
  });
}

// ============================================
// 6. COOKIE CONSENT BANNER
// ============================================

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

/**
 * Cookie consent banner with preferences
 */
export function initCookieBanner(): void {
  const banner = document.querySelector('.cookie-banner');
  const cookieFab = document.querySelector('.cookie-fab');
  
  if (!banner) return;

  // Check if consent already given
  const cookieConsent = localStorage.getItem('mcrepair-cookie-consent');
  
  if (!cookieConsent) {
    // Show banner after a short delay
    setTimeout(() => {
      banner.classList.add('visible');
    }, 1000);
  } else {
    // Show cookie FAB if consent given
    if (cookieFab) {
      cookieFab.classList.add('visible');
    }
  }

  // Accept all cookies
  const acceptBtn = document.querySelector('.cookie-btn-accept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      saveConsent({
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true
      });
      banner.classList.remove('visible');
      if (cookieFab) cookieFab.classList.add('visible');
    });
  }

  // Save selected preferences
  const saveBtn = document.querySelector('.cookie-btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const preferences: CookiePreferences = {
        necessary: true, // Always true
        functional: (document.querySelector('#cookie-functional') as HTMLInputElement)?.checked || false,
        analytics: (document.querySelector('#cookie-analytics') as HTMLInputElement)?.checked || false,
        marketing: (document.querySelector('#cookie-marketing') as HTMLInputElement)?.checked || false
      };
      
      saveConsent(preferences);
      banner.classList.remove('visible');
      if (cookieFab) cookieFab.classList.add('visible');
    });
  }

  // Reject all (except necessary)
  const rejectBtn = document.querySelector('.cookie-btn-reject');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      saveConsent({
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false
      });
      banner.classList.remove('visible');
      if (cookieFab) cookieFab.classList.add('visible');
    });
  }

  // Cookie FAB - reopen settings
  if (cookieFab) {
    cookieFab.addEventListener('click', () => {
      banner.classList.add('visible');
      cookieFab.classList.remove('visible');
    });
  }

  function saveConsent(preferences: CookiePreferences): void {
    localStorage.setItem('mcrepair-cookie-consent', JSON.stringify(preferences));
    localStorage.setItem('mcrepair-cookie-consent-date', new Date().toISOString());
    
    // Here you would typically initialize analytics/marketing scripts
    // based on the user's preferences
    console.log('Cookie preferences saved:', preferences);
  }
}

// ============================================
// 7. AUTOCOMPLETE FOR MODEL SELECT
// ============================================

/**
 * Autocomplete dropdown for model selection
 */
export function initAutocomplete(inputSelector: string, items: string[]): void {
  const input = document.querySelector(inputSelector) as HTMLInputElement | null;
  if (!input) return;

  const wrapper = input.parentElement;
  if (!wrapper) return;

  wrapper.classList.add('autocomplete-wrapper');

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  wrapper.appendChild(dropdown);

  let selectedIndex = -1;

  input.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.value.toLowerCase();
    
    if (!value) {
      dropdown.classList.remove('open');
      return;
    }

    // Filter items
    const filtered = items.filter((item: string) => 
      item.toLowerCase().includes(value)
    );

    // Populate dropdown
    dropdown.innerHTML = '';
    filtered.forEach((item: string, index: number) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = item;
      div.dataset.index = index.toString();
      
      div.addEventListener('click', () => {
        input.value = item;
        dropdown.classList.remove('open');
        input.dispatchEvent(new Event('change'));
      });
      
      dropdown.appendChild(div);
    });

    if (filtered.length > 0) {
      dropdown.classList.add('open');
    } else {
      dropdown.classList.remove('open');
    }

    selectedIndex = -1;
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    const dropdownItems = dropdown.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, dropdownItems.length - 1);
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateHighlight();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selectedItem = dropdownItems[selectedIndex] as HTMLElement;
      selectedItem?.click();
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  });

  function updateHighlight(): void {
    const dropdownItems = dropdown.querySelectorAll('.autocomplete-item');
    dropdownItems.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('highlighted');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('highlighted');
      }
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e: Event) => {
    const target = e.target as Node;
    if (target && !wrapper.contains(target)) {
      dropdown.classList.remove('open');
    }
  });
}

// ============================================
// 8. SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================

/**
 * Smooth scroll for anchor links
 */
export function initSmoothScroll(): void {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (this: HTMLAnchorElement, e: Event) {
      const href = this.getAttribute('href');
      
      // Skip if it's just "#"
      if (href === '#') {
        e.preventDefault();
        return;
      }

      const target = href ? document.querySelector(href) : null;
      
      if (target) {
        e.preventDefault();
        
        const mainNav = document.querySelector('.main-nav') as HTMLElement | null;
        const navHeight = mainNav?.offsetHeight || 0;
        const targetElement = target as HTMLElement;
        const targetPosition = targetElement.offsetTop - navHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ============================================
// 9. INITIALIZE ALL FUNCTIONS
// ============================================

/**
 * Initialize all McRepair interactive functions
 */
export function initMcRepair(): void {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(): void {
    initStickyNav();
    initMobileMenu();
    initMobileSearch();
    initConfigurator();
    initMobileCTA();
    initCookieBanner();
    initSmoothScroll();
    
    console.log('McRepair interactive functions initialized');
  }
}

// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined') {
  initMcRepair();
}
