# McRepair Homepage Design - CSS Class Mapping

This document details all CSS classes applied to the homepage components for the new McRepair design.

## 📋 Overview

All homepage sections now use the McRepair global design system defined in `client/src/mcrepair-global.css`.

---

## 🏠 Homepage Structure (Home.tsx)

### Navigation
```tsx
<header className="main-nav">
  <div className="nav-container">
    <Link to="/" className="nav-logo">
      <div className="nav-logo-img">...</div>
    </Link>
    
    <button className="mobile-menu-toggle">...</button>
    
    <nav className="nav-links">
      <a href="#services" className="nav-link">...</a>
    </nav>
    
    <div className="nav-actions">
      <div className="nav-cta">
        <Link className="btn-outline">Login</Link>
        <Link className="btn-primary">Get Started</Link>
      </div>
    </div>
  </div>
</header>
```

### Sections
```tsx
<section id="hero">...</section>
<section id="services" className="section">...</section>
<section id="devices" className="section">...</section>
<section id="shop" className="section">...</section>
<section id="features" className="section">...</section>
<section id="blog" className="section">...</section>
<section id="testimonials" className="section">...</section>
<section id="about" className="section">...</section>
<section id="contact" className="section">...</section>
```

### Footer
```tsx
<footer className="footer">
  <div className="footer-container">
    <div className="footer-grid">
      <div className="footer-col">
        <div className="footer-logo">
          <img className="footer-logo-img" />
          <span className="footer-logo-text">McRepair</span>
        </div>
        <p className="footer-tagline">...</p>
      </div>
      <div className="footer-col">
        <h3 className="footer-heading">...</h3>
        <ul className="footer-links">
          <li><a href="#">...</a></li>
        </ul>
      </div>
    </div>
    <div className="footer-bottom">
      <p>Copyright...</p>
    </div>
  </div>
</footer>
```

---

## 🦸 Hero Section (DeviceSelectionHero.tsx)

### Structure
```tsx
<section className="hero" style={{ backgroundImage: '...' }}>
  <div className="hero-layout">
    <div className="hero-text">
      <h1 className="hero-title">...</h1>
      <p className="hero-subtitle">...</p>
    </div>
    
    <Card className="configurator">
      <CardContent className="configurator-content">
        <!-- Device selection form -->
      </CardContent>
    </Card>
  </div>
  
  <div className="trust-row">
    <div className="trust-item">
      <div className="trust-icon">✓</div>
      <span>Free Diagnostics</span>
    </div>
  </div>
</section>
```

**Key Classes:**
- `.hero` - Main hero section with background overlay
- `.hero-layout` - Container for hero content
- `.hero-text` - Text content area
- `.hero-title` - Main headline
- `.hero-subtitle` - Subheadline
- `.configurator` - Device selection card
- `.trust-row` - Trust indicators container
- `.trust-item` - Individual trust badge
- `.trust-icon` - Icon wrapper

---

## 📝 Services Overview (ServicesOverview.tsx)

### Structure
```tsx
<section className="steps-section">
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title">How It Works</h2>
    </div>
    
    <div className="steps-grid">
      <div className="step-card">
        <div className="step-number">1</div>
        <div className="step-icon">
          <Smartphone />
        </div>
        <h3 className="step-title">Select Device</h3>
        <p className="step-description">...</p>
      </div>
    </div>
  </div>
</section>
```

**Key Classes:**
- `.steps-section` - Main steps section
- `.section-container` - Content container
- `.section-header` - Section header area
- `.section-title` - Section heading
- `.steps-grid` - Grid for step cards
- `.step-card` - Individual step card
- `.step-number` - Step number badge
- `.step-icon` - Icon container
- `.step-title` - Step title
- `.step-description` - Step description

---

## 📱 Devices Section (DevicesSection.tsx)

### Structure
```tsx
<section className="offers-section" style={{ backgroundImage: '...' }}>
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title text-white">Device Types</h2>
      <p className="section-subtitle text-gray-200">...</p>
    </div>
    
    <div className="offers-grid">
      <div className="offer-card">
        <div className="offer-icon">
          <Smartphone />
        </div>
        <h3 className="offer-title text-white">Smartphones</h3>
        <p className="offer-description text-gray-200">...</p>
      </div>
    </div>
  </div>
</section>
```

**Key Classes:**
- `.offers-section` - Main offers/devices section
- `.offers-grid` - Grid for offer cards
- `.offer-card` - Individual device/offer card
- `.offer-icon` - Icon container
- `.offer-title` - Card title
- `.offer-description` - Card description

---

## ✨ Features Section (FeaturesSection.tsx)

### Structure
```tsx
<section className="section bg-mcrepair-blue" style={{ backgroundImage: '...' }}>
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title text-white">Why Choose Us</h2>
      <p className="section-subtitle text-gray-200">...</p>
    </div>
    
    <div className="offers-grid">
      <div className="offer-card">
        <div className="offer-icon">
          <CheckCircle />
        </div>
        <h3 className="offer-title text-white">Quality Guarantee</h3>
        <p className="offer-description text-gray-200">...</p>
      </div>
    </div>
  </div>
</section>
```

**Uses same classes as Devices Section** (offers-grid, offer-card, etc.)

---

