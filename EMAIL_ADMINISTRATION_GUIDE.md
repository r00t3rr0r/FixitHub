# Email-Verwaltung für Admin - Benutzerhandbuch

## Überblick

Die Email-Verwaltungsseite bietet ein umfassendes Admin-Interface zur Überwachung und Konfiguration aller SMTP Email-Integrationen. Sie können Versandstatistiken einsehen, E-Mail-Verlauf verfolgien, Versandprotokolle durchsuchen und SMTP-Einstellungen konfigurieren.

## Zugriff

**Route:** `/admin/email`  
**Erforderliche Berechtigung:** Admin  
**Navigation:** Admin Sidebar → System Management → Email-Verwaltung

## Hauptfunktionen

### 1. Statistiken Tab

**Zweck:** Überblick über die E-Mail-Versandgesundheit und Performance

#### Statistik-Karten
- **Gesamt:** Gesamtzahl der E-Mails im Speicher
- **Versendet:** Erfolgreich zugestellte E-Mails
  - Zeigt Anzahl und erfolgreiche Versendungen
- **Fehlgeschlagen:** Nicht zugestellte E-Mails
  - Zeigt Anzahl und Ausfallquote (%)
- **Durchschnitt:** Durchschnittliche Versanddauer
  - Angezeigt in Millisekunden oder Sekunden

#### Status-Zusammenfassung
- **Versand-Status:** Gesund / Warnung / Kritisch
  - Grün: < 5% Ausfallquote
  - Gelb: 5-10% Ausfallquote
  - Rot: > 10% Ausfallquote
  
- **Durchschnittliche Latenz:** Optimal / Langsam
  - Optimal: < 5000ms
  - Langsam: ≥ 5000ms

#### Performance-Übersicht
- Echtzeit-Dashboard mit Erfolgsquoten
- Zeigt Verhältnis von erfolgreichen zu Gesamtemails

---

### 2. Verlauf Tab

**Zweck:** Versandverlauf für spezifische E-Mail-Adressen nachverfolgen

#### Verwendung
1. **E-Mail-Adresse eingeben** - Geben Sie die komplette E-Mail-Adresse des Empfängers ein
2. **Suchen klicken** - Rufen Sie den Verlauf ab
3. **Ergebnisse anzeigen** - Sehen Sie alle Versendungen an diese Adresse

#### Angezeigter Verlauf
Jeder Eintrag zeigt:
- **Vorlage:** Verwendete Email-Vorlage (z.B. "Guest Order Confirmation")
- **Status:** Versendet / Fehlgeschlagen / In Warteschlange
- **Betreff:** E-Mail Betreffzeile (gekürzt)
- **Versuche:** Anzahl der Versendungsversuche
- **Dauer:** Wie lange der Versand dauerte (z.B. "2.5s")
- **Zeitstempel:** Wann der Versand erfolgt ist
- **Fehlermeldung:** Falls gescheitert, warum

#### Use Cases
- Sichtbarkeit, ob E-Mails an Nutzer versendet wurden
- Überprüfung von Lieferproblemen für spezifische Empfänger
- Debugging von Versandfehlern

---

### 3. Protokoll Tab

**Zweck:** Durchsuchen und Analysieren aller Email-Versände mit Filterung und Pagination

#### Filteroptionen
- **Alle:** Alle Versendausgänge
- **Versendet:** Nur erfolgreiche Versendungen
- **Fehlgeschlagen:** Nur fehlgeschlagene Versendungen
- **In Warteschlange:** Nur wartende E-Mails

#### Spalten im Protokoll
- **Empfänger:** E-Mail-Adresse des Empfängers
- **Vorlage:** Name der Email-Vorlage
- **Status:** Versandstatus (Farbcodiert)
- **Dauer:** Versanddauer in ms
- **Zeit:** Zeitpunkt des Versands (Uhrzeit)
- **Fehler:** Fehlermeldung (falls vorhanden)

#### Pagination
- Navigieren Sie durch Seiten mit "Zurück" und "Weiter"
- Zeigt aktuelle Seite und Gesamtzahl der Seiten
- Standardmäßig 25 Einträge pro Seite

#### CSV-Export
- **Download-Button:** Exportiert das Protokoll als CSV
- Dateiname: `email-delivery-log-YYYY-MM-DD.csv`
- Enthält alle Spalten für externe Analyse

---

### 4. Einstellungen Tab

**Zweck:** SMTP-Server konfigurieren und Verbindung testen

