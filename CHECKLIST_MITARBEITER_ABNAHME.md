# Checkliste Abnahme für Mitarbeitende – Reparatur, Versand, Rechnung, Kommunikation

**Grundlage:** `ABNAHMETEST_2026-10-02.md` (Stand 02.10.2026). Die Beschriftungen von Schaltflächen, Menüs und Reitern
wurden mit dem Programm abgeglichen; Abweichungen bitte vermerken: Steht in der Anwendung etwas anderes als hier, bitte
genau den angezeigten Text bei „Beobachtet“ notieren.

---

## Kopf – bitte vor dem Start ausfüllen

| Feld | Eintrag |
|---|---|
| **Getestete Version (Commit/Build-Kennung):** | ______________________________ |
| Soll-Kennung laut Entwicklung (zum Vergleich) | ______________________________ |
| Testsystem-Adresse | https://______________________________ |
| Name der testenden Person | ______________________________ |
| Datum / Uhrzeit (Beginn – Ende) | ______________________________ |
| Browser und Gerät (z. B. Chrome auf Windows-PC, Safari auf iPhone) | ______________________________ |

**So finden Sie die Versions-Kennung:** Öffnen Sie im Browser `https://<Testsystem-Adresse>/build-info.json`. Es muss eine
kurze Textzeile mit **„commit“** erscheinen; kopieren Sie den Wert hinter „commit“ in das Feld oben. Erscheint stattdessen
eine normale Seite der Anwendung (z. B. **„Page Under Construction“**), eine Fehlerseite oder eine leere Seite, tragen Sie
**„nicht verfügbar“** ein und **beenden Sie den Test** – dann ist möglicherweise eine falsche oder alte Version ausgeliefert.
Weicht die Kennung von der Soll-Kennung ab: ebenfalls beenden und der Entwicklung Bescheid geben.

**So füllen Sie jedes Szenario aus**

- **Bestanden** = alles wie unter „Erwartet“. **Fehlgeschlagen** = etwas weicht ab. **Blockiert** = Sie konnten das
  Szenario nicht ausführen (z. B. Voraussetzung fehlt, Fehlerseite). **Nicht getestet** = bewusst ausgelassen.
- Bei **Fehlgeschlagen** oder **Blockiert**: Screenshot machen, Dateinamen eintragen und die Auftrags-, Buchungs- oder
  Rechnungsnummer notieren (Formate: Buchung **BKG-…**, Reparaturauftrag **ORD-…**, Reparaturanfrage **RR-…**,
  Rechnung **INV-…**, Gutschrift **INV-CN-…**, Reklamation **CMP-…**, Ersatzteilbestellung **EPO-…**).
- **F5** = Seite neu laden (Mac: Cmd + R). **Strg + Plus / Strg + Minus / Strg + 0** = Ansicht vergrößern / verkleinern /
  zurücksetzen (Mac: Cmd statt Strg).

---

## Sicherheitsregeln (gelten für jeden Schritt)

1. **Nur Testkonten und Test-Postfächer**, die Sie selbst lesen können. Niemals echte Kunden suchen, öffnen oder anschreiben.
2. **Keine echten Zahlungen:** nicht mit PayPal und nicht mit **„Kredit- oder Debitkarte“** bezahlen, keine echten
   Kartendaten eingeben. Für Bestellungen immer die Zahlungsmethode **„Rechnung“** wählen; Zahlungseingänge bucht der Admin
   von Hand als **„Überweisung“**.
3. **Keine echten DHL-Labels:** Einsendelabels nur im Modus **„Dummy“** (sie heißen dann **„Testlabel“**).
   Für Auslieferungslabels („An Kunden versenden“) gibt es **keinen** Testmodus.
4. Alles, was mit **[!] NUR MIT FREIGABE** markiert ist, steht gesammelt in **Teil 3** und wird **nicht selbstständig**
   ausgeführt.
5. **Nicht klicken**, auch wenn die Schaltfläche in einem normalen Szenario sichtbar ist:
   - **„Eingegangene PayPal-Zahlungen abgleichen“** (Fenster **„Zahlungen – Buchung BKG-…“**, im Auftrag geöffnet über
     „Zahlungen verwalten“ – verbindet sich mit PayPal),
   - **„Versandstatus prüfen“** (Seite „Buchungen“, rechts neben der Überschrift „Buchungsliste“ – fragt bei DHL den Status
     aller Sendungen ab),
   - **„Mahnlauf“** (Seiten **„Rechnungen“** und **„Gutschriften“** oben rechts neben „Aktualisieren“ – startet sofort ohne
     Rückfrage und schreibt alle Kunden mit fälligen Rechnungen an; dieselbe Wirkung haben **„Mahnlauf ausführen“** im Reiter
     „Übersicht“ und **„System-Mahnlauf“** im Reiter „Mahnwesen“),
   - **„An Kunden versenden“** bzw. **„An Kunden versenden (McRepair → Kunde)“** (Auftrag – echtes DHL-Label),
   - **„DHL-Einsendelabel erstellen“** (Karte „Einsendung“ im Reiter „Versand“) bzw. **„DHL-Einsendelabel erstellen (Kunde →
     McRepair)“** (Menü „Weitere Aktionen“) – bei Aufträgen ohne Buchung wird sofort ein echtes DHL-Label erzeugt,
   - **„Genehmigen & DHL-Einsendelabel erstellen“** (Seite „Reklamationen“, als Admin auch über „Zur Reklamation“ im
     Postfach erreichbar – echtes DHL-Label),
   - das Auswahlfeld **„Buchungslabel-Modus (Einsendelabel)“** (Änderungen werden sofort gespeichert).

   Diese Schritte stehen in Teil 3 (X4–X9).
6. Bei Unsicherheit: abbrechen, **Blockiert** ankreuzen und kurz notieren, warum.

---

## Vorbereitung

### V-1 · Testkonten (stellt die Entwicklung bzw. der Admin bereit)

| Kürzel | Rolle | Wofür | Erkennbar an |
|---|---|---|---|
| **G** | Gast (kein Konto) | Reparaturanfrage ohne Konto, Tracking-Link | eigenes Test-Postfach, keine Anmeldung |
| **N** | Testkunde **Normal** | Bestellung ohne Rabatt; zugleich „fremder Kunde“ für Zugriffsprüfungen | Warenkorb zeigt **keine** Zeile „Rabatt“ |
| **P** | Testkunde **Partner** | Bestellung mit Rabatt | Warenkorb zeigt Zeile **„Rabatt“** (bei 49,90 €: −2,50 €) |
| **M** | Mitarbeiter / Techniker | Eingangsprüfung, Reparatur-Workflow, Nachrichten | nach der Anmeldung linke Leiste mit dem aufklappbaren Bereich **„Aufträge & Arbeit“** (darin **„Meine Aufträge“**) |
| **A** | Admin | Zahlungen, Rechnungen, Einstellungen, Stornierung aufheben | linke Leiste mit **„Buchungen“** und **„Reparaturaufträge“** |

Einrichtung durch Entwicklung/Admin (nicht durch die Testenden):

- Testkunde **P** ist in einer Kundengruppe mit **„Rabatt %“ = 5** (linke Leiste **„Systemverwaltung“** →
  **„Kundengruppen“**; die Überschrift der Seite kann noch englisch **„Customer Groups“** lauten).
- Testkunden **N** und **P** dürfen mit **„Rechnung“** bezahlen (Seite „Kundengruppen“ → Reiter **„Finanzen“** → Spalte
  **„Zahlungsarten“**: „bank_transfer“ bzw. „invoice“ aktiv; N in einer Testgruppe mit 0 % Rabatt).
  **Erkennbar:** Im Bestellvorgang erscheint unter **„Zahlungsmethode“** die Auswahl **„Rechnung“** mit der zweiten Zeile
  **„Zahlung nach Rechnungsstellung“**. Fehlt sie: Bestell-Szenarien als **Blockiert** markieren (nicht auf PayPal/Karte
  ausweichen).
- Für die Gruppen von **N**, **P** und die (optionale) 15-%-Gruppe steht im Reiter **„Finanzen“** in der Spalte **„Steuer“**
  der Wert **„default“** (Standard-MwSt.), **nicht** „tax_free“ – sonst stimmen alle Preiserwartungen dieser Liste nicht.
- Im Katalog gibt es für ein Testgerät eine Leistung zu **49,90 €** (z. B. „Diagnose“) und eine zweite zu **129,90 €**;
  die Entwicklung nennt Gerät und Leistungen: ________________________________
- In **Teileverwaltung** gibt es mindestens ein Ersatzteil (für die Ersatzteilbestellung): ______________________
- Für den Abschnitt „Rabatt 15 %“ (optional) gibt es einen Testkunden in einer Gruppe mit 15 %: ☐ ja ☐ nein

Hinweise für die Testenden:

- **Sprache oben auf Deutsch stellen:** Die Anwendung richtet sich nach der Browsersprache und erscheint in einem englisch
  eingestellten Browser auf Englisch. Oben rechts das Sprach-Symbol (Schaltfläche „Sprache“, auf Englisch „Language“)
  anklicken → **„Deutsch“** wählen – in jedem Browserprofil bzw. privaten Fenster einmal (Ausnahme: Szenario C6).
- **Pro Rolle ein eigenes Browserprofil bzw. privates Fenster verwenden und nur einmal anmelden.** Zwischen den Rollen
  das Fenster wechseln, statt sich ab- und wieder anzumelden. (Mehrere private Fenster desselben Browsers teilen sich die
  Anmeldung – dann für die weitere Rolle ein zweites Browserprofil oder einen anderen Browser nehmen.)
- Erscheint **„Zu viele Login-Versuche“**, **10 Minuten warten** und das Szenario als **Blockiert** markieren, **nicht**
  als Fehlgeschlagen. (Die Anmeldung ist auf 8 Versuche je 10 Minuten pro Internetanschluss und E-Mail-Adresse begrenzt.)
- **Teil 2 braucht weitere frische Buchungen:** zusätzlich zu KT2 und C1 etwa **4 weitere Partnerbuchungen** (je 49,90 €
  → 47,40 €) und **2 weitere normale Buchungen** (49,90 €), angelegt genauso wie in **KT2** (als P) bzw. **C1** (als N) –
  z. B. für E4/E5, F2, F8, H3, H4/H5 und H7. Für **H4/H5** eine Buchung nehmen, auf die **noch nichts gebucht** wurde
  (also **nicht** die Buchung aus KT2 – dort bucht KT7 bereits 47,40 €).

### V-2 · Testmodus prüfen (Admin, vor jeder Bestellung)

1. Als **A** anmelden → linke Leiste **„Buchungen“**. **Nicht klicken:** **„Versandstatus prüfen“** (rechts neben der
   Überschrift „Buchungsliste“) – fragt bei DHL den Status aller Sendungen ab (nur mit Freigabe, Teil 3, X9).
2. Oben auf der Seite muss stehen: **„Dummy-Modus aktiv – Labels sind Testlabels.“**
3. Zur Kontrolle (nur ansehen, nichts ändern): linke Leiste **„Systemverwaltung“** → **„Systemkonfiguration“** → Reiter
   **„Integrationen“** → DHL-Eintrag → unter **„Buchungslabel-Modus (Einsendelabel)“** ist der Wert
   **„Dummy – Testlabel (kein echtes DHL-Label)“** zu sehen. **Auswahlfeld Buchungslabel-Modus nicht öffnen – Änderungen
   werden sofort gespeichert** (es gibt keine eigene „Speichern“-Schaltfläche).

**Steht dort „Live – echtes DHL-Label“ oder fehlt der Hinweis aus Schritt 2:** keine Bestellung auslösen – jede Bestellung
würde ein echtes, kostenpflichtiges DHL-Label erzeugen. Alle Szenarien mit Bestellung als **Blockiert** markieren und die
Entwicklung informieren.

- Ergebnis V-2: ☐ Dummy-Modus aktiv ☐ Live-Modus / unklar → Test der Bestellungen gestoppt

### V-3 · Shop-Anschrift (nur ansehen)

In der DHL-Integration ist die Shop-Anschrift (McRepair) eingetragen: ☐ ja ☐ nein ☐ weiß nicht.
Ist sie **nicht** eingetragen, zeigen die Versandkarten bei McRepair **„Adresse fehlt – bitte prüfen“** – das ist dann das
richtige Verhalten und **kein** Fehler der Anwendung.

---

## Teil 1 – Kritischer Kurztest (ca. 20–30 Minuten)

Reihenfolge einhalten; die Szenarien bauen aufeinander auf. Nach diesem Teil ist klar, ob sich der ausführliche Test lohnt.
Die Kurztest-Szenarien heißen **KT1–KT10** (nicht zu verwechseln mit Abschnitt „K“ in Teil 2).

### KT1 · Richtige Version und neue Oberfläche

- **Rolle:** A · **Voraussetzung:** Kopfzeile oben ausgefüllt, V-2 erledigt.

1. `https://<Testsystem-Adresse>/build-info.json` öffnen: Es muss eine kurze Textzeile mit **„commit“** erscheinen; den Wert
   in den Kopf übertragen. Erscheint eine normale Seite (z. B. „Page Under Construction“), eine Fehlerseite oder eine leere
   Seite: „nicht verfügbar“ eintragen und den Test beenden.
2. Als **A** anmelden.
3. Linke Leiste ansehen.
4. **„Reparaturaufträge“** → bei einem beliebigen Auftrag **„Auftrag öffnen“**.

