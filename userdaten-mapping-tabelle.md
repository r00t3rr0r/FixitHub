# Userdaten Mapping-Tabelle (Alt → Neu)

| Altes Feld                | Neues Feld (FixitHub)         | Typ / Hinweise                                  |
|--------------------------|-------------------------------|-------------------------------------------------|
| email                    | email                         | String, Pflichtfeld, lowercase                   |
| passwort                 | password                      | String, Hash, nicht im Klartext importieren      |
| vorname                  | firstName                     | String                                          |
| nachname                 | lastName                      | String                                          |
| telefon                  | phone                         | String                                          |
| firma                    | company                       | String                                          |
| land                     | country                       | String                                          |
| ust_id                   | vatId                         | String                                          |
| kundennummer             | customerNumber                | String                                          |
| kundengruppe             | customerGroup                 | String                                          |
| haupt_kundengruppe_id    | primaryCustomerGroupId        | ObjectId (Ref: CustomerGroup)                   |
| kundengruppen_ids        | customerGroupIds              | Array of ObjectId (Ref: CustomerGroup)          |
| anrede                   | salutation                    | Enum: ['', 'Mr', 'Ms', 'Mrs', 'Dr', 'Prof']     |
| titel                    | title                         | String                                          |
| adresszusatz             | addressAddition               | String                                          |
| kundenherkunft           | customerOrigin                | String                                          |
| post_id                  | postId                        | String                                          |
| newsletter               | newsletter                    | Boolean                                         |
| kommentar                | comment                       | String                                          |
| zahlungsmethode          | paymentMethod                 | String                                          |
| zahlungsbedingungen      | paymentTerms                  | String                                          |
| interner_schluessel      | internalKey                   | String                                          |
| status                   | status                        | Enum: ['active', 'inactive', ...]               |
| rabatt                   | discount                      | Number (0-100)                                  |
| rolle                    | role                          | Enum: ['customer', 'staff', 'admin']            |
| abteilung                | department                    | String (nur staff)                              |
| spezialisierungen        | specializations               | Array of String (nur staff)                     |
| addons                   | addOnCapabilities             | Array of String (nur staff)                     |
| eintrittsdatum           | employmentStartDate           | Date (nur staff)                                |
| austrittsdatum           | employmentEndDate             | Date (nur staff)                                |
| faehigkeiten             | skills                        | Array: {name, level} (nur staff)                |
| rechnungsadresse         | invoiceAddress                | Objekt: street, city, state, zipCode, country   |
| zahlungsadresse          | paymentAddress                | Objekt: street, city, state, zipCode, country   |
| avatar_url               | avatar                        | String (URL)                                    |
| benachrichtigungen       | preferences.notifications     | Objekt: email, sms, push                        |
| kommunikation            | preferences.communication     | Objekt: orderUpdates, promotions, newsletter    |
| sprache                  | preferences.language          | String (z.B. 'de', 'en')                        |
| gesamt_bestellungen      | totalOrders                   | Number                                          |
| gesamt_umsatz            | totalSpent                    | Number                                          |
| erstellt_am              | createdAt                     | Date                                            |
| letzter_login            | lastLoginAt                   | Date                                            |
| aktiv                    | isActive                      | Boolean                                         |
| aktueller_status         | currentStatus                 | Enum: ['offline', 'online', ...]                |
| aktuelle_session_id      | currentSessionId              | String (UUID)                                   |
| letzte_anmeldung         | lastClockIn                   | Date                                            |
| letzte_abmeldung         | lastClockOut                  | Date                                            |
| aktuelle_bestellung_id   | currentOrderId                | ObjectId (Ref: Order)                           |
| aktuelle_bestellnummer   | currentOrderNumber            | String                                          |
| letzte_aktivitaet        | lastActivity                  | Date                                            |
| gesamt_arbeitsstunden    | totalHoursWorked              | Number                                          |
| arbeitsstunden_woche     | hoursThisWeek                 | Number                                          |
| arbeitsstunden_monat     | hoursThisMonth                | Number                                          |

**Hinweise:**
- Felder wie `password`, `refreshToken`, `passwordResetToken` sollten aus Sicherheitsgründen nicht übernommen werden.
- Für verschachtelte Felder (z.B. Adressen, Präferenzen) die Struktur beachten.
- Nicht alle alten Felder müssen zwingend übernommen werden, falls sie im neuen System nicht benötigt werden.
- Die Tabelle kann nach Bedarf erweitert werden.
