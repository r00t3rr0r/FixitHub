# Homepage Reparaturauftrags-Funktion - Schnellreferenz

## 🎯 Übersicht
Die Homepage enthält jetzt einen vollständig erweiterten Reparaturauftrags-Konfigurator mit 8 Schritten.

## 📋 Benutzerflow

### Schritt 1: Gerätetyp wählen
- Smartphone, Tablet, Laptop, etc.
- Klick auf Gerät → Automatischer Wechsel zu Schritt 2

### Schritt 2: Marke & Modell
- Marke aus Dropdown auswählen
- Modell per Autocomplete-Suche finden
- "Weiter" klicken

### Schritt 3: Reparatur auswählen **[NEU]**
#### Option A: Reparatur anfragen (empfohlen bei Unsicherheit)
- Klick auf "Reparatur anfragen"
- Leitet zu vollständiger Anfrage-Seite weiter
- Beschreibung des Problems, Fotos hochladen
- Kostenlose Diagnose erhalten

#### Option B: Spezifische Reparatur wählen
- Mehrere Reparaturen auswählbar
- Preise werden angezeigt
- Mindestens 1 Reparatur erforderlich

### Schritt 4: Extras
- Optional: Add-on Services hinzufügen
- Express-Service, Schutzfolie, etc.
- "Weiter" auch ohne Extras möglich

### Schritt 5: Entsperrung **[NEU]**
#### Drei Optionen:
1. **Pattern Lock**: 3x3 Grid visuell bedienen
2. **Unlock Code**: PIN/Passwort eingeben
3. **Kein Schloss**: Gerät hat keine Sperre

### Schritt 6: Details & Fotos **[NEU]**
#### Fragebogen:
- **Fehlerbeschreibung**: Was ist das Problem?
- **Wasserschaden**: Ja/Nein/Unsicher
- **Vorherige Reparaturen**: Details angeben wenn ja
- **Gerätezustand**: Original/Generalüberholt

#### Foto-Upload:
- Bis zu 5 Bilder
- Max. 5MB pro Bild
- JPG, PNG, GIF
- Vorschau & Löschen möglich

### Schritt 7: Prüfung & Multi-Device **[NEU]**
#### Zusammenfassung aktuelles Gerät:
- Modell, Reparaturen, Extras
- Entsperrung, Fotos

#### Weiteres Gerät hinzufügen:
- "Weiteres Gerät hinzufügen" Button
- Beginnt bei Schritt 1 für neues Gerät
- Bereits hinzugefügte Geräte werden angezeigt

### Schritt 8: Abschluss
- Finale Zusammenfassung aller Geräte
- Gesamtpreis-Kalkulation
- "Reparatur beauftragen" → Checkout

## 🔧 Entwickler-Notizen

### State-Struktur
```tsx
// Single Device
{
  selectedDeviceType: DeviceType
  selectedBrand: string
  selectedModel: DeviceModel
  selectedRepairs: RepairService[]
  selectedAddOns: AddOnService[]
  unlockPattern: string[]
  unlockCode: string
  noDeviceLock: boolean
  errorDescription: string
  waterDamage: 'yes' | 'no' | 'unsure'
  previousRepairAttempts: 'yes' | 'no'
  previousRepairDetails: string
  itemCondition: 'original' | 'refurbished'
  customerNotes: string
  photos: File[]
  photoPreviewUrls: string[]
}

// Multiple Devices
{
  devices: DeviceOrder[]
  currentDeviceIndex: number
}
```

### Wichtige Funktionen
```tsx
// Navigation
goToNextStep() - Validiert und geht zum nächsten Schritt
goToPreviousStep() - Zurück zum vorherigen Schritt

// Multi-Device
addAnotherDevice() - Speichert aktuelles Gerät, startet neues

// Repair Request
navigateToRepairRequest() - Route zu /repair-request

// Upload
handlePhotoUpload(e) - Validiert und speichert Fotos
removePhoto(index) - Entfernt spezifisches Foto

// Submit
handleSubmitOrder() - Sammelt alle Daten und navigiert zu /new-order
```

