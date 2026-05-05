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

### Staff Management (/admin/staff)
- Interface-Funktionen:
  - Tabs fuer Status, Mitarbeiter, Teams, Workload, Performance
  - Mitarbeiter anlegen/bearbeiten/loeschen
  - Teams anlegen/bearbeiten/loeschen
  - Aufgabenmanagement (Tasks)
  - Detailansicht pro Mitarbeiter
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
- Angezeigt wird:
  - Preis, Bestand, Kategorie, Marke, Produktattribute, SEO-Daten
- Bearbeitbar:
  - Komplette Produktstammdaten

### Blog Management (/admin/blog)
- Zweck:
  - Verwaltung von Blog-Inhalten fuer die oeffentliche Website.
- Hinweis:
  - Route und Admin-Seite sind aktiv im System angebunden.

### FAQ Management (/admin/faq)
- Zweck:
  - Pflege von FAQ-Inhalten fuer Kundensupport und Self-Service.
- Hinweis:
  - Route und Admin-Seite sind aktiv im System angebunden.

### Homepage Management (/admin/homepage)
- Zweck:
  - Pflege der Startseiten-Inhalte und Block-Struktur.
- Hinweis:
  - Spezielle Blocktypen sind im Projekt dokumentiert.

### Website Builder (/admin/website-builder)
- Interface-Funktionen:
  - Vollstaendige Website-Einstellungen in Tabs
  - Abschnitte: General, SEO, Layout, Header/Footer, Color Scheme, Typography, Animationen, Custom CSS/JS, Integrationen
  - Publish-, Backup- und Export-Funktion
  - Device-Preview (Desktop/Tablet/Mobile)
- Konfigurierbar:
  - Globale Website-Darstellung und technische Integrationen

### Visual Builder (/admin/visual-builder/:pageId)
- Interface-Funktionen:
  - Seiteninhalt auf Komponentenebene erstellen und bearbeiten
  - Section/Component Library, Canvas, Settings Panel
  - Undo/Redo, Versionierung, Restore
  - Save und Publish
  - Responsive Preview
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

![PLATZHALTER - Dashboard](screenshots/admin/01-dashboard.png)

Aufnahmeinhalt:
- KPI-Kacheln, Alert-Bar, Schnellaktionen sichtbar

#### Messages (/messages)
Dateiname: screenshots/admin/02-messages.png

![PLATZHALTER - Messages](screenshots/admin/02-messages.png)

Aufnahmeinhalt:
- Nachrichtenliste und Detailbereich

#### Notifications (/notifications)
Dateiname: screenshots/admin/03-notifications.png

![PLATZHALTER - Notifications](screenshots/admin/03-notifications.png)

Aufnahmeinhalt:
- Benachrichtigungsliste mit ungelesenen Eintraegen

#### Profile (/profile)
Dateiname: screenshots/admin/04-profile.png

![PLATZHALTER - Profile](screenshots/admin/04-profile.png)

Aufnahmeinhalt:
- Profilstammdaten und Kontoeinstellungen

### 15.2 User Management

#### User Management (/admin/users)
Dateiname: screenshots/admin/10-users.png

![PLATZHALTER - User Management](screenshots/admin/10-users.png)

Aufnahmeinhalt:
- Filterleiste, Tabelle, Aktionsmenue

#### Customer Groups (/admin/customer-groups)
Dateiname: screenshots/admin/11-customer-groups.png

![PLATZHALTER - Customer Groups](screenshots/admin/11-customer-groups.png)

Aufnahmeinhalt:
- Tabs fuer Gruppen/Regeln/Zuweisungen

#### Staff Management (/admin/staff)
Dateiname: screenshots/admin/12-staff-management.png

![PLATZHALTER - Staff Management](screenshots/admin/12-staff-management.png)

Aufnahmeinhalt:
- Tabs Status/Staff/Teams/Workload/Performance

### 15.3 Order Management

#### Bookings (/admin/bookings)
Dateiname: screenshots/admin/20-bookings.png

![PLATZHALTER - Bookings](screenshots/admin/20-bookings.png)

