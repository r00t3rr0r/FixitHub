/* ============================================
   McRepair Homepage – JavaScript
   Configurator Logic + Interactions
   ============================================ */

// ---- DEVICE PREVIEW DATA ----
const deviceImages = {
  smartphone: 'images/smartphone_mu.png',
  tablet: 'images/tablet_mu.png',
  notebook: 'images/notebook_mu.png',
  konsole: 'images/console_mu.png',
};

const deviceProblems = {
  smartphone: [
    'Akku verliert schnell an Leistung',
    'Display reagiert verzögert',
    'Ladebuchse wackelt',
    'Kamera fokussiert unscharf',
  ],
  tablet: [
    'Touchscreen reagiert ungenau',
    'Akku entlädt sich schnell',
    'Display-Helligkeit schwankt',
    'WLAN-Verbindung instabil',
  ],
  notebook: [
    'Lüfter läuft dauerhaft laut',
    'Akku hält nur kurz',
    'Gerät überhitzt schnell',
    'Tastatur reagiert verzögert',
  ],
  konsole: [
    'HDMI-Ausgang ohne Signal',
    'Konsole wird sehr laut',
    'Laufwerk liest Discs nicht',
    'Gerät startet nicht zuverlässig',
  ],
};

function showDevicePreview() {
  const preview = document.getElementById('devicePreview');
  const device = selectedDevice;
  const model = selectedModel;

  if (!device || !model) {
    preview.classList.remove('visible');
    return;
  }

  // Set device image
  const imgSrc = deviceImages[device] || '';
  document.getElementById('devicePreviewImage').innerHTML = imgSrc
    ? `<img src="${imgSrc}" alt="${device}" />`
    : '';

  // Set model name
  document.getElementById('devicePreviewModel').textContent = model;

  // Set problems list
  const problems = deviceProblems[device] || [];
  document.getElementById('devicePreviewList').innerHTML = problems
    .map(p => `<li>${p}</li>`)
    .join('');

  // Trigger expand
  requestAnimationFrame(() => {
    preview.classList.add('visible');
  });
}

function hideDevicePreview() {
  document.getElementById('devicePreview').classList.remove('visible');
}

