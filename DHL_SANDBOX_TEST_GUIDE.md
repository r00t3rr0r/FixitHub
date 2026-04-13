# DHL Parcel DE Shipping API - Sandbox Test Anleitung

## Schritt 1: Vorbereitung - API-Anmeldedaten konfigurieren

Bevor Sie den Test ausführen, müssen Sie Ihre API-Anmeldedaten vom DHL Developer Portal in die `.env`-Datei eintragen:

```bash
# 1. Öffnen Sie die .env Datei
nano .env

# 2. Fügen Sie folgende Zeilen hinzu (ersetzen Sie mit Ihren echten Werten von https://developer.dhl.com/):
DHL_CLIENT_ID=Ihre_Client_ID_vom_Developer_Portal
DHL_CLIENT_SECRET=Ihr_Client_Secret_vom_Developer_Portal
```

## Schritt 2: Test ausführen

Der Testskript konfiguriert automatisch die DHL Sandbox Integration mit den folgenden Standard-Testdaten:

```
Umgebung: Sandbox
Token-Endpoint: https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token
Username: user-valid
Password: SandboxPasswort2023!
Billing Number (EKP): 33333333330101
Grant Type: password
```

### Testskript ausführen:

```bash
# Von der Root des Projekts aus:
node test-dhl-sandbox-connection.js
```

## Schritt 3: Ergebnis interpretieren

Der Skript wird folgende Informationen anzeigen:

### ✅ Erfolg:
```
Status: ✅ ERFOLGREICH
Nachricht: DHL API Connection successful
```
Das bedeutet:
- OAuth Token erfolgreich erhalten
- API-Anmeldedaten sind korrekt
- Sandbox-Umgebung ist erreichbar

### ❌ Fehler - Lösungsschritte je nach Fehlertyp:

#### `invalid_client`
**Problem:** Client ID oder Client Secret sind falsch, oder Sandbox-Anmeldedaten auf Production-Endpoint

**Lösung:**
1. Überprüfen Sie Ihre Werte im DHL Developer Portal unter "Applications"
2. Stellen Sie sicher, dass Sie Sandbox-Anmeldedaten verwenden (nicht Production)
3. Regenerieren Sie die Client Secret und aktualisieren Sie die `.env` Datei

```bash
# Beispiel OAuth Token Request für Debugging:
curl -X POST https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token \
  -d 'grant_type=password' \
  -d 'username=user-valid' \
  -d 'password=SandboxPasswort2023!' \
  -d 'client_id=YOUR_ACTUAL_CLIENT_ID' \
  -d 'client_secret=YOUR_ACTUAL_CLIENT_SECRET'
```

#### `invalid_grant`
**Problem:** Business Customer Username/Password sind falsch

**Lösung:**
1. Überprüfen Sie die Standard-Testdaten sind korrekt:
   - Username: `user-valid`
   - Password: `SandboxPasswort2023!`
2. Falls Sie andere Testbenutzer haben, aktualisieren Sie den Skript mit Ihren Daten

#### `unauthorized_client`
**Problem:** App existiert, ist aber nicht autorisiert für Parcel DE Shipping API

**Lösung:**
1. Melden Sie sich im DHL Developer Portal an
2. Gehen Sie zu Ihre App → API Permissions
3. Aktivieren Sie "Parcel DE Shipping" für die Sandbox-Umgebung

## Debug-Informationen verstehen

Der Test zeigt detaillierte Debug-Informationen:

```
🔐 Authentifizierung:
   Umgebung: sandbox
   Token-Endpoint: https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1/token
   Test-Endpoint: https://api-sandbox.dhl.com/parcel/de/shipping/v2/orders
   Auth-Flow: oauth2-password-ropc

📝 Anmeldedaten-Status:
   Client ID vorhanden: ✅
   Client Secret vorhanden: ✅
   Username vorhanden: ✅
   Password vorhanden: ✅

📍 Anmeldedaten-Quellen:
   Username-Quelle: integration-metadata
   Password-Quelle: integration-metadata
```

Diese Informationen helfen bei der Diagnose von Verbindungsproblemen.

## Maskierte Anmeldedaten

Aus Sicherheitsgründen zeigt der Test maskierte Anmeldedaten:
```
Client ID: ab****7g  (erste 2 + letzte 2 Zeichen sichtbar)
Username: us****lid
```

## Vollständiger Workflow nach erfolgreichem Test

1. ✅ Test erfolgreich (this step)
2. Konfigurieren Sie die DHL Integration im Admin Panel (`/admin/system`)
3. Erstellen Sie Test-Versand im Admin Panel
4. Überprüfen Sie Versand im DHL Sandbox Portal

## Weitere Ressourcen

- [DHL Developer Portal](https://developer.dhl.com/)
- [DHL Parcel DE Shipping API Dokumentation](https://developer.dhl.com/documentation/parcel-de-shipping-apis)
- [DHL Sandbox Portal](https://sandbox.dhl.de/)

## Probleme?

Falls der Test immer noch fehlschlägt:
1. Überprüfen Sie, dass MongoDB läuft: `npm run check-services` (oder manuell starten)
2. Überprüfen Sie Ihre `.env` Datei auf typos
3. Stellen Sie sicher, dass Sie die neuesten Testdaten vom DHL Portal verwenden
4. Kontaktieren Sie den DHL Support unter support@dhl.com