- **Erwartet:** Kennung vorhanden und gleich der Soll-Kennung. Die Leiste zeigt **„Buchungen“** und **„Reparaturaufträge“**
  getrennt. Der Auftrag zeigt die Reiter **Übersicht · Kommunikation · Verlauf · Rechnungen & Zahlungen · Versand**.
  Fehlt etwas: Test beenden.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT2 · Partnerkunde bestellt ein Gerät (5 % Rabatt, Zahlung „Rechnung“)

- **Rolle:** P · **Voraussetzung:** V-1 und V-2 erledigt (Dummy-Modus), Leistung zu 49,90 € bekannt.

1. Als **P** anmelden.
2. Adresse `https://<Testsystem-Adresse>/new-order` öffnen (Seite **„Neuen Reparaturauftrag Erstellen“**).
3. Unter **„Wählen Sie Ihr Gerät“** das Testgerät suchen und wählen → **„Weiter zu Diensten“**.
4. Die Leistung zu **49,90 €** anhaken → **„Weiter (1 Dienste)“**.
5. Die Schritte **Details** und **Überprüfung** ausfüllen (Pflichtfelder), bis Schritt **„In Den Warenkorb“** →
   **„In Den Warenkorb & Überprüfen“**.
6. Im **Warenkorb** die **„Bestellübersicht“** ablesen.
7. **„Zur Kasse Gehen“** → Zahlungsmethode **„Rechnung“** wählen → AGB-Häkchen setzen (**„Ich akzeptiere die AGB und die
   Datenschutzbestimmungen.“**) → **„Zahlungspflichtig bestellen — 47,40 €“**.

- **Erwartet:** Bestellübersicht: **Zwischensumme (Brutto) 49,90 €**, **Rabatt −2,50 €**, **Nettobetrag 39,83 €**,
  **MwSt. (19%) 7,57 €**, **Gesamtsumme (Brutto) 47,40 €**. Danach Seite **„Vielen Dank! Ihre Bestellung ist eingegangen.“**
  mit Buchungsnummer **BKG-…**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT3 · Einsendelabel nach der Bestellung (Testlabel)

- **Rolle:** P · **Voraussetzung:** KT2, Sie sind noch auf der Erfolgsseite.

1. Ganz oben den Kasten **„Nächster Schritt: Gerät an McRepair senden“** suchen.
2. **„Testlabel herunterladen“** klicken (im Live-Betrieb heißt die Schaltfläche „DHL-Einsendelabel herunterladen“).
3. Sendungsnummer notieren. **F5** drücken.
4. Noch einmal **„Testlabel herunterladen“** klicken.

- **Erwartet:** Ein PDF wird heruntergeladen; Hinweis **„Testlabel – nicht für den Versand verwenden.“** Nach F5 ist dieselbe
  Sendungsnummer zu sehen; der zweite Download erzeugt **kein** neues Label (gleiche Nummer). Link **„Zum Auftrag ORD-…“**
  ist vorhanden.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT4 · Kunde findet sein Gerät und schreibt eine Nachricht

- **Rolle:** P · **Voraussetzung:** KT2.

1. Oben rechts das **Profilmenü** öffnen → **„Buchungen“**.
2. Bei der neuen Buchung in der Gerätezeile **„Details ansehen“** klicken.
3. Kasten **„Auf einen Blick“** ablesen.
4. Unten **„Nachrichten zum Auftrag“**: Text „Test KT4“ schreiben → **„Nachricht senden“**.

- **Erwartet:** **Ein Klick** öffnet genau dieses Gerät. „Auf einen Blick“ zeigt Reparaturstatus, **Gesamt (brutto) 47,40 €**,
  **Bezahlt 0,00 €**, **Offen 47,40 €** und **einen** hervorgehobenen **„Nächster Schritt“** (hier: Gerät einsenden mit
  „Testlabel herunterladen (PDF)“). Die Nachricht erscheint sofort.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT5 · Nachricht beantworten und interne Notiz anlegen

- **Rolle:** A (oder M) · **Voraussetzung:** KT4.

1. Linke Leiste **„Nachrichten“** → Filter **„Antwort ausstehend“** oder Suche nach der Auftragsnummer.
2. Das Gespräch anklicken (öffnet sich rechts).
3. Modus **„Nachricht an Kunden“** → „Antwort KT5“ → **„Nachricht an Kunden senden“**.
4. Modus **„Interne Notiz“** → „Notiz KT5 intern“ → **„Interne Notiz speichern“**.
5. Als **P**: Profilmenü → **„Nachrichten“** öffnen, dann das Gerät (wie KT4) öffnen.

- **Erwartet:** Die Modi sind klar getrennt (blau **„An Kunden“**, gelb **„Intern – nur für das Team“**). Kunde **P** sieht
  „Antwort KT5“, aber **nicht** „Notiz KT5 intern“ – weder unter Nachrichten noch im Auftrag.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT6 · Versand im Auftrag (beide Richtungen getrennt)

- **Rolle:** A · **Voraussetzung:** KT2/KT3.

1. **„Reparaturaufträge“** → Auftrag aus KT2 → **„Auftrag öffnen“** → Reiter **„Versand“**.
2. Karte **„Einsendung“** (Untertitel „Kunde → McRepair“) ansehen → **„Testlabel herunterladen (PDF)“** (im Live-Betrieb
   heißt die Schaltfläche „Einsendelabel herunterladen (PDF)“; **„Versandlabel herunterladen (PDF)“** gibt es nur auf der
   Karte „Auslieferung“).
3. Karte **„Auslieferung“** (Untertitel „McRepair → Kunde“) nur ansehen (**nichts** klicken, insbesondere nicht **„An
   Kunden versenden“** – siehe Teil 3, X4).

- **Erwartet:** Zwei getrennte Karten. Einsendung: Absender = Kunde, Empfänger = McRepair; zeigt die Sendungsnummer aus
  KT3 mit Kennzeichen **„Testlabel“**; PDF wird heruntergeladen. Auslieferung: Status **„Noch nicht versendet“**, noch
  **keine** Sendungsnummer; Absender = McRepair, Empfänger = Lieferadresse des Kunden; fehlende Angaben stehen als
  **„Adresse fehlt – bitte prüfen“** (siehe V-3).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT7 · Zahlungseingang von Hand buchen

- **Rolle:** A · **Voraussetzung:** KT2.

1. Im Auftrag aus KT2 Reiter **„Rechnungen & Zahlungen“** → Karte **„Zahlungsstand“** → **„Zahlungen verwalten“** (öffnet
   das Fenster **„Zahlungen – Buchung BKG-…“**). **Nicht klicken:** **„Eingegangene PayPal-Zahlungen abgleichen“** (oben im
   Fenster) – verbindet sich mit PayPal (nur mit Freigabe, Teil 3, X9).
2. Bereich **„Zahlung manuell erfassen“**: **Betrag (EUR)** = 47,40 (Zahlenfeld – wird „47,40“ nicht angenommen, „47.40“
   eingeben), **Zahlart** = **„Überweisung“**, **Datum** = heute → **„Zahlung speichern“** → **„Schließen“**.
3. Als **P** das Gerät öffnen (wie KT4).

- **Erwartet:** Admin: **Bezahlt 47,40 €**, **Offen 0,00 €**, Zahlungswort **„Bezahlt“** (kein „Offen“ bei 0,00 €).
  Kunde: **Bezahlt 47,40 €**, **Offen 0,00 €**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT8 · Status ändern und im Verlauf nachvollziehen

- **Rolle:** A oder M · **Voraussetzung:** KT2.

1. Im Auftrag oben rechts auf den farbigen Status klicken (Menü **„Auftragsstatus ändern“**) → **„In Bearbeitung“**.
2. Reiter **„Verlauf“** → Filter **„Status & Workflow“**.

- **Erwartet:** Eintrag mit Uhrzeit, Person und alt → neu. Mit Filter **„Alle“** erscheinen wieder alle Einträge.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT9 · Ersatzteil bestellen, Sendungsnummer speichern

- **Rolle:** A · **Voraussetzung:** ein Ersatzteil in der Teileverwaltung (V-1).

1. Linke Leiste **„Ersatzteilbestellungen“** → Reiter **„Bestellungen“** → **„Bestellung anlegen“**.
2. **Lieferant** wählen (oder **„Neuen Lieferanten anlegen“** → Name, E-Mail → **„Lieferant speichern“**).
3. Ein Teil mit Menge 2 eintragen, **Bestellstatus** = **„Bestellt“** → **„Bestellung anlegen“**.
4. In der Liste bei der neuen Bestellung **„Details“** klicken → **„Sendungsnummer“** = „TEST-KT9“ → **„Änderungen speichern“**.
5. **F5** drücken und die Bestellung wieder öffnen (**„Details“**).

- **Erwartet:** Meldung **„Bestellung EPO-… angelegt“**. Nach dem Speichern **„Gespeichert um …“**. Nach F5 sind Bestellung
  und Sendungsnummer noch da.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### KT10 · Handy-Ansicht des Kunden

- **Rolle:** P · **Voraussetzung:** KT2; Smartphone (ca. 390 px breit) oder sehr schmales Browserfenster.

1. Testsystem auf dem Smartphone öffnen, als **P** anmelden.
2. Profilmenü → **„Buchungen“** → **„Details ansehen“**.
3. Seite von oben nach unten durchscrollen.

- **Erwartet:** Alles lesbar, **kein** seitliches Verschieben der ganzen Seite nötig; „Auf einen Blick“ und die Beträge sind
  ohne Aufklappen sichtbar; Schaltflächen sind mit dem Finger treffbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

---

## Teil 2 – Vollständige Liste

### A · Anmeldung, Rollen, Version

#### A1 · Anmeldeseite ohne Beispiel-Zugangsdaten

- **Rolle:** alle (nicht angemeldet) · **Voraussetzung:** keine.

1. `https://<Testsystem-Adresse>/login` öffnen.
2. `https://<Testsystem-Adresse>/debug` öffnen.

- **Erwartet:** Anmeldeseite **ohne** Beispiel-Zugangsdaten (keine „Quick-Login“-Karte, keine Standardpasswörter).
  `/debug` zeigt keine Anmeldehilfe, sondern die allgemeine (englische) Seite **„Page Under Construction“** – das ist hier
  das richtige Ergebnis.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### A2 · Menü für Mitarbeitende

- **Rolle:** M · **Voraussetzung:** Konto M.

1. Als **M** anmelden.
2. Linke Leiste ansehen, Bereich **„Aufträge & Arbeit“** aufklappen.
3. **„Zeiterfassung“** öffnen (nur ansehen, nichts stempeln), dann unter **„Werkzeuge & Ressourcen“** **„Team-Chat“** öffnen
   (nur ansehen, nichts schreiben).

- **Erwartet:** Deutsche Einträge: **Dashboard**, **Aufträge & Arbeit** (mit **„Meine Aufträge“**, **„Reparaturanfragen“**,
  **„Buchungen“**), **Zeiterfassung**, **Zeitplan**, **Werkzeuge & Ressourcen**, **Nachrichten**, **Benachrichtigungen**,
  **Profil**. Die Seiten **„Zeiterfassung“** und **„Team-Chat“** zeigen deutsche Überschriften und Texte. Kein Eintrag und
  kein Text sieht aus wie ein Programmschlüssel (z. B. „staff.menu.…“, „timeTracking.…“, „teamChat.…“) – falls doch,
  genauen Text notieren (dann **Fehlgeschlagen**).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### A3 · Mitarbeitende sehen keine Admin-Seiten

- **Rolle:** M · **Voraussetzung:** angemeldet als M.

1. `https://<Testsystem-Adresse>/admin/financial` in die Adresszeile eingeben.

- **Erwartet:** Kein Zugriff auf die Rechnungsverwaltung (Weiterleitung oder Hinweis), keine Rechnungsdaten sichtbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### A4 · Kunden sehen keine fremden Daten

- **Rolle:** N · **Voraussetzung:** Auftragsnummer und Adresse eines Auftrags von **P** (aus KT2, Adresszeile beim Admin kopieren).

1. Als **N** anmelden.
2. Die Auftragsadresse von P (`…/orders/…`) in die Adresszeile einfügen.
3. Profilmenü → **„Nachrichten“**.

- **Erwartet:** Kein Zugriff auf den fremden Auftrag („nicht gefunden“ o. ä.), keine Daten von P. Unter Nachrichten keine
  Gespräche von P.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### B · Reparaturanfrage, Kostenvoranschlag, Annahme

#### B1 · Anfrage mit Gerät aus dem Katalog (Kunde)

- **Rolle:** N · **Voraussetzung:** angemeldet als N.

1. `https://<Testsystem-Adresse>/repair-request` öffnen (auf der Startseite auch über **„Individuelle Smartphone Reparatur
   anfragen“**).
2. Gerätetyp (z. B. **„Smartphone“**) → Marke → Modell aus dem Katalog wählen.
3. Problem beschreiben → **„Reparaturanfrage absenden“**.
4. Profilmenü → **„Reparaturanfragen“** (Seite **„Meine Reparaturanfragen“**).

