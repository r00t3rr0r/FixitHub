# Abnahmebericht — Rückmeldungen aus Sophies Test

**Branch:** `adars` · **Stand:** 22.09.2026 · **Status:** umgesetzt, noch nicht committet

Dieser Bericht beantwortet jeden Punkt aus Sophies Testprotokoll. Der zugehörige technische
Änderungsbericht für die Entwicklung liegt in [`TECHNISCHER_AENDERUNGSBERICHT.md`](TECHNISCHER_AENDERUNGSBERICHT.md).

---

## 1. Kurzfassung

| Ergebnis | Anzahl | Punkte |
|---|---|---|
| Behoben | 22 | A1, A2, B1–B5, C1–C6, D1, D2, E1, E2, F1, G1, G2, G4, G5 |
| Teilweise behoben | 2 | B6 (E-Mail-Vorlage offen), G3 (Packstation: Fehler behoben, Ausbau offen) |
| Teils behoben, teils nicht reproduzierbar | 1 | E3 (Schritt 2 behoben, Schritt 4 im Code nicht auffindbar) |
| **Gesamt** | **25** | |

Sophies Ausgangsbeispiel stimmt jetzt durchgängig — vom Warenkorb bis zur PDF:

```
49,90 Liste − 7,48 Rabatt  →  Brutto 42,42 = Netto 35,65 + MwSt. 6,77
Steuersatz exakt 19 %  ·  Netto + MwSt. = Brutto  ·  Rabatt genau einmal abgezogen
```

Zwei Punkte brauchen eine **Entscheidung von euch**, bevor das live geht — siehe Abschnitt 4.

---

## 2. Die Punkte im Einzelnen

### A — Preise, Rabatt und Steuer

**A1 · „Rabatt vom Kunden nicht im Auftrag zu sehen (Warenkorb 42,42 EUR, im Auftrag wieder 49,90 EUR)"**
→ **Behoben.**
Die Ursache lag nicht beim Speichern, sondern beim Lesen: Der Rabatt *wurde* korrekt auf dem Auftrag
gespeichert, aber die Schnittstelle, die den Auftrag an die Oberfläche liefert, hat das Feld `discount` gar
nicht mitgeschickt. Die Oberfläche blendet beide Rabattzeilen aus, solange der Rabatt nicht größer als 0 ist —
und das war er dort immer. Zusätzlich holte die Preisaufstellung ihre Zahlen aus einer zweiten Schnittstelle,
die noch die unrabattierten Listenpreise enthielt. Deshalb stand „49,90" neben einer Gesamtsumme von „42,42".
Beides ist korrigiert; der Auftrag zeigt jetzt eine Aufstellung, die aufgeht.

**A2 · „Rechnungsbeträge alle falsch: Bruttobeträge werden als Nettobeträge genommen"**
→ **Behoben.**
Bestätigt und die wichtigste Einzelursache in diesem Paket. Bei der Rechnungserstellung wurde die Brutto-Summe
des Auftrags in das Netto-Feld geschrieben und anschließend noch einmal 19 % aufgeschlagen. Aus einem Auftrag
über 119,00 EUR wurde eine Rechnung über 141,61 EUR.
Im Code existierten **zwei gegensätzliche Rechenregeln nebeneinander**: eine Stelle schlug die MwSt. auf, eine
andere rechnete sie heraus. Es gilt jetzt durchgängig eine Regel (Preise sind brutto, die MwSt. wird
herausgerechnet), und die Rechnung selbst ist die einzige Stelle, die die Summen bestimmt.

### B — Zahlungen

**B1 · „Zahlung über PayPal vorab ist nicht in den Zahlungen beim Auftrag drin"** → **Behoben.**
Die Zahlung wurde nur mit Buchungs- und Auftragsbezug gespeichert, das Zahlungsfenster suchte aber nach dem
Rechnungsbezug. Die Zahlung war also da, nur nicht auffindbar.

