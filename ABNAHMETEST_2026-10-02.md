# Abnahmetest für das Team – Kommunikation, Verlauf, Versand, Finanzen, Bedienung

**Stand:** 02.10.2026, Abschlussrunde + Runde 3 · Branch `adars` (noch nicht committet, noch nicht ausgeliefert)
**Ersetzt teilweise:** `ABNAHMETEST_SOPHIE.md` (26.09.) – die Punkte dort zu Preis, Rechnung, Zahlung und Inspektion gelten weiter.

So testen: Jeden Schritt nacheinander ausführen und mit **OK** oder einem **Screenshot + Auftrags-/Buchungsnummer**
zurückmelden. Bitte **nur Testkunden** verwenden (keine echten Kunden anschreiben). Ein echtes DHL-Label wird nur
erzeugt, wenn das Testsystem auf „live“ steht – vorher bitte in der Systemkonfiguration prüfen
(**Systemverwaltung → Systemkonfiguration → Reiter „Integrationen“ → „Buchungslabel-Modus (Einsendelabel)“**). Steht dort „Dummy“, erscheinen Labels als **„Testlabel“**.

---

## 0. Vorbereitung (nur einmal, durch die Entwicklung)

- Neue Oberfläche ausgeliefert? **Schnellcheck:** Admin → linke Leiste zeigt **„Buchungen“** und **„Reparaturaufträge“**
  getrennt, und ein Auftrag öffnet sich **mit Seitenleiste** und den Reitern **Übersicht · Kommunikation · Verlauf ·
  Rechnungen & Zahlungen · Versand**. Fehlt das, bitte nicht weitertesten.
- Zwei Testkunden: **Kunde A** (mit Rabatt, z. B. 5 %) und **Kunde B**. Ein Mitarbeiterkonto und ein Adminkonto.

---

## Kurztest Bedienung für Mitarbeitende (ca. 15 Minuten, in dieser Reihenfolge)

Ziel: Finden die Kolleginnen und Kollegen die wichtigsten Dinge **ohne Hilfe**? Bitte **nichts vorher erklären**.
Pro Aufgabe festhalten: **geschafft ja/nein**, **ungefähre Zeit**, **wo gezögert oder gesucht wurde**, Bewertung
**leicht / mittel / schwer**. Testdaten wie in Abschnitt 0; keine echten Kunden.