### Validierung
- **Schritt 2**: Modell muss ausgewählt sein
- **Schritt 3**: Mindestens 1 Reparatur ODER Navigation zu Anfrage
- **Fotos**: Max 5 Bilder, max 5MB, nur Bilder

### Navigation-Flow
```
Homepage
  └── RepairOrderConfigurator (8 Schritte)
      ├── Schritt 3: "Reparatur anfragen" Button
      │   └── /repair-request (RepairRequestQuestionnaire)
      │       └── /orders (Nach Absenden)
      └── Schritt 8: "Reparatur beauftragen"
          └── /new-order (Mit orderData im State)
              └── /cart (Nach Validierung)
```

## 🎨 Design-Elemente

### Farb-Codierung nach Schritt
- Schritt 1 (Gerätetyp): Blau
- Schritt 2 (Marke/Modell): Grün
- Schritt 3 (Reparatur): Lila + Blau (Anfrage-Button)
- Schritt 4 (Extras): Grün/Smaragd
- Schritt 5 (Entsperrung): Orange/Rot
- Schritt 6 (Details): Mehrfarbig
- Schritt 7 (Prüfung): Blau + Lila (Multi-Device) + Grün (Geräte)
- Schritt 8 (Abschluss): Blau

### Icons
- Lock (Entsperrung)
- Upload (Fotos)
- FileText (Reparatur anfragen)
- AlertCircle (Fehlerbeschreibung)
- Droplets (Wasserschaden)
- Wrench (Vorherige Reparaturen)
- Package (Gerätezustand)
- Plus (Weiteres Gerät)
- Check (Bestätigung)

## 📱 Responsive Design
- Desktop: Volle Ansicht mit 8 Schritt-Indikatoren
- Tablet: Kompakte Schritt-Labels
- Mobile: Minimale Labels (.6rem font-size)

## ⚙️ Configuration

### Limits
```typescript
const LIMITS = {
  maxPhotos: 5,
  maxPhotoSize: 5 * 1024 * 1024, // 5MB
  maxDevices: 10, // Optional begrenzen
  minRepairs: 1
}
```

### Toast Messages
- Erfolg: Gerät hinzugefügt, Foto hochgeladen
- Fehler: Validierung fehlgeschlagen, Datei zu groß
- Info: Schritt-Wechsel nicht möglich

## 🔐 Sicherheit

### Unlock-Codes
- Pattern: Array von Zahlen (1-9)
- Code: String (wird maskiert in Anzeige)
- NoLock: Boolean

**⚠️ Wichtig**: Backend muss Unlock-Daten verschlüsselt speichern!

### Foto-Upload
- Client-seitige Validierung (Typ, Größe)
- Server-seitige Validierung erforderlich
- Base64 nur für Prototyp - Produktion: S3/Cloudinary

## 📊 Analytics-Events (empfohlen)

```typescript
// Track wichtige Aktionen
analytics.track('repair_request_clicked')
analytics.track('unlock_method_selected', { method: 'pattern|code|nolock' })
analytics.track('photo_uploaded', { count: number })
analytics.track('device_added_to_order', { deviceType, deviceCount })
analytics.track('order_submitted', { deviceCount, totalValue })
```

## 🐛 Bekannte Einschränkungen

1. **Foto-Speicherung**: Aktuell Base64 - für viele Fotos nicht ideal
2. **Browser-Speicher**: SessionStorage hat Limit (~5-10MB)
3. **Offline-Support**: Nicht implementiert
4. **Auto-Save**: Kein automatisches Speichern von Zwischenständen

## 🚀 Produktionsstart Checkliste

- [ ] Backend-Endpoint für Multi-Device Orders testen
- [ ] Unlock-Code Verschlüsselung verifizieren
- [ ] Foto-Upload zu Cloud-Storage migrieren
- [ ] Analytics-Events implementieren
- [ ] Cross-Browser Testing (Chrome, Firefox, Safari)
- [ ] Mobile Testing (iOS, Android)
- [ ] Barrierefreiheit testen
- [ ] Performance-Tests mit vielen Fotos
- [ ] Load-Testing des Checkout-Prozesses
- [ ] Monitoring & Error-Tracking Setup

---

**Version**: 1.0.0  
**Letzte Aktualisierung**: 1. März 2026  
**Autor**: AI Assistant
