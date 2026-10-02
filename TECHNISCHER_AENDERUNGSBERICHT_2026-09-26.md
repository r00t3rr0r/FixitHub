# Technischer Änderungsbericht — Stabilisierung nach Sophies Test vom 24.09.2026

> **Fortgeschrieben am 02.10.2026:** siehe `TECHNISCHER_AENDERUNGSBERICHT_2026-10-02.md` und `BEFUNDLISTE_2026-10-02.md`.


**Branch:** `adars`, Basis `6943b03` · **Stand:** 26.09.2026
**Umfang:** 75 geänderte und 25 neue Dateien, ca. +16.900 / −5.700 Zeilen
**Status:** vollständig im Arbeitsbaum, **nicht committet**, nicht gemergt, nicht deployed

Dieser Bericht **ersetzt** `TECHNISCHER_AENDERUNGSBERICHT.md` vom 22.09. Abschnitt 1 listet, was
am Bericht vom 22.09. falsch war. Sophies Nachtest steht in [`ABNAHMETEST_SOPHIE.md`](ABNAHMETEST_SOPHIE.md).

---

## 0. Kurzfassung

- Sophies Foto-Szenario ist über die **echte HTTP-API** und im **Browser** gegen einen isolierten
  Server nachgestellt: Auftrag 42,42 €, Rechnung 42,42 € (Rabatt 7,48 / Netto 35,65 / MwSt. 6,77),
  „An Kunden versenden" für Admin und Mitarbeiter, Fälligkeit passend zum Zahlungsziel.
- **33 Testdateien, 1.051 Zusicherungen, 0 Fehler.** Alle laufen gegen eine Wegwerf-Datenbank und
  hinter einer Netzsperre, die jede Verbindung außer localhost blockiert; 0 Verbindungsversuche.
- **Typprüfung:** 0 neue Fehler gegenüber HEAD, 37 bestehende Fehler behoben.
- **Build:** kompiliert. Lokal scheitert `npm run build` an einem **nicht installierten** Paket
  (`react-quill`), siehe Abschnitt 7.
- **Nicht geprüft:** echtes DHL-Label, echte PayPal-Zahlung/-Erstattung, echte E-Mail-Zustellung,
  der Stand auf dem Testserver (kein Zugriff).

---

## 1. Korrekturen am Bericht vom 22.09.2026

| Aussage am 22.09. | Tatsächlich |
|---|---|
| A1/A2 „Behoben" | Die Rechnungsseite wurde am 22.09. **selbst beschädigt**: Der Gruppenrabatt wurde bei der Rechnungserstellung ein zweites Mal abgezogen (Sophies Foto: 7,48 + 15 % von 42,42 = 13,84 → 36,06 €). Außerdem verloren Leistungsänderungen am Auftrag den Rabatt, und `POST /api/orders` übernahm den Auftragswert ungeprüft vom Client. Alles jetzt behoben. |
| G1 „Behoben" | Die Richtung war **vertauscht**: Die „Rücksendung" rief DHL **Retoure** auf (Kunde als Absender). Außerdem enthielt das ausgelieferte Frontend den Knopf gar nicht (siehe 7.1). |
| „Typprüfung fehlerfrei" | Der verwendete Befehl `npx tsc --noEmit` prüft **nichts**: `client/tsconfig.json` hat `"files": []`. Richtig ist `npx tsc -p tsconfig.app.json --noEmit`. Nachgemessen: Der 22.09.-Stand hat trotzdem keinen neuen Fehler eingeführt. |
| B1/B2 Zahlungszuordnung | Die Zuordnung war am 22.09. korrekt beschrieben, aber nicht gegen Nebenläufigkeit (Doppelklick, Webhook-Wiederholung) abgesichert. Jetzt atomar. |

---

## 2. Die Regeln, die jetzt gelten — pro Regel genau eine aktive Implementierung

### 2.1 Geld ist brutto-first (unverändert seit 22.09.)
`net = bruttoNachRabatt / (1 + taxRate/100)`, `tax = bruttoNachRabatt − net`. Der Rabatt wird
genau einmal vom Brutto abgezogen. `Invoice.total` = Brutto, `Invoice.subtotal` = Netto.

