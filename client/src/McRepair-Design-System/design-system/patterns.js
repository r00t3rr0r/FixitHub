/* ============================================
   McRepair Design System – JavaScript Patterns
   ============================================
   
   This file documents all JavaScript interaction 
   patterns used in the McRepair design. Copy and 
   adapt these patterns for other implementations.
   
   Table of Contents:
   1. Mobile Navigation Toggle
   2. Mobile Search Overlay
   3. Sticky Navigation (scroll)
   4. Cookie Consent System
   5. Mobile CTA FAB (scroll-direction)
   6. Repair Configurator (5-step wizard)
   7. Brand/Model Autocomplete
   8. Device Preview Panel
   9. Interactive Map (Leaflet.js)
   10. Map Search with Debounce
   ============================================ */


// ============================================
// 1. MOBILE NAVIGATION TOGGLE
// ============================================
// Toggle the hamburger menu on mobile.
// Uses `.mobile-open` class on `.nav-links`.

function initMobileNav() {
  const toggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  
  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    // IMPORTANT: use 'mobile-open' not 'open'
  });
}


// ============================================
// 2. MOBILE SEARCH OVERLAY
// ============================================
// Opens a full-width search bar below nav on mobile.

function initMobileSearch() {
  const searchToggle = document.getElementById('mobileSearchToggle');
  const overlay = document.getElementById('mobileSearchOverlay');
  const input = document.getElementById('mobileSearchInput');

  if (!searchToggle || !overlay) return;

  searchToggle.addEventListener('click', () => {
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open') && input) {
      input.focus();
    }
  });
}


// ============================================
// 3. STICKY NAVIGATION (scroll effect)
// ============================================
// Adds `.scrolled` class to nav when page scrolls.

function initStickyNav() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}


// ============================================
// 4. COOKIE CONSENT SYSTEM
// ============================================
// Features:
// - Modal with backdrop
// - Accept All / Save Selection / Reject All
// - Uses sessionStorage with 5-minute TTL
// - Cookie FAB to re-open settings after dismiss
//
// CRITICAL: cookie-banner uses `pointer-events: none`
// by default, with `pointer-events: auto` only on
// .cookie-banner.show. This prevents the invisible
// banner from blocking clicks on the page.

function initCookieConsent() {
  const banner = document.getElementById('cookieBanner');
  const fab = document.getElementById('cookieFab');
  const acceptAll = document.getElementById('cookieAcceptAll');
  const saveSelection = document.getElementById('cookieSaveSelection');
  const rejectAll = document.getElementById('cookieRejectAll');

  if (!banner) return;

  const STORAGE_KEY = 'mcrepair_cookie_consent';
  const TTL_MS = 5 * 60 * 1000; // 5 minutes for demo

  function isConsentValid() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      return Date.now() - data.timestamp < TTL_MS;
    } catch {
      return false;
    }
  }

  function saveConsent(analytics, marketing) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      analytics,
      marketing,
      timestamp: Date.now()
    }));
  }

  function hideBanner() {
    banner.classList.remove('show');
    if (fab) fab.classList.add('visible');
  }

  function showBanner() {
    banner.classList.add('show');
    if (fab) fab.classList.remove('visible');
  }

  // On page load: show if no valid consent
  if (!isConsentValid()) {
    setTimeout(() => showBanner(), 800);
  } else {
    if (fab) fab.classList.add('visible');
  }

  // Accept all
  if (acceptAll) {
    acceptAll.addEventListener('click', () => {
      saveConsent(true, true);
      hideBanner();
    });
  }

  // Save selection
  if (saveSelection) {
    saveSelection.addEventListener('click', () => {
      const analytics = document.getElementById('cookieAnalytics')?.checked ?? false;
      const marketing = document.getElementById('cookieMarketing')?.checked ?? false;
      saveConsent(analytics, marketing);
      hideBanner();
    });
  }

  // Reject all
  if (rejectAll) {
    rejectAll.addEventListener('click', () => {
      saveConsent(false, false);
      hideBanner();
    });
  }

  // FAB to re-open
  if (fab) {
    fab.addEventListener('click', () => showBanner());
  }

  // Backdrop click to close
  const backdrop = banner.querySelector('.cookie-banner-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', hideBanner);
  }
}


