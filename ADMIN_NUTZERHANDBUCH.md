# Admin Nutzerhandbuch - FixitHub

## 1. Ziel und Geltungsbereich
Dieses Handbuch beschreibt den kompletten Admin-Bereich von FixitHub: Menuepunkte, Interface-Funktionen und welche Daten in den jeweiligen Ansichten angezeigt, bearbeitet oder konfiguriert werden koennen.

Das Handbuch basiert auf den real implementierten Admin-Routen und Seiten im Client.

## 2. Zugriff und Berechtigungen
- Admin-Bereich ist nur mit Rolle admin erreichbar.
- Zentrale Startseite: /admin
- Viele Unterseiten sind direkt ueber die Sidebar erreichbar.
- Einige Admin-Seiten sind zusaetzlich ueber Verlinkungen/Quick Actions erreichbar (zum Beispiel /admin/orders oder /admin/visual-builder/:pageId).

## 3. Bedienkonzept im Admin-Bereich
- Linke Sidebar mit gruppierten Bereichen:
  - User Management
  - Order Management
  - Content Management
  - Marketing/Promo
  - System Management
- Viele Seiten nutzen:
  - Filter (Status, Typ, Zeitraum)
  - Suche
  - Tabellenlisten
  - Dialoge fuer Erstellen/Bearbeiten/Loeschen
  - Export- und Import-Funktionen (CSV/JSON)

## 4. Menuepunkte und Funktionen

## Dashboard

### Dashboard (/admin)
- Interface-Funktionen:
  - KPI-Kacheln (Auftraege, Kunden, Nachrichten, Benachrichtigungen, Systemstatus)
  - Live-Abschnitte fuer Buchungen, Reparaturanfragen, Benachrichtigungen, Teamstatus, zugewiesene Auftraege
  - Schnellaktionen (Direktnavigation in Kernbereiche)
  - Auto-Refresh alle 15 Sekunden
  - Manueller Refresh
  - JSON-Export der Dashboard-Daten
- Angezeigt wird:
  - Operative Echtzeitdaten fuer Tagessteuerung
  - Auslastung, Prioritaeten, ungelesene Nachrichten
- Konfigurierbar/Bearbeitbar:
  - Keine Stammdatenpflege; Fokus auf Monitoring und Navigation

## User Management

### User Management (/admin/users)
- Interface-Funktionen:
  - Benutzerliste mit Pagination, Sortierung, Suche
  - Filter nach Rolle, Status, Kundengruppe
  - Benutzer anlegen
  - Rolle aendern
  - Status aktiv/inaktiv umschalten
  - Bulk-Statusaenderung
  - Benutzer loeschen
  - Detaildialog und Bearbeitungsdialog
  - CSV-Import
- Angezeigt wird:
  - Profildaten, Kontaktdaten, Aktivitaetsdaten, Rollen/Status
- Bearbeitbar:
  - Benutzerstammdaten, Rolle, Status

### Customer Groups (/admin/customer-groups)
- Interface-Funktionen:
  - Multi-Tab-Verwaltung fuer Gruppenlogik
  - Gruppen anlegen/bearbeiten/loeschen und aktivieren/deaktivieren
  - Regelwerk fuer automatische Zuordnung erstellen und testen (Preview)
  - Kunden manuell Gruppen zuweisen/entziehen, Primaergruppe setzen
  - Finanzprofil je Gruppe pflegen
  - Affiliate-Profil je Gruppe pflegen
  - Recalculate/Rebuild von Gruppenlogik
- Angezeigt wird:
  - Gruppenuebersicht, Regeln, Zuordnungen, Finanz- und Affiliate-Summaries
- Konfigurierbar:
  - Zahlungsziele, Rabatte, Kreditlimits, Attributionslogik, Konfliktregeln

#### Detailerklaerung: Finanzprofil je Gruppe pflegen

Die Finanzwerte werden pro Gruppe in `financeProfile` gespeichert und in der Finanzlogik direkt fuer Rechnungen, Zahlungsziele und Default-Zahlarten verwendet.

| Feld | Zulaessige Werte | Wirkung im System | Typischer Einsatz |
|---|---|---|---|
| `discountPercent` | `0..100` | Standardrabatt fuer Kunden dieser Gruppe (falls kein individueller Kundendiskount gesetzt ist) | VIP/B2B-Rabattsteuerung |
| `paymentDueDays` | `0..365` | Faelligkeit von Rechnungen (Due Date) fuer Gruppenkunden | Net 14 / Net 30 Regeln |
| `cashDiscountPercent` | `0..100` | Skonto-Prozentsatz bei fruehzeitiger Zahlung | 2% bei frueher Zahlung |
| `cashDiscountDays` | `0..365` | Zeitfenster in Tagen fuer Skonto | z. B. 10 Tage |
| `creditLimit` | `>= 0` | Kreditgrenze fuer Zahlungs-/Freigabelogik | B2B-Kunden mit Kreditrahmen |
| `currency` | ISO-Code (z. B. `EUR`) | Waehrungs-Default fuer Rechnung/Finanzdarstellung | Laender-/Marktbezogene Gruppen |
| `taxMode` | `default`, `tax_free`, `reverse_charge`, `custom` | Steuerbehandlung; `tax_free`/`reverse_charge` setzen effektive Steuer auf 0 | B2B EU Reverse Charge |
| `paymentTermsLabel` | Freitext | Label fuer Zahlungsbedingungen auf Dokumenten | "Net 30 (B2B)" |
| `invoicePrefix` | Freitext | Prefix fuer Rechnungsnummern dieser Gruppe | `VIP-`, `B2B-` |
| `invoiceProfile.invoiceSeries` | Freitext | Serienkennzeichen fuer gruppenspezifische Nummernlogik | Trennung nach Kundensegment |
| `invoiceProfile.consolidateInvoices` | `true/false` | Aktiviert Sammelrechnungsmodus | Monatliche Sammelrechnung |
| `invoiceProfile.splitByOrderType` | `true/false` | Trennt Rechnungen nach Auftragstyp | Service vs. Shop trennen |
| `invoiceProfile.requireManualApprovalAbove` | `>= 0` | Schwellwert, ab dem manuelle Freigabe noetig ist | Risiko-/Betragskontrolle |
| `allowedPaymentMethods[]` | `credit_card`, `debit_card`, `paypal`, `stripe`, `bank_transfer` | Erlaubte Zahlarten fuer diese Gruppe; erste Zahlart wird oft als Default verwendet | B2B nur `bank_transfer` |

Praxiswirkung in der Berechnung:
- Finanzservice priorisiert bei vielen Werten die Gruppenkonfiguration vor globalen Defaults.
- `taxMode` beeinflusst die effektiv verwendete Steuerquote direkt.
- `allowedPaymentMethods` steuert, welche Zahlarten in der Abwicklung fuer die Gruppe zur Verfuegung stehen.

#### Detailerklaerung: Affiliate-Profil je Gruppe pflegen

Die Affiliate-Werte werden pro Gruppe in `affiliateProfile` gespeichert und steuern Attribution, Kommissionstyp und Freigabezeitpunkt.

| Feld | Zulaessige Werte | Wirkung im System | Typischer Einsatz |
|---|---|---|---|
| `attributionModel` | `first_click`, `last_click`, `fixed_source` | Regel, welcher Kanal/Partner die Attribution erhaelt | Standard oft `last_click` |
| `fixedAffiliateId` | Freitext/ID | Nur relevant bei `fixed_source`; erzwingt feste Quelle | Partnervertrag mit fixer Zuordnung |
| `defaultCommissionType` | `fixed`, `percentage` | Kommissionsart fuer Standardberechnung | Prozent bei Marketing, fix bei Lead-Pauschalen |
| `defaultCommissionValue` | `>= 0` | Hoehe der Standardkommission | z. B. `8` (%) oder fester Betrag |
| `releaseTrigger` | `order_created`, `order_completed`, `invoice_created`, `invoice_paid` | Wann Kommission freigegeben wird | Risikoarm meist `invoice_paid` |
| `holdDays` | `0..365` | Sicherheitswartezeit vor Auszahlung/Freigabe | Rueckgabe-/Storno-Fenster absichern |
| `allowProductOverrides` | `true/false` | Erlaubt produktspezifische Abweichungen von der Standardkommission | Kampagnen-/Produktsteuerung |

Empfohlene Governance:
- Hohe Stornoquote: `releaseTrigger=invoice_paid` + `holdDays > 0`.
- Partner mit Sondervertrag: `fixed_source` + feste `fixedAffiliateId`.

#### Detailerklaerung: Recalculate/Rebuild von Gruppenlogik

Im aktuellen Stand ist im Admin-UI die Funktion **Recalculate (ausgewaehlter Kunde)** vorhanden. Sie berechnet die aktive Primaergruppe fuer einen konkreten Kunden neu.

Technischer Ablauf (was genau passiert):
1. Es werden alle aktiven Gruppenzuweisungen (`CustomerGroupAssignment`) des Kunden geladen.
2. Die Gruppen werden nach `group.priority` absteigend sortiert.
3. Alle aktiven Zuweisungen werden auf `isPrimary=false` gesetzt.
4. Die hoechste Prioritaet wird als `isPrimary=true` markiert (`resolutionReason=recalculated-highest-priority-group`).
5. Im User-Datensatz werden synchronisiert:
   - `primaryCustomerGroupId`
   - `customerGroupIds[]`
   - `customerGroup` (Name der Primaergruppe)

Rueckgabewerte der API (`POST /api/admin/customer-groups/customers/:customerId/groups/recalculate`):
- `primaryGroupId`
- `assignedGroupIds[]`
- `assignmentCount`

Wichtig fuer den Betrieb:
- Die Recalculate-Funktion ist **kundenbezogen**, kein globaler Massen-Rebuild.
- Wenn ein globaler Rebuild gewuenscht ist, muss dieser aktuell als Batch-Prozess/Script umgesetzt werden.

#### Weitere Einstellungsmoeglichkeiten in Customer Groups (praxisrelevant)