// ---- DATA (Demo Purposes) ----
const deviceData = {
  smartphone: {
    brands: {
      apple: [
        'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
        'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
        'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
        'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 mini', 'iPhone 13',
        'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 mini', 'iPhone 12',
        'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
        'iPhone SE (2022)', 'iPhone SE (2020)',
        'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      ],
      samsung: [
        'Galaxy S25 Ultra', 'Galaxy S25+', 'Galaxy S25',
        'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24',
        'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23',
        'Galaxy Z Fold 6', 'Galaxy Z Fold 5',
        'Galaxy Z Flip 6', 'Galaxy Z Flip 5',
        'Galaxy A55', 'Galaxy A54', 'Galaxy A35', 'Galaxy A34',
        'Galaxy A25', 'Galaxy A15', 'Galaxy A14',
      ],
      huawei: [
        'P60 Pro', 'P50 Pro', 'P40 Pro', 'P30 Pro', 'P30 Lite',
        'Mate 50 Pro', 'Mate 40 Pro',
        'Nova 12', 'Nova 11', 'Nova 10',
      ],
      xiaomi: [
        'Xiaomi 14 Pro', 'Xiaomi 14', 'Xiaomi 13 Pro', 'Xiaomi 13',
        'Redmi Note 13 Pro+', 'Redmi Note 13 Pro', 'Redmi Note 13',
        'Redmi Note 12 Pro', 'Redmi Note 12',
        'Poco X6 Pro', 'Poco X5 Pro', 'Poco F5',
      ],
      google: [
        'Pixel 9 Pro XL', 'Pixel 9 Pro', 'Pixel 9',
        'Pixel 8 Pro', 'Pixel 8', 'Pixel 8a',
        'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a',
        'Pixel 6 Pro', 'Pixel 6',
      ],
      oneplus: [
        'OnePlus 12', 'OnePlus 11', 'OnePlus 10 Pro',
        'OnePlus Nord 4', 'OnePlus Nord CE 4',
      ],
      sony: [
        'Xperia 1 VI', 'Xperia 5 V', 'Xperia 10 VI',
      ],
    },
  },
  tablet: {
    brands: {
      apple: [
        'iPad Pro 13" (M4)', 'iPad Pro 11" (M4)',
        'iPad Air 13" (M2)', 'iPad Air 11" (M2)',
        'iPad (10. Gen)', 'iPad mini (6. Gen)',
      ],
      samsung: [
        'Galaxy Tab S9 Ultra', 'Galaxy Tab S9+', 'Galaxy Tab S9',
        'Galaxy Tab A9+', 'Galaxy Tab A9',
      ],
      huawei: ['MatePad Pro', 'MatePad 11'],
      xiaomi: ['Pad 6', 'Pad 5'],
      google: ['Pixel Tablet'],
      oneplus: ['Pad 2'],
      sony: [],
    },
  },
  notebook: {
    brands: {
      apple: [
        'MacBook Pro 16" (M3 Max)', 'MacBook Pro 14" (M3 Pro)',
        'MacBook Air 15" (M3)', 'MacBook Air 13" (M3)',
      ],
      samsung: [],
      huawei: ['MateBook X Pro', 'MateBook 14'],
      xiaomi: [],
      google: [],
      oneplus: [],
      sony: [],
    },
  },
  konsole: {
    brands: {
      sony: ['PlayStation 5', 'PlayStation 5 Slim', 'PlayStation 4 Pro', 'PlayStation 4'],
      // Reuse brand keys for Nintendo/Microsoft
      apple: [],
      samsung: [],
      huawei: [],
      xiaomi: [],
      google: [],
      oneplus: [],
    },
  },
};

// Extra brands for konsole
const konsoleBrands = [
  { value: 'sony', label: 'Sony PlayStation' },
  { value: 'microsoft', label: 'Microsoft Xbox' },
  { value: 'nintendo', label: 'Nintendo' },
];

const konsoleModels = {
  sony: ['PlayStation 5', 'PlayStation 5 Slim', 'PlayStation 4 Pro', 'PlayStation 4'],
  microsoft: ['Xbox Series X', 'Xbox Series S', 'Xbox One X', 'Xbox One S'],
  nintendo: ['Nintendo Switch OLED', 'Nintendo Switch', 'Nintendo Switch Lite'],
};

const repairPrices = {
  display: { price: '99,90 €', duration: '1–3 Werktage' },
  akku: { price: '59,90 €', duration: '1–2 Werktage' },
  kamera: { price: '79,90 €', duration: '2–4 Werktage' },
  ladebuchse: { price: '69,90 €', duration: '2–3 Werktage' },
  wasserschaden: { price: '89,90 €', duration: '3–5 Werktage' },
  sonstige: { price: 'Auf Anfrage', duration: '3–5 Werktage' },
};

// ---- STATE ----
let currentStep = 1;
let selectedDevice = null;
let selectedBrand = null;
let selectedModel = null;
let selectedRepair = null;

// ---- NAVIGATION ----
const mainNav = document.getElementById('mainNav');
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

// Sticky nav scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 10) {
    mainNav.classList.add('scrolled');
  } else {
    mainNav.classList.remove('scrolled');
  }
});

// Mobile menu toggle
mobileToggle.addEventListener('click', () => {
  navLinks.classList.toggle('mobile-open');
  // Close search if open
  const overlay = document.getElementById('mobileSearchOverlay');
  if (overlay) overlay.classList.remove('open');
  const searchBtn = document.getElementById('mobileSearchToggle');
  if (searchBtn) searchBtn.classList.remove('active');
});