### 2.2 Prozentrabatt: `CalculationHelper.percentOf(amount, percent)`
**Einzige** Formel für „Prozentsatz eines Betrags". Sie wird von Warenkorb (Gruppen- und
Aktionsrabatt), Auftragsbepreisung, `calculateOrderValue` und dem Standardrabatt manueller
Rechnungen benutzt. Vorher gab es drei Formeln: 15 % von 49,90 ergab im Warenkorb 7,48, in der
Auftragsbepreisung 7,49. Gefunden hat das erst der End-to-End-Lauf.
Die Regel entspricht exakt der bisherigen Warenkorb-Rundung, geprüft an ca. 34.000 Fällen. Der
Warenkorb zeigt also nirgends einen anderen Betrag als vorher. → Offene Entscheidung 9.1.

### 2.3 Auftragswert: `OrderService.applyOrderPricing` + `CalculationHelper.calculateOrderPricing`
Positionen behalten ihren **Listen-Bruttopreis**; der Kundenrabatt wird **einmal auf
Auftragsebene** abgezogen und als zeitgebundener Schnappschuss `order.pricingConditions`
gespeichert (Prozentsatz, Quelle, Zeitpunkt). Eine spätere Änderung der Kundengruppe ändert
alte Aufträge nicht. Genutzt von:
- `OrderService.create` (`POST /api/orders`): Client-Werte für Geld, Zahlstatus usw. werden
  verworfen; die Route übernimmt nur eine Positivliste von Feldern.
- Checkout: übergibt seine geprüfte Bepreisung **nur** über die interne Option
  `OrderService.create(data, { trustedPricing })`, nie über den Request-Body.
- Leistungen / Zusatzleistungen / Shop-Produkte hinzufügen, ändern, löschen; Gerätewechsel.
  Alle Schreiber laufen über `runGuardedOrderEdit` mit optimistischer Sperre (`editRevision`).
  Parallele Bearbeitungen führen deshalb nicht mehr zu Positionen aus der einen und Beträgen aus
  der anderen Anfrage.
- Altaufträge, deren Wert nicht zu den Positionen passt: `409 ORDER_VALUE_NOT_RECONCILED` mit
  Differenz, bis der Nutzer die Neuberechnung **bestätigt**. Die Bestätigung ist an die gezeigte
  Differenz gebunden (`repricingBasis`).

### 2.4 Rechnung = Auftragswert
`createInvoiceFromOrder` / `generateFromRepairOrders` verwenden den **gespeicherten**
Auftragsrabatt und nur einen ausdrücklich eingegebenen Zusatzrabatt. Der Gruppenrabatt wird dort
nie erneut angewandt. Invariante (getestet): Rechnungsbrutto === Summe der Auftragswerte.

### 2.5 Eine aktive Rechnung pro Auftrag/Buchung — atomar
`Invoice.activeBillingKeys` (`order:<id>`, `booking:<id>`) mit **partiellem Unique-Index**. Die
Schlüssel werden bei Storno/Gutschrift automatisch freigegeben, damit „Storno + Neuausstellung"
funktioniert. Altbestand ohne das Feld wird nicht indiziert, der Indexbau scheitert also nicht.
Vorher ergaben 6 parallele „Rechnung erstellen" 6 Rechnungen; jetzt 1, der Rest bekommt eine
deutsche 409.

### 2.6 Zahlungsstand: `PaymentService` (seit 22.09.), jetzt vollständig durchgezogen
Eine Zuordnungsregel für Liste und Detail. Offen = max(0, Brutto − wirksame Zuordnungen);
Überzahlung und Erstattung separat. Erstattung, Belegkorrektur und Zuordnungsauflösung sind
getrennte Vorgänge. PayPal-Erstattungen: ein Timeout gilt als **ungeklärt**, nie als
fehlgeschlagen. Eine neue Erstattung löst eine frühere ungeklärte **nie als Nebenwirkung** aus;
geklärt wird über „Abgleichen" oder die Wiederholung im selben Dialog mit derselben
PayPal-Request-Id. Webhooks sind idempotent.

### 2.7 Versand: zwei Richtungen, zwei DHL-APIs
- **Einsendung (Kunde → McRepair):** DHL **Retoure** (Kunde ist Absender).
- **Auslieferung (McRepair → Kunde):** DHL **Versand** (Parcel DE Shipping), Absender Shop,
  Empfänger Lieferadresse. Neu: „An Kunden versenden" für Admin und Mitarbeiter, gleiche
  Bedingung in Frontend und Backend.
