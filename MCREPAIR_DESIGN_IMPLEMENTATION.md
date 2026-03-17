# McRepair Global Design Implementation

## Übersicht

Das McRepair Homepage-Design wurde erfolgreich global implementiert. Das Design basiert auf einer ZOXS-inspirierten minimalen UX mit McRepair Corporate-Branding.

## Implementierte Dateien

### 1. **mcrepair-global.css** 
Pfad: `/client/src/mcrepair-global.css`

Enthält alle CSS-Styles für:
- **CSS-Variablen** für McRepair-Branding (Farben, Schatten, Radien)
- **Reset & Basis-Styles** für konsistentes Rendering
- **Sticky Navigation** mit Scroll-Effekten
- **Hero-Sektion** mit Animationen und Hintergrund
- **Repair-Konfigurator** (mehrstufiger Prozess)
- **Trust Row** (Vertrauenselemente)
- **Special Offers** (Angebotskarten)
- **Prozess-Schritte** ("So einfach geht's")
- **Webshop-Integration** (Produktkarten)
- **Blog-Sektion** (Blog-Karten)
- **Footer** mit Social Links
- **Cookie-Consent-Banner** mit Präferenzen
- **Mobile Floating CTA**
- **Responsive Design** (Desktop, Tablet, Mobile)

### 2. **mcrepair-interactions.ts**
Pfad: `/client/src/mcrepair-interactions.ts`

Enthält alle interaktiven JavaScript-Funktionen:
- Sticky Navigation mit Scroll-Effekten
- Mobile Menü Toggle
- Mobile Such-Overlay
- Repair-Konfigurator (mehrstufig)
- Mobile Floating CTA Button
- Cookie-Consent-Banner
- Autocomplete für Modell-Auswahl
- Smooth Scroll für Anchor-Links

### 3. **main.tsx** (aktualisiert)
Beide neue Dateien wurden in `main.tsx` importiert:
```tsx
import './mcrepair-global.css'
import { initMcRepair } from './mcrepair-interactions'
```

## CSS-Klassen-Referenz

### Navigation

```html
<!-- Top Bar -->
<div class="top-bar">
  <div class="container">
    <div class="top-bar-left">
      <a href="tel:...">☎ Hotline</a>
    </div>
    <div class="top-bar-right">
      <a href="#">Annahmestellen</a>
    </div>
  </div>
</div>

<!-- Main Navigation -->
<nav class="main-nav">
  <div class="nav-inner">
    <div class="nav-logo">
      <img src="logo.png" alt="Logo">
    </div>
    
    <div class="nav-links">
      <a href="#services">Services</a>
      <a href="#shop">Shop</a>
      <a href="#about">Über uns</a>
    </div>
    
    <div class="nav-right">
      <!-- Search -->
      <div class="nav-search">
        <input type="text" placeholder="Suchen...">
        <button><svg>...</svg></button>
      </div>
      
      <!-- CTA Button -->
      <a href="#" class="nav-cta">Jetzt starten</a>
      
      <!-- Cart -->
      <a href="#" class="nav-cart">
        <svg>...</svg>
        <span class="nav-cart-badge">3</span>
      </a>
      
      <!-- Mobile Menu Toggle -->
      <button class="nav-mobile-toggle">
        <svg>...</svg>
      </button>
    </div>
  </div>
</nav>
```

### Hero-Sektion

```html
<section class="hero">
  <div class="hero-bg"></div>
  
  <!-- Optional: Decorative woman figure -->
  <div class="hero-woman">
    <img src="woman.png" alt="">
  </div>
  
  <div class="hero-content">
    <div class="container">
      <div class="hero-layout">
        <!-- Left: Text -->
        <div class="hero-text">
          <div class="hero-badge">
            <svg>...</svg>
            <span>Schnell & Zuverlässig</span>
          </div>
          
          <h1 class="hero-title">
            Reparatur in <span>60 Minuten</span>
          </h1>
          
          <div class="hero-helpers">
            <div class="hero-helper-card">
              <h4>Abholung</h4>
              <p>Kostenlos in Ihrer Nähe</p>
            </div>
            <div class="hero-helper-card">
              <h4>Garantie</h4>
              <p>12 Monate auf alle Reparaturen</p>
            </div>
          </div>
        </div>
        
        <!-- Right: Configurator -->
        <div class="configurator">
          <!-- See Configurator section below -->
        </div>
      </div>
    </div>
  </div>
</section>
```

### Repair-Konfigurator