// Mobile search toggle
const mobileSearchToggle = document.getElementById('mobileSearchToggle');
const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
if (mobileSearchToggle && mobileSearchOverlay) {
  mobileSearchToggle.addEventListener('click', () => {
    mobileSearchOverlay.classList.toggle('open');
    mobileSearchToggle.classList.toggle('active');
    // Close mobile menu if open
    navLinks.classList.remove('mobile-open');
    // Auto-focus the input
    if (mobileSearchOverlay.classList.contains('open')) {
      mobileSearchOverlay.querySelector('input').focus();
    }
  });
}

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('mobile-open');
    if (mobileSearchOverlay) mobileSearchOverlay.classList.remove('open');
    if (mobileSearchToggle) mobileSearchToggle.classList.remove('active');
  });
});

// Close autocomplete on outside click
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('modelDropdown');
  const input = document.getElementById('modelInput');
  if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
    dropdown.classList.remove('open');
  }
});

// ---- CONFIGURATOR LOGIC ----

function goToStep(step) {
  currentStep = step;
  
  // Hide preview if going back to step 1 (device selection)
  if (step === 1) {
    hideDevicePreview();
  }
  
  // Update step indicators
  document.querySelectorAll('.config-step-indicator').forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (s === step) ind.classList.add('active');
    if (s < step) ind.classList.add('completed');
  });

  // Show/hide step content
  document.querySelectorAll('.config-step-content').forEach(content => {
    content.classList.remove('active');
    if (parseInt(content.dataset.step) === step) {
      content.classList.add('active');
    }
  });

  // If going to step 2 for konsole, update brand selector
  if (step === 2 && selectedDevice === 'konsole') {
    updateBrandSelectForKonsole();
  }
}

function selectDevice(el) {
  // Remove previous selection
  document.querySelectorAll('.device-card').forEach(card => card.classList.remove('selected'));
  el.classList.add('selected');
  selectedDevice = el.dataset.device;
  
  // Reset downstream selections
  selectedBrand = null;
  selectedModel = null;
  selectedRepair = null;
  document.getElementById('modelInput').value = '';
  hideDevicePreview();
  
  // Update model input placeholder per device type
  const placeholders = {
    smartphone: 'z.B. iPhone 15 Pro...',
    tablet: 'z.B. iPad Pro 13" (M4)...',
    notebook: 'z.B. MacBook Air 15" (M3)...',
    konsole: 'z.B. PlayStation 5...',
  };
  document.getElementById('modelInput').placeholder = placeholders[selectedDevice] || 'Modell suchen...';
  
  // Reset brand select to default (fixes konsole brands staying)
  resetBrandSelect();
  
  // Auto-advance to step 2
  setTimeout(() => goToStep(2), 300);
}

function resetBrandSelect() {
  const select = document.getElementById('brandSelect');
  if (selectedDevice === 'konsole') {
    // Will be handled by goToStep -> updateBrandSelectForKonsole
    return;
  }
  select.innerHTML = `
    <option value="">Bitte wählen...</option>
    <option value="apple">Apple</option>
    <option value="samsung">Samsung</option>
    <option value="huawei">Huawei</option>
    <option value="xiaomi">Xiaomi</option>
    <option value="google">Google</option>
    <option value="oneplus">OnePlus</option>
    <option value="sony">Sony</option>
  `;
}

function updateBrandSelectForKonsole() {
  const select = document.getElementById('brandSelect');
  select.innerHTML = '<option value="">Bitte wählen...</option>';
  konsoleBrands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.value;
    opt.textContent = b.label;
    select.appendChild(opt);
  });
}

function onBrandChange() {
  const brand = document.getElementById('brandSelect').value;
  selectedBrand = brand;
  selectedModel = null;
  document.getElementById('modelInput').value = '';
  hideDevicePreview();
  
  // Enable/disable next based on model selection
  updateStep2Next();
}

