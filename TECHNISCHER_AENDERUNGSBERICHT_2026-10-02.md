# Technischer Änderungsbericht – Kommunikation, Verlauf, Versand, Finanzen, Bedienung

**Stand:** 02.10.2026, nach Abschlussrunde und Runde 3 (§16) · Branch `adars`, Basis `dec6fff` (inhaltlich identisch mit `2d097a5`) ·
**nicht committet, nicht gepusht, nicht ausgeliefert, nicht veröffentlicht**
**Auftrag:** `Claude-FixitHub-Iletisim-UX-01-10-2026.md` (Abnahme K01–K18 und UX-Tabelle), Befunde der Mitarbeitenden vom 29./30.09. (15 Fotos),
Restarbeiten vom 02.10. (fehlende Browser-Schritte, atomare Zahlungsaufforderung, Gast-Link-Sicherheit, FIN-13, Admin-Passwort-Branch,
Nachweise, Diff-Prüfung, Dokumente).
**Begleitdokumente:** `BEFUNDLISTE_2026-10-02.md` (145 Befunde + Zusatzbefunde), `ABNAHMETEST_2026-10-02.md` (Abnahmeliste und
Kurztest für das Team), Bilder `screenshots/abnahme-2026-10-02/`, dauerhafte Nachweise `nachweise/abnahme-2026-10-02/` (§14).

---

## 1. Kurzfassung

- **Alle K01–K18 sind jetzt im Browser bzw. per Route belegt.** Neu im Browser bedient: Fehlerhinweis einer ausgefallenen Postfach-Quelle
  (echter Datenbankfehler), Workflow-Schalter „Kunde informieren“ an/aus mit Test-Postfach, Gerätewechsel und Leistungsänderung mit Verlauf,
  Techniker-Workflow inkl. Pause und Storno-Sperre, Admin-Labeldownload, Dialoge „Zahlungsaufforderung“ und „Rechnung aus Aufträgen“,
  Ersatzteilbestellung mit Sendungsnummer und Wareneingang. **K11** ist gegen einen lokalen Mock verifiziert (Absender/Empfänger/Richtung seit
  Runde 3 auf den Karten), die echte DHL-Prüfung bleibt offen. **K13** ist für Standardsteuer und gespeicherte 0 % belegt; steuerbefreite
  Kunden sind eine offene Geschäftsentscheidung (§16.4).
- **Zahlungsaufforderung (K15) ist jetzt atomar und idempotent.** Vorher erzeugten 8 parallele Anfragen in 9–11 von 20 Runden 2–3 Mails, ein
  Doppelklick auf „trotzdem senden“ 5 Mails, ein paralleler Wiederversand 8 Mails. Jetzt: genau eine Mail, auch Buchung ‖ Rechnung derselben
  Buchung, Doppelklick, Wiederversand; der Browser-Ablauf fand zusätzlich eine Lücke (Aufforderung über die Rechnung übersah die frühere
  Buchungs-Aufforderung) – behoben. „Rechnung aus Aufträgen“ war bereits durch `activeBillingKeys` geschützt (parallel und Wiederholung belegt).
- **Gast-Links sicher gemacht, ohne bestehende Links zu brechen:** MongoDB-Operator-Injektion über `token[$ne]`, Zugriff mit leerem Token auf
  Buchungen registrierter Kunden, fälschbarer Rate-Limit-Schlüssel (`X-Forwarded-For`) und fehlende Rate-Limits auf allen Gast-Endpunkten
  waren echte Lücken und sind geschlossen (Bedrohungsmodell §6.1). Linkformat und alle ausgegebenen Tokens bleiben gültig.
- **Runde 3 (§16):** Admin-Passwort-Korrektur übernommen (kein Reset beim Start, in Produktion nur mit `SEED_ADMIN_PASSWORD`);
  kritische Selbst-Beförderung zum Admin über `PUT /api/users/me` behoben; 152 Laufzeitdateien mit Personendaten aus dem Git-Index
  genommen (auf der Platte erhalten, Historie unverändert); Secrets in `.env.example` durch Platzhalter ersetzt – **die echte `.env` nutzt
  die veröffentlichten JWT-/Refresh-/Session-Secrets, Rotation nötig**; FIN-13-Fehler (0 % → 19 %) behoben; Versandkarten mit Absender/
  Empfänger; wirkungslose Workflow-Vorlagenoptionen gesperrt. Login-Seite zeigt Beispiel-Zugangsdaten nur in der Entwicklung.
- **Nachweise:** 57 Testdateien mit 3 154 Prüfungen + 5 Hilfstests mit 158 Prüfungen, alle grün (Endlauf mit korrigiertem Netzwerkschutz);
  25 Browser-Abläufe/Prüfskripte mit 582 Prüfungen (siehe §4) gegen den isolierten Testserver; TypeScript **0 neue Fehler, 93 behoben, 841 Altfehler bleiben** (gleicher Befehl/gleiche
  Konfiguration wie am Ausgangsstand); Produktions-Build in ein Scratch-Verzeichnis erfolgreich.
- **Nicht geprüft** (bewusst ausgeschlossen bzw. keine Zugänge): echte DHL-Labels (Einsendung, Auslieferung, Reklamation), echter SMTP-Versand,
  PayPal, das Testsystem 66.29.145.165, Abnahme durch Mitarbeitende.

## 2. Arbeitsweise, Umgebung, Schutzmaßnahmen

| Punkt | Umsetzung |
|---|---|
| Datenbank | Nur Wegwerf-Datenbanken auf eigenem `mongod` (127.0.0.1:27099, mit `enableTestCommands` für den `failCommand`-Fehlerpunkt): `e2e_after` (Browser), `t_*` je Testdatei. Port 27017 und die `.env`-Datenbank gesperrt (`isUnsafeTestUri` in jedem Test, Netzwerkschutz). |
| Netzwerk | Jeder Server- und Testprozess mit Netzwerkschutz. **Korrektur (Schlussrunde):** die bis dahin genutzte Fassung blockierte TLS und direkte Socket-Aufrufe, aber keine einfachen TCP-Verbindungen über `net.connect`/`net.createConnection` (z. B. HTTP, MongoDB-Treiber); frühere Aussagen „0 blockierte Verbindungen“ belegen daher nur den TLS-Teil. Die korrigierte Fassung blockiert beides (Probe: Port 27017 und externe Ziele blockiert); der Endlauf der Testsuite lief damit (§8). Unabhängig davon: E-Mail lief nur über den Stream-Transport, DHL nur Dummy/lokaler Mock, PayPal nie, und jede Testdatei verweigert Port 27017 bzw. die `.env`-Datenbank (`isUnsafeTestUri`). Hinweis: der Test-Server 5099 lauschte (Altverhalten `app.listen(port)`) auf allen Schnittstellen; er enthielt nur Testdaten. |
| E-Mail | `EMAIL_TEST_TRANSPORT=stream` + lokales Test-Postfach (`.eml`); nur Testadressen (`*.invalid`, `example.*`). Keine Mail hat den Rechner verlassen. |
| DHL / PayPal | Einsendelabels im Modus „Dummy“; Auslieferungslabels nur gegen einen lokalen Mock (kein Dummy-Modus im Programm); PayPal nie aufgerufen. **Anbieter-Mock ≠ echte Integration.** |
| Vorher/nachher | Ausgangsstand `dec6fff` lief als eigener Arbeitsbaum mit **gleichem Szenario-Skript** (vorher-Bilder `*_vorher.jpg`); der Arbeitsbaum ist nach Sicherung der Nachweise entfernt. Die tsc-Ausgabe des Ausgangsstands ist gesichert (§8). |
| Parallelarbeit | Umsetzung in Wellen mit festen Dateizuständigkeiten; jede Änderung von einer unabhängigen Gegenprüfung angegriffen (Repro-Skripte, Mutationsproben), Befunde nachgebessert und erneut geprüft. |

## 3. Abnahme K01–K18

Status: **Verifiziert** = Route + DB + Rolle getestet **und** im Browser nachvollzogen (sofern Oberfläche betroffen) ·
**Teilweise verifiziert** = Kern belegt, benannter Teil nicht prüfbar · **Blockiert** · **Fehlgeschlagen**.