```html
<div class="configurator">
  <div class="configurator-header">
    <svg>...</svg>
    <h3>Reparatur konfigurieren</h3>
  </div>
  
  <div class="configurator-body">
    <!-- Step Indicators -->
    <div class="config-steps">
      <div class="config-step-indicator active">
        <span class="step-num">1</span>
        <span class="step-label">Gerät</span>
      </div>
      <div class="config-step-indicator">
        <span class="step-num">2</span>
        <span class="step-label">Modell</span>
      </div>
      <div class="config-step-indicator">
        <span class="step-num">3</span>
        <span class="step-label">Problem</span>
      </div>
      <div class="config-step-indicator">
        <span class="step-num">4</span>
        <span class="step-label">Extras</span>
      </div>
    </div>
    
    <!-- Step 1: Device Type -->
    <div class="config-step-content active">
      <div class="device-grid">
        <div class="device-card" data-device="smartphone">
          <svg>...</svg>
          <span>Smartphone</span>
        </div>
        <div class="device-card" data-device="tablet">
          <svg>...</svg>
          <span>Tablet</span>
        </div>
        <!-- More devices... -->
      </div>
    </div>
    
    <!-- Step 2: Brand & Model -->
    <div class="config-step-content">
      <div class="config-select-group">
        <div class="config-select-wrapper">
          <label>Marke</label>
          <select class="config-select" id="brand-select">
            <option>Apple</option>
            <option>Samsung</option>
          </select>
        </div>
        
        <div class="config-select-wrapper">
          <label>Modell</label>
          <select class="config-select" id="model-select">
            <option>iPhone 14 Pro</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Step 3: Repair Type -->
    <div class="config-step-content">
      <div class="repair-grid">
        <div class="repair-card" data-repair="display" data-price="89">
          <svg>...</svg>
          <div class="repair-info">
            <div class="repair-name">Display-Reparatur</div>
            <div class="repair-price">ab €89</div>
          </div>
        </div>
        <!-- More repairs... -->
      </div>
    </div>
    
    <!-- Step 4: Extras -->
    <div class="config-step-content">
      <div class="extras-grid">
        <label class="extras-option">
          <input type="checkbox" data-extra="express" data-price="15">
          <div class="extras-card">
            <div class="extras-icon"><svg>...</svg></div>
            <div class="extras-info">
              <span class="extras-name">Express-Service</span>
              <span class="extras-desc">Reparatur in 30 Min.</span>
            </div>
            <div class="extras-price">+€15</div>
          </div>
        </label>
        <!-- More extras... -->
      </div>
      
      <!-- Result -->
      <div class="config-result">
        <div class="config-result-grid">
          <div class="config-result-item">
            <span class="label">Preis</span>
            <span class="value">€89</span>
          </div>
          <div class="config-result-item">
            <span class="label">Dauer</span>
            <span class="value small">60 Min.</span>
          </div>
          <div class="config-result-item">
            <span class="label">Garantie</span>
            <span class="value small">12 Mon.</span>
          </div>
        </div>
        
        <button class="config-result-cta">
          <svg>...</svg>
          <span>Jetzt buchen</span>
        </button>
      </div>
    </div>
    
    <!-- Navigation Buttons -->
    <div class="config-nav">
      <button class="config-nav-btn back">Zurück</button>
      <button class="config-nav-btn next">Weiter</button>
    </div>
  </div>
</div>

<!-- Device Preview Panel (floating on desktop, inline on mobile) -->
<div class="device-preview-panel">
  <div class="device-preview-panel-inner">
    <div class="device-preview-panel-img">
      <img src="device.png" alt="">
    </div>
    <div class="device-preview-panel-body">
      <div class="device-preview-panel-model">iPhone 14 Pro</div>
      <div class="device-preview-panel-problems-title">
        <svg>...</svg>
        Gewählte Probleme
      </div>
      <ul class="device-preview-panel-list">
        <li>Display-Reparatur</li>
      </ul>
    </div>
  </div>
</div>
```

### Trust Row

```html
<section class="trust-row">
  <div class="container">
    <div class="trust-items">
      <div class="trust-item">
        <div class="trust-icon"><svg>...</svg></div>
        <div class="trust-text">
          <h4>Schnelle Reparatur</h4>
          <p>In 60 Minuten fertig</p>
        </div>
      </div>
      <!-- More trust items... -->
    </div>
  </div>
</section>
```

### Sections (Offers, Steps, Shop, Blog)

```html
<!-- Generic Section -->
<section class="section">
  <div class="container">
    <div class="section-title">
      <h2>Unsere Angebote</h2>
      <p>Die besten Deals für Sie</p>
      <div class="accent-line"></div>
    </div>
    
    <!-- Content here -->
  </div>
</section>

<!-- Alternate Background -->
<section class="section section-alt">
  <!-- Content -->
</section>

<!-- Compact Section -->
<section class="section section-compact">
  <!-- Content -->
</section>
```

### Offers Grid

