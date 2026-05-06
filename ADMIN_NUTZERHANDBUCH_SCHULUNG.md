# Admin Nutzerhandbuch Schulungsversion - FixitHub

## 1. Ziel und Geltungsbereich
Dieses Dokument ist die interne Schulungs- und Betriebsfassung fuer den Admin-Bereich von FixitHub. Es richtet sich an neue und bestehende Administratoren und beschreibt die Navigation, die wichtigsten Admin-Funktionen, verbindliche Arbeitsablaeufe sowie die betriebliche Erwartung an Dokumentation, Freigaben und Qualitaetssicherung.

Diese Schulungsversion ist bewusst prozessorientiert formuliert. Sie dient der Einarbeitung, der taeglichen Orientierung und der sicheren Administration im Produktivbetrieb. Fuer tiefere Feld-, API- und Datenflussdetails bleibt das bestehende Referenzdokument `ADMIN_NUTZERHANDBUCH.md` die technische Langfassung.

## 2. Zugriff und Berechtigungen
- Der Admin-Bereich ist nur fuer Benutzer mit Rolle `admin` freigegeben.
- Zentrale Startseite: `/admin`
- Die meisten Unterseiten sind direkt ueber die Sidebar erreichbar.
- Einige Funktionen werden zusaetzlich ueber Quick Actions, Detaildialoge oder direkte Kontextspruenge aus Buchungen, Auftraegen und Builder-Ansichten geoeffnet.

**Schulungsziel nach Abschluss dieses Handbuchs:**
- die Hauptbereiche des Admin-Menues sicher zuordnen koennen
- operative und konfigurierende Admin-Aufgaben voneinander unterscheiden koennen
- Standardaenderungen im System nachvollziehbar, dokumentiert und mit geeigneter Freigabelogik durchfuehren koennen
- risikoarme Routineaenderungen von kritischen Produktiv-Eingriffen sauber abgrenzen koennen

## 3. Bedienkonzept und Arbeitslogik im Admin-Bereich
- Die Sidebar ist nach Geschaeftsfunktion gegliedert.
- `User Management` steuert Benutzer, Kundengruppen und Personal.
- `Order Management` steuert Auftraege, Buchungen, Reparaturanfragen, Reklamationen, Lager, Workflows und Finanzen.
- `Content Management` steuert Shop- und Webseiteninhalte.
- `Marketing/Promo` steuert Kampagnen, Segmente, Newsletter und Promo-Mechaniken.
- `System Management` steuert Systemkonfiguration, E-Mail, Tracking, Datenbank und Sicherheit.

**Verbindliche Arbeitsgrundsaetze fuer Admins:**
- Jede produktive Aenderung muss fachlich begruendet sein.
- Kritische Eingriffe duerfen nicht ohne Pruefung von Auswirkungen auf Kunden, Auftraege, Zahlungen oder Kommunikation erfolgen.
- Status-, Rollen- und Konfigurationsaenderungen sind nachvollziehbar zu dokumentieren.
- Vor Massenaktionen, Imports, Loeschungen oder sicherheitsrelevanten Aenderungen ist eine Plausibilisierung Pflicht.
- Admin-Seiten mit Vorschau- oder Reporting-Charakter duerfen nicht mit operativen Detailseiten verwechselt werden.

## 4. Menuestruktur und Funktionsgruppen

### 4.1 Dashboard

![Admin Dashboard](screenshots/admin/01-dashboard.png)

**Route:** `/admin`

**Zweck:**
Das Dashboard ist die taegliche Leitwarte des Systems. Es verdichtet operative Kennzahlen, offene Aufgaben, Systemsignale und direkte Navigation in Kernbereiche.

**Was Admins hier koennen:**
- Tageslage pruefen
- Buchungen, Reparaturanfragen und Benachrichtigungen priorisieren
- Schnell in kritische Bereiche springen
- Live-Daten ueber Auto-Refresh oder manuellen Refresh aktualisieren

**Wann die Seite genutzt wird:**
- Tagesbeginn
- Zwischenkontrolle bei hoher Last
- Eskalations- oder Stoerungslagen

### 4.2 User Management

![User Management](screenshots/admin/10-users.png)

Der Bereich `User Management` enthaelt drei Kernfunktionen:
- Benutzerverwaltung
- Kundengruppen
- Mitarbeiterverwaltung

#### User Management (`/admin/users`)
- Benutzer suchen, filtern, anlegen, bearbeiten und deaktivieren
- Rollen und Status pflegen
- CSV-Import kontrolliert durchfuehren
- Detail- und Bearbeitungsdialoge fuer Stammdaten nutzen

**Typische Admin-Aufgabe:**
Einen Benutzer nicht nur technisch aendern, sondern auch fachlich korrekt einstufen, zum Beispiel Rolle, Aktivstatus oder Kundengruppenzuordnung.

#### Customer Groups (`/admin/customer-groups`)
- Gruppenlogik, Finanzprofile und Affiliate-Profile verwalten
- automatische Zuordnungsregeln pflegen
- Kunden manuell zuweisen oder Primaergruppe setzen
- Recalculate-Funktionen bewusst und dokumentiert einsetzen