| ID | Status | Nachweis | Offen / Hinweis |
|---|---|---|---|
| K01 | Verifiziert | `test-comms-central.js` 125/0; Browser `flow_k01_messages`: Kunde schreibt → Admin findet per Suche (Ungelesen) → Antwort „An Kunden“ + interne Notiz → Kunde sieht Antwort, nicht die Notiz; fremder Kunde 403. `flow_lost1_quick_action`: Kunde erledigt eine angeforderte Aktion (Funktion war beim Umbau entfallen, Z-LOST-1). | – |
| K02 | Verifiziert | `flow_k02_sources`: Reklamation, Reparaturanfrage (Mitglied), Gast-Anfrage über den Quellenfilter gefunden, beantwortet, beim Kunden/Gast sichtbar; Gast-Token öffnet keine fremde Anfrage. `test-repair-request-flow.js` 107/0. | – |
| K03 | Verifiziert | Browser `flow_k03_source_error`: echter Datenbankfehler einer Quelle (MongoDB-`failCommand` nur auf `contactmessages`) → gelber Hinweis „Nicht alle Nachrichten konnten geladen werden … Kontaktanfragen konnten nicht geladen werden“ mit „Erneut versuchen“; übrige Quellen und Zähler bleiben; nach Behebung verschwindet der Hinweis; Quellfilter auf die ausgefallene Quelle zeigt keinen Leerzustand mehr (Fund + Korrektur). `flow_extra`: > 50 Gespräche, Suche findet das älteste. | Staff-Sicht mit ausgefallener Auftragsquelle nicht im Browser (gleicher Code). |
| K04 | Verifiziert | `test-sec-customer-isolation.js` 153/0, `test-sec-guest-token.js` 69/0 (Gast-Token: fremd/fehlend/fehlgeformt/Operator/leer, Rate-Limits, gefälschter XFF, Freigabefelder), `test-sec-device-model-update.js`, `test-sec-seed-routes.js`; Negativschritte in mehreren Abläufen; Login-Seite ohne Beispiel-Zugangsdaten im Produktions-Build. | Runde 3: SEC-D behoben (§16.1); Selbst-Beförderung über `PUT /api/users/me` behoben (`test-sec-profile-self-update.js` 18/0). **Offen: Secrets rotieren** (§16.3). |
| K05 | Verifiziert | `test-notify-notifications-http.js` 107/0; Browser `flow_extra`: base64-Altbenachrichtigung ohne Zeichenkette, Reklamationslabel als PDF über autorisierte Route, fremder Kunde 403, anonym 401. | Echte Label-Erzeugung bei Genehmigung nicht prüfbar (DHL). |
| K06 | Verifiziert | Browser `flow_k06_workflow_notify`: Schalter „Kunde informieren“ **an** → genau eine Benachrichtigung (beim Kunden im Browser) + genau eine Mail im Test-Postfach; **aus** → nichts beim Kunden, Team sieht den Verlaufseintrag; Zustand nach Reload. Vorlagen-Schalter „Notify on …“ hatten keine Wirkung → deutsch und als „derzeit ohne Wirkung“ gekennzeichnet. Keine Übersetzungsschlüssel (12 fehlende ergänzt). | Runde 3: Vorlagen-Schalter gesperrt und erklärt; Wiederholung „Kunde über Abschluss informieren“ im Browser (Doppelklick → 1 Benachrichtigung + 1 Mail, `check_r3_k06_retry`). SMTP nur Test-Transport; Versandfehler nur per Route-Test. |
| K07 | Verifiziert | `flow_k07_guest_quote` (Gast: Entwurf ohne Mail → Senden = genau eine Mail → Link aus der Mail → Annahme) und `flow_k07b_catalog_convert`; nach der Gast-Härtung erneut grün. | – |
| K08 | Verifiziert | Browser `flow_k08_device_service_change`: Gerät über „Bearbeiten“ gewechselt, Leistung hinzugefügt/geändert/entfernt, neuer Auftragswert gespeichert; Verlauf mit Person, Zeit, alt → neu, Grund, Filter; Reload; Kunde sieht neues Gerät/Leistung und nur freigegebene Verlaufseinträge; Auftrag = Buchung. Route-Tests `test-history-contract.js` 87/0, `test-order-value-service-edit.js` 87/0, `test-device-change-service-match.js` 40/0. | Gerätewechsel aus dem Inspektionsdialog und bei Mehrgeräte-Buchung mit Zahlung nur per Route. |
| K09 | Verifiziert | Browser `flow_k09_technician_workflow` (Techniker = Mitarbeiterrolle): Workflow öffnen, Eingangsprüfung Schritt 1–2 „Speichern & Weiter“, Pause mit Grund, Fortsetzen, Abschluss → „Reparatur abgeschlossen“ (nicht automatisch „abgeschlossen/versendet“), Verlauf, Kunde sieht Status; storniert → Server lehnt ab, deutliche Meldung über dem Dialog. Nachgebessert: auch die **Inspektion** (inkl. Prüfbericht einer nicht abgeschlossenen Inspektion) ist bei Storno serverseitig gesperrt, Daten nur lesend (`check_orch_cancelled` 9/9). `flow_k08_k09` (Storno nur mit Grund, Reopen nur Admin). | Inspektionsschritte 3–7 nicht im Browser (Route-Tests `test-inspection-*`). |
| K10 | Verifiziert (Testmodus) | `flow_k10_k11`: echter Checkout, Labelfehler → „Erneut versuchen“, Testlabel, Download, Reload, Doppelklick/parallel ohne zweites Label, fremder Kunde 403; `test-dhl-postcheckout-inbound-label.js` 102/0 (jetzt auch Eintrag im Auftragsverlauf). | Echte DHL-Erzeugung **blockiert** (keine Zugangsdaten, keine kostenpflichtigen Labels). |
| K11 | Verifiziert (lokaler Mock) – echte DHL offen | Browser `flow_k11_admin_label_download`: Admin lädt das Einsendelabel als PDF, Einsendung/Auslieferung getrennt, Auslieferungslabel gegen **lokalen Mock**; Runde 3: beide Karten zeigen Absender → Empfänger, Richtung und Quelle, identisch mit der Mock-Nutzlast; 390 px ohne Querscroll; Kunde ohne Teamfelder. `test-shipping-outbound-direction.js` 69/0, `test-shipping-label-recovery.js` 44/0, `test-shipping-claim-fencing.js` 56/0. | Echte DHL-Erzeugung **blockiert/offen** (keine kostenpflichtigen Labels); kein Dummy-Modus für Auslieferungslabels (bewusst keine neue Produktionsfunktion). |
| K12 | Verifiziert | Neun UX-Zeilen im Browser (§5); Tastatur; kein seitenweiter Querscroll bei 390/768/1366/1920 px und 200 %; Dialoge bei 778×718; Meldungen über Dialogen ohne den Dialog-Fuß zu verdecken. | 768 px: Admin-Tabellen scrollen in ihrer Karte. Abnahme durch Mitarbeitende steht aus (Kurztest in `ABNAHMETEST`). |
| K13 | Teilweise verifiziert | 5 %: 49,90 − 2,50 = 47,40 €, 39,83 + 7,57; 15 %: 7,48 / 42,42; Mehrgeräte `test-sec-booking-discount-allocation.js` 193/0; MwSt. in Mail/Rechnung/PDF; Englisch → €; Runde 3: gespeicherte 0 % bleibt 0 % in Auftrag, Buchung und Anzeige, fehlender Satz = „Standardsatz“ (`test-fin-tax-zero-vs-missing.js` 26/0, Browser `check_r3_fin13_display`). | **Steuerbefreite Kunden nicht abgenommen** – Preis/Zeitpunkt der Steuerregel sind eine Geschäftsentscheidung (§16.4); Mehrgeräte-Verteilung technischer Standard (§10). |
| K14 | Verifiziert | `flow_k14`: Zahlung mit Buchungslink, Verwendungszweck, „Vorauszahlung – Rechnung folgt“; Kunde: Bezahlt + Offen = Buchungssumme; `test-payment-flows.js` 72/0. Zahlungswort passt zu den Zahlen (Z-UI-7). | – |
| K15 | Verifiziert | Browser `flow_k15_payment_dialogs`: Bestätigung mit Empfänger, Betrag, Bezug, früheren Aufforderungen → genau eine Mail; zweiter Versuch → „Zuletzt am …“, „Trotzdem erneut senden“ nur ausdrücklich; Doppelklick → eine Mail; über die Rechnung ebenfalls Rückfrage; „Rechnung aus Aufträgen“: Vorschau, Bestätigung für nicht abgeschlossene Aufträge, Doppelklick → eine Rechnung, bereits berechneter Auftrag blockiert. `test-fin-payment-request-concurrency.js` 123/0. | „Erneut senden“ in der Verlaufsliste nur per Route; kurzer roter Hinweis beim Doppelklick vor der Erfolgsmeldung (kosmetisch). |
| K16 | Verifiziert | `test-fin-controlling-http.js` 51/0; `flow_k16_settings`; `test-settings-section-isolation.js` 12/0. | – |
| K17 | Verifiziert | Browser `flow_k17_epart_order_tracking`: Bestellung über die Oberfläche, Sendungsnummer, Reload, DB-Abgleich, Wareneingang teilweise und Rest, Überbuchung blockiert (Meldung im Dialog), Nummer EPO-NNNNNN eindeutig, auch bei 778×718; `flow_k12_k17`: Lieferant bei 778×718 und 200 %. `test-parts-suppliers-settings-http.js` 121/0. | Lieferantenrechnung-Download nur Code/tsc. |
| K18 | Verifiziert | Alle 23 Tests der Vorarbeit grün (in den 50 enthalten). | Nicht erneut im Browser geklickt. |

## 4. Browser-Abläufe (isolierter Testserver, Endlauf nach frischem Neustart)

| Ablauf (`nachweise/…/werkzeuge/e2e/…`) | Ergebnis | Inhalt |
|---|---|---|
| `flow_k01_messages` | 15/15 | Kunde ↔ Admin über Auftrag und zentrales Postfach, interne Notiz, Fremdzugriff |
| `flow_k02_sources` | 18/18 | Reklamation, Reparaturanfrage, Gast-Anfrage im Postfach |
| `flow_k03_source_error` | 26/26 | echter Quellenausfall (MongoDB-`failCommand`), Hinweis, Zähler, „Erneut versuchen“, Quellfilter |
| `flow_k06_workflow_notify` | 37/37 | „Kunde informieren“ an/aus, Benachrichtigung beim Kunden, Test-Postfach, Reload |
| `flow_k07_guest_quote` | 15/15 | Gast-Kostenvoranschlag mit Test-Postfach und Link aus der Mail (nach Gast-Härtung) |
| `flow_k07b_catalog_convert` | 14/14 | Katalogauswahl, 0-€-Angebot, Annahme, Umwandlung |
| `flow_k08_k09` | 11/11 | Status, Workflow zuweisen, Pause, Storno-Dialog, Server-Sperre, Verlauf-Filter |
| `flow_k08_device_service_change` | 36/36 | Gerätewechsel, Leistung hinzufügen/ändern/entfernen, Verlauf, Kundensicht, Summen |
| `flow_k09_technician_workflow` | 34/34 | Techniker: Inspektion, Pause/Fortsetzen, Abschluss, Storno-Sperre (UI + Server) |
| `flow_k10_k11` | 11/11 | Checkout, DHL-Aktion, Fehlerfall/Wiederholung, Download, Reload, Doppelanfragen |
| `flow_k11_admin_label_download` | 47/47 | Admin-Download Einsendelabel, Auslieferungslabel gegen lokalen Mock, Absender/Empfänger/Richtung = Mock-Nutzlast, kein zweites Label, Fremdzugriff |
| `flow_k12_k17` | 22/22 | „Details ansehen“, Zusammenfassung, 390 px, Lieferant 778×718 und 200 % |
| `flow_k14` | 7/7 | Zahlungsliste mit Bezug, Kundensicht der Beträge |
| `flow_k15_payment_dialogs` | 54/54 | Zahlungsaufforderung (Bestätigung, 24-h-Rückfrage, Doppelklick, über Rechnung), „Rechnung aus Aufträgen“ |
| `flow_k16_settings` | 5/5 | Einstellungen speichern/Reload/kein Überschreiben |
| `flow_k17_epart_order_tracking` | 54/54 | Ersatzteilbestellung, Sendungsnummer, Reload, Wareneingang, Überbuchung, 778×718 |
| `flow_extra` | 14/14 | > 50 Gespräche, Reklamationslabel, Tastatur, Englisch/€ |
| `flow_lost1_quick_action` | 27/27 | Kunde erledigt eine angeforderte Aktion, Reload, Teamsicht |
| `check_orch_cancelled` | 9/9 | Storno: Inspektion gesperrt, Daten nur lesend, Zahlungswort |
| `flow_r3_status_from_detail` | 22/22 | Ersatz für den entfernten Listen-Statusumschalter: Liste → Auftrag → Status (3 Klicks), Storno mit Grund, Verlauf |
| `check_r3_workflow_template_ui` | 18/18 | Vorlagen-Optionen gesperrt und erklärt, gedämpfte „ohne Wirkung“-Hinweise |
| `check_r3_k06_retry` | 15/15 | „Kunde informieren“ aus → nichts; „Kunde über Abschluss informieren“ (Doppelklick) → genau 1 Benachrichtigung + 1 Mail |
| `check_r3_fin13_display` | 25/25 | gespeicherte 0 % überall 0 %, fehlender Satz „Standardsatz“, 19 % unverändert |
| `check_r3_profile_neworder` | 37/37 | Profil speichern (Freigabeliste), Rolle nicht änderbar, Checkout-Adressen, /new-order ohne Demo-Daten |
| `check_r3_email_admin` | 9/9 | E-Mail-Verwaltung lädt nach dem Entfernen der Protokolle aus Git unverändert |

