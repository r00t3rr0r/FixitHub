const DEFAULT_NOTIFICATION_TEMPLATE_VERSION = 4;

const brand = {
  companyName: '{{companyName}}',
  primary: '#1a2a5e',
  primaryDark: '#0f1d45',
  accent: '#f5b800',
  accentHover: '#e5ab00',
  background: '#f5f6f8',
  surface: '#ffffff',
  text: '#2d3748',
  muted: '#636e85',
  border: '#d8dce6',
  softBlue: '#eef3ff',
  softYellow: '#fff7df'
};

function createVariable(name, description, required = false) {
  return { name, description, required };
}

function renderDetailRows(rows = []) {
  if (!rows.length) {
    return '';
  }

  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:13px;font-weight:700;color:${brand.primary};width:170px;vertical-align:top;">${row.label}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:14px;color:${brand.text};vertical-align:top;">${row.value}</td>
        </tr>`
    )
    .join('');
}

function renderHighlights(items = []) {
  if (!items.length) {
    return '';
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
      <tr>
        ${items
          .map(
            (item) => `
              <td style="padding:0 6px 0 0;vertical-align:top;">
                <div style="background:${item.tone === 'yellow' ? brand.softYellow : brand.softBlue};border:1px solid ${brand.border};border-radius:14px;padding:16px;min-height:88px;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.primary};margin-bottom:8px;">${item.label}</div>
                  <div style="font-size:14px;line-height:1.5;color:${brand.text};">${item.value}</div>
                </div>
              </td>`
          )
          .join('')}
      </tr>
    </table>`;
}