- Atomare Reservierung mit Lease und Fencing gegen doppelte bezahlte Labels. Bei einem
  DHL-Timeout wird **nicht** blind wiederholt, sondern der Status „Abgleich erforderlich" gesetzt,
  mit Abgleich-Endpunkten für beide Richtungen. Harte Gesamtfrist für den DHL-POST. Ein- und
  Ausgangs-Trackingfelder überschreiben sich nicht mehr.
- Unbekannte DHL-Produktcodes → 400 vor jedem DHL-Aufruf; Altcodes `P/N/Y` werden normalisiert.

### 2.8 Belegnummern: `DocumentSequence` (seit 22.09.)
`INV-JJJJ-NNNN` und `INV-CN-JJJJ-NNNN`, zwei atomare Zähler. Neu: Der Unique-Index wird vor der
ersten Vergabe sichergestellt; vorher vergab die allererste parallele Zähleranlage mehrfach
dieselbe Nummer.

---

## 3. Abnahmeszenarien T01–T25

Nachweisstufe: **U** Unit · **S** Service gegen echte Test-DB · **H** echte HTTP-Route ·
**B** Browser · **M** externer Anbieter gemockt (keine Sandbox).

| ID | Szenario | Status | Nachweis |
|---|---|---|---|
| T01 | Händler 49,90 → 42,42 von Buchung bis Rechnung/PDF | behoben, getestet | H+B · `test-order-pricing-http`, `test-percent-rounding-consistency`, E2E-Lauf. Warenkorb→PayPal-Checkout im Browser **nicht** durchgespielt |
| T02 | VIP 10 %: 100→90, +50→135, ändern/löschen/neu laden | behoben, getestet | H · `test-order-value-service-edit` (87) |
| T03 | Modellgerechte Leistungen, fremdes Modell abgelehnt, manuelle Position bis Rechnung | behoben, getestet | H · `test-device-change-service-match`, `test-order-residual` |
| T04 | 100 vorab, Rechnung 50, Überzahlung 50, Erstattung 50 → 0; Beleg bleibt 50 | behoben, getestet | S+M · `test-payment-flows` |
| T05 | 100 vorab, Rechnung 150, Rest 50, Nachzahlung → bezahlt | bereits korrekt, verifiziert | S · `test-payment-flows` |
| T06 | „Bezahlt" mit Datum/Methode, kein doppeltes Geld | behoben, getestet | S · `test-payment-flows`, `test-refund-webhook-hardening` |
| T07 | 300 Teilzahlung sichtbar, Versandstatus getrennt, Doppelklick/Webhook einmal | behoben, getestet | S+H · `test-payment-flows`, `test-refund-webhook-hardening` |
| T08 | Mehrere Aufträge/Rechnungen, Teilerstattung, Überzahlung zuordnen | behoben, getestet | S · `test-payment-flows`, `test-booking-billing-consistency` |
| T09 | Storno unbezahlt/teil-/voll bezahlt, Beleg unveränderlich | behoben, getestet | H · `test-invoice-storno` (68). Belegform → Entscheidung 9.6 |
| T10 | Zwei Nummernkreise, paralleler Erstzähler | behoben, getestet | S · `test-invoice-documents`, `test-invoice-integrity` |
| T11 | Abgeschlossener Auftrag: Auslieferung für Admin+Mitarbeiter, Shop→Kunde | behoben, getestet | H+B+M · `test-shipping-outbound-direction`, E2E, Browser. Kein Sandbox-Label |
| T12 | Einsendelabel vorhanden → Auslieferung; Tracking getrennt | behoben, getestet | H+M · Versand-Tests |
| T13 | Adresse/Packstation, PDF, fehlende Adresse, Anbieterfehler, Timeout, Retry | behoben, getestet | H+M · `test-shipping-label-recovery`, `test-shipping-claim-fencing` |
| T14 | Mehrgeräte-Buchung, Teillieferung | behoben, getestet | H+M · Versand-Tests |
| T15 | Inspektion Schritt 2/4 Speichern→Weiter, Fehler im Schritt, Rehydrierung | **teilweise** | B · Zurückspringen und leere Fehlermeldungen behoben. Sophies exakter Ablauf **nicht nachstellbar** |
| T16 | A→B→C-Modell; unklare Diagnose/0 € nicht als echt | behoben, getestet | S+B · `test-inspection-report-values` |
| T17 | Workflow-Leseansicht, Wiedereinstieg, Filter „Warten auf Kundenrückmeldung" | behoben, getestet | H+B · `test-repair-workflow-feedback` |
| T18 | PDF Admin/Mitarbeiter/Kunde, fremder Kunde abgewiesen, Buchungslink | behoben, getestet | H+B · `test-invoice-documents`, E2E |
| T19 | Zahlungsaufforderung: Versand/Fehler/Historie/Notiz, Suche nach Rechnungsnr. | behoben, getestet | S · E-Mail über Test-Transport, **keine echte Zustellung** geprüft |
| T20 | Mahnlauf: Schwellen, +7 Tage, Retry, Teilzahlung, Storno, Inkasso-Stopp | behoben, getestet | S · `test-dunning-run` (48) |
| T21 | Gutschrift: Steuer in Vorschau/PDF, Bezug, keine Doppelabbuchung | behoben, getestet | S · `test-invoice-documents`, `test-documents-residual` |
| T22 | Neuer Datensatz vs. Altbestand | **teilweise** | S · Altaufträge in `test-order-value-concurrency-legacy`; keine vollständige Altbestands-Kette |
| T23 | Foto-Regression 49,90 − 7,48 = 42,42, kein zweiter Rabatt | behoben, getestet | H+B · `test-discount-double-application`, E2E, Browser |
| T24 | Foto-Auftragsbildschirm: Auslieferung erreichbar | behoben, getestet | H+B. Zahlungsvorbehalt → Entscheidung 9.4 |
| T25 | Fälligkeit und Zahlungsziel aus derselben Bedingung | behoben, getestet | H+B · Rechnung „14 Tage netto" ↔ +14 Tage |

