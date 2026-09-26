# Manueller Abnahmetest für Sophie

**Stand:** 26.09.2026 · Branch `adars` (noch nicht committet)

Diese Liste prüft genau die Punkte aus deinem Test vom 24.09.2026. Zu jedem Schritt steht, was
du **genau** sehen solltest. Weicht etwas ab, bitte Screenshot plus die Auftrags- bzw.
Rechnungsnummer schicken.

---

## 0. Bevor du anfängst — sonst testest du wieder die alte Oberfläche

Das ist wichtig und vermutlich die Ursache für einen Teil der Abweichungen vom 24.09.:

- Die ausgelieferte Oberfläche (`client/dist`) stammt vom **15.09.2026** und enthält die
  Änderungen seit dem 16.09. nicht. Der Server lief dagegen schon mit dem neuen Stand.
  Du hast also sehr wahrscheinlich eine **alte Oberfläche gegen einen neuen Server** getestet.
- Vor dem Test muss die Entwicklung deshalb die Oberfläche neu bauen und ausliefern, die
  Server-Pakete installieren und den Belegnummernkreis einmalig initialisieren.

**Schnellcheck, ob du den neuen Stand siehst:** Öffne einen beliebigen Auftrag. Steht dort ein
Kasten **„Preisübersicht"** mit Listenpreis, Kundenrabatt, Netto und MwSt., ist es der neue
Stand. Fehlt er, bitte nicht weitertesten, sondern zuerst Bescheid geben.

---

## 1. Preis und Rabatt — dein Beispiel vom 24.09.

Kunde mit **15 % Händlerrabatt**, Gerät **Apple iPhone 15**, Leistung **Diagnose (49,90 €)**.

| Schritt | Wo | Erwartet |
|---|---|---|
| 1.1 | Warenkorb | 49,90 € − **7,48 €** = **42,42 €**, davon Netto 35,65 €, MwSt. 6,77 € |
| 1.2 | Nach der Buchung: **Auftragsdetails**, Kopfzeile rechts | **42,42 €** „Gesamt (Brutto)", darunter „inkl. −7,48 € Rabatt (15 %)" |
| 1.3 | Auftragsdetails → Kasten **„Preisübersicht"** | Listenpreis 49,90 € · Kundenrabatt (15 %) −7,48 € · Gesamtbetrag **42,42 €** · davon Netto **35,65 €** · davon MwSt. (19 %) **6,77 €** |
| 1.4 | Schnellaktionen → **„Rechnung erstellen"** | Neue Rechnung **INV-2026-…**, Gesamt **42,42 €**, Rabatt **7,48 €**, Netto **35,65 €**, Steuer **6,77 €** |
| 1.5 | Dasselbe mit **Doppelklick** auf „Rechnung erstellen" | Es entsteht **genau eine** Rechnung; der zweite Klick meldet „… besteht bereits die Rechnung INV-…" |

**Am 24.09. falsch:** Rechnung 36,06 € mit Rabatt 13,84 €. Der Rabatt wurde doppelt abgezogen.

---

## 2. Rechnungsdetails — Foto 2

**Finanzverwaltung → Übersicht → Aktuelle Rechnungen → „Details"**

| Prüfen | Erwartet |
|---|---|
| Gesamtbetrag / Offen | 42,42 € / 42,42 € (solange nichts bezahlt ist) |
| „Zahlungsziel" und „Fällig" | **passen zueinander**, z. B. „14 Tage netto ohne Abzug" und Fällig = Rechnungsdatum + 14 Tage |
| Zahlungszeile oben | vier Werte: Insgesamt eingegangen · Der Rechnung zugeordnet · Überzahlt / Erstattung offen · Bereits erstattet |
| Knopf **„PDF herunterladen"** | lädt die Rechnung als PDF |

**Am 24.09. falsch:** „Zahlungsziel: Net 30", aber fällig nach 7 Tagen.

---

## 3. Versand an den Kunden — Foto 4

Auftrag mit **abgeschlossener Reparatur**, für den bereits ein Einsendelabel existiert.