```html
<div class="offers-grid">
  <div class="offer-card">
    <div class="offer-card-image">
      <svg>...</svg>
    </div>
    <div class="offer-card-content">
      <span class="offer-tag">Neu</span>
      <h3>Express-Reparatur</h3>
      <p>Ihr Gerät in 30 Minuten wieder einsatzbereit</p>
      <a href="#" class="offer-cta">
        Mehr erfahren
        <svg>...</svg>
      </a>
    </div>
  </div>
  <!-- More offers... -->
</div>
```

### Steps Grid

```html
<div class="steps-grid">
  <div class="step-card">
    <div class="step-number">1</div>
    <div class="step-icon"><svg>...</svg></div>
    <h4>Gerät auswählen</h4>
    <p>Wählen Sie Ihr Gerät und Problem</p>
  </div>
  <!-- 3 more steps... -->
</div>
```

### Shop Grid

```html
<div class="shop-grid">
  <div class="shop-card">
    <div class="shop-card-image">
      <span class="shop-badge">Sale</span>
      <svg>...</svg>
    </div>
    <div class="shop-card-body">
      <h4>iPhone 14 Display</h4>
      <div>
        <span class="shop-price">€89</span>
        <span class="shop-price-old">€129</span>
      </div>
    </div>
  </div>
  <!-- More products... -->
</div>
```

### Blog Grid

```html
<div class="blog-grid">
  <div class="blog-card">
    <div class="blog-card-image">
      <svg>...</svg>
    </div>
    <div class="blog-card-body">
      <span class="blog-category">Tipps</span>
      <h4>So pflegen Sie Ihr Smartphone</h4>
      <p>Die besten Tipps für eine lange Lebensdauer...</p>
      <div class="blog-date">25. Feb 2026</div>
    </div>
  </div>
  <!-- More blog posts... -->
</div>
```

### Footer

```html
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <h3>Mc<span>Repair</span></h3>
        <p>Ihr Spezialist für Handy-Reparaturen</p>
        
        <div class="footer-social">
          <a href="#"><svg>Facebook</svg></a>
          <a href="#"><svg>Instagram</svg></a>
          <a href="#"><svg>Twitter</svg></a>
        </div>
      </div>
      
      <div class="footer-col">
        <h4>Services</h4>
        <ul>
          <li><a href="#">Display-Reparatur</a></li>
          <li><a href="#">Akku-Wechsel</a></li>
          <li><a href="#">Wasserschaden</a></li>
        </ul>
      </div>
      
      <div class="footer-col">
        <h4>Unternehmen</h4>
        <ul>
          <li><a href="#">Über uns</a></li>
          <li><a href="#">Kontakt</a></li>
          <li><a href="#">Karriere</a></li>
        </ul>
      </div>
      
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#">Hilfe</a></li>
          <li><a href="#">Garantie</a></li>
          <li><a href="#">Datenschutz</a></li>
        </ul>
      </div>
    </div>
    
    <div class="footer-bottom">
      <p>© 2026 McRepair. Alle Rechte vorbehalten.</p>
      <div class="footer-bottom-links">
        <a href="#">Impressum</a>
        <a href="#">AGB</a>
        <a href="#">Datenschutz</a>
      </div>
    </div>
  </div>
</footer>
```

### Cookie-Consent-Banner

```html
<!-- Cookie Banner -->
<div class="cookie-banner">
  <div class="cookie-banner-backdrop"></div>
  <div class="cookie-banner-dialog">
    <div class="cookie-banner-header">
      <div class="cookie-banner-icon"><svg>...</svg></div>
      <div>
        <h3>Cookie-Einstellungen</h3>
        <div class="cookie-banner-subtitle">Ihre Privatsphäre ist uns wichtig</div>
      </div>
    </div>
    
    <p class="cookie-banner-text">
      Wir verwenden Cookies, um Ihr Erlebnis zu verbessern...
    </p>
    
    <div class="cookie-options">
      <label class="cookie-option">
        <input type="checkbox" id="cookie-necessary" checked disabled>
        <div class="cookie-option-info">
          <span class="cookie-option-name">Notwendig</span>
          <span class="cookie-option-desc">Erforderlich für die Basisfunktionen</span>
        </div>
        <span class="cookie-option-badge required">Erforderlich</span>
      </label>
      
      <label class="cookie-option">
        <input type="checkbox" id="cookie-functional">
        <div class="cookie-option-info">
          <span class="cookie-option-name">Funktional</span>
          <span class="cookie-option-desc">Für erweiterte Funktionen</span>
        </div>
      </label>
      
      <label class="cookie-option">
        <input type="checkbox" id="cookie-analytics">
        <div class="cookie-option-info">
          <span class="cookie-option-name">Analyse</span>
          <span class="cookie-option-desc">Hilft uns die Seite zu verbessern</span>
        </div>
      </label>
      
      <label class="cookie-option">
        <input type="checkbox" id="cookie-marketing">
        <div class="cookie-option-info">
          <span class="cookie-option-name">Marketing</span>
          <span class="cookie-option-desc">Für personalisierte Werbung</span>
        </div>
      </label>
    </div>
    
    <div class="cookie-banner-actions">
      <button class="cookie-btn-accept">Alle akzeptieren</button>
      <button class="cookie-btn-save">Auswahl speichern</button>
      <button class="cookie-btn-reject">Ablehnen</button>
    </div>
    
    <div class="cookie-banner-footer">
      <a href="#">Datenschutzerklärung</a>
      <a href="#">Impressum</a>
    </div>
  </div>
</div>

<!-- Cookie FAB (appears after consent) -->
<button class="cookie-fab">
  <svg>Cookie Icon</svg>
</button>
```

