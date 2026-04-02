# Customer Group Management für den Admin

## Ziel

Es soll ein eigenständiger Admin-Bereich für Customer Groups entstehen, der drei fachliche Ebenen sauber zusammenführt:

1. Kundensegmentierung und Gruppen-Zuweisung
2. gruppenspezifische Finanzlogik
3. Affiliate-Attribution und Provisionsabrechnung

Das Konzept ist auf die bestehende FixitHub-Architektur ausgerichtet. Die aktuelle Basis ist vorhanden, reicht aber noch nicht aus:

- Im User-Modell existiert bisher nur ein einfacher `customerGroup`-String.
- Finanzdefaults werden zentral über `SystemConfiguration` und `financialService` verwaltet.
- Admin-Routen und Admin-Seiten sind bereits modular aufgebaut.

Darauf aufbauend sollte Customer Group Management als eigenes Domänenmodul eingeführt werden.

## Bestehende technische Anknüpfungspunkte

### Backend

- `server/models/User.js`
  - enthält aktuell `customerGroup`, `paymentTerms`, `discount`, `status`, `customerOrigin`
- `server/models/SystemConfiguration.js`
  - enthält globale Finanzdefaults wie Währung, Zahlungsziel, Steuer und Skonto-Richtlinien
- `server/services/financialService.js`
  - bildet die zentrale Finanzverarbeitung und ist der richtige Integrationspunkt für gruppenspezifische Overrides
- `server/server.js`
  - mountet modulare Admin- und Finanzrouten

### Frontend

- `client/src/App.tsx`
  - verwaltet Admin-Routen wie `/admin/users` und `/admin/financial`
- `client/src/components/AdminSidebar.tsx`
  - enthält die Admin-Navigation
- `client/src/api/users.ts`
  - zeigt das bestehende Muster für Admin-APIs
- `client/src/pages/admin/UserManagement.tsx`
  - ist der richtige Startpunkt für Gruppenzuordnung auf Kundenebene
- `client/src/pages/admin/FinancialManagement.tsx`
  - ist der richtige Startpunkt für gruppenspezifische Finanzprozesse

## Fachliches Zielbild

Customer Groups werden als eigenständige Stammdaten verwaltet. Eine Gruppe definiert:

- organisatorische Segmentierung
- Finanzregeln
- Affiliate-Regeln
- Automatisierungs- und Zuweisungsregeln
- Prioritäten und Konfliktlogik

Ein Kunde kann je nach Konfiguration:

- genau einer aktiven Primärgruppe zugeordnet sein
- oder mehreren Gruppen angehören, wobei eine Primärgruppe für Preis-, Rechnungs- und Zahlungslogik maßgeblich bleibt

Empfehlung:

- Das System sollte technisch immer Mehrfachzuordnung unterstützen.
- Für die operative Verarbeitung sollte zusätzlich ein `primaryGroupId` geführt werden.
- Damit kann später ohne Datenmodellbruch zwischen Single-Group- und Multi-Group-Logik gewechselt werden.

## Domänenmodell

### 1. CustomerGroup

Neue Kernentität für Gruppenstammdaten.

Vorgeschlagenes Schema:

```js
{
  _id,
  key: 'vip-b2b-de',
  name: 'VIP B2B Deutschland',
  description: 'Hochwertige B2B-Kunden mit Sonderkonditionen',
  status: 'active',
  priority: 90,
  mode: 'standard',
  isExclusive: true,
  isDefault: false,
  validFrom: Date,
  validUntil: Date,
  assignmentMode: {
    allowManual: true,
    allowRuleBased: true,
    allowApi: true
  },
  financeProfile: {
    pricingRuleSetId: ObjectId,
    discountPercent: 10,
    paymentDueDays: 30,
    cashDiscountPercent: 2,
    cashDiscountDays: 10,
    creditLimit: 5000,
    currency: 'EUR',
    taxMode: 'default|tax_free|reverse_charge|custom',
    invoiceProfile: {
      invoicePrefix: 'B2B-',
      invoiceSeries: 'B2B-2026',
      consolidateInvoices: true,
      splitByOrderType: false,
      requireManualApprovalAbove: 1000
    },
    paymentTermsLabel: 'Net 30',
    allowedPaymentMethods: ['bank_transfer', 'paypal']
  },
  affiliateProfile: {
    attributionModel: 'last_click',
    fixedAffiliateId: ObjectId,
    defaultCommissionType: 'percentage',
    defaultCommissionValue: 8,
    releaseTrigger: 'invoice_paid',
    holdDays: 14,
    allowProductOverrides: true
  },
  conflictPolicy: {
    resolutionStrategy: 'priority',
    fallbackGroupId: ObjectId,
    excludedGroupIds: [ObjectId]
  },
  metadata: {
    tags: ['b2b', 'vip', 'de'],
    notes: ''
  },
  createdBy,
  updatedBy,
  createdAt,
  updatedAt
}
```