| Bereich | Feld | Werte | Wofuer genutzt |
|---|---|---|---|
| Gruppensteuerung | `status` | `draft`, `active`, `inactive`, `archived` | Aktivitaet und Sichtbarkeit in Regeln/Zuordnung |
| Gruppensteuerung | `mode` | `standard`, `vip`, `b2b`, `affiliate`, `custom` | Segmenttyp fuer Organisation und Auswertung |
| Konflikte | `isExclusive` | `true/false` | Exklusive Gruppenlogik bei Mehrfachtreffern |
| Konflikte | `isDefault` | `true/false` | Fallback-Gruppe bei fehlenden Treffern |
| Konflikte | `conflictPolicy.resolutionStrategy` | `priority`, `manual_first`, `exclusive_first` | Regel, wie Konflikte zwischen mehreren Gruppen geloest werden |
| Konflikte | `conflictPolicy.fallbackGroupId` | Group-ID | Definierte Rueckfallgruppe |
| Konflikte | `conflictPolicy.excludedGroupIds[]` | Group-IDs | Explizit ausgeschlossene Kombinationen |
| Zuweisung | `assignmentMode.allowManual` | `true/false` | Erlaubt manuelle Gruppenvergabe im Admin |
| Zuweisung | `assignmentMode.allowRuleBased` | `true/false` | Erlaubt regelbasierte Zuordnung |
| Zuweisung | `assignmentMode.allowApi` | `true/false` | Erlaubt externe/API-basierte Zuordnung |
| Gueltigkeit | `validFrom`, `validUntil` | Datum | Zeitliche Aktivierung/Begrenzung einer Gruppe |
| Regeln | `conditions[].operator` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains` | Feldvergleich fuer automatische Gruppentreffer |
| Regeln | `excludedIf[]` | wie oben | Ausschlussregeln trotz Match |
| Regeln | `stopProcessing` | `true/false` | Beendet weitere Regelpruefung nach Treffer |
| Regeln | `exclusivityMode` | `normal`, `exclusive`, `fallback_only` | Exklusivitaetsverhalten pro Regel |

Beispiel fuer eine konkrete B2B-Konfiguration:
- `taxMode=reverse_charge`
- `paymentDueDays=30`
- `allowedPaymentMethods=['bank_transfer','debit_card']`
- `invoicePrefix='B2B-'`
- `resolutionStrategy='priority'`
- Regeloperatoren auf Umsatz/Land (`gte`, `eq`) fuer automatische Zuordnung

### Staff Management (/admin/staff)
- Interface-Funktionen:
  - Tabs fuer Status, Mitarbeiter, Teams, Workload, Performance
  - Mitarbeiter anlegen/bearbeiten/loeschen
  - Teams anlegen/bearbeiten/loeschen
  - Aufgabenmanagement (Tasks)
  - Detailansicht pro Mitarbeiter
- Untermenuepunkte (erweiterte Funktionen):
  - `Status`: Verfuegbarkeiten und operative Einsatzsteuerung je Mitarbeiter
  - `Mitarbeiter`: Stammdaten, Rolle, Teamzuordnung, Aktivstatus
  - `Teams`: Teamstruktur mit Leader/Mitgliedern und Lastverteilung
  - `Workload`: Auslastungskennzahlen und Engpasssicht
  - `Performance`: KPI-Sicht auf Durchsatz/Qualitaet/Abschlussraten
- Angezeigt wird:
  - Auslastung, Teamstrukturen, Aufgabenstatus, Performancemetriken
- Bearbeitbar:
  - Mitarbeiterrollen, Teamzuordnungen, Aufgabenplanung

## Order Management

### Bookings (/admin/bookings)
- Interface-Funktionen:
  - Buchungsliste mit Status- und Billing-Filter
  - Suchfunktion
  - Detaildialog je Buchung
  - Status- und Billingstatus-Aenderung
  - Rechnungsaktionen (Preview, Erstellung, Verlauf)
  - Reklamationen und Erinnerungen pro Buchung
  - Kommunikationspanel pro Auftrag
  - Versand/Retouren-Funktionen inkl. Label-Download und Trackingstatus
- Angezeigt wird:
  - Kunden- und Gastbuchungen, Positionen, Kosten, Fortschritt, Timeline, DHL-Retoureninfos
- Bearbeitbar:
  - Prozessstatus, Billingstatus, Versand-/Retourenstatus

### Service Management (/admin/services)
- Interface-Funktionen:
  - Reparaturservices auflisten, suchen, filtern, sortieren
  - Service erstellen, bearbeiten, loeschen
  - Detailansicht laden
  - CSV-Import
  - Option auf Massenloeschung (Passwort-bestaetigt)
- Angezeigt wird:
  - Preise, Zeiten, Kategorien, Geraetebezug, SEO-Daten, interne/externe Infos
- Bearbeitbar:
  - Komplette Service-Stammdaten

### Add-On Services (/admin/addons)
- Interface-Funktionen:
  - Add-on-Liste mit Suche/Filter/Sortierung/Pagination
  - Add-on erstellen, bearbeiten, loeschen
  - Detailansicht
  - Kompatibilitaetsmatrix (Geraetetypen/Marken)
  - CSV-Import
- Angezeigt wird:
  - Preise, Dauer, Kategorie, Bundle-Rabatt, Kompatibilitaet
- Bearbeitbar:
  - Add-on-Stammdaten und Kompatibilitaetsregeln

### Service Categories (/admin/service-categories)
- Interface-Funktionen:
  - Kategorien erstellen, bearbeiten, loeschen
  - Aktivieren/Deaktivieren
  - Statistikansicht pro Kategorie
- Angezeigt wird:
  - Kategorie-Typ (repair/addon), Reihenfolge, Aktivstatus, Nutzungszahlen
- Bearbeitbar:
  - Name, Beschreibung, Icon, Farbe, Sortierung

### Device Management (/admin/devices)
- Interface-Funktionen:
  - Device-Dashboard plus verwaltete Tabs
  - Device Types, Hersteller, Modelle, Brands
  - Anlegen/Bearbeiten von Device Types, Brands und Modellen
  - CSV-Import fuer Geraete
  - Bulk-Aktionen fuer Modellpflege
- Angezeigt wird:
  - Geraetekatalog inkl. Spezifikationen, Problemprofile und Zuordnungen
- Bearbeitbar:
  - Geraetestammdaten in hoher Detailtiefe

### Parts Management (/admin/parts)
- Interface-Funktionen:
  - Lager-/Teileverwaltung mit Suche, Filtern, Sortierung, Pagination
  - Teil anlegen, bearbeiten, loeschen
  - Versionierte Teilevarianten (Original/Cheap/Efficient)
  - CSV-Import
  - Auswahl mehrerer Teile und Uebergabe an Need Lists
- Angezeigt wird:
  - Lagerbestaende, Mindestbestaende, Preise, Lieferinformationen, Spezifikationen
- Bearbeitbar:
  - Artikel, Versionen, Bestands- und Lieferparameter

### EPart Orders (/admin/epart-orders)
- Interface-Funktionen:
  - Lieferanten und Bestellungen verwalten
  - Bestellung erstellen, Status pflegen, Wareneingang buchen
  - Rechnung hochladen/herunterladen
  - Retoure/Umtausch anfordern und Status aktualisieren
  - Bedarfsliste (NeedListManagement) integriert
- Angezeigt wird:
  - Bestellhistorie, Lieferanten, Kosten, Lieferstatus, Retourenstatus
- Bearbeitbar:
  - Einkaufsvorgaenge und Supplier-Stammdaten

### Workflow Management (/admin/workflow)
- Interface-Funktionen:
  - Workflow-Templates erstellen, bearbeiten, duplizieren, loeschen
  - Filter/Suche nach Status
  - Visual Builder pro Workflow oeffnen
  - Statistik zu Steps/Automationen
- Untermenuepunkte (erweiterte Funktionen):
  - `Template-Struktur`: `name`, `description`, `isActive`, `deviceTypes[]`, `serviceTypes[]`, globale Workflow-Settings
  - `Step-Design`: `steps[]` mit Kategorie, Zeit, Pflicht-/Skip-/Approval-Logik, Dependencies, Tools, Skills
  - `Formfelder je Step`: Feldtypen `text` bis `time`, Validierung, Conditional Logic
  - `Automationsregeln`: Trigger `step_completion|time_delay|condition_met|manual|form_submission` und Actions `send_notification|update_status|assign_staff|create_task|move_to_next_step`
  - `Filter/Statistik`: aktive/inaktive Templates, Step-/Rule-Volumen, mittlere Durchlaufzeit
- Angezeigt wird:
  - Workflowstruktur, Aktivstatus, Laufzeitkennzahlen
- Bearbeitbar:
  - Prozessvorlagen fuer Serviceablaeufe

### Analytics (/admin/analytics)
- Interface-Funktionen:
  - Profitabilitaetsreporting und Kalkulationssicht
  - Einstellbare Kosten- und Bewertungsparameter
  - Tabs fuer Auswertung und Konfiguration
  - Export-Funktionen
- Untermenuepunkte (erweiterte Funktionen):
  - `Auswertung`: KPI-Sicht mit Filterung nach Zeitraum, Status und Suche
  - `Kostenmodell`: `labor.*`, `materials.*`, `subcontracting.*`, `overhead.*`, `depreciation.*`, `otherCosts.*`, `accounting.*`, `warranty.*`
  - `Formelsteuerung`: Gewichtungen `formula.profitWeights.*` und `formula.operatingCostWeights.*` inkl. Presets
  - `Spaltensteuerung`: Sichtbarkeit/Reihenfolge fuer Booking- und Order-Tabellen
  - `Export`: CSV der aktuell gefilterten und konfigurierten Ansicht
- Angezeigt wird:
  - Margen, Kostenbloecke, KPI-Verlaeufe, Statuscluster
- Konfigurierbar:
  - Labor-/Material-/Overhead-/Abschreibungs- und Formelparameter

### Repair Requests (/admin/repair-requests)
- Interface-Funktionen:
  - Reparaturanfragenliste mit Status/Prioritaetsfiltern
  - Detaildialog mit Kommunikationspanel
  - Status/Prioritaet/Kostenschaetzung aktualisieren
  - Mitarbeiter zuweisen
  - Admin-Notizen und Nachrichten
  - Umwandlung in Auftrag
  - Loeschfunktion
- Untermenuepunkte (erweiterte Funktionen):
  - `Status/Prioritaet`: Statuswerte `pending|reviewing|approved|rejected|converted`, Prioritaeten `low|medium|high|urgent`
  - `Kostenschaetzung`: `estimatedCost` mit Validierung (`>=0`)
  - `Zuweisung`: `assignedStaffId` und operative Verantwortungssteuerung
  - `Kommunikation`: Kunden-/Staff-Nachrichten, Read-Status, Admin-Notizen
  - `Konvertierung`: Request -> Auftrag mit `services[]` (Pflicht), optionalen Add-ons/Kosten
- Angezeigt wird:
  - Kundendaten, Geraeteinfos, Prioritaet, Kommunikation, Umwandlungsstatus
- Bearbeitbar:
  - Operative Bearbeitung bis zur Auftragserstellung

### Financial Management (/admin/financial)
- Interface-Funktionen:
  - Rechnungen, Zahlungen, Mahnlaeufe, Gutschriften
  - Payment Gateway-Einstellungen
  - Versand/Trigger fuer Rechnungs-Kommunikation
  - Exporte fuer Rechnungen/Zahlungen
- Untermenuepunkte (erweiterte Funktionen):
  - `Rechnung`: Anlage/Versand, Statusfluss `draft` bis `credited`, Erzeugung aus RepairOrders
  - `Teilzahlung/Refund`: Zahlungsbuchung mit Methode/Referenz/Metadaten, Refund `gateway|manual`, Gutschrift `full|partial`
  - `Mahnlaeufe`: Run-Builder mit Queue-Status `pending|processing|sent|escalated|skipped|failed`
  - `Provider`: Stripe/PayPal/Bank Transfer/Cash mit technischen Parametern, Webhooks und Restriktionen
  - `Konfiguration`: `financialSettings.defaults|discountPolicy|invoiceMetadata|paymentPreferences`
  - `Exports/Reporting`: CSV/JSON fuer Rechnungen/Zahlungen, Kennzahlen fuer Revenue/Marge/Refund/Dispute
- Angezeigt wird:
  - Offene Posten, Ueberfaelligkeiten, Finanzberichte, Mahnstatus
- Konfigurierbar:
  - Finanzdefaults (Steuer, Faelligkeit, Waehrung, Prefixe, Versandoptionen)

### Complaints (/admin/complaints)
- Interface-Funktionen:
  - Reklamationsliste mit Filter und CSV-Export
  - Detailbereich mit Statusaktionen (genehmigen, ablehnen, anerkennen, verweigern)
  - Teilrueckerstattung, Zusatzkosten, Folgeauftrag-Optionen
  - Nachrichten/Kommentare inkl. interne Notizoption
- Untermenuepunkte (erweiterte Funktionen):
  - `Entscheidungsstatus`: `pending_approval|approved|rejected|acknowledged|denied|new_repair|resolved|closed`
  - `Statusgebundene Aktionen`: Admin-Freigabe/Ablehnung, Techniker-Anerkennung/Ablehnung, Kundenentscheidung beim Angebot
  - `Kostenparameter`: `partialRefund`, `additionalParts[]`, `extraCosts`, `offerAmount`, `offerDescription`
  - `Kommunikation`: Kommentar mit `isInternal`-Steuerung und Benachrichtigungswirkung
  - `Audit/Export`: Verlauf je Reklamation + CSV-Export der gefilterten Liste
- Angezeigt wird:
  - Reklamationsnummern, Auftragsbezug, Bearbeiter, Kosten, Historie
- Bearbeitbar:
  - Reklamationsentscheidungen und Kommunikation

## Content Management

### Web Shop Management (/admin/shop)
- Interface-Funktionen:
  - Produktkatalog mit Suche, Sortierung, Pagination
  - Produkt anlegen, anzeigen, bearbeiten, loeschen
  - Kategorien/Brands laden
  - CSV-Import
  - SEO-Felder im Produktformular
- Untermenuepunkte (erweiterte Funktionen):
  - `Produktstamm`: Pflichtfelder `name|description|price|category|brand|stockCount`
  - `Preis/Bestand`: `price`, `originalPrice`, `stockCount`, Low-/Out-of-Stock-Steuerung
  - `Medien`: `images[]`, `features[]`, `compatibility[]`, physische Produktattribute
  - `SEO`: `searchKeywords`, `seoName`, `seoTitleTag`, `seoMetaKeywords`, `seoMetaDescription`
  - `Import`: CSV-Mapping/Validierung mit Pflichtspalten fuer Katalogpflege
- Angezeigt wird:
  - Preis, Bestand, Kategorie, Marke, Produktattribute, SEO-Daten
- Bearbeitbar:
  - Komplette Produktstammdaten

### Blog Management (/admin/blog)
- Interface-Funktionen:
  - Beitragsliste mit Suche
  - Beitrag erstellen, bearbeiten, loeschen
  - Statussteuerung (`draft`, `pending_review`, `published`)
  - Kategorien laden und neue Kategorie direkt anlegen
  - SEO-Felder pro Beitrag pflegen
  - KPI-Kacheln (Total, Published, Draft, Views)
- Untermenuepunkte (erweiterte Funktionen):
  - `Beitragseditor`: `title`, `excerpt`, `content`, `category`, `featuredImage`
  - `Status/Publishing`: Workflowstatus je Beitrag, Sichtbarkeit in der Content-Pipeline
  - `Kategorien`: neue Kategorie mit Slug-Logik aus Namen
  - `SEO`: `seoTitle`, `seoDescription`, `seoKeywords[]`
  - `Performance`: Views und Listenanalyse fuer Redaktionssteuerung
- Angezeigt wird:
  - Beitraege, Kategoriezuordnung, Status, Views, Metadaten
- Bearbeitbar:
  - Blog-Content, Status, Kategorie und SEO-Informationen

### FAQ Management (/admin/faq)
- Interface-Funktionen:
  - FAQ-Liste mit Suche und Kategorienfilter
  - FAQ erstellen, bearbeiten, loeschen
  - Sortier-/Reihenfolgefeld (`order`) je Eintrag
  - Aktivstatus (`isActive`) und Tagging
  - KPI-Kacheln (Anzahl, Kategorien, Views, Helpful Votes)
- Untermenuepunkte (erweiterte Funktionen):
  - `FAQ-Editor`: `question`, `answer`, `category`, `order`, `tags`, `isActive`
  - `Kategorie-Steuerung`: feste Kategorien `General|Repairs|Pricing|Warranty|Shipping|Account|Technical`
  - `Filterung`: Volltext ueber Frage/Antwort/Tags + Kategorienfilter
  - `Engagement`: Zaehler `views`, `helpful`, `notHelpful` fuer Qualitaetsoptimierung
  - `Reihenfolge`: `order` fuer priorisierte Darstellung im Frontend
- Angezeigt wird:
  - FAQ-Inhalte gruppiert nach Kategorie inkl. Nutzungsmetriken
- Bearbeitbar:
  - Fragen/Antworten, Sortierung, Tags, Aktivstatus

### Homepage Management (/admin/homepage)
- Interface-Funktionen:
  - Section-basierter Homepage-Builder (expandierbare Sections)
  - Blockbibliothek mit vorgefertigten Content-Blocktypen
  - Section/Block anlegen, konfigurieren, sortieren, aktivieren/deaktivieren
  - Live-Preview (gesamt, sectionbezogen, blockbezogen)
  - Snapshot-Editor fuer HTML/CSS-Ansicht
  - Persistentes Speichern der gesamten Sections-Struktur
- Untermenuepunkte (erweiterte Funktionen):
  - `Sections`: `name`, `layout`, `order`, `isActive`, `settings.*`
  - `Blocks`: Typen wie `hero`, `services`, `blog`, `shop`, `contact`, `cta`, `footer`, `html`
  - `Styling`: `backgroundColor`, `textColor`, `padding`, `margin`, `alignment`, `customCSS`, visuelle Effekte
  - `Preview`: Full Preview, Section Preview, Block Preview fuer sichere Freigaben
  - `Templates/AB`: Layout-Templates und A/B-Test-Endpunkte fuer Erweiterungen
- Angezeigt wird:
  - Aktuelle Homepage-Struktur mit Sections und Blocks
- Bearbeitbar:
  - Inhalt, Layout und Darstellung der kompletten Startseite

### Website Builder (/admin/website-builder)
- Interface-Funktionen:
  - Vollstaendige Website-Einstellungen in Tabs
  - Abschnitte: General, SEO, Layout, Header/Footer, Color Scheme, Typography, Animationen, Custom CSS/JS, Integrationen
  - Publish-, Backup- und Export-Funktion
  - Device-Preview (Desktop/Tablet/Mobile)
- Untermenuepunkte (erweiterte Funktionen):
  - `General`: `projectTitle`, Domain- und Sprachkonfiguration
  - `SEO`: Titel, Description, Keywords, Indexing, OG/Twitter-Card
  - `Layout/Header/Footer/Navigation`: Struktur-, Navigations- und Branding-Einstellungen
  - `Design-System`: Color Scheme, Typography, Spacing, Radius, Shadows, Background
  - `Responsive/Animation`: Breakpoints, responsive Regeln, Motion-Parameter
  - `Custom/Integrationen`: Custom CSS/JS, Analytics/Tag Manager/Pixel/Cookie Banner
  - `Pages`: Seiten anlegen, veroeffentlichen, loeschen, Template anwenden, in Visual Builder oeffnen
- Konfigurierbar:
  - Globale Website-Darstellung und technische Integrationen

### Visual Builder (/admin/visual-builder/:pageId)
- Interface-Funktionen:
  - Seiteninhalt auf Komponentenebene erstellen und bearbeiten
  - Section/Component Library, Canvas, Settings Panel
  - Undo/Redo, Versionierung, Restore
  - Save und Publish
  - Responsive Preview
- Untermenuepunkte (erweiterte Funktionen):
  - `Canvas-Struktur`: Sections/Components hinzufuegen, aktualisieren, entfernen, reorder
  - `Element-Settings`: Editieren von Section- und Component-Properties
  - `Global Styles`: `globalStyles`, `customCSS`, `customJS` auf Seitenebene
  - `Versionierung`: manuelle Version-Snapshots, History laden, Restore
  - `Undo/Redo`: Bearbeitungssicherheit waehrend des Designs
  - `Publishing`: Save + Publish je Seite mit Device-Preview
- Bearbeitbar:
  - Struktur und Inhalt einzelner Seiten inkl. globaler Styles

### SEO Management (/admin/seo)
- Interface-Funktionen:
  - SEO-Settings je Seitentyp/Seite
  - Analytics-Summary und Sitemap-Daten
  - Erstellen/Bearbeiten/Loeschen von SEO-Eintraegen
- Konfigurierbar:
  - Meta Title/Description, Keywords, Canonical, OpenGraph, Twitter Card, Robots, Priority/ChangeFreq

## Marketing/Promo

### Uebersicht (/admin/marketing-promo)
- KPI-Dashboard fuer Newsletter und Promo-Codes
- Schnellzugriff auf Unterbereiche
- Letzte Aktionen/Audit

### Newsletter (/admin/marketing-promo/newsletters)
- Newsletter anlegen, bearbeiten, duplizieren, archivieren
- Segment- und Promo-Code-Verknuepfung
- Platzhalterverwaltung und Live-Vorschau
- Testversand, Terminplanung, Sofortversand

### Promo Codes (/admin/marketing-promo/promo-codes)
- Promo-Code erstellen/bearbeiten/aktivieren/deaktivieren/archivieren
- Regeln: Laufzeit, Limits, Mindestbestellwert, Kombinierbarkeit
- KPI-Anzeige pro Code (Usage, Discount Volume, Revenue)

### Segmente (/admin/marketing-promo/segments)
- Zielgruppenregeln erstellen und pflegen
- Vorschau auf Trefferanzahl
- Aktiv/Archiviert-Steuerung

### Reports (/admin/marketing-promo/reports)
- Kampagnen- und Redemptions-Reporting
- Delivery-Status-Auswertung
- Audit-Log Einsicht

### Einstellungen (/admin/marketing-promo/settings)
- Versanddefaults (From/Reply-To, Batchgroesse)
- Tracking-Schalter (Opens, Clicks)
- Testversand-Freigabe

## System Management

### System Configuration (/admin/system)
- Interface-Funktionen:
  - Globale Systemkonfiguration speichern
  - Notification-Templates (CRUD)
  - Integrationen (CRUD, Test)
  - Cache leeren, Security Scan starten
  - Sprach- und Provider-Konfiguration (integrierte Tabs/Komponenten)
- Konfigurierbar:
  - Systemweit relevante technische und kommunikative Basiseinstellungen

### Email Administration (/admin/email)
- Interface-Funktionen:
  - E-Mail Delivery-Statistik und SMTP-Statistik
  - Delivery Log und SMTP Connection Log mit Filtern/Pagination
  - SMTP-Einstellungen bearbeiten
  - Testmail und Compose-Testmail
  - Logs bereinigen
- Angezeigt wird:
  - Versandstatus, Fehlerraten, Laufzeiten, SMTP-Verbindungsereignisse
- Bearbeitbar:
  - SMTP-Host/Port/Auth/TLS, Benachrichtigungsoptionen

### Live Tracking (/admin/live-tracking)
- Interface-Funktionen:
  - Echtzeitmetriken fuer Sessions und Events
  - Top-Listen (Seiten, Events etc.)
  - Session- und Event-Feeds mit Detailinfos
- Angezeigt wird:
  - Aktivitaet, Endgeraete, Browser/OS, Herkunft, Auth-Status

### Database Management (/admin/database)
- Interface-Funktionen:
  - DB-Monitoring, Health und Operations
  - Backup-Erstellung und Backup-Historie
  - Optimierung und Data-Cleanup
  - Administrative Loeschaktionen fuer Collections/Domainbereiche
- Achtung:
  - Enthaltene Massenloeschfunktionen sind sicherheitskritisch und sollten nur kontrolliert genutzt werden.

### Security Settings (/admin/security)
- Interface-Funktionen:
  - Passwort- und Session-Policy konfigurieren
  - Monitoring fuer aktive Sessions und Loginversuche
  - Force Logout fuer Nutzer
  - IP-Blockierung
  - Security Events und Audit Log
- Konfigurierbar:
  - Security-Grenzwerte, 2FA-Optionen, Sperrregeln

## 5. Zusaetzliche Menuepunkte (ausserhalb der Admin-Gruppen)
- Messages (/messages)
  - Direkter Zugriff auf Nachrichtenbereich.
- Notifications (/notifications)
  - Benachrichtigungscenter; Sidebar zeigt Badge mit ungelesenen Eintraegen.
- Profile (/profile)
  - Profilansicht des angemeldeten Nutzers.

## 6. Operative Standardablaeufe

### Beispiel: Reparaturanfrage bis Auftrag
1. /admin/repair-requests oeffnen
2. Anfrage pruefen, priorisieren, Mitarbeiter zuweisen
3. Kostenschaetzung setzen und mit Kunde kommunizieren
4. Anfrage in Auftrag umwandeln
5. In /admin/bookings oder /admin/orders weiterbearbeiten

### Beispiel: Marketingkampagne
1. Segment in /admin/marketing-promo/segments definieren
2. Promo-Code in /admin/marketing-promo/promo-codes erstellen
3. Newsletter in /admin/marketing-promo/newsletters erstellen
4. Testversand ausfuehren
5. Versand planen oder sofort senden
6. Ergebnis in /admin/marketing-promo/reports kontrollieren

## 7. Hinweise fuer sichere Administration
- Vor Massenaktionen stets Filter und Zielmenge kontrollieren.
- Vor Produktiv-Aenderungen an Templates/SEO/System-Settings idealerweise Export oder Backup erstellen.
- Kritische Funktionen wie Datenloeschung, Security-Policies und Zahlungs-/Rechnungslogik nur mit klaren Freigabeprozessen nutzen.

## 8. Kurzuebersicht aller Admin-Routen
- /admin
- /admin/users
- /admin/customer-groups
- /admin/orders
- /admin/bookings
- /admin/shop
- /admin/services
- /admin/addons
- /admin/service-categories
- /admin/devices
- /admin/analytics
- /admin/blog
- /admin/faq
- /admin/homepage
- /admin/website-builder
- /admin/visual-builder/:pageId
- /admin/seo
- /admin/system
- /admin/email
- /admin/live-tracking
- /admin/marketing-promo
- /admin/marketing-promo/newsletters
- /admin/marketing-promo/promo-codes
- /admin/marketing-promo/segments
- /admin/marketing-promo/reports
- /admin/marketing-promo/settings
- /admin/database
- /admin/security
- /admin/workflow
- /admin/parts
- /admin/staff
- /admin/financial
- /admin/complaints
- /admin/epart-orders
- /admin/repair-requests

## 9. Praxisleitfaden pro Hauptbereich

### 9.1 Dashboard taeglich nutzen
1. Dashboard aufrufen und zuerst den Alert-Bereich pruefen (dringende Hinweise, Prioritaetsauftraege, Team-Ueberlastung).
2. Kachelwerte mit der aktuellen Teamlage vergleichen (ungelesene Nachrichten, offene Buchungen, Systemstatus).
3. Ueber Schnellaktionen direkt in den kritischen Bereich springen.
4. Bei Schichtuebergabe JSON-Export ziehen und intern dokumentieren.

### 9.2 Benutzer sauber verwalten
1. In /admin/users nach Rolle und Status filtern.
2. Vor Aenderungen immer Suchbegriff pruefen (Dubletten vermeiden).
3. Nutzer erstellen mit korrekter Rolle.
4. Nur erforderliche Rollenrechte vergeben (Least Privilege).
5. Inaktive oder veraltete Konten deaktivieren statt sofort loeschen.

### 9.3 Buchungen effizient bearbeiten
1. In /admin/bookings nach Status filtern (z. B. pending/processing).
2. Buchung oeffnen und Timeline + Kommunikation lesen.
3. Status/Billing nur nach fachlicher Plausibilitaet anpassen.
4. Bei Versandfaellen Retourenlabel/Tracking pruefen.
5. Bei Konfliktfaellen Reklamations- oder Erinnerungsdialog nutzen.

### 9.4 Reparaturanfragen in Auftraege ueberfuehren
1. Anfrage in /admin/repair-requests oeffnen.
2. Prioritaet und Mitarbeiterzuweisung setzen.
3. Kostenschaetzung erfassen und Rueckfragen mit Kunde klaeren.
4. Interne Notiz dokumentieren (entscheidungsrelevant).
5. In Auftrag umwandeln und weitere Bearbeitung in Orders/Bookings fortsetzen.

### 9.5 Marketingkampagne standardisiert aufsetzen
1. Segment erstellen oder bestehendes Segment waehlen.
2. Promo-Code inkl. Regeln aktivieren.
3. Newsletter mit Platzhaltern und Vorschau erstellen.
4. Testversand an interne Adresse senden.
5. Versand planen oder sofort senden.
6. Erfolg in Reports pruefen und fuer Folgekampagne optimieren.

## 10. Feld- und Einstellungsreferenz

### 10.1 Typische Statusfelder
- Buchungen:
  - pending, payment-pending, processing, completed, cancelled
- Reparaturanfragen:
  - pending, reviewing, approved, rejected, converted
- Reklamationen:
  - pending_approval, approved, rejected, acknowledged, denied, new_repair, resolved, closed
- Promo-Codes:
  - draft, active, inactive, expired, archived

### 10.2 Prioritaeten
- low: normaler Ablauf, keine Sondereskalation
- normal/medium: Standardprozess
- high: priorisierte Bearbeitung
- urgent: sofortige Bearbeitung mit Teamabstimmung

### 10.3 Finanzrelevante Felder
- taxRate: Steueranteil pro Rechnung/Beleg
- paymentTerms und dueDate: Fälligkeit und Zahlungsziel
- discount: Rabatt auf Positionen oder Gesamtbeleg
- lateFeePercent: Mahn-/Verzugsaufschlag
- invoicePrefix und creditNotePrefix: Nummernlogik fuer Belege

### 10.4 E-Mail- und SMTP-Felder
- smtpHost/smtpPort: Zielserver
- requiresAuthentication: Zugangspflicht aktiv
- requiresTLS: TLS-Verschluesselung aktiv
- smtpUsername/smtpPassword: Zugangsdaten
- enableNotifications: globaler Schalter fuer Systemversand

## 11. Rollen- und Freigabelogik (empfohlene Arbeitsweise)

### 11.1 Kritische Aktionen nur mit Freigabe
- Massenloeschungen in Datenbank/Lager nur nach Vier-Augen-Prinzip.
- Security-Policy-Aenderungen (Session, Login-Limits, 2FA) immer mit Freigabe.
- Finanzdefaults (Steuer/Zahlungsziele) nur mit dokumentierter Wirkungsaenderung.

### 11.2 Dokumentationspflicht bei sensiblen Aenderungen
- Vorher/Nachher-Werte intern festhalten.
- Zeitpunkt und verantwortliche Person dokumentieren.
- Bei Kundenauswirkungen Kommunikationsvorlage vorbereiten.

## 12. Fehlerbehandlung und Troubleshooting

### 12.1 Seite laedt nicht oder zeigt keine Daten
1. Browser neu laden und erneut anmelden.
2. Rechte pruefen (Admin-Rolle vorhanden).
3. Filter zuruecksetzen (Status all, Suche leer).
4. Wenn weiter leer: API/Server-Status intern pruefen.

### 12.2 Speichern/Aktualisieren schlaegt fehl
1. Pflichtfelder kontrollieren.
2. Datums- und Zahlenformate pruefen.
3. Doppelte Schluessel pruefen (z. B. Promo-Code bereits vorhanden).
4. Bei Integrationen: zuerst Verbindungstest ausfuehren.

### 12.3 CSV-Import liefert unerwartete Ergebnisse
1. Spaltenbezeichnungen und Pflichtfelder in der CSV pruefen.
2. Numerische Felder ohne Sonderzeichen formatieren.
3. Testimport mit kleiner Datei starten.
4. Nach Import Stichprobe in Tabelle kontrollieren.

### 12.4 E-Mail-Versand funktioniert nicht
1. SMTP-Konfiguration in /admin/email pruefen.
2. Testmail senden und Logeintrag analysieren.
3. Auth/TLS-Parameter mit Provider abgleichen.
4. Falls noetig in /admin/system Integration/Provider-Einstellungen pruefen.

## 13. Qualitaetssicherung vor Produktiv-Aenderungen
- Immer zuerst in kleinem Umfang testen (z. B. ein Datensatz, ein Segment, ein Newsletter-Test).
- Vor groesseren Eingriffen Export oder Backup erstellen.
- Nach Aenderung die Zielansicht und mindestens eine Folgeansicht pruefen.
- Bei Workflows und Vorlagen einen End-to-End-Durchlauf simulieren.

## 14. Einarbeitung neuer Admins (Empfehlung)
1. Start mit Dashboard, Bookings, Repair Requests.
2. Danach User Management, Staff Management, Complaints.
3. Erst anschliessend System/Database/Security.
4. Marketing/Promo und Website Builder nach Prozessverstaendnis.
5. Abschlusstest mit drei Uebungsszenarien:
   - Reparaturanfrage zu Auftrag
   - Promo-Kampagne mit Testversand
   - Reklamation inklusive Statusentscheidung

## 15. Screenshot-Platzhalter pro Menuepunkt

Hinweis zur Nutzung:
- Pro Menuepunkt ist ein Platzhalter mit vorgeschlagenem Dateinamen hinterlegt.
- Nach Aufnahme einfach Screenshot in den angegebenen Pfad speichern und den Platzhalter-Kommentar entfernen.
- Empfehlung: Einheitliches Format 1920x1080, Browser-Zoom 100 Prozent, gleiche Spracheinstellung.

### 15.1 Dashboard

#### Dashboard (/admin)
Dateiname: screenshots/admin/01-dashboard.png

![Screenshot - Dashboard](screenshots/admin/01-dashboard.png)

Aufnahmeinhalt:
- KPI-Kacheln, Alert-Bar, Schnellaktionen sichtbar

#### Messages (/messages)
Dateiname: screenshots/admin/02-messages.png

![Screenshot - Messages](screenshots/admin/02-messages.png)

Aufnahmeinhalt:
- Nachrichtenliste und Detailbereich

#### Notifications (/notifications)
Dateiname: screenshots/admin/03-notifications.png

![Screenshot - Notifications](screenshots/admin/03-notifications.png)

Aufnahmeinhalt:
- Benachrichtigungsliste mit ungelesenen Eintraegen

#### Profile (/profile)
Dateiname: screenshots/admin/04-profile.png

![Screenshot - Profile](screenshots/admin/04-profile.png)

Aufnahmeinhalt:
- Profilstammdaten und Kontoeinstellungen

### 15.2 User Management

#### User Management (/admin/users)
Dateiname: screenshots/admin/10-users.png

![Screenshot - User Management](screenshots/admin/10-users.png)

Aufnahmeinhalt:
- Filterleiste, Tabelle, Aktionsmenue

#### Customer Groups (/admin/customer-groups)
Dateiname: screenshots/admin/11-customer-groups.png

![Screenshot - Customer Groups](screenshots/admin/11-customer-groups.png)

Aufnahmeinhalt:
- Tabs fuer Gruppen/Regeln/Zuweisungen

#### Staff Management (/admin/staff)
Dateiname: screenshots/admin/12-staff-management.png

![Screenshot - Staff Management](screenshots/admin/12-staff-management.png)

Aufnahmeinhalt:
- Tabs Status/Staff/Teams/Workload/Performance

### 15.3 Order Management

#### Bookings (/admin/bookings)
Dateiname: screenshots/admin/20-bookings.png

![Screenshot - Bookings](screenshots/admin/20-bookings.png)

Aufnahmeinhalt:
- Buchungstabelle mit Status/Billing-Filter

#### Service Management (/admin/services)
Dateiname: screenshots/admin/21-services.png

![Screenshot - Service Management](screenshots/admin/21-services.png)

Aufnahmeinhalt:
- Service-Liste mit Sortierung und Aktionsbuttons

#### Add-On Services (/admin/addons)
Dateiname: screenshots/admin/22-addons.png

![Screenshot - Add-On Services](screenshots/admin/22-addons.png)

Aufnahmeinhalt:
- Add-on-Tabelle mit Kategorie/Preis

#### Service Categories (/admin/service-categories)
Dateiname: screenshots/admin/23-service-categories.png

![Screenshot - Service Categories](screenshots/admin/23-service-categories.png)

Aufnahmeinhalt:
- Kategorienliste inkl. Aktivstatus

#### Device Management (/admin/devices)
Dateiname: screenshots/admin/24-devices.png

![Screenshot - Device Management](screenshots/admin/24-devices.png)

Aufnahmeinhalt:
- Device-Dashboard oder Modelverwaltung

#### Parts Management (/admin/parts)
Dateiname: screenshots/admin/25-parts.png

![Screenshot - Parts Management](screenshots/admin/25-parts.png)

Aufnahmeinhalt:
- Teileliste, Bestand, Filter

#### EPart Orders (/admin/epart-orders)
Dateiname: screenshots/admin/26-epart-orders.png

![Screenshot - EPart Orders](screenshots/admin/26-epart-orders.png)

Aufnahmeinhalt:
- Bestellliste, Lieferantenbezug, Status

#### Workflow Management (/admin/workflow)
Dateiname: screenshots/admin/27-workflow.png

![Screenshot - Workflow Management](screenshots/admin/27-workflow.png)

Aufnahmeinhalt:
- Workflow-Karten/Liste und Status

#### Analytics (/admin/analytics)
Dateiname: screenshots/admin/28-analytics.png

![Screenshot - Analytics](screenshots/admin/28-analytics.png)

Aufnahmeinhalt:
- KPI- oder Profitabilitaetsansicht

#### Repair Requests (/admin/repair-requests)
Dateiname: screenshots/admin/29-repair-requests.png

![Screenshot - Repair Requests](screenshots/admin/29-repair-requests.png)

Aufnahmeinhalt:
- Anfrage-Liste mit Status/Prioritaet

#### Financial Management (/admin/financial)
Dateiname: screenshots/admin/30-financial.png

![Screenshot - Financial Management](screenshots/admin/30-financial.png)

Aufnahmeinhalt:
- Invoices/Payments Uebersicht

#### Complaints (/admin/complaints)
Dateiname: screenshots/admin/31-complaints.png

![Screenshot - Complaints](screenshots/admin/31-complaints.png)

Aufnahmeinhalt:
- Reklamationsliste und Statusaktionen

### 15.4 Content Management

#### Web Shop Management (/admin/shop)
Dateiname: screenshots/admin/40-shop.png

![Screenshot - Web Shop Management](screenshots/admin/40-shop.png)

Aufnahmeinhalt:
- Produktliste mit Such/Filterbereich

#### Blog Management (/admin/blog)
Dateiname: screenshots/admin/41-blog.png

![Screenshot - Blog Management](screenshots/admin/41-blog.png)

Aufnahmeinhalt:
- Blog-Beitragsliste und Aktionen

#### FAQ Management (/admin/faq)
Dateiname: screenshots/admin/42-faq.png

![Screenshot - FAQ Management](screenshots/admin/42-faq.png)

Aufnahmeinhalt:
- FAQ-Liste und Bearbeitungsoptionen

#### Homepage Management (/admin/homepage)
Dateiname: screenshots/admin/43-homepage.png

![Screenshot - Homepage Management](screenshots/admin/43-homepage.png)

Aufnahmeinhalt:
- Block-/Sektionenverwaltung der Startseite

#### Website Builder (/admin/website-builder)
Dateiname: screenshots/admin/44-website-builder.png

![Screenshot - Website Builder](screenshots/admin/44-website-builder.png)

Aufnahmeinhalt:
- Builder-Tabs und Publish/Backup-Bereich

#### Visual Builder (/admin/visual-builder/:pageId)
Dateiname: screenshots/admin/45-visual-builder.png

![Screenshot - Visual Builder](screenshots/admin/45-visual-builder.png)

Aufnahmeinhalt:
- Canvas + Komponentenbibliothek + Settings

#### SEO Management (/admin/seo)
Dateiname: screenshots/admin/46-seo.png

![Screenshot - SEO Management](screenshots/admin/46-seo.png)

Aufnahmeinhalt:
- SEO-Tabellenbereich und Filter

### 15.5 Marketing/Promo

#### Uebersicht (/admin/marketing-promo)
Dateiname: screenshots/admin/50-marketing-overview.png

![Screenshot - Marketing Overview](screenshots/admin/50-marketing-overview.png)

Aufnahmeinhalt:
- KPI-Karten und letzte Aktivitaeten

#### Newsletter (/admin/marketing-promo/newsletters)
Dateiname: screenshots/admin/51-marketing-newsletters.png

![Screenshot - Marketing Newsletters](screenshots/admin/51-marketing-newsletters.png)

Aufnahmeinhalt:
- Newsletter-Liste und Versandaktionen

#### Promo Codes (/admin/marketing-promo/promo-codes)
Dateiname: screenshots/admin/52-marketing-promo-codes.png

![Screenshot - Marketing Promo Codes](screenshots/admin/52-marketing-promo-codes.png)

Aufnahmeinhalt:
- Promo-Code-Liste und Statusschalter

#### Segmente (/admin/marketing-promo/segments)
Dateiname: screenshots/admin/53-marketing-segments.png

![Screenshot - Marketing Segments](screenshots/admin/53-marketing-segments.png)

Aufnahmeinhalt:
- Segmentliste und Vorschau-Info

#### Reports (/admin/marketing-promo/reports)
Dateiname: screenshots/admin/54-marketing-reports.png

![Screenshot - Marketing Reports](screenshots/admin/54-marketing-reports.png)

Aufnahmeinhalt:
- Delivery-Stats, KPI-Bloecke, Audit-Log

#### Einstellungen (/admin/marketing-promo/settings)
Dateiname: screenshots/admin/55-marketing-settings.png

![Screenshot - Marketing Settings](screenshots/admin/55-marketing-settings.png)

Aufnahmeinhalt:
- Globale Marketing-Defaults und Tracking-Optionen

### 15.6 System Management

#### System Configuration (/admin/system)
Dateiname: screenshots/admin/60-system-configuration.png

![Screenshot - System Configuration](screenshots/admin/60-system-configuration.png)

Aufnahmeinhalt:
- Konfig-Tabs und Integrationsbereich

#### Email Administration (/admin/email)
Dateiname: screenshots/admin/61-email-administration.png

![Screenshot - Email Administration](screenshots/admin/61-email-administration.png)

Aufnahmeinhalt:
- SMTP-Settings und Delivery-Logs

#### Live Tracking (/admin/live-tracking)
Dateiname: screenshots/admin/62-live-tracking.png

![Screenshot - Live Tracking](screenshots/admin/62-live-tracking.png)

Aufnahmeinhalt:
- Echtzeitmetriken + Session/Event-Feed

#### Database Management (/admin/database)
Dateiname: screenshots/admin/63-database-management.png

![Screenshot - Database Management](screenshots/admin/63-database-management.png)

Aufnahmeinhalt:
- DB-Health, Backup und Operations

#### Security Settings (/admin/security)
Dateiname: screenshots/admin/64-security-settings.png

![Screenshot - Security Settings](screenshots/admin/64-security-settings.png)

Aufnahmeinhalt:
- Security-Policy + Sessions + Audit-Tab

## 15.7 Detailansichten und Dialoge (mit eingebetteten Screenshots)

Hinweis:
- Die folgenden Screenshots zeigen reale Detail-/Bearbeitungsdialoge aus dem Admin-Panel.
- Jeder Screenshot ist dem passenden Menüpunkt zugeordnet.
- Unter jedem Bild sind die wichtigsten sichtbaren Informationsbereiche dokumentiert.

### User Management

#### User Management - Detaildialog
Dateiname: screenshots/admin/dialogs/10-users-detail.png

![Screenshot - User Management Detaildialog](screenshots/admin/dialogs/10-users-detail.png)

Angezeigte Informationen:
- Nutzeridentitaet (Name, E-Mail, Telefon)
- Rollen- und Statusinformationen
- Eingabefelder fuer Bearbeitung und Speichern/Abbrechen-Aktionen

### Order Management

#### Bookings - Detaildialog
Dateiname: screenshots/admin/dialogs/20-bookings-detail.png

![Screenshot - Bookings Detaildialog](screenshots/admin/dialogs/20-bookings-detail.png)

Angezeigte Informationen:
- Buchungskopf mit Kundenzuordnung und Status
- Positions- und Kosteninformationen je Buchung
- Aktionsbereich fuer Detail, Rechnung, Erinnerung und Reklamation

#### Repair Requests - Detaildialog
Dateiname: screenshots/admin/dialogs/29-repair-requests-detail.png

![Screenshot - Repair Requests Detaildialog](screenshots/admin/dialogs/29-repair-requests-detail.png)

Angezeigte Informationen:
- Anfragekontext inkl. Nummer, Status und Prioritaet
- Kommunikations-/Notizbereich fuer interne und externe Bearbeitung
- Operative Aktionen wie Zuweisung, Statusaenderung und Konvertierung

#### Service Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/21-services-detail.png

![Screenshot - Service Management Detaildialog](screenshots/admin/dialogs/21-services-detail.png)

Angezeigte Informationen:
- Service-Stammdaten (Name, Kategorie, Beschreibung)
- Preis- und Zeitfelder
- Aktionsbuttons fuer Speichern/Schliessen

#### Add-On Services - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/22-addons-detail.png

![Screenshot - Add-On Services Detaildialog](screenshots/admin/dialogs/22-addons-detail.png)

Angezeigte Informationen:
- Add-on-Stammdaten (Name, Kategorie, Beschreibung)
- Preis, Dauer und Kompatibilitaetsparameter
- Aktivstatus und Formularaktionen

#### Device Management - Detailansicht
Dateiname: screenshots/admin/dialogs/24-devices-detail.png

![Screenshot - Device Management Detailansicht](screenshots/admin/dialogs/24-devices-detail.png)

Angezeigte Informationen:
- Geräte-/Modellparameter (Name, Typ, Marke)
- Technische und katalogbezogene Felder
- Bearbeitungs- und Navigationsaktionen

#### Parts Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/25-parts-detail.png

![Screenshot - Parts Management Detaildialog](screenshots/admin/dialogs/25-parts-detail.png)

Angezeigte Informationen:
- Teilebezeichnung, Kategorie, Kompatibilitaet
- Bestands-/Preisfelder je Version
- Lieferanten- und Lagerinformationen

#### EPart Orders - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/26-epart-orders-detail.png

![Screenshot - EPart Orders Detaildialog](screenshots/admin/dialogs/26-epart-orders-detail.png)

Angezeigte Informationen:
- Lieferanten- und Bestellkopf
- Positionszeilen mit Menge und Einzelpreis
- Status- und Datumsfelder fuer Bestellprozess

#### Workflow Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/27-workflow-detail.png

![Screenshot - Workflow Management Detaildialog](screenshots/admin/dialogs/27-workflow-detail.png)

Angezeigte Informationen:
- Workflow-Metadaten (Name, Beschreibung, Aktivstatus)
- Struktur-/Schrittinformationen
- Aktionen fuer Speichern und weitere Bearbeitung

#### Complaints - Detaildialog
Dateiname: screenshots/admin/dialogs/31-complaints-detail.png

![Screenshot - Complaints Detaildialog](screenshots/admin/dialogs/31-complaints-detail.png)

Angezeigte Informationen:
- Reklamationskontext (Vorgang, Kunde, Kategorie)
- Status-/Entscheidungsoptionen und Notizbereiche
- Kommunikations- und Bearbeitungsaktionen

#### Financial Management - Detaildialog
Dateiname: screenshots/admin/dialogs/30-financial-detail.png

![Screenshot - Financial Management Detaildialog](screenshots/admin/dialogs/30-financial-detail.png)

Angezeigte Informationen:
- Finanzmodul-Detailbereich (Rechnungen/Zahlungen/Provider)
- Detailaktionen fuer Rechnungs- und Statusverarbeitung
- Konfigurationsbezug fuer Payment-Provider und Abrechnungsparameter

### Content Management

#### Web Shop Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/40-shop-detail.png

![Screenshot - Web Shop Management Detaildialog](screenshots/admin/dialogs/40-shop-detail.png)

Angezeigte Informationen:
- Produktstammdaten (Titel, Kategorie, Marke)
- Preis-/Bestandsfelder
- Inhalts-/SEO-nahe Eingabebereiche

#### Blog Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/41-blog-detail.png

![Screenshot - Blog Management Detaildialog](screenshots/admin/dialogs/41-blog-detail.png)

Angezeigte Informationen:
- Beitragstitel, Slug, Kategorie
- Inhaltsfeld und Veröffentlichungsstatus
- Redaktionsaktionen (Speichern/Publizieren)

#### FAQ Management - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/42-faq-detail.png

![Screenshot - FAQ Management Detaildialog](screenshots/admin/dialogs/42-faq-detail.png)

Angezeigte Informationen:
- Frage-/Antwortstruktur
- Kategorie, Reihenfolge, Aktivstatus
- Formularaktionen fuer Pflege des FAQ-Eintrags

### Marketing/Promo

#### Newsletter - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/51-marketing-newsletters-detail.png

![Screenshot - Marketing Newsletters Detaildialog](screenshots/admin/dialogs/51-marketing-newsletters-detail.png)

Angezeigte Informationen:
- Kampagnenmetadaten (interner Name, Betreff, Preheader)
- Segment-/Versandoptionen
- Inhaltsbereich und Versandaktionen

#### Promo Codes - Detail-/Bearbeitungsdialog
Dateiname: screenshots/admin/dialogs/52-marketing-promo-codes-detail.png

![Screenshot - Marketing Promo Codes Detaildialog](screenshots/admin/dialogs/52-marketing-promo-codes-detail.png)

Angezeigte Informationen:
- Code, Rabatttyp, Wert und Laufzeit
- Nutzungsregeln (Limit, Mindestbestellwert, Kombinierbarkeit)
- Statussteuerung und Speichern-Aktion

### System Management

#### System Configuration - Detaildialog
Dateiname: screenshots/admin/dialogs/60-system-configuration-detail.png

![Screenshot - System Configuration Detaildialog](screenshots/admin/dialogs/60-system-configuration-detail.png)

Angezeigte Informationen:
- Vorlagen-/Integrationsnahe Detail- und Bearbeitungsbereiche
- Formularfelder fuer Template- und Systemparameter
- Dialogaktionen fuer Erstellen, Bearbeiten und Speichern

#### Email Administration - Detaildialog
Dateiname: screenshots/admin/dialogs/61-email-administration-detail.png

![Screenshot - Email Administration Detaildialog](screenshots/admin/dialogs/61-email-administration-detail.png)

Angezeigte Informationen:
- SMTP-/Versanddetailbereich mit Test- und Detailaktionen
- Dialoginhalte fuer Testversand oder Log-Details
- Konfigurations- und Kontrollfelder fuer den Mailversand

#### Security Settings - Detaildialog
Dateiname: screenshots/admin/dialogs/64-security-settings-detail.png

![Screenshot - Security Settings Detaildialog](screenshots/admin/dialogs/64-security-settings-detail.png)

Angezeigte Informationen:
- Sicherheitsbezogene Detailinformationen (Loginversuche/IP-Bezug)
- Dialogkontext fuer Sperraktion bzw. Sicherheitsmassnahme
- Aktionsflaechen fuer Bestaetigung oder Abbruch

## 16. Uebersicht bearbeitbarer Datenfelder pro Menue

Hinweis zur Lesart:
- Bearbeitbares Feld: Name wie im UI oder als fachlicher Feldbegriff.
- Inhalt: Welche Information eingetragen oder geaendert wird.
- Verwendet in: Wo der Wert im System sichtbar, berechnet oder weiterverarbeitet wird.

### 16.1 User Management

#### /admin/users
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| name | Anzeigename des Nutzers | Nutzerlisten, Detailansicht, Kommunikation |
| email | Login- und Kontaktadresse | Login, Benachrichtigungen, Kunden-/Mitarbeiterkommunikation |
| phone | Telefonnummer | Profil, Kontaktlisten, operative Rueckfragen |
| password (bei Neuanlage) | Initiales Kennwort | Authentifizierung |
| role | customer/staff/admin | Rechtepruefung, sichtbare Menues, Protected Routes |
| status | active/inactive | Loginfaehigkeit, Filter, operative Verfuegbarkeit |
| customerGroupId (Filter/Zuordnung) | Gruppenzugehoerigkeit | Preis-/Finanzlogik, Segmentierung, Kundensteuerung |
| sendWelcomeEmail | Versand bei Anlage | Onboarding-Kommunikation |

#### /admin/customer-groups
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| key, name, description | Technischer Schluessel + Gruppenname | Gruppenlisten, regelbasierte Zuordnung |
| status | draft/active/inactive/archived | Aktivierbarkeit in Regeln/Manueller Zuweisung |
| priority | Prioritaet bei Regelkonflikten | Konfliktaufloesung bei Mehrfachtreffern |
| isExclusive, isDefault | Exklusiv-/Default-Flag | Automatische Standardzuweisung, Konfliktlogik |
| validFrom, validUntil | Gueltigkeitszeitraum | Zeitlich gesteuerte Gruppenzuordnung |
| assignmentMode (manual/rule/api) | Erlaubte Zuweisungswege | UI-Funktionen, API-Assignments |
| financeProfile.* | Zahlungsziele, Rabatte, Kreditgrenzen, Rechnungseinstellungen | Rechnungs-/Finanzprozesse, Zahlungsbedingungen |
| affiliateProfile.* | Attribution, Provision, Hold-Days | Affiliate-Abrechnung, Marketingzuordnung |
| conflictPolicy.* | Fallback/Exclusions/Strategie | Regelengine bei konkurrierenden Gruppen |
| rules.conditions/excludedIf | Bedingungslogik | Automatische Gruppenselektion + Preview |

#### /admin/staff
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| staff.name, email, role | Mitarbeiteridentitaet und Rolle | Teamlisten, Zuweisungsdialoge, Rechte |
| department, specializations | Fachbereich und Skills | Workload/Teamplanung, Aufgabenrouting |
| team.name, leaderId, members | Teamstruktur | Teamansicht, Auslastung, Reporting |
| task.title, description | Aufgabenbeschreibung | Tasklisten, operative Tagessteuerung |
| task.priority, category | Prioritaet und Aufgabentyp | Filter, Eskalation, Reporting |
| task.assignedTo, dueDate | Verantwortlicher + Faelligkeit | Aufgabensteuerung, Erinnerungslogik |

### 16.2 Order Management

#### /admin/bookings
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| status | Buchungsstatus (z. B. processing/completed) | Buchungslisten, KPI, Prozessfortschritt |
| billingStatus | unpaid/partially-paid/paid | Finanzstatus, Rechnungsaktionen, Mahnlogik |
| timeline.description | Prozesskommentar bei Statuswechsel | Detailhistorie, Nachvollziehbarkeit |
| complaint data | Reklamationsinhalt zur Buchung | Reklamationsprozess, Eskalationen |
| reminder data | Erinnerungsinhalt | Follow-up-Kommunikation |
| return/shipping status | Versand-/Retoure-Lebenszyklus | Trackingansichten, Kundeninfo |

#### /admin/services
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| articleNumber, name, service | Service-ID und Titel | Servicekatalog, Suchtreffer, Angebot |
| shortDescription, description | Kurz-/Langbeschreibung | Kundenansicht, interne Uebersicht |
| price, purchasePrice, msrp | Preisstruktur | Kalkulation, Checkout, Marge |
| estimatedTime | Soll-Bearbeitungszeit | Workflow-Planung, SLA, Auslastung |
| category, deviceTypes | Kategorisierung und Zielgeraete | Filter, Auswahl im Reparaturprozess |
| manufacturer, model | Hersteller-/Modellbezug | Kompatibilitaet, Suche, Routing |
| internalRepairInfo | interne Anweisung | Werkstatt-/Staff-Prozess |
| externalRepairInfo | kundenrelevante Info | Angebotstexte, Kommunikation |
| seo* und searchKeywords | SEO-Metadaten | Shop/SEO-Indexierung, Suchbarkeit |

#### /admin/addons
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| name, description | Add-on-Leistung | Add-on-Katalog, Checkout |
| price, estimatedTime | Preis + Bearbeitungszeit | Auftragssumme, Kapazitaetsplanung |
| category | Fachliche Einordnung | Filter, Katalognavigation |
| compatibility[] | DeviceType/Brand-Regeln | Angebotslogik, passende Vorschlaege |
| bundleDiscount | Kombi-Rabatt | Preisberechnung bei Add-on-Bundles |
| popularity | Sortier-/Empfehlungssignal | Listenranking |

#### /admin/service-categories
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| name, description | Kategoriename und Kontext | Services/Add-ons Filter und Gruppierung |
| type | repair oder addon | Trennung der Katalogbereiche |
| icon, color | visuelle Kennzeichnung | UI-Darstellung im Admin |
| order | Sortierreihenfolge | Anzeigeprioritaet |
| isActive | Aktivstatus | Sichtbarkeit in Auswahlfeldern |

#### /admin/devices
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| deviceType.name/key | Geraetekategorie | Servicezuordnung, Filter, Modellmapping |
| brand.name/logo | Markenstammdaten | Device-Listen, Produkt-/Servicebezug |
| model.name, modelNumbers | Modellidentitaet | Diagnose-/Reparaturzuordnung |
| commonProblems[] | typische Defekte | Diagnosehilfe, interne Hinweise |
| specifications.* | technische Spezifikationen | Modellansicht, interne Referenz |
| releaseDate, colors, price | Marktdaten | Beratung, Vergleich, Dokumentation |

#### /admin/parts
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| itemName, itemDescription | Teilebezeichnung | Lagerliste, Auswahl in Bestellungen |
| category, manufacturer, model | Klassifizierung | Suche, Kompatibilitaet |
| compatibleDevices[] | Geraetekompatibilitaet | Reparatur- und Bedarfsplanung |
| specifications | Technische Eckdaten | Werkstattinformationen |
| versions[].quantity | Bestand je Variante | Lagerstatus, Low-Stock-Warnung |
| versions[].minStockLevel/reorderLevel | Schwellwerte | Nachbestelllogik |
| versions[].unitCost/sellingPrice | Kosten/Verkaufspreis | Margen- und Preisberechnung |
| versions[].supplierInfo | Lieferantendaten | Einkauf/Disposition |

#### /admin/epart-orders
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| supplierId | Lieferant | Einkaufsprozess, Lieferantenreport |
| items[].partId, quantity, unitPrice | Bestellpositionen | Kosten, Wareneingang, Nachverfolgung |
| expectedDeliveryDate | Liefertermin | Planung, Verzugsmonitoring |
| tax, shippingCost | Nebenkosten | Gesamtkostenkalkulation |
| paymentMethod | Zahlungsart | Einkaufs- und Finanzprozess |
| notes | operative Notizen | Teamkommunikation |
| invoice upload | Rechnungsdokument | Belegablage, Finanzabgleich |
| return/exchange payload | Rueckgabe-/Umtauschantrag | Retourenworkflow |

#### /admin/workflow
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| name, description | Workflow-Identitaet | Workflow-Liste, Auswahl |
| deviceTypes, serviceTypes | Zielbereich des Workflows | Automatische Zuordnung |
| isActive | Aktivstatus | Operative Nutzung |
| estimatedTotalTime | Erwartete Gesamtdauer | Planung, KPI |
| steps / automation rules (Visual Builder) | Prozessschritte und Trigger | Ausfuehrung im Reparaturprozess |

#### /admin/analytics
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| labor.* | Stunden-/Arbeitsparameter | Profitberechnung |
| materials.* | Materialkostenannahmen | Margenmodell |
| overhead.* | fixe Kostenstruktur | Kostenverteilung auf Auftraege |
| depreciation.* | Abschreibungen | Vollkostenkalkulation |
| accounting.* | VAT/Zielmarge/Projektionswerte | KPI-Auswertung |
| formula.* | Gewichtungen im Modell | Reportinglogik |

#### /admin/repair-requests
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| status | Bearbeitungsstatus | Anfrage-Liste, Prozesssteuerung |
| priority | Dringlichkeit | Sortierung, Eskalation |
| estimatedCost | Kostenschaetzung | Freigabeentscheidung, Conversion |
| assignedStaffId | verantwortlicher Mitarbeiter | Teamsteuerung |
| adminNote | interne Notiz | Verlauf und interne Abstimmung |
| customer message | Kundenkommunikation | Anfrage-Historie |
| selectedServices (bei Conversion) | Leistungsumfang fuer Auftrag | Erstellung Repair-Order |

#### /admin/financial
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| invoice.items[] | Rechnungspositionen | Rechnungssumme, Buchhaltung |
| invoice.status | Lebenszyklus (draft/sent/paid etc.) | Offene Posten, Mahnwesen |
| payment.amount/method/date | Zahlungserfassung | Zahlungsjournal, Reports |
| dunning settings/run items | Mahnregeln und Mahnlaeufe | Forderungsmanagement |
| credit note fields | Gutschriftgrund/Umfang | Korrekturbuchungen |
| financialSettings.defaults.* | Systemdefaults (Steuer, Faelligkeit, Prefixe) | Alle neuen Finanzdokumente |
| payment gateway config | Provider-spezifische Konfiguration | Zahlungsabwicklung |

#### /admin/complaints
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| complaint status actions | approve/reject/ack/deny etc. | Reklamationsprozess |
| rejectionReason/technicianReason | Begruendung | Audit, Kundenkommunikation |
| partialRefund | Teilrueckerstattungsbetrag | Finanzabwicklung |
| additionalPart* | Zusatzteil fuer Nacharbeit | Folgeauftrag, Kosten |
| offerAmount/offerDescription | Kulanz-/Angebotsparameter | Kundenangebot |
| complaintMessage + internalNote flag | externe/interne Kommunikation | Verlauf, Transparenz |

### 16.3 Content Management

#### /admin/shop
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| name, description | Produkttitel und Text | Shop-Listing, Produktdetail |
| price, originalPrice | aktueller/alter Preis | Preisanzeige, Rabattdarstellung |
| category, brand | Produktklassifikation | Filter und Navigation |
| stockCount | Lagerbestand | Verfuegbarkeit |
| images[], features[], compatibility[] | Medien und Produktdetails | Produktseite |
| dimensions, weight | physische Daten | Versand-/Produktinfo |
| seo* und searchKeywords | SEO-Meta | Suchmaschinen und interne Suche |

#### /admin/blog, /admin/faq, /admin/homepage
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| Titel/Slug/Kategorie (je nach Modul) | Inhaltsstruktur | Oeffentliche Content-Seiten |
| Teaser-/Langtext | redaktioneller Inhalt | Seiteninhalt und Vorschauen |
| Publish-/Status-Felder | Sichtbarkeit | Live-Schaltung im Frontend |

#### /admin/website-builder
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| general settings | Grundkonfiguration der Website | globale Darstellung |
| header/footer config | Navigations- und Footerstruktur | alle Seiten |
| colorScheme, typography | visuelle Grundlagen | Theme/Branding |
| animations | Bewegungsverhalten | UX und Frontend-Effekte |
| customCSS/customJS | individuelle Erweiterungen | Rendering/Interaktion |
| integrations | externe Dienste | Tracking, Marketing, Tools |

#### /admin/visual-builder/:pageId
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| sections[] | Seitenabschnitte | Seitenlayout |
| components[] | Inhaltelemente pro Abschnitt | Page Content |
| component.content/styles | Text/Medien und Design | Frontend-Darstellung |
| globalStyles, customCSS, customJS | seitenweite Darstellung/Logik | Zielseite im Frontend |
| version history | manuelle Snapshots/Restore | Redaktionssicherheit |

#### /admin/seo
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| title, description, keywords | SEO-Kernmetadaten | Suchergebnisse |
| canonicalUrl | kanonische URL | Duplicate-Content-Vermeidung |
| openGraph.*, twitterCard.* | Social-Meta | Link-Vorschau in Social/Chat |
| robots.* | Indexierungsregeln | Suchmaschinen-Crawler |
| priority, changeFreq | Sitemap-Steuerung | Crawling-Priorisierung |

### 16.4 Marketing/Promo

#### /admin/marketing-promo/newsletters
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| internalName, subject, preheader | Kampagnenidentitaet | Newsletter-Liste, Versandkopf |
| content | HTML/Text-Inhalt | Mail-Body |
| segmentId | Zielsegment | Empfaengerselektion |
| promoCodeIds | verknuepfte Codes | personalisierte Mailinhalte |
| status/scheduledAt | Versandstatus und Termin | Versandpipeline |
| test email | Testziel | Qualitaetssicherung vor Live-Versand |

#### /admin/marketing-promo/promo-codes
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| code, internalName, description | Code und Bedeutung | Checkout, Reporting |
| discountType, value | Rabattlogik | Preisberechnung |
| startDate, endDate | Laufzeit | Aktiv/Expired-Status |
| minimumOrderValue | Mindestwarenkorb | Einloeseregel |
| usageLimitTotal/perCustomer | Nutzungslimits | Missbrauchsschutz |
| combinable | kombinierbar ja/nein | Rabattregel-Engine |

#### /admin/marketing-promo/segments
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| internalName, description | Segmentdefinition | Segmentauswahl in Kampagnen |
| status | active/archived | Verfuegbarkeit |
| newsletterOptInOnly | Einwilligungsfilter | DSGVO-konformer Versand |
| minTotalOrders, minTotalSpent | Kaufhistorienfilter | Zielgruppenqualifizierung |
| includeCountry | Landerfilter | regionale Kampagnen |

#### /admin/marketing-promo/settings
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| defaultFromName, defaultReplyTo | Senderdefaults | alle Newsletter |
| maxSendBatchSize | Batchgroesse | Versandsteuerung |
| trackOpens, trackClicks | Tracking aktiv/inaktiv | Reportingkennzahlen |
| allowTestSend | Testversand-Freigabe | QA-Prozess |

### 16.5 System Management

#### /admin/system
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| systemConfig (global) | zentrale Plattformparameter | moduluebergreifend |
| notification templates | Vorlagen fuer E-Mail/SMS/Push | automatische Benachrichtigungen |
| templateLinkSettings | Basis-Links fuer Mail-Templates | Deeplinks in E-Mails |
| integrations (provider, credentials, endpoint) | Fremdsystem-Anbindung | API-Calls und Dienste |

#### /admin/email
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| smtpHost, smtpPort | Mailserver | Versandkanal |
| smtpUsername, smtpPassword | Authentifizierung | SMTP-Login |
| requiresAuthentication, requiresTLS | Sicherheitsmodus | Transportverschluesselung |
| enableNotifications | globaler Versandschalter | Systemmails |
| compose test fields (to/subject/body/from) | Testnachricht | Versandvalidierung |

#### /admin/live-tracking
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| keine Stammdatenfelder | Monitoring-/Analyseansicht | operative Beobachtung |

#### /admin/database
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| cleanupDays | Altersschwelle fuer Cleanup | Datenbereinigung |
| cleanupCollections[] | Ziel-Collections fuer Cleanup | Wartungsjobs |
| bulk-delete Passwortfelder | Sicherheitsbestaetigung | Schutz vor Fehlbedienung |

#### /admin/security
| Bearbeitbares Feld | Inhalt | Verwendet in |
|---|---|---|
| passwordPolicy.* | Kennwortregeln | Registrierung/Reset/Policy-Checks |
| sessionTimeout | Sessionlebensdauer | Auto-Logout |
| maxLoginAttempts, lockoutDuration | Brute-Force-Schutz | Login-Sperrlogik |
| enableTwoFactor | 2FA-Schalter | erweiterte Auth-Sicherheit |
| block IP + reason | manuelle Sperre | Sicherheitsabwehr |

## 17. Datenfluss-Orientierung (kurz)
- Stammdatenfelder (Users, Devices, Services, Parts) wirken in Auswahlfeldern, Filtern, Workflows und Reports.
- Prozessfelder (Status, Priority, Assignments) steuern operative Queues und Dashboards.
- Finanzfelder (Tax, Discounts, Payment Terms) beeinflussen Rechnungsstellung, Mahnwesen und KPI-Auswertungen.
- Kommunikationsfelder (Templates, SMTP, Marketing-Content) bestimmen ausgehende E-Mails, Tracking und Kundenerlebnis.

---

## 18. Feld-Rückverfolgbarkeit (UI → API → DB → Frontend)

Dieses Kapitel zeigt für alle wichtigen Admin-Bereiche, wie ein Eingabefeld im Admin-Panel seinen Weg durch API-Payload und Datenbank nimmt und wo der Wert schließlich auf der Kundenseite sichtbar wird.

> **Legende der Spalten:**
> - **UI-Feld** — Bezeichnung des Eingabefelds im Admin-Interface
> - **API-Payload-Feld** — Name des Felds im HTTP-Request-Body (JSON)
> - **DB-Modell / Collection** — Mongoose-Modell und Feldpfad in MongoDB
> - **Sichtbare Frontend-Stelle** — Wo der Wert dem Kunden oder Mitarbeiter angezeigt wird

---

### 18.1 Benutzerverwaltung (`/admin/users`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Vorname | `firstName` | `User.firstName` | Kundenportal → Profil; Buchungsübersicht (Kundenname) |
| Nachname | `lastName` | `User.lastName` | Kundenportal → Profil; Rechnungsadresse |
| E-Mail | `email` | `User.email` (unique, lowercase) | Login; Rechnungs-E-Mail; Benachrichtigungen |
| Telefon | `phone` | `User.phone` | Buchungsdetails; DHL-Versandetiketten |
| Rolle | `role` | `User.role` (customer/staff/admin) | Menüzugang; Berechtigungsstufen |
| Status | `status` | `User.status` (active/inactive/suspended/blocked) | Login-Sperrung; Suchfilter im Admin |
| Rabatt (%) | `discount` | `User.discount` | Warenkorbberechnung; Bestellübersicht |
| Kundengruppe | `primaryCustomerGroupId` | `User.primaryCustomerGroupId` → `CustomerGroup` | Preisgruppen; Marketingfilter |
| Rechnungsadresse | `invoiceAddress.*` | `User.invoiceAddress.{street,city,zipCode,country}` | Rechnung; Buchungsbestätigung |
| Zahlungsart | `paymentMethod` | `User.paymentMethod` | Checkout-Vorbelegung |
| Zahlungsziel | `paymentTerms` | `User.paymentTerms` | Rechnungserstellung (Fälligkeitsdatum) |
| Newsletter | `newsletter` | `User.newsletter` | E-Mail-Marketing-Segmentierung |
| Interner Kommentar | `comment` | `User.comment` | Nur Admin-Seitenleiste; nicht für Kunden sichtbar |
| Anrede | `salutation` | `User.salutation` | Anschreiben in E-Mails; Rechnungskopf |
| MwSt-ID | `vatId` | `User.vatId` | B2B-Rechnungen (Reverse Charge) |

---

### 18.2 Mitarbeiterverwaltung (`/admin/staff`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Abteilung | `department` | `User.department` | Mitarbeiter-Dashboard; Team-Filter |
| Spezialisierungen | `specializations[]` | `User.specializations` | Auto-Zuweisung von Aufträgen; Staff-Karte |
| Add-On-Fähigkeiten | `addOnCapabilities[]` | `User.addOnCapabilities` | Add-On-Zuweisung bei Auftragsbearbeitung |
| Fähigkeiten (Skills) | `skills[].name` / `.level` | `User.skills` | Performance-Ansicht; Teamübersicht |
| Einstellungsdatum | `employmentStartDate` | `User.employmentStartDate` | HR-Auswertungen; Zeiterfassung |
| Aktueller Status | `currentStatus` | `User.currentStatus` (online/working/on_break) | Live-Tracking-Dashboard |
| Gearbeitete Stunden | — (berechnet) | `User.totalHoursWorked`, `hoursThisWeek` | Zeiterfassung-Report im Staff-Panel |

---

### 18.3 Dienstverwaltung (`/admin/services`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Dienstname | `name` | `Service.name` | Reparatur-Konfigurator; Warenkorb; Rechnung |
| Kurzbeschreibung | `shortDescription` | `Service.shortDescription` | Servicekarte auf Produktseite |
| Preis (Brutto) | `price` | `Service.price` | Reparatur-Konfigurator; Checkout; Bestellübersicht |
| Kategorie | `category` | `Service.category` → `ServiceCategory` | Konfigurator-Filter; SEO-Gruppen |
| SEO-Name | `seoName` | `Service.seoName` | URL-Slug der Serviceseite |
| SEO-Titel-Tag | `seoTitleTag` | `Service.seoTitleTag` | `<title>`-Tag in Browser-Tab |
| SEO-Meta-Beschreibung | `seoMetaDescription` | `Service.seoMetaDescription` | Google-Snippet; OpenGraph |
| Suchbegriffe | `searchKeywords` | `Service.searchKeywords` | Interne Suche im Konfigurator |
| Steuerkl. | `taxClass` | `Service.taxClass` | Rechnungsberechnung |
| Geschätzte Zeit | `estimatedTime` | `Service.estimatedTime` | Reparatur-Timeline; Kundenmitteilung |
| Aktiv | `isActive` | `Service.isActive` | Sichtbarkeit im Konfigurator |
| Artikelnummer | `articleNumber` | `Service.articleNumber` | Rechnung; Lagerverwaltung |

---

### 18.4 Add-On-Dienste (`/admin/addon-services`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Name | `name` | `AddOnService.name` | Checkout Add-On-Auswahl; Rechnung |
| Beschreibung | `description` | `AddOnService.description` | Add-On-Karte im Konfigurator |
| Preis | `price` | `AddOnService.price` | Checkout; Gesamtpreis-Berechnung |
| Geschätzte Zeit | `estimatedTime` | `AddOnService.estimatedTime` | Timeline-Anzeige für Kunden |
| Kategorie | `category` | `AddOnService.category` → `ServiceCategory` | Konfigurator-Gruppen-Tab |
| Bundle-Rabatt (%) | `bundleDiscount` | `AddOnService.bundleDiscount` | Preisberechnung bei Mehrfachauswahl |
| Kompatibilität | `compatibility[].deviceType` / `.brands[]` | `AddOnService.compatibility` | Geräte-Filterung im Konfigurator |
| Aktiv | `isActive` | `AddOnService.isActive` | Sichtbarkeit im Checkout |

---

### 18.5 Geräteverwaltung (`/admin/devices`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Modellname | `name` | `DeviceModel.name` | Reparatur-Konfigurator; Buchungsübersicht |
| Marke | `brandId` | `DeviceModel.brandId` → `DeviceBrand.name` | Konfigurator-Markenauswahl |
| Gerätetyp | `deviceType` | `DeviceModel.deviceType` → `DeviceType` | Konfigurator-Kategorieauswahl |
| Slug | `slug` | `DeviceModel.slug` | SEO-URL; Deep-Links |
| Modellnummern | `modelNumbers[]` | `DeviceModel.modelNumbers` | IMEI-/Modell-Erkennung |
| Synonyme | `synonyms[]` | `DeviceModel.synonyms` | Suchalgorithmus im Konfigurator |
| Bild | `image` | `DeviceModel.image` | Produktbild im Konfigurator; Buchungskarte |
| Häufige Probleme | `commonProblems[]` | `DeviceModel.commonProblems` | FAQ; Anfragevordruck |
| Technische Specs | `display.*`, `platform.*`, `battery.*` etc. | `DeviceModel.*` | Gerätespezifikations-Seite |
| Aktiv | `isActive` | `DeviceModel.isActive` | Sichtbarkeit im Konfigurator |
| Markenlogo | `logo` | `DeviceBrand.logo` | Konfigurator-Markenliste; Produktseite |

---

### 18.6 Ersatzteillagerverwaltung (`/admin/parts`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Teilename | `name` | `Inventory.name` | Bestellformular (E-Part); Need-List |
| Teilenummer | `partNumber` | `Inventory.partNumber` | Interne Bestelllisten; Lieferantenkommunikation |
| Menge | `versions[].quantity` | `Inventory.versions[].quantity` | Lagerbestand-Ampel; Stock-Alerts |
| Mindestbestand | `versions[].minStockLevel` | `Inventory.versions[].minStockLevel` | Automatische Nachbestellwarnung |
| Einkaufspreis | `versions[].unitCost` | `Inventory.versions[].unitCost` | Profitabilitätsberechnung |
| Verkaufspreis | `versions[].sellingPrice` | `Inventory.versions[].sellingPrice` | Interne Kalkulation |
| Lagerort | `versions[].storageLocation` | `Inventory.versions[].storageLocation` | Pick-Liste bei Reparatur |
| Lieferant | `versions[].supplierInfo.*` | `Inventory.versions[].supplierInfo` | E-Part-Bestellformular |
| Versionstyp | `versions[].versionType` | `Inventory.versions[].versionType` (original/cheap/efficient) | Teilauswahl bei Auftragsbearbeitung |
| Kompatible Geräte | `compatibleDevices[]` | `Inventory.compatibleDevices` | Teilsuche nach Gerät |
| Status | `versions[].status` | `Inventory.versions[].status` (active/discontinued/out-of-stock) | Lager-Dashboard; Nachbestellliste |

---

### 18.7 Auftrags- und Buchungsverwaltung (`/admin/orders`, `/admin/bookings`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Auftragsstatus | `status` | `Order.status` / `Booking.status` | Kundenportal → Auftragsdetails; E-Mail-Benachrichtigung |
| Mitarbeiterzuweisung | `assignedStaffId` | `Order.assignedStaffId` → `User` | Staff-Dashboard; Workload-Ansicht |
| Interne Notiz | `staffNotes[].note` | `Order.staffNotes` | Nur Staff-/Admin-Ansicht |
| Tracking-Nummer | `trackingNumber` | `Booking.trackingNumber` | Kundenportal → Sendungsverfolgung; DHL-Link |
| Versandstatus | `shippingStatus` | `Booking.shippingStatus` | Kundenportal → Statusleiste |
| Rücksendelabel | `returnLabelUrl` | `Booking.returnLabelUrl` | Kundenportal → Versand-Tab |
| Gesamtbetrag | `totalCost` | `Booking.totalCost` | Rechnung; Kundenportal → Zahlungsübersicht |
| Rabatt | `discount` | `Booking.discount` | Bestellzusammenfassung; Rechnung |
| Promo-Code | `appliedPromoCode` | `Booking.appliedPromoCode` | Bestellbestätigung; Rechnung |
| Zahlungsstatus | `paymentStatus` | `Booking.paymentStatus` | Kundenportal → Zahlung; Mahnwesen |
| Timeline-Eintrag | `timeline[].description` | `Booking.timeline[]` | Kundenportal → Fortschrittsleiste |
| Fortschritt (%) | `overallProgress` | `Booking.overallProgress` | Kundenportal → Reparaturfortschritts-Balken |

---

### 18.8 Web-Shop-Verwaltung (`/admin/webshop`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Produktname | `name` | `Product.name` | Shop-Produktkarte; Warenkorb; Rechnung |
| Beschreibung | `description` | `Product.description` | Produktdetailseite |
| Preis | `price` | `Product.price` | Shop-Karte; Warenkorb; Checkout |
| Originalpreis | `originalPrice` | `Product.originalPrice` | Rabattanzeige (durchgestrichen) |
| Kategorie | `category` | `Product.category` | Shop-Filter; Breadcrumb |
| Marke | `brand` | `Product.brand` | Produktfilter; Produktkarte |
| Lagerbestand | `stockCount` | `Product.stockCount` | „Auf Lager / Nicht verfügbar"-Badge |
| SKU | `sku` | `Product.sku` (unique, uppercase) | Rechnung; Lagerverwaltung |
| Bilder | `images[]` | `Product.images` | Produktbild-Galerie |
| SEO-Titel | `seoTitleTag` | `Product.seoTitleTag` | `<title>`-Tag |
| SEO-Meta | `seoMetaDescription` | `Product.seoMetaDescription` | Google-Snippet |
| Aktiv | `isActive` | `Product.isActive` | Sichtbarkeit im Shop |
| Features | `features[]` | `Product.features` | Produktdetail-Aufzählung |
| Kompatibilität | `compatibility[]` | `Product.compatibility` | Produktfilter; Detailseite |

---

### 18.9 Rechnungs- und Finanzverwaltung (`/admin/financial`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Rechnungsstatus | `status` | `Invoice.status` (draft/sent/paid/overdue…) | Kundenportal → Rechnungen; Mahnungen |
| Fälligkeitsdatum | `dueDate` | `Invoice.dueDate` | Rechnungs-PDF; Zahlungserinnerung |
| Positionen | `items[].description` / `.unitPrice` / `.quantity` | `Invoice.items[]` | Rechnungs-PDF |
| Nettobetrag | `subtotal` | `Invoice.subtotal` | Rechnungs-PDF; Finanz-Dashboard |
| Steuer | `tax` | `Invoice.tax` | Rechnungs-PDF |
| Gesamtbetrag | `total` | `Invoice.total` | Rechnungs-PDF; Kundenzahlungsseite |
| Zahlungsziel | `paymentTerms` | `Invoice.paymentTerms` | Rechnungs-Fußzeile |
| Mahnungsstufe | `dunningLevel` | `Invoice.dunningLevel` | Mahnlaufansicht |
| Zahlungsart | `paymentMethod` | `Payment.paymentMethod` | Zahlungsbestätigung; Buchhaltungsexport |
| Standard-Steuersatz | `financialSettings.defaults.taxRate` | `SystemConfiguration.financialSettings.defaults.taxRate` | Globale Berechnung aller Warenkörbe |
| Rechnungsprefix | `financialSettings.defaults.invoicePrefix` | `SystemConfiguration.financialSettings.defaults.invoicePrefix` | Rechnungsnummer-Format (z.B. INV-2025-0001) |
| Verkäufer-Name | `financialSettings.invoiceMetadata.sellerName` | `SystemConfiguration.financialSettings.invoiceMetadata.sellerName` | Rechnungskopf |
| MwSt-ID (Seller) | `financialSettings.invoiceMetadata.sellerVatId` | `SystemConfiguration.financialSettings.invoiceMetadata.sellerVatId` | Rechnung (gesetzliche Pflichtangabe) |

---

### 18.10 Reklamationsverwaltung (`/admin/complaints`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Betreff | `subject` | `Complaint.subject` | Kunden-Beschwerdeübersicht |
| Beschreibung | `description` | `Complaint.description` | Beschwerdedetails; interne Bearbeitung |
| Kategorie | `category` | `Complaint.category` (quality/service/billing…) | Filter im Beschwerden-Dashboard |
| Priorität | `priority` | `Complaint.priority` | Queue-Sortierung; SLA-Ampel |
| Status | `status` | `Complaint.status` (open/in-progress/resolved…) | Kundenportal → Reklamationsstatus |
| Ablehnungsgrund | `rejectionReason` | `Complaint.rejectionReason` | Kundenmitteilung bei Ablehnung |
| Mitarbeiterzuweisung | `assignedStaffId` | `Complaint.assignedStaffId` → `User` | Staff-Aufgabenliste |
| Interner Kommentar | `comments[].comment` + `isInternal: true` | `Complaint.comments[]` | Nur Admin/Staff-Ansicht |

---

### 18.11 Marketing & Promo-Codes (`/admin/marketing-promo`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Interner Name | `internalName` | `PromoCode.internalName` | Nur Admin-Liste |
| Code | `code` | `PromoCode.code` (unique, uppercase) | Checkout-Eingabefeld |
| Rabatttyp | `discountType` | `PromoCode.discountType` (percentage/fixed_amount) | Checkout-Berechnung |
| Wert | `value` | `PromoCode.value` | Rabattanzeige im Warenkorb |
| Gültig von/bis | `startDate` / `endDate` | `PromoCode.startDate` / `PromoCode.endDate` | Checkout-Validierung (Ablaufdatum-Hinweis) |
| Status | `status` | `PromoCode.status` (draft/active/expired…) | Sichtbarkeit im Checkout |
| Mindestbestellwert | `rules.minimumOrderValue` | `PromoCode.rules.minimumOrderValue` | Checkout-Fehlermeldung bei Unterschreitung |
| Nutzungslimit (gesamt) | `rules.usageLimitTotal` | `PromoCode.rules.usageLimitTotal` | Automatische Deaktivierung nach Erreichen |
| Nutzungslimit (pro Kunde) | `rules.usageLimitPerCustomer` | `PromoCode.rules.usageLimitPerCustomer` | Checkout-Validierung |
| Kundengruppen | `rules.customerGroupIds[]` | `PromoCode.rules.customerGroupIds` → `CustomerGroup` | Gruppenspezifische Verfügbarkeit |

---

### 18.12 Newsletter & Segmente (`/admin/marketing-newsletter`, `/admin/marketing-segments`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Interner Name | `internalName` | `Newsletter.internalName` | Nur Admin-Liste |
| Betreff | `subject` | `Newsletter.subject` | E-Mail-Betreffzeile |
| Preheader | `preheader` | `Newsletter.preheader` | E-Mail-Vorschautext in Mail-Client |
| Inhalt (HTML) | `content` | `Newsletter.content` | Gesendete E-Mail-Body |
| Segment | `segmentId` | `Newsletter.segmentId` → `MarketingSegment` | Empfängergruppe |
| Versandzeitpunkt | `scheduledAt` | `Newsletter.scheduledAt` | Geplanter E-Mail-Versand |
| Segment-Regeln | `rules.*` | `MarketingSegment.rules` | Empfängerfilterung (Rolle, Land, Bestellhistorie) |
| Newsletter-Opt-In | `rules.newsletterOptInOnly` | `MarketingSegment.rules.newsletterOptInOnly` | Nur Nutzer mit `User.newsletter = true` |
| Sendungsstatistiken | — (berechnet) | `Newsletter.stats.{sent,opened,clicked}` | Admin-Kampagnen-Report |

---

### 18.13 Blog-Verwaltung (`/admin/blog`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Titel | `title` | `BlogPost.title` | Blog-Listenansicht; `<h1>`; OG-Titel |
| Slug | `slug` | `BlogPost.slug` (unique) | Blog-URL (`/blog/{slug}`) |
| Inhalt | `content` | `BlogPost.content` | Blog-Detailseite |
| Kategorie | `category` | `BlogPost.category` → `BlogCategory` | Kategorie-Filter; Breadcrumb |
| Tags | `tags[]` | `BlogPost.tags` | Tag-Cloud; Such-Ergebnisse |
| SEO-Titel | `seoTitle` | `BlogPost.seoTitle` | `<title>`-Tag |
| SEO-Beschreibung | `seoDescription` | `BlogPost.seoDescription` | Meta-Description |
| Featured Image | `featuredImage` | `BlogPost.featuredImage` | Blog-Karte; OG-Image |
| Status | `status` | `BlogPost.status` (draft/published/archived) | Sichtbarkeit im Blog |
| Veröffentlichungsdatum | `publishedAt` | `BlogPost.publishedAt` | Blog-Sortierdatum; RSS-Feed |
| Kommentarstatus | `allowComments` | `BlogPost.allowComments` | Kommentarformular sichtbar/versteckt |

---

### 18.14 FAQ-Verwaltung (`/admin/faq`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Frage | `question` | `FAQ.question` | FAQ-Seite; Akordeon-Titel |
| Antwort | `answer` | `FAQ.answer` | FAQ-Seite; Akordeon-Inhalt |
| Kategorie | `category` | `FAQ.category` (General/Repairs/Pricing…) | FAQ-Kategorien-Tab |
| Reihenfolge | `order` | `FAQ.order` | Sortierung auf der FAQ-Seite |
| Aktiv | `isActive` | `FAQ.isActive` | Sichtbarkeit auf FAQ-Seite |
| Tags | `tags[]` | `FAQ.tags` | FAQ-Suche |

---

### 18.15 SEO-Verwaltung (`/admin/seo`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Seitentyp | `pageType` | `SEOSettings.pageType` (global/homepage/blog_post…) | Welche Seite die Einstellung betrifft |
| Titel | `title` | `SEOSettings.title` | `<title>`-Tag im Browser-Tab |
| Beschreibung | `description` | `SEOSettings.description` | Google-Snippet; Meta-Description |
| Keywords | `keywords[]` | `SEOSettings.keywords` | Meta-Keywords-Tag |
| Canonical-URL | `canonicalUrl` | `SEOSettings.canonicalUrl` | `<link rel="canonical">` |
| OG-Titel | `openGraph.title` | `SEOSettings.openGraph.title` | Social-Media-Vorschau |
| OG-Bild | `openGraph.image` | `SEOSettings.openGraph.image` | Social-Media-Vorschau-Bild |
| Robots (index) | `robots.index` | `SEOSettings.robots.index` | `<meta name="robots" content="…">` |
| Sitemap-Priorität | `priority` | `SEOSettings.priority` | sitemap.xml |
| Änderungsfrequenz | `changeFreq` | `SEOSettings.changeFreq` | sitemap.xml |

---

### 18.16 System-Konfiguration (`/admin/system`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Site-Name | `siteName` | `SystemConfiguration.siteName` | Browser-Titel; E-Mail-Absendername |
| Admin-E-Mail | `adminEmail` | `SystemConfiguration.adminEmail` | System-Alerts; Fehler-Benachrichtigungen |
| Wartungsmodus | `maintenanceMode` | `SystemConfiguration.maintenanceMode` | Öffentliche Seite → Wartungsseite |
| SMTP-Host | `emailSettings.smtpHost` | `SystemConfiguration.emailSettings.smtpHost` | Nodemailer-Transport |
| SMTP-Port | `emailSettings.smtpPort` | `SystemConfiguration.emailSettings.smtpPort` | Nodemailer-Transport |
| SMTP-Benutzername | `emailSettings.smtpUsername` | `SystemConfiguration.emailSettings.smtpUsername` | Nodemailer-Auth |
| E-Mail-Benachrichtigungen | `emailSettings.enableNotifications` | `SystemConfiguration.emailSettings.enableNotifications` | Globaler E-Mail-Versandschalter |
| Benachrichtigungs-Templates | `notificationTemplates[].content` | `SystemConfiguration.notificationTemplates[]` | Automatisch versendete E-Mails (Statuswechsel, Zahlung…) |
| Template-Link-Modus | `templateLinkSettings.mode` | `SystemConfiguration.templateLinkSettings.mode` | URLs in E-Mails (localhost vs. production) |
| Passwort-Mindestlänge | `securitySettings.passwordPolicy.minLength` | `SystemConfiguration.securitySettings.passwordPolicy.minLength` | Registrierung / Passwort-Reset-Validierung |
| Session-Timeout | `securitySettings.sessionTimeout` | `SystemConfiguration.securitySettings.sessionTimeout` | Auto-Logout nach Inaktivität |
| Max. Login-Versuche | `securitySettings.maxLoginAttempts` | `SystemConfiguration.securitySettings.maxLoginAttempts` | Brute-Force-Sperre beim Login |
| 2FA aktivieren | `securitySettings.enableTwoFactor` | `SystemConfiguration.securitySettings.enableTwoFactor` | Login-Dialog (zweiter Faktor) |

---

### 18.17 Kundengruppen (`/admin/customer-groups`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Gruppenname | `name` | `CustomerGroup.name` | Admin-Übersicht; Benutzer-Detail |
| Schlüssel | `key` | `CustomerGroup.key` (unique, lowercase) | API-Referenz; Regel-Bedingungen |
| Status | `status` | `CustomerGroup.status` (active/inactive/archived) | Gruppen-Filterung |
| Modus | `mode` | `CustomerGroup.mode` (standard/vip/b2b/affiliate) | Preislogik; Rechnungsregeln |
| Rabatt (%) | `financeProfile.discountPercent` | `CustomerGroup.financeProfile.discountPercent` | Checkout-Berechnung; Rechnung |
| Zahlungsziel (Tage) | `financeProfile.paymentDueDays` | `CustomerGroup.financeProfile.paymentDueDays` | Rechnungs-Fälligkeitsdatum |
| Kreditlimit | `financeProfile.creditLimit` | `CustomerGroup.financeProfile.creditLimit` | Checkout-Sperre bei Überschreitung |
| Steuer-Modus | `financeProfile.taxMode` | `CustomerGroup.financeProfile.taxMode` | MwSt-Berechnung (z.B. Reverse Charge für B2B) |
| Erlaubte Zahlungsarten | `financeProfile.allowedPaymentMethods[]` | `CustomerGroup.financeProfile.allowedPaymentMethods` | Checkout-Zahlungsoptionen |
| Regel-Bedingungen | `conditions[].field` / `.operator` / `.value` | `CustomerGroupRule.conditions[]` | Auto-Zuweisung von Kunden |
| Priorität | `priority` | `CustomerGroup.priority` | Konfliktsauflösung bei Mehrfachgruppen |

---

### 18.18 Workflow-Verwaltung (`/admin/workflows`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Template-Name | `name` | `WorkflowTemplate.name` | Auftragsansicht → Workflow-Tab |
| Schritt-Name | `steps[].name` | `WorkflowTemplate.steps[].name` | Techniker-Arbeitsansicht |
| Schritt-Beschreibung | `steps[].description` | `WorkflowTemplate.steps[].description` | Techniker-Schritt-Anleitung |
| Geschätzte Zeit (min) | `steps[].estimatedTime` | `WorkflowTemplate.steps[].estimatedTime` | Zeitplanung; ETA-Berechnung |
| Pflichtschritt | `steps[].isRequired` | `WorkflowTemplate.steps[].isRequired` | Schritt kann nicht übersprungen werden |
| Formularfelder | `steps[].formFields[]` | `WorkflowTemplate.steps[].formFields` | Dateneingabe durch Techniker |
| Automatisierungsregel | `steps[].automationRules[].action` | `WorkflowTemplate.steps[].automationRules` | Auto-Statuswechsel; Auto-Benachrichtigung |

---

### 18.19 E-Part-Bestellungen (`/admin/epart-orders`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Bestellnummer | — (auto) | `EPartOrder.orderNumber` (EPO-000001) | Interne Bestellübersicht |
| Lieferant | `supplierId` | `EPartOrder.supplierId` → `Supplier` | Bestelldetails; Kommunikation |
| Bestellpositionen | `items[].partId` / `.quantity` / `.unitPrice` | `EPartOrder.items[]` | Lieferschein; Rechnung |
| Status | `status` | `EPartOrder.status` (draft/ordered/received…) | Bestellübersicht; Lagereingang |
| Lieferdatum (Soll) | `expectedDelivery` | `EPartOrder.expectedDelivery` | Zeitplanung; Nachbestellwarnung |
| Zahlungsstatus | `paymentStatus` | `EPartOrder.paymentStatus` | Buchhaltung |
| Lieferanten-IBAN | `paymentInformation.iban` | `Supplier.paymentInformation.iban` | Überweisungsformular |

---

### 18.20 Reparaturanfragen (`/admin/repair-requests`)

| UI-Feld | API-Payload-Feld | DB-Modell / Collection | Sichtbare Frontend-Stelle |
|---|---|---|---|
| Status | `status` | `RepairRequest.status` (pending/reviewing/approved/rejected/converted) | Kunden-Anfrage-Status; Benachrichtigung |
| Priorität | `priority` | `RepairRequest.priority` | Anfragen-Queue-Sortierung |
| Geschätzte Kosten | `estimatedCost` | `RepairRequest.estimatedCost` | Kundenmitteilung bei Genehmigung |
| Zugewiesener Mitarbeiter | `assignedStaffId` | `RepairRequest.assignedStaffId` → `User` | Staff-Aufgabenliste |
| Admin-Notiz | `adminNotes[].note` | `RepairRequest.adminNotes[]` | Nur Admin/Staff |
| Prüffrist | `reviewDeadline` | `RepairRequest.reviewDeadline` | SLA-Überwachung; Eskalations-Alert |
| In Auftrag konvertiert | — (Aktion) | `RepairRequest.convertedToOrderId` → `Order` | Verknüpfung Anfrage ↔ Auftrag |

---

## Kapitel 19: Konfiguration – Umgebungsvariablen & API-Schnittstellen

Dieses Kapitel dokumentiert alle Konfigurationswerte, die für den Betrieb von FixitHub benötigt werden. Die Werte werden in drei `.env`-Dateien verteilt.

> **Sicherheitshinweis**: Niemals echte Secrets in die Versionskontrolle (Git) einchecken. Die Dateien `.env`, `server/.env` und `client/.env` sind in `.gitignore` eingetragen und dürfen **nur lokal** existieren. Als Vorlage dienen die jeweiligen `.env.example`-Dateien.

---

### 19.1 Übersicht der Konfigurationsdateien

| Datei | Gültigkeitsbereich | Beschreibung |
|---|---|---|
| `.env` | Root / Server (gemeinsam) | Hauptkonfiguration für Server, Datenbank, JWT, URLs, SMTP-Fallback |
| `server/.env` | Nur Backend (Node.js) | Ergänzende Server-Überschreibungen; wird nach `.env` geladen |
| `client/.env` | Nur Frontend (Vite) | Vite-spezifische Variablen (müssen mit `VITE_` beginnen) |
| `.env.example` | Vorlage (root) | Kommentierte Vorlage ohne Echtdaten – in Git eingecheckt |
| `client/.env.example` | Vorlage (client) | Kommentierte Client-Vorlage |

**Ladereihenfolge**: Node.js liest `.env` aus dem Root-Verzeichnis. Variablen in `server/.env` überschreiben ggf. Root-Werte (je nach `dotenv`-Konfiguration).

---

### 19.2 Basisinstallation – Pflichtfelder

Diese Variablen **müssen** gesetzt sein, damit der Server startet und die Authentifizierung funktioniert.

**Datei: `.env` (Root)**

| Variable | Beispielwert | Beschreibung | Pflicht |
|---|---|---|---|
| `PORT` | `3000` | HTTP-Port des Express-Servers | Ja |
| `NODE_ENV` | `development` / `production` | Betriebsmodus; steuert Debug-Ausgaben | Ja |
| `DATABASE_URL` | `mongodb://localhost:27017/FixitHub` | MongoDB-Verbindungsstring | Ja |
| `JWT_SECRET` | *(64-stelliger Hex-String)* | Signierungsschlüssel für Access-Tokens | Ja |
| `REFRESH_TOKEN_SECRET` | *(64-stelliger Hex-String)* | Signierungsschlüssel für Refresh-Tokens | Ja |
| `SESSION_SECRET` | *(langer Zufallsstring)* | Session-Signing-Secret (Express-Session) | Ja |
| `CLIENT_URL` | `http://localhost:5173` | URL des Frontends; für CORS-Whitelist | Ja |
| `SERVER_URL` | `http://localhost:3000` | Eigene Backend-URL; für Deep-Links in E-Mails | Ja |