### Mobile Floating CTA

```html
<button class="mobile-cta-fab">
  <svg>...</svg>
  <span>Jetzt buchen</span>
</button>
```

## CSS-Variablen (Anpassbar)

Alle Farben und Design-Werte sind als CSS-Variablen definiert und können einfach angepasst werden:

```css
:root {
  /* Farben */
  --primary-blue: #1a2a5e;
  --primary-blue-dark: #0f1d45;
  --primary-blue-light: #2a3f7e;
  --accent-yellow: #f5b800;
  --accent-yellow-hover: #e5ab00;
  
  /* Graustufen */
  --gray-50: #f5f6f8;
  --gray-100: #eceef3;
  --gray-200: #d8dce6;
  --gray-300: #b0b8c9;
  --gray-400: #8892a8;
  --gray-500: #636e85;
  --gray-600: #4a5568;
  --gray-700: #2d3748;
  --gray-800: #1a202c;
  
  /* Schatten */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.15);
  
  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  
  /* Andere */
  --max-width: 1200px;
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## JavaScript-Funktionen

### Manuelle Initialisierung einzelner Funktionen

```javascript
import {
  initStickyNav,
  initMobileMenu,
  initMobileSearch,
  initConfigurator,
  initMobileCTA,
  initCookieBanner,
  initAutocomplete,
  initSmoothScroll
} from './mcrepair-interactions';

// Einzeln initialisieren
initStickyNav();
initMobileMenu();
initConfigurator();

// Autocomplete mit eigenen Daten
initAutocomplete('#model-select', [
  'iPhone 14 Pro',
  'iPhone 14',
  'iPhone 13 Pro',
  'Samsung Galaxy S23'
]);
```

### Alle Funktionen initialisieren

```javascript
import { initMcRepair } from './mcrepair-interactions';

initMcRepair(); // Initialisiert alle Funktionen automatisch
```

## Responsive Breakpoints

- **Desktop**: > 1024px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px
- **Small Mobile**: < 480px

## Browser-Kompatibilität

Das Design wurde für moderne Browser optimiert:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Anpassungen

### Farben ändern

Passen Sie die CSS-Variablen in `mcrepair-global.css` an:

```css
:root {
  --primary-blue: #YourColor;
  --accent-yellow: #YourAccent;
}
```

### Logo ersetzen

Ersetzen Sie die Logo-Bilder in den entsprechenden `<img>`-Tags:

```html
<img src="/path/to/your/logo.png" alt="Logo">
```

### Inhalte aktualisieren

Alle Texte können direkt im HTML bearbeitet werden. Für mehrsprachige Unterstützung nutzen Sie das i18n-System der Anwendung.

## Performance-Optimierungen

- **CSS-Minifizierung**: In Production-Build automatisch
- **Lazy Loading**: Bilder werden verzögert geladen
- **CSS-Variablen**: Ermöglichen schnelle Theme-Wechsel
- **Hardware-Beschleunigung**: Transformations nutzen GPU

## Bekannte Einschränkungen

1. **Tailwind CSS**: Das Design koexistiert mit Tailwind. Bei Konflikten hat `mcrepair-global.css` Vorrang (wird nach `index.css` geladen).
2. **React-Komponenten**: Einige React-spezifische Klassen können überschrieben werden.

## Support & Wartung

Für Fragen oder Probleme:
1. Überprüfen Sie die Browser-Konsole auf Fehler
2. Stellen Sie sicher, dass alle Dateien korrekt importiert sind
3. Testen Sie in verschiedenen Browsern und Geräten

## Nächste Schritte

1. **Anpassen der Inhalte**: Ersetzen Sie Platzhalter-Texte und -Bilder
2. **Testen**: Überprüfen Sie alle interaktiven Elemente
3. **Optimieren**: Passen Sie Farben und Abstände an Ihre Marke an
4. **Erweitern**: Fügen Sie weitere Sektionen nach Bedarf hinzu

## Changelog

**Version 1.0.0** (25. Feb 2026)
- Initiale Implementierung des McRepair-Designs
- Vollständige responsive Unterstützung
- Alle interaktiven Funktionen implementiert
- Cookie-Consent-System integriert
- Mobile-First Ansatz