**B2 · „Vorabzahlungen sind nicht automatisch mit der später erstellten Rechnung verknüpft"** → **Behoben.**
Die dafür zuständige Funktion war **wirkungslos**: Sie prüfte ein Feld, das an dieser Stelle nie gesetzt wird,
und brach deshalb bei jedem Aufruf sofort ab. Es wurde noch nie eine Zahlung automatisch zugeordnet. Die
Funktion arbeitet jetzt, und zwar nach einer festen Regel: älteste Fälligkeit zuerst, jede Rechnung bekommt
höchstens ihren offenen Betrag, ein Überhang bleibt bewusst unzugeordnet statt auf eine falsche Rechnung zu
wandern. Doppelbuchungen sind ausgeschlossen, auch bei wiederholten oder gleichzeitigen Aufrufen.

**B3 · „Bei Teilzahlung kommt eine Fehlermeldung, aber trotzdem wird es übernommen"** → **Behoben.**
Die Zahlung wurde gespeichert, danach lief der Vorgang in einen internen Fehler — der Server meldete einen
Fehler für etwas, das bereits erfolgreich war. Gespeicherter Zustand, Serverantwort und angezeigte Meldung
stimmen jetzt überein. Zusätzlich abgesichert: ein Doppelklick oder erneutes Absenden erzeugt **keine zweite
Zahlung** mehr (geprüft mit 5 gleichzeitigen identischen Zahlungen → genau eine Buchung).

**B4 · Beispiel `VIP--2026-0008`: 300 EUR erfasst, Status „versendet" statt teilbezahlt, in der Übersicht nicht
erkennbar, offener Betrag fehlt** → **Behoben.**
Versandstatus und Zahlungsstatus lagen in einem einzigen Feld, deshalb hat „versendet" den Zustand
„teilbezahlt" überschrieben. Beides ist jetzt getrennt — ein Auftrag kann gleichzeitig versendet **und**
teilbezahlt sein. Außerdem rechneten Listenansicht und Detailansicht den Zahlungsstand unterschiedlich aus, was
genau den Effekt „in der Übersicht nicht erkennbar" erzeugte; beide nutzen jetzt dieselbe Berechnung. Der
offene Betrag wird als „Brutto minus wirksam zugeordnete Zahlungen" ausgewiesen, eine Überzahlung getrennt und
nie als negativer Betrag.

**B5 · „Überzahlung ausgleichen und Zahlungsaufforderung senden — auch nach Rechnungsnummer suchen können"**
→ **Behoben,** inklusive der alten Nummernformate. Die Suche läuft jetzt serverseitig statt auf einem lokal
gefilterten Ausschnitt.

**B6 · „Zahlungsaufforderung senden — ich habe keine Info bekommen, geht das über PayPal? Wo sehe ich, wofür ich
schon eine gesendet habe?"** → **Teilweise behoben.**

*Zur Frage:* Es läuft **nicht** über PayPal, sondern über E-Mail. Es wurde keine neue PayPal-Funktion ergänzt.

Die Funktion meldete bisher **immer Erfolg**, auch wenn gar nichts versendet wurde und auch dann, wenn keine
Empfängeradresse vorhanden war. Das ist behoben: ohne echten, angenommenen Versand gibt es keine Erfolgsmeldung
mehr. Neu ist eine **Historie** mit Buchung/Rechnung, Betrag, Kanal, Empfänger, Zeitpunkt, Status und Fehler —
damit ist Sophies Frage „wo sehe ich das?" beantwortet.

**Offen:** Die E-Mail-Vorlage für diesen Anlass liegt in einem Bereich, der in diesem Durchgang bewusst nicht
angefasst wurde, und sie enthält keinen Platzhalter für den im Dialog verfassten Hinweistext. Der Versand läuft
deshalb über eine Ersatzvorlage, und der frei geschriebene Text erreicht den Kunden nicht. Das wird ehrlich als
solches gespeichert und angezeigt, statt Erfolg vorzutäuschen.