**Secrets generieren** (einmalig ausführen):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Oder automatisch via Setup-Skript:
```bash
node server/scripts/setup-env.js
```

---

### 19.3 Datenbankverbindung (MongoDB)

**Datei: `.env` (Root)**

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `DATABASE_URL` | `mongodb://localhost:27017/FixitHub` | Verbindungsstring (inkl. optionaler Credentials) |
| `MONGODB_USERNAME` | `fixitadmin` | Alternativer Auth-User (wenn nicht im URL) |
| `MONGODB_PASSWORD` | `sicheresPasswort` | Alternativer Auth-Passwort |
| `MONGODB_AUTH_SOURCE` | `admin` | Auth-Datenbank (Standard: `admin`) |

**Verbindungsbeispiele:**
```bash
# Lokal ohne Auth
DATABASE_URL=mongodb://localhost:27017/FixitHub

# Lokal mit Auth
DATABASE_URL=mongodb://fixitadmin:passwort@localhost:27017/FixitHub?authSource=admin

# MongoDB Atlas (Cloud)
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/FixitHub?retryWrites=true&w=majority
```

---

### 19.4 SMTP / E-Mail-Konfiguration

FixitHub versendet transaktionale E-Mails (Auftragsbestätigungen, Statusupdates, Passwort-Reset etc.) über Nodemailer.