| # | Aufgabe (so dem Testenden vorlesen) | Startpunkt | Erwartet (zum Abhaken) | Ziel |
|---|---|---|---|---|
| T1 | **„Kunde A hat zu seinem Auftrag geschrieben. Finde die Nachricht und antworte ihm. Lege danach eine interne Notiz an, die er nicht sieht.“** | Admin-Startseite | Linke Leiste **Nachrichten** → Gespräch über Suche (Auftrags-/Buchungsnummer oder Name) oder Filter **„Ungelesen“** / **„Antwort ausstehend“** → rechts antworten mit **„Nachricht an Kunden senden“**; Notiz mit Modus **„Interne Notiz“** → **„Interne Notiz speichern“**. Kunde A sieht die Antwort, die Notiz nicht. Falls eine Quelle nicht lädt: gelber Hinweis **„Nicht alle Nachrichten konnten geladen werden“** mit **„Erneut versuchen“** (nicht „Keine Nachrichten“). | ≤ 1 Minute, ohne Rückfrage |
| T2 | **„Öffne als Kunde A die Reparatur seines zweiten Geräts.“** | Kundenkonto, Startseite | Profilmenü → **Buchungen** → bei der Buchung die Gerätezeile → **„Details ansehen“** → **ein Klick**, richtiges Gerät. Zurück: Suche/Filter bleiben. | 3 Klicks |
| T3 | **„Wie viel hat Kunde A schon bezahlt, und was ist noch offen?“** | Gerätedetail aus T2; dann Admin-Auftrag | Kunde: Kasten **„Auf einen Blick“** zeigt **Gesamt (brutto) / Bezahlt / Offen**, bei zwei Geräten mit „Dieses Gerät“ und „(ganze Buchung)“. Admin: Karte **Zahlung** mit denselben Beträgen; das Wort passt zu den Zahlen (z. B. kein „Offen“ bei 0,00 € offen; bei storniertem Auftrag ohne offene Beträge „Storniert – keine Zahlung offen“). | Antwort ohne Aufklappen |
| T4 | **„Lade das DHL-Einsendelabel herunter – einmal als Kunde, einmal als Mitarbeiter.“** | Kunde: Bestellbestätigung bzw. Gerätedetail; Admin: Auftrag | Kunde: **„DHL-Einsendelabel herunterladen“** im nächsten Schritt. Admin: Auftrag → Reiter **„Versand“** → Karte **„Einsendung (Kunde → McRepair)“** → **„Testlabel herunterladen (PDF)“** (Live-Modus: „Einsendelabel herunterladen (PDF)“). Im Testsystem heißt es **„Testlabel“**. | je ≤ 2 Klicks |
| T5 | **„Wer hat bei diesem Auftrag wann den Status oder das Gerät geändert, und warum?“** | Admin-Auftrag | Reiter **„Verlauf“** → Filter z. B. **„Status & Workflow“** oder **„Gerät & Leistungen“**: Eintrag mit Zeit, Person, alt → neu, Grund. | ≤ 30 Sekunden |
| T6 | **„Bestelle ein Ersatzteil beim Lieferanten und trage die Sendungsnummer ein. Prüfe nach dem Neuladen, ob alles gespeichert ist.“** | Admin → **Ersatzteilbestellungen** | Bestellung anlegen (Lieferant wählen oder anlegen) → speichern → **Sendungsnummer** eintragen → speichern → **F5**: Bestellung (Nummer **EPO-…**) und Sendungsnummer sind noch da. Im kleinen Fenster (ca. 780×720) bleibt **Speichern** erreichbar. | ≤ 3 Minuten |

Rückmeldung zum Kurztest: Bitte die **drei schwierigsten Stellen** nennen (Aufgabe + was gesucht wurde). Diese
Rückmeldung ersetzt keine der Prüfungen unten, zeigt aber, ob die Bedienung im Alltag trägt.

---

## Teil 1 – Bedienung (UX): Was jetzt schneller und eindeutiger sein muss

