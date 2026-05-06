# Flowchart: Buchungs-/Order- und Reparaturprozess

```mermaid
flowchart TD
    %% Buchung und Auftragserstellung
    A[Start: Kunde startet neue Reparaturanfrage] --> B[Schritt 1: Geraet auswaehlen]
    B --> C[Schritt 2: Reparaturservice auswaehlen]
    C --> D[Schritt 3: Zusatzinfos und Add-ons]
    D --> E[Schritt 4: Fotos und Notizen]
    E --> F[Schritt 5: Pruefen und in den Warenkorb]
    F --> G[Checkout und Auftragserstellung]
    G --> H[Status: pending / Auftrag erhalten]

    %% Hinversand
    H --> I[Versandlabel erstellen]
    I --> J[shippingStatus: label-created]
    J --> K[Paket an Carrier uebergeben]
    K --> L[shippingStatus: shipped]
    L --> M[shippingStatus: in-transit]
    M --> N[shippingStatus: out-for-delivery]
    N --> O{Beim Servicepartner zugestellt?}

    O -->|Ja| P[shippingStatus: delivered]
    O -->|Nein| O1[shippingStatus: failed]
    O1 --> O2[Kunde kontaktieren / erneuter Versandversuch]
    O2 --> I

    %% Werkstattprozess
    P --> Q[Geraeteeingang und Erstinspektion]
    Q --> R[Status: diagnostic-assessment]
    R --> S[Diagnose und Fehleranalyse]
    S --> T{Kostenvoranschlag/Freigabe erforderlich?}

    T -->|Ja| U[Kostenvoranschlag an Kunde]
    U --> V{Freigabe erhalten?}
    V -->|Nein| W[Auftrag pausieren/abbrechen oder Ruecksendung unrepariert]
    V -->|Ja| X[Status: in-progress]

    T -->|Nein| X

    X --> Y[Reparaturdurchfuehrung]
    Y --> Z{Teile fehlen?}
    Z -->|Ja| Z1[Status: awaiting-parts]
    Z1 --> Z2[Teilebeschaffung]
    Z2 --> Y
    Z -->|Nein| AA[Status: quality-check]

    AA --> AB{Qualitaetskontrolle bestanden?}
    AB -->|Nein| AC[Nacharbeit / erneute Reparatur]
    AC --> Y
    AB -->|Ja| AD[Status: completed / ready-for-pickup]

    %% Rueckversand
    AD --> AE[Rueckversandlabel erstellen]
    AE --> AF[Rueckversand: shipped]
    AF --> AG[Rueckversand: in-transit]
    AG --> AH[Rueckversand: out-for-delivery]
    AH --> AI{Beim Kunden zugestellt?}

    AI -->|Ja| AJ[Rueckversand: delivered]
    AJ --> AK[Ende: Reparaturprozess abgeschlossen]

    AI -->|Nein| AL[Rueckversand: failed]
    AL --> AM[Klaerung mit Carrier/Kunde und erneuter Zustellversuch]
    AM --> AF
```

## Hinweise

- Der Ablauf kombiniert den Order-Flow (5-Step Buchung + Checkout), den DHL-Shipping-Status-Flow und den internen Repair-Status-Flow.
- Entscheidungsstellen (z. B. Freigabe, Teileverfuegbarkeit, QA-Ergebnis) sind als Verzweigungen modelliert.
- Rueckversand ist als eigener Shipping-Teilprozess enthalten.
