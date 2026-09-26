# Technischer Änderungsbericht

> **⚠ Überholt — Stand 22.09.2026.** Ersetzt durch
> [`TECHNISCHER_AENDERUNGSBERICHT_2026-09-26.md`](TECHNISCHER_AENDERUNGSBERICHT_2026-09-26.md). Dort steht in
> Abschnitt 1, was an diesem Bericht falsch war. Unter anderem prüfte der hier genannte Befehl
> `npx tsc --noEmit` keine einzige Datei, und die Rechnungserstellung zog den Gruppenrabatt nach
> dem 22.09. doppelt ab. Dieser Text bleibt zur Nachvollziehbarkeit unverändert stehen.

**Branch:** `adars` (Basis `60a301d`) · **Stand:** 22.09.2026
**Umfang:** 57 geänderte Dateien, 4 neue Dateien, ca. +8.600 / −1.900 Zeilen
**Status:** vollständig im Arbeitsbaum, **nicht committet**, nicht gemergt, nicht deployed

Fachliche Zuordnung zu den Testpunkten: [`ABNAHME_BERICHT_SOPHIE.md`](ABNAHME_BERICHT_SOPHIE.md).
Dieses Dokument beschreibt die technischen Entscheidungen und das, was beim Weiterarbeiten wichtig ist.

---

## 1. Vier Regeln, die jetzt gelten

Diese vier Punkte sind die Grundlage für fast alles andere. Wer sie verletzt, holt die alten Fehler zurück.

### 1.1 Geld ist BRUTTO-FIRST

Vorher existierten **zwei gegensätzliche Konventionen in derselben Datei**:

```js
// financialService.createInvoiceFromOrder — NETTO-FIRST (falsch: order.totalCost ist brutto)
const subtotal = items.reduce((s, i) => s + i.total, 0);
tax:   subtotal * taxRate,
total: subtotal + (subtotal * taxRate) - discount,      // 119,00 → 141,61

// financialService.syncOrderAndBookingValue — BRUTTO-FIRST (richtig)
mainInvoice.total    = round(newOrderValue);
mainInvoice.subtotal = round(mainInvoice.total / taxDivisor);
```

Dieselbe Rechnung war also je nach Codepfad 141,61 oder 119,00. Es gilt jetzt durchgängig:

```
Alle Katalog- und Positionspreise sind BRUTTO (inkl. MwSt.)
netTotal   = bruttoNachRabatt / (1 + taxRate/100)
taxTotal   = bruttoNachRabatt − netTotal          ← MwSt. wird HERAUSGERECHNET
grossTotal = netTotal + taxTotal
Der Rabatt wird GENAU EINMAL vom Brutto abgezogen, nie erneut vom Netto.
```

**Feldnamen bleiben, Bedeutung ist festgelegt:** `Invoice.total` = BRUTTO, `Invoice.subtotal` = NETTO,
`Invoice.tax` = herausgerechnete MwSt. Die Namen sind irreführend, aber zu viele Leser hängen daran —
umbenennen wäre ein eigenes Arbeitspaket.

> Die Spezifikation `RECHNUNGSERSTELLUNG_SPEZIFIKATION.md` widerspricht sich an dieser Stelle selbst:
> Zeile 35 definiert Netto als „nach Rabatt", Zeile 37 definiert Brutto als „Netto plus MwSt. **minus Rabatt**" —
> der Rabatt wird dort zweimal abgezogen. Implementiert ist die in sich stimmige Lesart (Zeilen 66/68).
> **Die Spezifikation sollte entsprechend korrigiert werden**, sonst baut der nächste Durchgang den Fehler nach.

### 1.2 `Invoice` ist die einzige Instanz, die Summen bestimmt

`server/models/Invoice.js`, Hook auf **`pre('validate')`** — bewusst nicht `pre('save')`:
`subtotal` und `total` sind `required`, und Mongoose validiert **vor** den Save-Hooks. Ein `pre('save')`-Hook
kann daher nicht dafür sorgen, dass Aufrufer die Felder weglassen dürfen.

Zwei Modi:

| Fall | Verhalten |
|---|---|
| Aufrufer liefert **kein** `total` | `total = Σ(items brutto) − discount`, daraus `subtotal` und `tax` |
| Aufrufer liefert `total` | gilt als **autoritatives Brutto**; `subtotal`/`tax` werden **immer** daraus neu abgeleitet, mitgelieferte Werte werden ignoriert |

Modus 2 ist notwendig, weil `syncOrderAndBookingValue` eine buchungsweite Bruttosumme setzt, die bei einem
Buchungsrabatt bewusst **nicht** der Positionssumme entspricht. Ein bedingungsloses Neuberechnen aus den
Positionen würde diesen Wert überschreiben.