| # | Aufgabe | So geht es jetzt | Erwartet |
|---|---|---|---|
| U1 | **Nach der Bestellung das Gerät einsenden** | Als Kunde A eine Reparatur über den Warenkorb bestellen. | Die Seite **„Vielen Dank! Ihre Bestellung ist eingegangen.“** zeigt **ganz oben „Nächster Schritt: Gerät an McRepair senden“** mit der Schaltfläche **„DHL-Einsendelabel herunterladen“** (oder „…erstellen“, falls es noch fehlt) und einem Link **„Zum Auftrag …“**. Kein Suchen im Menü. |
| U2 | Seite neu laden | Auf derselben Seite **F5** drücken. | Das Label ist weiterhin da (gleiche Sendungsnummer). Ein zweites Herunterladen erzeugt **kein** neues Label. |
| U3 | **Eigene Reparatur öffnen** | Kunde A → Profilmenü → **Buchungen**. | Jede Buchung zeigt ihre Geräte als Zeilen **„Gerät 1 von 2 …“** mit einer sichtbaren Schaltfläche **„Details ansehen“**. **Ein Klick** öffnet genau dieses Gerät – kein Zwischenfenster. |
| U4 | Zurück zur Liste | Im Gerätedetail **Zurück**. | Suchbegriff und Filter der Buchungsliste sind noch gesetzt. |
| U5 | **Verstehen, was zu tun ist** | Gerätedetail ansehen. | Oben der Kasten **„Auf einen Blick“**: Reparaturstatus, aktueller Schritt, **Gesamt (brutto) / Bezahlt / Offen** und **ein** hervorgehobener **„Nächster Schritt“** (z. B. „Rückfrage beantworten“, „DHL-Einsendelabel herunterladen“, „Rechnung … bezahlen“). Bei mehreren Aufgaben steht darunter „Weitere offene Schritte (n)“. |
| U6 | **Zahlung verstehen** | Bei einer Buchung mit **zwei Geräten** ein Gerät öffnen. | Die Beträge sagen selbst, wofür sie gelten: **„Dieses Gerät (brutto)“**, **„Bezahlt (ganze Buchung)“**, **„Offen (ganze Buchung)“**. Der offene Betrag ist **nie** in einem Aufklappbereich versteckt. Zahlungen und Preisaufstellung lassen sich unter **„Zahlungen & Rechnungen“** / **„Preisaufstellung“** aufklappen. |
| U7 | **Nachricht finden und beantworten** | Mitarbeiter → **Nachrichten**. | Alle Gespräche an einem Ort: **Aufträge, Reparaturanfragen, Reklamationen** (Admin zusätzlich **Kontaktanfragen**). Filter **„Ungelesen“** und **„Antwort ausstehend“**, Suche nach Auftrags-/Buchungs-/Anfrage-/Reklamationsnummer oder Kunde. **Ein Klick** öffnet das Gespräch rechts, die Antwort wird **dort** geschrieben. |
| U8 | **Wer liest mit?** (Zielgruppe) | Im geöffneten Gespräch das Eingabefeld ansehen. | Zwei klar getrennte Modi: **„Nachricht an Kunden“** (blau, Hinweis **„An Kunden – der Kunde sieht dies …“**, Schaltfläche **„Nachricht an Kunden senden“**) und **„Interne Notiz“** (gelb, **„Intern – nur für das Team“**, Schaltfläche **„Interne Notiz speichern“**). „Entwurf verwerfen“ löscht nur den Entwurf. |
| U9 | **Auftrag beurteilen** (Personal) | Admin → **Reparaturaufträge** und **Buchungen** bei 1366×768. | Auftrags-/Buchungsnummer, Kunde/Gerät, Reparaturstatus, Zahlungsstatus und Aktionen sind **ohne waagrechtes Scrollen** sichtbar. Im Auftrag oben eine Kurzübersicht (Reparaturstatus, Zahlung mit Beträgen, **Einsendung (Kunde → McRepair)** und **Auslieferung (McRepair → Kunde)** getrennt) und die Hauptaktionen. |
| U10 | **Änderungen nachvollziehen** | Im Auftrag Reiter **„Verlauf“**. | Vollständige Liste mit Filtern (**Status & Workflow, Gerät & Leistungen, Preise & Rabatte, Personal, Prüfung & Angebot, Kommunikation, Zahlung & Rechnung, Versand**). Jeder Eintrag mit Zeit, Person, alt → neu und ggf. Grund. Stufen, deren Zeitpunkt nicht erfasst wurde, stehen als **„Zeitpunkt nicht erfasst“** bzw. **„Übersprungen – nicht erfasst“**, nicht als erledigt. |
| U11 | **Lieferant anlegen im kleinen Fenster** | Admin → **Ersatzteilbestellungen → Lieferanten → Lieferant anlegen**, Browserfenster klein ziehen (ca. 780×720) oder **Strg + Plus** bis 200 %. | Alle Felder und **„Lieferant speichern“** sind durch normales Scrollen im Fenster erreichbar. Nach dem Speichern steht der Lieferant in der Liste, nach **F5** immer noch. |
| U12 | **Einstellungen speichern** | Admin → **Analysen → Einstellungen** einen Wert ändern (z. B. Stundensatz **95,5**) → **Einstellungen speichern**; dann **Rechnungen → Einstellungen** z. B. Zahlungsziel ändern → **Finanzeinstellungen speichern**. **F5**. | Beide Werte sind gespeichert; das Speichern des einen Bereichs ändert den anderen **nicht**. Felder ohne Wirkung sind als **„Vorbelegung – derzeit ohne Wirkung“** gekennzeichnet; Währung EUR mit Hinweis **„keine Umrechnung“**. |
| U13 | **Schmale Fenster** | Admin-Seiten bei schmalem Fenster öffnen. | Die Seitenleiste liegt **nicht** über dem Inhalt; sie öffnet sich nur über das Menü-Symbol. |
| U14 | **Meldungen über Dialogen** | In einem offenen Dialog etwas speichern, das eine Meldung auslöst (z. B. Workflow zuweisen). | Die Meldung erscheint **oben rechts über** dem Dialog (lesbar, nicht abgedunkelt) und verdeckt die Schaltflächen unten im Dialog nicht. |
| U15 | **Statuswechsel nur im Auftrag** | Admin → Reparaturaufträge (Liste). | In der Liste gibt es keinen Status-Umschalter mehr; der Status wird im Auftrag geändert (mit Grund und Verlaufseintrag). |