---

## 4. Wichtigste gefundene Ursachen

1. **Doppelter Gruppenrabatt auf der Rechnung** (Regression vom 22.09.): `order.discount` war
   schon der fertige Rabatt; die Rechnung rechnete den Prozentsatz erneut aufs Rest-Brutto.
2. **Leistungsänderungen verloren den Rabatt**: `totalCost` = Summe der Listenpreise, der Rabatt
   blieb veraltet stehen (Sophies ursprüngliches „im Auftrag wieder 49,90").
3. **`POST /api/orders` übernahm den Auftragswert vom Client** (Preismanipulation möglich).
4. **Endlosrekursion in `orderServiceManagementService.toIdString`**: Jede Positionsbearbeitung
   brach mit „Maximum call stack size exceeded" ab (zweite, nie reparierte Kopie des
   22.09.-Fehlers B3).
5. **Drei verschiedene Prozentformeln** (Warenkorb 7,48 / Auftrag 7,49).
6. **Versandrichtung vertauscht**: „Rücksendung" = DHL Retoure mit dem Kunden als Absender.
7. **Mehrfachrechnungen bei parallelen Klicks** (Prüfen, dann Einfügen, ohne atomare Sperre).
8. **Veraltetes Frontend-Bundle** und **fehlende npm-Pakete** (Abschnitt 7).

---

## 5. Neue Dateien

| Datei | Zweck |
|---|---|
| `server/models/InvoiceDocumentArchive.js` | Archivierte Rechnungs-PDFs außerhalb des Invoice-Dokuments. Vorher wuchs jede Rechnung mit jeder Neuerzeugung Richtung 16-MB-Grenze |
| `server/scripts/reportDoubleDiscountInvoices.js` | **Nur lesend.** Findet Rechnungen mit doppeltem Gruppenrabatt (22.09.–26.09., z. B. INV-2026-0007) |
| 23 × `test-*.js` | Regressionstests, s. Abschnitt 6 |

Seit 22.09. vorhanden und weiter gültig: `DocumentSequence.js`, `PaymentRequest.js`,
`seedDocumentSequences.js`, `repairGrossNetInvoiceTotals.js`.

---

## 6. Prüfstand