function onModelInput(value) {
  const dropdown = document.getElementById('modelDropdown');
  
  if (!selectedBrand && !selectedDevice) {
    dropdown.classList.remove('open');
    return;
  }

  let models = [];
  
  if (selectedDevice === 'konsole') {
    models = konsoleModels[selectedBrand] || [];
  } else {
    const deviceBrands = deviceData[selectedDevice]?.brands;
    models = deviceBrands?.[selectedBrand] || [];
  }

  // Filter based on input
  const query = value.toLowerCase().trim();
  const filtered = query
    ? models.filter(m => m.toLowerCase().includes(query))
    : models;

  if (filtered.length === 0) {
    dropdown.classList.remove('open');
    return;
  }

  // Render dropdown
  dropdown.innerHTML = filtered.map((m, i) => {
    const escaped = m.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="autocomplete-item" data-model-index="${i}" onclick="selectModelFromDropdown(this)" data-model-value="${escaped}">${m}</div>`;
  }).join('');
  dropdown.classList.add('open');
}

function selectModelFromDropdown(el) {
  const model = el.getAttribute('data-model-value')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  selectModel(model);
}

function selectModel(model) {
  selectedModel = model;
  document.getElementById('modelInput').value = model;
  document.getElementById('modelDropdown').classList.remove('open');
  updateStep2Next();
  showDevicePreview();
}

function updateStep2Next() {
  const btn = document.getElementById('step2Next');
  if (selectedBrand && selectedModel) {
    btn.disabled = false;
    btn.style.opacity = '1';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

function selectRepair(el) {
  document.querySelectorAll('.repair-card').forEach(card => card.classList.remove('selected'));
  el.classList.add('selected');
  selectedRepair = el.dataset.repair;
  
  // Update result
  const repair = repairPrices[selectedRepair];
  if (repair) {
    document.getElementById('resultPrice').textContent = repair.price;
    document.getElementById('resultDuration').textContent = repair.duration;
  }
  
  // Auto-advance to extras (step 4)
  setTimeout(() => goToStep(4), 300);
}

function resetConfigurator() {
  currentStep = 1;
  selectedDevice = null;
  selectedBrand = null;
  selectedModel = null;
  selectedRepair = null;
  
  document.querySelectorAll('.device-card').forEach(card => card.classList.remove('selected'));
  document.querySelectorAll('.repair-card').forEach(card => card.classList.remove('selected'));
  document.getElementById('brandSelect').value = '';
  document.getElementById('modelInput').value = '';
  hideDevicePreview();
  
  // Reset brand select to default options
  const select = document.getElementById('brandSelect');
  select.innerHTML = `
    <option value="">Bitte wählen...</option>
    <option value="apple">Apple</option>
    <option value="samsung">Samsung</option>
    <option value="huawei">Huawei</option>
    <option value="xiaomi">Xiaomi</option>
    <option value="google">Google</option>
    <option value="oneplus">OnePlus</option>
    <option value="sony">Sony</option>
  `;
  
  goToStep(1);
}

// Initialize step2 next button state
updateStep2Next();

// ---- EXTRAS (STEP 4) ----
function updateExtras() {
  // Optional: track selected extras for summary
  const checkedExtras = document.querySelectorAll('.extras-option input:checked');
  // Could update pricing here in a real implementation
}

// ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = this.getAttribute('href');
    if (target === '#') return;
    
    e.preventDefault();
    const el = document.querySelector(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ---- INTERSECTION OBSERVER FOR ANIMATIONS ----
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Apply fade-in to sections
document.querySelectorAll('.section').forEach(section => {
  section.style.opacity = '0';
  section.style.transform = 'translateY(20px)';
  section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(section);
});

// Apply to trust items
document.querySelectorAll('.trust-item').forEach((item, i) => {
  item.style.opacity = '0';
  item.style.transform = 'translateY(15px)';
  item.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
  observer.observe(item);
});

// ---- COOKIE CONSENT BANNER ----
(function() {
  const COOKIE_KEY = 'mcrepair_cookie_consent';
  const COOKIE_TTL = 5 * 60 * 1000; // 5 minutes in ms

  const banner = document.getElementById('cookieBanner');
  const fab = document.getElementById('cookieFab');
  if (!banner) return;

  function isConsentValid() {
    const raw = sessionStorage.getItem(COOKIE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      const elapsed = Date.now() - data.savedAt;
      if (elapsed > COOKIE_TTL) {
        sessionStorage.removeItem(COOKIE_KEY);
        return false;
      }
      return true;
    } catch {
      sessionStorage.removeItem(COOKIE_KEY);
      return false;
    }
  }

  function showFab() {
    if (fab) {
      setTimeout(() => fab.classList.add('visible'), 400);
    }
  }

  function hideFab() {
    if (fab) fab.classList.remove('visible');
  }

  // Clear old localStorage entry (migration)
  localStorage.removeItem(COOKIE_KEY);

  if (isConsentValid()) {
    // Already consented — just show the FAB
    showFab();
    return;
  }

  // Show banner after a short delay
  setTimeout(() => {
    banner.classList.add('visible');
    banner.style.display = '';
  }, 800);

  function hideBanner() {
    banner.classList.remove('visible');
    setTimeout(() => {
      banner.style.display = 'none';
    }, 500);
    showFab();
  }

  function saveConsent(analytics, marketing) {
    const data = {
      necessary: true,
      analytics: analytics,
      marketing: marketing,
      timestamp: new Date().toISOString(),
      savedAt: Date.now(),
    };
    sessionStorage.setItem(COOKIE_KEY, JSON.stringify(data));
    hideBanner();

    // Auto-expire after TTL
    setTimeout(() => {
      sessionStorage.removeItem(COOKIE_KEY);
    }, COOKIE_TTL);
  }

  // Accept all
  document.getElementById('cookieAcceptAll').addEventListener('click', () => {
    saveConsent(true, true);
  });

  // Save selection
  document.getElementById('cookieSaveSelection').addEventListener('click', () => {
    const analytics = document.getElementById('cookieAnalytics').checked;
    const marketing = document.getElementById('cookieMarketing').checked;
    saveConsent(analytics, marketing);
  });

  // Reject all (only necessary)
  document.getElementById('cookieRejectAll').addEventListener('click', () => {
    document.getElementById('cookieAnalytics').checked = false;
    document.getElementById('cookieMarketing').checked = false;
    saveConsent(false, false);
  });

  // FAB: reopen cookie banner
  if (fab) {
    fab.addEventListener('click', () => {
      hideFab();
      banner.style.display = '';
      // Restore checkbox states from saved consent
      const raw = sessionStorage.getItem(COOKIE_KEY);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          document.getElementById('cookieAnalytics').checked = data.analytics;
          document.getElementById('cookieMarketing').checked = data.marketing;
        } catch {}
      }
      requestAnimationFrame(() => {
        banner.classList.add('visible');
      });
    });
  }
})();

/* ===========================================
   MOBILE CTA FAB – scroll-direction aware
   =========================================== */
(function () {
  const ctaFab = document.getElementById('mobileCTAFab');
  if (!ctaFab) return;

  let lastScrollY = window.scrollY;
  let scrollDir = 'down';          // 'up' | 'down'
  const SHOW_THRESHOLD = 120;      // px before button appears
  const DEAD_ZONE = 5;             // ignore very small scrolls
  let ticking = false;

  function updateCTA() {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;

    // Ignore tiny movements
    if (Math.abs(delta) > DEAD_ZONE) {
      scrollDir = delta > 0 ? 'down' : 'up';
      lastScrollY = currentY;
    }

    // Hide when near the top of the page
    if (currentY < SHOW_THRESHOLD) {
      ctaFab.classList.remove('visible', 'position-top', 'position-bottom');
      ticking = false;
      return;
    }

    // Show button
    if (!ctaFab.classList.contains('visible')) {
      ctaFab.classList.add('visible', 'position-bottom');
    }

    // Scrolling DOWN → bottom-right
    if (scrollDir === 'down') {
      if (ctaFab.classList.contains('position-top')) {
        ctaFab.classList.remove('position-top');
        ctaFab.classList.add('position-bottom');
      }
    }
    // Scrolling UP → top-right
    else {
      if (ctaFab.classList.contains('position-bottom')) {
        ctaFab.classList.remove('position-bottom');
        ctaFab.classList.add('position-top');
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateCTA);
    }
  }, { passive: true });
})();