- **Erwartet:** Zuerst Katalogauswahl, daneben **„Mein Gerät ist nicht aufgeführt“**. Die Anfrage erscheint unter „Meine
  Reparaturanfragen“ mit Nummer **RR-…**. Der Menüpunkt im Profilmenü heißt deutsch **„Reparaturanfragen“** (steht dort
  noch „Repair Requests“, bitte bei „Beobachtet“ notieren).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B2 · Anfrage mit manuellem Gerät (Gast)

- **Rolle:** G · **Voraussetzung:** abgemeldet bzw. privates Browserfenster; Test-Postfach des Gasts.

1. `https://<Testsystem-Adresse>/repair-request` öffnen.
2. **„Mein Gerät ist nicht aufgeführt“** klicken → im Bereich mit der Kennzeichnung **„Manuelle Angabe“** (nur ein Hinweis,
   nicht anklickbar) **Gerätetyp**, **Marke** und **Modellbezeichnung** eintragen.
3. Problem beschreiben → **„Reparaturanfrage absenden“**.
4. Im Fenster Reiter **„Als Gast“** → Vorname, Nachname, E-Mail (Test-Postfach) → **„Anfrage als Gast absenden“**.
5. Test-Postfach öffnen.

- **Erwartet:** Weiterleitung auf die Tracking-Seite der Anfrage. Im Postfach **eine** Bestätigung mit Tracking-Link.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B3 · Kostenvoranschlag als Entwurf (keine E-Mail)

- **Rolle:** A (oder M über **„Reparaturanfragen“**) · **Voraussetzung:** B2.

1. Linke Leiste **„Reparaturanfragen“** → Anfrage suchen → **„Öffnen“**.
2. **„Betrag (brutto, EUR)“** = 89,00 und **„Leistungsbeschreibung für den Kunden“** eintragen → **„Entwurf speichern“**.
3. Test-Postfach des Gasts und dessen Tracking-Seite prüfen.

- **Erwartet:** Gespeichert, aber **keine** E-Mail; der Gast sieht noch keinen Betrag.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B4 · Kostenvoranschlag senden (genau eine E-Mail)

- **Rolle:** A · **Voraussetzung:** B3.

1. In derselben Anfrage **„Kostenvoranschlag an Kunden senden“** → Rückfrage **„Jetzt senden“**.
2. Danach noch einmal **„Entwurf speichern“** klicken.
3. Test-Postfach des Gasts prüfen.

- **Erwartet:** **Genau eine** E-Mail mit 89,00 €, Beschreibung und Link. Das erneute Speichern schickt **keine** zweite E-Mail.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B5 · Gast nimmt den Kostenvoranschlag an

- **Rolle:** G · **Voraussetzung:** B4.

1. Link aus der E-Mail öffnen.
2. Im Kasten **„Kostenvoranschlag“** **„Kostenvoranschlag annehmen“** → **„Ja, Kostenvoranschlag annehmen“**.
3. Als **A** die Anfrage erneut öffnen.

- **Erwartet:** Gast sieht **„Angenommen am …“**. Beim Admin Status **„Kostenvoranschlag angenommen“**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B6 · Kunde mit Konto: Benachrichtigung und Annahme, auch 0,00 €

- **Rolle:** A, dann N · **Voraussetzung:** B1.

1. Als **A** die Anfrage aus B1 öffnen → Betrag **0,00** und Beschreibung → **„Kostenvoranschlag an Kunden senden“** →
   **„Jetzt senden“**.
2. Als **N**: Profilmenü → **„Benachrichtigungen“**, dann Profilmenü → **„Reparaturanfragen“** → Anfrage öffnen.
3. **„Kostenvoranschlag annehmen“** → **„Ja, Kostenvoranschlag annehmen“**.

- **Erwartet:** 0,00 € ist erlaubt (Anzeige „0,00 € (kostenlos)“). N hat eine Benachrichtigung zum Kostenvoranschlag; nach
  der Annahme steht „Angenommen am …“.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### B7 · Anfrage in einen Auftrag umwandeln

- **Rolle:** A · **Voraussetzung:** B5 oder B6 (Status „Kostenvoranschlag angenommen“).

1. Anfrage öffnen → **„In Auftrag umwandeln“**.
2. Eine Leistung wählen, deren Preis vom Kostenvoranschlag abweicht.
3. **„Versandart“**: **„Gerät liegt vor bzw. Abgabe im Laden“** lassen.
4. Häkchen **„Mir ist bewusst, dass der Auftragswert vom angenommenen Kostenvoranschlag … abweicht“** setzen →
   **„Auftrag anlegen“**.

- **Erwartet:** „Auftrag anlegen“ ist erst nach dem Häkchen möglich. Der neue Auftrag übernimmt das Gerät und zeigt die
  ursprüngliche Kundenangabe. Bei dieser Versandart wird **kein** DHL-Label erstellt.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### C · Warenkorb, Rabatt, Bestellung, Zahlung

#### C1 · Normaler Kunde: Preis ohne Rabatt

- **Rolle:** N · **Voraussetzung:** V-1, V-2.

1. Wie KT2 Schritte 2–6, aber als **N**.
2. **„Zur Kasse Gehen“** → **„Rechnung“** → AGB-Häkchen → **„Zahlungspflichtig bestellen — 49,90 €“**.

- **Erwartet:** Bestellübersicht: **Zwischensumme (Brutto) 49,90 €**, **keine** Rabattzeile, **Nettobetrag 41,93 €**,
  **MwSt. (19%) 7,97 €**, **Gesamtsumme (Brutto) 49,90 €**. Erfolgsseite mit **BKG-…**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C2 · Partnerkunde: gleiche Beträge überall

- **Rolle:** P, dann A · **Voraussetzung:** KT2.

1. Als **P**: Gerätedetail (KT4) → **„Preisaufstellung“** aufklappen; Bestell-E-Mail im Test-Postfach öffnen.
2. Als **A**: Auftrag → Reiter **„Rechnungen & Zahlungen“** → Karte **„Zahlungsstand“**.

- **Erwartet:** Überall **47,40 €** brutto, davon **Netto 39,83 €** und **MwSt. 7,57 €**, Rabatt **2,50 €**. Admin zeigt
  **„Gesamt (brutto) – dieser Auftrag 47,40 €“** und **„Rabatt (im Gesamt enthalten) −2,50 €“**. Die E-Mail weist die MwSt. aus.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C3 · Partnerkunde: zwei Geräte in einer Buchung

- **Rolle:** P · **Voraussetzung:** Leistungen zu 49,90 € und 129,90 € (V-1).

1. Über `/new-order` die Leistung zu 49,90 € in den Warenkorb legen (**„In Den Warenkorb & Überprüfen“**). Danach in der
   Adresszeile erneut `/new-order` öffnen und die Leistung zu 129,90 € genauso in den Warenkorb legen – **nicht**
   **„Weiter Einkaufen“** verwenden (führt in den Shop, ohne die Leistung in den Warenkorb zu legen).
2. Warenkorb ablesen → **„Zur Kasse Gehen“** → **„Rechnung“** → AGB-Häkchen setzen (**„Ich akzeptiere die AGB und die
   Datenschutzbestimmungen.“**) → **„Zahlungspflichtig bestellen — 170,81 €“**.
3. Profilmenü → **„Buchungen“** → beide Gerätezeilen ansehen; je Gerät **„Details ansehen“**.

- **Erwartet:** Warenkorb: Zwischensumme **179,80 €**, Rabatt **−8,99 €**, Gesamtsumme **170,81 €**. Eine Buchung mit zwei
  Geräten (**„Gerät 1 von 2“**, **„Gerät 2 von 2“**). Gerät zu 49,90 € = **47,41 €**, Gerät zu 129,90 € = **123,40 €**.
  Im Gerätedetail: **„Dieses Gerät (brutto)“**, **„Bezahlt (ganze Buchung)“**, **„Offen (ganze Buchung)“**.
  (Die Cent-Verteilung 47,41 € statt 47,40 € ist der aktuelle technische Standard, siehe „Nicht Teil der Abnahme“.)
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C4 · Gast: Warenkorb und Bezahlseite (ohne Abschluss)

- **Rolle:** G · **Voraussetzung:** abgemeldet bzw. privates Fenster.

1. Über `/new-order` die Leistung zu 49,90 € in den Warenkorb legen; im **Warenkorb** die **„Bestellübersicht“** ablesen.
2. **„Zur Kasse Gehen“** → Reiter **„Als Gast“** → Testdaten (Test-Postfach) eintragen → weiter bis **„Zahlungsmethode“**.
3. Angezeigte Zahlungsmethoden und Beträge notieren → Fenster mit **„Abbrechen“** bzw. Schließen verlassen.

- **Erwartet:** Warenkorb („Bestellübersicht“): Gesamtsumme (Brutto) **49,90 €**, Nettobetrag **41,93 €**, MwSt. (19%)
  **7,97 €**. Bei **„Zahlungsmethode“** sieht der Gast **keine** Netto-/MwSt.-Zeilen, sondern nur die Gesamtsumme (Brutto)
  **49,90 €** mit dem Hinweis **„Gesamtbetrag inkl. gesetzl. MwSt. – die Aufschlüsselung nach Netto und MwSt. finden Sie in
  Ihrer Rechnung.“** (so gewollt). Notieren, welche Zahlungsmethoden angeboten werden. **Nicht abschließen** – der Abschluss
  als Gast geht nur mit PayPal oder Karte (Teil 3, X2).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C5 · Lieferadresse „wie Rechnungsadresse“ bleibt erhalten

- **Rolle:** N · **Voraussetzung:** etwas im Warenkorb.

1. **„Zur Kasse Gehen“** → bei der Lieferadresse **„Gleich wie Rechnungsadresse“** gewählt lassen.
2. **„Rechnungsadresse bearbeiten“** → Rechnungsadresse ändern (z. B. Hausnummer) → **„Adresse speichern“**; Bestellung mit
   **„Rechnung“** abschließen (AGB-Häkchen → **„Zahlungspflichtig bestellen — …“**).
3. Profilmenü → **„Profil“** öffnen → **„Änderungen speichern“** → **F5**.

- **Erwartet:** Die Lieferadresse bleibt „wie Rechnungsadresse“ (keine alte Adresse als abweichende Lieferadresse).
  Profil speichern ändert diese Einstellung nicht; Name/Telefon/Adresse bleiben nach F5 gespeichert.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C6 · Englische Sprache zeigt weiter Euro

- **Rolle:** P · **Voraussetzung:** KT2.

1. Sprache auf Englisch umstellen (Sprachauswahl im Kopfbereich).
2. Warenkorb und Gerätedetail ansehen. Danach wieder Deutsch wählen.

- **Erwartet:** Beträge bleiben in **€** (kein $ oder CHF), gleiche Zahlen.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### C7 · (optional) Kunde mit 15 % Rabatt

- **Rolle:** Testkunde 15 % · **Voraussetzung:** V-1 „15 %“ = ja.

1. Leistung zu 49,90 € in den Warenkorb legen, Bestellübersicht ablesen.

- **Erwartet:** 49,90 € − **7,48 €** = **42,42 €**, davon Netto **35,65 €**, MwSt. **6,77 €**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### D · Nach der Bestellung: DHL-Einsendelabel und Versandrichtungen

#### D1 · Label im Gerätedetail und in der Buchung (Kunde)

- **Rolle:** P · **Voraussetzung:** KT2/KT3.

1. Gerätedetail öffnen (KT4) → im „Nächster Schritt“ **„Testlabel herunterladen (PDF)“**.
2. Profilmenü → **„Buchungen“** → bei der Buchung **„Versand & Verlauf“**.

- **Erwartet:** PDF der richtigen Buchung; in der Buchung ist die Einsendung mit Kennzeichen **„Testlabel“** zu sehen.
  Kein Suchen im Menü nötig.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### D2 · Kein zweites Einsendelabel

- **Rolle:** A · **Voraussetzung:** KT3.

1. Auftrag aus KT2 öffnen → oben **„Weitere Aktionen“** öffnen.
2. Menü nur ansehen und mit **Esc** schließen – **nichts** anklicken, insbesondere nicht **„An Kunden versenden (McRepair →
   Kunde)“** (echtes DHL-Label, Teil 3, X4) und nicht **„DHL-Einsendelabel erstellen (Kunde → McRepair)“**, falls dieser
   Eintrag statt „Einsendelabel bereits erstellt“ erscheint (Teil 3, X6).

- **Erwartet:** Unter „Versand“ steht **„Einsendelabel bereits erstellt“** (nicht anklickbar). Es lässt sich kein zweites
  Einsendelabel erzeugen.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### D3 · Absender und Empfänger je Richtung (auch am Handy)

- **Rolle:** A · **Voraussetzung:** KT6.

1. Auftrag → Reiter **„Versand“** → beide Karten lesen (nur lesen; auf der Karte „Auslieferung“ **nichts** anklicken, siehe X4).
2. Dasselbe auf dem Smartphone (ca. 390 px) oder im schmalen Fenster.
3. Als **P** denselben Auftrag öffnen.

- **Erwartet:** Karte **„Einsendung“** (Untertitel „Kunde → McRepair“): Absender = Kunde (Name, Anschrift, Quelle der
  Angabe), Empfänger = McRepair; Schaltfläche **„Testlabel herunterladen (PDF)“** (im Live-Betrieb „Einsendelabel
  herunterladen (PDF)“). Karte **„Auslieferung“** (Untertitel „McRepair → Kunde“): Absender = McRepair, Empfänger =
  Lieferadresse bzw. Packstation des Kunden;
  **„Versandlabel herunterladen (PDF)“** erscheint nur hier und erst, wenn ein Auslieferungslabel existiert.
  Kein seitliches Scrollen. Der Kunde sieht diesen Adressblock **nicht**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### D4 · Fremder Kunde kann das Label nicht laden