> **Hinweis**: SMTP kann entweder über `.env`-Variablen **oder** über die Admin-Oberfläche unter **Einstellungen → E-Mail-Konfiguration** (gespeichert in `SystemConfiguration`) konfiguriert werden. Die DB-Einstellung hat Vorrang.

**Datei: `.env` (Root)**

| Variable | Beispielwert | Beschreibung | Pflicht |
|---|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Hostname des SMTP-Servers | Ja (wenn E-Mail aktiv) |
| `SMTP_PORT` | `587` | SMTP-Port (587 = STARTTLS, 465 = SSL) | Ja |
| `SMTP_USER` | `noreply@meinefirma.de` | Benutzername / E-Mail-Adresse | Ja |
| `SMTP_PASS` | `app-passwort-hier` | Passwort oder App-Passwort | Ja |
| `SMTP_FROM` | `"FixitHub" <noreply@meinefirma.de>` | Absenderadresse in E-Mails | Empfohlen |
| `SMTP_SECURE` | `false` | `true` = SSL (Port 465), `false` = STARTTLS | Nein |
| `SMTP_TLS` | `false` | `true` = TLS erzwingen (STARTTLS) | Nein |
| `SUPPORT_EMAIL` | `support@meinefirma.de` | Reply-To-Adresse in Kunden-E-Mails | Empfohlen |