## 🛍️ Shop Section (ShopSection.tsx)

### Structure
```tsx
<section className="shop-section">
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title">Shop Products</h2>
      <p className="section-subtitle">Browse our selection</p>
    </div>
    
    <!-- Filters and product grid here -->
  </div>
</section>
```

**Key Classes:**
- `.shop-section` - Main shop section
- Product cards use standard shadcn Card component

---

## 📰 Blog Section (BlogCarousel.tsx)

### Structure
```tsx
<section className="blog-section">
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title">Latest Articles</h2>
    </div>
    
    <!-- Blog carousel here -->
  </div>
</section>
```

**Key Classes:**
- `.blog-section` - Main blog section
- Blog cards use standard shadcn Card component

---

## 👤 About Section (AboutUsSection.tsx)

### Structure
```tsx
<section id="about" className="section bg-white">
  <div className="section-container">
    <h2 className="section-title text-left">About Us</h2>
    
    <!-- Content grid here -->
  </div>
</section>
```

---

## 📞 Contact Section (ContactSection.tsx)

### Structure
```tsx
<section id="contact" className="section bg-gray-50">
  <div className="section-container">
    <div className="section-header">
      <h2 className="section-title">Contact Us</h2>
      <p className="section-subtitle">Get in touch</p>
    </div>
    
    <!-- Contact form and info here -->
  </div>
</section>
```

---

## 🍪 Cookie Banner (CookieBanner.tsx)

### Structure
```tsx
<div className="cookie-banner">
  <div className="cookie-content">
    <div className="cookie-text">
      <h3 className="cookie-title">We use cookies</h3>
      <p className="cookie-description">...</p>
    </div>
    
    <div className="cookie-actions">
      <Button className="cookie-btn-settings">Settings</Button>
      <Button className="cookie-btn-reject">Reject All</Button>
      <Button className="cookie-btn-accept">Accept All</Button>
    </div>
  </div>
  
  <div className="cookie-options">
    <!-- Settings panel -->
  </div>
</div>
```

**Key Classes:**
- `.cookie-banner` - Main banner container
- `.cookie-content` - Content wrapper
- `.cookie-text` - Text area
- `.cookie-title` - Banner title
- `.cookie-description` - Banner description
- `.cookie-actions` - Button container
- `.cookie-options` - Settings panel

---

## 🎨 Common Design Patterns

### Section Header Pattern
```tsx
<div className="section-header">
  <h2 className="section-title">Section Name</h2>
  <p className="section-subtitle">Description</p>
</div>
```

### Content Container Pattern
```tsx
<div className="section-container">
  <!-- Content here -->
</div>
```

### Button Patterns
```tsx
<button className="btn-primary">Primary Action</button>
<button className="btn-outline">Secondary Action</button>
<Link className="nav-link">Navigation Link</Link>
```

---

## 🎯 Tailwind Custom Classes

The following custom McRepair colors are available in Tailwind:

```tsx
bg-mcrepair-blue        // #1a2a5e
bg-mcrepair-blue-dark   // #141f47
bg-mcrepair-yellow      // #f5b800
bg-mcrepair-yellow-dark // #d9a400

text-mcrepair-blue
text-mcrepair-yellow
// etc.
```

---

## 📱 Responsive Behavior

All sections are fully responsive:
- **Mobile (<768px)**: Stacked layouts, hamburger menu
- **Tablet (768-1024px)**: 2-column grids
- **Desktop (>1024px)**: Full grid layouts, sticky navigation

---

## ✅ Interactive Features

The following interactive features are initialized by `mcrepair-interactions.ts`:

1. **Sticky Navigation** - Scrolls and changes appearance
2. **Mobile Menu** - Hamburger menu toggle
3. **Configurator** - Multi-step device selection
4. **Cookie Banner** - Consent management
5. **Smooth Scroll** - Anchor link scrolling
6. **Mobile CTA** - Floating action button

All features are auto-initialized when the page loads via `initMcRepair()` in `main.tsx`.

---

## 🚀 Testing the Design

To verify the design is working:

1. Start the development server: `npm run dev`
2. Navigate to the homepage
3. Check that:
   - Navigation is sticky and styled correctly
   - Hero section has background image and overlay
   - All sections use consistent spacing
   - Step cards display with numbers and icons
   - Offers/features have the yellow accent color
   - Footer has 4-column grid layout
   - Cookie banner appears at bottom
   - Mobile menu works on small screens

---

## 🔧 Customization

To customize the design:

1. **Colors**: Edit CSS variables in `mcrepair-global.css` (`:root` section)
2. **Spacing**: Modify section padding in `.section` class
3. **Fonts**: Update font family in `:root` or individual components
4. **Animations**: Adjust transition timing in class definitions
5. **Breakpoints**: Modify media queries at bottom of `mcrepair-global.css`

---

## 📚 File Reference

- **Main CSS**: `client/src/mcrepair-global.css`
- **Interactions**: `client/src/mcrepair-interactions.ts`
- **Homepage**: `client/src/pages/Home.tsx`
- **Components**: `client/src/components/home/*.tsx`
- **Cookie Banner**: `client/src/components/CookieBanner.tsx`
- **Tailwind Config**: `client/tailwind.config.js`
- **Entry Point**: `client/src/main.tsx`