```bash
# Jeder Test verlangt eine Wegwerf-DB (lokaler Host, Port ≠ 27017, nicht der DB-Name aus .env).
TEST_MONGODB_URI=mongodb://127.0.0.1:27099/<wegwerf_db> node test-<name>.js

# Typprüfung - der RICHTIGE Befehl:
cd client && npx tsc -p tsconfig.app.json --noEmit
```

- **33 Testdateien, 1.051 Zusicherungen, 0 Fehler** (23 neue und 10 bestehende Tests).
- Alle Tests liefen hinter einer Netzsperre (`--require netguard.js`), die jede Verbindung außer
  localhost blockiert und protokolliert: **0 Versuche**.
- **Sicherheitsnetz in jedem neuen Test:** `isUnsafeTestUri()` vor `dropDatabase()`. Die frühere
  Prüfung verglich nur den Text `localhost:27017` und hätte `mongodb://localhost/FixitHub`
  durchgelassen, also die Entwicklungsdatenbank gelöscht.
- **Nie ausführen**, sie verbinden sich mit der echten DB aus `.env`: `test-api-direct.js`,
  `test-dhl-sandbox-connection.js`, `test-tracking-data.js`, `test-device-change.js`,
  `test-admin-bookings-read-flow*.js`.
- 9 ältere Tests schlagen fehl; bei **identischem** HEAD-Stand scheitern sie gleich (brauchen
  laufenden Server bzw. echte DB). Keine Regression.

---

## 7. Vor dem Livegang — Pflicht

### 7.1 Frontend neu bauen und ausliefern
`client/dist` ist eingecheckt und stammt vom **15.09.2026**. Nachweis: Die am 22.09.
eingeführte Beschriftung „Preisübersicht" fehlt im Bundle. Das erklärt, warum Sophie Knöpfe
nicht sah, die im Code vorhanden waren, während der Server-Fehler (13,84 €) schon aktiv war.
**Bitte klären, welches Bundle der Testserver ausliefert.**

### 7.2 Fehlende npm-Pakete installieren
In `package.json` deklariert, lokal **nicht installiert**:

| Ordner | Fehlt | Folge |
|---|---|---|
| `server/` | `compression`, `node-cron`, `qrcode` | **Server startet nicht** (`node-cron` wird in `server.js` sofort geladen); Rechnungs-PDF ohne QR-Code |
| `client/` | `react-quill`, `@types/papaparse` | `npm run build` bricht ab (`react-quill` steht in `manualChunks`) |
| Root | `marked`, `puppeteer-core` | Handbuch-PDF-Skripte |

```bash
cd server && npm install
cd ../client && npm install
```

Vermutlich auch der Grund, warum `client/dist` seit dem 15.09. nicht neu gebaut wurde.

`invoicePdfService.js` lädt `qrcode` jetzt erst bei Bedarf: Fehlt das Paket, wird die Rechnung
**ohne QR-Code** erzeugt und archiviert (unveränderlich!). Deshalb muss es installiert sein.

### 7.3 Datenbank
```bash
node server/scripts/seedDocumentSequences.js            # Probelauf
node server/scripts/seedDocumentSequences.js --confirm  # Nummernkreis initialisieren
```
Neue Indizes (legt Mongoose mit `autoIndex` an, sonst `syncIndexes()`):
`Invoice.activeBillingKeys` (partial unique), `Invoice {isCreditNote, createdAt}`,
`DocumentSequence {documentType, year}` (unique). Neue Collection `invoicedocumentarchives`.

### 7.4 Konfiguration
- `GOOGLE_REVIEW_URL`: ohne sie **kein** QR-Code; es wird bewusst keine URL erfunden.
- `DUNNING_CRON_ENABLED=true` aktiviert den automatischen Mahnlauf (gleiche idempotente Logik
  wie der manuelle).
- `EMAIL_TEST_TRANSPORT=stream` **nur** für Tests; ohne diese Variable verschickt der Server
  echte Mails.

### 7.5 Sicherheit — unabhängig von diesem Paket
`SeedService.seedAll()` läuft bei **jedem Serverstart** und setzt das Passwort von
`admin@example.com` auf einen im Quellcode stehenden Wert zurück. Das ist als eigene Aufgabe
angelegt. Nach dem Fix das Admin-Passwort in allen Umgebungen ändern.

---

## 8. Altdaten — nichts wurde ausgeführt