> **Nebenbefund, der Sophies Eindruck erklärt:** Der gesamte im Sende-Dialog verfasste Text wird beim Versand
> verworfen, weil die Vorlage ihn nicht vorsieht. Das betrifft nicht nur die Zahlungsaufforderung. Wer im Dialog
> etwas schreibt, bekommt es nirgends zu sehen — der Kunde auch nicht.

### C — Rechnungen

**C1 · „Rechnungen sollten für den Kunden auch über die Buchungsübersicht zu finden sein"** → **Behoben.**
Rechnungen und PDF sind jetzt aus der Buchung und aus dem Auftrag heraus erreichbar, auch bei mehreren
Rechnungen pro Buchung.

> **Zusätzlich gefunden und geschlossen — Sicherheitslücke:** Die Schnittstelle, die die Rechnungen einer
> Buchung liefert, prüfte zwar die Anmeldung, aber **nicht die Zugehörigkeit**. Jeder angemeldete Benutzer
> konnte die Rechnungsliste jeder beliebigen fremden Buchung abrufen, wenn er die ID kannte. Das war kein Punkt
> aus dem Testprotokoll und ist jetzt geschlossen.

**C2 · „Wo kann ich als Admin/Mitarbeiter die Rechnung als PDF herunterladen?"** → **Behoben.**
Es gab bisher gar keine Download-Aktion, nur ein Öffnen zur Ansicht. Jetzt gibt es einen sichtbaren Download am
Beleg und in der Finanzübersicht, mit den bestehenden Rollenrechten. Kunden können weiterhin ausschließlich
ihre eigenen Belege laden.

**C3 · „Rechnungsnummernkreislauf muss fortlaufend sein — am besten immer nur INV-…"** → **Behoben.**
Das Präfix kam aus der Kundengruppe — daher Sophies `VIP--2026-0008`. Es gibt jetzt **einen** fortlaufenden
Kreis `INV-JJJJ-NNNN`, unabhängig vom Kunden, aus einem atomaren Zähler. Die Vergabe ist auch bei gleichzeitigen
Anfragen eindeutig (mit 50 parallelen Rechnungen geprüft), und eine vergebene Nummer wird nie wiederverwendet.
**Bestehende Rechnungen werden nicht umnummeriert.**

**C4 · „SKONTO raus überall. Das haben wir nicht."** → **Behoben.**
Aus allen aktiven Abläufen entfernt: Kundengruppen-Einstellungen, globale Einstellung, Sende-Dialog,
Zahlungsbedingungen, Oberfläche und Übersetzungen. Der normale Händlerrabatt und das Zahlungsziel bleiben
unverändert. Historische Belege werden nicht verändert.

*Zur Einordnung:* Der Skonto-Text hat die Kunden **nie per E-Mail erreicht** — die Vorlage sieht das Feld gar
nicht vor. Sophie kann ihn nur in den Verwaltungsmasken gesehen haben. Die Bereinigung bleibt trotzdem richtig,
weil der Text in den Zahlungsbedingungen der Rechnung gespeichert wurde.

**C5 · „Rechnungsdetails — Text/Beschreibung wieder fehlerhaft"** → **Behoben.**
Zwei Ursachen: bei Buchungsrechnungen wurden die Positionstexte nachträglich durch das Wort „Service" ersetzt,
bei Auftragsrechnungen stand eine interne Datenbank-ID in der Beschreibung. Beides korrigiert; die Positionen
tragen jetzt die echten Leistungs- und Artikelnamen samt Gerätekennung.

**C6 · „In den Rechnungen führt ‚Bestellung' nur in die allgemeine Auftragsübersicht"** → **Behoben,**
auch beim direkten Aufruf des Links und nach einem Neuladen der Seite.

### D — Gutschriften

