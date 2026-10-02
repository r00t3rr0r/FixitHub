# Nachweise Abnahme 02.10.2026

Dauerhafte, geschwärzte Kopie der Test- und Browser-Nachweise zu `TECHNISCHER_AENDERUNGSBERICHT_2026-10-02.md`.
Alle Läufe fanden ausschließlich in einer isolierten Umgebung statt (Wegwerf-MongoDB, Netzwerkschutz, Test-Postfach); es wurde
nie ein externer Dienst (DHL, PayPal, SMTP) angesprochen.

**Nicht enthalten (absichtlich):** Test-Datenbank, Test-Postfach (`.eml` enthalten Gast-Links mit Token), Browser-Sitzungen
(`state_*.json`), Passwortdateien (`.pw`, `.adminpw`), Planungs-/Cache-Dateien. In allen Texten sind Gast-Tokens, JWTs und lange
Hex-Werte durch `<entfernt>` ersetzt. Pfade auf das ursprüngliche Arbeitsverzeichnis sind durch `/tmp/fixithub-e2e` ersetzt.

## Inhalt

| Ordner | Inhalt |
|---|---|
| `ergebnisse/tests/` | `_zusammenfassung.txt` (57 Testdateien, Exit-Code, Netzwerkschutz, Ergebniszeile), `_hilfstests.txt`, Protokoll je Testdatei |
| `ergebnisse/browser/` | `_zusammenfassung.txt` (Endlauf aller Browser-Abläufe nach frischem Server-Neustart), Protokoll je Ablauf (PASS/FAIL je Prüfung, Hinweise auf vorbereitete Testdaten) |
| `ergebnisse/typpruefung/` | tsc-Ausgabe des Ausgangsstands `dec6fff` und des Endstands, normalisierter Vergleich (`tsc_vergleich.json`: hinzugekommen / behoben / unverändert) |
| `werkzeuge/` | `netguard.js` (blockiert jede nicht-lokale Verbindung und Port 27017; korrigierte Fassung der Schlussrunde – die zuvor genutzte erfasste `net.connect`/`net.createConnection` nicht), `run_all_tests.sh`, `tsc_compare.py`, `e2e/` (Browser-Abläufe `flow_*.js`, `flowlib.js`, `run_final_flows.sh`, `restart_after.sh`, Szenario-/Seed-Skripte, `mailcapture.js` (Test-Postfach), `vite.e2e.config.mjs`, `vite.build.check.mjs`, `shims/` (Ersatz für lokal fehlende Pakete)) |

Bilder der Abläufe: `screenshots/abnahme-2026-10-02/`.

## Wiederholen (nur lokal, nur mit Testdaten)

1. Arbeitsverzeichnis anlegen und Werkzeuge kopieren:
   ```bash
   mkdir -p /tmp/fixithub-e2e && cp -r nachweise/abnahme-2026-10-02/werkzeuge/* /tmp/fixithub-e2e/
   ```
2. Eigene Test-Passwörter für die Testkonten in `/tmp/fixithub-e2e/e2e/.pw` und `.adminpw` hinterlegen (niemals echte Passwörter,
   niemals ins Repo).
3. Wegwerf-MongoDB starten (nie die Produktions- oder `.env`-Datenbank):
   ```bash
   mongod --dbpath /tmp/fixithub-e2e/mongo-data --port 27099 --bind_ip 127.0.0.1 --fork --logpath /tmp/fixithub-e2e/mongod.log --setParameter enableTestCommands=1
   ```
4. Repo-Tests (jede Datei prüft selbst, dass nur eine Wegwerf-DB benutzt wird):
   ```bash
   bash /tmp/fixithub-e2e/run_all_tests.sh wiederholung
   ```
5. Browser-Abläufe: Testserver (Port 5099, DB `e2e_after`) mit `e2e/restart_after.sh` und die Oberfläche mit
   `node client/node_modules/.bin/vite --config /tmp/fixithub-e2e/e2e/vite.e2e.config.mjs` (aus dem Verzeichnis `client`) starten,
   Szenario einmalig mit `e2e/scenario.js` anlegen, dann `bash /tmp/fixithub-e2e/e2e/run_final_flows.sh wiederholung`.
   Playwright und Chromium müssen lokal vorhanden sein (Pfad in `flowlib.js`).
6. Typprüfung (gleicher Befehl wie am Ausgangsstand):
   ```bash
   cd client && npx tsc -p tsconfig.app.json --noEmit > /tmp/tsc_jetzt.txt 2>&1
   python3 /tmp/fixithub-e2e/tsc_compare.py nachweise/abnahme-2026-10-02/ergebnisse/typpruefung/tsc_ausgangsstand_dec6fff.txt /tmp/tsc_jetzt.txt /tmp/tsc_vergleich.json
   ```

Die Abläufe legen bei jedem Lauf neue Testbuchungen/-aufträge an und sind auf wachsende Testdaten ausgelegt.
