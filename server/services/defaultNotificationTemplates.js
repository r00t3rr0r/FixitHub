const DEFAULT_NOTIFICATION_TEMPLATE_VERSION = 2;

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
    }
  ];
}

module.exports = {
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
  getDefaultNotificationTemplates
};