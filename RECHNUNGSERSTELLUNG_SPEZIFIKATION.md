# Spezifikation: Rechnungserstellung

## 1. Ziel und Geltungsbereich

Diese Spezifikation definiert die fachlichen und technischen Regeln für die Erstellung, PDF-Generierung, Speicherung, Zustellung und spätere Nachvollziehbarkeit von Rechnungen in FixitHub.

Die Rechnung kann aus einer Buchung oder aus einem Auftrag erzeugt werden. Eine Rechnung ist nach der Finalisierung ein unveränderliches Dokument. Korrekturen erfolgen ausschließlich über eine neue Rechnung bzw. Gutschrift, niemals durch Überschreiben der ursprünglichen Rechnung.

Die Spezifikation nutzt die vorhandenen Strukturen:

| Bestehende Struktur | Verantwortung |
|---|---|
| `Invoice` | Rechnungsdaten, Status, Summen und Verknüpfungen |
| `Payment` / `PaymentAllocation` | Zahlungen und Zuordnung zu Rechnungen |
| `BookingService` | Buchungsbezogene Rechnungserstellung |
| `FinancialService` | Administrative Erstellung und Versand |
| `InvoicePdfService` | PDF-Vorlage und Generierung |
| `EmailService` | E-Mail-Versand mit PDF-Anhang |
| `GET /api/invoices/:id/pdf` | PDF-Download |

## 2. Fachliches Rechnungsmodell

### 2.1 Pflichtfelder

| Feld | Regel |
|---|---|
| Rechnungsnummer | Vom System vergebener, eigener Nummernkreis; eindeutig und unveränderbar |
| Rechnungsdatum | Datum der Rechnung; bei dieser Anwendung zugleich Leistungsdatum |
| Fälligkeit | Rechnungsdatum plus Zahlungsziel oder explizit gewähltes Fälligkeitsdatum |
| Buchungsnummer | Pflicht bei buchungsbezogener Rechnung |
| Auftragsnummer | Pflicht bei auftragsbezogener Rechnung; bei einer Buchung zusätzlich je referenziertem Auftrag ausweisen |
| Kundennummer | Aus dem Kundenstammsatz als Snapshot übernehmen |
| Rechnungsanschrift | Zum Erstellungszeitpunkt auflösen und als Snapshot speichern |
| Zahlart | Die für die Rechnung vereinbarte Zahlart; bei mehreren Zahlungen zusätzlich jede tatsächliche Zahlart im Zahlungsverlauf |
| Nettobetrag | Steuerpflichtige Summe vor MwSt. und nach Rabatt |
| MwSt. | Separat ausgewiesen, standardmäßig 19 % |
| Bruttobetrag | Netto plus MwSt. minus Rabatt gemäß Berechnungsmodell |
| Offener Bruttobetrag | Maximal `0,00 EUR`; Brutto minus berücksichtigte Zahlungen |
| Rabatt | Nur ausweisen, wenn größer als `0,00 EUR`; Betrag und, falls vorhanden, Prozentsatz |
| Positionen | Jede gebuchte Leistung und jeder gebuchte Artikel als eigene Position |
| Gerätekennung | Bei Reparaturen IMEI und/oder Seriennummer aus dem Auftrag |
| Zusatzhinweis | Manuelles Kommentarfeld; vor Finalisierung editierbar |
| Zahlungsverlauf | Alle geleisteten Zahlungen mit Zahlart, Datum und Betrag |

### 2.2 Positionen

Jede Position enthält mindestens:

- Positionstyp: `service`, `addon`, `product` oder `fee`
- Bezeichnung und Beschreibung
- Menge
- Einzelpreis netto und brutto
- Positionssumme netto und brutto
- MwSt.-Satz
- Referenz auf Service, Artikel, Auftrag oder Buchung, sofern vorhanden

Rabatte werden nicht als negative Serviceposition modelliert. Der Rabatt wird in `discount` geführt und in der Summenbox separat ausgewiesen. Bestehende historische Rechnungen mit `type: 'discount'` bleiben lesbar.

Bei einer Reparatur wird die Gerätekennung aus dem referenzierten Auftrag (`Order.imei`, `Order.serialNumber`) in den Rechnungs-Snapshot übernommen. Die PDF muss sie bei mindestens einer Reparaturposition oder im Kopfbereich ausweisen.

### 2.3 Summen und Steuer