---

## Teil 2 – Nachrichten & Benachrichtigungen

| # | Schritt | Erwartet |
|---|---|---|
| N1 | Kunde A schreibt im Gerätedetail unter **„Nachrichten zum Auftrag“** eine Nachricht. | Nachricht erscheint sofort. Beim Admin steigt **„Ungelesen“** und **„Antwort ausstehend“**. |
| N2 | Admin öffnet sie über **Nachrichten** und antwortet mit **„Nachricht an Kunden senden“**. Danach eine **„Interne Notiz speichern“**. | Kunde A sieht die Antwort unter **Nachrichten** und im Auftrag – die **interne Notiz sieht er nicht**. |
| N3 | Kunde B öffnet die Seite **Nachrichten**. | Kunde B sieht **keine** Gespräche von Kunde A. |
| N4 | Kunde A schreibt unter **Reklamationen** zu seiner Reklamation; Admin filtert **Nachrichten → Reklamationen** und antwortet. | Gespräch dort auffindbar; Antwort erscheint beim Kunden in der Reklamation. |
| N5 | Ein Gast stellt eine **Reparaturanfrage** (ohne Konto) und schreibt über seinen Tracking-Link. Admin: **Nachrichten → Reparaturanfragen**. | Gast-Gespräch öffnet sich, Antwort erscheint auf der Tracking-Seite des Gastes. |
| N6 | Kunde A → **Benachrichtigungen**. | Keine Texte wie „notificationsPage…“, „Subtitle“, „Suchen Placeholder“; keine langen Zeichenketten (base64). Eine genehmigte Reklamation zeigt eine kurze Meldung mit **„Versandlabel herunterladen“**. |
| N7 | In der Reklamation **„Versandlabel herunterladen / drucken“** klicken. | PDF wird heruntergeladen. (Kunde B kann dieses Label nicht abrufen.) |
| N8 | Eingangsprüfung eines Geräts abschließen (Mitarbeiter). | Die Kunden-E-Mail heißt **„Eingangsprüfung“** (nicht „Diagnose abgeschlossen“). Keine englischen Hinweise wie „Device inspection has been initiated by technician“. |
| N9 | Im Reparatur-Workflow (Auftrag → Arbeitsablauf **„Öffnen“**) einen Schritt mit dem Schalter **„Kunde informieren“** **an** speichern, dann einen mit **aus**. | **An:** Kunde erhält genau eine Benachrichtigung + E-Mail mit Kundentext. **Aus:** nichts geht an den Kunden; das Team sieht den Eintrag im Verlauf. Schlägt der Versand fehl, steht das getrennt vom Speichererfolg. |
| N10 | Admin → **Workflowverwaltung** → Vorlage → Schritt bearbeiten. | Benachrichtigungs-Schalter, „Pflichtschritt“, „Freigabe“, „Formular“ und „Regel hinzufügen“ sind **gesperrt** (nicht umschaltbar) und erklärt („nicht unterstützt – maßgeblich ist der Schalter „Kunde informieren“ im Arbeitsschritt“). Die Schrittkarten zeigen höchstens gedämpft „… (ohne Wirkung)“. |
| N12 | Reparatur mit „Kunde informieren“ **aus** abschließen, danach im Workflow **„Kunde über Abschluss informieren“** (auch doppelt) klicken. | Genau **eine** Benachrichtigung und **eine** E-Mail an den Kunden; danach wird die Aktion nicht mehr angeboten. |
| N11 | Ein Kunde soll eine von McRepair angeforderte Aktion (z. B. Zustimmung zum Teiletausch, Mehrkosten) bestätigen. | Der Kunde sieht im Gespräch die Schaltfläche zum **Erledigen** der Aktion; danach steht sie auf **„Erledigt“** – auch nach dem Neuladen und beim Team. |

