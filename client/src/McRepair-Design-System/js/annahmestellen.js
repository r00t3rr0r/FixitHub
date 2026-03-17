/* ============================================
   McRepair – Annahmestellen Page JS
   Leaflet.js Interactive Map
   ============================================ */

// ---- DEMO DATA: Partner Locations with real lat/lng ----
const LOCATIONS = [
  {
    id: 'A', name: 'Elektrik Vacha GmbH', distance: '33.6km',
    address: 'Bahnhofstraße 46, 36433 Bad Salzungen',
    phone: '03695693013', email: 'laden319@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.8127, lng: 10.2257,
    hours: { Mo: '09:00 – 19:00', Di: '09:00 – 19:00', Mi: '09:00 – 19:00', Do: '09:00 – 19:00', Fr: '09:00 – 19:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'B', name: 'EP:Tettke', distance: '38.0km',
    address: 'Sondershäuser Straße 32, 99091 Erfurt',
    phone: '03617450540', email: 'info@tettke.de',
    url: 'https://www.ep.de/tettke/', logo: 'EP',
    lat: 51.0153, lng: 10.9883,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'C', name: 'EP:Bierwirth', distance: '38.2km',
    address: 'Kupferstraße 26, 36205 Sontra-Hornel',
    phone: '05653911 40', email: 'ep-bierwirth@t-online.de',
    url: 'https://www.ep.de/bierwirth/', logo: 'EP',
    lat: 51.0549, lng: 9.9086,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'D', name: 'Elektrik Vacha GmbH', distance: '41.4km',
    address: 'Heyligenstedtstr. 7, 36404 Vacha',
    phone: '03696224661', email: 'laden313@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.8273, lng: 10.0214,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'E', name: 'Elektrik Vacha GmbH', distance: '46.7km',
    address: 'An der Zehnt 3, 36466 Dermbach',
    phone: '03696482236', email: 'laden316@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.7139, lng: 10.1244,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'F', name: 'Elektrik Vacha GmbH', distance: '54.1km',
    address: 'Gartenstr. 1a, 36452 Kaltennordheim',
    phone: '03696 7468', email: 'laden317@elektrik-vacha.de',
    url: '', logo: 'EV',
    lat: 50.6287, lng: 10.1577,
    hours: { Mo: '09:00 – 13:00 14:00 – 18:00', Di: '09:00 – 13:00 14:00 – 18:00', Mi: '09:00 – 13:00 14:00 – 18:00', Do: '09:00 – 13:00 14:00 – 18:00', Fr: '09:00 – 13:00 14:00 – 18:00', Sa: '09:00 – 13:00', So: 'geschlossen' }
  },
  {
    id: 'G', name: 'PC Jumper', distance: '62.3km',
    address: 'Ludwig Chronegk Str. 9, 98617 Meiningen',
    phone: '03693478959', email: 'mobile@pc-jumper.de',
    url: 'https://pc-jumper.de/', logo: 'PJ',
    lat: 50.5688, lng: 10.4160,
    hours: { Mo: '10:00 – 12:30 13:30 – 16:30', Di: '10:00 – 12:30 13:30 – 16:30', Mi: 'geschlossen', Do: '10:00 – 12:30 13:30 – 16:30', Fr: '10:00 – 12:30 13:30 – 16:30', Sa: '10:00 – 12:00', So: 'geschlossen' }
  },
  {
    id: 'H', name: 'Fa. Radio Fürth GmbH', distance: '68.5km',
    address: 'Lange Geismarstr. 28, 37073 Göttingen',
    phone: '0551 44082', email: 'sven@radiofuerth.de',
    url: '', logo: 'RF',
    lat: 51.5318, lng: 9.9372,
    hours: { Mo: '09:00 – 12:00', Di: '09:00 – 12:00', Mi: '09:00 – 18:00', Do: '09:00 – 12:00', Fr: '09:00 – 12:00 14:00 – 18:00', Sa: 'geschlossen', So: 'geschlossen' }
  },
  {
    id: 'I', name: 'Phonelux Kassel', distance: '72.1km',
    address: 'Obere Königsstr. 43, 34117 Kassel',
    phone: '0561 7393828', email: 'info@phonelux-kassel.de',
    url: 'https://phonelux-kassel.de/', logo: 'PL',
    lat: 51.3147, lng: 9.4958,
    hours: { Mo: '10:00 – 19:00', Di: '10:00 – 19:00', Mi: '10:00 – 19:00', Do: '10:00 – 19:00', Fr: '10:00 – 19:00', Sa: '10:00 – 16:00', So: 'geschlossen' }
  },
  {
    id: 'J', name: 'EP:Müller Elektronik', distance: '78.9km',
    address: 'Hauptstraße 12, 99084 Erfurt-Nord',
    phone: '0361 5512340', email: 'info@mueller-elektronik.de',
    url: 'https://www.ep.de/mueller/', logo: 'EP',
    lat: 50.9787, lng: 11.0328,
    hours: { Mo: '09:00 – 18:00', Di: '09:00 – 18:00', Mi: '09:00 – 18:00', Do: '09:00 – 18:00', Fr: '09:00 – 18:00', Sa: '09:00 – 14:00', So: 'geschlossen' }
  },
  {
    id: 'K', name: 'Handy-Doc Frankfurt', distance: '85.2km',
    address: 'Berger Str. 132, 60316 Frankfurt am Main',
    phone: '069 90437821', email: 'service@handy-doc-ffm.de',
    url: 'https://handy-doc-ffm.de/', logo: 'HD',
    lat: 50.1184, lng: 8.6917,
    hours: { Mo: '10:00 – 19:00', Di: '10:00 – 19:00', Mi: '10:00 – 19:00', Do: '10:00 – 19:00', Fr: '10:00 – 19:00', Sa: '10:00 – 16:00', So: 'geschlossen' }
  },
  {
    id: 'L', name: 'TechPoint Leipzig', distance: '92.4km',
    address: 'Petersstraße 28, 04109 Leipzig',
    phone: '0341 9876543', email: 'kontakt@techpoint-leipzig.de',
    url: 'https://techpoint-leipzig.de/', logo: 'TP',
    lat: 51.3382, lng: 12.3746,
    hours: { Mo: '09:30 – 18:30', Di: '09:30 – 18:30', Mi: '09:30 – 18:30', Do: '09:30 – 18:30', Fr: '09:30 – 18:30', Sa: '10:00 – 14:00', So: 'geschlossen' }
  }
];

// ---- DOM REFS ----
const locationListEl = document.getElementById('asLocationList');
const listGridEl = document.getElementById('asListGrid');
const tabs = document.querySelectorAll('.as-tab');
const mapView = document.getElementById('asMapView');
const listView = document.getElementById('asListView');
const searchInput = document.getElementById('asSearchInput');
const searchBtn = document.getElementById('asSearchBtn');
const tagBtns = document.querySelectorAll('.as-tag');
const loadMoreBtn = document.getElementById('asLoadMore');

// ---- LEAFLET MAP ----
let map = null;
let markersLayer = null;
let markers = {};
let activeMarkerId = null;

function createCustomIcon(letter, isActive) {
  const color = isActive ? '#1a2a5e' : '#e53e3e';
  const shadowColor = isActive ? 'rgba(26,42,94,0.4)' : 'rgba(229,62,62,0.35)';
  const isMobile = ('ontouchstart' in window);
  const size = isActive ? 42 : (isMobile ? 40 : 36);
  const pad = isMobile ? 8 : 0; // extra transparent padding for easier tapping
  const totalW = size + pad * 2;
  const totalH = Math.round(size * 1.5) + pad;
  return L.divIcon({
    className: 'as-leaflet-pin',
    html: `
      <div class="as-pin-wrapper ${isActive ? 'active' : ''}" style="--pin-color:${color};--pin-shadow:${shadowColor};padding:${pad}px;margin:-${pad}px 0 0 -${pad}px;">
        <svg width="${size}" height="${Math.round(size * 1.5)}" viewBox="0 0 36 54" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="pinShadow${letter}" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="${shadowColor}" flood-opacity="0.6"/>
            </filter>
          </defs>
          <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 36 18 36s18-22.5 18-36C36 8.06 27.94 0 18 0z" fill="${color}" filter="url(#pinShadow${letter})"/>
          <circle cx="18" cy="16" r="11" fill="#fff"/>
          <text x="18" y="20.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="800" fill="${color}">${letter}</text>
        </svg>
      </div>
    `,
    iconSize: [totalW, totalH],
    iconAnchor: [totalW / 2, totalH],
    popupAnchor: [0, -Math.round(size * 1.35)]
  });
}

function buildPopupHTML(loc) {
  return `
    <div class="as-leaflet-popup">
      <div class="as-leaflet-popup-header">
        <span class="as-leaflet-popup-marker">${loc.id}</span>
        <div class="as-leaflet-popup-title">
          <div class="as-leaflet-popup-name">${loc.name}</div>
          <div class="as-leaflet-popup-dist">${loc.distance} entfernt</div>
        </div>
      </div>
      <div class="as-leaflet-popup-body">
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${loc.address}</span>
        </div>
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="tel:${loc.phone}">${loc.phone}</a>
        </div>
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <a href="mailto:${loc.email}">${loc.email}</a>
        </div>
      </div>
    </div>
  `;
}

function initMap() {
  const mapEl = document.getElementById('leafletMap');
  if (!mapEl || map) return;

  // Center on Germany – show the whole country on initial load
  map = L.map('leafletMap', {
    center: [51.1657, 10.4515],
    zoom: 6,
    minZoom: 5,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: true
  });

  // Use CartoDB Voyager for a clean, modern look that matches blue/white design
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Add zoom control to bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Create markers layer group
  markersLayer = L.layerGroup().addTo(map);

  // Force Leaflet to recalculate container size, then render pins
  setTimeout(() => {
    map.invalidateSize();
    renderMapPins(LOCATIONS);
  }, 200);

  // Close popup resets active state
  map.on('popupclose', () => {
    if (activeMarkerId) {
      updateMarkerIcon(activeMarkerId, false);
      activeMarkerId = null;
    }
  });
}

function renderMapPins(locations) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  markers = {};

  const bounds = [];

  locations.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: createCustomIcon(loc.id, false),
      riseOnHover: true
    });

    marker.bindPopup(buildPopupHTML(loc), {
      maxWidth: 280,
      minWidth: 220,
      className: 'as-leaflet-popup-container',
      closeButton: true,
      autoPan: true,
      autoPanPaddingTopLeft: [20, 20],
      autoPanPaddingBottomRight: [20, 20]
    });

    marker.on('click', () => {
      // Reset previous active marker
      if (activeMarkerId && markers[activeMarkerId]) {
        const prevLoc = LOCATIONS.find(l => l.id === activeMarkerId);
        if (prevLoc) markers[activeMarkerId].setIcon(createCustomIcon(prevLoc.id, false));
      }
      // Activate new
      activeMarkerId = loc.id;
      marker.setIcon(createCustomIcon(loc.id, true));
      highlightSidebarItem(loc.id);
    });

    // Only add hover effects on non-touch devices to prevent glitchy behavior on mobile
    if (!('ontouchstart' in window)) {
      marker.on('mouseover', function() {
        if (activeMarkerId !== loc.id) {
          this.setIcon(createCustomIcon(loc.id, true));
        }
      });

      marker.on('mouseout', function() {
        if (activeMarkerId !== loc.id) {
          this.setIcon(createCustomIcon(loc.id, false));
        }
      });
    }

    markersLayer.addLayer(marker);
    markers[loc.id] = marker;
    bounds.push([loc.lat, loc.lng]);
  });

  // Fit map to show all markers with padding
  if (bounds.length > 0 && map) {
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
    }, 100);
  }
}