### 2. CustomerGroupAssignment

Separate Zuordnungstabelle statt nur Feldern am User. Das ist notwendig für Nachvollziehbarkeit und Mehrfachzuordnung.

```js
{
  _id,
  customerId: ObjectId,
  groupId: ObjectId,
  assignmentType: 'manual|rule|api|import|migration',
  source: {
    ruleId: ObjectId,
    apiClient: String,
    importedFile: String,
    note: String
  },
  isPrimary: true,
  status: 'active|expired|revoked',
  validFrom: Date,
  validUntil: Date,
  resolvedPriority: 90,
  resolutionReason: 'highest-priority-match',
  createdBy,
  updatedBy,
  createdAt,
  updatedAt
}
```

Nutzen:

- manuelle und automatische Zuweisungen werden unterscheidbar
- Historie bleibt erhalten
- Konfliktentscheidungen werden auditierbar

### 3. CustomerGroupRule

Regelwerk für automatische Gruppenzuweisung.

```js
{
  _id,
  name: 'B2B DE ab 5.000 EUR Umsatz',
  status: 'active',
  priority: 100,
  appliesTo: 'customer',
  groupId: ObjectId,
  stopProcessing: true,
  exclusivityMode: 'normal|exclusive|fallback_only',
  conditions: [
    { field: 'country', operator: 'eq', value: 'DE' },
    { field: 'customerType', operator: 'eq', value: 'business' },
    { field: 'lifetimeRevenue', operator: 'gte', value: 5000 }
  ],
  excludedIf: [
    { field: 'contractStatus', operator: 'eq', value: 'terminated' }
  ],
  validFrom: Date,
  validUntil: Date,
  createdBy,
  updatedBy,
  createdAt,
  updatedAt
}
```

Unterstützte Regelquellen:

- Land
- Umsatz
- Kundentyp
- Produkt
- Affiliate-Quelle
- Vertragsstatus
- Bestellanzahl
- Zahlungsmoral
- manuell gesetzte Tags

### 4. AffiliateAttribution

Separates Modell für Herkunft und Attribution.

```js
{
  _id,
  customerId: ObjectId,
  sourceType: 'affiliate|campaign|referral_code|partner',
  affiliateId: ObjectId,
  campaignId: ObjectId,
  referralCode: String,
  attributionModel: 'first_click|last_click|fixed_source',
  sourceLocked: false,
  firstTouchAt: Date,
  lastTouchAt: Date,
  conversionEvent: 'signup|first_order|invoice_paid',
  metadata: {
    utmSource: String,
    utmCampaign: String,
    landingPage: String
  }
}
```

### 5. AffiliateCommission

Lebenszyklus einer Provision.

```js
{
  _id,
  customerId: ObjectId,
  groupId: ObjectId,
  affiliateId: ObjectId,
  attributionId: ObjectId,
  orderId: ObjectId,
  invoiceId: ObjectId,
  productId: ObjectId,
  commissionType: 'fixed|percentage',
  commissionValue: 10,
  baseAmount: 250,
  computedAmount: 25,
  status: 'pending|locked|approved|released|cancelled|reversed',
  releaseTrigger: 'invoice_paid',
  triggerReachedAt: Date,
  holdUntil: Date,
  releasedAt: Date,
  reversalReason: String,
  createdAt,
  updatedAt
}
```

## Erweiterung am User-Modell

Der bestehende `customerGroup`-String im User-Modell sollte nicht sofort entfernt werden, sondern kontrolliert migriert werden.

Empfohlene Übergangserweiterung:

```js
primaryCustomerGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerGroup' },
customerGroupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerGroup' }],
customerClassification: {
  type: String,
  default: 'standard'
},
affiliateAttributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateAttribution' }
```

Migrationsstrategie:

1. Bisherige Stringwerte wie `VIP Customer` oder `Premium Customer` in echte Gruppen überführen.
2. Bestandskunden per Migrationsscript zuordnen.
3. Den String `customerGroup` zunächst nur als Legacy-Feld weiterführen.
4. Nach stabiler Umstellung alle Lesepfade auf `primaryCustomerGroupId` und Assignments umstellen.

