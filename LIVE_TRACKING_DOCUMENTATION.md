# Live-Tracking System - Integrationsdokumentation

## Übersicht

Das Live-Tracking-System ermöglicht datensparsames, DSGVO-konformes Tracking von Webseitenbesuchern mit Echtzeit-Visualisierung im Admin-Bereich.

## Architektur

### Backend-Komponenten

1. **Model**: `server/models/TrackingEvent.js`
2. **Service**: `server/services/trackingService.js`
3. **Routes**:
   - `server/routes/tracking.js` (Public tracking endpoint)
   - `server/routes/adminLiveTrackingRoutes.js` (Admin API)

### Frontend-Komponenten

1. **API Client**: `client/src/api/tracking.ts` (Public tracking)
2. **API Client**: `client/src/api/liveTracking.ts` (Admin live data)
3. **Hook**: `client/src/hooks/useTracking.ts`
4. **Demo**: `client/src/components/TrackingDemo.tsx`
5. **Admin Page**: `client/src/pages/admin/TrackingLive.tsx`

## Datenmodell (MongoDB Schema)

```javascript
{
  event_name: String,          // required: 'page_view', 'click', 'form_submit', 'conversion', 'error'
  occurred_at: Date,            // Timestamp (auto-generated)
  session_id: String,           // Client-generierte Session-ID
  visitor_id: String,           // Client-generierte pseudonyme Visitor-ID
  page_url: String,             // Vollständige URL
  page_path: String,            // URL-Pfad (ohne Domain)
  page_title: String,           // Seitentitel
  referrer: String,             // HTTP Referrer
  source: String,               // UTM source
  medium: String,               // UTM medium
  campaign: String,             // UTM campaign
  browser: String,              // Browser-Name (aus User-Agent)
  browser_version: String,      // Browser-Version
  os: String,                   // Betriebssystem
  device_type: String,          // 'desktop', 'mobile', 'tablet'
  language: String,             // Browser-Sprache
  screen_width: Number,         // Bildschirmbreite
  screen_height: Number,        // Bildschirmhöhe
  viewport_width: Number,       // Viewport-Breite
  viewport_height: Number,      // Viewport-Höhe
  timezone: String,             // Client-Zeitzone
  ip_hash: String,              // SHA256-Hash der gekürzten IP (nur /24)
  country: String,              // Optional: Land
  city: String,                 // Optional: Stadt
  custom_data: Mixed,           // Beliebige zusätzliche Event-Daten
  createdAt: Date,              // Auto-generated
  updatedAt: Date               // Auto-generated
}
```

## API Endpoints

### Public Tracking Endpoint

**POST /api/track**

Erfasst ein Tracking-Event. Keine Authentifizierung erforderlich.

Request Body:
```json
{
  "event_name": "page_view",
  "page_url": "https://example.com/products",
  "page_path": "/products",
  "page_title": "Produkte",
  "referrer": "https://google.com",
  "source": "google",
  "medium": "organic",
  "campaign": null,
  "session_id": "abc123xyz",
  "visitor_id": "visitor789",
  "language": "de-DE",
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1200,
  "viewport_height": 800,
  "timezone": "Europe/Berlin",
  "custom_data": { "button": "cta-main" }
}
```

Response:
```json
{
  "ok": true
}
```

### Admin API Endpoints

**Alle Endpoints erfordern Authentifizierung (JWT Bearer Token) und Admin/Staff-Rolle.**

#### GET /api/admin/live-tracking/summary

Liefert zusammengefasste KPIs.

Query Params:
- `minutes` (default: 30) - Zeitfenster in Minuten

Response:
```json
{
  "active_visitors_5m": 12,
  "active_visitors_30m": 45,
  "page_views_5m": 134,
  "new_sessions_30m": 23,
  "conversions_30m": 5,
  "errors_30m": 2
}
```

#### GET /api/admin/live-tracking/active-sessions

Liefert Liste der aktiven Sessions.

Query Params:
- `minutes` (default: 30)

Response:
```json
[
  {
    "_id": "abc123xyz",
    "last_activity": "2026-04-25T14:35:22.000Z",
    "first_activity": "2026-04-25T14:20:15.000Z",
    "current_page": "/checkout",
    "landing_page": "/products",
    "referrer": "https://google.com",
    "source": "google",
    "medium": "organic",
    "campaign": null,
    "browser": "Chrome",
    "device_type": "desktop",
    "os": "Windows",
    "country": "DE",
    "event_count": 15,
    "visitor_id": "visitor789"
  }
]
```

#### GET /api/admin/live-tracking/top-pages

Query Params:
- `minutes` (default: 30)
- `limit` (default: 10)

Response:
```json
[
  {
    "_id": "/products",
    "count": 87,
    "title": "Produkte"
  },
  {
    "_id": "/",
    "count": 65,
    "title": "Startseite"
  }
]
```

#### GET /api/admin/live-tracking/top-referrers