**D1 · „Betrag und Steuersatz eingebbar, in der Vorschau steht die Steuer nicht (nur 0 EUR)"** → **Behoben.**
Gleich drei Fehler übereinander: Der Steuersatz wurde auf dem Weg zum Server **zweimal durch 100 geteilt**
(aus 19 % wurden 0,19 %), er wurde auf der Gutschrift gar nicht gespeichert, und die PDF setzte den Betrag auf
0. Die Gutschrift weist jetzt Netto, MwSt. und Brutto korrekt aus und ist das exakte Spiegelbild ihrer
Ursprungsrechnung. Mit 19 % und mit 0 % geprüft.

**D2 · Eigener Nummernkreis · eigene Kategorie links · Bezug zur Rechnung** → **Behoben.**
Gutschriften haben einen **eigenen** Zähler (`INV-CN-JJJJ-NNNN`), der den Rechnungszähler nicht mitverbraucht.
Sie haben einen **eigenen Navigationspunkt** mit eigener Liste; die Rechnungsliste enthält sie nicht mehr. Die
Nummer der Ursprungsrechnung steht auf der Gutschrift, in der Vorschau und in der PDF.

### E — Geräteinspektion und Gerätewechsel

**E1 · „Es muss ersichtlich bleiben, was der Kunde ursprünglich gebucht hat" · PDF zeigt bei beiden Feldern das
neue Modell · Schritt 7 zeigt weiterhin das alte Modell** → **Behoben.**
Das ursprünglich gebuchte Gerät wurde nirgends dauerhaft festgehalten — es wurde beim Gerätewechsel einfach
überschrieben. Es gibt jetzt einen **einmalig geschriebenen Schnappschuss** auf dem Auftrag, der bei einem
Wechsel nicht mehr überschrieben wird. „Gemeldetes Modell" zeigt das ursprünglich gebuchte, „tatsächliches
Modell" das korrigierte Gerät — in Schritt 1, in Schritt 7 und in der PDF einheitlich.

Zusätzlich behoben: Ein veralteter lokaler Zwischenstand im Formular wurde beim Speichern **zurück in die
Datenbank geschrieben** und hat das korrigierte Gerät wieder überschrieben. Das war der Grund, warum die PDF
selbst dann falsch war, wenn die Daten vorher stimmten.

**E2 · „In der PDF steht ‚Reparatureinschätzung: reparierbar Ja' — das haben wir gar nicht mehr zur Auswahl"**
→ **Behoben.** Der Wert wurde im Hintergrund weiterhin erzeugt, obwohl die Auswahl längst entfernt war. Die
Zeile ist aus der PDF entfernt und die Quelle abgestellt. Historische Dokumente bleiben unverändert lesbar.

**E3 · „Schritt 2 und Schritt 4: ‚Speichern & Weiter' geht nicht automatisch weiter"**
→ **Schritt 2 behoben · Schritt 4 nicht reproduzierbar.**

*Schritt 2:* Bestätigt und behoben. Der Server lehnte jeden Gerätetyp ab, der nicht in einer kurzen fest
verdrahteten Liste stand. Der Gerätetyp am Auftrag ist aber freier Text aus dem pflegbaren Katalog — schon eine
Mehrzahlform wie „Smartphones" oder ein Eintrag wie „Handy" ließ das Speichern scheitern. Zusätzlich erschien
**jeder** Fehler als leerer „Fehler"-Hinweis ohne Text, weshalb nicht erkennbar war, woran es lag. Beides ist
behoben; Fehlermeldungen erscheinen jetzt auf Deutsch und benennen die Ursache.

*Schritt 4:* Hier konnten wir **keine Ursache im Code finden**. Es wurde jede von der Oberfläche erreichbare
Kombination gegen die echte Serverlogik durchgespielt — alle liefen fehlerfrei durch. Wir haben dafür bewusst
**keine Änderung „auf Verdacht"** vorgenommen.

