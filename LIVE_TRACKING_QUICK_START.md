# Live-Tracking System - Quick Start Guide

## ✅ Was wurde erstellt?

### Backend (Server)
- ✅ MongoDB Model: `server/models/TrackingEvent.js`
- ✅ Service Layer: `server/services/trackingService.js`
- ✅ Public API: `server/routes/tracking.js` (POST /api/track)
- ✅ Admin API: `server/routes/adminLiveTrackingRoutes.js` (9 Endpoints)
- ✅ Server Integration: Routes in `server.js` registriert
- ✅ Performance-Indexe für MongoDB
- ✅ IP-Hashing & User-Agent-Parsing

### Frontend (Client)
- ✅ Public Tracking API: `client/src/api/tracking.ts`
- ✅ Admin Live API: `client/src/api/liveTracking.ts`
- ✅ React Hook: `client/src/hooks/useTracking.ts`
- ✅ Demo Component: `client/src/components/TrackingDemo.tsx`
- ✅ Admin Page: `client/src/pages/admin/TrackingLive.tsx`

### Dokumentation
- ✅ Vollständige Doku: `LIVE_TRACKING_DOCUMENTATION.md`
- ✅ Frontend-Integration: `LIVE_TRACKING_FRONTEND_INTEGRATION.md`
- ✅ Setup-Script: `setup-live-tracking.sh`

## 🚀 Nächste Schritte

### 1. Environment Variable prüfen
```bash
grep TRACKING_SALT .env
```
Falls nicht vorhanden:
```bash
echo "TRACKING_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
```

### 2. Server neu starten
```bash
npm start
```

### 3. Frontend-Route registrieren

In deinem Frontend-Router (z.B. `client/src/App.tsx`):

```tsx
import TrackingLive from './pages/admin/TrackingLive';

// In Admin-Routes:
<Route path="/admin/live-tracking" element={<TrackingLive />} />
```

### 4. Automatisches Tracking aktivieren

**Option A: Global in App.tsx**
```tsx
import { useTracking } from './hooks/useTracking';

function App() {
  useTracking(); // Aktiviert page_view tracking
  return <Router>{/* ... */}</Router>;
}
```

**Option B: Router-basiert**
```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { autoTrackPageView } from './api/tracking';

function AppTracker() {
  const location = useLocation();
  useEffect(() => autoTrackPageView(), [location.pathname]);
  return null;
}

// In App:
<Router>
  <AppTracker />
  {/* ... */}
</Router>
```

### 5. Admin-Seite aufrufen
```
http://localhost:5173/admin/live-tracking
```
(Benötigt Admin/Staff-Login)

## 📊 Features

### KPI-Dashboard
- Aktive Besucher (5m & 30m)
- Seitenaufrufe
- Neue Sessions
- Conversions
- Fehler

### Live-Monitoring
- Aktive Sessions-Tabelle mit Details
- Event-Feed (Echtzeit)
- Top Pages, Referrer, Browser, Devices, Countries
- Session-Detailansicht mit Event-Timeline
- Auto-Refresh (10s Summary, 15s Breakdowns, 5s Events)

### Tracking-Events
- `page_view` - Automatisch bei Seitenaufruf
- `click` - Manuell für Button-Tracking
- `form_submit` - Manuell für Formular-Tracking
- `conversion` - Manuell für Conversions
- `error` - Optional für Error-Tracking

## 🔒 Datenschutz

✅ DSGVO-konform:
- Keine Klartext-IP-Speicherung (nur SHA256-Hash von /24)
- Pseudonyme Session- & Visitor-IDs
- Nur grobe Browser/OS/Device-Klassifikation
- Kein Fingerprinting
- Custom-Data validierbar & limitierbar

## 🧪 Testen

### 1. Test-Event senden
```bash
curl -X POST http://localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/",
    "page_path": "/",
    "page_title": "Home",
    "session_id": "test-session-123",
    "visitor_id": "test-visitor-456",
    "language": "de-DE",
    "timezone": "Europe/Berlin"
  }'
```

### 2. Summary abrufen
```bash
curl http://localhost:3000/api/admin/live-tracking/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Demo-Komponente verwenden
```tsx
import TrackingDemo from './components/TrackingDemo';

// In beliebiger Admin-Seite:
<TrackingDemo />
```

## 📈 Erweiterungen

### Custom Event tracken
```tsx
import { trackEvent } from '../api/tracking';

trackEvent('product_view', {
  custom_data: {
    product_id: '12345',
    category: 'smartphones',
    price: 799.99
  }
});
```

### Conversion nach Checkout
```tsx
trackEvent('conversion', {
  custom_data: {
    order_id: order.id,
    value: order.total,
    currency: 'EUR'
  }
});
```

### Error-Tracking
```tsx
try {
  // ... Code
} catch (error) {
  trackEvent('error', {
    custom_data: {
      message: error.message,
      component: 'CheckoutForm'
    }
  });
}
```

## 🛠️ Performance

### MongoDB-Indexe (automatisch erstellt)
- `occurred_at` (descending)
- `session_id + occurred_at`
- `visitor_id`
- `event_name + occurred_at`

### Empfohlene Archivierung
Events älter als 90 Tage können gelöscht werden:
```javascript
// Als Cron-Job
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
await TrackingEvent.deleteMany({ occurred_at: { $lt: cutoff } });
```

## 🐛 Troubleshooting

### Events werden nicht gespeichert
- Prüfe Server-Logs: `npm start`
- Prüfe MongoDB-Verbindung
- Prüfe Browser-Konsole (CORS-Fehler?)
- Teste `/api/track` direkt mit curl

### Admin-Seite zeigt keine Daten
- JWT-Token gültig? (Login erneut)
- Rolle = admin oder staff?
- Events in DB vorhanden? `db.trackingevents.count()`
- Browser-Konsole auf API-Fehler prüfen

### Slow Queries
- MongoDB-Indexe überprüfen: `db.trackingevents.getIndexes()`
- Zeitfenster reduzieren (5 Min statt 30 Min)
- Sessions limitieren (bereits auf 100)

## 📚 Dokumentation

Vollständige Dokumentation:
- **[LIVE_TRACKING_DOCUMENTATION.md](LIVE_TRACKING_DOCUMENTATION.md)** - API-Referenz, Schema, Queries
- **[LIVE_TRACKING_FRONTEND_INTEGRATION.md](LIVE_TRACKING_FRONTEND_INTEGRATION.md)** - Frontend-Integration

## ✨ Fertig!

Das Live-Tracking-System ist einsatzbereit. Viel Erfolg beim Tracking! 🎉