## Finanzielle Verarbeitung

### Grundprinzip

Globale Defaults bleiben in `SystemConfiguration` bestehen. Customer Groups liefern gezielte Overrides.

Reihenfolge der Auflösung:

1. expliziter Wert am Vorgang oder an der Rechnung
2. Customer-Override am Kundenkonto
3. Gruppenregel der Primärgruppe
4. globale `SystemConfiguration`
5. Hardcoded Fallback im Service

Damit bleibt die bestehende Finanzlogik kompatibel und wird nur um eine zusätzliche Auflösungsschicht erweitert.

### Relevante Gruppenparameter

- Rabatt in Prozent oder fix
- Zahlungsziel in Tagen
- Skonto in Prozent und Frist
- Kreditlimit
- Rechnungsfreigabe ab Schwellenwert
- erlaubte Zahlungsarten
- Rechnungsserie oder Präfix
- Steuerlogik pro Gruppe
- Währungsregeln
- Konsolidierungslogik für Rechnungen

### Integration in `financialService`

Es sollte ein Resolver eingeführt werden:

```js
resolveFinancialProfile({ customer, order, invoiceContext })
```

Der Resolver lädt:

1. Customer-Overrides
2. aktive Gruppen-Zuweisungen
3. Primärgruppe
4. globale Defaults

Rückgabe:

```js
{
  currency,
  taxRate,
  paymentDueDays,
  paymentTerms,
  discountPercent,
  cashDiscountPercent,
  creditLimit,
  invoicePrefix,
  allowedPaymentMethods,
  approvalRequired
}
```

### Rechnungs- und Zahlungsprozesse

Gruppenspezifische Prozesse sollen ermöglichen:

- Rechnungserstellung mit eigener Nummernlogik
- verlängerte oder verkürzte Zahlungsziele
- automatische Mahnlogik pro Gruppe
- Kreditlimit-Prüfung vor Auftrag oder Rechnung
- Freigabepflicht für riskante Gruppen
- spätere Zahlungsauslösung abhängig vom Gruppenprofil

## Affiliate-Verarbeitung

### Ziel

Ein Kunde soll einer Affiliate-Quelle oder Kampagne zugeordnet werden können, unabhängig von der Gruppe. Die Gruppe beeinflusst dann, wie Provisionen bewertet und freigegeben werden.

### Attribution-Modelle

Unterstützt werden sollen:

- `first_click`
- `last_click`
- `fixed_source`

### Provisionsermittlung

Die Provisionslogik sollte auf vier Ebenen auflösen:

1. explizites Produkt-Override
2. Gruppenspezifische Affiliate-Regel
3. Affiliate-Default
4. globaler Fallback

Mögliche Einflussgrößen:

- Gruppe
- Produkt
- Bestellstatus
- Rechnungsstatus
- Zahlungseingang
- Storno oder Rückerstattung

### Freigabelogik

Provisionen dürfen nicht sofort freigegeben werden, sondern nach definierbaren Triggern:

- bei Bestellung
- nach Abschluss des Auftrags
- bei Rechnungserstellung
- nach vollständiger Zahlung
- nach Ablauf einer Hold-Periode

Empfehlung:

- Standardtrigger: `invoice_paid`
- optional zusätzliche Hold-Periode in Tagen
- Rückabwicklung bei Storno, Chargeback oder Gutschrift

## Automatisierung und Regel-Engine

### Regelpipeline

Die Gruppenzuordnung sollte über einen dedizierten Resolver laufen:

```js
resolveCustomerGroups(customerId, context)
```

Kontext kann enthalten:

- Kundenstammdaten
- Umsatzdaten
- Bestellhistorie
- Vertragsstatus
- Land
- Affiliate-Quelle
- Produkt- oder Warenkorbdaten

### Ablauf

1. aktive Regeln laden
2. Gültigkeitszeiträume prüfen
3. Ausschlussbedingungen prüfen
4. Matches bewerten
5. Konflikte auflösen
6. Primärgruppe bestimmen
7. Assignments persistieren
8. Audit-Eintrag erzeugen

### Konfliktauflösung

Konflikte müssen deterministisch aufgelöst werden. Empfohlene Reihenfolge:

1. exklusive Gruppen gewinnen vor nicht-exklusiven Gruppen
2. höhere Priorität gewinnt
3. manuelle Zuweisung gewinnt vor Regelzuweisung
4. feste Affiliate-Quelle kann Gruppen überschreiben, wenn so konfiguriert
5. bei Gleichstand entscheidet die spezifischere Regel mit mehr Bedingungen
6. wenn nichts passt, greift die Fallback-Gruppe