## Teil 3 – Reparaturanfrage (Katalog, unbekanntes Gerät, Gast)

| # | Schritt | Erwartet |
|---|---|---|
| R1 | **Reparaturanfrage** öffnen. | Zuerst **Gerätetyp → Marke → Modell aus dem Katalog**; daneben **„Mein Gerät ist nicht aufgeführt“** für freie Eingabe. |
| R2 | Als Gast mit **„Mein Gerät ist nicht aufgeführt“** eine Anfrage senden. | Bestätigungs-E-Mail an den Gast mit Tracking-Link. |
| R3 | Admin → **Reparaturanfragen → Öffnen**: Betrag und Beschreibung eintragen → **„Entwurf speichern“**. | **Keine** E-Mail; der Gast sieht noch nichts. |
| R4 | **„Kostenvoranschlag an Kunden senden“**. | **Genau eine** E-Mail mit Betrag, Beschreibung und Link. Erneutes Speichern schickt **keine** zweite E-Mail. **0,00 €** ist als Betrag erlaubt. |
| R5 | Gast öffnet den Link aus der E-Mail und klickt **„Kostenvoranschlag annehmen“** (und bestätigt „Ja, Kostenvoranschlag annehmen“). | Status beim Admin: **„Kostenvoranschlag angenommen“**. |
| R6 | Admin → **„In Auftrag umwandeln“**: Leistung wählen. | Weicht der Auftragswert vom angenommenen Kostenvoranschlag ab, muss das bestätigt werden. Der Auftrag übernimmt das Gerät und die **ursprüngliche Kundenangabe**. Es wird **kein** DHL-Label automatisch erstellt. |

## Teil 4 – Verlauf, Status, Storno