- Alle Geldbeträge werden in EUR mit zwei Dezimalstellen gespeichert.
- Berechnung erfolgt in Cent-Genauigkeit; Rundung kaufmännisch auf zwei Dezimalstellen.
- Standardsteuersatz ist 19 %. Der verwendete Satz wird je Position und auf Rechnungsebene gespeichert.
- `netTotal` ist die Summe der Nettopositionen abzüglich Rabatt.
- `taxTotal` ist die Summe der je Position berechneten Steuerbeträge.
- `grossTotal` ist `netTotal + taxTotal`.
- Der offene Betrag ist `max(0, grossTotal - anrechenbare abgeschlossene Zahlungen)`. Überzahlungen werden nicht negativ ausgewiesen.
- `paidAmount` darf den Bruttobetrag nicht erhöhen; eine Überzahlung bleibt als nicht zugeordneter Betrag in `Payment`/`PaymentAllocation` nachvollziehbar.

## 3. Nummernkreis und Unveränderlichkeit

### 3.1 Nummernkreis

Der Nummernkreis ist pro Dokumenttyp und Jahr fortlaufend, z. B. `INV-2026-0001`. Gutschriften erhalten einen eigenen Präfix, z. B. `INV-CN-2026-0001`.

Die aktuelle Vergabe über `countDocuments()` ist nicht ausreichend, weil Löschungen und parallele Requests doppelte Nummern erzeugen können. Dafür ist eine atomare Counter-Struktur (`DocumentSequence`) mit eindeutigem Index auf `(documentType, year)` zu verwenden. Eine einmal vergebene Nummer wird nie wiederverwendet.

### 3.2 Frozen-Rechnung

Eine Rechnung gilt als finalisiert, sobald sie gespeichert und die PDF-Erstellung erfolgreich abgeschlossen ist. Bei der Finalisierung werden unveränderlich gespeichert:

- Rechnungsnummer, Rechnungs- und Leistungsdatum, Fälligkeit
- Kunden-, Buchungs- und Auftragsreferenzen
- Kundennummer, Name, E-Mail und Rechnungsanschrift
- alle Positionen inklusive Preise, Steuer und Gerätekennung
- Rabatt, Netto-, Steuer- und Bruttosumme
- Zahlart und der zu diesem Zeitpunkt bekannte Zahlungsverlauf
- Kommentar, QR-Zieladresse und Footer-/Unternehmensdaten
- PDF-Speicherpfad, Dateiname, Erstellungszeitpunkt und SHA-256-Hash

Nach `lockedAt` sind fachliche Daten sowie Positionen und Summen nicht mehr per Update veränderbar. Auch `findOneAndUpdate` und vergleichbare Schreibpfade müssen eine Änderung bei `lockedAt` ablehnen. Erlaubt bleiben ausschließlich technische Zustandsfelder wie Versandstatus, Downloadzeitpunkt und Zahlungszuordnungen; diese dürfen den gespeicherten Rechnungsbetrag nicht verändern.

Eine inhaltliche Änderung erzeugt eine neue Rechnung oder eine Gutschrift mit Referenz `creditNoteOf`.

## 4. Rechnungsvorlage / PDF

### 4.1 Kopfbereich

Das PDF enthält:

1. Titel `Rechnung` bzw. `Gutschrift`
2. Rechnungsnummer
3. Rechnungsdatum und Leistungsdatum
4. Fälligkeit
5. Buchungsnummer und Auftragsnummer(n)
6. Kundennummer
7. vollständige Rechnungsanschrift
8. vereinbarte Zahlart
9. bei Reparaturen IMEI/Seriennummer

### 4.2 Positionstabelle

Alle Positionen werden ohne Abschneiden ausgegeben. Bei vielen Positionen wird automatisch auf Folgeseiten umgebrochen. Die Tabelle enthält mindestens Position, Menge, Bezeichnung, Einzelpreis netto, MwSt.-Satz, Positionssumme netto und Positionssumme brutto.

### 4.3 Summen- und Zahlungsteil

Auszuweisen sind:

- Rabatt, sofern vorhanden
- Nettobetrag
- `zzgl. 19 % MwSt.` und Steuerbetrag
- Bruttobetrag
- offener Betrag brutto, sofern größer als `0,00 EUR`
- vollständiger Zahlungsverlauf mit Zahlart, Datum und Betrag
- manuelles Kommentarfeld, sofern befüllt

Der Zahlungsverlauf wird aus allen zugeordneten `Payment`-Datensätzen gelesen, nicht nur aus dem zuletzt erfassten Datensatz. Maßgeblich ist das Zahlungsdatum (`paymentDate`), bei fehlendem Wert ersatzweise `processedAt` bzw. `createdAt`.