**Betriebsregel:**
Kundengruppen beeinflussen Finanz- und Vertriebslogik. Aenderungen duerfen daher nicht wie reine Textpflege behandelt werden.

#### Staff Management (`/admin/staff`)
- Mitarbeiter, Teams, Workload und Performance-Sichten verwalten
- Verfuegbarkeiten, Teams und operative Zuordnung pflegen
- Aufgaben- und Lastverteilung nachvollziehbar steuern

**Betriebsregel:**
Personaldaten und Teamstrukturen wirken direkt auf operative Zustaendigkeiten und muessen konsistent gehalten werden.

### 4.3 Order Management

![Bookings](screenshots/admin/20-bookings.png)

`Order Management` ist der groesste operative Bereich und umfasst:
- Buchungen
- Auftraege
- Services und Add-ons
- Service-Kategorien
- Geraete
- Ersatzteile und E-Part-Bestellungen
- Workflows
- Analytics
- Reparaturanfragen
- Finanzen
- Reklamationen

#### Bookings (`/admin/bookings`)
- Buchungen sichten, filtern und im Detail pruefen
- Billing- und Prozessstatus pflegen
- Rechnungsaktionen, Versand- und Retourenablauf steuern
- den Bezug zu den verknuepften Auftraegen herstellen

#### Orders (`/admin/orders` -> `/orders/:id`)
- Auftragslisten oeffnen und Detailbearbeitung starten
- Status, Leistungen, Material, Workflow und Kommunikation steuern
- Device Inspection und Complaint-Kontext direkt am Auftrag verwalten

**Operative Bedeutung:**
Die Auftragsdetailseite ist auch im Admin-Bereich die zentrale Steuerungsseite fuer konkrete Reparatur- und Servicefaelle.

#### Repair Requests (`/admin/repair-requests`)
- eingehende Reparaturanfragen fachlich sichten
- priorisieren, zuweisen und bei Eignung in Auftraege ueberfuehren

#### Financial Management (`/admin/financial`)
- Zahlungs- und Finanzprozesse konfigurieren und pruefen
- provider- und konfigurationsbezogene Einstellungen kontrollieren

#### Complaints (`/admin/complaints`)
- Reklamationen fachlich, finanziell und kommunikativ nachverfolgen
- Freigaben und Entscheidungen sauber dokumentieren

### 4.4 Content Management

![Web Shop Management](screenshots/admin/40-shop.png)

Der Bereich `Content Management` umfasst:
- Web Shop Management
- Blog Management
- FAQ Management
- Homepage Management
- Website Builder
- Visual Builder
- SEO Management

**Zweck:**
Dieser Bereich steuert die oeffentliche Systemdarstellung, Inhalte, SEO und builder-basierte Seitenpflege.

**Arbeitslogik:**
- Inhalte zuerst fachlich pruefen
- dann im passenden Pflegebereich aendern
- danach auf Sichtbarkeit, Konsistenz und Darstellung kontrollieren

### 4.5 Marketing/Promo

![Marketing Overview](screenshots/admin/50-marketing-overview.png)

Der Bereich `Marketing/Promo` umfasst:
- Uebersicht
- Newsletter
- Promo Codes
- Segmente
- Reports
- Einstellungen

**Zweck:**
Marketing- und Segmentierungslogik zentral pflegen und bewerten.

**Betriebsregel:**
Marketingaenderungen duerfen nicht isoliert betrachtet werden. Segmente, Regeln, Freigabezeitpunkte und Auswertungen muessen gemeinsam plausibilisiert werden.

### 4.6 System Management

![System Management](screenshots/admin/60-system-configuration.png)

Der Bereich `System Management` umfasst:
- System Configuration
- Email Administration
- Live Tracking
- Database Management
- Security Settings

**Zweck:**
Systemweite Konfiguration, Infrastrukturverhalten und sicherheitsrelevante Einstellungen steuern.

**Betriebsregel:**
Jede Aenderung in diesem Bereich ist als potenziell systemweit wirksam zu behandeln.

## 5. Verbindliche Standardablaeufe fuer Admins

### 5.1 Tagesstart als Admin
1. Dashboard aufrufen.
2. Offene Buchungen, Reparaturanfragen und Benachrichtigungen priorisieren.
3. System- oder Sicherheitsauffaelligkeiten pruefen.
4. Kritische operative Faelle in die Bearbeitung ueberfuehren.

### 5.2 Benutzer- und Rollenpflege
1. Benutzer identifizieren.
2. Rolle, Status und Zugehoerigkeiten fachlich pruefen.
3. Aenderung im passenden Dialog oder Formular vornehmen.
4. Ergebnis kontrollieren und bei sensiblen Aenderungen dokumentieren.

### 5.3 Reparaturanfrage bis Auftrag
1. Anfrage in `/admin/repair-requests` oeffnen.
2. Geraet, Problem und Prioritaet pruefen.
3. Staff zuweisen oder interne Notiz setzen.
4. Anfrage nur bei fachlicher Klarheit in Auftrag umwandeln.
5. Anschlussbearbeitung im Auftrag dokumentiert fortsetzen.