| # | Schritt | Erwartet |
|---|---|---|
| V1 | Im Auftrag den Status auf **„In Bearbeitung“** setzen. | Eintrag im **Verlauf** mit Person, Uhrzeit, alt → neu. |
| V2 | Gerätemodell oder Leistung ändern. | Eintrag mit alt → neu. Die **Kundenangabe** („Vom Kunden gemeldet“) bleibt sichtbar. |
| V3 | Status **„Storniert“** wählen. | Dialog **„Auftrag stornieren?“** – ohne Grund nicht möglich. Hinweis: Rechnungen/Zahlungen werden **nicht** storniert oder erstattet. Laufende Workflows werden angehalten. |
| V4 | Nach dem Storno das Statusmenü öffnen. | Nur noch **„Stornierung aufheben …“** (nur Admin, Grund Pflicht). Danach steht der Auftrag auf **„Ausstehend“**; angehaltene Workflows bleiben angehalten. |
| V5 | Eine Reparatur abschließen, die per **Versand** zurückgeht. | Text **„Reparatur abgeschlossen – Versand an Sie wird vorbereitet“** (nicht „liegt zur Abholung bereit“). Bei Abholung im Laden bleibt die Abholformulierung. Zahlung und Versand bleiben eigene Angaben. Auch die Buchungs-E-Mail beim Abschluss spricht nur bei Abholung von „zur Abholung bereit“. |
| V6 | Stornierten Auftrag öffnen, bei dem die Eingangsprüfung begonnen war. | Die Inspektion ist **gesperrt** („Auftrag storniert – Inspektion gesperrt“), die bisher erfassten Daten sind **nur lesbar**. Im Reparatur-Workflow sind die Schritte gesperrt mit Hinweis. Der Server lehnt Änderungen ab. |
| V7 | Im Auftrag Gerät über **„Bearbeiten“** wechseln und eine Leistung ändern. | Verlauf zeigt „Gerät korrigiert“ bzw. Leistungsänderung mit Person, Zeit, alt → neu und neuem Auftragswert (deutsches Zahlenformat, z. B. „49,90 €“). |
| V8 | Als Techniker in der Eingangsprüfung die Notizfelder ansehen. | Felder, die der Kunde unter **„Diagnose ansehen“** sieht, tragen den Hinweis **„Für Kunden sichtbar“**; die interne Workflow-Notiz ist als **„Intern – nur für das Team“** gekennzeichnet. |

## Teil 5 – DHL

| # | Schritt | Erwartet |
|---|---|---|
| D1 | Siehe U1/U2. Zusätzlich als Admin im Auftrag **Reiter „Versand“**. | **Einsendung (Kunde → McRepair)** und **Auslieferung (McRepair → Kunde)** mit eigenen Sendungsnummern und Schaltflächen. |
| D2 | Bei einer Buchung mit vorhandenem Einsendelabel im Auftrag unter **„Weitere Aktionen“** nachsehen. | Dort steht **„Einsendelabel bereits erstellt“** (gesperrt) – kein zweites Einsendelabel. |
| D3 | Steht DHL auf **„Dummy“**: Admin → **Buchungen**. | Hinweis **„Dummy-Modus aktiv – Labels sind Testlabels“**. |
| D4 | **Erster echter Versand nach dem Deploy** | Label kontrollieren: **Absender McRepair, Empfänger Kunde** (Auslieferung) bzw. umgekehrt (Einsendung). |
| D5 | Admin → Auftrag → **Versand** → Karte Einsendung **„Testlabel herunterladen (PDF)“** (im Live-Modus „Einsendelabel herunterladen (PDF)“). | PDF der richtigen Buchung. Ein anderer Kunde kann es nicht abrufen. |
| D7 | Admin → Auftrag → **Versand**: beide Karten ansehen (auch am Handy, ca. 390 px). | **Einsendung:** Absender = Kunde (Name, Anschrift, Quelle), Empfänger = McRepair. **Auslieferung:** Absender = McRepair, Empfänger = Lieferadresse des Kunden (bzw. Packstation). Fehlt etwas: „Adresse fehlt – bitte prüfen“ (Shop-Anschrift in Systemverwaltung → Integrationen → DHL pflegen). Kein seitliches Scrollen. Der Kunde sieht diesen Block nicht. |
| D6 | **Achtung Testsystem:** Auslieferungslabel („An Kunden versenden“). | Für Auslieferungslabels gibt es **keinen** Dummy-Modus. Mit echten DHL-Zugangsdaten entsteht ein **echtes, kostenpflichtiges** Label – im Testsystem nur ohne DHL-Zugangsdaten oder mit DHL-Sandbox testen. |

## Teil 6 – Finanzen