### 4.4 QR-Code und Footer

Der QR-Code enthält die konfigurierbare URL aus `GOOGLE_REVIEW_URL`. Fehlt die Konfiguration, darf nur die im System definierte Fallback-URL verwendet werden.

Der QR-Code wird mit folgendem Text ausgegeben:

> Wenn Sie mit der Reparatur zufrieden waren, bewerten Sie uns gern. Wir freuen uns auf Ihr Feedback!

Der Footer enthält exakt:

> Online Point GmbH, Kurfürstenstraße 106, 10787 Berlin, Tel. 030 403 688 951, kontakt@onlinepoint-gmbh.de, Commerzbank AG IBAN DE95100400000501905400 BIC COBADEFFXXX, Amtsgericht Charlottenburg HRB 136735 B, GF Julian Szymansky, USt-IdNr. DE318981969

Der Footer wird aus einer zentralen Konfiguration gespeist, damit Vorlage und E-Mail-/Exportfunktionen dieselben Unternehmensdaten verwenden.

## 5. Erstellungsprozess

### 5.1 Eingabe

Die Erstellung akzeptiert genau einen fachlichen Bezug:

- `bookingId` für die Buchungsrechnung, inklusive ausgewählter Aufträge/Positionen, oder
- `orderId` für die Auftragsrechnung.

Eine Rechnung ohne `bookingId` und ohne `orderId` ist unzulässig. Bei einer Buchung werden die zugehörigen Aufträge, Services, Artikel, Gerätekennungen und der Kundenstammsatz zum Erstellungszeitpunkt geladen.

### 5.2 Ablauf

1. Berechtigung des aufrufenden Admin-/Staff-Prozesses prüfen.
2. Bezug auf Buchung oder Auftrag laden und Konsistenz prüfen.
3. Kundendaten und Rechnungsanschrift auflösen.
4. Alle Services und Artikel zu einzelnen Invoice-Positionen normalisieren.
5. Rabatt, Netto, MwSt. und Brutto mit dem vorhandenen `CalculationHelper` berechnen.
6. Eindeutige Rechnungsnummer aus dem atomaren Nummernkreis reservieren.
7. Rechnung mit Status `draft` anlegen.
8. Zahlungsverlauf und Gerätekennungen als Snapshot übernehmen.
9. PDF mit `InvoicePdfService` erzeugen.
10. PDF unter `server/uploads/invoices/` mit nicht erratbarem Dateinamen speichern und Hash persistieren.
11. Rechnung atomar auf `sent` bzw. `finalized` setzen und `lockedAt` setzen.
12. PDF zum Download bereitstellen.
13. E-Mail mit PDF-Anhang automatisch an die Rechnungs-E-Mail senden.
14. Versandstatus und Fehler separat protokollieren; ein späterer E-Mail-Fehler darf die bereits finalisierte Rechnung nicht verändern.

Die PDF-Datei wird immer aus dem Frozen-Snapshot erzeugt. Nach `lockedAt` darf der Download nicht erneut volatile Kunden-, Auftrags- oder Zahlungsdaten in das Dokument mischen.

### 5.3 Wiederholung und Fehler

- Wiederholte Requests mit derselben Idempotency-ID dürfen höchstens eine Rechnung erzeugen.
- Existiert bereits eine nicht stornierte Rechnung für denselben vollständigen Buchungs-/Auftragsbezug, wird keine zweite Rechnung stillschweigend angelegt.
- Schlägt PDF-Erstellung oder Speicherung fehl, bleibt die Rechnung nicht finalisiert und darf wiederholt werden.
- Schlägt nur der Mailversand fehl, bleibt die Rechnung finalisiert; ein erneuter Versand erfolgt über den vorhandenen Send-Endpunkt.

## 6. Validierungsregeln

### 6.1 Eingabevalidierung

- Genau einer der Bezüge `bookingId` oder `orderId` muss gesetzt sein; bei einer Buchung sind mehrere Aufträge erlaubt.
- Kundennummer, Rechnungsanschrift, Rechnungs-E-Mail, Rechnungsdatum, Leistungsdatum und Fälligkeit müssen vorhanden sein.
- Die E-Mail-Adresse muss syntaktisch gültig sein.
- Das Leistungsdatum darf nicht nach dem Rechnungsdatum liegen.
- Die Fälligkeit darf nicht vor dem Rechnungsdatum liegen.
- Mindestens eine Position ist erforderlich.
- Menge muss größer als `0` sein; Preise und Summen müssen endlich und nicht negativ sein.
- Rabatt darf weder die steuerpflichtige Zwischensumme noch den Bruttobetrag unterschreiten.
- Der MwSt.-Satz muss einer konfigurierten Steuerregel entsprechen; Standard ist 19 %.
- `total`, `subtotal`, `tax`, `discount` und Positionssummen werden serverseitig berechnet. Clientwerte sind nur Eingabewerte und nicht vertrauenswürdig.
- Kommentar maximal 2.000 Zeichen; Steuer-/HTML- und Steuerzeichen werden neutralisiert.
- Zahlarten müssen aus der bestehenden Payment-Enum stammen.