Query Params:
- `minutes` (default: 30)
- `limit` (default: 10)

Response:
```json
[
  {
    "_id": "https://google.com",
    "count": 42
  },
  {
    "_id": "https://facebook.com",
    "count": 18
  }
]
```

#### GET /api/admin/live-tracking/top-browsers

Query Params:
- `minutes` (default: 30)
- `limit` (default: 10)

Response:
```json
[
  {
    "_id": "Chrome",
    "count": 156
  },
  {
    "_id": "Safari",
    "count": 78
  }
]
```

#### GET /api/admin/live-tracking/top-devices

Response ähnlich zu top-browsers.

#### GET /api/admin/live-tracking/top-countries

Response ähnlich zu top-browsers.

#### GET /api/admin/live-tracking/events

Liefert die neuesten Events.

Query Params:
- `limit` (default: 50)
- `minutes` (default: 30)

Response:
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "event_name": "click",
    "occurred_at": "2026-04-25T14:35:22.000Z",
    "page_path": "/products",
    "session_id": "abc123xyz",
    "referrer": "https://google.com",
    "source": "google",
    "custom_data": { "button": "add-to-cart" }
  }
]
```

#### GET /api/admin/live-tracking/session/:sessionId

Liefert Details zu einer spezifischen Session inkl. Event-Timeline.

Response:
```json
{
  "session_id": "abc123xyz",
  "session_start": "2026-04-25T14:20:15.000Z",
  "last_activity": "2026-04-25T14:35:22.000Z",
  "landing_page": "/products",
  "current_page": "/checkout",
  "referrer": "https://google.com",
  "source": "google",
  "medium": "organic",
  "campaign": null,
  "browser": "Chrome",
  "browser_version": "120.0.0",
  "os": "Windows",
  "device_type": "desktop",
  "country": "DE",
  "city": "Berlin",
  "event_count": 15,
  "events": [
    {
      "event_name": "page_view",
      "occurred_at": "2026-04-25T14:20:15.000Z",
      "page_path": "/products",
      "page_title": "Produkte",
      "custom_data": null
    },
    {
      "event_name": "click",
      "occurred_at": "2026-04-25T14:22:10.000Z",
      "page_path": "/products",
      "page_title": "Produkte",
      "custom_data": { "button": "product-123" }
    }
  ]
}
```

## Frontend-Integration

### Automatisches Page-View-Tracking

In jeder Seite oder im Root-Layout:

```tsx
import { useTracking } from '../hooks/useTracking';

export default function MyPage() {
  const { trackEvent } = useTracking(); // Sendet automatisch page_view

  return <div>...</div>;
}
```

### Manuelles Event-Tracking

```tsx
import { trackEvent } from '../api/tracking';

// Click-Tracking
<button onClick={() => trackEvent('click', { custom_data: { button: 'cta-main' } })}>
  Jetzt kaufen
</button>

// Form-Submit-Tracking
<form onSubmit={(e) => {
  e.preventDefault();
  trackEvent('form_submit', { custom_data: { form: 'newsletter' } });
}}>
  ...
</form>

// Conversion-Tracking
trackEvent('conversion', { 
  custom_data: { 
    order_id: '12345',
    value: 99.99 
  } 
});
```

## MongoDB Aggregation Queries

### Aktive Besucher (letzte 5 Minuten)

```javascript
db.trackingevents.aggregate([
  { $match: { occurred_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } } },
  { $group: { _id: '$visitor_id' } },
  { $count: 'count' }
]);
```

### Aktive Sessions mit Details

```javascript
db.trackingevents.aggregate([
  { $match: { occurred_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } } },
  { $sort: { occurred_at: 1 } },
  {
    $group: {
      _id: '$session_id',
      last_activity: { $max: '$occurred_at' },
      first_activity: { $min: '$occurred_at' },
      current_page: { $last: '$page_path' },
      landing_page: { $first: '$page_path' },
      referrer: { $first: '$referrer' },
      source: { $first: '$source' },
      medium: { $first: '$medium' },
      browser: { $first: '$browser' },
      device_type: { $first: '$device_type' },
      os: { $first: '$os' },
      country: { $first: '$country' },
      event_count: { $sum: 1 }
    }
  },
  { $sort: { last_activity: -1 } }
]);
```

### Top Seiten

```javascript
db.trackingevents.aggregate([
  { $match: { occurred_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } } },
  { $group: { _id: '$page_path', count: { $sum: 1 }, title: { $last: '$page_title' } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
]);
```

### Session-Detail

```javascript
db.trackingevents.find({ session_id: 'abc123xyz' })
  .sort({ occurred_at: 1 })
  .toArray();
```

## Datenschutz & DSGVO

### IP-Hashing

Die IP-Adresse wird serverseitig:
1. Auf /24 gekürzt (letzte Oktett auf .0)
2. Mit einem Salt aus `process.env.TRACKING_SALT` versehen
3. SHA256-gehasht
4. Nur der Hash wird gespeichert

```javascript
function hashIp(ip) {
  let shortIp = ip;
  if (ip && ip.includes('.')) {
    shortIp = ip.split('.').slice(0, 3).join('.') + '.0';
  }
  const salt = process.env.TRACKING_SALT || 'default_salt';
  return crypto.createHash('sha256').update(shortIp + salt).digest('hex');
}
```

### User-Agent-Auswertung

Nur grobe Klassifikation ohne Fingerprinting:
- Browser-Name (Chrome, Safari, Firefox, ...)
- OS-Name (Windows, macOS, iOS, Android, ...)
- Device-Typ (desktop, mobile, tablet)

Keine detaillierte Version oder exakte Build-Nummer.

### Session- & Visitor-IDs

- Werden client-seitig generiert (localStorage)
- Sind pseudonym und nicht personenbezogen
- Können vom Nutzer gelöscht werden

## Environment Variables

Füge in `.env` hinzu:

```
TRACKING_SALT=<zufälliger_string_für_ip_hashing>
```

Generiere den Salt z.B. mit:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Installation & Setup

1. **Dependencies installieren** (bereits erledigt):
   ```bash
   npm install ua-parser-js
   ```

2. **Environment Variable setzen**:
   ```bash
   echo "TRACKING_SALT=$(node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")" >> .env
   ```

3. **Server neu starten**:
   ```bash
   npm start
   ```

4. **Admin-Seite aufrufen**:
   Navigiere zu `/admin/live-tracking` (Route muss im Frontend-Router registriert sein)

## Erweiterte Features (Optional)

### Event-Deduplizierung

Verhindere doppelte Events innerhalb kurzer Zeit:

```javascript
// In trackingService.js
const recentEvents = new Map(); // sessionId -> lastEventTime