### Fallback-Logik

Es sollte immer eine System-Fallback-Gruppe existieren, zum Beispiel `standard-retail`.

Nutzen:

- jeder Kunde hat eine verwertbare Primärgruppe
- Finanz- und Affiliate-Resolver bleiben stabil
- UI und Reporting müssen nicht mit ungeklärten Zuständen arbeiten

## API-Konzept

Empfohlene neue Admin-Routen:

### Gruppenverwaltung

- `GET /api/admin/customer-groups`
- `POST /api/admin/customer-groups`
- `GET /api/admin/customer-groups/:id`
- `PUT /api/admin/customer-groups/:id`
- `PATCH /api/admin/customer-groups/:id/status`
- `DELETE /api/admin/customer-groups/:id`

### Gruppenzuordnung

- `GET /api/admin/customer-groups/:id/customers`
- `POST /api/admin/customer-groups/:id/assignments`
- `DELETE /api/admin/customer-groups/:id/assignments/:assignmentId`
- `POST /api/admin/customers/:customerId/groups/recalculate`
- `PUT /api/admin/customers/:customerId/groups/primary`

### Regelwerk

- `GET /api/admin/customer-group-rules`
- `POST /api/admin/customer-group-rules`
- `PUT /api/admin/customer-group-rules/:id`
- `PATCH /api/admin/customer-group-rules/:id/status`
- `POST /api/admin/customer-group-rules/preview`

### Affiliate

- `GET /api/admin/affiliate-attributions`
- `POST /api/admin/customers/:customerId/affiliate-attribution`
- `GET /api/admin/affiliate-commissions`
- `POST /api/admin/affiliate-commissions/:id/release`
- `POST /api/admin/affiliate-commissions/:id/reverse`

### Reporting

- `GET /api/admin/customer-groups/overview`
- `GET /api/admin/customer-groups/:id/financial-summary`
- `GET /api/admin/customer-groups/:id/affiliate-summary`

## Backend-Struktur im Repo

Empfohlene neue Dateien:

- `server/models/CustomerGroup.js`
- `server/models/CustomerGroupAssignment.js`
- `server/models/CustomerGroupRule.js`
- `server/models/AffiliateAttribution.js`
- `server/models/AffiliateCommission.js`
- `server/services/customerGroupService.js`
- `server/services/customerGroupResolver.js`
- `server/services/affiliateCommissionService.js`
- `server/routes/customerGroupRoutes.js`

### Service-Verantwortung

`customerGroupService`

- CRUD für Gruppen
- Statuswechsel
- Validierung von Überschneidungen
- Konsistenzprüfung für Fallback und Exklusivität

`customerGroupResolver`

- automatische Gruppenzuordnung
- Konfliktauflösung
- Primärgruppe bestimmen
- Rebuild für Bestandskunden

`affiliateCommissionService`

- Attribution laden
- Provisionen berechnen
- Hold und Release steuern
- Reversals verarbeiten

### Integration in bestehende Prozesse

Der Resolver sollte bei folgenden Ereignissen laufen:

- Kunde erstellt
- Kunde aktualisiert
- Bestellung erstellt
- Bestellung bezahlt
- Vertragsstatus geändert
- Affiliate-Attribution geändert
- manuelle Admin-Neuberechnung

## UI-Konzept für Admin

### Neuer Menüpunkt

Empfohlene Platzierung in der Admin-Navigation:

- unter Benutzerverwaltung als eigener Punkt `Customer Groups`
- optional zusätzlicher Schnellzugriff im Finanzbereich

### Neue Admin-Seite

Empfohlene Route:

- `/admin/customer-groups`

Empfohlene neue Frontend-Dateien:

- `client/src/pages/admin/CustomerGroupsManagement.tsx`
- `client/src/api/customerGroups.ts`
- `client/src/components/admin/customer-groups/*`

### Seitenaufbau

Die Admin-Seite sollte tab-basiert oder modulbasiert aufgebaut werden.

#### Tab 1: Übersicht

- Anzahl aktiver Gruppen
- Kunden je Gruppe
- Anzahl Konfliktfälle
- Umsatz je Gruppe
- offene Provisionen je Gruppe

#### Tab 2: Gruppen

- Tabelle mit Name, Status, Priorität, Gültigkeit
- Erstellen, Bearbeiten, Aktivieren, Archivieren
- Kennzeichen für exklusiv, default und primär nutzbar