- **Rolle:** N · **Voraussetzung:** KT3, A4.

1. Als **N** angemeldet die Auftragsseite von P aufrufen (wie A4) und nach einem Label suchen.

- **Erwartet:** Kein Zugriff, kein Label-PDF.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### D5 · Buchungsliste beim Personal

- **Rolle:** A · **Voraussetzung:** KT2.

1. Linke Leiste **„Buchungen“** → Buchung suchen → **„Details“**. **Nicht klicken:** **„Versandstatus prüfen“** (rechts
   neben der Überschrift „Buchungsliste“) – fragt bei DHL den Status aller Sendungen ab (nur mit Freigabe, Teil 3, X9).
2. In den Buchungsdetails beim Gerät **„Zum Auftrag“** klicken.

- **Erwartet:** Hinweis **„Dummy-Modus aktiv – Labels sind Testlabels.“**; Einsendung mit **„Testlabel“** gekennzeichnet;
  „Zum Auftrag“ öffnet den richtigen Reparaturauftrag.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### E · Eingangsprüfung, Gerät/Leistung/Preis ändern, Verlauf

#### E1 · Eingangsprüfung beginnen

- **Rolle:** M · **Voraussetzung:** Auftrag aus C1 (dem Mitarbeiter zugewiesen oder über Buchungen auffindbar).

1. Als **M**: linke Leiste **„Aufträge & Arbeit“** aufklappen → **„Meine Aufträge“** → Feld **„Aufträge suchen …“** →
   Auftrag öffnen.
2. Oben **„Inspektion starten“**.
3. Schritt 1: Notiz eintragen → **„Speichern & Weiter“**; Schritt 2: Seriennummer → **„Speichern & Weiter“**.
4. Dialog schließen, **F5**.

- **Erwartet:** Jeder Schritt meldet „gespeichert“ und öffnet den nächsten. Nach F5 heißt die Hauptaktion
  **„Inspektion fortsetzen“**; eingegebene Daten sind noch da.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E2 · Kennzeichnung „für Kunden sichtbar“ / „intern“

- **Rolle:** M · **Voraussetzung:** E1.

1. **„Inspektion fortsetzen“** → Notizfelder der Schritte ansehen.

- **Erwartet:** Felder, die der Kunde später sieht, tragen **„Für Kunden sichtbar (erscheint in „Diagnose ansehen“)“**;
  interne Felder sind als **„Intern – nur für das Team“** gekennzeichnet.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E3 · Eingangsprüfung abschließen, Kunde sieht Diagnose

- **Rolle:** M, dann N · **Voraussetzung:** E1.

1. Alle Schritte mit **„Speichern & Weiter“** durchgehen → **„Inspektion abschließen“**.
2. Test-Postfach von **N** öffnen.
3. Als **N** das Gerätedetail öffnen → **„Diagnose ansehen“**.

- **Erwartet:** E-Mail heißt **„Eingangsprüfung“** (nicht „Diagnose abgeschlossen“), keine englischen Sätze. Der Kunde sieht
  nur die als „Für Kunden sichtbar“ gekennzeichneten Angaben. Beim Personal heißt die Hauptaktion jetzt **„Prüfbericht ansehen“**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E4 · Gerät ändern

- **Rolle:** A oder M · **Voraussetzung:** ein offener Testauftrag (nicht storniert).

1. Auftrag → Reiter **„Übersicht“** → Karte **„Geräteinformationen“** → **„Bearbeiten“** (Fenster **„Gerät ändern“**).
2. Neues Gerät suchen und wählen, Leistungen zuordnen (**„Zuordnung hinzufügen / aktualisieren“**), Grund eintragen.
3. **„Gegenrechnung und Servicepreise berechnen“** → **„Weiter zur Bestätigung“** → **„Geräteänderung bestätigen“**.

- **Erwartet:** Gerätekarte zeigt das neue Gerät, neuer Auftragswert wird angezeigt. **„Vom Kunden gemeldet: …“** bleibt mit
  der ursprünglichen Angabe sichtbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E5 · Leistung hinzufügen, Preis ändern, entfernen

- **Rolle:** A oder M · **Voraussetzung:** E4 (gleicher Auftrag).

1. Bereich Leistungen → **„Dienst hinzufügen“** → Leistung suchen, Grund eintragen → **„Reparaturservice hinzufügen“**.
2. Bei der neuen Leistung das Bearbeiten-Symbol (Stift) → Preis ändern, Grund → **„Service aktualisieren“**.
3. Bei einer Leistung das Symbol **„Reparaturposition entfernen“** → Grund → **„Position entfernen“**.
4. **F5**.

- **Erwartet:** Nach jedem Schritt neuer Gesamtbetrag; nach F5 unverändert. Beträge im deutschen Format (z. B. „49,90 €“).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E6 · Verlauf mit Filtern

- **Rolle:** A oder M · **Voraussetzung:** E4/E5.

1. Reiter **„Verlauf“**.
2. Nacheinander die Filter **„Gerät & Leistungen“**, **„Preise & Rabatte“**, **„Status & Workflow“**, dann **„Alle“**.

- **Erwartet:** Jede Änderung mit Zeit, Person, alt → neu und Grund (z. B. „Gerät korrigiert“, neuer Auftragswert). Filter
  zeigen nur passende Einträge; „Alle“ zeigt wieder alles. Nicht erfasste Zeitpunkte stehen als **„Zeitpunkt nicht erfasst“**,
  nicht als erledigt.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### E7 · Kundensicht nach den Änderungen

- **Rolle:** Kunde des Auftrags · **Voraussetzung:** E4/E5.

1. Gerätedetail öffnen → **„Geplante Leistungen ansehen“**, **„Preisaufstellung“**, Bereich **„Verlauf“** aufklappen.

- **Erwartet:** Neues Gerät, aktuelle Leistungen und neuer Betrag. **Keine** internen Gründe, keine internen Notizen,
  keine Namen von Mitarbeitenden.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### F · Techniker-Workflow: Start, Pause, Fortsetzen, Storno, Abschluss

#### F1 · Workflow zuweisen und ohne Kundeninfo starten

- **Rolle:** M · **Voraussetzung:** Auftrag mit begonnener Eingangsprüfung (E1); Test-Postfach des Kunden.

1. Auftrag → Karte **„Arbeitsabläufe“** → **„Arbeitsablauf zuweisen“**.
2. Im Fenster **„Workflow zuweisen“** bei **„Reparatur-Workflow“** **„Zuweisen“**.
3. Reiter **„Freigabe & Start“**: Schalter **„Kunde informieren“** **aus** lassen, interne Notiz eintragen →
   **„Bestätigen & Starten“**.

- **Erwartet:** Meldung „Die Reparatur wurde gestartet.“; Auftrag „Reparatur in Bearbeitung“. Kunde erhält **nichts**;
  im Verlauf steht der Start für das Team.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F2 · Start mit „Kunde informieren“ an

- **Rolle:** M · **Voraussetzung:** zweiter Testauftrag mit Eingangsprüfung (nur Testkunde).

1. Wie F1, aber Schalter **„Kunde informieren“** **an** → im Feld **„Nachricht an Kunden“** Text eintragen → **„Bestätigen & Starten“**.
2. Als Kunde **„Benachrichtigungen“** öffnen; Test-Postfach prüfen.

- **Erwartet:** Genau **eine** Benachrichtigung und **eine** E-Mail mit dem Kundentext; die interne Notiz steht nirgends beim
  Kunden. Die Oberfläche meldet getrennt, dass der Kunde benachrichtigt wurde.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F3 · Pausieren mit Grund

- **Rolle:** M · **Voraussetzung:** F1 (Workflow läuft).

1. Karte **„Reparatur-Workflow“** → **„Öffnen“** → **„Workflow pausieren“**.
2. Versuchen, ohne Grund zu pausieren; dann **„Pausengrund“** eintragen → **„Pausieren“**.
3. **F5**.

- **Erwartet:** Ohne Grund ist „Pausieren“ gesperrt. Hinweis **„Der Kunde wird beim Pausieren nicht benachrichtigt.“**;
  keine E-Mail an den Kunden. Nach F5 zeigt die Karte **„Pausiert“**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F4 · Fortsetzen

- **Rolle:** M · **Voraussetzung:** F3.

1. **„Öffnen“** → **„Fortsetzen“**.
2. Reiter **„Pause-Historie“** ansehen.

- **Erwartet:** Workflow läuft wieder („Die Reparatur wurde fortgesetzt.“); die Pause steht mit Grund in der Pause-Historie.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F5 · Zwischenfall melden (mit und ohne Kundeninfo)

- **Rolle:** M · **Voraussetzung:** F4 (läuft).

1. **„Zwischenfall melden“** → Art **„Mehr Zeit erforderlich“** → **„Was ist passiert?“** ausfüllen → **„Kunde informieren“**
   an, Kundentext → **„Zwischenfall melden“**.
2. **„Fortsetzen“**, dann einen zweiten Zwischenfall mit **„Kunde informieren“** aus.

- **Erwartet:** Erster Zwischenfall: genau eine Benachrichtigung + eine E-Mail an den Kunden (ohne interne Kurzbeschreibung).
  Zweiter: nichts an den Kunden; das Team sieht beide unter **„Zwischenfälle“** („Kunde benachrichtigt: Ja, am …“ / „Nein“).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F6 · Reparatur abschließen

- **Rolle:** M · **Voraussetzung:** Workflow läuft.

1. **„Öffnen“** → **„Reparatur abschließen“**.
2. Im Fenster **„Reparatur abschließen?“** den Schalter **„Kunde informieren“** (darunter „Benachrichtigung im Kundenkonto
   und E-Mail“) **aus** stellen → **„Ja, abschließen“**.
3. **F5**; als Kunde das Gerätedetail öffnen.

- **Erwartet:** Fenster nennt den Zielstatus und dass Rechnungen und Zahlungen nicht verändert werden. Danach
  **„Reparatur abgeschlossen“** (nicht automatisch „versendet“). Bei Rückgabe per Versand liest der Kunde
  **„Reparatur abgeschlossen – Versand an Sie wird vorbereitet“** (nicht „liegt zur Abholung bereit“); bei Abholung im Laden
  bleibt die Abholformulierung.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F7 · Kunde nachträglich über Abschluss informieren (keine Doppelung)

- **Rolle:** M · **Voraussetzung:** F6 (ohne Kundeninfo abgeschlossen).

1. **„Öffnen“** → **„Kunde über Abschluss informieren“** – schnell **zweimal** klicken.
2. Kunde: Benachrichtigungen und Test-Postfach prüfen.

- **Erwartet:** Genau **eine** Benachrichtigung und **eine** E-Mail; danach wird die Aktion nicht mehr angeboten.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F8 · Auftrag stornieren (nur mit Grund)

- **Rolle:** A oder M · **Voraussetzung:** der Auftrag einer **zusätzlichen, frischen Buchung aus V-1** (nicht der Auftrag
  aus C1 – der wird für H1, H2 und H6 gebraucht). An diesem Auftrag zuerst wie in **E1** die Eingangsprüfung beginnen und wie
  in **F1** den Reparatur-Workflow starten (Auftragsnummer unten eintragen).

1. Diesen Auftrag öffnen → Status oben rechts → **„Storniert“**.
2. Im Fenster **„Auftrag stornieren?“** zuerst ohne Grund versuchen, dann **„Grund“** eintragen → **„Auftrag stornieren“**.

- **Erwartet:** Ohne Grund nicht möglich. Hinweis: Rechnungen und Zahlungen werden **nicht** storniert oder erstattet;
  laufende Workflows werden angehalten. Verlauf zeigt die Stornierung mit Grund.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F9 · Stornierter Auftrag ist gesperrt

- **Rolle:** M · **Voraussetzung:** F8.

1. Auftrag öffnen → Hauptaktion oben ansehen.
2. **„Reparatur-Workflow“** → **„Öffnen“**.

- **Erwartet:** Hauptaktion **„Storniert – Inspektion gesperrt“**; erfasste Prüfdaten sind nur lesbar. Im Workflow:
  **„Auftrag storniert – Arbeitsschritte sind gesperrt“**; „Fortsetzen“ und „Reparatur abschließen“ gehen nicht.
  Fehlermeldungen erscheinen lesbar **über** dem Fenster.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### F10 · Stornierung aufheben (nur Admin)

- **Rolle:** M, dann A · **Voraussetzung:** F8.

1. Als **M**: Statusmenü öffnen.
2. Als **A**: Statusmenü → **„Stornierung aufheben …“** → Grund → **„Stornierung aufheben“**.

- **Erwartet:** Beim Mitarbeiter nur **„Stornierung aufheben (nur Admin)“** (nicht anklickbar). Beim Admin danach Status
  **„Ausstehend“**; angehaltene Workflows bleiben angehalten. Verlauf: „Stornierung aufgehoben“ mit Grund.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### G · Nachrichten, Reklamationen, interne Notizen, Benachrichtigungen

#### G1 · Zentrales Postfach: Quellen, Filter, Suche

- **Rolle:** A, dann M · **Voraussetzung:** KT4, B2.