async function createTrackingEvent(data) {
  const key = `${data.session_id}_${data.event_name}_${data.page_path}`;
  const now = Date.now();
  const last = recentEvents.get(key);
  
  if (last && now - last < 5000) { // 5 Sekunden Deduplizierung
    return { deduplicated: true };
  }
  
  recentEvents.set(key, now);
  return TrackingEvent.create(data);
}
```

### Geo-Location (Optional)

Nutze ein GeoIP-Service (z.B. MaxMind GeoLite2):

```bash
npm install geoip-lite
```

```javascript
const geoip = require('geoip-lite');

function getGeo(ip) {
  const geo = geoip.lookup(ip);
  return {
    country: geo?.country,
    city: geo?.city
  };
}
```

### Bot-Filterung (Optional)

```javascript
function isBot(userAgent) {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /googlebot/i, /bingbot/i
  ];
  return botPatterns.some(pattern => pattern.test(userAgent));
}

// In tracking route:
if (isBot(req.headers['user-agent'])) {
  return res.json({ ok: true, filtered: 'bot' });
}
```

### Server-Sent Events (Upgrade von Polling)

```javascript
// In adminLiveTrackingRoutes.js
router.get('/stream', auth, requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(async () => {
    const summary = await getAdminSummary(30);
    res.write(`data: ${JSON.stringify(summary)}\n\n`);
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});
```

## Performance-Optimierung

### Indexe für MongoDB

```javascript
// In TrackingEvent.js nach dem Schema
TrackingEventSchema.index({ occurred_at: -1 });
TrackingEventSchema.index({ session_id: 1, occurred_at: 1 });
TrackingEventSchema.index({ visitor_id: 1 });
TrackingEventSchema.index({ event_name: 1, occurred_at: -1 });
```

### Daten-Archivierung

Events älter als 90 Tage löschen oder archivieren:

```javascript
// Als Cron-Job
const archiveOldEvents = async () => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await TrackingEvent.deleteMany({ occurred_at: { $lt: cutoff } });
};
```

## Troubleshooting

### Events werden nicht erfasst
- Prüfe Browser-Konsole auf CORS-Fehler
- Prüfe Network-Tab: POST /api/track sollte 200 OK sein
- Prüfe Server-Logs für Validierungsfehler

### Admin-Seite zeigt keine Daten
- Prüfe Authentication (JWT Token gültig?)
- Prüfe Rolle (admin oder staff erforderlich)
- Prüfe Browser-Konsole für API-Fehler
- Prüfe, ob Events in der DB gespeichert wurden: `db.trackingevents.count()`

### Langsame Aggregations
- Füge MongoDB-Indexe hinzu (siehe oben)
- Reduziere Zeitfenster (z.B. nur 5 Minuten)
- Limitiere Anzahl der Sessions in der Tabelle

## Support & Erweiterungen

Das System ist modular aufgebaut und kann einfach erweitert werden:
- Neue Event-Typen: Einfach neue `event_name` verwenden
- Neue KPIs: Service-Funktion + API-Route + Frontend-Widget hinzufügen
- Custom-Filter: Query-Params in Admin-APIs erweitern
- Export-Funktion: CSV/Excel-Export aus den Admin-APIs generieren
