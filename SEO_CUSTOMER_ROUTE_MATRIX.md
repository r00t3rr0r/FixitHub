# SEO Customer Route Coverage Matrix

Generated: 2026-07-12

## Scope
- Customer-reachable routes in App routing
- Route-level SEO signals:
  - Page-level SEO component (`SEO`)
  - Global semantic SEO block (`CustomerSemanticSeoBlock`)
  - Structured data (JSON-LD)

## Global Coverage (all known customer routes)
- `CustomerSemanticSeoBlock` is active for all paths listed in `CUSTOMER_SEMANTIC_ROUTE_PATTERNS`.
- It injects:
  - semantic text (`sr-only`)
  - route-specific feature list
  - JSON-LD `WebPage` object

Status: PASS

## Route Matrix

| Route group | Example routes | Page-level SEO | Global semantic SEO + JSON-LD | Status |
|---|---|---|---|---|
| Home | `/`, `/home` | Yes | Yes | PASS |
| Auth | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/debug` | Yes (now explicit on verify/reset/debug) | Yes | PASS |
| Tracking (guest) | `/track-order`, `/track-order/booking`, `/guest-repair-tracking` | Yes | Yes | PASS |
| Order flow | `/new-order`, `/repair-request`, `/order-success` | Yes | Yes | PASS |
| Shop | `/shop`, `/cart` | Yes | Yes | PASS |
| Blog | `/blog`, `/blog/:id` | Yes | Yes | PASS |
| Service info pages | `/vorabdiagnose`, `/annahmestellen`, `/faq`, `/contact`, `/kontakt` | Yes | Yes | PASS |
| Company/legal pages | `/about`, `/ueber-uns`, `/privacy`, `/datenschutz`, `/imprint`, `/impressum`, `/terms`, `/agb`, `/widerrufsrecht`, `/zahlung-und-versand`, `/shipping-and-payment`, `/hinweise-zur-batterieentsorgung`, `/battery-disposal-notice`, `/sitemap`, `/newsletter`, `/partner-werden`, `/partner` | Yes | Yes | PASS |
| Customer portal | `/orders`, `/orders/:id`, `/messages`, `/notifications`, `/profile`, `/bookings`, `/invoices`, `/my-repair-requests`, `/my-complaints`, `/my-complaints/:complaintId` | Yes | Yes | PASS |

## Security/indexing decisions
- Sensitive or non-landing pages marked as `noindex`:
  - `/verify-email`
  - `/reset-password`
  - `/debug`

## Result
- Customer route SEO coverage is complete.
- Search engines can detect page purpose, customer functionality, and key flows across all customer-accessible routes.
- Repair configurator exposes selected model/service as crawlable semantic data and JSON-LD.
