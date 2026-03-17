# McRepair Design System – Comprehensive Implementation Prompt

> **Bu doküman, McRepair web sitesinin tasarım sistemini başka bir web sitesine uygulamak isteyen bir AI agent'a verilmek üzere hazırlanmıştır.**
>
> This document describes the complete design system, layout structure, component hierarchy, color system, typography, spacing, animations, responsive breakpoints, and interaction patterns of the McRepair.de frontend demo. Use it as a blueprint to implement the same design on another website.

---

## 1. TECH STACK & DEPENDENCIES

- **HTML5** semantic markup (no framework)
- **CSS3** with CSS Custom Properties (variables), Flexbox, CSS Grid
- **Vanilla JavaScript** (ES6+, no jQuery, no framework)
- **Google Fonts**: `Inter` – weights: 400, 500, 600, 700, 800, 900
- **Leaflet.js 1.9.4** (CDN) – for interactive maps only
- **Map Tiles**: CartoDB Voyager (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`)
- **Icons**: All icons are inline SVGs (no icon library dependency)
- **Images**: PNG format with transparent backgrounds for device mockups

### CDN Links
```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

<!-- Leaflet.js (only for map pages) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

---

## 2. DESIGN TOKENS (CSS Custom Properties)

All design tokens are defined in `:root` and used consistently throughout. **These are the single source of truth for the entire design.**

```css
:root {
  /* Brand Colors */
  --primary-blue: #1a2a5e;          /* Main brand color – nav, headings, buttons */
  --primary-blue-dark: #0f1d45;     /* Footer bg, hero gradient dark end */
  --primary-blue-light: #2a3f7e;    /* Hero gradient light end, hover states */
  --accent-yellow: #f5b800;         /* CTA buttons, badges, accents */
  --accent-yellow-hover: #e5ab00;   /* CTA hover state */
  --accent-yellow-light: #ffd54f;   /* Decorative use */

  /* Neutrals */
  --white: #ffffff;
  --off-white: #f8f9fc;             /* Alternating section backgrounds */
  --gray-50: #f5f6f8;               /* Card backgrounds, hover states */
  --gray-100: #eceef3;              /* Borders, dividers */
  --gray-200: #d8dce6;              /* Input borders, connector lines */
  --gray-300: #b0b8c9;              /* Muted icons */
  --gray-400: #8892a8;              /* Subtitles, descriptions */
  --gray-500: #636e85;              /* Body text secondary */
  --gray-600: #4a5568;              /* Body text */
  --gray-700: #2d3748;              /* Primary body text */
  --gray-800: #1a202c;              /* Headings, strong text */

  /* Semantic Colors */
  --success: #38a169;               /* Completed steps, required badges */
  --danger: #e53e3e;                /* Map pins default, closed labels */

  /* Shadows (4-level elevation system) */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.15);

  /* Border Radius (4-level system) */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Transitions */
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  --font-main: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Layout */
  --max-width: 1200px;
}
```

---

## 3. GLOBAL RESET & BASE STYLES

```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; font-size: 16px; overflow-x: hidden; }
body {
  font-family: var(--font-main);
  color: var(--gray-700);
  background: var(--white);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  overscroll-behavior-x: none;
}
a { text-decoration: none; color: inherit; transition: var(--transition); }
button { cursor: pointer; border: none; outline: none; font-family: inherit; transition: var(--transition); }
.container { max-width: var(--max-width); margin: 0 auto; padding: 0 24px; }
```

---

## 4. PAGE STRUCTURE & COMPONENT HIERARCHY

### 4.1 Homepage (`index.html`)

```
<body>
├── .top-bar                          (Info bar: Hotline, Annahmestellen, Anmelden)
├── nav.main-nav#mainNav              (Sticky navigation)
│   ├── .nav-inner
│   │   ├── .nav-logo                 (Brand text logo: "Mc<span>Repair</span>.de")
│   │   ├── .nav-links#navLinks       (Desktop nav links + .nav-mobile-extras)
│   │   └── .nav-right                (Search, CTA button, Cart, Mobile toggle)
│   └── .nav-search-overlay           (Mobile search overlay)
├── section.hero#hero                 (Full-viewport hero section)
│   ├── .hero-bg                      (Gradient overlay)
│   ├── .hero-decoration              (Decorative circles)
│   ├── .hero-woman                   (Background woman image, opacity 0.25)
│   └── .hero-content.container
│       └── .hero-layout              (CSS Grid: 1fr 1fr)
│           ├── .hero-text            (Badge + H1 + Helper cards)
│           └── .configurator         (5-step repair configurator wizard)
│               └── .device-preview-panel (Floating side panel on desktop)
├── section.trust-row                 (4-column trust icons strip)
├── section.section.section-alt       (Special Offers – 2-col grid)
├── section.section#process           (4-step process – icons with connector line)
├── section.section.section-alt#shop  (Webshop – 4-col product grid)
├── section.section#blog              (Blog – 3-col card grid)
├── footer.footer                     (4-col footer + payment icons + bottom links)
├── button.mobile-cta-fab             (Mobile floating CTA – scroll-direction aware)
├── .cookie-banner                    (Cookie consent modal with backdrop)
└── button.cookie-fab                 (Cookie settings FAB)
```

### 4.2 Annahmestellen Page (`annahmestellen.html`)

```
<body>
├── .top-bar                          (Same as homepage, "Annahmestellen" link marked .active)
├── nav.main-nav#mainNav              (Same sticky nav as homepage)
├── section.as-breadcrumb             (Home > McRepair Annahmestellen)
├── section.as-header                 (Page title + subtitle)
├── section.as-search                 (Search input + button + filter tags)
├── section.as-tabs-section           (Map/List toggle tabs)
├── section.as-map-view.as-view       (Map tab content)
│   └── .as-map-layout                (CSS Grid: 1fr 340px)
│       ├── .as-map-container         (Leaflet map with custom pins)
│       └── .as-map-sidebar           (Scrollable location list)
├── section.as-list-view.as-view      (List tab content)
│   └── .as-list-grid                 (4-col card grid)
├── section.as-info                   (3-col info cards)
├── footer.footer                     (Same footer as homepage)
├── button.mobile-cta-fab             (Mobile floating CTA)
└── <script src="js/annahmestellen.js">
```

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 Top Bar
- **Background**: white, border-bottom 1px solid gray-100
- **Padding**: 6px 0
- **Font size**: 0.8rem, color gray-500
- **Layout**: Flexbox, space-between
- **Left side**: Hotline link (phone icon + number), Annahmestellen link (map pin icon)
- **Right side**: Anmelden link (user icon)
- **Hover**: color changes to primary-blue
- **Mobile (≤768px)**: `display: none` – links move into hamburger menu as `.nav-mobile-extras`

### 5.2 Main Navigation (Sticky)
- **Background**: primary-blue (#1a2a5e)
- **Position**: sticky, top: 0, z-index: 1000
- **Height**: 64px (desktop), 56px (mobile)
- **Logo**: Text-based "Mc<span>Repair</span>.de" – white + yellow accent, font-weight: 800
- **Nav links**: rgba(255,255,255,0.85), font-size: 0.88rem, with inline SVG icons
- **Search**: Pill-shaped input (border-radius: 50px), background rgba(255,255,255,0.12)
- **CTA Button**: Yellow pill button ("Reparatur buchen"), font-weight: 700
- **Cart**: Icon with badge (yellow circle, 16px)
- **Scroll effect**: `.scrolled` class adds box-shadow: 0 2px 20px rgba(0,0,0,0.2)
- **Mobile menu**: Slides down from nav, full-width, includes `.nav-mobile-extras` with top-bar links
- **Mobile search**: Overlay slides down from nav bottom, auto-focuses input

### 5.3 Hero Section
- **Min-height**: 85vh (desktop), auto on mobile
- **Background**: Linear gradient 135deg from primary-blue-dark → primary-blue → primary-blue-light
- **Decorative elements**: Two large circles (600px, 400px) with rgba(245, 184, 0, 0.05)
- **Hero woman**: Absolute positioned, opacity 0.25, decorative only
- **Layout**: CSS Grid 2 columns (1fr 1fr) → single column on tablet/mobile
- **Hero badge**: Pill-shaped, yellow tinted background, star icon
- **Hero title**: 2.8rem → 2.2rem (tablet) → 1.8rem (mobile) → 1.5rem (small mobile)
- **Helper cards**: Glass-morphism style cards (rgba bg, border, hover lift)

### 5.4 Repair Configurator (Primary Conversion Element)
- **Position**: Right column of hero grid
- **Background**: White card with shadow-xl, border-radius: 16px
- **Header**: Primary-blue background, tool icon + title
- **5-step wizard**:
  1. Device Type (4-col grid of icon cards)
  2. Brand & Model (Select + autocomplete dropdown)
  3. Repair Type (2-col grid of repair cards)
  4. Extras (Checkbox cards with pricing)
  5. Result (Dark gradient card with price + CTA)
- **Step indicators**: Circular numbered badges with connector lines
  - Active: yellow background
  - Completed: green background with checkmark
- **Device Preview Panel**: Floats to the LEFT of configurator on desktop (absolute positioned), converts to inline accordion on tablet/mobile
- **Animations**: fadeInUp on step transitions

### 5.5 Trust Row
- **4-column grid** with icon + text pairs
- **Icons**: 48x48px, yellow-tinted background (rgba(245, 184, 0, 0.1)), rounded corners
- **Mobile**: Single column

### 5.6 Section Pattern
- **Padding**: 64px 0 (desktop), 48px 0 (mobile)
- **Alternating backgrounds**: white ↔ off-white (`.section-alt`)
- **Section title**: Centered, h2 (1.6rem, weight 800) + subtitle + yellow accent line (48x3px)

### 5.7 Cards (Universal Pattern)
All cards share:
- White background, 1px border gray-100
- Border-radius: radius-md (10px)
- Hover: shadow-md + translateY(-3px) + border darkens
- Transition: var(--transition)

### 5.8 Footer
- **Background**: primary-blue-dark
- **Grid**: 4 columns (1.5fr 1fr 1fr 1fr) → 2 cols (tablet) → 1 col (mobile)
- **Social icons**: 36x36px squares, rgba bg, hover turns yellow
- **Payment icons**: Text labels (VISA, PayPal, etc.) in uppercase, opacity 0.35
- **Bottom**: Copyright + legal links, centered on mobile

### 5.9 Mobile Floating CTA (FAB)
- **Visible**: Only on ≤768px screens
- **Behavior**: Scroll-direction aware
  - Scrolling DOWN → bottom-right (larger, pill-shaped)
  - Scrolling UP → top-right (smaller, compact)
  - Near top of page (< 120px) → hidden
- **Style**: Yellow pill button with tool icon
- **Animation**: Scale + translate with spring cubic-bezier

### 5.10 Cookie Consent Banner
- **Full-screen modal** with backdrop blur
- **Dialog**: Max-width 540px, white, rounded corners, yellow top border
- **Toggle switches**: Custom iOS-style checkboxes (38x22px toggle pill)
- **3 actions**: "Alle akzeptieren" (yellow), "Auswahl speichern" (blue), "Nur notwendige" (text)
- **Storage**: sessionStorage with 5-minute TTL
- **Cookie FAB**: Small round button, bottom-left, shows after consent
- **IMPORTANT FIX**: `.cookie-banner` uses `pointer-events: none` when hidden, `pointer-events: auto` when visible, to prevent blocking the cookie FAB button

### 5.11 Interactive Map (Annahmestellen)
- **Library**: Leaflet.js 1.9.4
- **Tiles**: CartoDB Voyager (clean, modern look)
- **Map center**: [51.1657, 10.4515] (Germany center), zoom: 6
- **Custom pins**: SVG divIcon markers with letter labels (A, B, C...)
  - Default color: danger red (#e53e3e)
  - Active color: primary-blue (#1a2a5e)
  - Drop animation on appearance (keyframe translateY + scale)
  - Hover on desktop only (`@media (hover: hover) and (pointer: fine)`)
  - Larger tap targets on mobile
- **Popups**: Styled to match brand (rounded corners, blue header marker, contact info)
- **Sidebar**: Syncs with map – clicking sidebar flies to location, clicking pin highlights sidebar item
- **CRITICAL CSS RULE**: `.as-leaflet-pin` must NOT have CSS transforms/animations (Leaflet uses inline transform for positioning). All visual animations go on `.as-pin-wrapper` inside it.

---

## 6. TYPOGRAPHY SCALE

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Hero title | 2.8rem | 800 | white + yellow accent |
| Section h2 | 1.6rem | 800 | gray-800 |
| Card h3/h4 | 0.95-1.05rem | 700 | gray-800 |
| Body text | 0.82-0.95rem | 400-500 | gray-500 to gray-700 |
| Labels/Tags | 0.7-0.8rem | 600-700 | varies |
| Small text | 0.65-0.75rem | 500-600 | gray-400 |
| Nav links | 0.88rem | 500 | white (rgba 0.85) |
| CTA buttons | 0.85-1rem | 700-800 | primary-blue on yellow bg |

---

## 7. RESPONSIVE BREAKPOINTS

| Breakpoint | Target | Key Changes |
|-----------|--------|-------------|
| ≤1024px | Tablet | Hero goes single-column, device preview inline, grids reduce columns |
| ≤768px | Mobile | Top bar hidden, hamburger menu appears, nav-mobile-extras shown, single-column layouts, mobile FAB appears |
| ≤480px | Small mobile | Further size reductions, CTA text hidden (icon only in nav), smaller configurator padding |

### Mobile-Specific Features:
1. **Hamburger menu** with nav-mobile-extras (Hotline, Annahmestellen, Anmelden)
2. **Mobile search overlay** (slides down from nav)
3. **Floating CTA pill button** (scroll-direction aware position)
4. **Cookie banner**: Full-width bottom sheet on mobile
5. **Map**: Stacked layout (map on top, sidebar below)
6. **Touch-friendly pins**: No hover effects on touch devices, larger tap targets

---

## 8. ANIMATION PATTERNS

### Used Consistently:
1. **fadeInUp**: `opacity 0→1, translateY(10-20px→0)` – for step transitions, section reveals
2. **Scale + translate hover**: `translateY(-2px to -3px)` with `shadow-md` – for all card hovers
3. **Pin drop**: `translateY(-30px) scale(0.4) → translateY(0) scale(1)` with spring bezier
4. **Spring bezier**: `cubic-bezier(0.34, 1.56, 0.64, 1)` – for bouncy animations
5. **Smooth bezier**: `cubic-bezier(0.4, 0, 0.2, 1)` – for standard transitions
6. **Intersection Observer**: Sections fade in as they enter viewport (threshold 0.1)
7. **Staggered delays**: List items animate with incremental delays (0.05s each)

---

## 9. INTERACTION PATTERNS

### Configurator:
- Click device → card gets selected border → auto-advance to step 2 (300ms delay)
- Brand select → model autocomplete dropdown
- Click repair → auto-advance to step 4
- Step indicators: numbered circles with connector lines

### Map:
- Click sidebar item → map.flyTo(location, zoom:12, duration:0.8) → openPopup after 850ms
- Click pin → activate pin (color change) → highlight sidebar (scroll into view)
- Search: 300ms debounce → re-render pins, sidebar, list simultaneously
- Tab switch: invalidateSize() after 150ms for Leaflet container recalculation

### Navigation:
- Scroll > 10px → `.scrolled` class (shadow appears)
- Mobile toggle → `.mobile-open` class on nav-links
- Nav link click → close mobile menu

### Cookie:
- Show after 800ms delay on page load
- Accept → save to sessionStorage → hide banner → show FAB after 400ms
- FAB click → restore checkbox states from storage → reopen banner
- Auto-expire after 5 minutes (sessionStorage)

---

## 10. SVG ICON SYSTEM

All icons are inline SVGs with consistent attributes:
```html
<svg width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <!-- paths -->
</svg>
```
- Nav icons: 16x16
- Trust icons: 22x22
- Step icons: 32x32
- Info icons: 28x28
- Small inline icons: 14x14

The project does NOT use any icon font or sprite – every icon is embedded directly in the HTML.

---

## 11. KEY CSS TECHNIQUES

1. **CSS Grid** for all major layouts (hero 2-col, trust 4-col, shop 4-col, footer 4-col)
2. **Flexbox** for component-level alignment (nav, cards, sidebar items)
3. **CSS Custom Properties** for theming – change `:root` variables to rebrand
4. **`overflow: clip`** instead of `overflow: hidden` on hero (prevents scroll issues)
5. **`position: sticky`** for nav with z-index: 1000
6. **`inset: 0`** shorthand for fixed/absolute elements
7. **`appearance: none`** for custom select dropdown arrows (SVG data-URI background)
8. **`@media (hover: hover) and (pointer: fine)`** to gate hover effects away from touch
9. **`pointer-events: none/auto`** on cookie-banner to prevent invisible overlays blocking clicks
10. **`backdrop-filter: blur(4px)`** on cookie banner backdrop

---

## 12. FILE STRUCTURE

```
project/
├── index.html                  # Homepage
├── annahmestellen.html         # Partner locations page
├── css/
│   ├── style.css               # Shared styles + homepage-specific styles
│   └── annahmestellen.css      # Annahmestellen page-specific styles
├── js/
│   ├── main.js                 # Homepage JS (configurator, nav, cookie, mobile CTA)
│   └── annahmestellen.js       # Map page JS (Leaflet, locations, search, tabs)
└── images/
    ├── hero-woman-noBG.png     # Hero background woman (transparent)
    ├── smartphone_mu.png       # Device preview: smartphone
    ├── tablet_mu.png           # Device preview: tablet
    ├── notebook_mu.png         # Device preview: notebook
    └── console_mu.png          # Device preview: console
```

---

## 13. IMPLEMENTATION NOTES FOR AI AGENT

### When applying this design to the real website:

1. **Start with CSS variables**: Copy the `:root` block first, then adjust brand colors if needed
2. **Navigation is shared**: Both pages use the same top-bar + main-nav. Keep them identical
3. **Footer is shared**: Same footer structure on all pages
4. **Mobile menu**: The `.nav-mobile-extras` div must be INSIDE `.nav-links` (the mobile menu container). The top-bar items are duplicated here because `.top-bar { display: none }` on mobile
5. **Cookie banner z-index**: Must use `pointer-events: none` when hidden to avoid blocking lower z-index elements
6. **Leaflet pin positioning**: NEVER apply CSS transforms or animations to `.as-leaflet-pin` (Leaflet's icon container) – it uses inline `transform: translate3d()` for positioning. Apply all visual effects to an inner wrapper element
7. **Mobile FAB**: Uses `position: fixed` and toggles between top-right and bottom-right based on scroll direction. The `requestAnimationFrame` throttle prevents janky scroll performance
8. **Autocomplete**: The model input uses a custom dropdown (`.autocomplete-dropdown`) that closes on outside click via document-level event listener
9. **Section alternation**: Use `.section-alt` class for `background: var(--off-white)` on alternating sections
10. **All icons are inline SVG**: No external icon library. Copy the SVG code directly

### Common Pitfalls:
- Mobile menu toggle class is `'mobile-open'`, not `'open'`
- Map `invalidateSize()` must be called after container becomes visible (tab switch)
- `fitBounds` needs `maxZoom: 7` to show all of Germany without zooming in too much
- Cookie banner's `inset: 0` creates a full-screen element that blocks clicks even when invisible
- Device preview panel arrow (`::after` pseudo-element) only appears on desktop

---

## 14. COLOR USAGE GUIDE

| Context | Color | CSS Variable |
|---------|-------|-------------|
| Navigation background | Dark blue | `--primary-blue` |
| Footer background | Darker blue | `--primary-blue-dark` |
| CTA buttons | Yellow | `--accent-yellow` |
| CTA hover | Darker yellow | `--accent-yellow-hover` |
| Headings | Near black | `--gray-800` |
| Body text | Dark gray | `--gray-700` |
| Secondary text | Medium gray | `--gray-500` |
| Captions/labels | Light gray | `--gray-400` |
| Borders | Light | `--gray-100` to `--gray-200` |
| Input borders | Medium light | `--gray-200` |
| Input focus | Yellow glow | `--accent-yellow` with 0.15 opacity shadow |
| Success indicators | Green | `--success` |
| Map pins (default) | Red | `--danger` |
| Map pins (active) | Blue | `--primary-blue` |
| Alt section bg | Off-white | `--off-white` |
| Card hover bg | Very light gray | `--gray-50` |

---

*This design system was extracted from a working McRepair.de frontend demo. All measurements, colors, animations, and patterns are production-tested and responsive across all device sizes.*