**25 Abläufe/Prüfskripte, 582 Prüfungen, alle grün** (Endlauf nach Runde 3, frischer Neustart des Testservers mit dem Endstand des
Codes, neu aufgebaute Test-DB); Server-Netzwerkschutz: **0 blockierte Verbindungen**. Zusätzlich `check_r3_k11_390` 10/10 (Versandkarten bei
390 px). Drei Abläufe wurden im Verlauf **in ihrer Prüfung bzw. Vorbereitung** angepasst und wiederholt, ohne Änderung an der Anwendung:
`k09` (prüft jetzt die vorab gesperrten Schritte am stornierten Auftrag + Serverablehnung per API), `k12_k17` (gleiche Seitengröße wie die
Liste), `lost1` (wählt seine Testdatensätze zur Laufzeit statt fester IDs aus der alten Test-DB). Das Erstprotokoll von `lost1` liegt
bei den Nachweisen; für `k09`/`k12_k17` ist nur die Begründung in der Zusammenfassung erhalten (Erstprotokolle beim Zusammenführen verloren).
`flow_k15_payment_dialogs` fand vor der Korrektur die Lücke Z-FIN-2. Die Browser-Prüfungen von Runde 3 fanden zudem drei Client-Fehler aus
HEAD (Checkout-Lieferadresse, Profil „wie Rechnung“, englisches Badge) – behoben (§16.7).

## 5. Bedienung vorher / nachher (UX-Tabelle des Auftrags)

Klickpfade aus dem Code und den Abläufen; Bilder in `screenshots/abnahme-2026-10-02/` (`*_vorher.jpg` / `*_nachher.jpg`, Ablaufbilder 20–56).

| Aufgabe | Vorher | Nachher | Bild |
|---|---|---|---|
| Gerät nach der Bestellung einsenden | „Bestellung erfolgreich“ nur mit „Zur Homepage / Weiter einkaufen“; Label nur über Buchungen → aufklappen → Rücksendung | Erster Kasten **„Nächster Schritt: Gerät an McRepair senden“** mit **„DHL-Einsendelabel herunterladen“** bzw. **„…erstellen“**, Zustände mit **„Erneut versuchen“**, Link zum Auftrag; nach Reload gleich | 05, 25 |
| Eigene Reparatur öffnen | Buchungen → Zeile aufklappen → Untertabelle ohne Link (Rohschlüssel „STATUS.DIAGNOSTIC-ASSESSMENT“) | Jede Gerätezeile mit **„Details ansehen“** → **1 Klick**; Rückkehr behält Suche/Filter | 03 |
| Verstehen, was zu tun ist | Drei gleich schmale Spalten, „Nächste Schritte“ generisch | **„Auf einen Blick“**: Status, aktueller Schritt, Beträge, **ein** hervorgehobener nächster Schritt | 04, 28 |
| Zahlungsstand verstehen | „Zahlung: Ausstehend“ ohne Beträge | **Gesamt (brutto) / Bezahlt / Offen**; bei Mehrgeräte-Buchung „Dieses Gerät“ / „(ganze Buchung)“; Zahlungswort folgt den Zahlen (kein „Offen“ bei 0,00 €) | 04, 28, 29 |
| Nachricht finden und beantworten | `/messages`: „Kein Feedback vorhanden“, obwohl Gespräche existierten | Ein Postfach für alle Quellen, Filter, Suche, Gespräch rechts mit Antwortfeld; fällt eine Quelle aus, steht ein Hinweis mit „Erneut versuchen“ statt „keine Nachrichten“; Quellen-Chips bleiben beim Filtern | 01, 06, 20, 22, 36 |
| Angeforderte Aktion bestätigen (Kunde) | – (vor dem Umbau auf /messages) | Im Gespräch Schaltfläche zum Erledigen, danach „Erledigt“ | 37 |
| Auftrag beurteilen (Personal) | Kundenschale, schmale Spalten; Listen mit 306/677 px Querscroll | Admin-Schale, Kurzübersicht, Reiter **Übersicht · Kommunikation · Verlauf · Rechnungen & Zahlungen · Versand**; Listen ohne Querscroll bei 1366/1920 | 07, 08, 10 |
| Änderungen nachvollziehen | Meilensteine „Abgeschlossen“ ohne Ereignis | Reiter **„Verlauf“** mit Filtern; „Zeitpunkt nicht erfasst“ statt Scheinerledigung; Gerätewechsel/Leistung/Ersatzteile/Einsendelabel mit deutschen Texten | 27, 35, 38 |
| Interne Notiz oder Kundennachricht | Ein Feld „Nachricht senden“, Zielgruppe unklar | **„Nachricht an Kunden“** / **„Interne Notiz“** getrennt; kundensichtbare Inspektionsfelder mit Hinweis **„Für Kunden sichtbar“** | 20, 21 |
| Workflow mit Kundeninfo | Vorlagen-Schalter „Notify on …“ ohne Wirkung, englisch | Schalter „Kunde informieren“ im Arbeitsschritt wirkt; Vorlagen-Schalter als „derzeit ohne Wirkung“ gekennzeichnet | 39 |
| Storno erkennen | Inspektion/Workflow ließen sich am stornierten Auftrag fortsetzen | Hinweis „Auftrag storniert – … gesperrt“, Daten nur lesend, Server lehnt ab | 40 |
| Meldungen in Dialogen | Meldung unter dem abgedunkelten Dialog, unlesbar | Meldung oben rechts über dem Dialog | 41 |
| Zahlungsaufforderung | versteckt, ohne Bestätigung, Doppelversand möglich | Bestätigung mit Empfänger/Betrag/Bezug/Verlauf, Rückfrage innerhalb 24 h, eine Mail auch bei Doppelklick | 42, 43 |
| Ersatzteil bestellen | Manuelle Bestellung scheiterte (`name`/`itemName`) | Bestellung, Sendungsnummer, Wareneingang mit klarer Grenze, auch bei 778×718 | 44, 45 |
| Lieferant / Einstellung speichern | Speichern-Knopf bei 778×718 unerreichbar; Einstellungen gingen verloren | Scrollbarer Dialogkörper, abschnittsweises Speichern | 11, 33, 34 |

Entfernte Zwischenschritte: Buchungsdialog vor dem Gerät, verschachteltes Chat-Modal, Menüsuche nach dem Label, manuelles Aufklappen für offene
Beträge, Pause/Fortsetzen nur um einen Workflow wieder zu öffnen. **Bewusst entfallen:** Status-Umschalter in der Liste `/admin/orders`
(Status jetzt nur im Auftrag mit Grund und Verlauf – die Liste erlaubte Storno ohne Grund) und die Gerätebilder im Buchungsdetail des Kunden
(dafür liefen bis zu 5 Katalogsuchen je Gerät; am Auftrag ist kein Bild gespeichert).

## 6. Ursachen und zusammengeführte Doppelungen

| Bereich | Ursache | Ein Weg statt mehrerer |
|---|---|---|
| Nachrichten | Postfach las 2 von 6 Speichern; Ladefehler = „keine Nachrichten“; Listen begrenzt; Lesestatus dreifach; Thread-APIs ohne Besitzprüfung | `communicationInboxService` als Lese-Adapter über die bestehenden Speicher, Fehler je Quelle (`sourceErrors`, auch bei Quellfilter); `communicationReadRules.js`; Besitzprüfung; kein neues Nachrichtensystem |
| Benachrichtigungen / E-Mail | Label-PDF als Text; fehlende Schlüssel; Workflow-Trigger nicht verknüpft; Doppelte; Wiederholung auch nach DATA | strukturierte Aktion „Versandlabel herunterladen“; `dedupeKey`; Trigger „Eingangsprüfung“; Wiederholung nur vor der Übergabe |
| Verlauf/Status | Verlauf außerhalb des Speichervorgangs, englische Titel, Stufen aus Endstatus, Storno ohne Grund, Buchungslabel nicht am Auftrag | `server/utils/orderHistory.js` (ein Vertrag, Kunden-Freigabeliste), Meilensteine aus Ereignissen, Storno-Dialog + Server-Sperren für Workflow **und** Inspektion |
| DHL | Erfolgsseite ohne Aktion; Downloads scheiterten (axios-Transform) | `POST /api/bookings/:id/inbound-label` (ein Label je Buchung, gemeinsamer Lock); gemeinsame Blob-Konfiguration mit Identitäts-Transform: `api/labelPdf.ts` (Label-PDFs, Reklamationslabel) und `invoicePdfRequestConfig()` (Rechnungs-PDF, Lieferantenrechnung, Kunden- und Finanz-CSV) |
| Zahlungsaufforderung | Prüfen-dann-Senden ohne Sperre; Rechnungs-Prüfung nur per `invoiceId` | atomarer Anspruch je Buchung (`paymentrequestclaims`, Muster `checkoutattemptclaims`), 24-h-Prüfung unter dem Anspruch, Freigabe in `finally` |
| Gast-Zugänge | Query-Werte als Abfrageoperatoren; Trim nach der Prüfung; keine Rate-Limits; IP aus dem Client-Header | `middleware/guestAccess.js` (Token-/E-Mail-Normalisierung, zeitkonstanter E-Mail-Vergleich, gemeinsame Limiter); `rateLimit.js` mit `req.ip`/`trust proxy` |
| Kunden-/Admin-UX | Funktionen versteckt oder gleichgewichtet; Dialoge ohne Scrollkörper; Meldungen unter Dialogen | Umbau der bestehenden Seiten (keine zweite Detailseite); `dialog.tsx` mit Scrollkörper; Toast-Ebene über Dialogen, oben rechts |
| Reparaturanfrage | Freitext als Standard; Angebot nie veröffentlicht; Gast-Token nicht gebunden | Katalog als Standard; Angebot mit Version/`publishedAt`; Annahme an gesehene Version gebunden |
| Finanzen / Geld | Brutto als Netto; Client-Beträge im Checkout; mehrere Geldformatierer und Zahlenparser | Netto = Brutto/(1+Satz); ein Katalog-Resolver; `formatMoney/formatEUR` bzw. `server/utils/money.js` und `parseDecimalInput` überall (letzte Kopien in dieser Runde umgestellt) |
| Ersatzteile/Einstellungen | `name` vs `itemName`; Nummern per `countDocuments+1`; Einstellungen per Gesamtüberschreiben | DocumentSequence (EPO, Reklamationen); abschnittsweises Speichern |

Bewusst parallel gelassen: alte Datenspeicher (Conversation/Message, `RepairRequest.messages`) werden gelesen, nicht migriert; das öffentliche
`/locales`-Verzeichnis bleibt (ungenutzt); toter Code neben den Label-Routen (DHL-15) wurde nicht gelöscht (Nutzung nicht widerlegt);
Gast-Antwort für Auftrag/Buchung bleibt eine (erweiterte) Sperrliste.

### 6.1 Gast-Link/Token-Politik (Bedrohungsmodell und Umsetzung)