| Schritt | Wo | Erwartet |
|---|---|---|
| 3.1 | Auftragsdetails → Schnellaktionen | Neben „Einsendelabel bereits erstellt" gibt es den Knopf **„An Kunden versenden"** |
| 3.2 | Text darunter | „Einsendung (Kunde → McRepair) …" und „Auslieferung (McRepair → Kunde): … Absender ist McRepair, Empfänger die Lieferadresse des Kunden." |
| 3.3 | Dasselbe als **Mitarbeiter** (nicht Admin) | Knopf ist ebenfalls da |
| 3.4 | „An Kunden versenden" klicken | Auf dem Label steht **McRepair als Absender** und der **Kunde als Empfänger**, nicht umgekehrt |
| 3.5 | Buchungsdetails → Versand | Einsendung heißt „Versand zum Reparaturbetrieb (Kunde → McRepair)"; die Auslieferung steht getrennt |
| 3.6 | Label-Dialog → Produkt | Keine doppelte Auswahl „Parcel" / „DHL Paket" mehr |

**Am 24.09. falsch:** Es gab nur den ausgegrauten Knopf „Einsendelabel bereits erstellt".

> ⚠ Ein echtes DHL-Label haben wir **nicht** erzeugt (es sind keine DHL-Zugangsdaten
> hinterlegt, und wir wollten keine kostenpflichtigen Labels auslösen). Bitte beim ersten
> echten Versand das Label kontrollieren: Absender und Empfänger.

---

## 4. Leistungen am Auftrag ändern (Händler / VIP)

Kunde mit **10 % Rabatt**.

| Schritt | Erwartet |
|---|---|
| 4.1 | Leistung mit **Standardpreis 100,00 €** hinzufügen | Auftragswert **90,00 €** (Netto 75,63 €, MwSt. 14,37 €) |
| 4.2 | Weitere Leistung zu **50,00 €** hinzufügen | Auftragswert **135,00 €** |
| 4.3 | Die 50-€-Leistung wieder löschen | zurück auf **90,00 €** |
| 4.4 | Seite neu laden | Werte bleiben gleich |
| 4.5 | **Manuelle Reparaturposition** mit eigenem Namen und Preis anlegen | Position erscheint mit Namen am Auftrag und später auf Rechnung und PDF |
| 4.6 | Leistung für ein **anderes Gerätemodell** wählen | wird **nicht** angeboten bzw. abgelehnt |

Bei **älteren Aufträgen**, deren gespeicherter Wert nicht zu den Positionen passt, erscheint
beim Ändern eine Meldung mit der Differenz und dem Knopf **„Neuberechnung bestätigen"**. Das ist
gewollt: Vorher wurde die Differenz stillschweigend verworfen.

---

## 5. Zahlungen

| Schritt | Erwartet |
|---|---|
| 5.1 | Rechnung über mehr als 300 €, **Teilzahlung 300 €** erfassen | Rechnung **teilbezahlt**, „Offen" = Rest. **Keine** Fehlermeldung. Der Versandstatus bleibt unverändert: „Versendet" und „Teilbezahlt" gleichzeitig |
| 5.2 | Denselben Teilbetrag **zweimal schnell** absenden | Nur **eine** Zahlung wird gebucht |
| 5.3 | 100 € vorab bezahlt, Rechnung über 50 € | Anzeige **„Überzahlt · Erstattung offen 50,00 €"**; die Rechnung bleibt bei 50 € |
| 5.4 | 100 € vorab, Rechnung über 150 € | Offen 50 €; nach weiterer Zahlung von 50 € überall **bezahlt** |
| 5.5 | PayPal-Vorabzahlung | erscheint bei den Zahlungen des Auftrags und wird der späteren Rechnung automatisch zugeordnet |

---

## 6. Rechnungen, Storno, Gutschriften