1. **„Nachrichten“** → Quellen **„Aufträge“**, **„Reparaturanfragen“**, **„Reklamationen“** (Admin zusätzlich
   **„Kontaktanfragen“**) nacheinander anklicken.
2. Filter **„Ungelesen“**, **„Antwort ausstehend“**; Suche nach Auftrags-, Buchungs-, Anfrage- oder Reklamationsnummer.
3. Dasselbe als **M**.

- **Erwartet:** Ein Klick öffnet das Gespräch rechts; dort wird geantwortet. Zähler stimmen mit der Liste überein. Hinweis:
  „Ungelesen“ gilt nur für Sie, „Antwort ausstehend“ für das ganze Team. Fällt eine Quelle aus, steht ein gelber Hinweis
  **„Nicht alle Nachrichten konnten geladen werden“** mit **„Erneut versuchen“** – nie „keine Nachrichten“.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G2 · Gast schreibt über den Tracking-Link

- **Rolle:** G, dann A · **Voraussetzung:** B2.

1. Gast öffnet den Tracking-Link aus der E-Mail und schreibt eine Nachricht.
2. **A**: **„Nachrichten“** → Quelle **„Reparaturanfragen“** → Gespräch → **„Nachricht an Kunden senden“**.
3. Gast lädt die Tracking-Seite neu.

- **Erwartet:** Gast-Gespräch auffindbar; Antwort erscheint auf der Tracking-Seite des Gasts.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G3 · Interne Notiz im Auftrag

- **Rolle:** M · **Voraussetzung:** Testauftrag.

1. Auftrag → Reiter **„Kommunikation“** → Modus **„Interne Notiz“** → Text → **„Interne Notiz speichern“**.
2. **„Entwurf verwerfen“** an einem neuen, nicht gesendeten Text ausprobieren.
3. Kunde öffnet den Auftrag.

- **Erwartet:** Notiz nur für das Team sichtbar. „Entwurf verwerfen“ löscht nur den Entwurf, nichts Gesendetes.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G4 · Aktion vom Kunden anfordern und erledigen

- **Rolle:** A, dann Kunde · **Voraussetzung:** Testauftrag.

1. Auftrag → **„Weitere Aktionen“** → nur **„Aktion vom Kunden anfordern“** anklicken (keinen anderen Menüeintrag,
   insbesondere keinen Versand-Eintrag) → im Reiter „Kommunikation“ unter **„Beschreibung für den Kunden“** Text eintragen
   (z. B. „Bitte Zustimmung zum Teiletausch“) → **„Aktion an Kunden senden“**.
2. Kunde öffnet das Gerätedetail bzw. **„Nachrichten“** → Aktion erledigen.
3. Kunde und Admin laden neu.

- **Erwartet:** Kunde sieht die Aufforderung mit Schaltfläche zum Erledigen; danach **„Erledigt“** – auch nach dem Neuladen
  und beim Team.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G5 · Reklamation anmelden (Kunde)

- **Rolle:** Kunde · **Voraussetzung:** ein Testauftrag des Kunden mit Status **„Abgeschlossen“** (Admin setzt ihn über das Statusmenü).

1. Gerätedetail öffnen → **„Reklamation anmelden“**.
2. **„Reklamationsgrund“** ausfüllen → **„Reklamation senden“**.
3. Profilmenü → **„Reklamationen“** (Seite **„Meine Reklamationen“**).

- **Erwartet:** Reklamation erscheint mit Nummer (**CMP-…**) und Status; im Auftrag steht „Reklamation angefragt“.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G6 · Nachrichten zur Reklamation

- **Rolle:** Kunde, dann A · **Voraussetzung:** G5.

1. Kunde: Reklamation öffnen → **„Nachricht schreiben…“** → senden.
2. **A**: **„Nachrichten“** → Quelle **„Reklamationen“** → Gespräch → **„Nachricht an Kunden senden“**; zusätzlich
   **„Interne Notiz“** speichern.
3. Kunde lädt die Reklamation neu.

- **Erwartet:** Antwort beim Kunden sichtbar, interne Notiz nicht. **Nicht** auf **„Genehmigen & DHL-Einsendelabel
  erstellen“** klicken (Seite „Reklamationen“, auch über „Zur Reklamation“ im Postfach erreichbar – echtes DHL-Label,
  Teil 3, X5).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G7 · Reklamation durch den Admin ablehnen (ohne Label)

- **Rolle:** A, dann Kunde · **Voraussetzung:** eine offene Test-Reklamation eines **Testkunden** mit Status **„Wartet auf
  Freigabe“**, angelegt wie in G5 (eine zweite Reklamation, falls die aus G5/G6 für X5 aufgehoben wird). Die Ablehnung
  schickt dem Kunden ein Reparaturangebot – nur bei einem Testkunden ausführen.

1. **A**: linke Leiste **„Reklamationen“** → in der Liste die Reklamation (**CMP-…**) anklicken (die Details öffnen sich).
2. Im Kasten **„Aktionen“** **„Admin: Ablehnen & Angebot senden“** klicken – **nicht** „Genehmigen & DHL-Einsendelabel
   erstellen“ (echtes DHL-Label, Teil 3, X5).
3. Im Fenster **„Reklamation ablehnen und Angebot senden“** **„Ablehnungsgrund des Technikers“**, **„Angebotspreis (EUR)“**
   (z. B. 0) und **„Angebotsbeschreibung“** ausfüllen → **„Ablehnen und Angebot senden“**.
4. Kunde: Profilmenü → **„Reklamationen“** → Reklamation öffnen (nur ansehen, **nicht** auf „Angebot annehmen“ oder
   „Angebot ablehnen“ klicken); Test-Postfach prüfen.

- **Erwartet:** „Ablehnen und Angebot senden“ ist erst anklickbar, wenn Ablehnungsgrund und Angebotsbeschreibung ausgefüllt
  sind. Danach Meldung **„Reklamation wurde abgelehnt und das Angebot an den Kunden gesendet.“**; Status in der Liste
  **„Reklamation abgelehnt“**. Es entsteht **kein** DHL-Label (kein Bereich „DHL-Einsendelabel (Kunde → McRepair)“). Der
  Kunde sieht den Status **„Angebot vorhanden“** und den Kasten **„Reparaturangebot“** und erhält genau eine Benachrichtigung
  bzw. E-Mail zum neuen Reparaturangebot.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### G8 · Benachrichtigungsseite ist sauber

- **Rolle:** Kunde · **Voraussetzung:** einige Benachrichtigungen aus den vorigen Szenarien.

1. Profilmenü → **„Benachrichtigungen“**.

- **Erwartet:** Nur verständliche deutsche Texte; keine Programmtexte wie „notificationsPage…“, „Subtitle“, „Suchen
  Placeholder“; keine langen Zeichenketten aus Buchstaben und Zahlen.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### H · Rechnung, PDF, Vorauszahlung, Teil- und Überzahlung, Zahlungsaufforderung, Storno

**Für den ganzen Abschnitt H – nicht klicken:** auf den Seiten **„Rechnungen“** und **„Gutschriften“** oben rechts
**„Mahnlauf“** (startet sofort ohne Rückfrage und schreibt alle Kunden mit fälligen Rechnungen an – Teil 3, X8; ebenso
„Mahnlauf ausführen“ und „System-Mahnlauf“) und im Fenster **„Zahlungen – Buchung BKG-…“** (geöffnet über „Zahlungen
verwalten“) **„Eingegangene PayPal-Zahlungen abgleichen“** (verbindet sich mit PayPal – Teil 3, X9).

#### H1 · Rechnung erstellen (auch bei Doppelklick nur eine)

- **Rolle:** A · **Voraussetzung:** Auftrag aus C1 (49,90 €, noch ohne Rechnung, unbezahlt).

1. Auftrag → Reiter **„Rechnungen & Zahlungen“** → **„Rechnung erstellen“** schnell **zweimal** klicken.

- **Erwartet:** Genau **eine** Rechnung **INV-JJJJ-NNNN** über 49,90 €; der zweite Klick erzeugt keine weitere.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H2 · Rechnungs-PDF und Kundensicht

- **Rolle:** A, dann N · **Voraussetzung:** H1.

1. **A**: linke Leiste **„Rechnungen“** → Rechnung suchen → **„Aktionen“** → **„PDF herunterladen“**.
2. **N**: Profilmenü → **„Buchungen“** → **„Rechnungen & Zahlungen“** → **„PDF“**.

- **Erwartet:** PDF mit Gesamt **49,90 €**, Netto **41,93 €**, MwSt. 19 % **7,97 €**; der Kunde erreicht dieselbe Rechnung an
  der Buchung. (Für die Partnerbuchung aus KT2: 47,40 € / 39,83 € / 7,57 €, Rabatt 2,50 €.)
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H3 · Vorauszahlung vor der Rechnung

- **Rolle:** A · **Voraussetzung:** ein neuer Testauftrag ohne Rechnung (z. B. eine zusätzliche Partnerbuchung 47,40 €, V-1).

1. Auftrag → **„Rechnungen & Zahlungen“** → **„Zahlungen verwalten“** (Fenster **„Zahlungen – Buchung BKG-…“**) →
   **Betrag (EUR)** 47,40 (wird „47,40“ nicht angenommen, „47.40“ eingeben) als **„Überweisung“** → **„Zahlung speichern“**.
   **Nicht klicken:** **„Eingegangene PayPal-Zahlungen abgleichen“** (Teil 3, X9).
2. Linke Leiste **„Rechnungen“** → Reiter **„Zahlungen“**: die Zahlung suchen.
3. Zurück im Auftrag **„Rechnung erstellen“**.

- **Erwartet:** In der Zahlungsliste ist die Zahlung mit Buchung/Auftrag verknüpft, mit Verwendungszweck, und als
  **„Vorauszahlung – Rechnung folgt“** gekennzeichnet. Nach dem Erstellen der Rechnung ist die Zahlung ihr zugeordnet,
  Offen = 0,00 €.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H4 · Teilzahlung

- **Rolle:** A · **Voraussetzung:** Testbuchung über 47,40 €, auf die noch **nichts** gebucht wurde (eine zusätzliche
  Partnerbuchung aus V-1 – **nicht** die Buchung aus KT2 und nicht die aus H3).

1. **„Zahlungen verwalten“** (Fenster **„Zahlungen – Buchung BKG-…“**) → **Betrag (EUR)** **20,00** (bei Ablehnung „20.00“)
   als **„Überweisung“** → **„Zahlung speichern“**. **Nicht klicken:** **„Eingegangene PayPal-Zahlungen abgleichen“**
   (Teil 3, X9).
2. Denselben Betrag nicht doppelt absenden (nur einmal klicken) → **„Schließen“**; Karte **„Zahlungsstand“** ablesen.

- **Erwartet:** **Bezahlt 20,00 €**, **Offen 27,40 €**, Zahlungswort **„Teilbezahlt“**; keine Fehlermeldung.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H5 · Überzahlung

- **Rolle:** A · **Voraussetzung:** H4.

1. **„Zahlungen verwalten“** (Fenster **„Zahlungen – Buchung BKG-…“**) → weitere **30,00** € (Feld **Betrag (EUR)**; bei
   Ablehnung „30.00“) als **„Überweisung“** → **„Zahlung speichern“** → **„Schließen“**. **Nicht klicken:**
   **„Eingegangene PayPal-Zahlungen abgleichen“** (Teil 3, X9).

- **Erwartet:** **Bezahlt 50,00 €**, **Offen 0,00 €** und **„Überzahlt · Erstattung offen 2,60 €“**. Eine Erstattung wird
  **nicht** ausgelöst (siehe Teil 3, X3).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H6 · Zahlungsaufforderung (nur an Testkunden)

- **Rolle:** A · **Voraussetzung:** H1 (Rechnung offen, Kunde = Testkunde N).

1. **„Rechnungen“** → bei der Rechnung **„Aktionen“** → **„Zahlungsaufforderung senden …“**.
2. Empfänger prüfen (**muss** die Test-Adresse sein, sonst abbrechen), Betrag, Bezug und **„Bisherige Aufforderungen“**
   ansehen → **„Jetzt per E-Mail senden“** (einmal klicken).
3. Sofort das Fenster erneut öffnen (**„Aktionen“** → **„Zahlungsaufforderung senden …“**) → noch einmal **„Jetzt per
   E-Mail senden“** klicken.
4. Beim dann erscheinenden Hinweis **„Abbrechen“** klicken (**nicht** „Trotzdem erneut senden“); Test-Postfach prüfen.

- **Erwartet:** Genau **eine** E-Mail, auch nach Schritt 3 **keine zweite**. Der zweite Klick auf „Jetzt per E-Mail senden“
  zeigt den Hinweis **„Zuletzt am … an … gesendet (…) – trotzdem erneut senden?“** (mit Empfängeradresse und Betrag), und
  die Schaltfläche heißt jetzt **„Trotzdem erneut senden“**; erneutes Senden ginge nur darüber. (Beim bloßen Öffnen des
  Fensters erscheint der Hinweis noch nicht; die erste Aufforderung steht dann unter „Bisherige Aufforderungen“.) Das gilt
  auch, wenn die erste Aufforderung über die Buchung ging.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H7 · Rechnung aus Aufträgen erstellen (Vorschau)

- **Rolle:** A · **Voraussetzung:** ein Testauftrag ohne Rechnung und einer mit Rechnung (H1), beide vom selben Testkunden.