| Thema | Ist (geprüft) | Entscheidung / Umsetzung |
|---|---|---|
| Erzeugung | Auftrag, Buchung, Reparaturanfrage: `crypto.randomBytes(32)` (256 Bit), an die E-Mail des Datensatzes gebunden | unverändert (Erraten ausgeschlossen) |
| Speicherung | Klartext in der DB, Abfrage per Gleichheit; Personal-Ansichten blenden ihn aus | unverändert (Hashen bräuchte Migration; wer die DB lesen kann, sieht die geschützten Daten ohnehin) |
| Gültigkeit / Widerruf | kein Ablauf | **kein Ablauf** – der Link ist der einzige Zugang eines Gastes (auch Wochen später: Abholung, Reklamation); Ablauf würde gültige Links still brechen. Widerruf im Einzelfall: `server/scripts/guestTokenPolicy.js --rotate <ORD-/BKG-/RR-Nummer>` (Vorschau) bzw. `… --confirm` (neuer Link, alter ungültig). Bericht-Modus zeigt „würde ungültig: 0“. |
| Reichweite | ein Datensatz je Token; Buchungs-Token deckt nur verknüpfte Aufträge; keine Rechnungen/internen Notizen | Gast-Antworten ohne Token-/Sperr-/Idempotenzfelder; RR-Gastansicht ist Freigabeliste |
| Transport | Token und E-Mail in der URL (Format muss bleiben) | Browser-Referrer-Policy hält ihn aus fremden Referer-Kopfzeilen; **Betreiber:** nginx soll für Tracking-Pfade die Query nicht protokollieren |
| Missbrauch | Operator-Injektion, leerer Token, Durchprobieren von Buchungsnummern, Mail-Bombing über Gast-Anfragen/-Checkout/Registrierung, Nachrichten-Spam, 8-MB-Uploads, Promo-Raten | Rate-Limits (Fehlversuche je IP 30/15 min; Buchungsnummer + E-Mail 10/15 min je E-Mail; Lesen 600/10 min; Schreiben 30/10 min; Anlegen 20/h und 60/Tag je IP, 5/h je Ziel-E-Mail, 200/h global – gezählt werden nur erfolgreiche Anlagen; PayPal-Gast 30/10 min; Mail erneut senden 5/15 min; Promo 30/10 min). Ein zahlender Gast wird nach der PayPal-Erfassung nie gesperrt. Normales Aktualisieren der Gastseite zählt nicht. |
| Client-IP | erster `X-Forwarded-For`-Eintrag (fälschbar), `trust proxy 1` | `req.ip` mit `trust proxy 'loopback'` (nginx auf demselben Host wie in `scripts/setup-production*.sh`); andere Proxy-Topologie → `TRUST_PROXY` setzen (sonst teilen sich alle Kunden die Proxy-IP) |

## 7. Geänderte Dateien (Übersicht, Endstand nach Runde 3)

Gezählt aus `git status --porcelain -uall` gegen `dec6fff`. Laufzeitprotokolle in `server/logs` sind auf den Ausgangsinhalt zurückgesetzt
(nicht mitgezählt). CSS-Dateien zählen beim Anwendungscode.

| Kategorie | geändert | neu |
|---|---:|---:|
| Anwendungscode Server (`server/**`, ohne Doku) | 82 gesamt | |
| Anwendungscode Client (`client/src/**`) | 116 gesamt | |
| → Anwendungscode zusammen | 169 | 29 |
| Tests (`test-*.js` in der Repo-Wurzel) | 7 | 36 |
| Dokumente und Konfiguration (dieser Bericht, Befundliste, Abnahmeliste, README, Doku-Hinweise, `.env.example`, `.gitignore`) | 8 | 3 |
| Bilder `screenshots/abnahme-2026-10-02/` | 0 | 67 |
| Nachweise `nachweise/abnahme-2026-10-02/` | 0 | 149 |
| **Summe Arbeitsbaum** | **184** | **284** |

Zusätzlich **152 Dateien nur aus dem Git-Index entfernt** (`git rm --cached`, Dateien auf der Platte unverändert): 128 `server/logs/**`,
22 `server/uploads/reports/*.pdf`, `server_output.log`, `test-results.log` (§16.2). `client/dist`, `package*.json` und Lockdateien sind
unverändert. Vollständige Liste: `git status` im Branch `adars`.

## 8. Tests, Typprüfung, Build

- **Repo-Tests** (alle mit `isUnsafeTestUri` und Netzwerkschutz, Wegwerf-DB je Datei; Befehl in `nachweise/…/werkzeuge/run_all_tests.sh`):
  **57/57 Dateien Exit 0, 3 154 Prüfungen, 0 Fehlschläge** (Endlauf der Schlussrunde **mit dem korrigierten Netzwerkschutz**, 0 blockierte
  Verbindungen; neu u. a. `test-seed-admin-password.js`, `test-sec-profile-self-update.js`, `test-fin-tax-zero-vs-missing.js`,
  `test-workflow-template-notify.js`, `test-workflow-skip-canskip.js`, `test-seed-sample-data-production.js`,
  `test-i18n-staff-checklist-keys.js`); Hilfstests ohne DB
  (`test-dhl-label-download-helper.js` 12, `test-fin-money-format.js` 44, `test-parts-ui-helpers.js` 27, `test-money-server-copies.js` 20,
  `test-logs-bootstrap.js` 55) → 158/0. Die 23 Tests der Vorarbeit sind enthalten. Nach den letzten Client-Änderungen erneut:
  `test-frontend-order-wiring.js` 25/0, `test-cmoney-client-helpers.js` 20/0. Die Tests hinterlassen keine Dateien im Repo.
- **Beweis gegen die alte Logik:** `test-fin-payment-request-concurrency.js` (damaliger Teststand) 87/26 gegen den alten Code;
  `test-sec-guest-token.js` (erste Fassung) 28/23 gegen den alten Code; `test-hist-srva-fixwave.js` und die erweiterten Tests scheitern ohne die
  jeweiligen Korrekturen (Mutationsproben der Gegenprüfung).
- `test-order-security.js`: die zwei früheren Fehlschläge waren ein Zeitfenster im Test (Stub unter Last vor dem Erreichen zurückgesetzt);
  belegt mit künstlicher Verzögerung und CPU-Last; keine Erwartung gelockert; jetzt 39/0.
- Geänderte Alt-Tests passen nur an **gewollte** Verhaltensänderungen an (u. a. deutsches Zahlenformat in `test-device-change.js`, neue Fälle
  in `test-notify-notifications-http.js`); keine Prüfung wurde entfernt.
- **TypeScript** (`cd client && npx tsc -p tsconfig.app.json --noEmit`, gleiche Konfiguration und `node_modules` wie am Ausgangsstand `dec6fff`):
  Ausgang **934**, jetzt **841**; Vergleich der Meldungen ohne Zeilen-/Spaltennummern und mit sortierten Union-Typen (`tsc_compare.py`):
  **0 neu, 93 behoben, 841 bestehende Fehler bleiben** – die Typprüfung ist also **nicht grün**; die verbleibenden 841 stammen aus dem
  Ausgangsstand. Grenze des Vergleichs: eine Meldung, die in derselben Datei mit gleichem Text an anderer Stelle
  verschwindet und neu entsteht, gilt als unverändert.
- **Build:** `vite build` mit Ausgabe in ein Scratch-Verzeichnis erfolgreich (nach allen Änderungen von Runde 3); im Produktions-Bundle
  0 Treffer für `admin123`, `password123`, `admin@example.com`, `customer@example.com`, `staff@example.com` und die Demo-Telefonnummer;
  `client/dist` wurde nicht verändert. Lokal fehlen `react-quill`, `papaparse` (Client) und `compression`, `node-cron`, `qrcode` (Server);
  Ersatzmodule nur außerhalb des Repos (`nachweise/…/werkzeuge/e2e/shims`).

## 9. Datenmigration und Skripte (nichts wird still umgeschrieben)

| Skript / Änderung | Zweck | Ablauf | Wiederholbar / Rückweg |
|---|---|---|---|
| `server/scripts/seedDocumentSequences.js` | Zähler für Rechnungen und Ersatzteilbestellungen auf den höchsten Altbestand heben | Standard **Dry-Run**; schreiben mit `--confirm` | idempotent (nur anheben); Rückweg: Zähler löschen |
| Reklamationsnummern | Zähler `{documentType:'complaint', year}` | richtet sich beim ersten Anlegen je Jahr am Altbestand aus | Altnummern „R<ID>“ bleiben unverändert |
| `server/scripts/reportInspectionCommunicationDuplicates.js` | **vor** dem Deploy: Aufträge mit mehreren Gesprächsdokumenten melden (Unique-Index `orderId_unique_thread`) | nur lesend | bei Treffern: sichern, bewusst zusammenführen |
| `server/scripts/cleanupNotificationLabelData.js` | eingebettete Label-PDFs aus Benachrichtigungen/Protokollen entfernen | Standard **Dry-Run** mit Sicherungsdatei; `--confirm` | idempotent; Anzeige ist auch ohne Skript sicher |
| `server/scripts/recomputeBookingTotals.js` | veraltete Buchungs-Teilbeträge aus den Aufträgen ableiten | Standard **Dry-Run**; `--confirm` schreibt nur bei unverändertem Gesamtbetrag | idempotent; Rechnungen/Zahlungen unberührt |
| `server/scripts/guestTokenPolicy.js` (neu) | Bericht über Gast-Tokens (Format, „würde ungültig“, Dubletten – ohne Tokens auszugeben); Widerruf eines einzelnen Links | Standard nur lesend; `--rotate <Nummer>` Vorschau; `--confirm` setzt einen neuen Token | Widerruf nicht umkehrbar (alter Link ungültig); keine Mail wird gesendet |
| `server/scripts/reportDoubleDiscountInvoices.js` (Vorarbeit) | doppelt rabattierte Rechnungen 22.–26.09. melden | nur lesend | Korrektur nur per Storno/Neuausstellung |
| Neue Indizes/Sammlungen (automatisch) | Gesprächs-Unique-Index, `lastMessageAt`, Teilindex `dedupeKey`, TTL `checkoutattemptclaims`, **neu:** `paymentrequestclaims` (TTL 24 h, wird beim ersten Gebrauch angelegt) | Mongoose `autoIndex` bzw. erster Zugriff | löschbar; Daten bleiben |
| Umgebungsvariable `TRUST_PROXY` (neu, optional) | Proxy-Topologie für die Client-IP | Standard `loopback`; `true` wird abgelehnt | Rückweg: Variable entfernen |

Vor jedem schreibenden Lauf: Datenbank-Sicherung (`mongodump`) und Dry-Run-Ausgabe prüfen. Keine Altrechnung wird neu berechnet oder überschrieben.

## 10. Produktentscheidungen – Ist-Verhalten, Empfehlung, Auswirkung

### 10.1 FIN-13: steuerbefreite Kunden (keine Steuerpolitik erfunden)

**Vorhandene Felder:** Kundengruppe `financeProfile.taxMode` = `default | tax_free | reverse_charge | custom` (`custom` ohne eigenen Satz
wirkt wie `default`); `User.vatId`, `User.country` (Freitext); `Order.taxRate` (Standard 19, kein Steuer-Modus); Rechnung `taxRate`,
`isReverseCharge`, `reverseChargeNotice`, `customerVatId`. Es gibt **kein** Feld für den Befreiungsgrund und keine Prüfung, dass bei
Reverse Charge eine USt-IdNr. vorliegt. Eine Regel (`FinancialService.resolveFinancialProfile`) liefert 0 % für `tax_free`/`reverse_charge`
und liest die **aktuelle** Gruppe des Kunden zum Zeitpunkt des Aufrufs.