function updateMarkerIcon(id, isActive) {
  if (markers[id]) {
    const loc = LOCATIONS.find(l => l.id === id);
    if (loc) markers[id].setIcon(createCustomIcon(loc.id, isActive));
  }
}

function flyToLocation(loc) {
  if (!map || !markers[loc.id]) return;
  // Reset prev
  if (activeMarkerId && markers[activeMarkerId]) {
    updateMarkerIcon(activeMarkerId, false);
  }
  activeMarkerId = loc.id;
  updateMarkerIcon(loc.id, true);
  map.flyTo([loc.lat, loc.lng], 12, { duration: 0.8 });
  setTimeout(() => {
    markers[loc.id].openPopup();
  }, 850);
}

// ---- SIDEBAR / PIN SYNC ----
function highlightSidebarItem(id) {
  document.querySelectorAll('.as-location-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.as-location-item').forEach(item => {
    if (item.querySelector('.as-location-marker')?.textContent.trim() === id) {
      item.classList.add('active');
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ---- RENDER SIDEBAR LOCATIONS (MAP VIEW) ----
function renderSidebarLocations(locations) {
  locationListEl.innerHTML = '';
  locations.forEach((loc, i) => {
    const item = document.createElement('div');
    item.className = 'as-location-item' + (i === 0 ? ' active' : '');
    item.style.animationDelay = (i * 0.05) + 's';
    item.innerHTML = `
      <div class="as-location-marker">${loc.id}</div>
      <div class="as-location-info">
        <div class="as-location-name">
          ${loc.name}
          <span class="as-location-distance">(${loc.distance})</span>
        </div>
        <div class="as-location-address">${loc.address}</div>
        <div class="as-location-contact">
          Tel.: ${loc.phone}<br>
          E-Mail: <a href="mailto:${loc.email}">${loc.email}</a>
        </div>
      </div>
    `;
    // Click sidebar → fly to marker on map + open popup
    item.addEventListener('click', () => {
      document.querySelectorAll('.as-location-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      flyToLocation(loc);
    });
    locationListEl.appendChild(item);
  });
}

// ---- RENDER LIST CARDS ----
function renderListCards(locations) {
  listGridEl.innerHTML = '';
  locations.forEach((loc, i) => {
    const card = document.createElement('div');
    card.className = 'as-list-card';
    card.style.animationDelay = (i * 0.05) + 's';

    const hoursHTML = Object.entries(loc.hours).map(([day, time]) => {
      const isClosed = time === 'geschlossen';
      return `
        <div class="as-card-hours-row">
          <span class="as-card-hours-day">${day}:</span>
          <span class="${isClosed ? 'as-card-hours-closed' : ''}">${time}</span>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="as-card-logo">
        <div class="as-card-logo-placeholder">
          <div class="as-card-logo-icon">${loc.logo}</div>
          <span>${loc.name.length > 22 ? loc.name.substring(0, 22) + '…' : loc.name}</span>
        </div>
        <span class="as-card-partner-badge">Partner</span>
      </div>
      <div class="as-card-body">
        <div class="as-card-name">${loc.name}</div>
        ${loc.url ? `<div class="as-card-url">${loc.url}</div>` : ''}
        <div class="as-card-address">${loc.address}</div>
        <div class="as-card-contact-row">
          Tel.: ${loc.phone}<br>
          E-Mail: <a href="mailto:${loc.email}">${loc.email}</a>
        </div>
        <div class="as-card-hours">
          <h5>Öffnungszeiten</h5>
          <div class="as-card-hours-table">
            ${hoursHTML}
          </div>
        </div>
      </div>
    `;
    listGridEl.appendChild(card);
  });
}

// ---- TAB SWITCHING ----
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    if (view === 'map') {
      mapView.classList.add('active');
      listView.classList.remove('active');
      // Leaflet needs invalidateSize when container becomes visible
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
          if (markersLayer && markersLayer.getLayers().length > 0) {
            const bounds = [];
            markersLayer.eachLayer(m => bounds.push(m.getLatLng()));
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
          }
        }
      }, 150);
    } else {
      listView.classList.add('active');
      mapView.classList.remove('active');
    }
  });
});