1. **„Rechnungen“** → **„Rechnung aus Aufträgen erstellen“**.
2. Beide Aufträge über Nummer oder Kundenname auswählen → **„Vorschau“** ansehen.

- **Erwartet:** Erst eine Vorschau; der bereits berechnete Auftrag wird gemeldet („… die bestehende Rechnung zuerst
  stornieren“) und nicht doppelt berechnet. Ohne ihn entsteht genau eine Rechnung.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H8 · Rechnung stornieren (Storno-Gutschrift)

- **Rolle:** A · **Voraussetzung:** eine unbezahlte Test-Rechnung.

1. **„Rechnungen“** → **„Aktionen“** → **„Status ändern“** → **„Neuer Status“** = „Storniert“.
2. Zuerst ohne Notiz speichern; dann im Feld „Notiz“ den Grund eintragen → **„Status speichern“**.
3. Danach für denselben Auftrag erneut **„Rechnung erstellen“**.

- **Erwartet:** Ohne Grund Meldung „Bitte im Feld „Notiz“ den Grund für das Storno angeben.“ Mit Grund entsteht eine
  **Storno-Gutschrift INV-CN-…**; die Originalrechnung bleibt lesbar. Eine neue Rechnung ist danach möglich.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H9 · Gutschrift erstellen

- **Rolle:** A · **Voraussetzung:** eine Test-Rechnung.

1. **„Rechnungen“** → **„Aktionen“** → **„Gutschrift erstellen“** → **„Umfang der Gutschrift“** wählen, Begründung →
   **„Vorschau Gutschrift“** prüfen → **„Gutschrift erstellen“**.
2. Linke Leiste **„Gutschriften“** öffnen. **Nicht klicken:** **„Mahnlauf“** oben rechts neben „Aktualisieren“ (startet
   sofort ohne Rückfrage – Teil 3, X8).

- **Erwartet:** Vorschau zeigt Nettobetrag, 19 % MwSt. und Gesamtbetrag brutto (nicht 0,00 €). Die Gutschrift steht unter
  „Gutschriften“ mit Bezug zur Rechnung, nicht unter „Rechnungen“. Sie wird beim Anlegen nicht automatisch an den Kunden geschickt.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### H10 · Kennzahlen in Analysen

- **Rolle:** A · **Voraussetzung:** einige Testaufträge, Rechnungen und Zahlungen.

1. Linke Leiste **„Analysen“**.

- **Erwartet:** Drei getrennte Kennzahlen: **„Auftragswert (netto)“**, **„Fakturiert (netto)“**, **„Zahlungseingang (brutto)“**;
  alle Beträge in €.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### I · Lieferanten, Ersatzteile, Sendungsnummer, Einstellungen

#### I1 · Lieferant im kleinen Fenster anlegen

- **Rolle:** A · **Voraussetzung:** Browserfenster auf ca. 780 × 720 verkleinern **oder** Ansicht mit Strg + Plus auf 200 %.

1. **„Ersatzteilbestellungen“** → Reiter **„Lieferanten“** → **„Lieferant anlegen“**.
2. Alle Felder ausfüllen (Test-Name, Test-E-Mail) → bis **„Lieferant speichern“** scrollen und klicken.
3. **F5**; danach Fenstergröße/Ansicht zurücksetzen (Strg + 0).

- **Erwartet:** Alle Felder und „Lieferant speichern“ sind durch normales Scrollen erreichbar. Lieferant steht in der Liste,
  auch nach F5.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I2 · Gleichen Lieferanten doppelt anlegen

- **Rolle:** A · **Voraussetzung:** I1.

1. **„Lieferant anlegen“** mit genau demselben Namen und derselben E-Mail → **„Lieferant speichern“**.

- **Erwartet:** Meldung **„Ein Lieferant mit diesem Namen und dieser E-Mail existiert bereits.“**; die eingegebenen Daten
  bleiben im Formular.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I3 · Bestellung, Sendungsnummer, Suche

- **Rolle:** A · **Voraussetzung:** KT9 oder neue Bestellung (Menge 5, Status „Bestellt“).

1. Reiter **„Bestellungen“** → Suchfeld **„Suche (Bestellnr., Notiz, Sendungsnr.)“** mit der Sendungsnummer aus KT9.
2. Bestellung öffnen → Reiter **„Verlauf“**.

- **Erwartet:** Die Suche findet genau diese Bestellung (**EPO-NNNNNN**). Im Verlauf steht die erfasste Sendungsnummer mit Person.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I4 · Wareneingang teilweise und Überbuchung

- **Rolle:** A · **Voraussetzung:** Bestellung mit Status „Bestellt“ (z. B. Menge 5).

1. Bestellung öffnen → **„Wareneingang buchen“** → erhaltene Menge **2** → **„Wareneingang speichern (2 Stück)“**.
2. Erneut **„Wareneingang buchen“** → Menge **4** eintragen (mehr als offen).
3. Menge **3** → speichern.

- **Erwartet:** Nach Schritt 1 Status „Teilweise erhalten“, offen 3 von 5. Schritt 2 wird abgelehnt (Meldung im Fenster).
  Nach Schritt 3 Status „Erhalten“. Auch im kleinen Fenster (780 × 720) bleibt „Speichern“ erreichbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I5 · Einstellungen der Auswertung speichern

- **Rolle:** A · **Voraussetzung:** keine. Ursprünglichen Wert notieren: ____________

1. **„Analysen“** → **„Einstellungen“** (Fenster **„Einstellungen der Auswertung“**) → Reiter **„Zeit“** → **„Stundensatz“** = 95,5
   → **„Einstellungen speichern“**.
2. **F5**, Einstellungen erneut öffnen. Danach den ursprünglichen Wert wiederherstellen und speichern.

- **Erwartet:** 95,5 ist gespeichert. Felder ohne Wirkung sind gekennzeichnet.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I6 · Finanzeinstellungen speichern, ohne andere Bereiche zu überschreiben

- **Rolle:** A · **Voraussetzung:** I5. Ursprünglichen Wert notieren: ____________

1. **„Rechnungen“** → Reiter **„Einstellungen“** → **„Zahlungsziel in Tagen“** z. B. auf 10 → **„Finanzeinstellungen speichern“**.
2. **F5**; dann **„Analysen“ → „Einstellungen“** öffnen.
3. Ursprünglichen Wert wiederherstellen und speichern.

- **Erwartet:** Beide Werte bleiben gespeichert; das Speichern des einen Bereichs ändert den anderen **nicht**. Währung EUR mit
  Hinweis **„Fest EUR – keine Umrechnung“**; wirkungslose Felder tragen **„Vorbelegung – derzeit ohne Wirkung“**.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### I7 · Workflow-Vorlagen: wirkungslose Schalter gesperrt

- **Rolle:** A · **Voraussetzung:** keine.

1. **„Systemverwaltung“** → **„Workflowverwaltung“** → eine Vorlage öffnen → einen Schritt bearbeiten.

- **Erwartet:** „Pflichtschritt (nicht unterstützt)“, „Freigabe erforderlich (nicht unterstützt)“, „Formular vollständig
  ausfüllen (nicht unterstützt)“ und „Benachrichtigungen (Vorlage) – nicht unterstützt“ sind gesperrt und erklärt; maßgeblich
  ist der Schalter „Kunde informieren“ im Arbeitsschritt (F1/F2).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### J · Bedienung für Kunden und Personal, kleine Bildschirme

#### J1 · Aufgaben ohne Hilfe lösen (Personal)

- **Rolle:** M (eine Kollegin / ein Kollege, die/der den Ablauf nicht kennt) · **Voraussetzung:** Testdaten aus Teil 1;
  die testende Person ist als **M** angemeldet, für die letzte Aufgabe (Ersatzteil) als **A** – **„Ersatzteilbestellungen“**
  gibt es nur im Admin-Menü. Eine zweite Person liest vor und notiert.

1. Die erste Aufgabe aus der Tabelle wörtlich vorlesen – **nichts erklären**, keine Hinweise geben.
2. Zeit messen, bis die Aufgabe gelöst ist oder aufgegeben wird; Zögern und Suchstellen beobachten.
3. In der Zeile eintragen: geschafft?, Zeit, wo gezögert, leicht / mittel / schwer.
4. Schritte 1–3 für die übrigen vier Aufgaben wiederholen.

| Aufgabe (vorlesen) | geschafft? | Zeit | wo gezögert? | leicht / mittel / schwer |
|---|---|---|---|---|
| „Der Kunde hat zu seinem Auftrag geschrieben. Finde die Nachricht, antworte ihm und lege eine interne Notiz an.“ | ☐ ja ☐ nein | | | |
| „Wie viel hat der Kunde schon bezahlt, und was ist noch offen?“ | ☐ ja ☐ nein | | | |
| „Lade das DHL-Einsendelabel dieses Auftrags herunter.“ | ☐ ja ☐ nein | | | |
| „Wer hat bei diesem Auftrag wann den Status oder das Gerät geändert, und warum?“ | ☐ ja ☐ nein | | | |
| „Bestelle ein Ersatzteil und trage die Sendungsnummer ein.“ | ☐ ja ☐ nein | | | |

- **Erwartet:** Jede Aufgabe ohne Rückfrage; Nachricht ≤ 1 Minute, Label ≤ 2 Klicks (im geöffneten Auftrag Reiter
  **„Versand“** → Karte „Einsendung“ → **„Testlabel herunterladen (PDF)“**; im Live-Betrieb „Einsendelabel herunterladen
  (PDF)“), Verlauf ≤ 30 Sekunden.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J2 · Aufgaben ohne Hilfe lösen (Kunde)

- **Rolle:** Kunde P (Person, die die Seite nicht kennt) · **Voraussetzung:** Buchung mit zwei Geräten (C3).

1. Vorlesen: „Öffne die Reparatur deines zweiten Geräts.“ → Klicks zählen.
2. Vorlesen: „Was musst du als Nächstes tun?“
3. Im Gerätedetail **Zurück** klicken.

- **Erwartet:** Profilmenü → **„Buchungen“** → **„Details ansehen“** (höchstens 3 Klicks, richtiges Gerät). „Nächster Schritt“
  ist ohne Suchen erkennbar. Nach „Zurück“ sind Suchbegriff und Filter der Buchungsliste noch gesetzt.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J3 · Listen beim Personal ohne seitliches Scrollen

- **Rolle:** A · **Voraussetzung:** Bildschirm/Fenster etwa 1366 × 768.

1. **„Reparaturaufträge“** und **„Buchungen“** öffnen (nur ansehen; auf „Buchungen“ **nicht** auf **„Versandstatus
   prüfen“** klicken – Teil 3, X9).

- **Erwartet:** Nummer, Kunde/Gerät, Reparaturstatus, Zahlungsstatus und Aktionen sind ohne seitliches Scrollen sichtbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J4 · Schmales Fenster: Menü über Symbol

- **Rolle:** A · **Voraussetzung:** Fenster schmal ziehen (ca. halbe Bildschirmbreite oder schmaler).

1. Eine Admin-Seite öffnen; Menü über das Menü-Symbol (drei Striche, oben links) öffnen und wieder schließen.

- **Erwartet:** Die Seitenleiste liegt nicht dauerhaft über dem Inhalt; sie öffnet sich nur über das Menü-Symbol.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J5 · Dialoge bei 780 × 720 und bei 200 %

- **Rolle:** A · **Voraussetzung:** Fenster 780 × 720 bzw. Strg + Plus bis 200 %.

1. Nacheinander öffnen: das Fenster **„Zahlungen – Buchung BKG-…“** (im Auftrag über **„Zahlungen verwalten“**),
   **„Bestellung anlegen“** (Ersatzteile), **„Gerät ändern“** (Auftrag). Nur scrollen und wieder schließen; im Fenster
   „Zahlungen – Buchung BKG-…“ **nicht** auf **„Eingegangene PayPal-Zahlungen abgleichen“** klicken (Teil 3, X9).

- **Erwartet:** In jedem Dialog sind alle Felder und die Schaltflächen unten durch Scrollen im Dialog erreichbar; nichts ist
  abgeschnitten. Danach Strg + 0.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J6 · Meldungen erscheinen über Dialogen

- **Rolle:** M · **Voraussetzung:** Testauftrag.

1. Einen Dialog öffnen, in dem gespeichert wird (z. B. Workflow **„Bestätigen & Starten“** oder **„Workflow pausieren“**).

- **Erwartet:** Die Meldung erscheint oben rechts **über** dem Dialog, ist lesbar und verdeckt die Schaltflächen unten nicht.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### J7 · Kunde am Smartphone: Bestellung bis Label

- **Rolle:** P · **Voraussetzung:** Smartphone (ca. 390 px), V-2.

1. Am Smartphone eine Leistung in den Warenkorb legen, mit **„Rechnung“** bestellen.
2. Auf der Erfolgsseite **„Testlabel herunterladen“**.
3. Profilmenü → **„Buchungen“** → **„Details ansehen“** → **„Nachrichten zum Auftrag“** eine Nachricht schreiben.

- **Erwartet:** Jeder Schritt ohne seitliches Scrollen und ohne Zoomen bedienbar; Beträge vollständig lesbar.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### K · Entfallene Funktionen und ihr Ersatz (bitte bewusst prüfen)

(Die Szenarien K1 und K2 dieses Abschnitts sind nicht die Kurztest-Szenarien KT1 und KT2 aus Teil 1.)