**Typische Anbieter-Konfigurationen:**

| Anbieter | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` |
|---|---|---|---|
| Gmail (App-Passwort) | `smtp.gmail.com` | `587` | `false` |
| Office 365 | `smtp.office365.com` | `587` | `false` |
| Outlook/Hotmail | `smtp-mail.outlook.com` | `587` | `false` |
| Strato | `smtp.strato.de` | `465` | `true` |
| IONOS/1&1 | `smtp.ionos.de` | `587` | `false` |
| Mailgun | `smtp.mailgun.org` | `587` | `false` |
| SendGrid | `smtp.sendgrid.net` | `587` | `false` |

---

### 19.5 DHL-Integration (Versand & Retourenetiketten)

FixitHub nutzt die DHL Parcel DE API für automatische Versand- und Retouren-Labels. Es gibt zwei Authentifizierungsebenen.

> **Hinweis**: DHL-Credentials können auch über **Einstellungen → Integrationen → DHL** in der Admin-Oberfläche gespeichert werden (in `SystemConfiguration`). Env-Variablen dienen als Fallback.

**Datei: `.env` oder `server/.env`**

#### 19.5.1 DHL Parcel DE API (REST) – für Label-Erstellung

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `DHL_CLIENT_ID` | `abc123xyz...` | API-Client-ID aus dem DHL Developer Portal |
| `DHL_CLIENT_SECRET` | `geheimesSecret` | API-Client-Secret aus dem DHL Developer Portal |
| `DHL_API_KEY` | *(alternativ zu CLIENT_ID)* | Ältere Variable; wird durch `DHL_CLIENT_ID` bevorzugt |
| `DHL_API_SECRET` | *(alternativ zu CLIENT_SECRET)* | Ältere Variable; wird durch `DHL_CLIENT_SECRET` bevorzugt |
| `DHL_API_URL` | `https://api-eu.dhl.com` | API-Basis-URL (Standard: DHL EU Produktiv) |