// ---- SEARCH FILTER ----
function filterLocations(query) {
  const q = query.toLowerCase().trim();
  if (!q) return LOCATIONS;
  return LOCATIONS.filter(loc =>
    loc.name.toLowerCase().includes(q) ||
    loc.address.toLowerCase().includes(q) ||
    loc.email.toLowerCase().includes(q) ||
    loc.phone.includes(q)
  );
}

function performSearch() {
  const query = searchInput.value;
  const filtered = filterLocations(query);
  renderSidebarLocations(filtered);
  renderListCards(filtered);
  renderMapPins(filtered);
  const countEl = document.querySelector('.as-sidebar-count strong');
  if (countEl) countEl.textContent = filtered.length;
}

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(performSearch, 300);
});

// ---- TAG TOGGLE ----
tagBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tagBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ---- LOAD MORE (demo) ----
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      Laden...
    `;
    setTimeout(() => {
      loadMoreBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Alle Standorte geladen
      `;
      loadMoreBtn.disabled = true;
      loadMoreBtn.style.opacity = '0.6';
      loadMoreBtn.style.cursor = 'default';
    }, 1200);
  });
}

// ---- STICKY NAV ----
const mainNav = document.getElementById('mainNav');
if (mainNav) {
  window.addEventListener('scroll', () => {
    mainNav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

// ---- MOBILE NAV TOGGLE ----
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');
if (mobileToggle && navLinks) {
  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    // Close search overlay if open
    const mso = document.getElementById('mobileSearchOverlay');
    if (mso) mso.classList.remove('open');
    const msb = document.getElementById('mobileSearchToggle');
    if (msb) msb.classList.remove('active');
  });

  // Close mobile menu when clicking any link inside it
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('mobile-open');
    });
  });
}