| Entfallen | Warum | Ersatz / so geht es jetzt |
|---|---|---|
| Status-Umschalter direkt in der Liste **„Reparaturaufträge“** | erlaubte Storno ohne Grund und ohne Verlaufseintrag | Liste → **„Auftrag öffnen“** → Status oben im Auftrag → neuer Status (3 Klicks); Storno nur mit Grund; beide Wechsel im **Verlauf**. Die Liste zeigt den Status weiter (stornierte Aufträge ohne Zahlung als „Storniert“, nicht „Offen“). |
| Gerätebilder im Buchungsdetail des Kunden | viele Katalogsuchen je Gerät, kein gespeichertes Bild am Auftrag | **„Details ansehen“** öffnet das Gerät direkt (1 Klick). |
| Schalter in Workflow-**Vorlagen** (Benachrichtigungen, Pflichtschritt, Freigabe, Formular, Automationsregeln) | wurden nirgends ausgewertet | gesperrt mit Erklärung; Kundeninformation über **„Kunde informieren“** im Arbeitsschritt (F1, F2, F7). |
| Beispiel-Zugangsdaten auf der Anmeldeseite und `/debug` | Standardpasswörter für alle sichtbar | entfallen (A1). |
| Automatisches Zurücksetzen des Admin-Passworts bei jedem Neustart des Systems | Kontoübernahme mit bekanntem Standardpasswort | Passwortänderung über **„Passwort vergessen“**; die Prüfung nach einem Neustart des Systems durch die Technik macht die Entwicklung. |

#### K1 · Status nur noch im Auftrag

- **Rolle:** A · **Voraussetzung:** Testauftrag.

1. **„Reparaturaufträge“** → Liste ansehen (kein Status-Umschalter).
2. **„Auftrag öffnen“** → Status oben → neuer Status.

- **Erwartet:** In der Liste kein Umschalter; im Auftrag 3 Klicks bis zum neuen Status; Verlaufseintrag vorhanden.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### K2 · Gerät statt Bild: direkt öffnen

- **Rolle:** Kunde · **Voraussetzung:** Buchung vorhanden.

1. Profilmenü → **„Buchungen“** → Gerätezeile.

- **Erwartet:** Keine Gerätebilder mehr; **„Details ansehen“** öffnet das Gerät mit einem Klick. Fehlt Ihnen etwas
  Wichtiges, bitte bei „Beobachtet“ notieren.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

### L · Sicherheit (kurz)

#### L1 · Gast-Tracking-Link nicht erratbar

- **Rolle:** G · **Voraussetzung:** Tracking-Link aus B2.

1. Tracking-Link öffnen.
2. In der Adresszeile im Teil nach `token=` **ein** Zeichen ändern.
3. Den geänderten Link öffnen (Eingabetaste).

- **Erwartet:** Original öffnet die Anfrage; geänderter Link zeigt „nicht gefunden“ und keine Daten.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### L2 · Profil speichern, Rolle nicht änderbar

- **Rolle:** N · **Voraussetzung:** angemeldet.

1. Profilmenü → **„Profil“** → Name, Telefon, Adresse ändern → **„Änderungen speichern“** → **F5**.

- **Erwartet:** Änderungen bleiben; Rolle, Status und E-Mail lassen sich hier nicht ändern.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### L3 · Keine Admin-Daten im Bestellformular

- **Rolle:** G und N · **Voraussetzung:** keine.

1. `/new-order` öffnen und bis zum Schritt **„Details“** gehen (Schritte: Gerät, Dienste, Details, Überprüfung, Warenkorb);
   dort den Abschnitt **„Kundeninformationen“** ansehen – einmal als Gast, einmal angemeldet als N.

- **Erwartet:** Gast: „—“; angemeldet: eigener Name und eigene E-Mail. Nirgends „Admin User“ oder eine Admin-Adresse.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### L4 · E-Mail-Verwaltung lädt

- **Rolle:** A · **Voraussetzung:** keine.

1. **„Systemverwaltung“** → **„Email-Verwaltung“**.

- **Erwartet:** Statistik, Verlauf und Protokoll laden ohne Fehler.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

---

## Teil 3 – [!] Nur mit ausdrücklicher Freigabe (nicht selbstständig ausführen)

Diese Schritte kosten echtes Geld, erzeugen echte (kostenpflichtige) DHL-Labels oder schreiben echte Personen an.
**Erst ausführen, wenn eine verantwortliche Person die Freigabe hier einträgt.** Ohne Freigabe: **Nicht getestet** ankreuzen.

#### X1 · [!] Zahlung mit PayPal

- **Rolle:** Kunde (Testkonto P oder N) · **Voraussetzung:** Freigabe unten eingetragen; die Entwicklung hat bestätigt, ob
  PayPal-Sandbox oder echtes PayPal-Konto; eine Leistung liegt im Warenkorb.
- **Risiko:** echtes Geld (bzw. PayPal-Sandbox nur, wenn die Entwicklung das bestätigt).
- **Freigegeben von / am:** ______________________ · Sandbox bestätigt: ☐ ja ☐ nein

1. Bestellung bis **„Zahlungsmethode“** → **„PayPal“** → PayPal-Schaltfläche.

- **Erwartet:** Nach erfolgreicher Zahlung ist die Buchung bezahlt; die Zahlung erscheint unter **„Rechnungen“ → „Zahlungen“**
  und wird der späteren Rechnung automatisch zugeordnet.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X2 · [!] Gast-Bestellung abschließen bzw. Option „Kredit- oder Debitkarte“

- **Rolle:** G · **Voraussetzung:** Freigabe mit den erlaubten Testdaten unten eingetragen; C4 bis **„Zahlungsmethode“**
  durchführbar; Test-Postfach des Gasts.
- **Risiko:** Als Gast werden nur PayPal und Karte angeboten. Bei „Kredit- oder Debitkarte“ werden Kartendaten abgefragt;
  ob und wie dabei abgebucht wird, ist nicht abgenommen (siehe „Nicht Teil der Abnahme“). **Keine echten Kartendaten.**
- **Freigegeben von / am:** ______________________ · erlaubte Testdaten: ______________________

1. Wie C4, aber bis zum Abschluss.

- **Erwartet:** wird bei der Freigabe festgelegt.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X3 · [!] Erstattung (Überzahlung zurückzahlen)

- **Rolle:** A (freigebende Person anwesend) · **Voraussetzung:** Freigabe unten eingetragen; eine Überzahlung aus H5
  (Anzeige „Überzahlt · Erstattung offen …“); geklärt, ob und wohin tatsächlich Geld fließt.
- **Risiko:** echtes Geld (PayPal-Erstattung bzw. Banküberweisung an den Kunden).
- **Freigegeben von / am:** ______________________

1. Linke Leiste **„Rechnungen“** → Reiter **„Zahlungen“** → eine Zahlung der Buchung aus H5 suchen → in ihrer Zeile
   **„Erstattung“** (erscheint nur bei abgeschlossenen Zahlungen; bei einer Rechnung zusätzlich im Fenster mit den
   Rechnungsdetails über „Aktionen“).
2. Im Erstattungsfenster den vorgeschlagenen Betrag prüfen: erstattet wird **nur** die offene Erstattung von **2,60 €** –
   einen höheren vorbelegten Betrag vorher ändern. Erst dann bestätigen.

- **Erwartet:** Erstattung über 2,60 € verbucht; „Überzahlt · Erstattung offen“ sinkt entsprechend (auf 0,00 €).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X4 · [!] Auslieferungslabel „An Kunden versenden“

- **Rolle:** A · **Voraussetzung:** Freigabe unten eingetragen; Bestätigung der Entwicklung (keine DHL-Zugangsdaten bzw.
  DHL-Sandbox) **oder** erster echter Versand; Testauftrag im Status „Reparatur abgeschlossen“ (F6).
- **Risiko:** Für Auslieferungslabels gibt es **keinen** Testmodus. Mit echten DHL-Zugangsdaten entsteht ein **echtes,
  kostenpflichtiges** Label. Nur, wenn die Entwicklung bestätigt, dass das System keine DHL-Zugangsdaten hat oder auf
  DHL-Sandbox steht – oder beim ersten echten Versand nach der Auslieferung.
- **Freigegeben von / am:** ______________________ · DHL-Sandbox/keine Zugangsdaten bestätigt: ☐ ja ☐ nein

1. Auftrag (Reparatur abgeschlossen) → **„Weitere Aktionen“** → **„An Kunden versenden (McRepair → Kunde)“**.
2. Reiter **„Versand“** → Karte **„Auslieferung“** (Untertitel „McRepair → Kunde“) → **„Versandlabel herunterladen (PDF)“**.
3. Label lesen.

- **Erwartet:** Auf dem Label **Absender McRepair, Empfänger Kunde** (nicht umgekehrt). Kein zweites Label bei erneutem Klick
  („Versandlabel bereits erstellt“).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X5 · [!] Reklamation genehmigen (erzeugt ein DHL-Einsendelabel)

- **Rolle:** A, dann Kunde, dann N · **Voraussetzung:** Freigabe unten eingetragen; Bedingung wie X4 bestätigt; offene
  Test-Reklamation aus G5 mit Status **„Wartet auf Freigabe“** (nicht die in G7 abgelehnte).
- **Risiko:** Beim Genehmigen wird sofort ein DHL-Label erzeugt – **ohne** Testmodus. Gleiche Bedingung wie X4.
- **Freigegeben von / am:** ______________________

1. Admin: linke Leiste **„Reklamationen“** → Reklamation in der Liste anklicken → **„Genehmigen & DHL-Einsendelabel
   erstellen“** (dieselbe Seite öffnet sich auch über „Zur Reklamation“ im Postfach).
2. Kunde: **„Reklamationen“** → Reklamation → **„Versandlabel herunterladen / drucken“**; **„Benachrichtigungen“** ansehen.
3. Fremder Kunde N versucht, das Label aufzurufen.

- **Erwartet:** PDF wird heruntergeladen; die Benachrichtigung ist kurz und bietet **„Versandlabel herunterladen“**; N hat
  keinen Zugriff.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X5b · [!] Reklamation durch den Techniker ablehnen (Weitergabe an den Admin)

- **Rolle:** M, dann A · **Voraussetzung:** X5 ausgeführt (Reklamation genehmigt; Status auf der Seite „Reklamationen“:
  **„Zur Prüfung eingesendet“**); Kunde = Testkunde; Freigabe unten eingetragen. Den Kasten **„Reklamation entscheiden“**
  gibt es erst nach dieser Genehmigung; Schritte 1–2 als **M** ausführen (nicht als Admin).
- **Risiko:** Nach der Weitergabe zeigt die Seite „Reklamationen“ wieder **„Genehmigen & DHL-Einsendelabel erstellen“** –
  **nicht** klicken (würde ein weiteres echtes DHL-Label erzeugen). Die abschließende Admin-Ablehnung (Schritt 4) schickt
  dem Kunden ein Reparaturangebot – nur an den Testkunden.
- **Freigegeben von / am:** ______________________

1. **M**: den Reklamationsauftrag aus X5 öffnen (Nummer steht beim Admin auf der Seite „Reklamationen“ in der Spalte
   „Rekla-Auftrag“; der Admin öffnet ihn über „Reklamationsauftrag bearbeiten“ und gibt die Adresse aus der Adresszeile
   weiter, wie in A4) → im Kasten **„Reklamation entscheiden“** **„Ablehnen“**.
2. Im Fenster **„Reklamation ablehnen“** einen Ablehnungsgrund auswählen oder eintragen → **„Ablehnen“**.
3. **A**: denselben Auftrag öffnen (nur ansehen); dann linke Leiste **„Reklamationen“** → die Reklamation anklicken.
4. **A**: **„Admin: Ablehnen & Angebot senden“** → im Fenster **„Reklamation ablehnen und Angebot senden“** die vorbelegten
   Angaben prüfen → **„Ablehnen und Angebot senden“**.

- **Erwartet:** Schritt 2: Meldung **„Reklamation eskaliert“**; beim Mitarbeiter verschwindet „Reklamation entscheiden“.
  Im Auftrag steht danach **„Reklamation abgelehnt · Admin-Freigabe ausstehend“** (im Auftrag gibt es dafür **keine**
  Admin-Schaltfläche – die Entscheidung fällt auf der Seite „Reklamationen“). Dort steht **„Techniker-Ablehnung (wartet auf
  Admin-Freigabe)“** mit dem Grund. Schritt 4: Meldung **„Reklamation wurde abgelehnt und das Angebot an den Kunden
  gesendet.“**; Status **„Reklamation abgelehnt“**; kein weiteres DHL-Label.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X6 · [!] Einsendelabel für einen Auftrag ohne Buchung

- **Rolle:** A · **Voraussetzung:** Freigabe unten eingetragen; Bedingung wie X4 bestätigt; Auftrag aus B7 (ohne Buchung,
  noch ohne Einsendelabel).
- **Risiko:** Aufträge ohne Buchung (z. B. aus einer Reparaturanfrage mit „Gerät liegt vor bzw. Abgabe im Laden“) erzeugen
  das Einsendelabel über DHL-Retoure – **ohne** Testmodus.
- **Freigegeben von / am:** ______________________

1. Auftrag aus B7 → **„Weitere Aktionen“** → **„DHL-Einsendelabel erstellen (Kunde → McRepair)“**.