> **Bitte an Sophie:** Wenn der Effekt erneut auftritt, bitte in Schritt 4 den Browser mit **F12** öffnen,
> Reiter **Netzwerk**, dann „Speichern & Weiter" drücken und einen Screenshot der rot markierten Zeile samt
> Antwort schicken. Damit lässt sich das in Minuten klären. Gut möglich, dass es dieselbe Ursache wie in
> Schritt 2 war (unpassender Gerätetyp) und der leere Fehlerhinweis es nur verdeckt hat — dann ist es mit der
> Korrektur an Schritt 2 bereits erledigt.

### F — Reparatur-Workflow

**F1 · „Reparatur-Workflow — der allgemeine ist wieder drin?"** → **Ja, bestätigt, behoben.**
Drei Ursachen: Die Startroutine hat die allgemeinen Vorlagen bei **jedem Serverstart neu angelegt** — ein
Löschen war damit wirkungslos. Die Vorschlagsliste zeigte allgemeine Vorlagen **bei jedem Auftrag**. Und eine
fest verdrahtete Namensliste holte „Reparatur-Workflow" auch dann wieder in die Vorschläge, wenn er bereits
zugewiesen war. Alles drei ist behoben; eine bewusst gelöschte Vorlage bleibt gelöscht.

> **Bitte um Bestätigung:** Ein allgemeiner Workflow wird jetzt nur noch vorgeschlagen, wenn keine passendere
> Vorlage greift. Bitte gegenprüfen, ob das der gewünschten Arbeitsweise entspricht.

### G — Versand

**G1 · „Reparatur abgeschlossen → ich kann es nicht versenden; nur ‚Einsendelabel', und das ist ausgegraut"**
→ **Behoben.**
Auf dem Auftrag gab es schlicht keine Aktion für den Rückversand — der war nur über die Buchungsliste und das
Drei-Punkte-Menü erreichbar. Genau das hat Sophie beschrieben. Die Aktion ist jetzt direkt im Auftrag verfügbar
und wird korrekt freigegeben.

**G2 · „Wenn ich ein Label erstellen will, kommt eine Fehlermeldung"** → **Behoben.**
Mehrere Ursachen. Die wahrscheinlichste: Nach dem Anlegen des Labels wurde der Buchung ein Status zugewiesen,
den es gar nicht gibt — das Speichern brach mit einem Fehler ab, **nachdem** das Label bei DHL bereits erzeugt
worden war. Genau das ergibt „Label kommt, aber Fehlermeldung". Dazu kamen unvollständige Pflichtfelder im
DHL-Aufruf und eine Konfigurationsverwechslung, durch die eine Produktivkonfiguration still auf der Testumgebung
landete. Fehlermeldungen erscheinen jetzt auf Deutsch und benennen das fehlende Feld.

**G3 · „Versand an Packstationen? Andere Form der Adresseingabe nötig"** → **Teilweise behoben.**
Ein echter Fehler wurde gefunden und behoben: Eine hinterlegte Packstation-Adresse wirkte sich auf das
**Einsendelabel** aus, sodass das Hinweg-Label an die Packstation adressiert wurde. Das Admin-Label-Fenster
unterstützt die Packstation-Adresse jetzt.

**Bewusst nicht umgesetzt:** Postfiliale/Paketshop und der Gastbestellprozess. Das ist **neue Funktionalität**,
kein Fehler, und gehört als eigenes Arbeitspaket geplant.

**G4 · „Service Type: ‚Parcel' oder ‚DHL Paket'? Wir haben doch nur DHL Paket"** → **Behoben.**
Beide Einträge waren dasselbe Produkt, die beiden Dialoge zeigten unterschiedliche Listen, und in einem der
beiden hatte das Feld **überhaupt keine Wirkung**. Es gibt jetzt eine gemeinsame Liste mit deutschen
Bezeichnungen und nur den tatsächlich angebotenen Produkten. Alte Datensätze bleiben lesbar.