Aufnahmeinhalt:
- Buchungstabelle mit Status/Billing-Filter

#### Service Management (/admin/services)
Dateiname: screenshots/admin/21-services.png

![PLATZHALTER - Service Management](screenshots/admin/21-services.png)

Aufnahmeinhalt:
- Service-Liste mit Sortierung und Aktionsbuttons

#### Add-On Services (/admin/addons)
Dateiname: screenshots/admin/22-addons.png

![PLATZHALTER - Add-On Services](screenshots/admin/22-addons.png)

Aufnahmeinhalt:
- Add-on-Tabelle mit Kategorie/Preis

#### Service Categories (/admin/service-categories)
Dateiname: screenshots/admin/23-service-categories.png

![PLATZHALTER - Service Categories](screenshots/admin/23-service-categories.png)

Aufnahmeinhalt:
- Kategorienliste inkl. Aktivstatus

#### Device Management (/admin/devices)
Dateiname: screenshots/admin/24-devices.png

![PLATZHALTER - Device Management](screenshots/admin/24-devices.png)

Aufnahmeinhalt:
- Device-Dashboard oder Modelverwaltung

#### Parts Management (/admin/parts)
Dateiname: screenshots/admin/25-parts.png

![PLATZHALTER - Parts Management](screenshots/admin/25-parts.png)

Aufnahmeinhalt:
- Teileliste, Bestand, Filter

#### EPart Orders (/admin/epart-orders)
Dateiname: screenshots/admin/26-epart-orders.png

![PLATZHALTER - EPart Orders](screenshots/admin/26-epart-orders.png)

Aufnahmeinhalt:
- Bestellliste, Lieferantenbezug, Status

#### Workflow Management (/admin/workflow)
Dateiname: screenshots/admin/27-workflow.png

![PLATZHALTER - Workflow Management](screenshots/admin/27-workflow.png)

Aufnahmeinhalt:
- Workflow-Karten/Liste und Status

#### Analytics (/admin/analytics)
Dateiname: screenshots/admin/28-analytics.png

![PLATZHALTER - Analytics](screenshots/admin/28-analytics.png)

Aufnahmeinhalt:
- KPI- oder Profitabilitaetsansicht

#### Repair Requests (/admin/repair-requests)
Dateiname: screenshots/admin/29-repair-requests.png

![PLATZHALTER - Repair Requests](screenshots/admin/29-repair-requests.png)

Aufnahmeinhalt:
- Anfrage-Liste mit Status/Prioritaet

#### Financial Management (/admin/financial)
Dateiname: screenshots/admin/30-financial.png

![PLATZHALTER - Financial Management](screenshots/admin/30-financial.png)

Aufnahmeinhalt:
- Invoices/Payments Uebersicht

#### Complaints (/admin/complaints)
Dateiname: screenshots/admin/31-complaints.png

![PLATZHALTER - Complaints](screenshots/admin/31-complaints.png)

Aufnahmeinhalt:
- Reklamationsliste und Statusaktionen

### 15.4 Content Management

#### Web Shop Management (/admin/shop)
Dateiname: screenshots/admin/40-shop.png

![PLATZHALTER - Web Shop Management](screenshots/admin/40-shop.png)

Aufnahmeinhalt:
- Produktliste mit Such/Filterbereich

#### Blog Management (/admin/blog)
Dateiname: screenshots/admin/41-blog.png

![PLATZHALTER - Blog Management](screenshots/admin/41-blog.png)

Aufnahmeinhalt:
- Blog-Beitragsliste und Aktionen

#### FAQ Management (/admin/faq)
Dateiname: screenshots/admin/42-faq.png

![PLATZHALTER - FAQ Management](screenshots/admin/42-faq.png)

Aufnahmeinhalt:
- FAQ-Liste und Bearbeitungsoptionen

#### Homepage Management (/admin/homepage)
Dateiname: screenshots/admin/43-homepage.png

![PLATZHALTER - Homepage Management](screenshots/admin/43-homepage.png)

Aufnahmeinhalt:
- Block-/Sektionenverwaltung der Startseite