// ============================================
// 5. MOBILE CTA FAB (scroll-direction aware)
// ============================================
// Shows a floating action button on mobile.
// Moves from bottom (default) to top when
// user scrolls down, then back to bottom
// when scrolling up.

function initMobileFAB() {
  const fab = document.getElementById('mobileCTAFab');
  if (!fab) return;

  let lastScrollY = 0;

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;

    if (currentY > 200) {
      fab.classList.add('visible');
    } else {
      fab.classList.remove('visible');
    }

    // Scroll direction detection
    if (currentY > lastScrollY + 10) {
      // Scrolling DOWN → move FAB to top
      fab.classList.add('position-top');
      fab.classList.remove('position-bottom');
    } else if (currentY < lastScrollY - 10) {
      // Scrolling UP → move FAB to bottom
      fab.classList.remove('position-top');
      fab.classList.add('position-bottom');
    }

    lastScrollY = currentY;
  }, { passive: true });
}


// ============================================
// 6. REPAIR CONFIGURATOR (5-step wizard)
// ============================================
// Multi-step wizard with device selection,
// brand/model input, repair type, extras, result.

function initConfigurator() {
  let currentStep = 1;
  const totalSteps = 5;
  const state = {
    deviceType: null,
    brand: null,
    model: null,
    repairs: [],
    extras: []
  };

  function showStep(step) {
    // Update step indicators
    document.querySelectorAll('.config-step-indicator').forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i + 1 < step) el.classList.add('completed');
      if (i + 1 === step) el.classList.add('active');
    });

    // Show/hide step content
    document.querySelectorAll('.config-step-content').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
    });

    // Show/hide back button
    const backBtn = document.querySelector('.config-nav-btn.back');
    if (backBtn) backBtn.style.display = step > 1 ? 'flex' : 'none';
  }

  // Device card selection
  document.querySelectorAll('.device-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.device-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.deviceType = card.dataset.device;
      // Auto-advance after short delay
      setTimeout(() => nextStep(), 300);
    });
  });

  // Repair card selection (multi-select)
  document.querySelectorAll('.repair-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });
  });

  // Extra card selection (multi-select)
  document.querySelectorAll('.extra-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });
  });

  function nextStep() {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  }

  // Nav buttons
  const nextBtn = document.querySelector('.config-nav-btn.next');
  const backBtn = document.querySelector('.config-nav-btn.back');

  if (nextBtn) nextBtn.addEventListener('click', nextStep);
  if (backBtn) backBtn.addEventListener('click', prevStep);

  // Initialize step 1
  showStep(1);
}


// ============================================
// 7. BRAND / MODEL AUTOCOMPLETE
// ============================================
// Typeahead search for brand and model fields.
// Provides inline dropdown suggestions.