| Skript | Zweck | Stand |
|---|---|---|
| `reportDoubleDiscountInvoices.js` | Rechnungen mit doppeltem Rabatt finden (nur lesend) | getestet gegen Fixture |
| `repairGrossNetInvoiceTotals.js` | A2-Altfehler (MwSt. doppelt), Probelauf-Standard | fasst festgeschriebene/versendete Belege nicht an |

Die gefundenen Rechnungen wurden an Kunden versendet. Eine Korrektur heißt **Storno +
Neuausstellung**, nicht stilles Umschreiben. Das ist eine kaufmännische Entscheidung.

---

## 9. Offene Entscheidungen

1. **Rundung bei exakt halben Cent:** Heute gilt überall die Warenkorb-Regel (15 % von 49,90 →
   7,48). Streng kaufmännisch (Spezifikation 2.3) wären es 7,49. Eine Umstellung ist eine Zeile
   in `CalculationHelper.percentOf` und wirkt dann auf Warenkorb, Auftrag und Rechnung zugleich.
2. **Altrechnungen mit doppeltem Rabatt** (Abschnitt 8): Storno + Neuausstellung?
3. **Altrechnungen A2** (`repairGrossNetInvoiceTotals.js`): weiterhin nicht ausgeführt.
4. **Zahlungsvorbehalt vor Versand:** Heute sperrt nur `requiresPaymentBeforeCompletion`.
   Empfehlung: Kennzeichen „Versand erst nach Zahlungseingang" je Kunde/Gruppe.
5. **DHL-Produkte:** V01PAK / V53WPAK / V54EPAK angeboten. Nur Inland → auf V01PAK reduzieren.
6. **Belegform beim Storno** (steuerliche Prüfung); **Nummernlücken** durch verlorene parallele
   Versuche dokumentieren (GoBD).
7. **Zahlungsziel** wird auf 1–14 Tage begrenzt, Kundengruppen erlauben bis 365.
8. **Lagerbestand:** Die Prüfung liest `product.stock`, das Schema heißt `stockCount`; sie hat
   also nie gegriffen.
9. **Zahlungsaufforderung:** eigene Vorlage „Zahlungsaufforderung" statt „Allgemeine
   Systemnachricht" empfohlen.

---

## 10. Bekannte Restrisiken (klein, bewusst nicht mehr angefasst)

Aus der letzten Prüfrunde, jeweils ohne Auswirkung auf den Normalfall:
- Mahnlauf: Schlägt das Nachlesen nach dem Versand fehl, wird die Stufe ohne erneute
  Saldo-Prüfung gesetzt (theoretisch bei einer Zahlung im selben Moment).
- Zurücknehmen eines Gutschrift-Entwurfs findet nur Nachfolgerechnungen **mit**
  `activeBillingKeys` (Altbestand ohne Feld nicht).
- `createInvoice` (nur Admin) übernimmt `isCreditNote`/`creditNoteOf` aus dem Request.
- Tracking-Nummern-Sperre ohne Fencing nach 60 s Blockade.
- Zeiterfassung (`/api/time-tracking`): Beim Verlassen des Auftrags erscheint in der
  Konsole „No matching document found". Die Zeiterfassung wurde **nicht** verändert; der Fehler
  besteht vorher schon.
- Viele Oberflächentexte im Auftragsdetail sind weiterhin englisch („Device Lock Information",
  „Water Damage" …). Vorher schon so, nicht Teil dieses Pakets.

---

## 11. Was NICHT geprüft ist

- **Kein echtes DHL-Label** (keine Zugangsdaten hinterlegt; bewusst keine kostenpflichtigen
  Labels). Payload und Richtung sind gegen die DHL-Dokumentation und per Mock geprüft.
- **Keine echte PayPal-Zahlung oder -Erstattung**, nur gemockt.
- **Keine echte E-Mail-Zustellung**, nur der Test-Transport.
- **Der Testserver**, auf dem Sophie testet: kein Zugriff. „Lokal verifiziert" ist nicht gleich
  „auf dem Testserver verifiziert".
- Im Browser geprüft: Anmeldung, Auftragsdetail (Preisübersicht, Schnellaktionen, Versand),
  Finanzübersicht, Rechnungsdetail, PDF-Download. Andere Masken nur über API- und Service-Tests.
