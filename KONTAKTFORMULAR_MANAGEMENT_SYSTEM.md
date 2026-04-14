# Kontaktformular-Management System für FixitHub

## 🎯 Übersicht

Ein komplettes Admin-Interface wurde implementiert, um Kontaktformular-Anfragen von der öffentlichen Kontaktseite zu verwalten und professionelle Email-Antworten zu versenden.

## 📦 Implementierte Komponenten

### Backend (Server)

#### 1. **Datenmodell: `ContactMessage`** (`server/models/ContactMessage.js`)
- Speichert alle Kontaktformular-Anfragen in der MongoDB-Datenbank
- Tracks: Name, Email, Telefon, Anliegen, Nachricht, Auftragsnummer
- Speichert alle Antwort-Historie pro Anfrage
- Status-Tracking: `new`, `read`, `replied`, `closed`

#### 2. **Service: `contactMessageService`** (`server/services/contactMessageService.js`)
- **Funktionen:**
  - `saveContactMessage()` - Speichert neue Anfragen in DB
  - `getContactMessages()` - Abrufen mit Filterung & Pagination
  - `sendReply()` - Versendet Email-Antwort and speichert im System
  - `saveDraftReply()` - Speichert Antwort als Entwurf
  - `getContactMessageStats()` - Statistiken (neu, beantwortet, geschlossen)
  - `deleteMessage()` - Löscht Anfrage
  - `updateMessageStatus()` - Ändert Status

#### 3. **API-Routes: `adminContactRoutes`** (`server/routes/adminContactRoutes.js`)
```
GET    /api/admin/contact-messages           - Alle Anfragen abrufen
GET    /api/admin/contact-messages/stats     - Statistiken
GET    /api/admin/contact-messages/:id       - Einzelne Anfrage
PUT    /api/admin/contact-messages/:id/status - Status aktualisieren
POST   /api/admin/contact-messages/:id/reply  - Antwort versenden
DELETE /api/admin/contact-messages/:id        - Anfrage löschen
```

#### 4. **Kontakt-Service Update** (`server/services/contactService.js`)
- Speichert Anfragen nun auch in der Datenbank
- Asynchrone Speicherung blockiert nicht die Email-Antwort

### Frontend (Client)

#### 1. **API-Modul** (`client/src/api/contactMessages.ts`)
- TypeScript-Interface für Contact-Messages
- CRUD-Funktionen zum Verwalten von Anfragen
- Vollständige Typsicherheit

#### 2. **Komponente: `ContactMessagesPanel`** (`client/src/components/admin/ContactMessagesPanel.tsx`)
**Hauptfunktionen:**
- Übersichts-Tabelle aller Kontaktanfragen
- Statistik-Karten (Neu, Gesamt, Beantwortet, Geschlossen)
- Suchfunktion nach Name, Email, Inhalt
- Filter nach Status (Neu, Gelesen, Beantwortet, Geschlossen)
- Pagination (10 Einträge pro Seite)
- Detailansicht mit vollständiger Anfrage-Historie
- Status-Änderung mit Dropdown
- Antwort-Dialog öffnen
- Löschen mit Bestätigungsdialog

**UI-Design:**
- Konsistent mit McRepair-Design
- Dark-Mode-Support
- Responsiv für Mobile

#### 3. **Komponente: `ContactMessageReplyDialog`** (`client/src/components/admin/ContactMessageReplyDialog.tsx`)
**Features:**
- **3 Bearbeitungs-Modi:**
  - Text Editor: Einfacher Text mit Variablen
  - HTML: Direktes HTML-Bearbeiten
  - Vorschau: Live-Vorschau der Email
  
- **Intelligente Variablen:**
  - {{senderName}} - Name des Absenders
  - {{senderEmail}} - Email des Absenders  
  - {{senderPhone}} - Telefon des Absenders
  - {{subject}} - Thema der Anfrage
  - {{orderNumber}} - Auftragsnummer
  - {{messageContent}} - Inhalt der Original-Anfrage
  - {{supportEmail}} - Support-Email
  - {{supportPhone}} - Support-Telefon
  - {{companyName}} - Unternehmensname

- **One-Click Variable Insertion**: Buttons zum Einfügen von Platzhaltern
- **Betreffzeile-Bearbeitung**
- **2 Actions:**
  - „Als Entwurf speichern" - Speichert ohne zu versenden
  - „Senden" - Versendet Email sofort

#### 4. **Seiten-Integration: `RepairRequestsManagement`** (`client/src/pages/admin/RepairRequestsManagement.tsx`)
- **Tab-Navigation:**
  - Tab 1: Reparaturanfragen (existierend)
  - Tab 2: **Kontaktanfragen (neu)** 
- Nahtlose Integration in bestehende Seite
- Beide Tabs haben ihre eigene Verwaltungs-Oberfläche

## 🔄 Workflow

### Kunde sendet Kontaktformular (Contact-Seite)
1. Kunde füllt öffentliches Kontaktformular aus
2. Formular wird an `/api/contact` gesendet
3. **Neu:** Anfrage wird in `ContactMessage`-Collection gespeichert
4. Email wird an Support-Adresse versendet
5. Bestātigung geht an Kunden

### Admin verwaltet Anfragen (Repair-Requests-Seite)
1. Admin öffnet `/admin/repair-requests` Seite
2. Klickt auf Tab "Kontaktanfragen"
3. Sieht Liste aller Kontaktanfragen mit Status
4. Kann Anfrage öffnen zum Ansehen der Details
5. Klickt "Antworten" Button
6. **Email-Antwort schreiben:**
   - Wählt Editor-Modus (Text/HTML/Vorschau)
   - Tippt Antwort-Text
   - Klickt Variable-Buttons um Platzhalter einzufügen (z.B. {{senderName}})
   - Kann Email in Vorschau-Modus ansehen
