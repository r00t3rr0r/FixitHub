# Marketing/Promo Modul (Admin)

Dieses Dokument beschreibt die integrierte Marketing/Promo-Erweiterung in der bestehenden FixitHub-App.

## Navigation und Routing

Das Modul ist im Admin-Bereich unter `Marketing/Promo` mit Untermenues integriert:

- Uebersicht
- Newsletter
- Promo Codes
- Segmente
- Reports
- Einstellungen

Neue Routen:

- `/admin/marketing-promo`
- `/admin/marketing-promo/newsletters`
- `/admin/marketing-promo/promo-codes`
- `/admin/marketing-promo/segments`
- `/admin/marketing-promo/reports`
- `/admin/marketing-promo/settings`

## Backend API

Base: `/api/admin/marketing-promo`

### Uebersicht / Reports / Audit

- `GET /overview`
- `GET /reports`
- `GET /audit-log`

### Einstellungen

- `GET /settings`
- `PUT /settings`

### Newsletter

- `GET /newsletters`
- `POST /newsletters`
- `PUT /newsletters/:id`
- `POST /newsletters/:id/duplicate`
- `POST /newsletters/:id/archive`
- `POST /newsletters/:id/test-send`
- `POST /newsletters/:id/schedule`
- `POST /newsletters/:id/send`
- `GET /newsletters/:id/deliveries`

### Promo-Codes

- `GET /promo-codes`
- `POST /promo-codes`
- `PUT /promo-codes/:id`
- `POST /promo-codes/:id/toggle-active`
- `POST /promo-codes/:id/archive`
- `GET /promo-codes/:id/redemptions`

### Segmente

- `GET /segments`
- `POST /segments`
- `PUT /segments/:id`
- `GET /segments/:id/preview`

## Datenmodell (Collections)

Neue Collections:

- `marketing_campaigns`
- `newsletters`
- `newsletter_deliveries`
- `promo_codes`
- `promo_code_redemptions`
- `marketing_segments`
- `marketing_audit_logs`
- `marketing_settings`

### Verknuepfung Newsletter + Promo-Code

- `newsletters.promoCodeIds[]`
- `promo_codes.newsletterIds[]`
- Optional Kampagnenzuordnung via `campaignId` in Newsletter/PromoCode

## Validierungen

- Newsletter ohne `subject` oder `content` werden serverseitig abgelehnt.
- Versand/Scheduling ohne gueltige Empfaengerbasis (Segment + Opt-in) wird abgelehnt.
- Promo-Code ist eindeutig.
- `endDate` darf nicht vor `startDate` liegen.
- Rabatt- und Regelwerte werden auf logische Gueltigkeit geprueft.

## Mail-/Template-Reuse

Newsletter-Test und Versand verwenden bestehende Template-Infrastruktur (`EmailService.sendTemplateEmail`) mit dem vorhandenen Template `Allgemeine Systemnachricht`.

## Seed / Smoke Test

### Seed

Server-Script:

- `npm --prefix server run seed:marketing-promo`

Erstellt Basiseintraege fuer:

- Marketing-Einstellungen
- Standard-Segment
- Beispiel-Promo-Code
- Beispiel-Newsletter

### API Smoke Test

Root-Script:

- `node test-marketing-promo-api.js`

Benötigte ENV:

- `API_BASE_URL`
- `ADMIN_BEARER_TOKEN`