#### 19.5.2 DHL Business Customer Portal (Basic Auth) – für Tracking / klassische Integration

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `DHL_BC_USERNAME` | `user-valid` | Business Customer Username |
| `DHL_BC_PASSWORD` | `SandboxPasswort2023!` | Business Customer Passwort |
| `DHL_BUSINESS_CUSTOMER_USERNAME` | *(alternativ)* | Längere Variante; gleichwertig |
| `DHL_BUSINESS_CUSTOMER_PASSWORD` | *(alternativ)* | Längere Variante; gleichwertig |

#### 19.5.3 Label-Modus

| Variable | Mögliche Werte | Beschreibung |
|---|---|---|
| `BOOKING_DHL_LABEL_MODE` | `dummy` / `sandbox` / `production` | Steuert, ob echte Labels oder Testlabels erstellt werden |

**Sandbox-Zugangsdaten (DHL Developer Portal):**
- Sandbox-URL: `https://api-sandbox.dhl.com`
- Test-Username: `user-valid`
- Test-Passwort: `SandboxPasswort2023!`
- Registrierung: [developer.dhl.com](https://developer.dhl.com)

---

### 19.6 PayPal-Integration (Zahlungen)

PayPal ist im Payment-Modell als Zahlungsanbieter referenziert. Die Konfiguration erfolgt über das Datenbank-Modell `SystemConfiguration.integrations` (Admin → Einstellungen → Integrationen).

> **Hinweis**: PayPal-Credentials werden **nicht** über `.env` geladen, sondern ausschließlich über die Admin-Oberfläche konfiguriert und in der Datenbank gespeichert.

**Konfigurationsfelder in der Admin-Oberfläche (Einstellungen → Integrationen → PayPal):**

| Feld | Beschreibung |
|---|---|
| Client ID | PayPal App Client-ID aus dem Developer Dashboard |
| Client Secret | PayPal App Secret |
| Webhook ID | ID des PayPal-Webhooks für Zahlungsbenachrichtigungen |
| Modus | `sandbox` (Test) oder `live` (Produktion) |
| Sandbox Client ID | Separate Test-Credentials |
| Sandbox Secret | Separate Test-Credentials |

**PayPal Developer Dashboard**: [developer.paypal.com](https://developer.paypal.com)

---

### 19.7 Stripe-Integration (Zahlungen)

Stripe ist im Zahlungsmodell als Alternative zu PayPal vorgesehen.

**Datei: `.env` (Root)**

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Geheimschlüssel aus dem Stripe Dashboard |

> Für Tests: `sk_test_...`-Schlüssel verwenden (aus [dashboard.stripe.com](https://dashboard.stripe.com)).

---

### 19.8 Twilio SMS-Integration

Twilio ist für SMS-Benachrichtigungen vorgesehen (z. B. Statusupdates). Die Integration ist vorbereitet, aber optional.

**Datei: `.env` (Root)**

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxx` | Account SID aus dem Twilio Console |
| `TWILIO_AUTH_TOKEN` | `auth_token_hier` | Auth Token aus dem Twilio Console |
| `TWILIO_PHONE_NUMBER` | `+4915112345678` | Twilio-Absendernummer (SMS) |

**Twilio Console**: [console.twilio.com](https://console.twilio.com)

---

### 19.9 KI-Integration (OpenAI / Anthropic)

Für KI-gestützte Funktionen (z. B. automatische Beschreibungen) können OpenAI- oder Anthropic-Schlüssel konfiguriert werden.

**Datei: `server/.env`**

| Variable | Beispielwert | Beschreibung |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | OpenAI API-Schlüssel |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic (Claude) API-Schlüssel |

---

### 19.10 Weitere Betriebsparameter

**Datei: `.env` (Root)**

| Variable | Standardwert | Beschreibung |
|---|---|---|
| `MAX_FILE_SIZE` | `10485760` | Max. Upload-Größe in Bytes (Standard: 10 MB) |
| `UPLOAD_PATH` | `./server/uploads` | Lokaler Pfad für hochgeladene Dateien |
| `LOG_LEVEL` | `INFO` | Log-Detailstufe: `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `TRACKING_SALT` | *(zufälliger String)* | Salt für die Hash-Generierung bei Sendungsnummern |
| `MOBILEAPI_KEY` | *(API-Key)* | Schlüssel für Mobile-API-Proxy (Gerätepreise) |
| `SERVICE_BULK_DELETE_PASSWORD` | *(sicheres Passwort)* | Schutzpasswort für Bulk-Delete-Operationen |
| `COMPANY_NAME` | `McRepair.de` | Firmenname in E-Mail-Vorlagen |
| `SUPPORT_PHONE` | `+49 (0) 123/456789` | Supportnummer in E-Mail-Vorlagen |
| `FRONTEND_URL` | `http://localhost:5173` | Alias für `CLIENT_URL` (Deep-Links) |
| `PUBLIC_APP_URL` | *(Produktions-URL)* | Öffentliche App-URL (CORS-Whitelist) |
| `PICKUP_HOURS` | *(Öffnungszeiten)* | Abholzeiten in Benachrichtigungen |

---

### 19.11 Client-Konfiguration (Vite)

**Datei: `client/.env`**

| Variable | Beispielwert | Beschreibung | Pflicht |
|---|---|---|---|
| `VITE_SITE_URL` | `https://www.fixithub.com` | Öffentliche Basis-URL; für SEO-Meta-Tags (canonical, og:url) | Empfohlen |

> Alle Vite-Variablen **müssen** mit `VITE_` beginnen, damit sie im Browser-Bundle sichtbar sind. Variablen ohne dieses Präfix sind nur server-seitig verfügbar und werden im Frontend als `undefined` behandelt.

---

### 19.12 Vollständige Beispielkonfiguration

#### `.env` (Root – Kopiervorlage)

```bash
# === SERVER ===
PORT=3000
NODE_ENV=production

# === DATENBANK ===
DATABASE_URL=mongodb://fixitadmin:MeinPasswort@localhost:27017/FixitHub?authSource=admin

# === AUTHENTIFIZIERUNG ===
JWT_SECRET=<64-stelliger-hex-string>
REFRESH_TOKEN_SECRET=<64-stelliger-hex-string>
SESSION_SECRET=<langer-zufallsstring>

# === URLS ===
CLIENT_URL=https://www.meinefirma.de
SERVER_URL=https://api.meinefirma.de
FRONTEND_URL=https://www.meinefirma.de

# === E-MAIL (SMTP) ===
SMTP_HOST=smtp.meinprovider.de
SMTP_PORT=587
SMTP_USER=noreply@meinefirma.de
SMTP_PASS=app-passwort-hier
SMTP_FROM="FixitHub" <noreply@meinefirma.de>
SMTP_SECURE=false
SUPPORT_EMAIL=support@meinefirma.de
SUPPORT_PHONE=+49 (0) 123/456789

# === DHL ===
DHL_CLIENT_ID=dhl-api-client-id
DHL_CLIENT_SECRET=dhl-api-client-secret
DHL_BC_USERNAME=dhl-business-username
DHL_BC_PASSWORD=dhl-business-passwort
BOOKING_DHL_LABEL_MODE=production

# === STRIPE (optional) ===
STRIPE_SECRET_KEY=sk_live_...

# === TWILIO SMS (optional) ===
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=auth_token_hier
TWILIO_PHONE_NUMBER=+4915112345678

# === UPLOADS ===
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./server/uploads

# === BETRIEB ===
LOG_LEVEL=INFO
COMPANY_NAME=MeineFirma GmbH
TRACKING_SALT=<zufallsstring-für-hash>
```

#### `client/.env`

```bash
VITE_SITE_URL=https://www.meinefirma.de
```

---

### 19.13 Sicherheitshinweise

| Hinweis | Maßnahme |
|---|---|
| Secrets nicht in Git | `.env`, `server/.env`, `client/.env` sind in `.gitignore` — **niemals** entfernen |
| Vorlagedateien nutzen | `.env.example` und `client/.env.example` als Kopiervorlage verwenden |
| Starke Secrets generieren | `node server/scripts/setup-env.js` oder `crypto.randomBytes(64)` |
| Unterschiedliche Secrets in Prod | JWT-Secrets für Produktion neu generieren — nie Beispielwerte übernehmen |
| Datenbankzugang absichern | In Produktion MongoDB-Auth aktivieren und eigenen User anlegen |
| SMTP App-Passwörter | Bei Gmail/Office 365 App-spezifische Passwörter statt Haupt-Passwort verwenden |
| DHL Sandbox vs. Produktion | `BOOKING_DHL_LABEL_MODE=dummy` für lokale Entwicklung, `production` nur im Live-System |
| Backup der .env-Dateien | Sicher (verschlüsselt) außerhalb des Git-Repos aufbewahren (z. B. Passwortmanager) |

---

### 19.14 Erste Inbetriebnahme – Schnellstart

```bash
# 1. Repository klonen
git clone <repo-url>
cd FixitHub

# 2. Abhängigkeiten installieren
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 3. Umgebungsvariablen einrichten
cp .env.example .env
cp client/.env.example client/.env
# Werte in .env anpassen (DATABASE_URL, JWT_SECRET, etc.)

# 4. Secrets automatisch generieren (optional)
node server/scripts/setup-env.js

# 5. MongoDB starten (lokal)
mongod --dbpath /data/db

# 6. Datenbank befüllen
npm --prefix server run seed

# 7. Anwendung starten
npm run start
# → Frontend: http://localhost:5173
# → Backend:  http://localhost:3000
```

---

## Kapitel 20: Tiefenprofil - Detailerklaerungen fuer alle Menuefunktionen

Dieses Kapitel erklaert die Menuefunktionen nicht nur auf Oberflaechenebene, sondern mit Fokus auf:
- welche Eingaben konkret erwartet werden,
- welche Wertebereiche zulaessig sind,
- welche Systemwirkung die Funktion hat,
- welche typischen Fehlkonfigurationen in der Praxis auftreten.

### 20.1 Dashboard (/admin)

| Funktion | Konkrete Parameter/Trigger | Systemwirkung | Praxishinweis |
|---|---|---|---|
| KPI-Kacheln | keine Eingabe; Aggregation aus Orders/Bookings/Messages | Live-Zustand fuer operative Priorisierung | KPI immer zusammen mit Zeitfenster/Queue lesen, nicht isoliert |
| Schnellaktionen | Klick auf Zielmodul | Direkter Kontextwechsel in kritisches Modul | Bei Stoerungen zuerst Dashboard, dann Drilldown via Schnellaktion |
| Auto-Refresh | 15s Intervall | Neu laden operativer Kennzahlen | Waehrend Massenpflege ggf. kurz pausieren, um Kontextspruenge zu vermeiden |
| JSON-Export | Export-Button | Snapshot der Dashboard-Daten | Fuer Schichtuebergabe und Incident-Doku verwenden |

### 20.2 User Management (/admin/users)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Rollenwechsel | `customer`, `staff`, `admin` | Zugriff auf geschuetzte Bereiche | Rechte nur minimal vergeben (Least Privilege) |
| Statussteuerung | `active`, `inactive` | Loginfaehigkeit + operative Sichtbarkeit | Statt Loeschen zuerst deaktivieren |
| Kundengruppenbezug | `primaryCustomerGroupId`, `customerGroupIds[]` | Preis-/Finanz-/Segmentlogik | Nach Gruppenwechsel bei kritischen Kunden Recalculate pruefen |
| Stammdatenpflege | Name, E-Mail, Telefon, Adressen, Zahlungsdaten | Grundlage fuer Rechnungen/Kommunikation | E-Mail immer normalisiert (trim/lowercase) pflegen |

### 20.3 Customer Groups (/admin/customer-groups)

| Funktion | Konkrete Felder | Wirkung | Praxishinweis |
|---|---|---|---|
| Finanzprofil pflegen | `discountPercent`, `paymentDueDays`, `cashDiscount*`, `creditLimit`, `taxMode`, `allowedPaymentMethods[]` | Steuert Zahlungsziel, Steuerlogik, Rabatt-Default, Zahlarten | `taxMode=reverse_charge` nur mit validierter B2B-Konstellation |
| Affiliate-Profil pflegen | `attributionModel`, `defaultCommissionType/value`, `releaseTrigger`, `holdDays`, `allowProductOverrides` | Kommissionsberechnung und Freigabezeitpunkt | Bei hoher Retourenquote `releaseTrigger=invoice_paid` + `holdDays>0` |
| Recalculate Kunde | API: `POST /customers/:id/groups/recalculate` | Setzt Primaergruppe auf hoechste Prioritaet, synchronisiert User-Felder | Nach manuellen Zuordnungen bei Inkonsistenz gezielt ausfuehren |
| Konfliktregeln | `resolutionStrategy`, `fallbackGroupId`, `excludedGroupIds[]` | Definiert Aufloesung bei Mehrfachtreffern | `exclusive_first` fuer harte Segmente, sonst `priority` |
| Regelengine | `conditions[]`, `excludedIf[]`, Operatoren `eq|neq|gt|gte|lt|lte|in|contains` | Automatische Zuordnung und Ausschluss | Jede Regel mit Preview testen, dann aktivieren |

### 20.4 Staff Management (/admin/staff)

| Funktion | Einstellfelder | Wirkung | Praxishinweis |
|---|---|---|---|
| Mitarbeiterprofil | `department`, `specializations`, `skills[]`, `addOnCapabilities[]` | Routing von Aufgaben und Workload-Verteilung | Skills granular statt pauschal pflegen |
| Teamstruktur | `team.name`, `leaderId`, `members[]` | Teamreporting + Zuweisungspfade | Teamleiter nur mit klarer Vertretungsregel setzen |
| Aufgabenmanagement | `task.priority`, `category`, `assignedTo`, `dueDate` | Operative Abarbeitungsreihenfolge | `urgent` nur fuer echte SLA-Risiken verwenden |

#### 20.4.1 Tab-Logik und Steuerung (Status, Mitarbeiter, Teams, Workload, Performance)

Verfuegbare Tabs:
- `status`
- `staff`
- `teams`
- `workload`
- `performance`

Status-Tab (`status`) - Echtzeitsteuerung:
- Quelle: Time-Tracking-Statusdaten (Auto-Refresh alle 30s).
- Filterwerte: `all`, `online`, `working`, `on_break`, `offline`.
- Kernwerte je Mitarbeiter:
  - `currentStatus`
  - `currentOrder`
  - `lastActivity`
  - `hoursThisWeek`
  - `hoursThisMonth`

Mitarbeiter-Tab (`staff`) - Stammdaten + operative Sicht:
- Suchfeld: Name/E-Mail-Freitext.
- Rollenfilter: `all`, `staff`, `admin`.
- Tabellenwerte:
  - Rolle, Department, Spezialisierungen
  - Aktivstatus (`active`/`inactive`)
  - Live-Workload aus `currentWorkload.utilizationRate`

Teams-Tab (`teams`) - Aufbauorganisation:
- Teamkarten zeigen Leader, Teamgroesse, Team-Performance.
- Edit/Delete pro Team ueber Aktionsmenue.

Workload-Tab (`workload`) - Lastverteilung + Aufgaben:
- Zeigt pro Mitarbeiter Kapazitaet, aktuelle Auslastung und Zuordnungen.
- Mischt `Order` und `Task` in einer einheitlichen Assignment-Liste.

Performance-Tab (`performance`) - Leistungsmetriken:
- Nutzt Team-/Mitarbeiter-Metriken (z. B. Effizienz, Qualitaet, Satisfaction).
- Eignet sich fuer Zielabgleich, nicht fuer Einzelereignis-Fehleranalyse.

#### 20.4.2 Mitarbeiter anlegen/bearbeiten/loeschen (konkret)

Anlegen (Create Staff) - Feldset und Werte:
- Pflicht:
  - `name`
  - `email` (muss eindeutig sein)
  - `password`
- Optionale Steuerfelder:
  - `phone`
  - `role`: `staff` oder `admin`
  - `department`: z. B. `Technical`, `Customer Service`, `Management`, `Quality Assurance`
  - `specializations[]` (freie Tags)
  - `addOnCapabilities[]` (freie Tags)

Backend-Wirkung:
- Passwort wird gehasht gespeichert (kein Klartext).
- Rolle defaultet auf `staff`, wenn nicht gesetzt.
- `isActive` wird initial auf `true` gesetzt.

Bearbeiten (Update Staff):
- Alle profilbezogenen Felder aktualisierbar.
- Falls Passwort mitgegeben wird, wird es neu gehasht.

Loeschen (Delete Staff) - harte Schutzlogik:
- Loeschung wird blockiert, wenn aktive Zuordnungen existieren:
  - aktive Orders (`pending`, `in_progress`, `awaiting_parts`)
  - aktive Tasks (`pending`, `in_progress`)

Praxisregel fuer sichere Abmeldung:
1. Offene Orders umverteilen.
2. Offene Tasks umverteilen oder abschliessen.
3. Danach loeschen oder alternativ nur deaktivieren.

#### 20.4.3 Teams anlegen/bearbeiten/loeschen (konkret)

Team-Felder beim Erstellen:
- `name` (Pflicht)
- `leaderId` (Pflicht, muss Staff/Admin sein)
- `description`
- `department`
- `specializations[]`
- `permissions[]`
- `members[]` mit Struktur:
  - `userId`
  - `role`: `member`, `lead`, `supervisor`

Wichtige Teamlogik:
- Teamleiter wird separat ueber `leaderId` gesetzt.
- Mitglieder koennen parallel Rollen im Team haben.
- Team-Performance wird aus abgeschlossenen Orders/Tasks der Mitglieder aggregiert.

Edit Team - was typischerweise gepflegt wird:
- Leader-Wechsel bei Schicht-/Verantwortungswechsel.
- Mitgliederrolle (`member/lead/supervisor`) fuer Eskalationspfade.
- `permissions[]` fuer teambezogene Freigaben.

Delete Team - Blocker:
- Team kann nicht geloescht werden, wenn aktive Team-Tasks existieren (`pending`/`in_progress`).

#### 20.4.4 Aufgabenmanagement (Tasks) vollstaendig

Task-Pflichtfelder beim Anlegen:
- `title`
- `assignedTo` (Staff/Admin)
- `dueDate`

Task-Steuerfelder:
- `priority`: `low`, `normal`, `high`, `urgent`
- `status`: `pending`, `in_progress`, `completed`, `cancelled`
- `category`: `repair`, `maintenance`, `training`, `meeting`, `other`
- `estimatedHours` (Default `1`)
- `actualHours` (Default `0`)
- optional: `teamId`, `orderId`, `tags[]`, `attachments[]`

Automatische Zeitstempel-Logik:
- Bei Statuswechsel auf `in_progress` wird `startDate` gesetzt.
- Bei Statuswechsel auf `completed` wird `completedDate` gesetzt.

Berechtigungen im Task-Lifecycle:
- Erstellen: `admin` und `staff`.
- Aendern: zugewiesener Nutzer, Ersteller oder Admin.
- Loeschen: Ersteller oder Admin.

Kommentare pro Task:
- Struktur je Kommentar: `userId`, `userName`, `comment`, `createdAt`.
- Nutzung: Uebergaben, Rueckfragen, Grund fuer Terminverschiebung.

#### 20.4.5 Workload-Berechnung und sinnvolle Grenzwerte

Technische Formel:
- `capacity` ist standardmaessig `10`.
- `utilizationRate = min(((assignedOrders + assignedTasks) / capacity) * 100, 100)`.

Interpretation im Betrieb:
- `< 60%`: freie Kapazitaet (fuer spontane Faelle geeignet).
- `60-85%`: gesunder Normalbereich.
- `> 85%`: Risiko fuer Terminverzug und Qualitaetsverlust.
- `100%`: harte Ueberlastung; sofortige Umverteilung pruefen.

Empfohlene Eingriffspunkte:
- Priorisierte Tasks (`urgent/high`) auf Mitarbeiter mit niedriger Auslastung verteilen.
- Team-Leads aktiv fuer Lastspitzen in `on_break`/`offline`-Lagen einsetzen.

#### 20.4.6 Detailansicht pro Mitarbeiter (wie man sie korrekt liest)

Detaildialog-Module:
- `Overview`: Person, Rolle, Department, Spezialisierungen, Add-on-Capabilities.
- `Teams`: Teamzuordnung, Teamrolle, Eintrittsdatum.
- `Workload`: laufende Orders + Tasks inklusive Prioritaet/Status/Progress.
- `Performance`: KPI-Verlauf und Zielerreichung.
- `Time Tracking`: Tages-/Wochenstunden, Break-/Workflow-Anteile.
- `Activity`: Ereignisprotokoll (Clock-in/out, Break, Order-Start/Ende).

Wichtige Felder fuer Entscheidungen:
- `currentWorkload.assignedOrders|assignedTasks|utilizationRate`
- `timeTracking.currentStatus|lastClockIn|lastClockOut`
- `performance.ordersCompleted|efficiency|qualityScore|customerSatisfaction`

Praxismuster fuer Tagessteuerung:
1. `status` pruefen (wer ist verfuegbar).
2. In Detailansicht `Workload` fuer Ueberlastung > 85% suchen.
3. Aufgaben umhaengen oder Due Dates neu staffeln.
4. In `Activity` verifizieren, ob die Entlastung wirksam war.

#### 20.4.7 Komplett-Blueprint: Staff-Menue mit allen Moeglichkeiten nutzen

1. Teamstruktur zuerst definieren (`teams`) inkl. Leader und Rollen.
2. Mitarbeiterprofil je Person pflegen (`department`, `specializations`, `addOnCapabilities`).
3. Rollen sauber setzen (`staff` vs. `admin`) nach Least-Privilege.
4. Im Workload-Tab aktuelle Verteilung gegen Kapazitaet spiegeln.
5. Tasks mit sauberer Prioritaetsmatrix (`normal/high/urgent`) anlegen.
6. Due Dates realistisch setzen und `estimatedHours` pflegen.
7. Bei Verzug: Task-Kommentare mit Ursache und naechster Aktion erfassen.
8. Status-Tab fuer Live-Situation nutzen (nicht nur historische KPI).
9. Detaildialog fuer kritische Personen oeffnen und Aktivitaetslog abgleichen.
10. Woechentliche Review: Ueberlastungen, Teamperformance und Rollenmix nachjustieren.

#### 20.4.8 Typische Fehlkonfigurationen und Gegenmassnahmen

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Mitarbeiter nicht loeschbar | Aktive Orders/Tasks vorhanden | Erst Umverteilung, dann Loeschung/Deaktivierung |
| Team wirkt komplett, aber ohne Wirkung | `leaderId` ungeeignet oder Rollenmix unklar | Teamlead fachlich passend setzen, `members[].role` bereinigen |
| Workload permanent 100% | Kapazitaet fix 10, zu viele Assignments | Tasks splitten, Teamverteilung neu balancieren |
| Aufgaben laufen aus dem SLA | `urgent/high` inflationaer oder Due Date unrealistisch | Priorisierung normalisieren, Fristen anhand Realzeiten setzen |
| Detailansicht zeigt inkonsistente Zeitdaten | Clock-In/Out-Prozess nicht sauber genutzt | Zeittracking-Prozess schulen und Pflichtablauf festlegen |

### 20.5 Bookings (/admin/bookings)

| Funktion | Werte/Inputs | Wirkung | Praxishinweis |
|---|---|---|---|
| Statusaenderung | `status` (z. B. `pending`, `processing`, `completed`, `cancelled`) | Prozessfortschritt + Kundenstatusanzeige | Status nur mit Timeline-Kommentar setzen |
| Billingstatus | `unpaid`, `partially-paid`, `paid` | Finanzreporting, Mahnlogik, Folgeaktionen | Billingstatus nie ohne Zahlungsbeleg aendern |
| Detaildialog | Buchung, Positionen, Tracking, Kommunikation | Vollansicht fuer operative Entscheidung | Immer zuerst Detaildialog statt Listenannahme |
| Rechnungsaktionen | Rechnung erzeugen/anzeigen | Finanzbelege und Versandtrigger | Vor Erzeugung Positionen und Steuerklasse pruefen |
| Reklamation/Erinnerung | Dialog mit Grund/Notiz | Folgeprozess und Kommunikation | Interne Notiz und Kundenhinweis trennen |

### 20.6 Service Management (/admin/services)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Service-Stammdaten | `name`, `category`, `deviceTypes`, `manufacturer`, `model` | Sichtbarkeit und Filterbarkeit im Konfigurator | Kategorie und Geraetetyp konsistent halten |
| Preis/Kalkulation | `price`, `purchasePrice`, `msrp`, `taxClass` | Marge, Checkout-Betrag, Rechnung | `purchasePrice` pflegen, sonst Marge verzerrt |
| Zeitplanung | `estimatedTime` | SLA-/Auslastungsplanung | Zeitwerte in Minuten standardisieren |
| SEO-Felder | `seoName`, `seoTitleTag`, `seoMetaDescription`, `searchKeywords` | Suchbarkeit intern + extern | SEO nur bei aktiven Services priorisiert pflegen |

### 20.7 Add-On Services (/admin/addons)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Add-on-Definition | `name`, `description`, `category`, `isActive` | Zusatzleistungen im Checkout | Inaktive Add-ons nicht loeschen, sondern deaktivieren |
| Preis/Bundle | `price`, `bundleDiscount`, `estimatedTime` | Gesamtpreis und Dauerprognose | Bundle-Rabatt auf Kannibalisierung pruefen |
| Kompatibilitaet | `compatibility[]` (DeviceType/Brand) | Nur passende Anzeige pro Geraet | Neue Modelle nachtragen, sonst Add-on fehlt im Verkauf |

### 20.8 Service Categories (/admin/service-categories)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Kategorietyp | `repair` oder `addon` | Trennung der Module in UI/Logik | Typ nach Erstverwendung nicht mehr wechseln |
| Sortierung | `order` | Reihenfolge in Listen/Filtern | Nur kleine Spruenge nutzen (10er-Schema) |
| Sichtbarkeit | `isActive` | Auswahlbarkeit in Services/Add-ons | Bei Migration zuerst neue Kategorie aktivieren, dann alte deaktivieren |

### 20.9 Device Management (/admin/devices)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Device Types/Brands | `name`, `key`, `logo` | Primarstruktur fuer Konfigurator | `key` stabil halten, nicht nachtraeglich brechen |
| Modelle | `name`, `slug`, `modelNumbers[]`, `synonyms[]` | Treffergenauigkeit bei Geraeteerkennung | Synonyme fuer Handelsnamen pflegen |
| Problem-/Spec-Profil | `commonProblems[]`, `specifications.*` | Diagnosehilfe + Kundeninformation | Bei neuen Generationen Spezifikationen uebernehmen und anpassen |

### 20.10 Parts Management (/admin/parts)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Variantensteuerung | `versions[].versionType` (`original`,`cheap`,`efficient`) | Preis-/Qualitaetsoption im Lager | Pro Typ klare Einkaufspolitik definieren |
| Bestandsschwellen | `quantity`, `minStockLevel`, `reorderLevel` | Low-Stock-Warnungen und Nachbestellung | `reorderLevel` > `minStockLevel` fuer Vorlauf |
| Lieferanteninfos | `supplierInfo.*`, `unitCost`, `sellingPrice` | Einkauf und Margenreporting | Preise regelmaessig aktualisieren |

### 20.11 EPart Orders (/admin/epart-orders)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Bestellung anlegen | `supplierId`, `items[]`, `expectedDeliveryDate` | Einkaufsprozess und ETA | Jede Position mit Teilevariante validieren |
| Nebenkosten | `tax`, `shippingCost` | Gesamtkosten und Marge | Versandkosten immer als eigene Position dokumentieren |
| Retouren/Umtausch | Return-/Exchange-Payload | Reklamations- und Lieferantenprozess | Rueckgabegrund standardisiert erfassen |

### 20.12 Workflow Management (/admin/workflow)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Template-Struktur | `name`, `description`, `isActive`, `deviceTypes`, `serviceTypes` | Auswahl richtiger Prozessvorlage | Aktivierung erst nach Testlauf |
| Step-Design | `steps[].estimatedTime`, `isRequired`, `formFields[]` | Laufzeit und Datenqualitaet | Pflichtschritte nur fuer harte Prozesspunkte |
| Automationsregeln | `automationRules[]` | Automatische Status-/Benachrichtigungsausloeser | Trigger sauber gegen Mehrfachausloesung absichern |

#### 20.12.1 Interface-Funktion: Template-Struktur

Konkrete Template-Felder:
- Pflicht:
  - `name`
  - `description`
  - `deviceTypes[]` (mindestens ein Eintrag)
  - `serviceTypes[]` (mindestens ein Eintrag)
- Steuerfelder:
  - `isActive`
  - `estimatedTotalTime`
  - `workflowSettings.allowParallelSteps`
  - `workflowSettings.requireStrictOrder`
  - `workflowSettings.autoProgressOnCompletion`

Management-Operationen im Menue:
- Erstellen: Server erzwingt Pflichtfelder, sonst Save-Abbruch.
- Bearbeiten: Step-/Rule-IDs werden beim Speichern bereinigt.
- Duplizieren: Vorlage wird als Basis fuer Varianten geklont.
- Loeschen: entfernt Template aus dem Verwaltungsbestand.

Nutzungsempfehlung:
1. Neue Vorlagen mit `isActive=false` starten.
2. Erst nach Test der Steps/Automationen aktivieren.

#### 20.12.2 Interface-Funktion: Step-Design

Step-Felder im Visual Builder:
- `steps[].name`
- `steps[].description`
- `steps[].estimatedTime`
- `steps[].category`: `diagnostic`, `repair`, `quality`, `addon`, `completion`
- `steps[].isRequired`
- `steps[].canSkip`
- `steps[].requiresApproval`
- `steps[].requiresFormCompletion`
- `steps[].dependencies[]`
- `steps[].tools[]`
- `steps[].skills[]`
- `steps[].checklistItems[]`
- `steps[].notificationSettings.onStart|onComplete|onDelay`
- `steps[].position.x|y`
- `steps[].order`

Formfelder direkt im Step:
- Typen: `text`, `textarea`, `number`, `checkbox`, `radio`, `select`, `multiselect`, `file`, `date`, `time`
- Attribute:
  - `id`, `name`, `label`
  - `required`
  - `placeholder`, `helpText`
  - `options[]`
  - `validation.min|max|pattern|minLength|maxLength`
  - `defaultValue`
  - `isConditional`
  - `conditionalLogic.dependsOn|condition|value`

Wirkungslogik:
- `requireStrictOrder=true`: sequentielle Abarbeitung.
- `allowParallelSteps=true`: parallele Step-Ausfuehrung nur bei entkoppelten Schritten.
- `requiresFormCompletion=true`: Abschluss blockiert bis Pflichtfelder valide sind.
- `requiresApproval=true`: Abschluss wird bis Freigabe gesperrt.

#### 20.12.3 Interface-Funktion: Automationsregeln

Triggerwerte:
- `step_completion`
- `time_delay`
- `condition_met`
- `manual`
- `form_submission`

Actionwerte:
- `send_notification`
- `update_status`
- `assign_staff`
- `create_task`
- `move_to_next_step`

Regelparameter:
- `condition`
- `actionData`
- `isActive`

Praxismuster:
1. `step_completion + update_status` fuer sauberen Statusfluss.
2. `time_delay + send_notification` fuer Eskalation bei Verzug.
3. `form_submission + assign_staff` fuer regelbasiertes Routing.

#### 20.12.4 Menue-Funktionen: Filter, Suche, Statistik

Filterwerte:
- Suche ueber Name/Beschreibung.
- Statusfilter: `all`, `active`, `inactive`.

Statistikwerte:
- `activeWorkflows`
- `inactiveWorkflows`
- `totalSteps`
- `totalAutomationRules`
- `averageCompletionTime`

Steuerhinweis:
- Viele Regeln + instabiler Betrieb: Regeln konsolidieren.
- Hohe Durchlaufzeit: Step-Zerlegung und Parallelisierung pruefen.

#### 20.12.5 Komplettablauf und Fehlkonfigurationen

Standardablauf fuer neue Vorlagen:
1. Template anlegen (`isActive=false`).
2. Settings fuer Reihenfolge/Parallelisierung setzen.
3. Step-Kette modellieren (`diagnostic -> repair -> quality -> completion`).
4. Pflicht-, Form- und Freigabelogik je Step sauber setzen.
5. Automation je Step aktivieren und mit Testauftrag pruefen.
6. Erst dann `isActive=true`.

Typische Fehlerbilder:

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Step nicht abschliessbar | Pflichtfelder/Validierung blockiert | Formregeln pruefen, Pflichtumfang reduzieren |
| Workflow bleibt haengen | Reihenfolge/Dependencies/Freigabe widerspruechlich | `requireStrictOrder`, `dependencies`, `requiresApproval` abgleichen |
| Zu viele Benachrichtigungen | Ueberlappende Notification-Regeln | Trigger je Ereignis konsolidieren |
| Falsche Zuweisung | unpraezise `assign_staff`-Daten | `actionData`, `skills[]`, `tools[]` schaerfen |

### 20.13 Analytics (/admin/analytics)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Kostenmodell | `labor.*`, `materials.*`, `overhead.*`, `depreciation.*` | Profitabilitaet und Deckungsbeitrag | Parameter mit Finance abstimmen |
| Formelsteuerung | `formula.*` Gewichtungen | KPI-Ausgabe und Ranking | Aenderungen versionieren und kommentieren |
| Export | CSV/JSON | Weiterverarbeitung extern | Immer mit Zeitstempel archivieren |

#### 20.13.1 Analytics-Menue: Aufbau und Steuerlogik

Zentrale Bedienbereiche im Analytics-Menue:
- **Hero-Aktionen**:
  - `Refresh` (Report neu laden)
  - `Einstellungen` (Kosten-/Formelparameter)
  - `Export` (CSV-Export der gefilterten Ansicht)
- **Filterleiste**:
  - `searchTerm` (Freitext)
  - `statusFilter` (`all` + dynamische Statuswerte aus Daten)
  - `dateFrom` / `dateTo` mit `Anwenden` und `Reset`
- **Spaltensteuerung**:
  - Booking-Spalten ein/ausblenden + Reihenfolge
  - Order-Detail-Spalten ein/ausblenden + Reihenfolge
  - Persistenz in Browser-Storage
- **Darstellung**:
  - `denseView` fuer kompakte Tabelle

Wirkung in der Praxis:
- Filter und Spalten wirken direkt auf Analysefokus, Exportinhalt und Detailtiefe.
- Konfigurationsaenderungen an Einstellungen beeinflussen die komplette Profitabilitaetsberechnung serverseitig.

#### 20.13.2 Kostenmodell (alle Einstellfelder + Nutzung)

Labor (`settings.labor.*`):
- `defaultHourlyRate` (EUR/Stunde): Basiskostensatz fuer Arbeitszeit.
- `includeTrackedTimeOnly` (`true/false`):
  - `true`: nur erfasste Zeit zaehlt fuer Labor/Allokation.
  - `false`: fallback-basierte Zeit wird verwendet, wenn keine Tracking-Daten vorliegen.
- `fallbackProgressWeight`: Mindestgewicht fuer Fortschritt-basierte Zeitschaetzung.
- `minimumProgressFactor`: Untergrenze fuer Fortschrittsfaktor.
- `productHandlingMinutes`: Zusatzminuten fuer Produktpositionen.

Materials (`settings.materials.*`):
- `repairMaterialBaseRate`
- `repairMaterialPerServiceRate`
- `minimumRepairMaterialRate`
- `maximumRepairMaterialRate`
- `productMaterialRate`
- `fallbackShopProductCostRate`

Nutzung:
- Steuert Materialkosten fuer Reparaturen/Produkte, besonders bei unvollstaendigen COGS-Daten.

Subcontracting (`settings.subcontracting.*`):
- `enabled` (`true/false`)
- `defaultRate` (prozentual auf Umsatzanteil)
- `keywords[]` (Triggerbegriffe wie `logic`, `board`, `solder`, `water`)

Nutzung:
- Wenn Keywords matchen, werden Fremdleistungs-Kosten automatisch als Anteil gerechnet.

Overhead (`settings.overhead.*`):
- `monthlyRent`
- `monthlyUtilities`
- `monthlyAdminPayroll`
- `monthlySoftware`
- `monthlyInsurance`
- `monthlyMarketing`
- `monthlyOtherFixedCosts`
- `targetMonthlyBillableHours`

Nutzung:
- Daraus wird `overheadHourlyRate` berechnet und auf Buchung/Order allokiert.

Depreciation (`settings.depreciation.*`):
- `monthlyEquipmentDepreciation`

Nutzung:
- Wird zu `depreciationHourlyRate` umgerechnet und je allokierter Stunde belastet.

Other Costs (`settings.otherCosts.*`):
- `packagingRate`
- `paymentFeeRate`
- `paymentFeeFixedAmount`
- `flatShippingCostPerBooking`
- `warrantyReserveRate`

Nutzung:
- Zusatzzkostenblock fuer Verpackung, Zahlungsgebuehren, Versandpauschalen, Gewaehrleistungsrueckstellung.

Accounting (`settings.accounting.*`):
- `vatRate`
- `targetGrossMarginRate`
- `defaultProjectionWorkdays`

Nutzung:
- Referenz fuer Zielmargenvergleich, Netto/Brutto-Kontext und Hochrechnung pro Arbeitstag.

Warranty (`settings.warranty.*`):
- `keywords[]`
- `defaultLabel`
- `flaggedLabel`

Nutzung:
- Automatische Kennzeichnung von Nacharbeit/Gewaehrleistungsfaellen mit Einfluss auf Reservekosten und Labeling.

#### 20.13.3 Formelsteuerung (Gewichtungen + Presets)

Profit-Gewichte (`settings.formula.profitWeights.*`):
- `netRevenue`
- `directCosts`
- `overheadCost`
- `depreciationCost`
- `otherOperatingCost`

Operating-Cost-Gewichte (`settings.formula.operatingCostWeights.*`):
- `packaging`
- `paymentFallback`
- `paymentGateway`
- `warrantyReserve`
- `orderShipping`
- `bookingFlatShipping`

Preset-Logik:
- `conservative`: Kostengewichte tendenziell hoeher.
- `realistic`: neutrale Gewichte (`1.0`).
- `growth`: kostenentlastete Gewichte fuer aggressivere Sicht.

Wirkung:
- Gewichte beeinflussen Deckungsbeitrag, Profitabilitaet und Target-Vergleich direkt.
- Besonders sensitiv sind `directCosts`, `overheadCost`, `warrantyReserve`.

#### 20.13.4 Grenzwerte und Sanitizing (wichtig fuer Datenqualitaet)

Beim Speichern werden Werte serverseitig begrenzt:
- `flatShippingCostPerBooking`: `0 .. 500`
- `paymentFeeFixedAmount`: `-100 .. 100`
- `vatRate`: `0 .. 1`
- `targetGrossMarginRate`: `0 .. 1`
- `defaultProjectionWorkdays`: `1 .. 31`
- alle Formelgewichte: `0 .. 3`

Praxisfolge:
- Extremwerte werden automatisch gekappt.
- Vor dem Speichern immer gegen Plausibilitaet mit Finance/Controlling pruefen.

#### 20.13.5 Filter, Zeitraum und Status korrekt nutzen

Verfuegbare Filtersteuerung:
- Freitextsuche (`searchTerm`) fuer Buchung/Kunde/Inhalt.
- Statusfilter (`statusFilter`) mit `all` oder spezifischem Booking-/Order-Status.
- Datumsbereich `dateFrom/dateTo` mit explizitem Anwenden.

Empfohlene Analysezyklen:
1. Erst Zeitraum setzen (z. B. letzter Monat).
2. Dann Status eingrenzen (z. B. nur `completed`).
3. Anschliessend Freitext fuer Segment/Techniker/Kundengruppe.

#### 20.13.6 Spaltenmanagement und Detailtiefe

Steuerbare Bereiche:
- Booking-Tabelle: sichtbare Spalten + Reihenfolge.
- Order-Details: sichtbare Spalten + Reihenfolge.
- Pflichtspalten bleiben aktiv, optionale Spalten koennen deaktiviert werden.

Persistenz:
- Spalten- und View-Praeferenzen werden lokal im Browser gespeichert.
- Jede Nutzerrolle kann eigene Analyseansichten fahren, ohne globale Systemaenderung.

#### 20.13.7 Export (CSV) - was wirklich exportiert wird

CSV umfasst zwei Sektionen:
1. `Rentabilitaet je Buchung`
2. `Order Details je Buchung`

Exportinhalt ist filterabhaengig:
- nur aktuell gefilterte Rows
- nur aktuell sichtbare Spalten

Dateiname folgt Datumsschema:
- `rentabilitaet-backend-YYYY-MM-DD.csv`

Praxishinweis:
- Vor Export Filter und Spaltenansicht bewusst setzen, damit Report fuer Finance/Operations direkt nutzbar ist.

#### 20.13.8 KPI-Interpretation und operative Nutzung

Wesentliche Kennzahlen in der Berechnung:
- `netRevenue`
- `directCosts` (Material, Subcontracting, Labor)
- `overheadCost`
- `depreciationCost`
- `otherOperatingCost`
- `profit`
- `marginPercent`
- `plannedHours`, `actualHours`, `varianceHours`

Interpretationsmuster:
- Hoher Umsatz + niedrige Marge: meist Kostenmodell (Material/Labor/Overhead) nachziehen.
- Hohe `varianceHours`: Planung oder Zeiterfassung inkonsistent.
- Negativer Beitrag bei Gewaehrleistungsfaellen: Warranty-Keywords/Reserveparameter kalibrieren.

#### 20.13.9 Komplett-Blueprint: Analytics vollstaendig einsetzen

1. Zeitraum und Status sauber abstecken.
2. Spaltenlayout auf Analyseziel (Finance vs. Operations) einstellen.
3. Kostenmodell pruefen/aktualisieren (`labor`, `materials`, `overhead`, `depreciation`).
4. Formel-Preset waehlen (`conservative`/`realistic`/`growth`) und feinjustieren.
5. Formel-Preview gegen Erwartungswerte plausibilisieren.
6. Einstellungen speichern und Report neu laden.
7. Abweichungen in `margin`, `varianceHours`, `otherOperatingCost` drilldownen.
8. CSV exportieren und als Monatsstand versioniert archivieren.

#### 20.13.10 Typische Fehlkonfigurationen und Gegenmassnahmen

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Profitabilitaet kippt ploetzlich ins Negative | Uebergewichtete Kostenfaktoren (`formula.*`) | Auf `realistic` zuruecksetzen und schrittweise kalibrieren |
| Overhead zu hoch pro Auftrag | `targetMonthlyBillableHours` zu niedrig | Realistische abrechenbare Stundenbasis setzen |
| Zahlungsgebuehren zu hoch | `paymentFeeRate` + `paymentFeeFixedAmount` falsch skaliert | Gateway-Konditionen abgleichen und Parameter korrigieren |
| Gewaehrleistungskosten ueberzeichnen alles | Warranty-Keywordliste zu breit | Keywords schaerfen und nur echte Rework-Muster aufnehmen |
| Export passt nicht zu Erwartung | Filter/Spalten vor Export nicht korrekt gesetzt | Vor Export immer Filter- und Spaltencheck durchfuehren |

### 20.14 Repair Requests (/admin/repair-requests)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Status/Prioritaet | `status`, `priority` | Queue-Reihenfolge und SLA | Prioritaet + Terminbezug konsistent halten |
| Kostenschaetzung | `estimatedCost` | Freigabegrundlage fuer Kundenentscheidung | Bei grossen Abweichungen Begruendung dokumentieren |
| Zuweisung/Kommunikation | `assignedStaffId`, Nachrichten, Notizen | Operative Verantwortung und Nachvollziehbarkeit | Interne Notiz strikt von Kundenmessage trennen |
| Konvertierung | Anfrage -> Auftrag | Uebergang in operativen Auftrag | Vor Konvertierung Leistungsumfang finalisieren |

#### 20.14.1 Interface-Funktion: Status/Prioritaet

Statuswerte:
- `pending`
- `reviewing`
- `approved`
- `rejected`
- `converted`

Prioritaetswerte:
- `low`
- `medium`
- `high`
- `urgent`

Wirkung:
- Status steuert den Bearbeitungszustand und Freigabepfad.
- Prioritaet steuert Queue-Gewichtung und Eskalationssicht im Backoffice.

#### 20.14.2 Interface-Funktion: Kostenschaetzung

Feld:
- `estimatedCost` (numerisch, `>= 0`)

Regel:
- Ungueltige Werte (`NaN`, `< 0`) werden abgewiesen.

Nutzung:
- Kostenwert ist Basis fuer Konvertierungsentscheidung, Kundenkommunikation und interne Freigabe.

#### 20.14.3 Interface-Funktion: Zuweisung/Kommunikation

Zuweisung:
- `assignedStaffId`

Kommunikation:
- Thread-Nachricht: `message`
- Nachricht als gelesen: Read-Operation pro Request
- Admin-Notiz: `note`

Wirkung:
- Jede Aktion wird request-bezogen gespeichert und in Detailansicht nachvollziehbar gemacht.

#### 20.14.4 Interface-Funktion: Konvertierung

Konvertierungs-Payload:
- `services[]` (mindestens ein Service)
- optional `addOns[]`
- optional `totalCost`

Wirkung:
- Request wird in operativen Auftrag ueberfuehrt.
- Request-Status springt auf `converted`.

Typische Fehlerbilder:

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Konvertierung blockiert | keine Services ausgewaehlt | mindestens einen Service setzen |
| Statuswechsel scheitert | ungueltiger Zielstatus | nur definierte Statuswerte verwenden |
| Kommunikation unklar | interne/externe Inhalte vermischt | Admin-Notiz und Kundennachricht strikt trennen |

### 20.15 Financial Management (/admin/financial)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Rechnung | `items[]`, `status`, `dueDate`, `paymentTerms` | Forderungsmanagement und Belegfluss | Nach Versand nur kontrolliert aendern |
| Teilzahlung/Refund | Payment-Dialog, Refund-Modus (`gateway`/`manual`) | Zahlungsjournal und Kundensaldo | Gateway-Refund bevorzugen bei Onlinezahlungen |
| Mahnung | Dunning Run, Eskalation, Reminder | Ueberfaelligkeiten und Follow-up | Lauf erst mit gefilterter Zielmenge starten |
| Provider-Konfiguration | Gateway-Einstellungen je Anbieter | Zahlungsabwicklung | Aenderung in Wartungsfenster einplanen |

#### 20.15.1 Interface-Funktion: Rechnung

Modulbereiche mit direktem Bezug:
- `invoices` (Erstellung, Status, Versand)
- `settings` (globale Defaultwerte)
- `exports` (Abschlussdokumentation)

Rechnungsfelder:
- `customerId`, `customerName`, `customerEmail`, optional `orderId`
- `dueDate`, `paymentTerms`
- `taxRate`, `discount`
- `items[]` mit `description`, `quantity`, `unitPrice`, `type`
- `notes`, `template`

Rechnungsstatus:
- `draft`, `pending_approval`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `cancelled`, `credited`

Defaults aus Konfiguration, die direkt in neue Rechnungen fliessen:
- `financialSettings.defaults.*` (`currency`, `taxRate`, `paymentDueDays`, `invoicePrefix`, ...)
- `financialSettings.invoiceMetadata.*` (`sellerName`, `issuerEmail`, `invoiceFooter`, `legalFooter`)

Versand-Composer (Rechnung/Mahnung):
- `recipientEmail`, `ccEmail`, `subject`, `customMessage`
- Inhaltsschalter: `includeItems`, `includeTaxBreakdown`, `includeDiscountBreakdown`, `includePaymentTerms`
- Layout: `previewFormat`, `visualTheme`, `accentColor`, `fontScale`, `detailLevel`

#### 20.15.2 Interface-Funktion: Teilzahlung/Refund

Teil-/Vollzahlung:
- Felder: `amount`, `currency`, `paymentMethod`, `paymentDate`, `reference`, `gatewayResponse`, `metadata`
- Zahlungsstatus: `pending`, `processing`, `completed`, `failed`, `refunded`, `disputed`
- Regeln:
  - keine Zahlung auf Gutschriften
  - Betrag darf offenen Rest nicht ueberschreiten

Gutschrift:
- `scope` (`full`/`partial`), `reason`, `taxRate`, `discount`, `dueDate`, `numberPrefix`

Refund:
- `amount`, `reasonCategory`, `reason`, `internalNote`
- `mode`: `gateway` oder `manual`
- `gatewayProvider`, `gatewayReference`, `notifyCustomer`
- Regeln:
  - nur fuer `completed` Payments
  - Refundbetrag <= Originalzahlung

#### 20.15.3 Interface-Funktion: Mahnung

Modulbereich:
- `dunning`

Run-Stati:
- `draft`, `running`, `paused`, `completed`, `cancelled`

Queue-Stati:
- `pending`, `processing`, `sent`, `escalated`, `skipped`, `failed`

Steuerwerte:
- `name`
- `defaultStatus`
- `defaultNote`
- `invoiceIds[]`

Interaktionsmoeglichkeiten:
- `send reminder`
- `change status` (Eskalation)
- `skip`
- `remove`
- Pause/Fortsetzen

#### 20.15.4 Interface-Funktion: Provider-Konfiguration

Modulbereich:
- `providers`

Globale Gateway-Felder:
- `name`, `provider`, `isActive`
- `configuration.currency`, `configuration.processingFee`, `configuration.fraudProtection`

Beispielwerte je Provider:
- PayPal:
  - `environment` (`sandbox/live`)
  - `sandbox_client_id`, `sandbox_client_secret`, `live_client_id`, `live_client_secret`
  - `payment_intent`, `amount_source`, `return_url`, `cancel_url`
  - `button_layout`, `button_color`, `button_shape`, `button_label`
  - `webhook_url`, `webhook_events[]`, `webhook_id`
- Stripe:
  - `mode` (`test/live`)
  - `test_publishable_key`, `test_secret_key`, `live_publishable_key`, `live_secret_key`
  - `payment_mode`, `capture_method`, `success_url`, `cancel_url`
  - `allowed_payment_methods[]`, `webhook_endpoint_secret`, `webhook_events[]`
- Bank Transfer:
  - `account_holder`, `iban`, `bic`, `bank_name`
  - `payment_term_days`, `initial_order_status`, `expire_unpaid_orders`, `expire_action`, `admin_can_mark_paid`
  - `allowed_customer_groups[]`, `allowed_countries[]`, `allowed_shipping_methods[]`
- Cash:
  - `cash_mode` (`pickup/delivery/both`)
  - `initial_order_status`
  - `fee_type` (`none/surcharge/discount`) + `fee_value`
  - `mark_paid_on_fulfillment`, `cash_receipt_number_enabled`, `cash_receipt_number_format`

Typische Fehlerbilder:

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Zahlung nicht buchbar | Status/Restbetrag ungueltig | Rechnungstatus + offenen Betrag pruefen |
| Gateway-Refund scheitert | Provider inaktiv/inkompatibel | auf `manual` wechseln oder Provider-Mapping korrigieren |
| Mahnlauf eskaliert falsch | `defaultStatus`/`defaultNote` falsch | Run-Defaults vor Start validieren |
| Nummernlogik inkonsistent | Prefix-Werte nicht vereinheitlicht | `invoicePrefix`/`creditNotePrefix` standardisieren |

### 20.16 Complaints (/admin/complaints)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Entscheidungsstatus | `approved`, `rejected`, `acknowledged`, `denied`, etc. | Prozesspfad Reklamation | Jeder Statuswechsel mit Grund dokumentieren |
| Kostenparameter | `partialRefund`, `additionalPart*`, `offerAmount` | Finanzielle Auswirkung auf Fall | Freigabegrenzen fuer Betragshoehen definieren |
| Kommunikation | Kommentar + `isInternal` | Transparenz extern/intern | Interne Details nie ohne Flag nach extern geben |

#### 20.16.1 Interface-Funktion: Entscheidungsstatus

Statuswerte:
- `pending_approval`
- `approved`
- `rejected`
- `acknowledged`
- `denied`
- `new_repair`
- `resolved`
- `closed`

Statusgebundene Aktionen:
- `pending_approval`: Admin kann genehmigen/ablehnen.
- `approved`: Techniker kann anerkennen/ablehnen.
- `denied`: Kunde kann Angebot akzeptieren oder ablehnen.

Pflichtgrenzen:
- Ablehnung Admin nur mit `rejection_reason`.
- Anerkennung Techniker nur mit `technician_reason`.

#### 20.16.2 Interface-Funktion: Kostenparameter

Werte in Bearbeitung:
- `partial_refund`
- `additional_parts[]` mit Teilname, Menge, Kosten
- `repair_notes`
- `offerAmount`
- `offerDescription`

Wirkung:
- Kostenwerte beeinflussen Reklamationswirtschaftlichkeit und Folgeauftrag.
- Bei `acknowledge` werden Zusatzteilkosten in `extraCosts` eingerechnet.

#### 20.16.3 Interface-Funktion: Kommunikation

Kommunikationsfelder:
- Kommentartext `comment`
- Sichtbarkeit `isInternal`

Regel:
- `isInternal=true` nur fuer Staff/Admin.
- Externe Kommentare triggern Kundenbenachrichtigung.

Uebersicht/Filter:
- Filter `status`, `technician`, `fromDate`, `toDate`
- CSV-Export fuer Tabellenzustand (`complaints-export-YYYY-MM-DD.csv`)

Typische Fehlerbilder:

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Aktion nicht verfuegbar | Status passt nicht zum Aktionspfad | erst in erlaubten Zwischenstatus bringen |
| Kostenabweichung | Zusatzteile/Refund nicht sauber gesetzt | Kostenfelder vor Speichern plausibilisieren |
| Falsche Nachricht beim Kunden | interner Kommentar ohne Flag | `isInternal` Pflichtcheck vor Absenden |

### 20.17 Web Shop Management (/admin/shop)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Produktstamm | `name`, `category`, `brand`, `sku`, `isActive` | Katalogsichtbarkeit und Ordnung | SKU-Konvention strikt einhalten |
| Preis/Bestand | `price`, `originalPrice`, `stockCount` | Verfuegbarkeit und Preisanzeige | Bestand nie negativ laufen lassen |
| Medien/SEO | `images[]`, `features[]`, `seo*`, `searchKeywords` | Conversion + Suchbarkeit | Altprodukte archivieren statt ueberschreiben |

#### 20.17.1 Interface-Funktion: Produktstamm

Pflichtfelder bei Create/Update:
- `name`
- `description`
- `price`
- `category`
- `brand`
- `stockCount`

Weitere Stammfelder:
- `compatibility[]`
- `weight`
- `dimensions.length|width|height`

Listensteuerung:
- Suche `searchTerm`
- Kategorie-Filter `categoryFilter`
- Sortierung `sortBy` (`createdAt`, `name`, `category`, `price`, `stockCount`, `rating`) + `sortOrder`
- Pagination `page`, `limit`

#### 20.17.2 Interface-Funktion: Preis/Bestand

Preisfelder:
- `price`
- `originalPrice`

Bestandsfelder:
- `stockCount`

Bestandsklassifikation in der UI:
- Low Stock bei kleinen Mengen (Warnbereich)
- Out of Stock bei `stockCount=0` oder `!inStock`

Import-Optionen:
- CSV-Import mit Mapping + Validierung.
- Pflichtmapping mindestens fuer `name`, `category`, `price`.

#### 20.17.3 Interface-Funktion: Medien/SEO

Medien:
- `images[]`
- `features[]`

SEO-Felder:
- `searchKeywords`
- `seoName`
- `seoTitleTag`
- `seoMetaKeywords`
- `seoMetaDescription`

Wirkung:
- Verbessert Auffindbarkeit im Shop und interne Produktauswahl (z. B. Order-Produktdialog).

Typische Fehlerbilder:

| Fehlerbild | Ursache | Gegenmassnahme |
|---|---|---|
| Produkt nicht speicherbar | Pflichtfelder unvollstaendig | Pflichtfelder vor Save validieren |
| Suchtreffer zu schwach | SEO-/Keyword-Felder leer | `searchKeywords` und `seo*` konsistent pflegen |
| Lageranzeige widerspruechlich | `inStock` und `stockCount` inkonsistent | Bestand zentral ueber `stockCount` fuehren |

### 20.18 Blog Management (/admin/blog)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Beitragspflege | `title`, `slug`, `content`, `status` | Sichtbarkeit im Blog | Slug nach Veroeffentlichung stabil halten |
| Taxonomie | `category`, `tags[]` | Filterbarkeit und interne Suche | Tags kontrolliert statt inflationaer nutzen |
| SEO/Media | `seoTitle`, `seoDescription`, `featuredImage` | Reichweite und Vorschauqualitaet | OG-Bild pro Beitrag pflegen |

### 20.19 FAQ Management (/admin/faq)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| FAQ-Eintrag | `question`, `answer`, `category`, `isActive` | Self-Service-Qualitaet | Antworten kurz + handlungsorientiert |
| Sortierung | `order` | Reihenfolge im Frontend | Kritische Fragen oben halten |

### 20.20 Homepage Management (/admin/homepage)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Blocksteuerung | Blocktyp, Reihenfolge, Inhalt | Startseitenstruktur und Messaging | Nur wenige zentrale Botschaften oberhalb Fold |
| Sichtbarkeit je Block | Aktiv/Deaktiviert | Rollout einzelner Abschnitte | Kampagnenblock mit Ablaufdatum planen |

### 20.21 Website Builder (/admin/website-builder)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| General/SEO/Layout | globale Site-Werte | Einheitliche Site-Darstellung | Vor Publish immer Preview in 3 Breakpoints |
| Header/Footer | Navigation, Links, Rechtstexte | Konsistenz auf allen Seiten | Rechtslinks nie in Landingpages vergessen |
| Theme/Typografie/Animation | Color Scheme, Fonts, Motion | Markenauftritt und UX | Animation sparsam, Performance beachten |
| Custom CSS/JS | Freitext Code | Erweiterte Anpassungen | Aenderungen versionieren und kommentieren |

### 20.22 Visual Builder (/admin/visual-builder/:pageId)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Section/Component Editing | `sections[]`, `components[]`, Content/Style | Seitenaufbau und Inhaltsstruktur | Erst Struktur, dann Feinstyling |
| Versionsverwaltung | Save, Snapshot, Restore | Redaktionssicherheit | Vor grossen Umbauten Snapshot erzwingen |
| Responsive Preview | Desktop/Tablet/Mobile | Layoutstabilitaet | Mobile zuerst auf kritischen Seiten pruefen |

### 20.23 SEO Management (/admin/seo)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Meta-Steuerung | `title`, `description`, `keywords` | SERP-Snippet und CTR | Title <= 60, Description <= 160 Zeichen |
| Canonical/Robots | `canonicalUrl`, `robots.*` | Indexierungs- und Duplicate-Control | Canonical immer absolute URL |
| Social Meta | `openGraph.*`, `twitterCard.*` | Linkvorschau in Social/Chat | OG-Bildformat standardisieren |
| Sitemap | `priority`, `changeFreq` | Crawl-Priorisierung | Nur wirklich relevante Seiten hoch priorisieren |

### 20.24 Marketing Overview (/admin/marketing-promo)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| KPI-Monitoring | Kampagnenkennzahlen | Performance-Tracking | KPIs nach Segment vergleichen, nicht nur gesamt |
| Audit/Letzte Aktionen | Ereignisprotokoll | Nachvollziehbarkeit | Vor go-live letzte Aenderungen kontrollieren |

### 20.25 Marketing Newsletters (/admin/marketing-promo/newsletters)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Kampagnenkopf | `internalName`, `subject`, `preheader` | Versandidentitaet | Betreff in Testgruppe validieren |
| Zielgruppe | `segmentId`, Opt-in Regeln | Empfaengerselektion | Segmentgroesse vor Versand fix pruefen |
| Versandmodus | Test, geplant (`scheduledAt`), sofort | Sendepipeline | Erst Test, dann geplant/scharf |

### 20.26 Marketing Promo Codes (/admin/marketing-promo/promo-codes)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Code-Regeln | `discountType`, `value`, Laufzeit, Limits | Checkout-Rabattlogik | Limit + Ablaufdatum immer setzen |
| Kombinierbarkeit | `combinable` | Stapelbarkeit von Rabatten | Kombinierbar nur mit Marge-Check |
| Zielgruppenbindung | `rules.customerGroupIds[]` | Segmentbezogene Einloesung | Mit Customer Groups abstimmen |

### 20.27 Marketing Segments (/admin/marketing-promo/segments)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Segmentregeln | Kaufhistorie, Land, Opt-in, Status | Zielgruppenselektion | Regeln inkrementell bauen und Vorschau pruefen |
| Statusverwaltung | aktiv/archiviert | Verfuegbarkeit fuer Versand | Alte Segmente archivieren statt loeschen |

### 20.28 Marketing Reports (/admin/marketing-promo/reports)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Delivery/Redemption Reports | Filter nach Zeitraum/Kampagne | Erfolgsmessung und Optimierung | A/B-Auswertung getrennt dokumentieren |
| Audit-Log | Ereigniskette | Revisionssicherheit | Kritische Kampagnen inkl. Freigabeprozess ablegen |

### 20.29 Marketing Settings (/admin/marketing-promo/settings)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Versanddefaults | `defaultFromName`, `defaultReplyTo`, `maxSendBatchSize` | Konsistenter Versandrahmen | Batchgroesse auf Provider-Limits abstimmen |
| Tracking | `trackOpens`, `trackClicks` | Messbarkeit Kampagnen | Datenschutz- und Consent-Regeln beachten |
| Teststeuerung | `allowTestSend` | QA-Sicherung | In kritischen Phasen Testpflicht etablieren |

### 20.30 System Configuration (/admin/system)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Global Config | `siteName`, `adminEmail`, `maintenanceMode` | Plattformweites Verhalten | Wartungsmodus nur mit Kommunikationsplan aktivieren |
| Template Management | Notification Templates inkl. Variablen | Automatisierte Kommunikationsqualitaet | Variablenliste pro Template dokumentieren |
| Integrationen | Provider, Endpoint, Credentials, Tests | Technische Konnektivitaet | Nach Save immer Verbindungstest ausfuehren |
| Security-Basis | Password Policy, Session, Login-Limits | Grundschutz Authentifizierung | Policy-Aenderungen mit Impact-Check releasen |

### 20.31 Email Administration (/admin/email)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| SMTP-Konfiguration | Host, Port, Auth, TLS, User/Pass | Technischer Mailversand | Provider-spezifische Ports exakt nutzen |
| Testversand/Testconnection | Testadresse + Trigger | Verifikation von Versandstrecke | Vor Kampagnen immer Testversand |
| Delivery/SMTP Logs | Filter + Detaildialog | Fehlersuche und Laufzeitkontrolle | Fehlercodes fuer Runbooks sammeln |

### 20.32 Live Tracking (/admin/live-tracking)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Session/Event Feed | Filterung nach Aktivitaet | Echtzeitbeobachtung Nutzerverhalten | In Incident-Faellen mit Zeitfenster korrelieren |
| Top-Listen | Seiten/Events Ranking | Fokus auf Hotspots | Bei Peaks mit Deploy-/Kampagnenzeit abgleichen |

### 20.33 Database Management (/admin/database)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Backup | Erstellen/Download/Historie | Datensicherung | Vor Massenaktionen Pflichtbackup |
| Cleanup | `cleanupDays`, `cleanupCollections[]` | Datenhygiene und Speicherreduktion | Erst Dry-Run/kleine Menge testen |
| Optimierung/Operations | Wartungsaktionen | Performance und Konsistenz | In niedriger Last ausfuehren |

### 20.34 Security Settings (/admin/security)

| Funktion | Einstellwerte | Wirkung | Praxishinweis |
|---|---|---|---|
| Passwortpolicy | Laenge/Komplexitaet | Kontohaertung | Stufenweise schaerfen, Helpdesk vorbereiten |
| Login-Schutz | `maxLoginAttempts`, `lockoutDuration` | Brute-Force-Abwehr | Werte an Nutzerbasis und Risiko anpassen |
| Session-Policy | `sessionTimeout` | Auto-Logout und Risikoreduktion | Fuer Admins kuerzer als fuer Kunden |
| 2FA-Schalter | `enableTwoFactor` | Erhoehte Kontosicherheit | Bei Aktivierung Rolloutplan + Backupcodes |
| IP-Blockierung | IP + Grund | Sofortabwehr bei Missbrauch | Sperrungen mit Ablauf/Review pflegen |

### 20.35 Weitere Menuepunkte

| Menue | Funktionstiefe | Betriebsnutzen |
|---|---|---|
| `/messages` | Threadsteuerung, interne/externe Kontexte, Unread-Handling | Schnelle Klaerung offener Vorgangsfragen |
| `/notifications` | Ereignis-Feed, Priorisierung, Lesestatus | Fruehwarnsystem fuer operative Engpaesse |
| `/profile` | Eigene Nutzerdaten, Kontakt/Passwort, persoenliche Voreinstellungen | Datenqualitaet und Kontosicherheit pro Admin |