### 5.4 Buchung bis Auftragsdetail
1. Buchung in `/admin/bookings` oeffnen.
2. Prozess- und Billingstatus plausibilisieren.
3. Zugeordnete Auftraege pruefen.
4. Nur bei Bedarf in die Detailbearbeitung `/orders/:id` wechseln.

### 5.5 Produktive Konfigurationsaenderung
1. Aenderungsziel fachlich klar benennen.
2. Betroffenen Bereich identifizieren.
3. Auswirkungen auf Kunden, Zahlungen, Kommunikation und Betrieb pruefen.
4. Aenderung kontrolliert vornehmen.
5. Ergebnis sichtbar validieren.
6. Bei kritischen Aenderungen Dokumentation oder Freigabenachweis sichern.

## 6. Kernarbeitsbereich: Auftragsdetailseite auch fuer Admins

![Order Detail Uebersicht](screenshots/staff/order-details/order-detail-overview.png)

Die Auftragsdetailseite `/orders/:id` ist nicht nur Staff-Arbeitsflaeche, sondern auch zentrale Admin-Steuerungsseite fuer operative Sonderfaelle, Freigaben und Eskalationen.

**Admins nutzen die Seite insbesondere fuer:**
- Status- und Prozesssteuerung
- Leistungen, Add-ons und Materialanpassungen
- Workflow-Zuweisung und Nachverfolgung
- Complaint- und Kommunikationskontext
- Plausibilisierung von Geraete- und Inspektionsdaten

**Verbindlicher Admin-Ablauf im Auftrag:**
1. Status und Vorgeschichte pruefen.
2. Geraet, Lock und Inspection plausibilisieren.
3. Leistungen und Material nur begruendet anpassen.
4. Workflow- und Staff-Zuordnung auf Konsistenz pruefen.
5. Kommunikation und Complaint-Folgen dokumentieren.
6. Status erst nach fachlicher Pruefung fortschreiben.

## 7. Freigaben, Dokumentationspflicht und Risikosteuerung

### 7.1 Kritische Aktionen mit erhoehter Vorsicht
Als kritisch gelten insbesondere:
- Rollen- und Rechteaenderungen
- Finanz- und Zahlungslogik
- E-Mail-, SMTP- oder Versandkonfiguration
- Sicherheits- und Zugriffseinstellungen
- Massenimporte, Bulk-Aktionen und Loeschvorgaenge
- Konfigurationsaenderungen mit Auswirkung auf Checkout, Rechnungen oder Kundenkommunikation

### 7.2 Dokumentationspflicht
Folgende Aenderungen sind nachvollziehbar zu dokumentieren:
- warum die Aenderung noetig war
- welcher Bereich betroffen ist
- welche Auswirkung erwartet wurde
- wie die Plausibilisierung nach der Aenderung erfolgte

## 8. Einarbeitungsablauf fuer neue Admins

1. Dashboard, User Management und Order Management funktional verstehen.
2. Benutzer- und Rollenpflege unter Anleitung durchfuehren.
3. Buchungen, Reparaturanfragen und Auftraege im Zusammenhang lesen koennen.
4. Content-, Marketing- und Systembereiche in ihrer Wirkung voneinander unterscheiden koennen.
5. Kritische Aenderungen nur mit Freigabelogik und Dokumentation ausfuehren.
6. Vor Produktiv-Eingriffen stets Pruef- und Validierungsroutine anwenden.

## 9. Lernkontrolle und betriebliche Mindeststandards

Ein Admin gilt als arbeitsfaehig eingewiesen, wenn folgende Punkte sicher beherrscht werden:
- die Menuestruktur des Admin-Bereichs kann ohne Hilfestellung erklaert werden
- Benutzer-, Buchungs- und Reparaturanfrageprozesse koennen sicher gesteuert werden
- die Auftragsdetailseite kann auch in Eskalationsfaellen fachlich korrekt genutzt werden
- kritische Konfigurationen werden nicht ohne Wirkungspruefung geaendert
- Dokumentations- und Freigabepflichten werden verstanden und angewendet

## 10. Bezug zur technischen Langfassung
Diese Schulungsversion ist auf sichere Bedienung und betriebliche Orientierung ausgerichtet. Fuer vertiefte Informationen zu Feldern, API-Verknuepfungen, Datenfluss, Detaildialogen und tiefen Funktionsprofilen ist weiterhin das bestehende Referenzdokument `ADMIN_NUTZERHANDBUCH.md` massgeblich.

## 11. Zusammenfassung
Der Admin-Bereich ist die zentrale Steuerungs- und Konfigurationsoberflaeche von FixitHub. Wer Dashboard, User Management, Order Management, Content Management, Marketing/Promo und System Management funktional sauber voneinander trennen kann, kann Aenderungen sicherer planen und produktive Eingriffe kontrollierter ausfuehren. Die wichtigste Grundregel bleibt: erst pruefen, dann aendern, dann validieren und bei sensiblen Eingriffen nachvollziehbar dokumentieren.