#### Website Builder (/admin/website-builder)
Dateiname: screenshots/admin/44-website-builder.png

![PLATZHALTER - Website Builder](screenshots/admin/44-website-builder.png)

Aufnahmeinhalt:
- Builder-Tabs und Publish/Backup-Bereich

#### Visual Builder (/admin/visual-builder/:pageId)
Dateiname: screenshots/admin/45-visual-builder.png

![PLATZHALTER - Visual Builder](screenshots/admin/45-visual-builder.png)

Aufnahmeinhalt:
- Canvas + Komponentenbibliothek + Settings

#### SEO Management (/admin/seo)
Dateiname: screenshots/admin/46-seo.png

![PLATZHALTER - SEO Management](screenshots/admin/46-seo.png)

Aufnahmeinhalt:
- SEO-Tabellenbereich und Filter

### 15.5 Marketing/Promo

#### Uebersicht (/admin/marketing-promo)
Dateiname: screenshots/admin/50-marketing-overview.png

![PLATZHALTER - Marketing Overview](screenshots/admin/50-marketing-overview.png)

Aufnahmeinhalt:
- KPI-Karten und letzte Aktivitaeten

#### Newsletter (/admin/marketing-promo/newsletters)
Dateiname: screenshots/admin/51-marketing-newsletters.png

![PLATZHALTER - Marketing Newsletters](screenshots/admin/51-marketing-newsletters.png)

Aufnahmeinhalt:
- Newsletter-Liste und Versandaktionen

#### Promo Codes (/admin/marketing-promo/promo-codes)
Dateiname: screenshots/admin/52-marketing-promo-codes.png

![PLATZHALTER - Marketing Promo Codes](screenshots/admin/52-marketing-promo-codes.png)

Aufnahmeinhalt:
- Promo-Code-Liste und Statusschalter

#### Segmente (/admin/marketing-promo/segments)
Dateiname: screenshots/admin/53-marketing-segments.png

![PLATZHALTER - Marketing Segments](screenshots/admin/53-marketing-segments.png)

Aufnahmeinhalt:
- Segmentliste und Vorschau-Info

#### Reports (/admin/marketing-promo/reports)
Dateiname: screenshots/admin/54-marketing-reports.png

![PLATZHALTER - Marketing Reports](screenshots/admin/54-marketing-reports.png)

Aufnahmeinhalt:
- Delivery-Stats, KPI-Bloecke, Audit-Log

#### Einstellungen (/admin/marketing-promo/settings)
Dateiname: screenshots/admin/55-marketing-settings.png

![PLATZHALTER - Marketing Settings](screenshots/admin/55-marketing-settings.png)

Aufnahmeinhalt:
- Globale Marketing-Defaults und Tracking-Optionen

### 15.6 System Management

#### System Configuration (/admin/system)
Dateiname: screenshots/admin/60-system-configuration.png

![PLATZHALTER - System Configuration](screenshots/admin/60-system-configuration.png)

Aufnahmeinhalt:
- Konfig-Tabs und Integrationsbereich

#### Email Administration (/admin/email)
Dateiname: screenshots/admin/61-email-administration.png

![PLATZHALTER - Email Administration](screenshots/admin/61-email-administration.png)

Aufnahmeinhalt:
- SMTP-Settings und Delivery-Logs

#### Live Tracking (/admin/live-tracking)
Dateiname: screenshots/admin/62-live-tracking.png

![PLATZHALTER - Live Tracking](screenshots/admin/62-live-tracking.png)

Aufnahmeinhalt:
- Echtzeitmetriken + Session/Event-Feed

#### Database Management (/admin/database)
Dateiname: screenshots/admin/63-database-management.png

![PLATZHALTER - Database Management](screenshots/admin/63-database-management.png)

Aufnahmeinhalt:
- DB-Health, Backup und Operations

#### Security Settings (/admin/security)
Dateiname: screenshots/admin/64-security-settings.png

![PLATZHALTER - Security Settings](screenshots/admin/64-security-settings.png)

Aufnahmeinhalt:
- Security-Policy + Sessions + Audit-Tab

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