#### Tab 3: Regeln

- Regel-Editor mit Bedingungsblöcken
- Priorität, Ausschlussregeln, Fallback
- Preview gegen Beispielkunden

#### Tab 4: Zuweisungen

- Kundenliste mit Primärgruppe und Zusatzgruppen
- manuelle Gruppenzuordnung
- Recalculate-Aktion
- Audit-Historie pro Kunde

#### Tab 5: Finanzen

- gruppenspezifische Rabatte
- Zahlungsziele
- Skonto
- Kreditlimit
- Rechnungsprofil
- erlaubte Zahlarten

#### Tab 6: Affiliate

- Attribution-Modell pro Gruppe
- feste Quellen
- Provisionssätze
- Freigabe-Trigger
- offene und freigegebene Provisionen

#### Tab 7: Reporting und Audit

- Regel-Trefferquote
- Konfliktfälle
- manuelle Overrides
- Umsatz- und Marge je Gruppe
- Affiliate-Performance je Gruppe

## UX-Regeln

Damit die Verwaltung im Alltag nutzbar bleibt, sollte die UI folgende Prinzipien beachten:

- Trennung zwischen Stammdaten, Regeln und operativen Zuweisungen
- jede automatische Entscheidung muss erklärbar sein
- jede manuelle Änderung braucht eine Begründung oder Notiz
- Preview vor Aktivierung einer Regel
- Massenaktionen für Recalculate und Bulk-Assignment
- klare Kennzeichnung, welche Gruppe finanziell wirksam ist

## Validierung und Schutzmechanismen

### Backend-Validierungen

- nur eine Default-Fallback-Gruppe aktiv
- keine zirkulären Exclusion-Regeln
- keine überlappenden exklusiven Regeln ohne Prioritätsunterschied
- Kreditlimit, Zahlungsziel und Provisionswerte innerhalb definierter Grenzen
- `validUntil` darf nicht vor `validFrom` liegen

### Business Guards

- gesperrte oder inaktive Gruppen dürfen nicht neu zugewiesen werden
- archivierte Gruppen bleiben historisch referenzierbar
- Provisionen dürfen nur released werden, wenn Trigger erfüllt ist
- Rechnungslogik darf nicht auf eine inaktive Primärgruppe zeigen

## Reporting und Datenanalyse

Wichtige KPIs:

- Kundenanzahl pro Gruppe
- Umsatz pro Gruppe
- Deckungsbeitrag pro Gruppe
- offene Forderungen pro Gruppe
- Zahlungsverzug pro Gruppe
- Anzahl automatischer vs. manueller Zuweisungen
- Affiliate-Umsatz und Provision pro Gruppe
- Konfliktquote im Regelwerk

## Migrations- und Einführungsplan

### Phase 1: Datenmodell und Readiness

- neue Modelle einführen
- Migrationsskript für vorhandene `customerGroup`-Strings schreiben
- API-Grundlagen schaffen

### Phase 2: Admin-Stammdaten

- CRUD für Gruppen
- UI für Gruppenliste und Detailansicht
- Integration in Admin-Sidebar und Routing

### Phase 3: Regel-Engine

- Regelmodell
- Resolver
- Preview und Recalculate

### Phase 4: Finanz-Overrides

- Resolver in `financialService` integrieren
- gruppenspezifische Rechnungs- und Zahlungslogik aktivieren

### Phase 5: Affiliate-Provisionen

- Attribution-Modell einführen
- Provisionsermittlung und Release-Lifecycle integrieren

### Phase 6: Reporting und Audit

- Dashboards
- Konfliktanalyse
- Änderungsprotokolle

## Klare Empfehlung für FixitHub

Für dieses Repo ist die sinnvollste Zielarchitektur:

1. Customer Groups als eigenes Modul einführen, nicht nur als Erweiterung des Users
2. Mehrfachzuordnung technisch erlauben, aber immer eine Primärgruppe erzwingen
3. Finanzlogik als Gruppen-Override auf bestehende `SystemConfiguration` aufsetzen
4. Affiliate-Attribution und Provisionen als getrennte Modelle halten
5. Gruppenzuweisung über einen dedizierten Resolver mit Audit-Historie umsetzen
6. Admin-UI als eigenständige Seite unter `/admin/customer-groups` anlegen

Damit entsteht eine stabile technische Basis, die sowohl manuelle Admin-Prozesse als auch automatisierte Finanz- und Affiliate-Workflows sauber unterstützt.