| # | Schritt | Erwartet |
|---|---|---|
| F1 | Kunde mit 5 % bestellt **ein** Gerät für 49,90 €. | Überall gleich: 49,90 − **2,50** = **47,40 €**, davon Netto **39,83 €**, MwSt. **7,57 €** – im Warenkorb, Auftrag, Rechnung/PDF und in der E-Mail (**MwSt. ausgewiesen**). |
| F2 | Gleicher Kunde bestellt **zwei** Geräte (49,90 € + 129,90 €) in einer Buchung. | Rabatt **8,99 €** auf die Buchung (5 % von 179,80 €), verteilt **2,49 € / 6,50 €** → 47,41 € + 123,40 € = **170,81 €** (siehe offene Entscheidung im technischen Bericht). |
| F3 | Englisch als Sprache wählen. | Beträge bleiben in **€** (kein $ oder CHF). |
| F4 | Admin → **Rechnungen → Zahlungen**. | Jede Zahlung zeigt **Buchung/Auftrag/Rechnung** als Link und den **Verwendungszweck**; eine Zahlung ohne Rechnung heißt **„Vorauszahlung – Rechnung folgt“**. |
| F5 | **„Rechnung aus Aufträgen erstellen“**. | Erst eine **Vorschau**, welche Aufträge berechnet werden; Aufträge mit bestehender Rechnung werden übersprungen; keine doppelte Rechnung. |
| F6 | **„Zahlungsaufforderung senden“** (per E-Mail). | Bestätigungsdialog mit Empfänger, Betrag, Rechnung und früheren Aufforderungen; erneutes Senden innerhalb von 24 h nur nach ausdrücklicher Bestätigung (**„Trotzdem erneut senden“**) – das gilt auch, wenn die erste Aufforderung zur Buchung und die zweite über die Rechnung gesendet wird. Doppelklick schickt **nur eine** E-Mail. **„Eingegangene PayPal-Zahlungen abgleichen“** (unter „Zahlungen verwalten“) holt nur bereits erfolgte Zahlungen ab – im Test nicht klicken. |
| F8 | Auftrag mit gespeichertem Steuersatz **0 %** (nur Testsystem) und ein Auftrag ohne gespeicherten Satz öffnen. | 0 %: überall „MwSt. (0 %)“, Netto = Brutto. Ohne Satz: „19 %, Standardsatz“. **Hinweis:** Preise für steuerbefreite Kunden sind noch nicht entschieden – dieser Fall ist nicht Teil der Abnahme. |
| F9 | Checkout mit „Lieferadresse wie Rechnungsadresse“: Rechnungsadresse ändern und speichern; danach Profil öffnen. | Lieferadresse bleibt „wie Rechnungsadresse“ (keine alte Adresse als abweichende Lieferadresse); Packstation bleibt erhalten. Profil speichern ändert diese Einstellung nicht. |
| F7 | **Analysen**. | Drei getrennte Kennzahlen: **„Auftragswert (netto)“**, **„Fakturiert (netto)“**, **„Zahlungseingang (brutto)“**; Beträge in €. |

## Teil 7 – Ersatzteile

| # | Schritt | Erwartet |
|---|---|---|
| E1 | Ersatzteilbestellung anlegen, **Sendungsnummer** eintragen, **Speichern**, **F5**. | Bestellung und Sendungsnummer bleiben gespeichert; eine fehlgeschlagene Speicherung wird als Fehler gemeldet. |
| E2 | Wareneingang über die bestellte Menge hinaus buchen. | Wird abgelehnt. |
| E3 | Gleichen Lieferanten (Name + E-Mail) zweimal anlegen. | Zweiter Versuch: Meldung „existiert bereits“, eingegebene Daten bleiben im Formular. |

## Teil 8 – Sicherheit (kurz)