function initAutocomplete(inputId, dataArray) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const wrapper = input.closest('.config-select-wrapper');
  if (!wrapper) return;

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  wrapper.appendChild(dropdown);

  let activeIndex = -1;

  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim();
    if (!value) {
      dropdown.classList.remove('open');
      return;
    }

    const matches = dataArray.filter(item =>
      item.toLowerCase().includes(value)
    ).slice(0, 8);

    if (matches.length === 0) {
      dropdown.classList.remove('open');
      return;
    }

    dropdown.innerHTML = matches.map(m =>
      `<div class="ac-item">${m}</div>`
    ).join('');

    dropdown.classList.add('open');
    activeIndex = -1;

    // Click to select
    dropdown.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.textContent;
        dropdown.classList.remove('open');
        input.dispatchEvent(new Event('change'));
      });
    });
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.ac-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      input.value = items[activeIndex].textContent;
      dropdown.classList.remove('open');
      input.dispatchEvent(new Event('change'));
    }

    items.forEach((item, i) => {
      item.classList.toggle('active', i === activeIndex);
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}


// ============================================
// 8. DEVICE PREVIEW PANEL
// ============================================
// Shows a side panel with device image and
// common problems when brand+model is selected.

/*
  Usage:
  
  const DEVICE_PREVIEWS = {
    'Apple iPhone 15': {
      image: 'images/smartphone_mu.png',
      problems: ['Display-Reparatur', 'Akku-Tausch', ...]
    },
    ...
  };
  
  function updatePreview(brand, model) {
    const panel = document.getElementById('devicePreviewPanel');
    const key = `${brand} ${model}`;
    const data = DEVICE_PREVIEWS[key];
    
    if (data && panel) {
      panel.querySelector('.device-preview-panel-img img').src = data.image;
      panel.querySelector('.device-preview-panel-model').textContent = key;
      panel.querySelector('.device-preview-panel-list').innerHTML = 
        data.problems.map(p => `<li>${p}</li>`).join('');
      panel.classList.add('visible');
    } else if (panel) {
      panel.classList.remove('visible');
    }
  }
*/


// ============================================
// 9. INTERACTIVE MAP (Leaflet.js)
// ============================================
// Partner locations map with custom SVG pins,
// popups, sidebar sync, and tab switching.
//
// CRITICAL PITFALL: Do NOT use CSS keyframe 
// animations on .as-leaflet-pin or similar classes
// that override Leaflet's inline `transform` style.
// Use transitions instead, or apply animations 
// only to child elements, never the pin wrapper.

/*
  Required CDN:
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  Map tiles: CartoDB Voyager
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19
  })
  
  Setup:
*/

function initLocationMap(containerId, locations) {
  const map = L.map(containerId, {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView([51.1657, 10.4515], 6); // Germany center

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Custom pin icon factory
  function createPinIcon() {
    return L.divIcon({
      className: 'as-leaflet-pin',
      html: `<div class="as-pin-marker">
        <svg viewBox="0 0 24 36" width="28" height="42">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" 
                fill="var(--primary-blue)"/>
          <circle cx="12" cy="12" r="5" fill="var(--accent-yellow)"/>
        </svg>
      </div>`,
      iconSize: [28, 42],
      iconAnchor: [14, 42],
      popupAnchor: [0, -42]
    });
  }

  const markers = [];

  locations.forEach((loc, index) => {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: createPinIcon()
    }).addTo(map);

    // Popup HTML
    marker.bindPopup(`
      <div class="as-popup">
        <h3>${loc.name}</h3>
        <p>${loc.address}</p>
        <p>${loc.phone}</p>
        <div class="as-popup-hours">${loc.hours}</div>
        <a href="${loc.mapsUrl}" target="_blank" class="as-popup-btn">Route planen</a>
      </div>
    `);

    markers.push({ marker, data: loc });
  });

  // Sidebar click → flyTo
  function focusLocation(index) {
    const { marker, data } = markers[index];
    map.flyTo([data.lat, data.lng], 14, { duration: 0.8 });
    marker.openPopup();
  }

  return { map, markers, focusLocation };
}


// ============================================
// 10. MAP SEARCH WITH DEBOUNCE
// ============================================
// Filters location list and map pins by search query.

function initMapSearch(inputId, locations, renderCallback) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.toLowerCase().trim();
      
      const filtered = locations.filter(loc =>
        loc.name.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query) ||
        loc.city.toLowerCase().includes(query) ||
        loc.zip.includes(query)
      );

      renderCallback(filtered);
    }, 300); // 300ms debounce
  });
}


// ============================================
// TAB SWITCHING (Map ↔ List)
// ============================================
// Switches between map and list views.
// CRITICAL: call map.invalidateSize() after
// showing the map tab to fix tile rendering.

function initTabSwitching(mapInstance) {
  document.querySelectorAll('.as-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Update active tab button
      document.querySelectorAll('.as-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide panels
      document.querySelectorAll('.as-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === target);
      });

      // Fix Leaflet tile rendering after tab switch
      if (target === 'mapView' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 100);
      }
    });
  });
}


// ============================================
// INITIALIZATION
// ============================================
// Call all init functions on DOMContentLoaded.

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initMobileSearch();
  initStickyNav();
  initCookieConsent();
  initMobileFAB();
  // initConfigurator();  // Only on homepage
  // initLocationMap();   // Only on map page
});