**G5 · „Die Sendungsnummer vom Kunden zu uns ist mit Rückweg gelabelt"** → **Behoben.**
Bestätigt. Die Richtung wird jetzt aus den Daten bestimmt statt aus einer festen Überschrift, sodass die
Hinweg-Sendung nicht mehr unter „Rückweg" erscheint.

---

## 3. Was wir zusätzlich gefunden haben

Zwei Dinge, die **nicht** im Testprotokoll standen und die wir beim Nachverfolgen gefunden haben:

1. **Fremde Rechnungen einsehbar (Sicherheit).** Siehe C1. Geschlossen.
2. **Automatische Zahlungszuordnung war wirkungslos.** Siehe B2. Die Funktion existierte, hat aber nie etwas
   getan. Hätte man nur auf ihre Existenz geschaut, wäre der Punkt fälschlich als „bereits erledigt" abgehakt
   worden.

---

## 4. Zwei Entscheidungen, die bei euch liegen

### 4.1 Bereits gestellte Rechnungen weisen eine falsche MwSt. aus

Durch **A2** wurde in betroffenen Rechnungen die Steuer zu hoch berechnet — bei einem Auftrag über 119,00 EUR
standen **22,61 EUR statt 19,00 EUR**. Solche Rechnungen wurden mit ausgewiesener USt-IdNr. möglicherweise
bereits an Kunden versendet.

Ein Korrekturskript liegt bereit, **wurde aber bewusst nicht ausgeführt**. Es läuft standardmäßig im Probelauf
und schreibt nur mit ausdrücklicher Bestätigung; festgeschriebene Belege rührt es nicht an.

**Zu klären:** Ob eine stille Datenkorrektur überhaupt zulässig ist oder ob es für bereits versendete
Rechnungen förmliche Gutschriften mit Neuberechnung braucht. Das ist eine kaufmännische und steuerliche
Entscheidung, keine technische — bitte mit der Buchhaltung klären.

### 4.2 Nummernkreis vor dem Livegang initialisieren

Der neue Zähler muss **einmalig** auf den höchsten bereits vergebenen Wert gesetzt werden. Passiert das nicht,
können neue Nummern mit bestehenden kollidieren. Das Skript dafür liegt bereit und läuft ebenfalls standardmäßig
nur als Probelauf. Details im technischen Bericht.

---

## 5. Womit geprüft wurde — und womit nicht

**Geprüft:**
- Alle fünf vorhandenen Finanztests des Projekts laufen fehlerfrei durch.
- Die Typprüfung der Oberfläche ist vollständig fehlerfrei.
- Eine eigene Abnahmeprüfung mit 14 Zusicherungen zu Sophies Beispielfällen läuft vollständig durch.
- Alle Tests liefen gegen eine **separate Wegwerf-Datenbank**. Die Entwicklungsdatenbank wurde zu keinem
  Zeitpunkt angefasst, es wurden keine echten PayPal-, DHL- oder E-Mail-Vorgänge ausgelöst und kein
  Kundendatensatz verändert.

**Nicht geprüft — bitte beim Nachtesten beachten:**
- **Es wurde nichts im Browser angeklickt.** Das Projekt hat keine automatisierten Oberflächentests. Rein
  optische Dinge — wie die neue Gutschriften-Ansicht aussieht, ob der PDF-Knopf tatsächlich eine Datei
  speichert, ob die Historie sauber dargestellt wird — sind **nicht** verifiziert.
- Es wurde **kein echtes DHL-Label** erzeugt und **keine echte Zahlung** ausgeführt.
- Bestehende Datensätze wurden nicht migriert; ältere Einträge können weiterhin alte Texte enthalten.

**Empfehlung:** Sophie sollte gezielt erneut testen — Schwerpunkt auf den Beträgen (A1, A2, D1), dem
Rückversand aus dem Auftrag (G1), der Labelerstellung (G2) und Schritt 4 der Inspektion (E3, siehe die
Bitte oben).