#### SMTP-Konfiguration

**Server-Einstellungen:**
- **SMTP-Server:** Hostname (z.B. smtp.gmail.com)
- **SMTP-Port:** Wahlweise zwischen
  - **25** - Unverschlüsselt
  - **587** - TLS (Empfohlen)
  - **465** - SSL
  - **2525** - Alternative

**Authentifizierung:**
- **Authentifizierung erforderlich (Toggle)**
  - Wenn aktiviert, zeigen Sie Felder für:
    - Benutzername/E-Mail
    - Passwort
  - Toggle zeigt/versteckt Passwort-Eingabe

**Sicherheitsoptionen:**
- **TLS/SSL erforderlich (Toggle)**
  - Verschlüsselte Verbindung zum Server
  - Empfohlen für Sicherheit
  
- **Benachrichtigungen aktiviert (Toggle)**
  - Schaltet Email-Versand ein/aus
  - Nützlich zum Pausieren von Versendungen

#### Verbindungstest

1. **Testdialog öffnen** - Klicken Sie auf "Verbindung testen"
2. **Test-E-Mail eingeben** - Geben Sie eine Test-Email-Adresse ein
3. **Verbindung testen** - System versucht Verbindung mit aktuellen Einstellungen
4. **Ergebnis:** 
   - ✅ Erfolg - Verbindung funktioniert
   - ❌ Fehler - Überprüfen Sie Einstellungen und Meldung

#### Häufige Konfigurationen

**Gmail:**
```
Server: smtp.gmail.com
Port: 587 (TLS Empfohlen)
Auth: Ja
TLS: Ja
Hinweis: App-Passwort erforderlich, wenn 2FA aktiv ist
```

**Microsoft 365:**
```
Server: smtp.office365.com
Port: 587 (TLS)
Auth: Ja
TLS: Ja
```

#### Speichern
- **Speichern-Button:** Speichert Einstellungen
  - Hinweis: Einstellungen werden in System Configuration gespeichert
  - Wenden Sie sich an SystemConfiguration für vollständige Änderungen

---

## Navigation und UI

### Obere Leiste
- **Titel:** "Email-Verwaltung"
- **Untertitel:** "SMTP Email-Integration Monitor und Konfiguration"
- **Aktualisieren-Button:** Manuelles Aktualisieren aller Daten
  - Wird deaktiviert während laden
  - Zeigt Lade-Spinner

### Tab-Navigation
Vier Hauptbereiche als Tabs:
1. **Statistiken** (📊) - Dashboard mit Metriken
2. **Verlauf** (⏱️) - Empfänger-Verlauf
3. **Protokoll** (✉️) - Alle Versendausgänge
4. **Einstellungen** (⚙️) - SMTP-Konfiguration

### Farb-Codierung
- **Grün** - Erfolg / Optimal
- **Rot** - Fehler / Problem
- **Gelb** - Warnung
- **Blau** - Informationen

---

## Typische Workflows

### Workflow 1: Überprüfen ob E-Mails versendet werden

1. Gehen Sie zu **Statistiken Tab**
2. Überprüfen Sie:
   - Wurde die "Versendet" Zahl erhöht?
   - Liegt "Versand-Status" auf "Gesund"?
3. Wenn nicht, überprüfen Sie **Einstellungen Tab**

### Workflow 2: Email-Problem für Nutzer debuggen

1. Gehen Sie zu **Verlauf Tab**
2. Geben Sie E-Mail-Adresse des Nutzers ein
3. Suchen Sie in Ergebnissen nach:
   - War E-Mail überhapt versendet?
   - Status (Fehlgeschlagen = Problem)
   - Fehlermeldung anschauen

### Workflow 3: Häufigkeit der Fehler analysieren

1. Gehen Sie zu **Protokoll Tab**
2. Filtern nach "Fehlgeschlagen"
3. Schauen Sie:
   - Welche Templates scheitern?
   - Welche Fehler wiederkehren?
   - Wann begannen die Fehler?

### Workflow 4: SMTP neukonfigurieren

1. Gehen Sie zu **Einstellungen Tab**
2. Geben Sie neue SMTP-Einstellungen ein:
   - Server-Host
   - Port
   - Authentifizierung (Benutzer/Passwort)
3. Klicken Sie "Verbindung testen"
4. Überprüfen Sie Erfolgsmeldung
5. Klicken Sie "Einstellungen speichern"

### Workflow 5: Versendungen vorübergehend stoppen