| Schritt | Erwartet |
|---|---|
| 6.1 | Neue Rechnungen | Nummer immer **INV-JJJJ-NNNN**, unabhängig von der Kundengruppe (kein „VIP-" mehr) |
| 6.2 | Unbezahlte Rechnung → **stornieren** (Grund ist Pflicht) | Es entsteht eine Storno-Gutschrift **INV-CN-JJJJ-NNNN**; die Originalrechnung bleibt lesbar |
| 6.3 | Nach dem Storno **neue Rechnung** für denselben Auftrag | funktioniert |
| 6.4 | **Gutschrift** mit 19 % anlegen | Vorschau und PDF zeigen Netto, **19 % MwSt.** und Brutto, **nicht 0,00 €** |
| 6.5 | Auf der Gutschrift | steht, **zu welcher Rechnung** sie gehört |
| 6.6 | Linkes Menü | eigener Punkt **„Gutschriften"**; in „Rechnungen" tauchen keine Gutschriften mehr auf |
| 6.7 | Überall | **kein Skonto** mehr |
| 6.8 | Als Kunde: **Buchungsübersicht** | Rechnung und PDF direkt an der Buchung erreichbar |
| 6.9 | Rechnungen-Reiter → **„Bestellung"** | öffnet die zugehörige Buchung |

---

## 7. Zahlungsaufforderung und Mahnwesen

| Schritt | Erwartet |
|---|---|
| 7.1 | „Zahlungsaufforderung senden" | Kanal ist **E-Mail** (nicht PayPal), das steht auch dran. Suche nach **Rechnungsnummer** funktioniert. Der verfasste Hinweistext kommt beim Kunden an. Es gibt eine **Historie** der gesendeten Aufforderungen |
| 7.2 | Ohne E-Mail-Adresse beim Kunden | klare Fehlermeldung, **keine** Erfolgsmeldung |
| 7.3 | **Mahnlauf** | nur überfällige, noch offene Rechnungen; Stufen Zahlungserinnerung → Mahnung → Letzte Mahnung → Inkasso; nächste Stufe frühestens nach 7 Tagen; bei Inkasso stoppt die Automatik |

---

## 8. Geräteinspektion

| Schritt | Erwartet |
|---|---|
| 8.1 | Schritt 2 → „Speichern & Weiter" | Schritt 3 öffnet sich |
| 8.2 | Schritt 4 → „Speichern & Weiter" | **Schritt 5 öffnet sich** und bleibt offen (springt nicht zurück) |
| 8.3 | Fehlerfall (Pflichtfeld leer) | du bleibst im Schritt und siehst eine **deutsche** Meldung mit dem Grund |
| 8.4 | Gerät A gebucht → auf B → auf C geändert | „Gemeldetes Modell" = **A**, „Tatsächliches Modell" = **C**, auch in Schritt 7 und im PDF |
| 8.5 | Bericht / PDF | kein automatisches „reparierbar" und kein „0 €", wenn nichts eingetragen wurde |

> **Falls Schritt 4 wieder nicht weitergeht:** Taste **F12** → Reiter **„Netzwerk"** →
> „Speichern & Weiter" drücken → Screenshot der rot markierten Zeile samt „Antwort". Wir haben
> zwei Ursachen gefunden und behoben (die Seite sprang nach dem Speichern zurück; leere
> Fehlermeldungen). Den exakten Ablauf vom 24.09. konnten wir aber nicht nachstellen.

---

## 9. Reparatur-Workflow

| Schritt | Erwartet |
|---|---|
| 9.1 | Workflow öffnen und wieder **schließen** | Der Status ändert sich **nicht** (kein automatisches Pausieren oder Abschließen) |
| 9.2 | Aktiven oder pausierten Workflow erneut öffnen | geht direkt, ohne Pause/Fortsetzen |
| 9.3 | Als Mitarbeiter/Admin einen fremden Workflow ansehen | vollständige Leseansicht mit Notizen und Schritten |
| 9.4 | Auftragsliste → Filter **„Warten auf Kundenrückmeldung"** | vorhanden; zeigt nur Aufträge mit offener Rückfrage an den Kunden |

---

## Zurückmelden

Bitte pro Abschnitt kurz **„OK"** oder die Abweichung mit Screenshot und Nummer. Besonders
wichtig sind **1**, **3** und **5**, dort lagen am 24.09. die größten Fehler.