7. Klickt "Senden" oder "Als Entwurf speichern"
8. **Neu:** Email wird an Kunden versendet mit automatischem Variablen-Ersatz
9. Antwort wird im System gespeichert
10. Anfrage-Status wird auf "beantwortet" gesetzt
11. Admin kann Status auf "Geschlossen" ändern wenn nötig

## 🛠️ Technische Details

### Datenfluss
```
Kontaktformular (Public)
    ↓
POST /api/contact
    ↓
ContactService.submitInquiry()
    ├→ Speichert in DB (ContactMessage)
    └→ Versendet Email
         ↓
Admin öffnet /admin/repair-requests
    ↓
Tab "Kontaktanfragen" → ContactMessagesPanel
    ↓
Admin öffnet Anfrage
    ↓
Klickt "Antworten" → ContactMessageReplyDialog
    ↓
Admin schreibt Email mit Variablen
    ↓
POST /api/admin/contact-messages/:id/reply
    ↓
ContactMessageService.sendReply()
    ├→ Ersetzt {{Variablen}} mit Daten
    ├→ Versendet Email via NodeMailer
    └→ Speichert Antwort in DB
         ↓
Funktion abgeschlossen ✅
```

### Sicherheit
- ✅ Nur Administratoren können Kontaktanfragen sehen/antworten
- ✅ `requireUser` Middleware für Auth-Check
- ✅ `requireAdmin` Middleware in allen Admin-Routes
- ✅ HTML-Escape für XSS-Schutz in Service

### Email-Handling
- Nutzt bestehendes `EmailService` System
- Variablener-Ersatz vor Email-Versand
- Reply-To wird automatisch auf Kunde gesetzt
- Fehlerbehandlung mit Loggin

## 📊 Database Schema

```javascript
ContactMessage {
  messageNumber: String (unique),
  name: String,
  email: String (indexed),
  phone: String,
  subject: enum['repair', 'status', 'business', 'complaint', 'other'],
  message: String,
  orderNumber: String,
  status: enum['new', 'read', 'replied', 'closed'],
  isSpam: Boolean,
  replies: [{
    repliedBy: String,
    repliedAt: Date,
    subject: String,
    message: String,
    htmlContent: String,
    templateName: String,
    variables: Object,
    status: enum['draft', 'sent', 'failed'],
    sentAt: Date,
    messageId: String,
    error: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## 🎨 UI/UX Features

### Kontaktanfragen-Panel
- **Statistik-Karten** oben (Neu, Gesamt, Beantwortet, Geschlossen)
- **Suchleiste** zum Filtern nach Name/Email/Inhalt
- **Status-Filter** Dropdown
- **Responsive Tabelle** mit:
  - Absendedatum
  - Kunde (Name)
  - Email-Adresse
  - Anliegen (Reparatur/Status/etc.)
  - Status-Badge (farblich)
  - "Öffnen"-Button

### Detailansicht
- Alle Anfrage-Informationen in strukturiertem Layout
- Grauer Hintergrund-Box für Original-Nachricht
- Grüne Hintergrund-Box für Antworten
- Status-Dropdown zum Ändern
- "Antworten"-Button (rot) und "Löschen"-Button
- Scroll-Area für lange Inhalte

### Antwort-Dialog
- **Mode-Toggle** (Text/HTML/Vorschau)
- **Betreffzeile-Eingabe**
- **Großes Textarea** für Nachricht
- **Variablen-Buttons** darunter zum schnellen Einfügen:
  - {{senderName}}, {{senderEmail}}, etc.
- **Live-Vorschau** mit HTML-Rendering
- **Zwei Action-Buttons:**
  - "Als Entwurf speichern"
  - "Senden" (mit Loader-Indicator)

## ✅ Testing-Schritte

1. **Kontaktformular testen:**
   - Gehe zu öffentlicher Contact-Seite
   - Fülle Formular aus
   - Verprüfe, dass Anfrage in DB gespeichert ist

2. **Admin-Interface testen:**
   - Gehe zu `/admin/repair-requests`
   - Klicke auf Tab "Kontaktanfragen"
   - Verprüfe Statistik-Karten
   - Suche nach einer Anfrage
   - Öffne Anfrage
   - Klicke "Antworten"
   - Schreibe Text mit Variablen
   - Klicke "Senden"
   - Verprüfe, dass Email versendet wurde
   - Verprüfe, dass Antwort im System gespeichert ist
   - Ändern Status zu "Geschlossen"

3. **Fehler-Fälle testen:**
   - Versuche ohne Admin zu antworten (sollte 403 geben)
   - Versuche leere Nachricht zu senden (sollte Fehler geben)
   - Teste Pagination
   - Teste HTML-Modus mit Custom-Design

## 🚀 Zukünftige Verbesserungen

- [ ] Email-Template-Auswahl
- [ ] Vorgespeicherte Antwort-Vorlagen
- [ ] Automatische Antworten basierend auf Anliegen-Typ
- [ ] Anhänge in Antworten
- [ ] Automatische Eskalation unverantworteter Anfragen
- [ ] Integration mit Ticketing-System
- [ ] Bulk-Aktionen (mehrere Anfragen gleichzeitig)
- [ ] Assignment zu bestimmten Mitarbeitern
- [ ] Zeitstempel für Antwort-Dauer

## 📝 Notes

- Alle Komponenten folgen dem bestehenden Design-System
- TypeScript mit vollständiger Typsicherheit
- Error-Handling und Loading-States implemented
- i18n-ready (German translations included)
- Dark-Mode Support