**Zwei Schutzmechanismen im selben Hook:**

```js
const MONETARY_PATHS = ['items','total','subtotal','tax','discount','taxRate','isReverseCharge'];
// Bestandsbeleg ohne betragsrelevante Änderung → gar keine Neuberechnung
if (!this.isNew && !monetaryTouched) return next();
// lockedAt gesetzt + betragsrelevante Änderung → lauter Fehler statt stiller Mutation
```

Ohne den ersten Schutz schrieb **jeder** Speichervorgang (Statuswechsel, Mahnstufe, `paidAmount`) die Beträge
neu — bei Altbeständen mit Netto-First-Zahlen bedeutete das stille Datenkorruption.

> **⚠ Nicht wieder einbauen:** In einem Zwischenstand gab es eine „Selbstheilung", die den Steuersatz aus
> `(tax / subtotal) × 100` zurückrechnete, wenn der mitgelieferte Dreiklang nicht zum deklarierten Satz passte.
> Das ist **falsch**: Die Beträge sind bereits auf zwei Dezimalstellen gerundet, deshalb ergibt die Rückrechnung
> bei kleinen Summen 18,97–18,99 % statt 19 % — und die PDF wies dann einen nicht existierenden Steuersatz aus.
> Der Steuersatz kommt **ausschließlich** aus `taxRate`; Aufrufer müssen den tatsächlich gerechneten Satz
> setzen. `bookingService` wurde entsprechend korrigiert (rechnete mit dem konfigurierten Satz, schrieb aber
> hart `19`).

### 1.3 Belegnummern aus `DocumentSequence`

`server/models/DocumentSequence.js` — atomarer Zähler, `findOneAndUpdate` mit `$inc` und `upsert`, eindeutiger
Index auf `(documentType, year)`, Retry bei `E11000`.

| Belegart | `documentType` | Format |
|---|---|---|
| Rechnung | `invoice` | `INV-JJJJ-NNNN` |
| Gutschrift | `credit_note` | `INV-CN-JJJJ-NNNN` |

Zwei getrennte Zähler, die sich gegenseitig nicht verbrauchen. Ersetzt `countDocuments() + 1` (nicht atomar,
nicht jahresbezogen, bei Löschungen wiederverwendend) und den Fallback `INV-${Date.now()}` — **bei einem Fehler
schlägt das Speichern jetzt fehl, statt eine erfundene Nummer zu vergeben.**

`numberPrefix` ist **nicht mehr vom Aufrufer setzbar** (kam vorher aus `financialProfile.invoicePrefix` der
Kundengruppe → `VIP--2026-0008`). Das Feld bleibt im Schema für Altdokumente, neue Dokumente setzen es nicht.
`invoiceNumber` ist jetzt `immutable: true`. **Bestehende Belege werden nicht umnummeriert.**

### 1.4 Zahlungsstand ≠ Belegstatus

Erfüllungs- und Zahlungszustand lagen in einem Enum, das unverändert in `Booking.paymentStatus` kopiert wurde —
deshalb verdeckte „versendet" den Zustand „teilbezahlt". Beides ist getrennt.

`server/services/paymentService.js` war ein 15-Zeilen-Stub und ist jetzt der gemeinsame Rechenkern:

- `buildBookingPaymentMatch()` — **eine** Zuordnungsregel (`bookingId` ODER `invoiceId` ODER `orderId`), genutzt
  von Detail- **und** Listenpfad. Vorher rechneten beide unterschiedlich, was genau den Effekt „die 300 EUR sind
  in der Übersicht nicht erkennbar" erzeugte.
- `computeInvoiceBalance()` / `computeBookingBalance()` / `getBookingBalancesBulk()`
- `getAllocatedTotalsByInvoice()` — Teilerstattungen werden über die **vollständige** Menge der Zuordnungen
  einer Zahlung gekappt, nicht nur über die gerade abgefragten Rechnungen. Sonst hing der ausgewiesene
  Zahlbetrag einer Rechnung davon ab, welche anderen Rechnungen man mitabgefragt hat.
- `allocateAtomically()` — optimistisches Sperren auf `Payment.allocatedAmount`, Werte werden **innerhalb** des
  atomaren Schritts frisch aus der DB gelesen. Der Aufrufer-Zustand wird nicht vertraut, weil
  `autoAllocateUnallocatedPayments` das Feld im Speicher überschreibt.