// ---- MOBILE SEARCH TOGGLE ----
const searchToggle = document.getElementById('mobileSearchToggle');
const searchOverlay = document.getElementById('mobileSearchOverlay');
if (searchToggle && searchOverlay) {
  searchToggle.addEventListener('click', () => {
    searchOverlay.classList.toggle('open');
    searchToggle.classList.toggle('active');
    // Close mobile menu if open
    if (navLinks) navLinks.classList.remove('mobile-open');
    if (searchOverlay.classList.contains('open')) {
      document.getElementById('mobileSearchInput')?.focus();
    }
  });
}

// ---- MOBILE FLOATING CTA ----
const mobileCta = document.getElementById('mobileCta');
if (mobileCta) {
  let lastScrollY = window.scrollY;
  let fabVisible = false;

  function updateFab() {
    const scrollY = window.scrollY;
    const scrollingDown = scrollY > lastScrollY;

    if (scrollY > 200) {
      if (!fabVisible) {
        mobileCta.classList.add('visible');
        fabVisible = true;
      }
      if (scrollingDown) {
        mobileCta.classList.remove('position-top');
        mobileCta.classList.add('position-bottom');
      } else {
        mobileCta.classList.remove('position-bottom');
        mobileCta.classList.add('position-top');
      }
    } else {
      mobileCta.classList.remove('visible', 'position-top', 'position-bottom');
      fabVisible = false;
    }
    lastScrollY = scrollY;
  }

  window.addEventListener('scroll', updateFab, { passive: true });
}

// ---- INIT ----
renderSidebarLocations(LOCATIONS);
renderListCards(LOCATIONS);
initMap();