### 6.2 PDF- und Finalisierungsprüfung

Vor `lockedAt` müssen geprüft werden:

- Rechnungsnummer ist eindeutig.
- alle Pflichtfelder sind im Snapshot vorhanden.
- die Summe der Positionen entspricht den gespeicherten Summen mit maximal `0,01 EUR` Rundungstoleranz.
- Footer-Daten und QR-Zieladresse sind verfügbar.
- PDF ist nicht leer, hat den Content-Type `application/pdf` und wird erfolgreich gespeichert.
- gespeicherter SHA-256-Hash entspricht dem PDF-Inhalt.

## 7. API- und Statusvertrag

Bestehende Endpunkte bleiben kompatibel:

- `POST /api/admin/financial/invoices`: Rechnung erstellen/finalisieren
- `POST /api/admin/financial/invoices/:id/send`: erneuter Versand mit optionaler Nachricht
- `GET /api/invoices/:id/pdf`: PDF-Download
- `GET /api/invoices/:id`: Rechnungsdaten und Zahlungsverlauf
- `GET /api/bookings/:id/payments`: Buchungsüberblick und Zahlungen

Der Erstellungs-Response muss mindestens `invoice`, `invoiceNumber`, `status`, `lockedAt`, `pdfAvailable` und `emailStatus` liefern. Fehler werden mit HTTP 400 bei Validierungsfehlern, 403 bei fehlender Berechtigung, 404 bei unbekanntem Bezug und 409 bei Duplikat/Idempotenzkonflikt beantwortet.

Empfohlene Statuswerte:

`draft -> finalized -> sent -> viewed -> partially_paid -> paid`; zusätzlich `overdue`, `cancelled`, `credited`.

`cancelled` und `credited` sind keine Löschung. Die Originalrechnung und ihre PDF bleiben abrufbar.

## 8. Abnahmekriterien

1. Eine Buchungsrechnung enthält sämtliche Services und Artikel der ausgewählten Aufträge als getrennte Positionen.
2. Eine Auftragsrechnung enthält mindestens die Auftragsnummer und bei einer Reparatur die vorhandene IMEI/Seriennummer.
3. PDF und gespeicherter Rechnungsdatensatz zeigen dieselben Netto-, MwSt.-, Brutto- und offenen Beträge.
4. Jede vorhandene Zahlung erscheint mit Betrag, Zahlart und Datum im PDF.
5. Die Rechnungsnummer bleibt auch bei paralleler Erstellung eindeutig.
6. Nach Finalisierung schlagen Änderungen an Positionen, Adress-Snapshot und Summen fehl.
7. Der PDF-Download liefert exakt das gespeicherte, gehashte Dokument.
8. Der Kunde erhält automatisch eine E-Mail mit dem PDF; ein Mailfehler macht die Rechnung nicht veränderbar.
9. Der QR-Code verwendet `GOOGLE_REVIEW_URL` und enthält den vorgegebenen Bewertungstext.
10. Korrekturen sind nur über Gutschrift oder neue Rechnung mit Referenz zur Originalrechnung möglich.

## 9. Umsetzungsreihenfolge

1. `DocumentSequence` und atomare Rechnungsnummern einführen.
2. `Invoice` um Leistungsdatum, Snapshot-Felder, PDF-Metadaten, Idempotency-ID und Versandstatus ergänzen.
3. Erstellungsservice für Buchung und Auftrag auf einen gemeinsamen Normalisierer umstellen.
4. Frozen-Schreibschutz in allen Invoice-Update-Pfaden erzwingen.
5. `InvoicePdfService` auf Folgeseiten, alle Positionen, alle Zahlungen, Gerätekennung und exakten Footer erweitern.
6. PDF-Speicherung, Hash-Prüfung und Download aus dem Snapshot ergänzen.
7. Automatischen Versand und Wiederholungsversand mit getrenntem E-Mail-Status abschließen.
8. Unit-, Integrations- und PDF-Abnahmetests gemäß Abschnitt 8 ergänzen.