- **Erwartet:** Ein Label, in der Karte **„Einsendung“** (Untertitel „Kunde → McRepair“) sichtbar; kein zweites bei erneutem
  Klick (im Menü „Weitere Aktionen“ steht danach „Einsendelabel bereits erstellt“).
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X7 · [!] DHL auf „Live“ umstellen und erstes echtes Einsendelabel prüfen

- **Rolle:** Admin / freigebende Person · **Voraussetzung:** Freigabe unten eingetragen; echte DHL-Zugangsdaten und
  DHL-Vertrag vorhanden; die offene Entscheidung zum DHL-Produkt ist getroffen (siehe „Nicht Teil der Abnahme“).
- **Risiko:** Ab dann erzeugt **jede** Bestellung ein echtes Label.
- **Freigegeben von / am:** ______________________

1. **„Systemverwaltung“** → **„Systemkonfiguration“** → **„Integrationen“** → DHL → **„Buchungslabel-Modus
   (Einsendelabel)“** = „Live – echtes DHL-Label“ (nur durch die freigebende Person).
2. Erste echte Bestellung: Label kontrollieren.

- **Erwartet:** Einsendelabel: **Absender Kunde, Empfänger McRepair**; Hinweis „Dummy-Modus aktiv“ verschwindet.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X8 · [!] Mahnlauf ausführen

- **Rolle:** A / freigebende Person · **Voraussetzung:** Freigabe unten eingetragen; die Entwicklung bestätigt, dass im
  System nur Testkunden existieren (oder der echte Mahnlauf ist gewollt).
- **Risiko:** schreibt **alle** Kunden mit überfälligen Rechnungen an – im Testsystem nur, wenn sicher nur Testkunden existieren.
- **Freigegeben von / am:** ______________________

1. Linke Leiste **„Rechnungen“** → Schaltfläche **„Mahnlauf“** oben rechts (startet sofort, ohne Rückfrage; dieselbe
   Schaltfläche steht auch auf der Seite „Gutschriften“).

- **Erwartet:** nur überfällige, offene Rechnungen; Stufen Zahlungserinnerung → Mahnung → Letzte Mahnung → Inkasso.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X9 · [!] Abgleich mit PayPal und DHL-Sendungsstatus

- **Rolle:** A · **Voraussetzung:** Freigabe unten eingetragen; die Entwicklung bestätigt, welche PayPal- und
  DHL-Zugänge (Sandbox oder echt) das Testsystem nutzt.
- **Risiko:** Verbindung zu PayPal bzw. DHL mit echten Zugangsdaten.
- **Freigegeben von / am:** ______________________

1. Auftrag → Reiter **„Rechnungen & Zahlungen“** → **„Zahlungen verwalten“** → im Fenster **„Zahlungen – Buchung BKG-…“**
   **„Eingegangene PayPal-Zahlungen abgleichen“** (holt nur bereits erfolgte Zahlungen ab).
2. Linke Leiste **„Buchungen“** → Schaltfläche **„Versandstatus prüfen“** (rechts neben der Überschrift „Buchungsliste“;
   fragt bei DHL den Versandstatus aller aktiven Sendungen ab und aktualisiert ihn).

- **Erwartet:** keine neuen Zahlungen oder Labels; nur Abgleich vorhandener Vorgänge.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

#### X10 · [!] Jede Nachricht, E-Mail oder Zahlungsaufforderung an eine echte Person

- **Rolle:** A oder M · **Voraussetzung:** Freigabe unten eingetragen, mit Angabe, welcher Empfänger freigegeben ist und
  wozu geschrieben werden darf.
- **Risiko:** echte Kunden werden angeschrieben (Nachricht an Kunden, „Kunde informieren“, Rechnung **„Senden“**,
  Zahlungsaufforderung, Kostenvoranschlag).
- **Freigegeben von / am:** ______________________

1. Nur nach Freigabe und nur an die freigegebene Person.

- **Erwartet:** genau eine Nachricht/E-Mail, Inhalt wie in den entsprechenden Szenarien.
- Ergebnis: ☐ Bestanden · ☐ Fehlgeschlagen · ☐ Blockiert · ☐ Nicht getestet
- Auftrags-/Buchungs-/Rechnungsnummer: ____________________
- Beobachtet: ____________________
- Screenshot-Datei: ____________________

---

## Nicht Teil der Abnahme – Entscheidung offen

Diese Punkte bitte **nicht** bewerten; bei Auffälligkeiten nur unter „Beobachtet“ vermerken.

| Thema | Stand | Wer entscheidet |
|---|---|---|
| Preise und Steuern für **steuerbefreite Kunden** (Gruppen „steuerfrei“ / Reverse Charge) | Nicht Teil der Abnahme – Entscheidung offen | Buchhaltung / Steuerberatung |
| **DHL-Produkt** für die Einsendung (Paket vs. DHL Retoure) und erster echter Versand | Nicht Teil der Abnahme – Entscheidung offen | Betrieb / DHL-Vertrag |
| **Testmodus für Auslieferungslabels** (gibt es heute nicht) | Nicht Teil der Abnahme – Entscheidung offen | Betrieb |
| Cent-Verteilung des Rabatts bei mehreren Geräten (47,41 € statt 47,40 €) | aktueller technischer Standard; Änderung wäre eine Entscheidung | Geschäftsleitung |
| **Zahlungsziel**: versteckte Obergrenze 14 Tage | Nicht Teil der Abnahme – Entscheidung offen | Geschäftsleitung / Buchhaltung |
| **Stornierung aufheben** auch für Mitarbeitende | heute nur Admin; Änderung wäre eine Entscheidung | Geschäftsleitung |
| **Buchung stornieren**, wenn schon Aufträge abgeschlossen sind | Nicht Teil der Abnahme – Entscheidung offen | Geschäftsleitung |
| Zählweise **„Prioritätsaufträge“** im Dashboard | Nicht Teil der Abnahme – Entscheidung offen | Geschäftsleitung |
| Zahlungsoption **„Kredit- oder Debitkarte“** im Checkout (Anbieter/Abbuchung nicht abgenommen) | Nicht Teil der Abnahme – Klärung offen | Geschäftsleitung / Entwicklung |
| Funktion „eigenes Passwort ändern“ für angemeldete Nutzer | neue Funktion, nicht vorhanden | Geschäftsleitung |
| Echte DHL-Labels, echter E-Mail-Versand, PayPal | nur mit Freigabe (Teil 3) | Betrieb |

---

## Zusammenfassung

| ID | Titel | Ergebnis (B / F / Bl / NG) |
|---|---|---|
| KT1 | Richtige Version und neue Oberfläche | |
| KT2 | Partnerkunde bestellt ein Gerät (5 %) | |
| KT3 | Einsendelabel nach der Bestellung (Testlabel) | |
| KT4 | Kunde findet Gerät, schreibt Nachricht | |
| KT5 | Nachricht beantworten, interne Notiz | |
| KT6 | Versand im Auftrag (beide Richtungen) | |
| KT7 | Zahlungseingang von Hand buchen | |
| KT8 | Status ändern, Verlauf | |
| KT9 | Ersatzteil bestellen, Sendungsnummer | |
| KT10 | Handy-Ansicht des Kunden | |
| A1 | Anmeldeseite ohne Beispiel-Zugangsdaten | |
| A2 | Menü für Mitarbeitende | |
| A3 | Mitarbeitende sehen keine Admin-Seiten | |
| A4 | Kunden sehen keine fremden Daten | |
| B1 | Anfrage mit Katalog-Gerät (Kunde) | |
| B2 | Anfrage mit manuellem Gerät (Gast) | |
| B3 | Kostenvoranschlag als Entwurf | |
| B4 | Kostenvoranschlag senden (eine E-Mail) | |
| B5 | Gast nimmt an | |
| B6 | Kunde: Benachrichtigung, Annahme, 0,00 € | |
| B7 | Anfrage in Auftrag umwandeln | |
| C1 | Normaler Kunde: Preis ohne Rabatt | |
| C2 | Partnerkunde: gleiche Beträge überall | |
| C3 | Zwei Geräte in einer Buchung | |
| C4 | Gast: Warenkorb und Bezahlseite | |
| C5 | Lieferadresse „wie Rechnungsadresse“ | |
| C6 | Englisch zeigt Euro | |
| C7 | (optional) 15 % Rabatt | |
| D1 | Label im Gerätedetail und in der Buchung | |
| D2 | Kein zweites Einsendelabel | |
| D3 | Absender/Empfänger je Richtung, Handy | |
| D4 | Fremder Kunde: kein Label | |
| D5 | Buchungsliste beim Personal | |
| E1 | Eingangsprüfung beginnen | |
| E2 | Kennzeichnung sichtbar/intern | |
| E3 | Eingangsprüfung abschließen, Diagnose | |
| E4 | Gerät ändern | |
| E5 | Leistung hinzufügen/ändern/entfernen | |
| E6 | Verlauf mit Filtern | |
| E7 | Kundensicht nach Änderungen | |
| F1 | Workflow ohne Kundeninfo starten | |
| F2 | Start mit „Kunde informieren“ an | |
| F3 | Pausieren mit Grund | |
| F4 | Fortsetzen | |
| F5 | Zwischenfall melden | |
| F6 | Reparatur abschließen | |
| F7 | Nachträglich informieren (keine Doppelung) | |
| F8 | Stornieren nur mit Grund | |
| F9 | Stornierter Auftrag gesperrt | |
| F10 | Stornierung aufheben (nur Admin) | |
| G1 | Zentrales Postfach | |
| G2 | Gast schreibt über Tracking-Link | |
| G3 | Interne Notiz im Auftrag | |
| G4 | Aktion vom Kunden anfordern | |
| G5 | Reklamation anmelden | |
| G6 | Nachrichten zur Reklamation | |
| G7 | Reklamation durch den Admin ablehnen (ohne Label) | |
| G8 | Benachrichtigungsseite sauber | |
| H1 | Rechnung erstellen (eine) | |
| H2 | Rechnungs-PDF und Kundensicht | |
| H3 | Vorauszahlung vor der Rechnung | |
| H4 | Teilzahlung | |
| H5 | Überzahlung | |
| H6 | Zahlungsaufforderung | |
| H7 | Rechnung aus Aufträgen (Vorschau) | |
| H8 | Rechnung stornieren | |
| H9 | Gutschrift erstellen | |
| H10 | Kennzahlen in Analysen | |
| I1 | Lieferant im kleinen Fenster | |
| I2 | Lieferant doppelt | |
| I3 | Bestellung, Sendungsnummer, Suche | |
| I4 | Wareneingang und Überbuchung | |
| I5 | Einstellungen der Auswertung | |
| I6 | Finanzeinstellungen | |
| I7 | Workflow-Vorlagen gesperrt | |
| J1 | Aufgaben ohne Hilfe (Personal) | |
| J2 | Aufgaben ohne Hilfe (Kunde) | |
| J3 | Listen ohne seitliches Scrollen | |
| J4 | Schmales Fenster: Menü | |
| J5 | Dialoge 780 × 720 / 200 % | |
| J6 | Meldungen über Dialogen | |
| J7 | Kunde am Smartphone | |
| K1 | Ersatz: Status nur im Auftrag | |
| K2 | Ersatz: Gerät statt Bild | |
| L1 | Gast-Link nicht erratbar | |
| L2 | Profil speichern, Rolle fest | |
| L3 | Keine Admin-Daten im Bestellformular | |
| L4 | E-Mail-Verwaltung lädt | |
| X1 | [!] Zahlung mit PayPal (nur mit Freigabe) | |
| X2 | [!] Gast-Bestellung / „Kredit- oder Debitkarte“ (nur mit Freigabe) | |
| X3 | [!] Erstattung (nur mit Freigabe) | |
| X4 | [!] Auslieferungslabel „An Kunden versenden“ (nur mit Freigabe) | |
| X5 | [!] Reklamation genehmigen (nur mit Freigabe) | |
| X5b | [!] Reklamation durch den Techniker ablehnen (nur mit Freigabe) | |
| X6 | [!] Einsendelabel für Auftrag ohne Buchung (nur mit Freigabe) | |
| X7 | [!] DHL auf „Live“ (nur mit Freigabe) | |
| X8 | [!] Mahnlauf (nur mit Freigabe) | |
| X9 | [!] Abgleich PayPal / „Versandstatus prüfen“ (nur mit Freigabe) | |
| X10 | [!] Nachricht an eine echte Person (nur mit Freigabe) | |

B = Bestanden · F = Fehlgeschlagen · Bl = Blockiert · NG = Nicht getestet

---

## Rückmeldung

1. **Getestete Version (Commit/Build-Kennung):** ______________________ · Testsystem: ______________________
2. **Anzahl:** Bestanden ____ · Fehlgeschlagen ____ · Blockiert ____ · Nicht getestet ____
3. **Die drei schwierigsten Stellen** (Szenario + was gesucht wurde):
   1. ______________________________________________
   2. ______________________________________________
   3. ______________________________________________
4. **Was im Alltag fehlt oder umständlich ist** (Kunde und Personal): ______________________________________________
5. **Abweichungen mit Nummer und Screenshot** (Szenario-ID · Nummer · Datei): ______________________________________________
6. **Freigaben aus Teil 3**, die erteilt wurden (wer / wann / was): ______________________________________________

Bitte die ausgefüllte Liste zusammen mit den Screenshots an die Entwicklung zurückgeben.