function renderButton(label, url) {
  if (!label || !url) {
    return '';
  }

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 24px 0;">
      <tr>
        <td style="border-radius:999px;background:${brand.accent};text-align:center;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;line-height:1;color:${brand.primaryDark};text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function renderEmailTemplate({
  preheader,
  eyebrow,
  title,
  intro,
  highlights,
  detailRows,
  body,
  ctaLabel,
  ctaUrl,
  closing,
  footerNote
}) {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${brand.background};font-family:'Segoe UI',Arial,sans-serif;color:${brand.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.background};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:${brand.surface};border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(15,29,69,0.12);">
          <tr>
            <td style="height:8px;background:${brand.accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 36px;background:${brand.primary};">
              <div style="font-size:12px;line-height:1;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:14px;">${eyebrow}</div>
              <div style="font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;letter-spacing:-0.03em;">${brand.companyName}</div>
              <div style="width:72px;height:4px;border-radius:999px;background:${brand.accent};margin:22px 0 0 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px;">
              <h1 style="margin:0 0 14px 0;font-size:30px;line-height:1.2;font-weight:800;color:${brand.primaryDark};letter-spacing:-0.03em;">${title}</h1>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:${brand.muted};">${intro}</p>
              ${renderHighlights(highlights)}
              ${detailRows && detailRows.length ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;border-collapse:collapse;">
                  ${renderDetailRows(detailRows)}
                </table>` : ''}
              <div style="font-size:15px;line-height:1.8;color:${brand.text};">${body}</div>
              ${renderButton(ctaLabel, ctaUrl)}
              <div style="margin-top:28px;padding:18px 20px;background:${brand.softBlue};border-radius:18px;border:1px solid ${brand.border};font-size:14px;line-height:1.7;color:${brand.text};">
                ${closing}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px 32px 36px;background:#f8f9fc;border-top:1px solid ${brand.border};font-size:12px;line-height:1.7;color:${brand.muted};">
              ${footerNote}<br />
              Bei Fragen erreichen Sie uns unter <a href="mailto:{{supportEmail}}" style="color:${brand.primary};font-weight:700;text-decoration:none;">{{supportEmail}}</a> oder telefonisch unter {{supportPhone}}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function getDefaultNotificationTemplates() {
  return [
    {
      name: 'Registrierung und Kontoaktivierung',
      type: 'email',
      subject: 'Willkommen bei {{companyName}} - bitte Konto aktivieren',
      content: renderEmailTemplate({
        preheader: 'Bitte bestaetigen Sie Ihre E-Mail-Adresse fuer Ihr neues Kundenkonto.',
        eyebrow: 'Konto & Registrierung',
        title: 'Willkommen bei {{companyName}}',
        intro: 'Hallo {{customerName}}, vielen Dank fuer Ihre Registrierung. Bitte bestaetigen Sie Ihre E-Mail-Adresse, damit Sie Reparaturauftraege, Statusupdates und Dokumente bequem in Ihrem Kundenkonto verwalten koennen.',
        highlights: [
          { label: 'Kundenkonto', value: 'Schneller Zugriff auf Ihre Auftraege, Rechnungen und Service-Historie.' },
          { label: 'Sicherheit', value: 'Die Aktivierung schuetzt Ihr Konto und ermoeglicht sichere Benachrichtigungen.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Kunde', value: '{{customerName}}' },
          { label: 'E-Mail-Adresse', value: '{{customerEmail}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Nach der Aktivierung koennen Sie Reparaturen beauftragen, den aktuellen Bearbeitungsstatus verfolgen und mit unserem Service-Team kommunizieren.</p><p style="margin:0;">Sollten Sie sich nicht registriert haben, koennen Sie diese Nachricht ignorieren.</p>',
        ctaLabel: 'Konto aktivieren',
        ctaUrl: '{{verificationUrl}}',
        closing: 'Wir freuen uns darauf, Sie bei Ihren Reparaturen schnell, transparent und professionell zu begleiten.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde automatisch fuer Ihr Kundenkonto erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('customerEmail', 'E-Mail-Adresse des Kunden', true),
        createVariable('verificationUrl', 'Link zur Kontoaktivierung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Auftragsbestaetigung Reparatur',
      type: 'email',
      subject: 'Ihr Reparaturauftrag {{orderNumber}} ist bei {{companyName}} eingegangen',
      content: renderEmailTemplate({
        preheader: 'Ihr Reparaturauftrag wurde erfolgreich angelegt.',
        eyebrow: 'Auftrag & Bearbeitung',
        title: 'Ihr Auftrag ist bei uns eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihren Reparaturauftrag erfolgreich aufgenommen und die Bearbeitung vorbereitet. Vielen Dank fuer Ihr Vertrauen in {{companyName}}.',
        highlights: [
          { label: 'Naechster Schritt', value: 'Unser Technik-Team prueft den Auftrag und informiert Sie ueber jeden wichtigen Fortschritt.' },
          { label: 'Transparenz', value: 'Sie koennen alle Schritte jederzeit online nachvollziehen.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Leistung', value: '{{serviceName}}' },
          { label: 'Voraussichtliche Fertigstellung', value: '{{estimatedCompletion}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte pruefen Sie bei Gelegenheit Ihre hinterlegten Daten. Wenn Sie Rueckfragen zum Fehlerbild oder zum Versand haben, antworten Sie einfach auf diese E-Mail.</p><p style="margin:0;">Sobald sich der Status aendert, informieren wir Sie automatisch.</p>',
        ctaLabel: 'Auftrag online verfolgen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Vielen Dank fuer Ihren Auftrag. Wir halten Sie waehrend des gesamten Reparaturprozesses aktiv auf dem Laufenden.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Auftragsbestaetigung bezieht sich auf Ihren aktuellen Reparaturauftrag.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('serviceName', 'Gebuchte Reparaturleistung', true),
        createVariable('estimatedCompletion', 'Geschaetztes Fertigstellungsdatum'),
        createVariable('trackingUrl', 'Link zur Auftragsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Statusupdate Auftrag oder Buchung',
      type: 'email',
      subject: 'Statusupdate zu Ihrem Auftrag {{orderNumber}}: {{orderStatus}}',
      content: renderEmailTemplate({
        preheader: 'Es gibt ein neues Statusupdate zu Ihrem Auftrag.',
        eyebrow: 'Live-Status',
        title: 'Ihr Auftrag hat einen neuen Status',
        intro: 'Hallo {{customerName}}, der Status Ihres Vorgangs wurde aktualisiert. Damit Sie immer informiert bleiben, finden Sie unten die wichtigsten Details auf einen Blick.',
        highlights: [
          { label: 'Neuer Status', value: '{{orderStatus}}' },
          { label: 'Naechster Hinweis', value: '{{statusMessage}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Buchungsstatus', value: '{{bookingStatus}}' },
          { label: 'Reparaturstatus', value: '{{orderStatus}}' },
          { label: 'Aktualisiert am', value: '{{statusUpdatedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Sollten wir noch Informationen von Ihnen benoetigen, melden wir uns separat. In Ihrem Kundenbereich sehen Sie jederzeit den aktuellen Bearbeitungsstand.</p><p style="margin:0;">Wenn Sie Fragen zu diesem Update haben, steht Ihnen unser Service-Team gerne zur Verfuegung.</p>',
        ctaLabel: 'Status im Kundenkonto ansehen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir begleiten Ihren Auftrag transparent und informieren Sie bei jedem wichtigen Meilenstein.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung wurde automatisch durch eine Statusaenderung ausgeloest.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('bookingStatus', 'Status der Buchung'),
        createVariable('orderStatus', 'Status des Reparaturauftrags', true),
        createVariable('statusMessage', 'Zusaetzlicher Hinweis zum Status'),
        createVariable('statusUpdatedAt', 'Zeitpunkt der Statusaenderung'),
        createVariable('trackingUrl', 'Link zur Auftragsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Geraet eingegangen',
      type: 'email',
      subject: 'Ihr Geraet ist bei {{companyName}} eingetroffen',
      content: renderEmailTemplate({
        preheader: 'Wir haben Ihr Geraet erhalten und zur Pruefung uebernommen.',
        eyebrow: 'Wareneingang',
        title: 'Ihr Geraet ist sicher bei uns angekommen',
        intro: 'Hallo {{customerName}}, wir bestaetigen den Eingang Ihres Geraets. Unser Team prueft den Zustand nun im Detail und bereitet die weitere Bearbeitung vor.',
        highlights: [
          { label: 'Eingang bestaetigt', value: 'Ihr Paket wurde erfasst und intern zugeordnet.' },
          { label: 'Naechster Schritt', value: 'Diagnose, Sichtpruefung und weitere Statusmeldung.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Eingangsdatum', value: '{{receivedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Nach der Erstpruefung informieren wir Sie, sobald die Reparatur startet oder wenn Rueckfragen zum Geraet bestehen.</p><p style="margin:0;">Bitte bewahren Sie Ihre Auftragsnummer fuer eventuelle Rueckfragen auf.</p>',
        ctaLabel: 'Auftragsdetails aufrufen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Vielen Dank fuer Ihr Vertrauen. Ihr Geraet befindet sich nun in professioneller Bearbeitung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den physischen Eingang Ihres Geraets.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('receivedAt', 'Datum des Wareneingangs'),
        createVariable('trackingUrl', 'Link zur Auftragsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Kostenvoranschlag zur Freigabe',
      type: 'email',
      subject: 'Bitte pruefen Sie Ihren Kostenvoranschlag zu Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Ihr Kostenvoranschlag ist verfuegbar und wartet auf Ihre Freigabe.',
        eyebrow: 'Freigabe erforderlich',
        title: 'Ihr Kostenvoranschlag ist verfuegbar',
        intro: 'Hallo {{customerName}}, fuer Ihren Auftrag liegt nun ein Kostenvoranschlag vor. Bitte pruefen Sie die vorgeschlagene Reparatur und geben Sie die Bearbeitung bei Bedarf frei.',
        highlights: [
          { label: 'Gesamtbetrag', value: '{{quoteAmount}}' },
          { label: 'Antwort benoetigt', value: 'Mit Ihrer Freigabe kann die Reparatur direkt fortgesetzt werden.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Empfohlene Leistung', value: '{{serviceName}}' },
          { label: 'Freigabe bis', value: '{{approvalDeadline}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Im Kundenkonto finden Sie alle Informationen zum Umfang der Reparatur. Dort koennen Sie den Kostenvoranschlag freigeben oder bei Bedarf Rueckfragen stellen.</p><p style="margin:0;">Ohne Freigabe koennen wir die Reparatur nicht fortsetzen.</p>',
        ctaLabel: 'Kostenvoranschlag pruefen',
        ctaUrl: '{{approvalUrl}}',
        closing: 'Sobald Ihre Freigabe vorliegt, setzen wir den Auftrag ohne unnoetige Verzoegerung fort.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde erstellt, weil fuer Ihren Auftrag eine Entscheidung erforderlich ist.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('serviceName', 'Empfohlene Reparaturleistung'),
        createVariable('quoteAmount', 'Betrag des Kostenvoranschlags', true),
        createVariable('approvalDeadline', 'Frist fuer die Freigabe'),
        createVariable('approvalUrl', 'Link zur Freigabeseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Reparatur abgeschlossen und Rueckversand',
      type: 'email',
      subject: 'Gute Nachrichten: Ihr Auftrag {{orderNumber}} ist abgeschlossen',
      content: renderEmailTemplate({
        preheader: 'Ihre Reparatur ist abgeschlossen und der Rueckversand wurde vorbereitet.',
        eyebrow: 'Abschluss & Versand',
        title: 'Ihre Reparatur ist abgeschlossen',
        intro: 'Hallo {{customerName}}, Ihr Geraet wurde erfolgreich bearbeitet. Je nach Ablauf steht es nun zur Abholung bereit oder befindet sich bereits im Rueckversand.',
        highlights: [
          { label: 'Reparaturstatus', value: 'Abgeschlossen' },
          { label: 'Versandstatus', value: '{{returnShipmentStatus}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Ruecksendungsnummer', value: '{{returnTrackingNumber}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls Ihr Geraet versendet wurde, koennen Sie den Versandstatus online verfolgen. Sollte eine Abholung vorgesehen sein, teilen wir Ihnen die relevanten Informationen direkt mit.</p><p style="margin:0;">Bitte pruefen Sie nach Erhalt kurz die Funktion und melden Sie sich bei Unklarheiten jederzeit bei uns.</p>',
        ctaLabel: 'Versand verfolgen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir freuen uns, Ihren Auftrag erfolgreich abgeschlossen zu haben, und bedanken uns fuer Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie ueber den erfolgreichen Abschluss Ihrer Reparatur.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('returnShipmentStatus', 'Status des Rueckversands'),
        createVariable('returnTrackingNumber', 'Sendungsnummer fuer den Rueckversand'),
        createVariable('trackingUrl', 'Link zur Sendungsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Zahlung bestaetigt',
      type: 'email',
      subject: 'Zahlung zu Auftrag {{orderNumber}} erfolgreich eingegangen',
      content: renderEmailTemplate({
        preheader: 'Wir bestaetigen den Eingang Ihrer Zahlung.',
        eyebrow: 'Zahlung & Dokumente',
        title: 'Vielen Dank fuer Ihre Zahlung',
        intro: 'Hallo {{customerName}}, wir haben Ihre Zahlung erfolgreich verbucht. Die wichtigsten Informationen zu Ihrem Zahlungsvorgang finden Sie nachfolgend.',
        highlights: [
          { label: 'Betrag', value: '{{amountPaid}}' },
          { label: 'Zahlungsart', value: '{{paymentMethod}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Zahlung eingegangen am', value: '{{paidAt}}' },
          { label: 'Rechnungsnummer', value: '{{invoiceNumber}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Ihre Zahlung wurde Ihrem Auftrag eindeutig zugeordnet. Falls bereits ein Rechnungsdokument verfuegbar ist, koennen Sie es ueber den untenstehenden Link aufrufen.</p><p style="margin:0;">Bei Rueckfragen zur Abrechnung hilft Ihnen unser Team gerne weiter.</p>',
        ctaLabel: 'Rechnung ansehen',
        ctaUrl: '{{invoiceUrl}}',
        closing: 'Vielen Dank fuer die schnelle Zahlung. Damit ist Ihr Auftrag auch kaufmaennisch sauber abgeschlossen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den erfolgreichen Zahlungseingang fuer Ihren Auftrag.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('amountPaid', 'Gebuchter Zahlbetrag', true),
        createVariable('paymentMethod', 'Verwendete Zahlungsart'),
        createVariable('paidAt', 'Zeitpunkt des Zahlungseingangs'),
        createVariable('invoiceNumber', 'Rechnungsnummer'),
        createVariable('invoiceUrl', 'Link zur Rechnung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Passwort zuruecksetzen',
      type: 'email',
      subject: 'Passwort fuer Ihr {{companyName}} Konto zuruecksetzen',
      content: renderEmailTemplate({
        preheader: 'Setzen Sie Ihr Passwort sicher ueber den zugesandten Link zurueck.',
        eyebrow: 'Sicherheit',
        title: 'Passwort sicher zuruecksetzen',
        intro: 'Hallo {{customerName}}, fuer Ihr Kundenkonto wurde eine Anfrage zum Zuruecksetzen des Passworts gestellt. Ueber den folgenden Link koennen Sie ein neues Passwort vergeben.',
        highlights: [
          { label: 'Wichtig', value: 'Der Link ist nur fuer einen begrenzten Zeitraum gueltig.' },
          { label: 'Sicherheitshinweis', value: 'Wenn Sie diese Anfrage nicht selbst gestellt haben, ignorieren Sie die E-Mail bitte.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Kunde', value: '{{customerName}}' },
          { label: 'E-Mail-Adresse', value: '{{customerEmail}}' },
          { label: 'Gueltig bis', value: '{{resetExpiresAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Aus Sicherheitsgruenden empfehlen wir ein starkes Passwort mit ausreichend Zeichen, Gross- und Kleinbuchstaben sowie Zahlen.</p><p style="margin:0;">Falls Sie Hilfe benoetigen, steht unser Support-Team gerne fuer Sie bereit.</p>',
        ctaLabel: 'Neues Passwort vergeben',
        ctaUrl: '{{passwordResetUrl}}',
        closing: 'Die Sicherheit Ihres Kundenkontos hat fuer uns hohe Prioritaet.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Sicherheitsnachricht wurde aufgrund einer Passwort-Reset-Anfrage erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('customerEmail', 'E-Mail-Adresse des Kunden', true),
        createVariable('passwordResetUrl', 'Link zum Zuruecksetzen des Passworts', true),
        createVariable('resetExpiresAt', 'Ablaufzeit des Reset-Links'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },

    // ===== BUCHUNGSAUFTRAG TEMPLATES =====
    {
      name: 'Buchung angelegt',
      type: 'email',
      subject: 'Ihre Buchung {{bookingNumber}} wurde erfolgreich angelegt – {{companyName}}',
      content: renderEmailTemplate({
        preheader: 'Ihre Buchung ist eingegangen und wird bearbeitet.',
        eyebrow: 'Buchungsbestaetigung',
        title: 'Ihre Buchung ist erfolgreich eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Buchung erfolgreich aufgenommen. Unser Team wird den Vorgang pruefen und Sie ueber den naechsten Schritt informieren.',
        highlights: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Buchungsdatum', value: '{{bookingDate}}' },
          { label: 'Enthaltene Auftraege', value: '{{itemSummary}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}' },
          { label: 'Status', value: '{{bookingStatus}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">In Ihrer Buchung sind alle zugeordneten Reparaturauftraege und Leistungen zusammengefasst. Sie koennen den aktuellen Buchungsstatus jederzeit in Ihrem Kundenkonto einsehen.</p><p style="margin:0;">Bei Rueckfragen zu Ihrer Buchung steht Ihnen unser Support-Team gerne zur Verfuegung.</p>',
        ctaLabel: 'Buchung online einsehen',
        ctaUrl: '{{bookingUrl}}',
        closing: 'Vielen Dank fuer Ihr Vertrauen. Wir halten Sie waehrend des gesamten Prozesses auf dem Laufenden.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Buchungsbestaetigung bezieht sich auf Ihre aktuell angelegte Buchung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingDate', 'Datum der Buchungserstellung'),
        createVariable('itemSummary', 'Kurzuebersicht der enthaltenen Auftraege'),
        createVariable('totalAmount', 'Gesamtbetrag der Buchung'),
        createVariable('bookingStatus', 'Aktueller Buchungsstatus'),
        createVariable('bookingUrl', 'Link zur Buchungsdetailseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Buchung Statusupdate',
      type: 'email',
      subject: 'Statusupdate zu Ihrer Buchung {{bookingNumber}}: {{bookingStatus}}',
      content: renderEmailTemplate({
        preheader: 'Der Status Ihrer Buchung wurde aktualisiert.',
        eyebrow: 'Buchungsstatus',
        title: 'Status Ihrer Buchung wurde aktualisiert',
        intro: 'Hallo {{customerName}}, der Status Ihrer Buchung hat sich geaendert. Nachfolgend finden Sie alle relevanten Informationen auf einen Blick.',
        highlights: [
          { label: 'Neuer Status', value: '{{bookingStatus}}' },
          { label: 'Hinweis', value: '{{statusNote}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Enthaltene Auftraege', value: '{{itemSummary}}' },
          { label: 'Gesamtfortschritt', value: '{{progressPercent}}%' },
          { label: 'Aktualisiert am', value: '{{updatedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte melden Sie sich in Ihrem Kundenkonto an, um alle Details zu Ihrer Buchung, den einzelnen Auftraegen und den jeweiligen Fortschritten einzusehen.</p><p style="margin:0;">Unser Team begleitet Ihren Vorgang und informiert Sie bei jedem weiteren Meilenstein automatisch.</p>',
        ctaLabel: 'Buchungsstatus einsehen',
        ctaUrl: '{{bookingUrl}}',
        closing: 'Wir danken Ihnen fuer Ihr Vertrauen und begleiten Ihre Buchung transparent bis zum Abschluss.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung wurde automatisch durch eine Statusaenderung Ihrer Buchung ausgeloest.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingStatus', 'Neuer Buchungsstatus', true),
        createVariable('statusNote', 'Zusaetzlicher Hinweis zum Status'),
        createVariable('itemSummary', 'Kurzuebersicht der enthaltenen Auftraege'),
        createVariable('progressPercent', 'Gesamtfortschritt in Prozent'),
        createVariable('updatedAt', 'Zeitpunkt der Statusaenderung'),
        createVariable('bookingUrl', 'Link zur Buchungsdetailseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Buchung bereit zur Abholung',
      type: 'email',
      subject: 'Ihre Buchung {{bookingNumber}} steht zur Abholung bereit',
      content: renderEmailTemplate({
        preheader: 'Ihr Auftrag ist fertig und wartet auf Ihre Abholung.',
        eyebrow: 'Abholung',
        title: 'Ihr Auftrag ist bereit zur Abholung',
        intro: 'Hallo {{customerName}}, alle Arbeiten zu Ihrer Buchung wurden erfolgreich abgeschlossen. Ihr Geraet steht nun bei uns zur Abholung bereit.',
        highlights: [
          { label: 'Abholtage', value: '{{pickupHours}}' },
          { label: 'Standort', value: '{{workshopAddress}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Abholbereit seit', value: '{{readySince}}' },
          { label: 'Aufbewahrung bis', value: '{{holdUntil}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte bringen Sie bei der Abholung Ihren Abholcode oder die Auftragsnummer mit. Falls Sie das Geraet nicht persoenlich abholen koennen, kontaktieren Sie uns bitte rechtzeitig.</p><p style="margin:0;">Nach Ablauf des Aufbewahrungszeitraums behalten wir uns vor, eine Lagergebuehr zu erheben.</p>',
        ctaLabel: 'Abholdetails ansehen',
        ctaUrl: '{{bookingUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch und bedanken uns herzlich fuer Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Ihr Geraet wurde sorgfaeltig vorbereitet und wartet auf Sie.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke'),
        createVariable('deviceModel', 'Geraetemodell'),
        createVariable('pickupHours', 'Oeffnungszeiten fuer die Abholung'),
        createVariable('workshopAddress', 'Adresse der Werkstatt / Filiale'),
        createVariable('readySince', 'Zeitpunkt der Fertigstellung'),
        createVariable('holdUntil', 'Aufbewahrungsfrist'),
        createVariable('bookingUrl', 'Link zur Buchungsdetailseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Buchung storniert',
      type: 'email',
      subject: 'Ihre Buchung {{bookingNumber}} wurde storniert',
      content: renderEmailTemplate({
        preheader: 'Ihre Buchung wurde storniert. Wir informieren Sie ueber die naechsten Schritte.',
        eyebrow: 'Stornierung',
        title: 'Ihre Buchung wurde storniert',
        intro: 'Hallo {{customerName}}, Ihre Buchung wurde storniert. Wir bedauern dies und moechten Ihnen alle relevanten Informationen zur Stornierung mitteilen.',
        highlights: [
          { label: 'Stornogrund', value: '{{cancellationReason}}' },
          { label: 'Erstattung', value: '{{refundInfo}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Storniert am', value: '{{cancelledAt}}' },
          { label: 'Storniert von', value: '{{cancelledBy}}' },
          { label: 'Erstattungsbetrag', value: '{{refundAmount}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls Sie eine Erstattung erwarten, wird diese in der Regel innerhalb von 5-10 Werktagen bearbeitet. Bei spezifischen Fragen zur Stornierung stehen wir Ihnen gerne zur Verfuegung.</p><p style="margin:0;">Wenn Sie einen neuen Auftrag beauftragen moechten, koennen Sie dies jederzeit ueber unser Portal tun.</p>',
        ctaLabel: 'Neuen Auftrag anlegen',
        ctaUrl: '{{newBookingUrl}}',
        closing: 'Wir hoffen, Sie bald wieder als Kunden begrueßen zu duerfen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt die Stornierung Ihrer Buchung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('cancellationReason', 'Grund der Stornierung'),
        createVariable('refundInfo', 'Information zur Erstattung'),
        createVariable('refundAmount', 'Erstattungsbetrag'),
        createVariable('cancelledAt', 'Zeitpunkt der Stornierung'),
        createVariable('cancelledBy', 'Storniert von (Kunde / System / Mitarbeiter)'),
        createVariable('newBookingUrl', 'Link zur Neuanlage'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },

    // ===== REPAIR REQUEST TEMPLATES =====
    {
      name: 'Repair Request eingegangen',
      type: 'email',
      subject: 'Ihre Reparaturanfrage {{requestNumber}} ist bei uns eingegangen',
      content: renderEmailTemplate({
        preheader: 'Ihre Reparaturanfrage wurde erfolgreich uebermittelt.',
        eyebrow: 'Reparaturanfrage',
        title: 'Ihre Reparaturanfrage ist eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Reparaturanfrage erhalten und werden sie schnellstmoeglich pruefen. Wir melden uns mit einem Angebot oder weiteren Informationen.',
        highlights: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Fehlerbeschreibung', value: '{{issueDescription}}' },
          { label: 'Eingegangen am', value: '{{submittedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unser Techniker-Team prueft Ihre Anfrage und wird sich in Kuerze mit einem Angebot oder Rueckfragen bei Ihnen melden. In der Regel erhalten Sie eine Rueckmeldung innerhalb von 1–2 Werktagen.</p><p style="margin:0;">Ueber Ihren persoenlichen Bereich koennen Sie den aktuellen Status Ihrer Anfrage jederzeit einsehen.</p>',
        ctaLabel: 'Anfrage verfolgen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir freuen uns, Ihnen schnell und professionell helfen zu koennen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den Eingang Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('issueDescription', 'Beschreibung des Fehlerbildes'),
        createVariable('submittedAt', 'Zeitpunkt der Uebermittlung'),
        createVariable('requestUrl', 'Link zur Anfrageverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Repair Request in Bearbeitung',
      type: 'email',
      subject: 'Ihre Reparaturanfrage {{requestNumber}} wird jetzt bearbeitet',
      content: renderEmailTemplate({
        preheader: 'Unser Team hat die Bearbeitung Ihrer Reparaturanfrage aufgenommen.',
        eyebrow: 'In Bearbeitung',
        title: 'Ihre Anfrage wird bearbeitet',
        intro: 'Hallo {{customerName}}, wir moechten Sie informieren, dass Ihre Reparaturanfrage nun aktiv von unserem Team bearbeitet wird. Wir halten Sie weiterhin auf dem Laufenden.',
        highlights: [
          { label: 'Status', value: 'In Bearbeitung' },
          { label: 'Zustaendiger Techniker', value: '{{technicianName}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Bearbeitung gestartet', value: '{{processingStartedAt}}' },
          { label: 'Voraussichtliche Antwort', value: '{{estimatedResponseDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unser Techniker analysiert nun das von Ihnen geschilderte Problem und erarbeitet eine Loesungsempfehlung oder einen Kostenvoranschlag fuer Sie.</p><p style="margin:0;">Falls wir zusaetzliche Informationen von Ihnen benoetigen, werden wir uns direkt bei Ihnen melden.</p>',
        ctaLabel: 'Anfragestatus ansehen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir sind dabei, Ihnen die bestmoegliche Loesung bereitzustellen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung informiert Sie ueber den Bearbeitungsstart Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('technicianName', 'Name des zustaendigen Technikers'),
        createVariable('processingStartedAt', 'Zeitpunkt des Bearbeitungsbeginns'),
        createVariable('estimatedResponseDate', 'Voraussichtliches Antwortdatum'),
        createVariable('requestUrl', 'Link zur Anfrageverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Repair Request Diagnose abgeschlossen',
      type: 'email',
      subject: 'Diagnoseergebnis zu Ihrer Anfrage {{requestNumber}} liegt vor',
      content: renderEmailTemplate({
        preheader: 'Die Diagnose Ihres Geraetes ist abgeschlossen. Bitte pruefen Sie das Ergebnis.',
        eyebrow: 'Diagnoseergebnis',
        title: 'Diagnose Ihres Geraetes abgeschlossen',
        intro: 'Hallo {{customerName}}, die Diagnose Ihres Geraetes wurde abgeschlossen. Wir praesentieren Ihnen nachfolgend die Ergebnisse sowie unsere Empfehlung fuer die weitere Vorgehensweise.',
        highlights: [
          { label: 'Diagnoseergebnis', value: '{{diagnosisResult}}' },
          { label: 'Empfohlene Massnahme', value: '{{recommendedAction}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Fehlerdiagnose', value: '{{diagnosisResult}}' },
          { label: 'Angebotsbetrag', value: '{{offerAmount}}' },
          { label: 'Diagnose abgeschlossen am', value: '{{diagnosisDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte pruefen Sie das Diagnoseergebnis und das beigefuegte Angebot. Sie koennen die Reparatur direkt ueber Ihr Kundenkonto freigeben oder uns bei weiteren Fragen kontaktieren.</p><p style="margin:0;">Wir empfehlen, die Freigabe moeglichst zeitnah zu erteilen, damit wir sofort mit der Reparatur beginnen koennen.</p>',
        ctaLabel: 'Angebot pruefen und freigeben',
        ctaUrl: '{{approvalUrl}}',
        closing: 'Wir stehen Ihnen bei allen Fragen zur Diagnose und zum Angebot jederzeit zur Verfuegung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie ueber das Diagnoseergebnis Ihres Geraetes.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('diagnosisResult', 'Zusammenfassung der Diagnose', true),
        createVariable('recommendedAction', 'Handlungsempfehlung des Technikers'),
        createVariable('offerAmount', 'Angebotsbetrag fuer die Reparatur'),
        createVariable('diagnosisDate', 'Datum des Diagnoseabschlusses'),
        createVariable('approvalUrl', 'Link zur Freigabe / Angebotseinsicht', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Repair Request neue Nachricht',
      type: 'email',
      subject: 'Neue Nachricht zu Ihrer Reparaturanfrage {{requestNumber}}',
      content: renderEmailTemplate({
        preheader: 'Es gibt eine neue Nachricht zu Ihrer Reparaturanfrage.',
        eyebrow: 'Neue Mitteilung',
        title: 'Neue Mitteilung zu Ihrer Anfrage',
        intro: 'Hallo {{customerName}}, es gibt eine neue Nachricht zu Ihrer Reparaturanfrage. Bitte melden Sie sich in Ihrem Kundenkonto an, um die vollstaendige Nachricht zu lesen und zu antworten.',
        highlights: [
          { label: 'Absender', value: '{{senderName}}' },
          { label: 'Anfragenummer', value: '{{requestNumber}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Nachricht von', value: '{{senderName}}' },
          { label: 'Gesendet am', value: '{{messageSentAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte lesen Sie die Nachricht in Ihrem Kundenkonto und antworten Sie bei Bedarf direkt dort. Auf diese Weise bleiben alle Kommunikationen lueckenlos dokumentiert.</p><p style="margin:0;">Damit wir Ihren Auftrag reibungslos bearbeiten koennen, bitten wir um eine zeitnahe Rueckmeldung.</p>',
        ctaLabel: 'Nachricht lesen und antworten',
        ctaUrl: '{{requestUrl}}',
        closing: 'Vielen Dank fuer Ihre Zusammenarbeit. Wir stehen fuer alle Rueckfragen gerne bereit.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung gilt als Hinweis auf eine neue Kommunikation zu Ihrer Anfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetemarke'),
        createVariable('deviceModel', 'Geraetemodell'),
        createVariable('senderName', 'Name des Absenders'),
        createVariable('messageSentAt', 'Zeitpunkt der Nachricht'),
        createVariable('requestUrl', 'Link zur Anfragekommunikation', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Repair Request abgeschlossen',
      type: 'email',
      subject: 'Ihre Reparaturanfrage {{requestNumber}} wurde erfolgreich abgeschlossen',
      content: renderEmailTemplate({
        preheader: 'Ihre Reparaturanfrage wurde abgeschlossen.',
        eyebrow: 'Anfrage abgeschlossen',
        title: 'Ihre Reparaturanfrage ist abgeschlossen',
        intro: 'Hallo {{customerName}}, wir moechten Sie informieren, dass Ihre Reparaturanfrage nun vollstaendig abgeschlossen wurde. Vielen Dank fuer Ihre Geduld und Ihr Vertrauen.',
        highlights: [
          { label: 'Ergebnis', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{completedAt}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Ergebnis', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{completedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls ein Folgeauftrag erstellt wurde, erhalten Sie hierzu separat eine Auftragsbestaetigung. Andernfalls ist der Vorgang mit diesem Schritt vollstaendig beendet.</p><p style="margin:0;">Wir wuerden uns ueber eine kurze Bewertung Ihrer Erfahrung sehr freuen – Ihr Feedback hilft uns, unsere Dienstleistungen kontinuierlich zu verbessern.</p>',
        ctaLabel: 'Anfrage abschliessend einsehen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir bedanken uns herzlich fuer Ihr Vertrauen und freuen uns, Ihnen geholfen zu haben.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den Abschluss Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetemarke'),
        createVariable('deviceModel', 'Geraetemodell'),
        createVariable('resolutionSummary', 'Zusammenfassung des Ergebnisses'),
        createVariable('completedAt', 'Zeitpunkt des Abschlusses'),
        createVariable('requestUrl', 'Link zur Anfrage', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },

    // ===== REKLAMATION / COMPLAINT TEMPLATES =====
    {
      name: 'Reklamation eingegangen',
      type: 'email',
      subject: 'Ihre Reklamation {{complaintNumber}} wurde erfolgreich aufgenommen',
      content: renderEmailTemplate({
        preheader: 'Ihre Reklamation ist bei uns eingegangen. Wir kuemmern uns darum.',
        eyebrow: 'Reklamation',
        title: 'Ihre Reklamation ist bei uns eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Reklamation erhalten und nehmen Ihr Anliegen sehr ernst. Unser Team wird den Vorgang umgehend pruefen und sich bei Ihnen melden.',
        highlights: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Prioritaet', value: '{{priority}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Kategorie', value: '{{complaintCategory}}' },
          { label: 'Betreff', value: '{{complaintSubject}}' },
          { label: 'Referenz-Auftrag', value: '{{orderNumber}}' },
          { label: 'Eingegangen am', value: '{{submittedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Wir bedauern, dass Sie Grund zur Beanstandung hatten, und werden alles daran setzen, Ihr Anliegen schnell und fair zu klaeren. In der Regel erhalten Sie innerhalb von 2–3 Werktagen eine erste Rueckmeldung.</p><p style="margin:0;">Falls Sie weitere Unterlagen oder Informationen bereitstellen moechten, koennen Sie diese jederzeit ueber Ihr Kundenkonto hinzufuegen.</p>',
        ctaLabel: 'Reklamation einsehen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir nehmen Ihr Feedback ernst und arbeiten daran, Ihnen eine zufriedenstellende Loesung zu bieten.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den Eingang Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintCategory', 'Kategorie der Reklamation'),
        createVariable('complaintSubject', 'Betreff der Reklamation'),
        createVariable('orderNumber', 'Referenzierter Auftrag'),
        createVariable('priority', 'Prioritaet der Bearbeitung'),
        createVariable('submittedAt', 'Zeitpunkt des Eingangs'),
        createVariable('complaintUrl', 'Link zur Reklamationsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Reklamation in Bearbeitung',
      type: 'email',
      subject: 'Ihre Reklamation {{complaintNumber}} wird bearbeitet',
      content: renderEmailTemplate({
        preheader: 'Wir haben mit der Bearbeitung Ihrer Reklamation begonnen.',
        eyebrow: 'Reklamation in Bearbeitung',
        title: 'Bearbeitung Ihrer Reklamation gestartet',
        intro: 'Hallo {{customerName}}, wir moechten Ihnen mitteilen, dass wir mit der Bearbeitung Ihrer Reklamation begonnen haben. Unser Team prueft Ihren Fall mit hoechster Sorgfalt.',
        highlights: [
          { label: 'Status', value: 'In Bearbeitung' },
          { label: 'Zustaendig', value: '{{handlerName}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Bearbeitung gestartet', value: '{{processingStartedAt}}' },
          { label: 'Voraussichtliche Bearbeitung bis', value: '{{estimatedResolutionDate}}' },
          { label: 'Zustaendiger Mitarbeiter', value: '{{handlerName}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Waehrend der Pruefungsphase koennen weitere Informationen oder Unterlagen angefordert werden. Bitte halten Sie Ihre Auftragsdaten und relevante Belege griffbereit.</p><p style="margin:0;">Sobald eine Entscheidung oder ein Zwischenergebnis vorliegt, werden Sie automatisch benachrichtigt.</p>',
        ctaLabel: 'Reklamationsstatus verfolgen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir setzen alles daran, Ihr Anliegen fair und schnell zu loesen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung informiert Sie ueber den Bearbeitungsstart Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('handlerName', 'Name des zustaendigen Mitarbeiters'),
        createVariable('processingStartedAt', 'Zeitpunkt des Bearbeitungsbeginns'),
        createVariable('estimatedResolutionDate', 'Voraussichtliches Abschlussdatum'),
        createVariable('complaintUrl', 'Link zur Reklamationsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Reklamation neue Nachricht',
      type: 'email',
      subject: 'Neue Mitteilung zu Ihrer Reklamation {{complaintNumber}}',
      content: renderEmailTemplate({
        preheader: 'Es gibt eine neue Mitteilung zu Ihrer Reklamation.',
        eyebrow: 'Mitteilung',
        title: 'Neue Mitteilung zu Ihrer Reklamation',
        intro: 'Hallo {{customerName}}, zu Ihrer Reklamation gibt es eine neue Nachricht von unserem Team. Bitte melden Sie sich an, um die vollstaendige Mitteilung zu lesen.',
        highlights: [
          { label: 'Von', value: '{{senderName}}' },
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Nachricht von', value: '{{senderName}}' },
          { label: 'Gesendet am', value: '{{messageSentAt}}' },
          { label: 'Aktueller Status', value: '{{complaintStatus}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte lesen Sie die Mitteilung und antworten Sie gegebenenfalls ueber Ihr Kundenkonto. Eine zeitnahe Reaktion hilft uns, Ihr Anliegen zügig abzuschließen.</p><p style="margin:0;">Sollte die Mitteilung eine Entscheidung oder Genehmigung Ihrerseits erfordern, bitten wir um Ihre Rueckmeldung innerhalb der angegebenen Frist.</p>',
        ctaLabel: 'Mitteilung lesen und antworten',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir danken Ihnen fuer Ihre Mitarbeit und freuen uns auf eine schnelle Klaerung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung ist ein Hinweis auf eine neue Kommunikation zu Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('senderName', 'Name des Absenders'),
        createVariable('messageSentAt', 'Zeitpunkt der Nachricht'),
        createVariable('complaintStatus', 'Aktueller Status der Reklamation'),
        createVariable('complaintUrl', 'Link zur Reklamationsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Reklamation geloest',
      type: 'email',
      subject: 'Ihre Reklamation {{complaintNumber}} wurde geloest',
      content: renderEmailTemplate({
        preheader: 'Ihre Reklamation wurde erfolgreich abgeschlossen.',
        eyebrow: 'Reklamation geloest',
        title: 'Ihre Reklamation wurde erfolgreich geloest',
        intro: 'Hallo {{customerName}}, wir freuen uns, Ihnen mitteilen zu koennen, dass Ihre Reklamation abgeschlossen und eine Loesung erarbeitet wurde. Wir hoffen, dass das Ergebnis Ihren Erwartungen entspricht.',
        highlights: [
          { label: 'Loesung', value: '{{resolutionSummary}}' },
          { label: 'Kompensation', value: '{{compensationInfo}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Loesung', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{resolvedAt}}' },
          { label: 'Kompensation / Erstattung', value: '{{compensationInfo}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Sollte die vereinbarte Loesung eine finanzielle Kompensation oder Erstattung beinhalten, wird diese in Kuerze bearbeitet. Bitte pruefen Sie Ihre Daten im Kundenkonto auf Vollstaendigkeit.</p><p style="margin:0;">Falls Sie mit der Loesung nicht einverstanden sein sollten, kontaktieren Sie uns bitte innerhalb von 14 Tagen. Wir helfen Ihnen gerne weiter.</p>',
        ctaLabel: 'Abschluss bestaetigen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir bedanken uns fuer Ihr Vertrauen und hoffen, Sie bald als zufriedenen Kunden zu begrueßen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestaetigt den Abschluss Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('resolutionSummary', 'Zusammenfassung der erarbeiteten Loesung', true),
        createVariable('compensationInfo', 'Information zu Kompensation oder Erstattung'),
        createVariable('resolvedAt', 'Zeitpunkt des Abschlusses'),
        createVariable('complaintUrl', 'Link zur Reklamationsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Reklamation abgelehnt',
      type: 'email',
      subject: 'Entscheidung zu Ihrer Reklamation {{complaintNumber}}',
      content: renderEmailTemplate({
        preheader: 'Wir informieren Sie ueber die Entscheidung zu Ihrer Reklamation.',
        eyebrow: 'Reklamationsergebnis',
        title: 'Ergebnis zu Ihrer Reklamation liegt vor',
        intro: 'Hallo {{customerName}}, nach eingehender Pruefung Ihrer Reklamation moechten wir Ihnen das Ergebnis unserer Bewertung mitteilen.',
        highlights: [
          { label: 'Entscheidung', value: '{{decision}}' },
          { label: 'Begruendung', value: '{{decisionReason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Kategorie', value: '{{complaintCategory}}' },
          { label: 'Entscheidung', value: '{{decision}}' },
          { label: 'Entschieden am', value: '{{decidedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unsere Entscheidung basiert auf einer sorgfaeltigen Pruefung aller Informationen und angefuehrten Unterlagen. Bitte lesen Sie die detaillierte Begruendung in Ihrem Kundenkonto.</p><p style="margin:0;">Falls Sie Fragen zur Entscheidung haben oder einen Widerspruch einlegen moechten, koennen Sie sich innerhalb von 14 Tagen an unseren Support wenden.</p>',
        ctaLabel: 'Entscheidung einsehen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir stehen fuer weitere Fragen selbstverstaendlich gerne zur Verfuegung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht stellt die offizielle Entscheidung zu Ihrer Reklamation dar.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintCategory', 'Kategorie der Reklamation'),
        createVariable('decision', 'Entscheidung (z.B. Abgelehnt / Teilweise anerkannt)', true),
        createVariable('decisionReason', 'Begruendung der Entscheidung'),
        createVariable('decidedAt', 'Zeitpunkt der Entscheidung'),
        createVariable('complaintUrl', 'Link zur Reklamationsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },

    // ===== ALLGEMEINE BENACHRICHTIGUNGEN =====
    {
      name: 'Terminerinnerung',
      type: 'email',
      subject: 'Erinnerung: Ihr Termin bei {{companyName}} am {{appointmentDate}}',
      content: renderEmailTemplate({
        preheader: 'Erinnerung an Ihren bevorstehenden Termin.',
        eyebrow: 'Terminerinnerung',
        title: 'Ihr Termin steht bald an',
        intro: 'Hallo {{customerName}}, wir erinnern Sie an Ihren bevorstehenden Termin bei {{companyName}}. Bitte halten Sie alle relevanten Unterlagen und Ihr Geraet bereit.',
        highlights: [
          { label: 'Termin am', value: '{{appointmentDate}}' },
          { label: 'Uhrzeit', value: '{{appointmentTime}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Datum', value: '{{appointmentDate}}' },
          { label: 'Uhrzeit', value: '{{appointmentTime}}' },
          { label: 'Ort / Filiale', value: '{{workshopAddress}}' },
          { label: 'Terminart', value: '{{appointmentType}}' },
          { label: 'Referenz-Auftrag', value: '{{orderNumber}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte erscheinen Sie puenktlich zu Ihrem Termin. Falls Sie den Termin nicht einhalten koennen, bitten wir Sie, uns fruehzeitig zu informieren, damit wir den Termin umplanen koennen.</p><p style="margin:0;">Halten Sie bitte Ihren Auftrag oder Ihre Buchungsnummer sowie ein Ausweisdokument bereit.</p>',
        ctaLabel: 'Termindetails einsehen',
        ctaUrl: '{{appointmentUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Erinnerung wurde automatisch fuer Ihren bevorstehenden Termin erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('appointmentDate', 'Datum des Termins', true),
        createVariable('appointmentTime', 'Uhrzeit des Termins', true),
        createVariable('appointmentType', 'Art des Termins (z.B. Abgabe, Abholung, Beratung)'),
        createVariable('workshopAddress', 'Adresse der Werkstatt / Filiale'),
        createVariable('orderNumber', 'Referenzierter Auftrag'),
        createVariable('appointmentUrl', 'Link zu den Termindetails'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Garantieerinnerung',
      type: 'email',
      subject: 'Ihre Geraetegarantie bei {{companyName}} laeuft bald ab',
      content: renderEmailTemplate({
        preheader: 'Ihre Garantie fuer dieses Geraet laeuft in Kuerze ab.',
        eyebrow: 'Garantiehinweis',
        title: 'Ihre Geraetegarantie laeuft demnachst ab',
        intro: 'Hallo {{customerName}}, wir moechten Sie darauf hinweisen, dass die Garantie fuer Ihr Geraet in Kuerze auslaeuft. Nutzen Sie die verbleibende Zeit, um eventuelle Ansprueche geltend zu machen.',
        highlights: [
          { label: 'Garantie laeuft ab am', value: '{{warrantyExpiryDate}}' },
          { label: 'Restgarantie', value: '{{remainingWarrantyDays}} Tage', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Garantiebeginn', value: '{{warrantyStartDate}}' },
          { label: 'Garantieende', value: '{{warrantyExpiryDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls Sie an Ihrem Geraet einen Defekt oder eine Fehlfunktion feststellen, empfehlen wir Ihnen, dies noch vor Ablauf der Garantiefrist bei uns zu melden.</p><p style="margin:0;">Auch nach Ablauf der Garantie stehen wir Ihnen selbstverstaendlich mit unseren Reparaturleistungen zur Verfuegung.</p>',
        ctaLabel: 'Garantieanspruch pruefen',
        ctaUrl: '{{warrantyUrl}}',
        closing: 'Wir kuemmern uns auch weiterhin professionell um Ihre Geraete.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht ist eine automatische Garantieerinnerung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('deviceBrand', 'Geraetemarke', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('orderNumber', 'Referenzierter Auftrag'),
        createVariable('warrantyStartDate', 'Garantiebeginn'),
        createVariable('warrantyExpiryDate', 'Garantieablaufdatum', true),
        createVariable('remainingWarrantyDays', 'Verbleibende Garantietage'),
        createVariable('warrantyUrl', 'Link zu den Garantiedetails'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Neue Rechnung verfuegbar',
      type: 'email',
      subject: 'Ihre Rechnung {{invoiceNumber}} von {{companyName}} steht bereit',
      content: renderEmailTemplate({
        preheader: 'Eine neue Rechnung fuer Ihren Auftrag wurde erstellt.',
        eyebrow: 'Rechnungsdokument',
        title: 'Ihre Rechnung ist verfuegbar',
        intro: 'Hallo {{customerName}}, fuer Ihren Auftrag wurde eine Rechnung erstellt. Sie koennen das Dokument ueber den untenstehenden Link abrufen und herunterladen.',
        highlights: [
          { label: 'Rechnungsbetrag', value: '{{invoiceAmount}}' },
          { label: 'Faellig bis', value: '{{dueDate}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Rechnungsnummer', value: '{{invoiceNumber}}' },
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Rechnungsbetrag', value: '{{invoiceAmount}}' },
          { label: 'Zahlungsziel', value: '{{dueDate}}' },
          { label: 'Zahlungsart', value: '{{paymentMethod}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte begleichen Sie den ausstehenden Betrag bis zum angegebenen Zahlungsziel. Fuer Fragen zur Rechnung steht Ihnen unser Team gerne zur Verfuegung.</p><p style="margin:0;">Nach vollstaendigem Zahlungseingang erhalten Sie eine separate Zahlungsbestaetigung.</p>',
        ctaLabel: 'Rechnung herunterladen',
        ctaUrl: '{{invoiceUrl}}',
        closing: 'Vielen Dank fuer Ihr Vertrauen in {{companyName}}.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie ueber eine neu ausgestellte Rechnung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('invoiceNumber', 'Rechnungsnummer', true),
        createVariable('orderNumber', 'Referenzierter Auftrag'),
        createVariable('invoiceAmount', 'Rechnungsbetrag', true),
        createVariable('dueDate', 'Zahlungsziel / Faelligkeitsdatum', true),
        createVariable('paymentMethod', 'Zahlungsart'),
        createVariable('invoiceUrl', 'Link zum Rechnungsdokument', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Allgemeine Systemnachricht',
      type: 'email',
      subject: '{{notificationTitle}} – {{companyName}}',
      content: renderEmailTemplate({
        preheader: '{{notificationPreview}}',
        eyebrow: 'Information',
        title: '{{notificationTitle}}',
        intro: 'Hallo {{customerName}}, wir moechten Ihnen eine wichtige Information mitteilen.',
        highlights: [
          { label: 'Betrifft', value: '{{notificationTopic}}' },
          { label: 'Gueltig ab', value: '{{effectiveDate}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Betrifft', value: '{{notificationTopic}}' },
          { label: 'Datum', value: '{{notificationDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">{{notificationBody}}</p>',
        ctaLabel: '{{ctaLabel}}',
        ctaUrl: '{{ctaUrl}}',
        closing: 'Bei Rueckfragen stehen wir Ihnen jederzeit gerne zur Verfuegung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde automatisch durch unser System versendet.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('notificationTitle', 'Titel der Benachrichtigung', true),
        createVariable('notificationPreview', 'Vorschautext der Benachrichtigung'),
        createVariable('notificationTopic', 'Thema der Benachrichtigung'),
        createVariable('notificationBody', 'Hauptinhalt der Benachrichtigung', true),
        createVariable('notificationDate', 'Datum der Benachrichtigung'),
        createVariable('effectiveDate', 'Datum des Inkrafttretens'),
        createVariable('ctaLabel', 'Beschriftung des Handlungs-Buttons'),
        createVariable('ctaUrl', 'Link des Handlungs-Buttons'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Abholung bereit Erinnerung',
      type: 'email',
      subject: 'Bitte holen Sie Ihr Geraet bei {{companyName}} ab – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Ihr Geraet wartet auf Sie – bitte holen Sie es zeitnah ab.',
        eyebrow: 'Abholung ausstehend',
        title: 'Ihr Geraet wartet noch auf Abholung',
        intro: 'Hallo {{customerName}}, Ihr Geraet steht bei uns noch zur Abholung bereit. Wir moechten Sie freundlich erinnern, damit es nicht in weitere Kosten auslaeuft.',
        highlights: [
          { label: 'Bereit seit', value: '{{readySince}}' },
          { label: 'Aufbewahrung bis', value: '{{holdUntil}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Geraet', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Abholtage & Zeiten', value: '{{pickupHours}}' },
          { label: 'Adresse', value: '{{workshopAddress}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Wir bewahren Ihr Geraet bis zum angegebenen Termin kostenlos fuer Sie auf. Sollten Sie das Geraet nicht persoenlich abholen koennen, kontaktieren Sie uns bitte, um eine alternative Loesung zu vereinbaren.</p><p style="margin:0;">Bitte bringen Sie Ihren Abholcode oder die Auftragsnummer mit.</p>',
        ctaLabel: 'Abholdetails einsehen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Erinnerung wurde automatisch versendet, da Ihre Abholung noch aussteht.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetemarke'),
        createVariable('deviceModel', 'Geraetemodell'),
        createVariable('readySince', 'Zeitpunkt der Fertigstellung'),
        createVariable('holdUntil', 'Aufbewahrungsfrist'),
        createVariable('pickupHours', 'Oeffnungszeiten'),
        createVariable('workshopAddress', 'Adresse der Abholung'),
        createVariable('trackingUrl', 'Link zur Auftragsseite'),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Benachrichtigungs-Updates fuer Kunden',
      type: 'email',
      subject: 'Neue Benachrichtigung bei {{companyName}}: {{notificationCategoryLabel}}',
      content: renderEmailTemplate({
        preheader: 'Sie haben eine neue Benachrichtigung in Ihrem Kundenkonto erhalten.',
        eyebrow: 'Benachrichtigungszentrale',
        title: 'Neue Benachrichtigung fuer Ihr Kundenkonto',
        intro: 'Hallo {{customerName}}, es gibt ein neues Update zu Ihrem Konto. Unten finden Sie die wichtigsten Informationen zur aktuellen Benachrichtigung sowie eine kompakte Uebersicht aller relevanten Benachrichtigungstypen.',
        highlights: [
          { label: 'Kategorie', value: '{{notificationCategoryLabel}}' },
          { label: 'Erstellt am', value: '{{notificationCreatedAt}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Titel', value: '{{notificationTitle}}' },
          { label: 'Inhalt', value: '{{notificationMessage}}' },
          { label: 'Referenz', value: '{{notificationReference}}' },
          { label: 'Empfohlene Aktion', value: '{{notificationActionLabel}}' },
          { label: 'Auftraege', value: '{{ordersInfo}}' },
          { label: 'Zahlungen', value: '{{paymentsInfo}}' },
          { label: 'Nachrichten', value: '{{messagesInfo}}' },
          { label: 'Zuweisungen', value: '{{assignmentsInfo}}' },
          { label: 'Erinnerungen', value: '{{remindersInfo}}' },
          { label: 'System', value: '{{systemInfo}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Mit dieser E-Mail informieren wir Sie automatisch ueber jede neue Benachrichtigung. So bleiben Sie bei Auftraegen, Zahlungen, Nachrichten, Zuweisungen, Erinnerungen und Systemhinweisen stets auf dem neuesten Stand.</p><p style="margin:0;">Im Kundenkonto koennen Sie alle Eintraege im Detail ansehen und als gelesen markieren.</p>',
        ctaLabel: 'Benachrichtigungen im Kundenkonto oeffnen',
        ctaUrl: '{{notificationsUrl}}',
        closing: 'Vielen Dank fuer Ihr Vertrauen. Wir halten Sie aktiv und transparent informiert.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese E-Mail wurde automatisch durch eine neue Benachrichtigung erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('notificationCategoryLabel', 'Lesbare Kategorie der Benachrichtigung', true),
        createVariable('notificationCreatedAt', 'Zeitpunkt der Benachrichtigung', true),
        createVariable('notificationTitle', 'Titel der Benachrichtigung', true),
        createVariable('notificationMessage', 'Inhalt der Benachrichtigung', true),
        createVariable('notificationReference', 'Referenz wie Auftrag/Rechnung/Nachricht'),
        createVariable('notificationActionLabel', 'Empfohlene Aktion fuer den Kunden'),
        createVariable('ordersInfo', 'Statushinweis zu Auftragsbenachrichtigungen'),
        createVariable('paymentsInfo', 'Statushinweis zu Zahlungsbenachrichtigungen'),
        createVariable('messagesInfo', 'Statushinweis zu Nachrichtenbenachrichtigungen'),
        createVariable('assignmentsInfo', 'Statushinweis zu Zuweisungsbenachrichtigungen'),
        createVariable('remindersInfo', 'Statushinweis zu Erinnerungsbenachrichtigungen'),
        createVariable('systemInfo', 'Statushinweis zu Systembenachrichtigungen'),
        createVariable('notificationsUrl', 'Link zur Benachrichtigungsseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },

    // ===== SMS NOTIFICATION TEMPLATES =====
    {
      name: 'Registrierung SMS',
      type: 'sms',
      subject: 'Willkommen bei {{companyName}}',
      content: '{{companyName}}: Willkommen {{customerName}}! Bitte bestaetigen Sie Ihre E-Mail unter {{verificationUrl}} Viel Erfolg!',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vorname des Kunden', true),
        createVariable('verificationUrl', 'Verknuepfter Aktivierungslink oder Kurzcode', true)
      ],
      isActive: true
    },
    {
      name: 'Auftragsbestaetigung SMS',
      type: 'sms',
      subject: 'Auftrag {{orderNumber}} eingegangen',
      content: '{{companyName}}: Auftrag {{orderNumber}} fuer {{deviceBrand}} {{deviceModel}} eingegangen. Status: {{trackingUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('trackingUrl', 'Short-Link zum Tracking', true)
      ],
      isActive: true
    },
    {
      name: 'Statusupdate SMS',
      type: 'sms',
      subject: 'Status {{orderNumber}}',
      content: '{{companyName}}: Auftrag {{orderNumber}} - {{orderStatus}}. Details: {{trackingUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('orderStatus', 'Neuer Status des Auftrags', true),
        createVariable('trackingUrl', 'Short-Link zum Tracking', true)
      ],
      isActive: true
    },
    {
      name: 'Geraetemeldung SMS',
      type: 'sms',
      subject: 'Geraet eingegangen',
      content: '{{companyName}}: Ihr {{deviceBrand}} {{deviceModel}} ist eingegangen. Auftrag: {{orderNumber}}. Ihr Team',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('orderNumber', 'Auftragsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Kostenvoranschlag SMS',
      type: 'sms',
      subject: 'Freigabe erforderlich',
      content: '{{companyName}}: Reparatur {{deviceBrand}} kostet {{quoteAmount}}. Genehmigung: {{approvalUrl}} Deadline: {{approvalDeadline}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('quoteAmount', 'Kostenvoranschlag', true),
        createVariable('approvalUrl', 'Short-Link zur Freigabe', true),
        createVariable('approvalDeadline', 'Frist fuer Genehmigung', true)
      ],
      isActive: true
    },
    {
      name: 'Fertigstellung SMS',
      type: 'sms',
      subject: 'Reparatur abgeschlossen',
      content: '{{companyName}}: {{deviceBrand}} {{deviceModel}} repariert! Version sendet Versand. {{trackingUrl }}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('trackingUrl', 'Versand-Tracking-Link', true)
      ],
      isActive: true
    },
    {
      name: 'Zahlungsbestaetigung SMS',
      type: 'sms',
      subject: 'Zahlung erhalten',
      content: '{{companyName}}: Zahlung von {{amountPaid}} fuer Auftrag {{orderNumber}} eingegangen. Rechnung: {{invoiceNumber}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('amountPaid', 'Bezahlter Betrag', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('invoiceNumber', 'Rechnungsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Passwort-Reset SMS',
      type: 'sms',
      subject: 'Passwort zuruecksetzen',
      content: '{{companyName}}: Passwort-Reset fuer {{customerEmail}}: {{passwordResetUrl}} Gueltig {{resetExpiresAt}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerEmail', 'E-Mail des Kunden', true),
        createVariable('passwordResetUrl', 'Short-Link zum Reset', true),
        createVariable('resetExpiresAt', 'Gueltigkeitsdauer des Links', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung angelegt SMS',
      type: 'sms',
      subject: 'Buchung {{bookingNumber}} angelegt',
      content: '{{companyName}}: Buchung {{bookingNumber}} erfolgreich angelegt. Status: {{bookingUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingUrl', 'Short-Link zur Buchung', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung Statusupdate SMS',
      type: 'sms',
      subject: 'Buchung {{bookingNumber}} aktualisiert',
      content: '{{companyName}}: Buchung {{bookingNumber}} - {{bookingStatus}}. Details: {{bookingUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingStatus', 'Neuer Status der Buchung', true),
        createVariable('bookingUrl', 'Short-Link zur Buchung', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung bereit zur Abholung SMS',
      type: 'sms',
      subject: 'Buchung abholbereit',
      content: '{{companyName}}: Ihre Buchung {{bookingNumber}} ist abholbereit. Oeffnungszeiten: {{pickupHours}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('pickupHours', 'Abholzeiten', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung storniert SMS',
      type: 'sms',
      subject: 'Buchung storniert',
      content: '{{companyName}}: Buchung {{bookingNumber}} wurde storniert. Fragen: {{supportPhone}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('supportPhone', 'Service-Telefonnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request eingegangen SMS',
      type: 'sms',
      subject: 'Anfrage {{requestNumber}} eingegangen',
      content: '{{companyName}}: Reparaturanfrage {{requestNumber}} fuer {{deviceBrand}} {{deviceModel}} eingegangen. Status: {{requestUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('requestUrl', 'Short-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request neue Nachricht SMS',
      type: 'sms',
      subject: 'Neue Nachricht zur Anfrage',
      content: '{{companyName}}: Neue Nachricht zu Anfrage {{requestNumber}}. Jetzt lesen: {{requestUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('requestUrl', 'Short-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Reklamation eingegangen SMS',
      type: 'sms',
      subject: 'Reklamation eingegangen',
      content: '{{companyName}}: Reklamation {{complaintNumber}} erhalten. Wir melden uns innerhalb von 2-3 Werktagen.',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Reklamation geloest SMS',
      type: 'sms',
      subject: 'Reklamation abgeschlossen',
      content: '{{companyName}}: Reklamation {{complaintNumber}} wurde abgeschlossen. Details: {{complaintUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintUrl', 'Short-Link zur Reklamation', true)
      ],
      isActive: true
    },
    {
      name: 'Terminerinnerung SMS',
      type: 'sms',
      subject: 'Termin Erinnerung',
      content: '{{companyName}}: Termin am {{appointmentDate}} um {{appointmentTime}} Uhr. Adresse: {{workshopAddress}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('appointmentDate', 'Datum des Termins', true),
        createVariable('appointmentTime', 'Uhrzeit des Termins', true),
        createVariable('workshopAddress', 'Adresse der Filiale', true)
      ],
      isActive: true
    },
    {
      name: 'Abholung ausstehend SMS',
      type: 'sms',
      subject: 'Abholung ausstehend',
      content: '{{companyName}}: Geraet {{deviceBrand}} {{deviceModel}} wartet auf Abholung. Abholbar bis: {{holdUntil}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('holdUntil', 'Aufbewahrungsfrist', true)
      ],
      isActive: true
    },

    // ===== PUSH NOTIFICATION TEMPLATES =====
    {
      name: 'Registrierung Push',
      type: 'push',
      subject: 'Konto-Aktivierung',
      content: 'Willkommen {{customerName}}! Bestätigen Sie Ihre Email zu vollständiger Kontozugriff.',
      variables: [
        createVariable('customerName', 'Vorname des Kunden', true),
        createVariable('verificationUrl', 'Deep-Link zur Aktivierung', true)
      ],
      isActive: true
    },
    {
      name: 'Auftragsbestaetigung Push',
      type: 'push',
      subject: 'Auftrag eingegangen',
      content: 'Ihr {{deviceBrand}}-Reparaturauftrag #{{orderNumber}} wurde aufgenommen.',
      variables: [
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('trackingUrl', 'Deep-Link zum Status', true)
      ],
      isActive: true
    },
    {
      name: 'Statusupdate Push',
      type: 'push',
      subject: 'Auftrag {{orderNumber}} aktualisiert',
      content: 'Status: {{orderStatus}} | Auftrag #{{orderNumber}}',
      variables: [
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('orderStatus', 'Neuer Status', true),
        createVariable('trackingUrl', 'Deep-Link zum Status', true)
      ],
      isActive: true
    },
    {
      name: 'Geraetemeldung Push',
      type: 'push',
      subject: 'Gerät eingegangen ✓',
      content: 'Ihr {{deviceBrand}} {{deviceModel}} wurde empfangen und wird bearbeitet.',
      variables: [
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('orderNumber', 'Auftragsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Kostenvoranschlag Push',
      type: 'push',
      subject: 'Genehmigung erforderlich',
      content: 'Kostenvoranschlag {{quoteAmount}} - Ihre Genehmigung bis {{approvalDeadline}}',
      variables: [
        createVariable('quoteAmount', 'Kostenvoranschlag', true),
        createVariable('approvalDeadline', 'Genehmigungsfrist', true),
        createVariable('approvalUrl', 'Deep-Link zur Freigabe', true)
      ],
      isActive: true
    },
    {
      name: 'Fertigstellung Push',
      type: 'push',
      subject: 'Reparatur vollständig ✓',
      content: '{{deviceBrand}} {{deviceModel}} fertig! Versand unterwegs zu Ihnen.',
      variables: [
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('trackingUrl', 'Deep-Link zum Versand-Status', true)
      ],
      isActive: true
    },
    {
      name: 'Zahlungsbestaetigung Push',
      type: 'push',
      subject: 'Zahlung empfangen ✓',
      content: '{{amountPaid}} für Auftrag #{{orderNumber}} bestätigt.',
      variables: [
        createVariable('amountPaid', 'Bezahlter Betrag', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('invoiceNumber', 'Rechnungsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Passwort-Reset Push',
      type: 'push',
      subject: 'Passwort zurücksetzen',
      content: 'Sicherheitslink zur Passwortänderung. Gültig {{resetExpiresAt}}.',
      variables: [
        createVariable('passwordResetUrl', 'Deep-Link zum Reset', true),
        createVariable('resetExpiresAt', 'Gueltigkeitsdauer', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung angelegt Push',
      type: 'push',
      subject: 'Buchung angelegt ✓',
      content: 'Buchung #{{bookingNumber}} wurde erfolgreich angelegt.',
      variables: [
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingUrl', 'Deep-Link zur Buchung', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung Statusupdate Push',
      type: 'push',
      subject: 'Buchung {{bookingNumber}} aktualisiert',
      content: 'Status: {{bookingStatus}} | Buchung #{{bookingNumber}}',
      variables: [
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingStatus', 'Neuer Status', true),
        createVariable('bookingUrl', 'Deep-Link zur Buchung', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung bereit zur Abholung Push',
      type: 'push',
      subject: 'Abholung bereit ✓',
      content: 'Ihre Buchung #{{bookingNumber}} ist abholbereit.',
      variables: [
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingUrl', 'Deep-Link zur Buchung', true)
      ],
      isActive: true
    },
    {
      name: 'Buchung storniert Push',
      type: 'push',
      subject: 'Buchung storniert',
      content: 'Ihre Buchung #{{bookingNumber}} wurde storniert.',
      variables: [
        createVariable('bookingNumber', 'Buchungsnummer', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request eingegangen Push',
      type: 'push',
      subject: 'Anfrage eingegangen ✓',
      content: 'Reparaturanfrage #{{requestNumber}} fuer {{deviceBrand}} {{deviceModel}} eingegangen.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('requestUrl', 'Deep-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request in Bearbeitung Push',
      type: 'push',
      subject: 'Anfrage in Bearbeitung',
      content: 'Ihre Reparaturanfrage #{{requestNumber}} wird jetzt bearbeitet.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('requestUrl', 'Deep-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request Diagnose Push',
      type: 'push',
      subject: 'Diagnose abgeschlossen ✓',
      content: 'Diagnose zu Anfrage #{{requestNumber}} liegt vor. Angebot prüfen.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('approvalUrl', 'Deep-Link zur Freigabe', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request neue Nachricht Push',
      type: 'push',
      subject: 'Neue Nachricht zu Ihrer Anfrage',
      content: 'Neue Mitteilung zu Anfrage #{{requestNumber}} von {{senderName}}.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('senderName', 'Name des Absenders', true),
        createVariable('requestUrl', 'Deep-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Repair Request abgeschlossen Push',
      type: 'push',
      subject: 'Reparaturanfrage abgeschlossen ✓',
      content: 'Anfrage #{{requestNumber}} wurde abgeschlossen.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('requestUrl', 'Deep-Link zur Anfrage', true)
      ],
      isActive: true
    },
    {
      name: 'Reklamation eingegangen Push',
      type: 'push',
      subject: 'Reklamation eingegangen ✓',
      content: 'Reklamation #{{complaintNumber}} wurde erhalten. Wir melden uns.',
      variables: [
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintUrl', 'Deep-Link zur Reklamation', true)
      ],
      isActive: true
    },
    {
      name: 'Reklamation neue Nachricht Push',
      type: 'push',
      subject: 'Neue Mitteilung zu Ihrer Reklamation',
      content: 'Neue Mitteilung zu Reklamation #{{complaintNumber}} von {{senderName}}.',
      variables: [
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('senderName', 'Name des Absenders', true),
        createVariable('complaintUrl', 'Deep-Link zur Reklamation', true)
      ],
      isActive: true
    },
    {
      name: 'Reklamation geloest Push',
      type: 'push',
      subject: 'Reklamation gelöst ✓',
      content: 'Reklamation #{{complaintNumber}} wurde erfolgreich abgeschlossen.',
      variables: [
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintUrl', 'Deep-Link zur Reklamation', true)
      ],
      isActive: true
    },
    {
      name: 'Terminerinnerung Push',
      type: 'push',
      subject: 'Termin morgen',
      content: 'Erinnerung: Termin am {{appointmentDate}} um {{appointmentTime}} Uhr.',
      variables: [
        createVariable('appointmentDate', 'Datum des Termins', true),
        createVariable('appointmentTime', 'Uhrzeit des Termins', true),
        createVariable('appointmentUrl', 'Deep-Link zum Termin', true)
      ],
      isActive: true
    },
    {
      name: 'Garantieerinnerung Push',
      type: 'push',
      subject: 'Garantie läuft ab',
      content: 'Garantie für {{deviceBrand}} {{deviceModel}} läuft am {{warrantyExpiryDate}} ab.',
      variables: [
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('warrantyExpiryDate', 'Ablaufdatum', true)
      ],
      isActive: true
    },
    {
      name: 'Abholung ausstehend Push',
      type: 'push',
      subject: 'Gerät wartet auf Abholung',
      content: '{{deviceBrand}} {{deviceModel}} bei uns abholbereit bis {{holdUntil}}.',
      variables: [
        createVariable('deviceBrand', 'Geraetehersteller', true),
        createVariable('deviceModel', 'Geraetemodell', true),
        createVariable('holdUntil', 'Aufbewahrungsfrist', true)
      ],
      isActive: true
    },
    {
      name: 'Neue Rechnung Push',
      type: 'push',
      subject: 'Neue Rechnung verfügbar',
      content: 'Rechnung {{invoiceNumber}} über {{invoiceAmount}} ist verfügbar.',
      variables: [
        createVariable('invoiceNumber', 'Rechnungsnummer', true),
        createVariable('invoiceAmount', 'Rechnungsbetrag', true),
        createVariable('invoiceUrl', 'Deep-Link zur Rechnung', true)
      ],
      isActive: true
    }
  ];
}

module.exports = {
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
  getDefaultNotificationTemplates
};