| # | Schritt | Erwartet |
|---|---|---|
| S1 | Ausgelieferte Login-Seite öffnen (nicht die Entwicklungsumgebung). | **Keine** Beispiel-Zugangsdaten (keine „Quick-Login“-Karte); `/debug` ist nicht erreichbar. |
| S2 | Gast-Tracking-Link öffnen, dann im Link das Token um ein Zeichen ändern. | Original: Seite öffnet. Geändert: „nicht gefunden“, keine Daten. |
| S3 | Viele falsche Buchungsnummern zu einer E-Mail-Adresse abfragen. | Nach einigen Fehlversuchen: **„Zu viele Anfragen …“**; ein gültiger Token-Link desselben Kunden funktioniert weiter. |
| S4 | Kunde B ruft die Auftrags-/Labeladresse von Kunde A auf. | Kein Zugriff (403/„nicht gefunden“). |
| S5 | **Server neu starten** (Testsystem) und mit dem aktuellen Admin-Passwort anmelden; vorher das Admin-Passwort einmal ändern. | Anmeldung mit dem **neuen** Passwort klappt nach dem Neustart; das Serverprotokoll zeigt „Admin user already exists, not modified“ und nie ein Passwort. Auf einem leeren Produktionssystem ohne `SEED_ADMIN_PASSWORD` entsteht **kein** Admin. |
| S6 | Als Kunde das Profil speichern (Name, Telefon, Adresse). | Speichern klappt und bleibt nach dem Neuladen; Rolle/Status/E-Mail lassen sich darüber nicht ändern. |
| S7 | Öffentliche Seite **/new-order** bis Schritt 3 „Kundeninformationen“ (als Gast und angemeldet). | Gast: „—“; angemeldet: eigener Name und E-Mail. Nirgends „Admin User“ oder admin@example.com. |
| S8 | Admin → **Email-Verwaltung** öffnen. | Statistik, Verlauf und Protokoll laden wie bisher (die Protokolldateien liegen weiter auf dem Server, sind aber nicht mehr in Git). |

## Entfallene Funktionen und ihr Ersatz (bitte bewusst prüfen)

| Entfallen | Warum | Ersatz / so geht es jetzt |
|---|---|---|
| Status-Umschalter direkt in der Liste **Reparaturaufträge** | erlaubte Storno ohne Grund und ohne Verlaufseintrag | Liste → **„Auftrag öffnen“** → Statusmenü oben im Auftrag → neuer Status (3 Klicks); Storno nur mit Grund; beide Wechsel stehen im **Verlauf**. Die Liste zeigt den Status weiter an (stornierte Aufträge ohne Zahlung als „Storniert“, nicht „Offen“). |
| Gerätebilder im Buchungsdetail des Kunden | bis zu 5 Katalogsuchen je Gerät, kein gespeichertes Bild am Auftrag | **„Details ansehen“** öffnet das Gerät direkt (1 Klick). |
| Schalter in Workflow-**Vorlagen** (Benachrichtigungen, Pflichtschritt, Freigabe, Formular, Automationsregeln) | wurden nirgends ausgewertet | gesperrt mit Erklärung; Kundeninformation über **„Kunde informieren“** im Arbeitsschritt (N9, N12). |
| Beispiel-Zugangsdaten auf der Login-Seite und `/debug` | Standardpasswörter für alle sichtbar | nur noch in der Entwicklungsumgebung (S1). |
| Automatisches Zurücksetzen des Admin-Passworts beim Serverstart | Kontoübernahme mit bekanntem Standardpasswort | einmaliges Anlegen über `SEED_ADMIN_PASSWORD`; Passwortänderung über „Passwort vergessen“ (S5). |

---

## Zurückmelden

Bitte pro Teil **OK** oder Abweichung mit Screenshot und Nummer. Besonders wichtig: **Kurztest T1–T6**, **U1–U8**, **N2/N3/N12**,
**V3/V4/V6**, **D7**, **F1/F2/F6/F9**, **S1/S5/S6**, Tabelle **„Entfallene Funktionen“**.

Nicht Teil dieser Abnahme (bewusst offen): echte DHL-Labels (nur mit DHL-Sandbox/Freigabe), echter E-Mail-Versand über den Produktions-SMTP,
PayPal, Preise/Steuern für steuerbefreite Kunden (Geschäftsentscheidung).