**Befreiung vs. fehlender Wert:** (a) legitim befreit = Gruppe `tax_free`/`reverse_charge`; (b) fehlender/leerer Steuerwert. Heute vermischt:
der Auftrag kann 0 % **nicht** speichern (`taxRate || 19` macht 0, null und fehlend zu 19), die Rechnung macht 0/null zu 0 % aber fehlend zu 19 %,
Buchungs-`tax` 0 heißt sowohl „befreit“ als auch „unbekannt“, Mails zeigen bei 0 % denselben Text wie bei unbekannter Steuer.

**Betroffene Vorgänge heute:**

| Vorgang | (a) befreiter Kunde | (b) fehlender Wert |
|---|---|---|
| Warenkorb/Checkout | MwSt. 0; **Katalog-Bruttopreis bleibt Zahlbetrag** (netto = brutto) | Satz kommt aus den Einstellungen (nie leer) |
| Auftrag anlegen | speichert 19 | wird 19 |
| Auftragsdetail (Kunde + Personal) | zeigt „davon MwSt. (19 %)“ – widerspricht Checkout/Rechnung | uneinheitlich (null → 0 %, fehlend → 19 %) |
| Buchungssummen | Steuer 0 nach **aktuellem** Profil | 0 = befreit oder unbekannt |
| Rechnung aus Buchung / aus Aufträgen / Einzelauftrag | 0 % (Reverse Charge mit Hinweis) | Rechnung: null → 0 %, fehlend → 19 % |
| Manuelle Rechnung | Reverse Charge erzwungen; **`tax_free` wird überschrieben** (Dialog sendet 19 %) | Client-Wert gewinnt |
| Rechnungs-PDF | Reverse Charge: USt-IdNr. Empfänger + Hinweis; `tax_free`: „0,00 % MwSt.“ **ohne Befreiungsgrund** (§ 14 Abs. 4 UStG verlangt einen Hinweis) | – |
| Gutschrift | übernimmt Satz/Flag der Ursprungsrechnung | – |
| Controlling | „Auftragswert (netto)“ = brutto nach **aktuellem** Profil (Gruppenwechsel ändert Vergangenheit); „Fakturiert (netto)“ stabil | – |
| E-Mails | Reverse Charge „ohne MwSt.“; `tax_free` wie unbekannte Steuer | Booking-Mail behandelt 0 als unbekannt |
| CSV-Export | ohne Satz/Befreiungsgrund | – |

**Daten:** keine Produktionsdaten verfügbar; in den Testdaten 0 befreite Kunden. Das manuelle Skript `seedDefaultCustomerGroups.js` legt eine
Gruppe „B2B Business“ mit `reverse_charge` an und überschreibt bei erneutem Lauf manuelle Gruppenänderungen.

**Zu entscheiden (Buchhaltung/Steuerberatung):** welche Gruppen auf welcher Grundlage befreit sind; ob Befreite den Katalog-Bruttobetrag
(heute) oder den Nettobetrag zahlen; ob die Steuerregel bei Bestellung oder bei Rechnung festgelegt wird (heute bei Rechnung); welcher
Befreiungstext auf `tax_free`-Rechnungen steht.

| Option | Folge | Code (klein) |
|---|---|---|
| **A** – heutige Regel behalten, Anzeige korrigieren | keine Beträge ändern sich; Befreite zahlen wie Verbraucher; späterer Gruppenwechsel wirkt auf spätere Rechnungen | Auftragsdetail zeigt „0 % laut Kundenprofil“; Befreiungstext für `tax_free` auf PDF/Mail (~2 Dateien) |
| **B** – Steuerregel am Auftrag festhalten (nur neue Aufträge) | Checkout, Auftrag, Buchung, Rechnung stimmen für neue Aufträge überein; Altaufträge unverändert | `Order.js` Zahlprüfung statt `|| 19`; Satz/Modus beim Anlegen aus dem Profil; Rechnungswege bevorzugen den Auftragswert (~4 Dateien) |
| **C** – Befreite zahlen den Nettobetrag | Zahlbeträge Befreiter sinken (Warenkorb, PayPal, Rechnung); nur mit Steuerberatung und B sinnvoll | Preisbildung + Checkout-Verteilung + Rechnungspositionen (~3–4 Dateien) |

Ohne Geschäftsentscheidung möglich, aber **nicht umgesetzt**, weil sie Rechnungsbeträge Befreiter verändern: manuelle Rechnung soll `tax_free`
nicht mehr überschreiben; null im Auftragsdetail/Rechnungsmodell als „fehlend“ behandeln.

### 10.2 Weitere Entscheidungen

| Thema | Ist-Verhalten (Beleg) | Empfehlung | Auswirkung einer Änderung | Art |
|---|---|---|---|---|
| Mehrgeräte-Rabatt (47,41 €) | 5 % von 179,80 € = 8,99 € anteilig (`allocateProportionalAmount`, checkoutRoutes.js); beide Anteile genau x,xx5 → 2,49 + 6,50 ohne Restcent (der Zweig „Rest an die größte Position“ greift hier **nicht** – frühere Formulierung korrigiert) | beibehalten; Summen stimmen überall | exakte Dezimalrundung → 47,40/123,41 (Tests [1]/[11] ändern sich); Rundung je Gerät → 9,00 € Rabatt (Warenkorb/PayPal/Buchung +1 Cent); nur neue Buchungen | technischer Standard |
| „Prioritätsaufträge“ (Dashboard) | zählt Priorität hoch/dringend in **allen** Status, Liste mit gleichem Filter (Zahl wächst nur) | nur offene zählen (nicht abgeschlossen/storniert), Liste gleich | Zahl sinkt; neuer Listenfilter; Dashboard-Test anpassen | technischer Standard (Bestätigung „offen“) |
| Storno aufheben | nur Admin, Grund Pflicht, Ziel „Ausstehend“, Rechnungen/Zahlungen unberührt | beibehalten | Personal erlauben: zwei Rollenprüfungen + 18 Testprüfungen | Rollenpolitik |
| Buchung stornieren | nur ohne offene Aufträge (409 mit Liste); abgeschlossene Aufträge blockieren nicht (Kunde bekommt dann „storniert“-Mail) | Sperre behalten; optional auch bei abgeschlossenen Aufträgen sperren | Kaskade = n Kundenmails und angehaltene Workflows | Workflow-Standard (Randfall klären) |
| Zahlungsbedingung „Net 14“ | Altwert „Net 14“ schreibgeschützt angezeigt; Rechnungen drucken „14 Tage netto ohne Abzug“; **versteckte Obergrenze 14 Tage** (Eingabe erlaubt 365, B2B-Vorlage 30) | Anzeige den gedruckten deutschen Text zeigen lassen, Obergrenze im Hilfetext nennen | nur Anzeige | Text technisch; **14-Tage-Grenze: Geschäft bestätigen** |
| DHL-Produkt und Modus | Einsendung Parcel DE (V01PAK); Modus `dummy`, solange nicht ausdrücklich `live` | beibehalten; Produktion setzt `live` bewusst (Deploy-Schritt) | DHL Retoure (QR) ändert Kosten/Ablauf, braucht echte DHL-Prüfung | Vertrag/Betrieb |
| Auslieferungslabel im Testsystem | **kein** Dummy-Modus; mit echten Zugangsdaten echtes, kostenpflichtiges Label | Testsysteme ohne echte DHL-Zugangsdaten oder mit DHL-Sandbox betreiben; ein eigener Schalter wäre eine neue Funktion | – | Betrieb / Entscheidung |
| Alte Reklamationsnummern „R<ID>“ | neue Nummern CMP-JJJJ-NNNN; Altnummern stehen in Mails/Suche | unverändert lassen (eindeutig, bereits kommuniziert) | Umnummerierung bricht Verweise; nur per Dry-Run-Skript | technischer Standard |
| Gast-Links | siehe §6.1 | umgesetzt | – | technisch entschieden |
| Rechnungs-Sofortversand, Lesestatus je Person | wie bisher | beibehalten | – | technischer Standard |

## 11. Admin-Passwort-Korrektur – Stand des Branches (Analyse vor Runde 3; **inzwischen übernommen**, siehe §16.1)

