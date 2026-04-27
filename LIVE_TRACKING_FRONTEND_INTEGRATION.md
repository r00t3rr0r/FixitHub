# Live-Tracking Frontend-Integration

## Admin-Route hinzufügen

Damit die Live-Tracking-Seite im Admin-Bereich verfügbar ist, muss die Route im Frontend-Router registriert werden.

### Beispiel (React Router v6):

In deiner Admin-Route-Datei (z.B. `src/App.tsx` oder `src/routes.tsx`):

```tsx
import TrackingLive from './pages/admin/TrackingLive';

// In deinen Admin-Routes:
<Route path="/admin">
  <Route path="live-tracking" element={<TrackingLive />} />
  {/* ... andere Admin-Routes */}
</Route>
```

### Beispiel für Navigation im Admin-Menü:

```tsx
<nav>
  <Link to="/admin/dashboard">Dashboard</Link>
  <Link to="/admin/live-tracking">Live Tracking</Link>
  <Link to="/admin/orders">Orders</Link>
  {/* ... */}
</nav>
```

## Automatisches Page-View-Tracking aktivieren

### Option 1: Global in App.tsx

```tsx
import { useTracking } from './hooks/useTracking';

function App() {
  useTracking(); // Aktiviert page_view tracking global
  
  return (
    <Router>
      {/* ... */}
    </Router>
  );
}
```

### Option 2: In jeder Route/Seite einzeln

```tsx
import { useTracking } from '../hooks/useTracking';

export default function ProductPage() {
  useTracking(); // Sendet page_view für diese Seite
  
  return <div>...</div>;
}
```

### Option 3: Router-basiertes Tracking

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { autoTrackPageView } from './api/tracking';

function AppTracker() {
  const location = useLocation();
  
  useEffect(() => {
    autoTrackPageView();
  }, [location.pathname]);
  
  return null;
}

// In App.tsx:
<Router>
  <AppTracker />
  {/* ... */}
</Router>
```

## Conversion-Tracking einbinden

Beispiel nach erfolgreicher Bestellung:

```tsx
import { trackEvent } from '../api/tracking';

const handleCheckout = async (orderData) => {
  // ... Bestellung abschließen
  
  trackEvent('conversion', {
    custom_data: {
      order_id: orderData.id,
      value: orderData.total,
      currency: 'EUR',
      items: orderData.items.length
    }
  });
};
```

## Error-Tracking einbinden

```tsx
import { trackEvent } from '../api/tracking';

// In Error Boundary oder catch-Block:
try {
  // ... Code
} catch (error) {
  trackEvent('error', {
    custom_data: {
      error_message: error.message,
      error_stack: error.stack,
      component: 'CheckoutForm'
    }
  });
  
  // ... Error handling
}
```

## Click-Tracking für wichtige Buttons

```tsx
import { trackEvent } from '../api/tracking';

<button
  onClick={() => {
    trackEvent('click', {
      custom_data: {
        button: 'cta-main',
        location: 'homepage-hero'
      }
    });
    // ... Button action
  }}
>
  Jetzt kaufen
</button>
```

## Demo-Komponente testen

Füge die Demo-Komponente temporär in eine Admin-Seite ein:

```tsx
import TrackingDemo from '../components/TrackingDemo';

export default function AdminPage() {
  return (
    <div>
      <h1>Admin</h1>
      <TrackingDemo />
    </div>
  );
}
```

## Fehlerbehebung

### Events werden nicht gesendet
- Prüfe Browser-Konsole auf JavaScript-Fehler
- Prüfe Network-Tab: POST /api/track sollte erfolgreich sein
- Prüfe ob `navigator.sendBeacon` unterstützt wird (sonst Fallback auf fetch)

### Session-ID/Visitor-ID fehlen
- Prüfe localStorage: `localStorage.getItem('tracking_session_id')`
- Cookies müssen aktiviert sein für localStorage
- Bei Third-Party-Cookie-Blockierung funktioniert es trotzdem (First-Party)

### CORS-Fehler
- Stelle sicher, dass Backend CORS korrekt konfiguriert ist
- Bei separaten Domains: CORS Headers müssen `/api/track` erlauben