1. Gehen Sie zu **Einstellungen Tab**
2. Togglen Sie "Benachrichtigungen aktiviert" AUS
3. Speichern Sie Einstellungen

---

## Troubleshooting

### Problem: Keine Versendungen zu sehen

**Lösung:**
1. Überprüfen Sie "Benachrichtigungen aktiviert" im Einstellungen Tab
2. Überprüfen Sie SMTP Konfiguration
3. Führen Sie "Verbindung testen" durch
4. Überprüfen Sie Fehler im Protokoll Tab (Filter: "Fehlgeschlagen")

### Problem: Hohe Ausfallquote

**Lösung:**
1. Überprüfen Sie SMTP-Einstellungen (Host, Port, Auth)
2. Führen Sie "Verbindung testen" durch
3. Überprüfen Sie Fehler im Protokoll Tab
4. Überprüfen Sie häufige Fehler:
   - ECONNREFUSED = Server nicht erreichbar
   - ENOTFOUND = DNS Problem
   - Authentifizierung fehlgeschlagen = Passwort falsch

### Problem: Sehr langsame Versendung

**Lösung:**
1. Überprüfen Sie "Durchschnittliche Dauer" im Statistiken Tab
2. Überprüfen Sie Netzwerk-Verbindung zu SMTP-Server
3. Überprüfen Sie SMTP-Server-Last
4. Möglicherweise ist Rate Limiting aktiv

### Problem: Spezifischer Nutzer erhält keine Emails

**Lösung:**
1. Gehen Sie zu **Verlauf Tab**
2. Suchen Sie nach der E-Mail-Adresse des Nutzers
3. Überprüfen Sie:
   - War die E-Mail versendet? (Status = "Versendet")
   - Fehlermeldung? (Status = "Fehlgeschlagen")
   - ISP könnte E-Mail blockieren (nicht unser Problem)

---

## Performance-Tipps

### Datenspeicherung
- Protokoll speichert bis zu 1000 Einträge im Memory
- Exportieren Sie regelmäßig als CSV für Archivierung
- Alte Einträge werden verworfen wenn Limit erreicht

### Refresh-Verhalten
- Statistiken aktualisieren sich alle 30 Sekunden automatisch
- Andere Abschnitte müssen manuell aktualisiert werden
- Verwenden Sie "Aktualisieren"-Button für manuelle Aktualisierung

### Browser-Kompatibilität
- Chrome/Brave: ✅ Vollständig unterstützt
- Firefox: ✅ Vollständig unterstützt
- Safari: ✅ Vollständig unterstützt
- Edge: ✅ Vollständig unterstützt
- IE11: ❌ Nicht unterstützt

---

## Sicherheit

### Passwort-Schutz
- Passwort wird nicht angezeigt (verschleiert)
- Use Eye-Icon um Passwort sichtbar zu machen
- Passwort wird nicht in Logs angezeigt

### API-Zugriff
- Alle Anfragen benötigen Admin-Authentifizierung (Bearer Token)
- Token wird aus localStorage geholt
- Alle Anfragen sind gegen CORS-Fehler geschützt

### Daten-Sensibilität
- E-Mail-Adressen werden teilweise verschleiert in Logs
- Stack Traces werden gekürzt in Logs
- Keine sensitiven Daten in Error Messages

---

## Häufig gestellte Fragen (FAQ)

**F: Kann ich E-Mails löschen?**  
A: Nein, Protokoll ist read-only. Sie können nur exportieren.

**F: Wie oft sollte ich Einstellungen überprüfen?**  
A: Überprüfen Sie beim Serverumzug oder Authentifizierungsproblemen.

**F: Können Statistiken gelöscht werden?**  
A: Nein, Statistiken werden kontinuierlich gesammelt. Sie können alte Einträge via CSV archivieren.

**F: Was bedeutet "In Warteschlange"?**  
A: E-Mail wurde akzeptiert, wartet auf Versendung oder wird erneut versucht.

**F: Wie lange dauert es bis Versand sichtbar ist?**  
A: Sofort, da es Echtzeit-Tracking ist.

---

## Support & Kontakt

Bei Fragen oder Problemen:
1. Überprüfen Sie Troubleshooting-Sektion oben
2. Überprüfen Sie SMTP Email Integration Dokumentation
3. Kontaktieren Sie Administration
4. Überprüfen Sie Server-Logs unter `/server/logs/`

---

**Letzte Aktualisierung:** April 2026  
**Version:** 1.0  
**Sprache:** German