- **Branch `claude/relaxed-haslett-2138ea`:** Spitze `8929eef` (PR #103) ist ein **Vorfahre von HEAD**; ahead/behind 0/3; ein Merge meldet
  „Already up to date“ und bringt **nichts** (weder Korrektur noch Rückschritt). Ein blinder Merge wäre also wirkungslos.
- **Die Korrektur existiert nur uncommittet** im Worktree `.claude/worktrees/relaxed-haslett-2138ea` (andere Sitzung, zuletzt 25.09.):
  `server/services/seedService.js` (Admin nur anlegen, wenn kein Admin und kein Nutzer admin@example.com existiert; bestehende Nutzer nie
  ändern; Startpasswort aus `SEED_ADMIN_PASSWORD`, sonst einmalig zufällig ins Serverprotokoll), `seed-admin.js`/`verify-admin.js` (nur lesen),
  Dokumentation, neuer Test `test-seed-admin-password.js`.
- **Problem besteht im aktuellen Stand:** `seedService.js` setzt beim Start (`initializeDatabase` → `seedAll` → `seedAdminUser`) das Passwort
  von admin@example.com zurück. Der Test der Korrektur scheitert am aktuellen Stand (8 bestanden, 12 fehlgeschlagen) und besteht mit Patch (20 bestanden, 0 fehlgeschlagen).
- **Konflikte/Verträglichkeit:** 0 gemeinsame Dateien mit diesem Arbeitsstand; `git merge-file` 8/8 konfliktfrei; `git apply --check` sauber;
  die Korrektur hängt an keinem in dieser Aufgabe geänderten Code; `test-sec-seed-routes.js` 7/0 mit Patch.
- **Empfehlung (nur nach Freigabe ausführen):**

  ```bash
  cd /home/adar/Projects/FixitHub
  git -C .claude/worktrees/relaxed-haslett-2138ea diff --binary > /tmp/admin-seed-fix.patch
  git apply --check /tmp/admin-seed-fix.patch && git apply /tmp/admin-seed-fix.patch
  cp .claude/worktrees/relaxed-haslett-2138ea/test-seed-admin-password.js .
  ```

  Danach den Kommentar in `server/routes/seedRoutes.js` aktualisieren, Tests laufen lassen und **nach dem Deploy das Admin-Passwort ändern**
  (der Start-Reset hat bisher immer den Standardwert hergestellt; die Korrektur behält vorhandene Hashes). Der Patch enthält Kommentarzeilen in
  `.env.example`; Datei vorher prüfen. Den anderen Worktree erst nach der Übernahme und nur mit Zustimmung entfernen.
- Unabhängig davon: `.env.example` in HEAD enthält echt wirkende Zugangsdaten und Secrets → rotieren und durch Platzhalter ersetzen (Betreiber).

## 12. Deploy – nur nach Freigabe (nur dokumentiert; nichts davon wurde ausgeführt)

Grundsätze: **erst sichern und die Sicherung prüfen, dann ändern**; jeder Schritt bricht bei einem Fehler ab (`set -euo pipefail`, kein
`|| true`); die Version wird über **Commit- und Build-Kennung** geprüft, nie über Dateidaten; ein Rückweg spielt **niemals blind** eine
Datenbanksicherung über die laufende Datenbank (sonst gingen neue Aufträge und Zahlungen seit der Sicherung verloren).

### 12.1 Sichern (vor jeder Änderung)

```bash
set -euo pipefail
APP=/pfad/zum/FixitHub            # Projektverzeichnis auf dem Server
STATIC_ROOT=/var/www/fixithub     # von nginx ausgeliefert (scripts/deploy-production.sh)
SOLL=<geprüfte Commit-Kennung dieses Releases, 40 Zeichen>
TS=$(date +%Y%m%d-%H%M%S)
B=/var/backups/fixithub/$TS
install -d -m 700 "$B" "$B/db" "$B/runtime" "$B/static" "$B/code"      # Wiederherstellungsordner (nur root lesbar: enthält .env)

# Ausgangsstand festhalten
git -C "$APP" rev-parse HEAD                 > "$B/code/commit-vorher.txt"
git -C "$APP" status --porcelain             > "$B/code/status-vorher.txt"
cp "$STATIC_ROOT/build-info.json" "$B/code/" 2>/dev/null || echo "keine build-info.json im alten Stand" > "$B/code/build-info-fehlt.txt"
date -Iseconds                               > "$B/code/zeitpunkt-T0.txt"

# Datenbank (URL aus der .env lesen, nicht ausgeben)
DBURL=$(grep -E '^(DATABASE_URL|MONGODB_URI)=' "$APP/.env" | head -1 | cut -d= -f2-)
mongodump --uri="$DBURL" --gzip --archive="$B/db/fixithub.archive.gz"
mongorestore --uri="$DBURL" --gzip --archive="$B/db/fixithub.archive.gz" --dryRun --quiet   # Lesbarkeit prüfen, schreibt nichts
test -s "$B/db/fixithub.archive.gz"
mongosh "$DBURL" --quiet --eval 'printjson(["orders","bookings","payments","invoices","users"].map(c=>[c,db.getCollection(c).countDocuments()]))' > "$B/db/zaehlung-vorher.txt"

# Laufzeitdateien (Protokolle, Uploads, Umgebungsdateien) und ausgelieferte Oberfläche
tar -czf "$B/runtime/server-runtime.tgz" -C "$APP" server/logs server/uploads .env $( [ -f "$APP/server/.env" ] && echo server/.env )
tar -tzf "$B/runtime/server-runtime.tgz" > /dev/null
tar -czf "$B/static/static-root.tgz" -C "$STATIC_ROOT" .
tar -tzf "$B/static/static-root.tgz" > /dev/null
echo "Sicherung vollständig und lesbar: $B"
```

Erst wenn dieser Block **ohne Fehler** durchgelaufen ist (Ausgabe „Sicherung vollständig und lesbar“), weiter mit 12.2. Für einen
konsistenten Datenbankstand den Dienst kurz anhalten (`systemctl stop fixithub`) und den Datenbankteil wiederholen.

### 12.2 Aktualisieren

1. **Ziel-Commit prüfen:** `git -C "$APP" fetch origin` und `test "$(git -C "$APP" rev-parse origin/adars)" = "$SOLL"` – sonst abbrechen.
2. **Arbeitsbaum prüfen:** `git -C "$APP" status --porcelain` darf nur Änderungen unter `server/logs/` zeigen (Laufzeitprotokolle);
   alles andere vorher klären. Diese Protokolle liegen in der Sicherung, daher: `git -C "$APP" checkout -- server/logs server/uploads/reports`.
3. **Ziehen:** `git -C "$APP" pull --ff-only` (Fehler = Abbruch). Dieser Stand nimmt `server/logs/**`, Prüfbericht-PDFs und zwei
   Laufausgaben aus Git – der Pull entfernt sie vom Datenträger. Sofort zurückholen und prüfen:
   `tar -xzf "$B/runtime/server-runtime.tgz" -C "$APP" server/logs server/uploads` und die Dateianzahl mit der Sicherung vergleichen
   (`tar -tzf … | grep -c '^server/logs/.'` gegen `find server/logs -type f | wc -l`).
4. **Secrets** (§16.3): neue `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET` in `.env` setzen (alle Nutzer melden sich neu an);
   `SEED_ADMIN_PASSWORD` nur setzen, wenn die Datenbank noch keinen Admin hat. Rotation der externen Schlüssel beim jeweiligen Anbieter.
5. `npm ci` im Server- und Client-Verzeichnis (lokal fehlende Pakete s. §8).
6. Datenskripte, jeweils erst Dry-Run lesen, dann `--confirm` (ihre Sicherungsdateien in `$B/db/` ablegen):
   `reportInspectionCommunicationDuplicates.js` (nur lesend; bei Treffern zuerst zusammenführen), `seedDocumentSequences.js`, optional
   `cleanupNotificationLabelData.js`, `recomputeBookingTotals.js`, `guestTokenPolicy.js` (Bericht).
7. Proxy: Läuft nginx nicht auf demselben Host, `TRUST_PROXY` setzen; Query der Tracking-Pfade nicht protokollieren.
8. **Bauen und Build-Kennung schreiben:**

   ```bash
   (cd "$APP/client" && npm run build)
   BUNDLE=$(basename "$(ls "$APP"/client/dist/assets/index-*.js | head -1)")
   printf '{"commit":"%s","bundle":"%s","builtAt":"%s"}\n' "$(git -C "$APP" rev-parse HEAD)" "$BUNDLE" "$(date -Iseconds)" > "$APP/client/dist/build-info.json"
   install -d "$STATIC_ROOT" && rm -rf "$STATIC_ROOT"/* && cp -r "$APP/client/dist/"* "$STATIC_ROOT/"
   systemctl restart fixithub && nginx -t && systemctl reload nginx
   ```

9. **Version über die Kennung prüfen (nicht über Dateidaten):**
   `curl -s https://<host>/build-info.json` → `"commit"` = `$SOLL`; `git -C "$APP" rev-parse HEAD` = `$SOLL`; der in `build-info.json`
   genannte `bundle` ist die von der Startseite geladene `index-*.js` (Seitenquelltext). Serverprotokoll beim Start: „Admin user already
   exists, not modified“ bzw. „taken from SEED_ADMIN_PASSWORD“ – nie ein Passwort. Danach Zählung wie in 12.1 erneut ausgeben und mit
   `zaehlung-vorher.txt` vergleichen (Bestände dürfen nur wachsen).
10. Funktionsprüfung: Login-Seite ohne Beispiel-Zugangsdaten; Admin-Seitenleiste „Buchungen“/„Reparaturaufträge“; Auftrag mit Reitern und
    Versandkarten (Absender/Empfänger); Systemverwaltung → Systemkonfiguration → Reiter „Integrationen“ bewusst setzen („Dummy“ nur im Testsystem, Shop-Anschrift
    vollständig; Auslieferungslabels kennen keinen Dummy-Modus). Dann Abnahme mit `CHECKLIST_MITARBEITER_ABNAHME.md`.

### 12.3 Rückweg ohne Datenverlust

1. **Code zurück:** Protokolle sichern (`mv "$APP/server/logs" "$APP/server/logs.behalten-$TS"`, da der alte Stand diese Dateien wieder
   verfolgt), dann `git -C "$APP" checkout "$(cat "$B/code/commit-vorher.txt")"`, `npm ci`, Client bauen **oder** die alte Oberfläche aus
   `$B/static/static-root.tgz` nach `$STATIC_ROOT` entpacken, Dienst neu starten; anschließend die behaltenen Protokolle zurückkopieren
   (`cp -a "$APP/server/logs.behalten-$TS/." "$APP/server/logs/"`). Version wieder über `build-info.json`/Commit prüfen.
2. **Datenbank bleibt, wie sie ist.** Die Änderungen dieses Stands sind additiv (neue Sammlung `paymentrequestclaims`, Indizes, optionale
   Felder); der alte Stand arbeitet damit weiter. Eine Sicherung wird **nie** über die laufende Datenbank zurückgespielt – sonst gingen alle
   Aufträge, Zahlungen und Nachrichten seit T0 verloren. Nur bei nachgewiesener Datenbeschädigung: Sicherung in eine **getrennte** Datenbank
   einspielen (`mongorestore --gzip --archive="$B/db/fixithub.archive.gz" --nsFrom='fixithub.*' --nsTo='fixithub_wiederherstellung.*'`),
   betroffene Datensätze gezielt vergleichen und einzeln korrigieren; Bestände seit T0 (`zaehlung-vorher.txt`) bleiben erhalten. Die
   Datenskripte aus 12.2 Schritt 6 haben eigene Sicherungsdateien für gezielte Rücknahmen.
3. **Secrets nicht zurückdrehen:** die alten Werte gelten als offengelegt.
4. **Laufzeitdateien:** nur gezielt aus `$B/runtime/server-runtime.tgz` zurückholen (z. B. ein fehlendes Upload-Verzeichnis), nie die
   aktuelle `.env` mit der alten überschreiben, ohne die neuen Secrets zu übernehmen.

## 13. Restrisiken, offene Punkte und nicht Verifiziertes

**Offen (mit Wirkung):**
- **Secrets** (§16.3): in der echten `.env` aktive JWT-/Refresh-/Session-Secrets sind in der Git-Historie veröffentlicht – rotieren.
- **Git-Historie** enthält weiter Protokolle mit Empfängeradressen, Berichts-PDFs und Secrets (§16.2) – nur per Historien-Bereinigung entfernbar.
- **K11:** echte DHL-Prüfung offen; kein Dummy-Modus für Auslieferungslabels (Testsystem mit echten DHL-Zugangsdaten erzeugt echte Labels).
- **FIN-13 / K13:** Geschäftsentscheidung für steuerbefreite Kunden offen (§16.4); bis dahin zeigt das Auftragsdetail Befreiter 19 %,
  die manuelle Rechnung überschreibt „steuerfrei“.
- **DHL-15** toter Code (kein Nutzerimpact); **ADMUX-2** einige selten genutzte Dialoge nicht einzeln gerendert.

**Nicht verifiziert (bewusst/ohne Zugang):** echte DHL-Erzeugung, echter SMTP-Versand, PayPal; Testsystem 66.29.145.165; Abnahme durch
Mitarbeitende; im Browser nicht bedient: „Erneut senden“ in der Zahlungsaufforderungs-Liste, Inspektionsschritte 3–7, Lieferantenrechnung-
Download, Staff-Sicht mit ausgefallener Auftragsquelle, Gerätewechsel aus dem Inspektionsdialog (alle per Route getestet).

**Restrisiken:** Rate-Limits je Prozess im Speicher (mehrere Instanzen bräuchten gemeinsamen Speicher); globale Anlagegrenze kann während
eines verteilten Angriffs legitime Gäste bremsen; Tokens im Link in Logs/Verlauf (§6.1); Zahlungsaufforderung bleibt nach Prozessabsturz
mitten im Versand bis 45 min gesperrt (sichere Seite); Postfach sortiert pro Anfrage im Speicher (ab ca. 10 000 Gesprächen denormalisieren);
reparaturanfrage-„Aktion erledigen“ antwortet bei bereits erledigter Aktion still mit Erfolg (wie HEAD).

## 14. Nachweise und Wiederholung

`nachweise/abnahme-2026-10-02/` enthält (geschwärzt: Gast-Tokens, JWTs, lange Hex-Werte; **nicht** enthalten: Test-Datenbank, Test-Postfach,
Sitzungen, Passwortdateien):

- `werkzeuge/` – Netzwerkschutz, Test-Postfach, Testserver-Neustart, Vite-E2E-Konfiguration, Ersatzmodule, alle Browser-Abläufe
  (`e2e/flow_*.js`, `flowlib.js`, `run_final_flows.sh`), Prüfskripte, `run_all_tests.sh`, `tsc_compare.py`;
- `ergebnisse/browser/` – Protokoll je Ablauf und Zusammenfassung des Endlaufs; `ergebnisse/tests/` – Protokoll je Testdatei und
  Zusammenfassung; `ergebnisse/typpruefung/` – tsc-Ausgabe Ausgangsstand/Endstand und Vergleich;
- `README.md` – Aufbau der isolierten Umgebung und Befehle zum Wiederholen.

Bilder: `screenshots/abnahme-2026-10-02/` (vorher/nachher 01–19, Abläufe 20–48, Runde 3 49–56; nur Testdaten).

## 16. Runde 3 – letzte Lücken (02.10.2026, mit ausdrücklicher Freigabe für Admin-Korrektur und `git rm --cached`)

### 16.1 Admin-Passwort (SEC-D) – übernommen und verschärft

- **Übernahme:** nur die Admin-Korrektur aus `.claude/worktrees/relaxed-haslett-2138ea`, per `git diff … | git apply` (7 Dateien:
  `server/services/seedService.js`, `server/services/userService.js`, `server/scripts/seed-admin.js`, `server/scripts/verify-admin.js`,
  `README.md`, `LIVE_TRACKING_ANLEITUNG.md`, `server/scripts/README.md`) plus `test-seed-admin-password.js`. Den `.env.example`-Teil nicht
  (dort jetzt eigene Platzhalter, §16.3). Der Worktree ist unverändert (gleiche 9 Einträge); 6 Dateien sind bytegleich mit ihm.
- **Verhalten jetzt:** `seedAdminUser` legt `admin@example.com` nur an, wenn es **keinen** Admin und keinen Nutzer mit dieser E-Mail gibt,
  und ändert nie einen bestehenden Nutzer – auch nicht bei jedem Serverstart (`seedAll`). Startpasswort aus `SEED_ADMIN_PASSWORD`.
  **Zusätzlich (Runde 3):** In Produktion (`NODE_ENV=production`) ohne `SEED_ADMIN_PASSWORD` wird **kein** Admin angelegt (nur Warnung,
  kein Zufallspasswort im Protokoll); Blog-/FAQ-/SEO-Seeds werden dann übersprungen, der Start läuft weiter. In der Entwicklung erzeugt
  ein fehlender Wert ein Zufallspasswort, einmalig protokolliert.
- **Nachweise:** `test-seed-admin-password.js` 26/0 (u. a. bestehender Admin-Hash bleibt bei `seedAll`, Produktion ohne Variable: 0 Admins,
  kein Passwort im Protokoll; mit Variable genau dieses Passwort, Neustart lässt den Hash unverändert); `test-sec-seed-routes.js` 7/0;
  isolierter Testserver: Passwort geändert → Server neu gestartet → neues Passwort gilt, altes nicht (32/0); der Testserver 5099 meldet
  nach jedem Neustart „Admin user already exists, not modified“.
- **Weitere Funde dabei (alle aus HEAD, behoben):** `PUT /api/users/me` erlaubte Selbst-Beförderung zum Admin (Freigabeliste der
  Profilfelder, `test-sec-profile-self-update.js` 18/0, gegen alten Code 10 Fehlschläge); `/new-order` zeigte Demo-Admin-Daten als
  Kundendaten; `seed-sample-data.js` hätte in Produktion Demo-Konten angelegt (jetzt gesperrt); Passwortlänge und Profiladressen im
  Serverprotokoll entfernt. Produktions-Bundle: `admin123`, `password123`, `admin@example.com`, Demo-Konten = **0 Treffer**.
- Demo-Zugänge in Login/`/debug` existieren nur im Entwicklungsmodus (nicht im Bundle). Es gibt keine Funktion „eigenes Passwort ändern“
  für angemeldete Nutzer; ein Admin ändert sein Passwort über „Passwort vergessen“ (Produktentscheidung, §16.8).

### 16.2 Getrackte Protokolle und Personendaten

- **Inventar (neu gezählt, nicht aus dem alten HEAD übernommen):** `git ls-files server/logs` = **128** Dateien (je 42 Tagesprotokolle
  `EmailDelivery-*`, `EmailRetry-*`, `EmailService-*`, dazu `email-delivery-log.json` und `smtp-connection-log.json`, ca. 2,7 MB).
  Inhaltstypen (nur Zählung): Empfängeradressen (darunter Adressen echter Personen bei Freemail-Anbietern), Betreffs, Vorlagennamen,
  Message-IDs, Fehlermeldungen; keine Tokens oder Reset-Links. Zusätzlich gefunden: 22 Prüfbericht-PDFs in `server/uploads/reports`
  (Kundenname, E-Mail, teils Seriennummer/IMEI), `server_output.log`, `test-results.log` (Lauf-/Fehlerausgaben).
- **Schreiben/Lesen:** geschrieben von `server/utils/logger.js` (Tagesprotokolle) und `server/utils/emailLogger.js`
  (`EmailDeliveryTracker` → `email-delivery-log.json`, `smtp-connection-log.json`). Gelesen wird nur `email-delivery-log.json` – beim Start
  in den Speicher – für die Admin-Seite **E-Mail-Verwaltung** (Statistik, Verlauf je Adresse, Protokoll; `systemConfigRoutes.js`).
  Wiederholungen laufen im Speicher, es gibt **keine** dateibasierte Retry-Warteschlange oder Dedupe aus dieser Datei.
- **Fehlende Dateien:** Ordner und Dateien werden beim Start angelegt; leere/fehlerhafte JSON gelten als leer. Lücke behoben: wurde der
  Ordner im laufenden Betrieb gelöscht, gingen Zeilen der Tagesprotokolle verloren – jetzt wird er bei `ENOENT` neu angelegt
  (`test-logs-bootstrap.js` 55/0, alter Code 12 Fehlschläge; isolierte Serverkopie ohne Protokollordner: alle 5 Szenarien grün;
  E-Mail-Verwaltung im Browser lädt unverändert, 9/0). Getestet nur in temporären Ordnern bzw. einer Kopie – echte Protokolle unberührt.
- **Umgesetzt (nur Index, Dateien bleiben auf der Platte):**

  ```bash
  git rm --cached -r server/logs
  git rm --cached server/uploads/reports/inspection-*.pdf server_output.log test-results.log
  # .gitignore: server/logs/, server/uploads/{reports,invoices,chat,messages,csv,avatars}/* (mit !…/.gitkeep), /server_output.log, /test-results.log
  ```

  Ergebnis: `git diff --cached --stat` → **152 Dateien, nur Löschungen aus dem Index** (128 `server/logs`, 22 Berichts-PDFs, 2 Laufausgaben);
  auf der Platte fehlen 0, alle Größen gleich; sonst nichts im Index. Kein globales `*.log`-Muster (sonst wären die Nachweise ignoriert).
- **Bleiben getrackt, Entscheidung nötig:** `RG51899.pdf` (Rechnung aus einem Fremdsystem mit Kundenanschrift, Telefon, IBAN; nirgends
  referenziert) → anonymisierte Kopie oder interne Ablage, dann normal löschen; `iphone14-db.json` (leer, keine Personendaten);
  `server/services/seedService.js.bak` (alte Seed-Logik mit Standardpasswort) und zwei Editor-Swap-Dateien (`.swp`) → löschen;
  `server/scripts/create-imported-user.js` und `SMTP_EMAIL_INTEGRATION.md` (je eine Freemail-Adresse) → Platzhalter;
  `client/src/data/annahmestellenData.ts` (öffentliche Partner-Annahmestellen mit Kontaktdaten, auf der Website angezeigt) →
  Einverständnis der Partner prüfen.
- **Git-Historie:** `git rm --cached` wirkt nur für künftige Commits. Alle früheren Fassungen bleiben in der Historie (122 von 1 024 Commits
  berühren die Pfade, 18 lokale/entfernte Branches, GitHub-Remote, jede Kopie und jeder Fork, PR-Branches). Optionen (nicht ausgeführt):
  `git filter-repo --invert-paths --path server/logs/ --path server/uploads/reports/ …` (alle späteren Commit-Hashes ändern sich) oder BFG
  (`--delete-folders logs`, nach Dateinamen). Folgen: `git push --force --all --tags` (Branch-Schutz kurz aufheben), alle Team-Klone neu
  klonen oder hart zurücksetzen (sonst bringt ein alter Branch die Historie zurück), alle Branches neu schreiben, offene PRs neu aufsetzen,
  Forks/fremde Kopien bleiben unverändert, GitHub-Caches/PR-Refs nur über den GitHub-Support. **Die Historie ist nicht bereinigt.**
- **Wichtig für das Deployment:** Ein `git pull` des Commits, der diese Dateien aus dem Index nimmt, **löscht sie auf dem Zielsystem**;
  ist `email-delivery-log.json` dort geändert, bricht der Pull ab – `scripts/deploy-production.sh` (`git pull --ff-only || true`) läuft dann
  still mit altem Code weiter. Vorgehen siehe §12.1 (Sicherung) und §12.2 Schritt 2–3.

### 16.3 `.env.example` und weitere Secrets

- In `.env.example` wurden 5 echt wirkende Werte durch Platzhalter ersetzt (Schlüssel: `DATABASE_URL` – MongoDB-Atlas-Verbindung mit
  Benutzer/Passwort, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`, `TRACKING_SALT`); `SEED_ADMIN_PASSWORD` dokumentiert
  (in Produktion Pflicht). Ebenso ein DHL-API-Schlüssel/-Secret in `server/DHL_API_INTEGRATION_DOCUMENTATION.md`. Werte wurden nie
  ausgegeben; die echte `.env` wurde nicht verändert. `.env.example` parst weiter (11 Schlüssel).
- **Kritisch:** Die echte `.env` verwendet **dieselben** `JWT_SECRET`, `REFRESH_TOKEN_SECRET` und `SESSION_SECRET` wie die veröffentlichten
  (nur Gleichheit geprüft). Wer Zugriff auf das Repo hatte, konnte Anmelde-Tokens fälschen.
- **Vom Betreiber zu rotieren** (falls echt/aktiv): (1) `JWT_SECRET`, (2) `REFRESH_TOKEN_SECRET`, (3) `SESSION_SECRET` – sofort, alle
  Sitzungen werden abgemeldet; (4) MongoDB-Atlas-Benutzer aus der alten `DATABASE_URL` (Passwort ändern oder Benutzer löschen,
  Netzwerkfreigaben prüfen); (5) `TRACKING_SALT` (falls irgendwo genutzt); (6) DHL-API-Schlüssel/-Secret aus der Doku; (7) PayPal-Sandbox-
  Zugangsdaten in `server/server/config/gateways/gateway2.json` (Laufzeitdatei, nicht geändert); (8) Mobile-API-Schlüssel, der als
  Rückfallwert fest in `server/routes/proxyRoutes.js` steht (Laufzeitcode, nicht geändert – besser in die `.env`).
  Der logo.dev-Schlüssel in `server/utils/brandLogos.js` ist ein öffentlicher „publishable“ Schlüssel (keine Rotation nötig).
- Das Bearbeiten der Dateien beseitigt die Offenlegung **nicht**: die Werte stehen weiter in der Git-Historie und in jeder Kopie.
  Zusätzlich behoben: `server/scripts/setup-env.js` schrieb die Datenbank-URL samt Zugangsdaten ins Protokoll (jetzt maskiert).

### 16.4 FIN-13 – technischer Fehler behoben, Geschäftsentscheidung offen

- **Behoben (keine Politikänderung):** Ein ausdrücklich gespeicherter Steuersatz **0 %** bleibt 0 beim Speichern, beim Neuberechnen nach
  Positionsänderungen, im Preisblock (Kunde und Team), in den Buchungssummen und auf den Seiten. Ein **fehlender/leerer** Satz gilt als
  „nicht gespeichert“ und nutzt den konfigurierten Standardsatz; die API meldet `taxRateSource: 'default'`, die Oberfläche zeigt
  „19 %, Standardsatz“. Vorher: `taxRate || 19` machte 0 zu 19, `null` ergab 0 %. Unverändert: welcher Satz neue Aufträge bekommen
  (weiter 19 %), Preise befreiter Kunden, Rechnungen, `Invoice.js` (Altbelege werden nicht neu berechnet).
- **Nachweise:** `test-fin-tax-zero-vs-missing.js` 26/0; alle Finanz-Regressionstests grün; Browser (`check_r3_fin13_display`): 0-%-Auftrag
  überall „MwSt. (0 %)“, Netto = Brutto = 47,40 €; Auftrag ohne Satz „19 %, Standardsatz“ (10,00 = 8,40 + 1,60); 19-%-Auftrag 47,40 =
  39,83 + 7,57 ohne Zusatz.
- **Offen – Geschäftsentscheidung für NEUE Aufträge** (heute: befreiter Kunde zahlt den Katalog-Bruttopreis ohne MwSt.):
  - Preis: Katalog 49,90 € → heute zahlt ein befreiter Kunde **49,90 €** (MwSt. 0); Alternative „Nettopreis“ wäre **41,93 €**.
  - Zeitpunkt: Steuerregel bei der Bestellung festhalten (neue Aufträge speichern 0 % für befreite Profile) oder wie heute erst bei der
    Rechnung (Auftragsdetail zeigt bis dahin 19 %).
  - Rechtsgrundlage: welche Gruppen `tax_free` bzw. `reverse_charge` sind, ob eine USt-IdNr. Pflicht ist, welcher Befreiungstext auf die
    Rechnung kommt (Steuerberatung); ob „USt-IdNr. + Land ≠ DE“ automatisch Reverse Charge bedeutet.
  - **K13 gilt daher nur für Standardsteuer und gespeicherte 0 %; steuerbefreite Abläufe sind nicht abgenommen.**

### 16.5 K11 – Auslieferung: Absender, Empfänger, Richtung

- Die Admin-Versandkarten zeigen je Richtung **Absender → Empfänger** mit Name, Anschrift (bzw. Packstation), PLZ/Ort und Quelle
  (z. B. „Rechnungsadresse im Kundenprofil“, „DHL-Integration (Shop-Anschrift)“); fehlende Angaben als „Adresse fehlt – bitte prüfen“.
  Die Daten kommen aus **denselben Funktionen wie die Label-Erstellung** (Shop: aktive DHL-Integration; Einsendung mit Buchung:
  Buchungslabel; ohne Buchung: Regel des Retourenlabels – nie Packstation, sonst Rechnungsadresse; Auslieferung: Lieferadresse), nur für
  das Team; Kunden erhalten die Felder nicht.
- Nachweise: `test-shipping-outbound-direction.js` 69/0 (Parteien = Nutzlast des gesendeten Labels, Packstation, fehlende Adressen,
  Kunde ohne Teamfelder); Browser `flow_k11_admin_label_download` (Auslieferungslabel gegen den **lokalen Mock**, Karten = Mock-Nutzlast),
  390 px ohne Querscroll, Kundensicht ohne Adressblock.
- Offen: echte DHL-Prüfung (keine kostenpflichtigen Labels erzeugt); kein Dummy-Modus für Auslieferungslabels (bewusst keine neue
  Produktionsfunktion nur für Tests); im Testsystem fehlt eine Shop-Anschrift in der DHL-Integration (wird korrekt als fehlend gemeldet).

### 16.6 Wirkungslose und entfernte Funktionen

- **Workflow-Vorlagen:** „Bei Start/Abschluss/Verzögerung benachrichtigen“, „Pflichtschritt“, „Freigabe“, „Formular“ und die
  Automationsregel „Send Notification“ werden nirgends ausgewertet (kein Bezug zwischen Reparatur-Workflow und Vorlage). Sie sind jetzt
  **gesperrt** und erklärt („nicht unterstützt – die Kundeninformation steuert der Schalter „Kunde informieren“ im Arbeitsschritt“);
  gespeicherte Werte bleiben. Die geforderte Funktion (K06: an → genau eine Benachrichtigung + E-Mail, aus → nichts, Speichern und
  Versand getrennt, Wiederholung ohne Doppel) liegt im Schalter „Kunde informieren“ und ist im Browser belegt (inkl. Wiederholung
  „Kunde über Abschluss informieren“: Doppelklick → genau eine Benachrichtigung und eine Mail). Dabei behoben: die Wiederholung legte
  bei unverändertem Text eine zweite In-App-Benachrichtigung an.
- **Entfernter Status-Umschalter in `/admin/orders`:** Ersatz im Browser belegt (`flow_r3_status_from_detail`): Liste → „Auftrag öffnen“ →
  Statusmenü im Kopf → neuer Status = **3 Klicks**; Storno zusätzlich Grund (Pflicht); beide Wechsel im Verlauf. Die Liste zeigt bei
  storniertem Auftrag ohne Zahlung jetzt „Storniert“ statt „Offen“.
- **Gerätebilder im Buchungsdetail des Kunden:** entfallen (bis zu 5 Katalogsuchen je Gerät); Ersatz: „Details ansehen“ öffnet das Gerät.

### 16.7 Weitere Korrekturen dieser Runde (Browser-Funde, alle aus HEAD)

- Checkout: bei „Lieferadresse wie Rechnung“ speicherte das Ändern der Rechnungsadresse die **alte** Rechnungsadresse als abweichende
  Lieferadresse (spätere Sendungen an die alte Adresse); Packstation-Daten gingen verloren → behoben.
- Profil: jedes Speichern schaltete „Lieferadresse wie Rechnung“ ab → behoben.
- Fehlerhafte deutsche Texte im Profil und Mitarbeiter-Dashboard („Hochladening“, „… Fehler beim“, „Good Evening“) korrigiert.
- **Schlussrunde:** Server erzwingt jetzt „Überspringen erlaubt“ der Workflow-Vorlage (409 `WORKFLOW_STEP_NOT_SKIPPABLE`,
  `test-workflow-skip-canskip.js` 14/0); `seed-sample-data.js` bricht in Produktion mit Exit-Code 1 ab (`test-seed-sample-data-production.js`
  6/0); Rohschlüssel/kaputte Texte auf den Seiten des Mitarbeitertests behoben (Staff-Menü, Staff-Dashboard, Zeiterfassung, Team-Chat,
  Profil, Kundenmenü „Reparaturanfragen“, „Kundengruppen“; `test-i18n-staff-checklist-keys.js` 7/0).

### 16.8 Entscheidungen, die wirklich beim Auftraggeber liegen

1. **Secrets rotieren** (§16.3) – Pflicht, wenn die Werte echt waren; die JWT-/Refresh-/Session-Secrets sind nachweislich im Einsatz.
2. **Git-Historie bereinigen** ja/nein (§16.2) – nur mit Force-Push und Neuklonen aller Kopien; ersetzt die Rotation nicht.
3. **FIN-13** Preis und Zeitpunkt der Steuerregel für befreite Kunden (§16.4).
4. `RG51899.pdf`, `seedService.js.bak`, `.swp`-Dateien, Freemail-Adressen in Skript/Doku, `gateway2.json`, Mobile-API-Rückfallschlüssel:
   löschen/ersetzen in einem normalen Commit.
5. Optional: Funktion „eigenes Passwort ändern“ für angemeldete Nutzer; Hinweis im Statusmenü, dass der Kunde benachrichtigt wird;
   automatische Status-Nachrichten der Vorlagen-Workflows abschaltbar machen (neue Funktionen, nicht umgesetzt).
6. Drittanbieter-Tracking (`t.adcell.com`, in `client/index.html` auf allen Seiten inkl. Admin geladen) – Datenschutz/Einwilligung prüfen.

### 16.9 Mitarbeiter-Checkliste und Versionskennung

- **Checkliste für die Abnahme durch Mitarbeitende:** `CHECKLIST_MITARBEITER_ABNAHME.md` (deutsch, ohne Fachbegriffe): Kopf mit Version,
  Vorbereitung (Testkonten, Testmodus, Shop-Anschrift), Teil 1 kritischer Kurztest (ca. 20–30 Minuten), Teil 2 vollständige Liste von A bis Z,
  Teil 3 „Nur mit ausdrücklicher Freigabe“ (echte Zahlung, echte/kostenpflichtige DHL-Labels inkl. Reklamationsgenehmigung und
  Einsendelabel ohne Buchung, Nachrichten an echte Personen) und eine Liste der offenen Entscheidungen. Beschriftungen gegen den Code geprüft.
- **Versionskennung:** Die App zeigt keine Version an. Das Deploy-Verfahren (§12.2 Schritt 8) schreibt deshalb `build-info.json` mit Commit,
  Bundle-Name und Build-Zeit neben die ausgelieferten Dateien; Testende lesen `https://<Testsystem>/build-info.json` ab und tragen den
  Wert `commit` in die Checkliste ein. Fehlt die Datei oder weicht der Commit ab, wird nicht getestet.
- **Vor dem Mitarbeitertest zwingend:** Deploy nach §12 auf das Testsystem; DHL-Modus „Dummy“; Shop-Anschrift in der DHL-Integration
  vollständig; Testkonten (Gast ohne Konto, normaler Testkunde, Partnerkunde mit 5 % in einer Gruppe mit Zahlungsart „Rechnung“, Mitarbeiter,
  Admin) mit Postfächern der Testenden; Test-SMTP bzw. nur Testadressen; produktiver Build (nicht der Entwicklungsserver).