```
Offener Betrag = max(0, Brutto − wirksam zugeordnete abgeschlossene Zahlungen)
Überzahlung    = getrennt geführt, nie als negativer Saldo
Verteilung     = FIFO (Fälligkeit, dann Anlagedatum, dann Belegnummer);
                 jede Rechnung höchstens ihren offenen Betrag; Überhang bleibt unzugeordnet
```

**Statusschutz:** Nur Belege in `sent | viewed | partially_paid | overdue` dürfen durch eine Zahlung bewegt
werden. `draft` und `pending_approval` bekommen `paidAmount`, der **Belegstatus bleibt stehen** — sonst
erreicht ein nicht freigegebener Beleg an der Freigabe vorbei den Status `paid`. Es gibt drei Schreiber
(`allocateAtomically`, `recalculateInvoicePaidAmounts`, `syncOrderAndBookingValue`), alle drei nutzen dieselbe
Konstante.

---

## 2. Neue Dateien

| Datei | Zweck |
|---|---|
| `server/models/DocumentSequence.js` | atomarer Nummernkreis, siehe 1.3 |
| `server/models/PaymentRequest.js` | Historie der Zahlungsaufforderungen (Buchung/Rechnung, Betrag, Kanal, Empfänger, Zeit, Status, Fehler) |
| `server/scripts/seedDocumentSequences.js` | initialisiert die Zähler aus dem Bestand — **vor Livegang nötig** |
| `server/scripts/repairGrossNetInvoiceTotals.js` | repariert die durch A2 beschädigten Rechnungen — **bewusst nicht ausgeführt** |

Zu `PaymentRequest.status`: `accepted_by_provider` heißt, der Mailserver hat die Nachricht **angenommen**. Das
ist **keine Zustellbestätigung** und darf in der UI auch nicht so dargestellt werden.

---

## 3. Skripte vor dem Livegang

Beide laufen standardmäßig als **Probelauf** und schreiben nur mit `--confirm`.

### 3.1 Nummernkreis initialisieren — erforderlich

```bash
node server/scripts/seedDocumentSequences.js            # Probelauf
node server/scripts/seedDocumentSequences.js --confirm  # schreibt
```

Setzt jeden Zähler auf den höchsten bereits vergebenen Wert pro `(documentType, year)`. Berücksichtigt, dass
Rechnungen und Gutschriften historisch **denselben** Zähler geteilt haben, überspringt die
`INV-<epoch>`-Fallback-Nummern und bricht ab, wenn doppelte Belegnummern existieren.

**Ohne diesen Lauf können neue Nummern mit bestehenden kollidieren.**

### 3.2 Beschädigte Rechnungen reparieren — kaufmännische Entscheidung

```bash
node server/scripts/repairGrossNetInvoiceTotals.js            # Probelauf, empfohlen
node server/scripts/repairGrossNetInvoiceTotals.js --confirm  # schreibt
```

Erkennungsmuster:

```
round(subtotal × (1 + taxRate/100) − discount) === round(total)
  UND round(Σ items.total) === round(subtotal)
```

Der zweite Teil ist notwendig: Die naive Variante ohne `− discount` übersieht **jede rabattierte** Rechnung.
Belege mit `lockedAt` werden nicht angefasst.

> **Vor dem Ausführen klären:** Betroffene Rechnungen weisen eine zu hohe MwSt. aus (bei 119,00 EUR Auftragswert
> 22,61 statt 19,00) und wurden unter ausgewiesener USt-IdNr. möglicherweise bereits versendet. Ob eine stille
> Korrektur zulässig ist oder förmliche Gutschriften nötig sind, ist eine **steuerliche Entscheidung**, keine
> technische. Der Probelauf zeigt den Umfang, ohne etwas zu verändern.

### 3.3 Index

`Invoice` hat einen neuen Index `{ isCreditNote: 1, createdAt: -1 }` für die getrennten Listen. Bei
deaktiviertem `autoIndex` einmalig `Invoice.syncIndexes()` bzw. `createIndex` ausführen.

---

## 4. Wichtigste Änderungen nach Bereich

### Finanzen (Server)
- `financialService.js` (+1.712) — Netto-First-Arithmetik entfernt; `finalizeInvoiceCreation()` als gemeinsamer
  Abschluss aller vier Erstellungspfade; `getCreditedTotal()` trennt Erstattungsgutschriften
  (`partial_refund`) von Wertminderungen, die vorher in einen Topf liefen; `composePaymentTerms()` ohne Skonto;
  Positionstexte tragen echte Leistungsnamen statt `"Service"` bzw. einer ObjectId; `correctionType` wird
  serverseitig validiert, statt aus `req.body` durchgereicht zu werden.
- `invoicePdfService.js` — **`slice(0, 3)` entfernt**: Die PDF druckte nur drei Positionen bei voller
  Gesamtsumme. Das fiel vorher nicht auf, weil der Auftragspfad eine Sammelposition erzeugte; seit der
  C5-Korrektur entsteht eine Position je Leistung. Jetzt Seitenumbruch mit wiederholtem Tabellenkopf.
  Außerdem: Der Rabatt wurde ein **zweites Mal** vom Netto abgezogen (`subtotal − discount`), wodurch ein
  erfundener Steuersatz wie „24,03 %" gedruckt wurde.
- `paymentService.js` (+576) — siehe 1.4.
- `bookingPaymentService.js`, `bookingService.js` — gemeinsame Saldoberechnung, korrekter Steuersatz.

### Geräteinspektion
- `Order.js` — einmalig geschriebener Schnappschuss des ursprünglich gebuchten Geräts. Beide Überschreibpfade
  (`deviceChangeService` und der zweite in `orderService`/`adminOrderRoutes`) respektieren ihn.
- `deviceInspectionService.js` — ein bestehender Lock gewinnt immer gegen `Order.reportedDevice`;
  Gerätetyp-Normalisierung (vorher scheiterte jeder Typ außerhalb einer kurzen fest verdrahteten Liste, während
  `Order.deviceType` freier Text aus dem pflegbaren Katalog ist — schon „Smartphones" brach Schritt 2 ab).
- `DeviceInspectionForm.tsx` — **der stale lokale Entwurf wurde beim Speichern zurückgeschrieben** und hat das
  korrigierte Gerät überschrieben. Das war die eigentliche Ursache dafür, dass die PDF auch bei korrekten Daten
  falsch war. Reines Rendering zu reparieren hätte nicht gereicht.
- `api.ts` — Fehler wurden als rohe `AxiosResponse` abgelehnt, während die Wrapper `error.response.data.error`
  lasen → `new Error(undefined).message === ""` → **leerer „Fehler"-Toast**. Deshalb war nie erkennbar, woran
  Schritt 2 scheiterte. Achtung beim Weiterarbeiten: `api.ts` ist global, und die Korrektur berührt den bislang
  unerreichbaren 401/403-Refresh-Pfad.

### Versand
- `dhlService.js` (+641) — Payload-Validierung vor dem DHL-Aufruf mit deutschen Feldmeldungen;
  Straße/Hausnummer-Trennung (explizit gelieferte Hausnummer gewinnt); eine gemeinsame Produktliste
  (`P` und `V01PAK` waren dasselbe Produkt, in einem Dialog war das Feld wirkungslos);
  **Operator-Präzedenzfehler in `getParcelDEConfig`**, durch den eine Produktivkonfiguration still auf der
  Sandbox landete.
- `dhlReturnsService.js` — **`booking.status = 'in-transit'` lag außerhalb des Enums**, `booking.save()` warf
  danach. Das Label war bei DHL bereits erzeugt → „Label kommt, aber Fehlermeldung". Sehr wahrscheinlich
  Sophies G2. Kein erfundener Hausnummern-Fallback `'1'` mehr.

### Oberfläche
- `OrderDetails.tsx` (+779) — `OrderService.buildOrderPricingSummary` ist die einzige Quelle der Preisaufstellung;
  der Client rechnet nicht mehr selbst (zwei Kopien einer Geldformel driften garantiert auseinander).
- `FinancialManagement.tsx` (+1.169) — getrennte Gutschriften-Route, PDF-Download, serverseitig gefilterte und
  seitenweise Listen, Skonto entfernt, Gutschrift-Vorschau nach derselben Formel wie der Server.
- `invoices.ts` / `invoicePrint.ts` — `transformResponse: undefined` **deaktiviert den globalen JSON-Transform
  nicht**: In axios 1.18 greift beim Merge `defaultToConfig2` auf `config1` zurück, wenn `config2` undefined
  ist. Der PDF-Download konnte deshalb nie funktionieren. Falls irgendwo sonst dieses Idiom auftaucht: ebenfalls
  kaputt.

---

## 5. Was NICHT gemacht wurde

- **Kein Commit, kein Merge, kein Push, kein Deploy.** Alles liegt im Arbeitsbaum.
- **Keine Migration ausgeführt.** Beide Skripte sind opt-in.
- **Keine Bestandsdaten verändert.** Belege werden nicht umnummeriert, historische Dokumente nicht umgeschrieben.
- **G3 Packstation:** Postfiliale/Paketshop und Gast-Checkout sind **neue Funktionalität** und bewusst nicht
  umgesetzt. Der eigentliche Fehler (Packstation-Adresse kontaminierte das Einsendelabel) ist behoben.
- **B6 E-Mail-Vorlage:** Die Vorlage `payment_request` und `defaultNotificationTemplates.js` wurden nicht
  angefasst. Der Versand läuft über eine Ersatzvorlage, der im Dialog verfasste Text erreicht den Kunden nicht.
  Das wird als `noteDelivered: false` gespeichert und angezeigt.
  → **Nebenbefund:** Der komplette Sende-Composer-Text wird beim Versand verworfen, weil die Vorlage keinen
  `{{customMessage}}`-Platzhalter hat. Betrifft nicht nur die Zahlungsaufforderung. **Eigenes Ticket wert.**
- **`Order.originalGrossAmount`** wird weiterhin aus dem bereits rabattierten `totalCost` gesetzt, wodurch der
  Listenpreis verloren geht und `dealerDiscountPercent`/`dealerDiscountAmount` auf 0 bleiben. Die Anzeige ist
  korrekt, das Datenmodell an dieser Stelle noch nicht. Braucht eine Migrationsüberlegung für Bestandsaufträge.
- **Richtungserkennung im Versandverlauf** wird aus dem Timeline-Text geparst statt aus einem eigenen Feld.
  Funktioniert, ist aber nicht die saubere Lösung.

---

## 6. Prüfstand

```bash
# Repo-Suites (alle exit 0)
node test-billing-domain-model.js
node test-full-financial-integration.js
node test-booking-invoice-multi-order.js
node test-order-discount-allocation.js
node test-booking-pricing.js

# Typprüfung: vollständig fehlerfrei
cd client && npx tsc --noEmit
```

**Abnahmeprüfung (14 Zusicherungen, alle grün):** Rabatt genau einmal abgezogen · Netto + MwSt. = Brutto ·
Steuersatz exakt 19 % · keine doppelte MwSt. · Format `INV-JJJJ-NNNN` · 30 parallele Rechnungen → 30 eindeutige
Nummern · eigener Gutschriftenkreis · Gutschrift spiegelt die Rechnung · MwSt. ≠ 0 · Ursprungsrechnung vermerkt ·
Beträge nach reinem Statuswechsel unverändert.

**Rahmenbedingungen:** Alles lief gegen eine Wegwerf-MongoDB auf Port **27099**. Die Entwicklungsdatenbank auf
27017 wurde **nie** kontaktiert. Keine echten PayPal-, DHL- oder SMTP-Aufrufe.

### Was der Prüfstand nicht abdeckt

- **Keine Oberflächentests.** Das Projekt hat keinen Client-Test-Runner (kein vitest/jest). Alles rein Visuelle
  ist unverifiziert: die neue Gutschriften-Ansicht, ob der PDF-Knopf tatsächlich eine Datei speichert, die
  Darstellung der Zahlungsaufforderungs-Historie.
- **Kein laufender Server.** `test-admin-bookings-read-flow.js` braucht einen Server auf `:3000` und wurde nicht
  ausgeführt.
- **Kein echtes DHL-Label, keine echte Zahlung.**

> **⚠ Warnung für Automatisierung:** `client/dist` ist **im Git eingecheckt** (245 Dateien). Ein Build-Schritt
> hat während der Arbeit 188 davon gelöscht, ohne Ersatz zu erzeugen; das musste mit
> `git checkout -- client/dist` zurückgeholt werden. Für Typprüfungen ausschließlich `npx tsc --noEmit`
> verwenden, **kein** `vite build` / `npm run build`.

---

## 7. Empfohlene Reihenfolge

1. `ABNAHME_BERICHT_SOPHIE.md` lesen, Abschnitt 4 (die zwei Entscheidungen) klären.
2. Diesen Bericht, Abschnitt 1 lesen — vor allem die vier Regeln und die **⚠**-Hinweise.
3. Diff durchgehen, Schwerpunkt `financialService.js`, `Invoice.js`, `paymentService.js`.
4. `seedDocumentSequences.js` als Probelauf gegen eine Kopie der Produktivdaten laufen lassen.
5. `repairGrossNetInvoiceTotals.js` als Probelauf → Umfang mit der Buchhaltung besprechen.
6. Manuell im Browser gegentesten, was nicht automatisiert geprüft ist (Abschnitt 6).
7. Von Sophie den Netzwerk-Mitschnitt zu Inspektionsschritt 4 anfordern (E3).
8. Offene Tickets anlegen: Sende-Composer-Text, `Order.originalGrossAmount`, G3-Ausbau,
   Korrektur der widersprüchlichen Stelle in `RECHNUNGSERSTELLUNG_SPEZIFIKATION.md`.
