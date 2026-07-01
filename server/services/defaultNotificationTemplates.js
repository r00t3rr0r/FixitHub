const DEFAULT_NOTIFICATION_TEMPLATE_VERSION = 16;

const brand = {
  companyName: 'Mc<span style="color:#f5b800;font-weight:800;">Repair</span>.de',
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

function renderButtons({
  primaryLabel,
  primaryUrl,
  secondaryLabel,
  secondaryUrl,
  primaryTone = 'accent',
  secondaryTone = 'primary'
} = {}) {
  if (!primaryLabel || !primaryUrl) {
    return '';
  }

  const toneToColors = (tone) => {
    if (tone === 'accent') {
      return {
        background: brand.accent,
        color: brand.primaryDark,
      };
    }

    return {
      background: brand.primary,
      color: '#ffffff',
    };
  };

  const buildButtonStyle = (tone) => {
    const colors = toneToColors(tone);
    return [
      'display:block',
      'padding:14px 18px',
      'font-size:14px',
      'font-weight:700',
      'line-height:20px',
      'text-decoration:none',
      'text-align:center',
      'border-radius:999px',
      `background:${colors.background}`,
      `color:${colors.color}`,
    ].join(';');
  };

  const primaryButtonStyle = buildButtonStyle(primaryTone);
  const secondaryButtonStyle = buildButtonStyle(secondaryTone);

  const baseButtonStyle = [
    'display:block',
    'padding:14px 18px',
    'font-size:14px',
    'font-weight:700',
    'line-height:20px',
    'text-decoration:none',
    'text-align:center',
    'border-radius:999px',
    `background:${brand.accent}`,
    `color:${brand.primaryDark}`,
  ].join(';');

  if (!secondaryLabel || !secondaryUrl) {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 24px 0;">
        <tr>
          <td style="text-align:center;">
            <a href="${primaryUrl}" style="${baseButtonStyle};min-width:280px;">${primaryLabel}</a>
          </td>
        </tr>
      </table>`;
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 24px 0;">
      <tr>
        <td style="padding-right:6px;vertical-align:top;width:50%;">
          <a href="${primaryUrl}" style="${primaryButtonStyle};">${primaryLabel}</a>
        </td>
        <td style="padding-left:6px;vertical-align:top;width:50%;">
          <a href="${secondaryUrl}" style="${secondaryButtonStyle};">${secondaryLabel}</a>
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
  extraTableRows,
  body,
  ctaLabel,
  ctaUrl,
  ctaTone,
  secondaryCtaLabel,
  secondaryCtaUrl,
  secondaryCtaTone,
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
  <style>
    @media only screen and (max-width: 520px) {
      .email-shell {
        padding: 14px 6px !important;
      }

      .email-panel {
        border-radius: 16px !important;
      }

      .email-header {
        padding: 22px 18px !important;
      }

      .email-body,
      .email-footer {
        padding: 20px 18px !important;
      }

      .email-title {
        font-size: 24px !important;
        line-height: 1.25 !important;
      }

      .email-intro {
        font-size: 15px !important;
        line-height: 1.6 !important;
      }

      .email-body {
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${brand.background};font-family:'Segoe UI',Arial,sans-serif;color:${brand.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-shell" style="background:${brand.background};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-panel" style="max-width:680px;background:${brand.surface};border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(15,29,69,0.12);">
          <tr>
            <td style="height:8px;background:${brand.accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:32px 36px;background:${brand.primary};">
              <div style="font-size:12px;line-height:1;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-bottom:14px;">${eyebrow}</div>
              <div style="font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;letter-spacing:-0.03em;">${brand.companyName}</div>
              <div style="width:72px;height:4px;border-radius:999px;background:${brand.accent};margin:22px 0 0 0;"></div>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:36px;">
              <h1 class="email-title" style="margin:0 0 14px 0;font-size:30px;line-height:1.2;font-weight:800;color:${brand.primaryDark};letter-spacing:-0.03em;">${title}</h1>
              <p class="email-intro" style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:${brand.muted};">${intro}</p>
              ${renderHighlights(highlights)}
              ${(detailRows && detailRows.length) || extraTableRows ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;border-collapse:collapse;">
                  ${renderDetailRows(detailRows || [])}
                  ${extraTableRows || ''}
                </table>` : ''}
              <div style="font-size:15px;line-height:1.8;color:${brand.text};">${body}</div>
              ${renderButtons({
                primaryLabel: ctaLabel,
                primaryUrl: ctaUrl,
                primaryTone: ctaTone,
                secondaryLabel: secondaryCtaLabel,
                secondaryUrl: secondaryCtaUrl,
                secondaryTone: secondaryCtaTone,
              })}
              <div style="margin-top:28px;padding:18px 20px;background:${brand.softBlue};border-radius:18px;border:1px solid ${brand.border};font-size:14px;line-height:1.7;color:${brand.text};">
                ${closing}
              </div>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:24px 36px 32px 36px;background:#f8f9fc;border-top:1px solid ${brand.border};font-size:12px;line-height:1.7;color:${brand.muted};">
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
        preheader: 'Bitte bestätigen Sie Ihre E-Mail-Adresse für Ihr neues Kundenkonto.',
        eyebrow: 'Konto & Registrierung',
        title: 'Willkommen bei {{companyName}}',
        intro: 'Hallo {{customerName}}, vielen Dank für Ihre Registrierung. Bitte bestätigen Sie Ihre E-Mail-Adresse, damit Sie Reparaturaufträge, Statusupdates und Dokumente bequem in Ihrem Kundenkonto verwalten können.',
        highlights: [
          { label: 'Kundenkonto', value: 'Schneller Zugriff auf Ihre Aufträge, Rechnungen und Service-Historie.' },
          { label: 'Sicherheit', value: 'Die Aktivierung schützt Ihr Konto und ermöglicht sichere Benachrichtigungen.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Kunde', value: '{{customerName}}' },
          { label: 'E-Mail-Adresse', value: '{{customerEmail}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Nach der Aktivierung können Sie Reparaturen beauftragen, den aktuellen Bearbeitungsstatus verfolgen und mit unserem Service-Team kommunizieren.</p><p style="margin:0;">Sollten Sie sich nicht registriert haben, können Sie diese Nachricht ignorieren.</p>',
        ctaLabel: 'Konto aktivieren',
        ctaUrl: '{{verificationUrl}}',
        closing: 'Wir freuen uns darauf, Sie bei Ihren Reparaturen schnell, transparent und professionell zu begleiten.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde automatisch für Ihr Kundenkonto erstellt.'
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
        intro: 'Hallo {{customerName}}, wir haben Ihren Reparaturauftrag erfolgreich aufgenommen und die Bearbeitung vorbereitet. Vielen Dank für Ihr Vertrauen in {{companyName}}.',
        highlights: [
          { label: 'Nächster Schritt', value: 'Unser Technik-Team prüft den Auftrag und informiert Sie über jeden wichtigen Fortschritt.' },
          { label: 'Transparenz', value: 'Sie können alle Schritte jederzeit online nachvollziehen.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Leistung', value: '{{serviceName}}' },
          { label: 'Voraussichtliche Fertigstellung', value: '{{estimatedCompletion}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte prüfen Sie bei Gelegenheit Ihre hinterlegten Daten. Wenn Sie Rückfragen zum Fehlerbild oder zum Versand haben, antworten Sie einfach auf diese E-Mail.</p><p style="margin:0;">Sobald sich der Status ändert, informieren wir Sie automatisch.</p>',
        ctaLabel: 'Auftrag online verfolgen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Vielen Dank für Ihren Auftrag. Wir halten Sie während des gesamten Reparaturprozesses aktiv auf dem Laufenden.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Auftragsbestätigung bezieht sich auf Ihren aktuellen Reparaturauftrag.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('serviceName', 'Gebuchte Reparaturleistung', true),
        createVariable('estimatedCompletion', 'Geschätztes Fertigstellungsdatum'),
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
          { label: 'Nächster Hinweis', value: '{{statusMessage}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Buchungsstatus', value: '{{bookingStatus}}' },
          { label: 'Reparaturstatus', value: '{{orderStatus}}' },
          { label: 'Aktualisiert am', value: '{{statusUpdatedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Sollten wir noch Informationen von Ihnen benötigen, melden wir uns separat. In Ihrem Kundenbereich sehen Sie jederzeit den aktuellen Bearbeitungsstand.</p><p style="margin:0;">Wenn Sie Fragen zu diesem Update haben, steht Ihnen unser Service-Team gerne zur Verfügung.</p>',
        ctaLabel: 'Status im Kundenkonto ansehen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir begleiten Ihren Auftrag transparent und informieren Sie bei jedem wichtigen Meilenstein.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung wurde automatisch durch eine Statusänderung ausgelöst.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('bookingStatus', 'Status der Buchung'),
        createVariable('deviceBrand', 'Gerätemarke'),
        createVariable('deviceModel', 'Gerätemodell'),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('orderStatus', 'Status des Reparaturauftrags', true),
        createVariable('statusMessage', 'Zusätzlicher Hinweis zum Status'),
        createVariable('statusUpdatedAt', 'Zeitpunkt der Statusänderung'),
        createVariable('trackingUrl', 'Link zur Auftragsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Geraet eingegangen',
      type: 'email',
      subject: 'Ihr Gerät ist bei {{companyName}} eingetroffen',
      content: renderEmailTemplate({
        preheader: 'Wir haben Ihr Gerät erhalten und zur Prüfung übernommen.',
        eyebrow: 'Wareneingang',
        title: 'Ihr Gerät ist sicher bei uns angekommen',
        intro: 'Hallo {{customerName}}, wir bestätigen den Eingang Ihres Geräts. Unser Team prüft den Zustand nun im Detail und bereitet die weitere Bearbeitung vor.',
        highlights: [
          { label: 'Eingang bestätigt', value: 'Ihr Paket wurde erfasst und intern zugeordnet.' },
          { label: 'Nächster Schritt', value: 'Diagnose, Sichtprüfung und weitere Statusmeldung.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Eingangsdatum', value: '{{receivedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Nach der Erstprüfung informieren wir Sie, sobald die Reparatur startet oder wenn Rückfragen zum Gerät bestehen.</p><p style="margin:0;">Bitte bewahren Sie Ihre Auftragsnummer für eventuelle Rückfragen auf.</p>',
        ctaLabel: 'Auftragsdetails aufrufen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Vielen Dank für Ihr Vertrauen. Ihr Gerät befindet sich nun in professioneller Bearbeitung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den physischen Eingang Ihres Geräts.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('receivedAt', 'Datum des Wareneingangs'),
        createVariable('trackingUrl', 'Link zur Auftragsverfolgung', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Diagnose abgeschlossen',
      type: 'email',
      subject: 'Diagnose abgeschlossen: Auftrag {{orderNumber}} – {{deviceBrand}} {{deviceModel}}',
      content: renderEmailTemplate({
        preheader: 'Die Diagnose Ihres Gerätes wurde abgeschlossen. Hier finden Sie alle Ergebnisse auf einen Blick.',
        eyebrow: 'Diagnose abgeschlossen',
        title: 'Diagnosebericht für Ihr Gerät',
        intro: 'Hallo {{customerName}}, die technische Diagnose Ihres Gerätes ist abgeschlossen. Im Folgenden finden Sie eine Zusammenfassung der Ergebnisse sowie die nächsten Schritte für Ihren Auftrag.',
        highlights: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Diagnoseergebnis', value: '{{diagnosisResult}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Diagnose abgeschlossen am', value: '{{diagnosisCompletedAt}}' },
          { label: 'Zustand', value: '{{deviceCondition}}' },
          { label: 'Empfohlene Maßnahme', value: '{{recommendedAction}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Im Kundenkonto können Sie den vollständigen Diagnosebericht einsehen und ggf. direkt auf unsere Empfehlung reagieren.</p><p style="margin:0;">Sollten Sie Fragen zu den Ergebnissen oder zum weiteren Vorgehen haben, stehen wir Ihnen jederzeit zur Verfügung.</p>',
        ctaLabel: 'Auftrag online einsehen',
        ctaUrl: '{{orderUrl}}',
        closing: 'Wir halten Sie weiterhin aktiv über den Fortschritt Ihres Auftrags informiert.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde automatisch nach Abschluss der Gerätediagnose erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('diagnosisResult', 'Kernaussage des Diagnoseergebnisses (z.B. Reparierbar / Nicht reparierbar)', true),
        createVariable('diagnosisCompletedAt', 'Datum und Uhrzeit des Diagnoseabschlusses', true),
        createVariable('deviceCondition', 'Zustand des Gerätes nach Diagnose'),
        createVariable('recommendedAction', 'Empfohlene Maßnahme (z.B. Kostenvoranschlag folgt, Kundenfreigabe erforderlich)'),
        createVariable('orderUrl', 'Vollständiger Link zur Auftragsdetailseite im Kundenkonto', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Kostenvoranschlag zur Freigabe',
      type: 'email',
      subject: 'Bitte prüfen Sie Ihren Kostenvoranschlag zu Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Ihr Kostenvoranschlag ist verfügbar und wartet auf Ihre Freigabe.',
        eyebrow: 'Freigabe erforderlich',
        title: 'Ihr Kostenvoranschlag ist verfügbar',
        intro: 'Hallo {{customerName}}, für Ihren Auftrag liegt nun ein Kostenvoranschlag vor. Bitte prüfen Sie die vorgeschlagene Reparatur und geben Sie die Bearbeitung bei Bedarf frei.',
        highlights: [
          { label: 'Gesamtbetrag', value: '{{quoteAmount}}' },
          { label: 'Antwort benötigt', value: 'Mit Ihrer Freigabe kann die Reparatur direkt fortgesetzt werden.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Empfohlene Leistung', value: '{{serviceName}}' },
          { label: 'Freigabe bis', value: '{{approvalDeadline}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Im Kundenkonto finden Sie alle Informationen zum Umfang der Reparatur. Dort können Sie den Kostenvoranschlag freigeben oder bei Bedarf Rückfragen stellen.</p><p style="margin:0;">Ohne Freigabe können wir die Reparatur nicht fortsetzen.</p>',
        ctaLabel: 'Kostenvoranschlag prüfen',
        ctaUrl: '{{approvalUrl}}',
        closing: 'Sobald Ihre Freigabe vorliegt, setzen wir den Auftrag ohne unnötige Verzögerung fort.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde erstellt, weil für Ihren Auftrag eine Entscheidung erforderlich ist.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('serviceName', 'Empfohlene Reparaturleistung'),
        createVariable('quoteAmount', 'Betrag des Kostenvoranschlags', true),
        createVariable('approvalDeadline', 'Frist für die Freigabe'),
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
        preheader: 'Ihre Reparatur ist abgeschlossen und der Rückversand wurde vorbereitet.',
        eyebrow: 'Abschluss & Versand',
        title: 'Ihre Reparatur ist abgeschlossen',
        intro: 'Hallo {{customerName}}, Ihr Gerät wurde erfolgreich bearbeitet. Je nach Ablauf steht es nun zur Abholung bereit oder befindet sich bereits im Rückversand.',
        highlights: [
          { label: 'Reparaturstatus', value: 'Abgeschlossen' },
          { label: 'Versandstatus', value: '{{returnShipmentStatus}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Rücksendungsnummer', value: '{{returnTrackingNumber}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls Ihr Gerät versendet wurde, können Sie den Versandstatus online verfolgen. Sollte eine Abholung vorgesehen sein, teilen wir Ihnen die relevanten Informationen direkt mit.</p><p style="margin:0;">Bitte prüfen Sie nach Erhalt kurz die Funktion und melden Sie sich bei Unklarheiten jederzeit bei uns.</p>',
        ctaLabel: 'Versand verfolgen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir freuen uns, Ihren Auftrag erfolgreich abgeschlossen zu haben, und bedanken uns für Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie über den erfolgreichen Abschluss Ihrer Reparatur.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('returnShipmentStatus', 'Status des Rückversands'),
        createVariable('returnTrackingNumber', 'Sendungsnummer für den Rückversand'),
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
        preheader: 'Wir bestätigen den Eingang Ihrer Zahlung.',
        eyebrow: 'Zahlung & Dokumente',
        title: 'Vielen Dank für Ihre Zahlung',
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
        body: '<p style="margin:0 0 16px 0;">Ihre Zahlung wurde Ihrem Auftrag eindeutig zugeordnet. Falls bereits ein Rechnungsdokument verfügbar ist, können Sie es über den untenstehenden Link aufrufen.</p><p style="margin:0;">Bei Rückfragen zur Abrechnung hilft Ihnen unser Team gerne weiter.</p>',
        ctaLabel: 'Rechnung ansehen',
        ctaUrl: '{{invoiceUrl}}',
        closing: 'Vielen Dank für die schnelle Zahlung. Damit ist Ihr Auftrag auch kaufmännisch sauber abgeschlossen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den erfolgreichen Zahlungseingang für Ihren Auftrag.'
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
      subject: 'Passwort für Ihr {{companyName}} Konto zurücksetzen',
      content: renderEmailTemplate({
        preheader: 'Setzen Sie Ihr Passwort sicher über den zugesandten Link zurück.',
        eyebrow: 'Sicherheit',
        title: 'Passwort sicher zurücksetzen',
        intro: 'Hallo {{customerName}}, für Ihr Kundenkonto wurde eine Anfrage zum Zurücksetzen des Passworts gestellt. Über den folgenden Link können Sie ein neues Passwort vergeben.',
        highlights: [
          { label: 'Wichtig', value: 'Der Link ist nur für einen begrenzten Zeitraum gültig.' },
          { label: 'Sicherheitshinweis', value: 'Wenn Sie diese Anfrage nicht selbst gestellt haben, ignorieren Sie die E-Mail bitte.', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Kunde', value: '{{customerName}}' },
          { label: 'E-Mail-Adresse', value: '{{customerEmail}}' },
          { label: 'Gültig bis', value: '{{resetExpiresAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Aus Sicherheitsgründen empfehlen wir ein starkes Passwort mit ausreichend Zeichen, Groß- und Kleinbuchstaben sowie Zahlen.</p><p style="margin:0;">Falls Sie Hilfe benötigen, steht unser Support-Team gerne für Sie bereit.</p>',
        ctaLabel: 'Neues Passwort vergeben',
        ctaUrl: '{{passwordResetUrl}}',
        closing: 'Die Sicherheit Ihres Kundenkontos hat für uns hohe Priorität.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Sicherheitsnachricht wurde aufgrund einer Passwort-Reset-Anfrage erstellt.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('customerEmail', 'E-Mail-Adresse des Kunden', true),
        createVariable('passwordResetUrl', 'Link zum Zurücksetzen des Passworts', true),
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
        eyebrow: 'Buchungsbestätigung',
        title: 'Ihre Buchung ist erfolgreich eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Buchung erfolgreich aufgenommen. Unser Team wird den Vorgang prüfen und Sie über den nächsten Schritt informieren.',
        highlights: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Buchungsdatum', value: '{{bookingDate}}' },
          { label: 'Enthaltene Aufträge im Überblick', value: '{{itemSummary}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}' },
          { label: 'Status', value: '{{bookingStatus}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">In Ihrer Buchung sind alle zugeordneten Reparaturaufträge und Leistungen zusammengefasst. Sie können den aktuellen Buchungsstatus jederzeit in Ihrem Kundenkonto einsehen.</p><p style="margin:0;">Bei Rückfragen zu Ihrer Buchung steht Ihnen unser Support-Team gerne zur Verfügung.</p>',
        ctaLabel: 'Buchung online einsehen',
        ctaUrl: '{{bookingUrl}}',
        ctaTone: 'accent',
        closing: 'Vielen Dank für Ihr Vertrauen. Wir halten Sie während des gesamten Prozesses auf dem Laufenden.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Buchungsbestätigung bezieht sich auf Ihre aktuell angelegte Buchung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingDate', 'Datum der Buchungserstellung'),
        createVariable('itemSummary', 'Nutzerfreundliche Übersicht der enthaltenen Aufträge mit Status und Betrag'),
        createVariable('totalAmount', 'Gesamtbetrag der Buchung'),
        createVariable('bookingStatus', 'Aktueller Buchungsstatus'),
        createVariable('bookingUrl', 'Link zur Buchungsdetailseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Gast Buchung Tracking',
      type: 'email',
      subject: 'Buchung {{bookingNumber}} bestätigt – Tracking-Link zu Ihrer Gastbestellung',
      content: renderEmailTemplate({
        preheader: 'Ihre Gastbuchung wurde angelegt. Verfolgen Sie den Status jederzeit über den Tracking-Link.',
        eyebrow: 'Gastbestellung',
        title: 'Ihre Gastbuchung ist bestätigt',
        intro: 'Hallo {{customerName}}, Ihre Buchung wurde erfolgreich angelegt. Über den untenstehenden Link können Sie den aktuellen Status Ihrer Gastbestellung jederzeit abrufen.',
        highlights: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Buchungsdatum', value: '{{bookingDate}}' },
          { label: 'Enthaltene Aufträge', value: '{{itemSummary}}' },
          { label: 'Gesamtbetrag', value: '{{totalAmount}}' },
          { label: 'Status', value: '{{bookingStatus}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte bewahren Sie diese E-Mail auf. Der Tracking-Link ist Ihr direkter Zugang zur Statusseite Ihrer Gastbuchung.</p><p style="margin:0;">Bei Rückfragen zu Ihrer Buchung helfen wir Ihnen jederzeit gerne weiter.</p>',
        ctaLabel: 'Gastbuchung jetzt verfolgen',
        ctaUrl: '{{trackingUrl}}',
        ctaTone: 'accent',
        closing: 'Vielen Dank für Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde automatisch nach erfolgreicher Gastbestellung versendet.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingDate', 'Datum der Buchungserstellung', true),
        createVariable('itemSummary', 'Nutzerfreundliche Übersicht der enthaltenen Aufträge', true),
        createVariable('totalAmount', 'Gesamtbetrag der Buchung', true),
        createVariable('bookingStatus', 'Aktueller Buchungsstatus', true),
        createVariable('trackingUrl', 'Direkter Gast-Tracking-Link zur Buchung', true),
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
        intro: 'Hallo {{customerName}}, der Status Ihrer Buchung hat sich geändert. Nachfolgend finden Sie alle relevanten Informationen auf einen Blick.',
        highlights: [
          { label: 'Neuer Status', value: '{{bookingStatus}}' },
          { label: 'Hinweis', value: '{{statusNote}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Enthaltene Aufträge', value: '{{itemSummary}}' },
          { label: 'Gesamtfortschritt', value: '{{progressPercent}}%' },
          { label: 'Aktualisiert am', value: '{{updatedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte melden Sie sich in Ihrem Kundenkonto an, um alle Details zu Ihrer Buchung, den einzelnen Aufträgen und den jeweiligen Fortschritten einzusehen.</p><p style="margin:0;">Unser Team begleitet Ihren Vorgang und informiert Sie bei jedem weiteren Meilenstein automatisch.</p>',
        ctaLabel: 'Buchungsstatus einsehen',
        ctaUrl: '{{bookingUrl}}',
        closing: 'Wir danken Ihnen für Ihr Vertrauen und begleiten Ihre Buchung transparent bis zum Abschluss.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung wurde automatisch durch eine Statusänderung Ihrer Buchung ausgelöst.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('bookingStatus', 'Neuer Buchungsstatus', true),
        createVariable('statusNote', 'Zusätzlicher Hinweis zum Status'),
        createVariable('itemSummary', 'Kurzübersicht der enthaltenen Aufträge'),
        createVariable('progressPercent', 'Gesamtfortschritt in Prozent'),
        createVariable('updatedAt', 'Zeitpunkt der Statusänderung'),
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
        intro: 'Hallo {{customerName}}, alle Arbeiten zu Ihrer Buchung wurden erfolgreich abgeschlossen. Ihr Gerät steht nun bei uns zur Abholung bereit.',
        highlights: [
          { label: 'Abholtage', value: '{{pickupHours}}' },
          { label: 'Standort', value: '{{workshopAddress}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Buchungsnummer', value: '{{bookingNumber}}' },
          { label: 'Gerät', value: '{{orderDeviceVisual}}' },
          { label: 'Abholbereit seit', value: '{{readySince}}' },
          { label: 'Aufbewahrung bis', value: '{{holdUntil}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte bringen Sie bei der Abholung Ihren Abholcode oder die Auftragsnummer mit. Falls Sie das Gerät nicht persönlich abholen können, kontaktieren Sie uns bitte rechtzeitig.</p><p style="margin:0;">Nach Ablauf des Aufbewahrungszeitraums behalten wir uns vor, eine Lagergebühr zu erheben.</p>',
        ctaLabel: 'Abholdetails ansehen',
        ctaUrl: '{{bookingUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch und bedanken uns herzlich für Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Ihr Gerät wurde sorgfältig vorbereitet und wartet auf Sie.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('bookingNumber', 'Buchungsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke'),
        createVariable('deviceModel', 'Gerätemodell'),
        createVariable('orderDeviceVisual', 'HTML-Block mit Modellbild (oder Placeholder) und Gerätename'),
        createVariable('pickupHours', 'Öffnungszeiten für die Abholung'),
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
        preheader: 'Ihre Buchung wurde storniert. Wir informieren Sie über die nächsten Schritte.',
        eyebrow: 'Stornierung',
        title: 'Ihre Buchung wurde storniert',
        intro: 'Hallo {{customerName}}, Ihre Buchung wurde storniert. Wir bedauern dies und möchten Ihnen alle relevanten Informationen zur Stornierung mitteilen.',
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
        body: '<p style="margin:0 0 16px 0;">Falls Sie eine Erstattung erwarten, wird diese in der Regel innerhalb von 5-10 Werktagen bearbeitet. Bei spezifischen Fragen zur Stornierung stehen wir Ihnen gerne zur Verfügung.</p><p style="margin:0;">Wenn Sie einen neuen Auftrag beauftragen möchten, können Sie dies jederzeit über unser Portal tun.</p>',
        ctaLabel: 'Neuen Auftrag anlegen',
        ctaUrl: '{{newBookingUrl}}',
        closing: 'Wir hoffen, Sie bald wieder als Kunden begrüßen zu dürfen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt die Stornierung Ihrer Buchung.'
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
      name: 'Repair Requests eingegangen',
      type: 'email',
      subject: 'Ihre Reparaturanfrage {{requestNumber}} ist bei uns eingegangen',
      content: renderEmailTemplate({
        preheader: 'Ihre Reparaturanfrage wurde erfolgreich übermittelt.',
        eyebrow: 'Reparaturanfrage',
        title: 'Ihre Reparaturanfrage ist eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Reparaturanfrage erhalten und werden sie schnellstmöglich prüfen. Wir melden uns mit einem Angebot oder weiteren Informationen.',
        highlights: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Fehlerbeschreibung', value: '{{issueDescription}}' },
          { label: 'Eingegangen am', value: '{{submittedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unser Techniker-Team prüft Ihre Anfrage und wird sich in Kürze mit einem Angebot oder Rückfragen bei Ihnen melden. In der Regel erhalten Sie eine Rückmeldung innerhalb von 1–2 Werktagen.</p><p style="margin:0;">Über Ihren persönlichen Bereich können Sie den aktuellen Status Ihrer Anfrage jederzeit einsehen.</p>',
        ctaLabel: 'Anfrage verfolgen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir freuen uns, Ihnen schnell und professionell helfen zu können.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den Eingang Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('issueDescription', 'Beschreibung des Fehlerbildes'),
        createVariable('submittedAt', 'Zeitpunkt der Übermittlung'),
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
        intro: 'Hallo {{customerName}}, wir möchten Sie informieren, dass Ihre Reparaturanfrage nun aktiv von unserem Team bearbeitet wird. Wir halten Sie weiterhin auf dem Laufenden.',
        highlights: [
          { label: 'Status', value: 'In Bearbeitung' },
          { label: 'Zuständiger Techniker', value: '{{technicianName}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Bearbeitung gestartet', value: '{{processingStartedAt}}' },
          { label: 'Voraussichtliche Antwort', value: '{{estimatedResponseDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unser Techniker analysiert nun das von Ihnen geschilderte Problem und erarbeitet eine Lösungsempfehlung oder einen Kostenvoranschlag für Sie.</p><p style="margin:0;">Falls wir zusätzliche Informationen von Ihnen benötigen, werden wir uns direkt bei Ihnen melden.</p>',
        ctaLabel: 'Anfragestatus ansehen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir sind dabei, Ihnen die bestmögliche Lösung bereitzustellen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung informiert Sie über den Bearbeitungsstart Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('technicianName', 'Name des zuständigen Technikers'),
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
        preheader: 'Die Diagnose Ihres Gerätes ist abgeschlossen. Bitte prüfen Sie das Ergebnis.',
        eyebrow: 'Diagnoseergebnis',
        title: 'Diagnose Ihres Gerätes abgeschlossen',
        intro: 'Hallo {{customerName}}, die Diagnose Ihres Gerätes wurde abgeschlossen. Wir praesentieren Ihnen nachfolgend die Ergebnisse sowie unsere Empfehlung für die weitere Vorgehensweise.',
        highlights: [
          { label: 'Diagnoseergebnis', value: '{{diagnosisResult}}' },
          { label: 'Empfohlene Maßnahme', value: '{{recommendedAction}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Fehlerdiagnose', value: '{{diagnosisResult}}' },
          { label: 'Angebotsbetrag', value: '{{offerAmount}}' },
          { label: 'Diagnose abgeschlossen am', value: '{{diagnosisDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte prüfen Sie das Diagnoseergebnis und das beigefuegte Angebot. Sie können die Reparatur direkt über Ihr Kundenkonto freigeben oder uns bei weiteren Fragen kontaktieren.</p><p style="margin:0;">Wir empfehlen, die Freigabe möglichst zeitnah zu erteilen, damit wir sofort mit der Reparatur beginnen können.</p>',
        ctaLabel: 'Angebot prüfen und freigeben',
        ctaUrl: '{{approvalUrl}}',
        closing: 'Wir stehen Ihnen bei allen Fragen zur Diagnose und zum Angebot jederzeit zur Verfügung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie über das Diagnoseergebnis Ihres Gerätes.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('diagnosisResult', 'Zusammenfassung der Diagnose', true),
        createVariable('recommendedAction', 'Handlungsempfehlung des Technikers'),
        createVariable('offerAmount', 'Angebotsbetrag für die Reparatur'),
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
        intro: 'Hallo {{customerName}}, es gibt eine neue Nachricht zu Ihrer Reparaturanfrage. Bitte melden Sie sich in Ihrem Kundenkonto an, um die vollständige Nachricht zu lesen und zu antworten.',
        highlights: [
          { label: 'Absender', value: '{{senderName}}' },
          { label: 'Anfragenummer', value: '{{requestNumber}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Nachricht von', value: '{{senderName}}' },
          { label: 'Gesendet am', value: '{{messageSentAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Bitte lesen Sie die Nachricht in Ihrem Kundenkonto und antworten Sie bei Bedarf direkt dort. Auf diese Weise bleiben alle Kommunikationen lueckenlos dokumentiert.</p><p style="margin:0;">Damit wir Ihren Auftrag reibungslos bearbeiten können, bitten wir um eine zeitnahe Rückmeldung.</p>',
        ctaLabel: 'Nachricht lesen und antworten',
        ctaUrl: '{{requestUrl}}',
        closing: 'Vielen Dank für Ihre Zusammenarbeit. Wir stehen für alle Rückfragen gerne bereit.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung gilt als Hinweis auf eine neue Kommunikation zu Ihrer Anfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätemarke'),
        createVariable('deviceModel', 'Gerätemodell'),
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
        intro: 'Hallo {{customerName}}, wir möchten Sie informieren, dass Ihre Reparaturanfrage nun vollständig abgeschlossen wurde. Vielen Dank für Ihre Geduld und Ihr Vertrauen.',
        highlights: [
          { label: 'Ergebnis', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{completedAt}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Anfragenummer', value: '{{requestNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Ergebnis', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{completedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls ein Folgeauftrag erstellt wurde, erhalten Sie hierzu separat eine Auftragsbestätigung. Andernfalls ist der Vorgang mit diesem Schritt vollständig beendet.</p><p style="margin:0;">Wir würden uns über eine kurze Bewertung Ihrer Erfahrung sehr freuen – Ihr Feedback hilft uns, unsere Dienstleistungen kontinuierlich zu verbessern.</p>',
        ctaLabel: 'Anfrage abschliessend einsehen',
        ctaUrl: '{{requestUrl}}',
        closing: 'Wir bedanken uns herzlich für Ihr Vertrauen und freuen uns, Ihnen geholfen zu haben.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den Abschluss Ihrer Reparaturanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätemarke'),
        createVariable('deviceModel', 'Gerätemodell'),
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
        preheader: 'Ihre Reklamation ist bei uns eingegangen. Wir kümmern uns darum.',
        eyebrow: 'Reklamation',
        title: 'Ihre Reklamation ist bei uns eingegangen',
        intro: 'Hallo {{customerName}}, wir haben Ihre Reklamation erhalten und nehmen Ihr Anliegen sehr ernst. Unser Team wird den Vorgang umgehend prüfen und sich bei Ihnen melden.',
        highlights: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Priorität', value: '{{priority}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Kategorie', value: '{{complaintCategory}}' },
          { label: 'Betreff', value: '{{complaintSubject}}' },
          { label: 'Referenz-Auftrag', value: '{{orderNumber}}' },
          { label: 'Eingegangen am', value: '{{submittedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Wir bedauern, dass Sie Grund zur Beanstandung hatten, und werden alles daran setzen, Ihr Anliegen schnell und fair zu klären. In der Regel erhalten Sie innerhalb von 2–3 Werktagen eine erste Rückmeldung.</p><p style="margin:0;">Falls Sie weitere Unterlagen oder Informationen bereitstellen möchten, können Sie diese jederzeit über Ihr Kundenkonto hinzufügen.</p>',
        ctaLabel: 'Reklamation einsehen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir nehmen Ihr Feedback ernst und arbeiten daran, Ihnen eine zufriedenstellende Lösung zu bieten.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den Eingang Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintCategory', 'Kategorie der Reklamation'),
        createVariable('complaintSubject', 'Betreff der Reklamation'),
        createVariable('orderNumber', 'Referenzierter Auftrag'),
        createVariable('priority', 'Priorität der Bearbeitung'),
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
        intro: 'Hallo {{customerName}}, wir möchten Ihnen mitteilen, dass wir mit der Bearbeitung Ihrer Reklamation begonnen haben. Unser Team prüft Ihren Fall mit höchster Sorgfalt.',
        highlights: [
          { label: 'Status', value: 'In Bearbeitung' },
          { label: 'Zuständig', value: '{{handlerName}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Bearbeitung gestartet', value: '{{processingStartedAt}}' },
          { label: 'Voraussichtliche Bearbeitung bis', value: '{{estimatedResolutionDate}}' },
          { label: 'Zuständiger Mitarbeiter', value: '{{handlerName}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Während der Prüfungsphase können weitere Informationen oder Unterlagen angefordert werden. Bitte halten Sie Ihre Auftragsdaten und relevante Belege griffbereit.</p><p style="margin:0;">Sobald eine Entscheidung oder ein Zwischenergebnis vorliegt, werden Sie automatisch benachrichtigt.</p>',
        ctaLabel: 'Reklamationsstatus verfolgen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir setzen alles daran, Ihr Anliegen fair und schnell zu loesen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Benachrichtigung informiert Sie über den Bearbeitungsstart Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('handlerName', 'Name des zuständigen Mitarbeiters'),
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
        intro: 'Hallo {{customerName}}, zu Ihrer Reklamation gibt es eine neue Nachricht von unserem Team. Bitte melden Sie sich an, um die vollständige Mitteilung zu lesen.',
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
        body: '<p style="margin:0 0 16px 0;">Bitte lesen Sie die Mitteilung und antworten Sie gegebenenfalls über Ihr Kundenkonto. Eine zeitnahe Reaktion hilft uns, Ihr Anliegen zügig abzuschließen.</p><p style="margin:0;">Sollte die Mitteilung eine Entscheidung oder Genehmigung Ihrerseits erfordern, bitten wir um Ihre Rückmeldung innerhalb der angegebenen Frist.</p>',
        ctaLabel: 'Mitteilung lesen und antworten',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir danken Ihnen für Ihre Mitarbeit und freuen uns auf eine schnelle Klärung.<br /><strong>Ihr {{companyName}} Team</strong>',
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
      subject: 'Ihre Reklamation {{complaintNumber}} wurde gelöst',
      content: renderEmailTemplate({
        preheader: 'Ihre Reklamation wurde erfolgreich abgeschlossen.',
        eyebrow: 'Reklamation gelöst',
        title: 'Ihre Reklamation wurde erfolgreich gelöst',
        intro: 'Hallo {{customerName}}, wir freuen uns, Ihnen mitteilen zu können, dass Ihre Reklamation abgeschlossen und eine Lösung erarbeitet wurde. Wir hoffen, dass das Ergebnis Ihren Erwartungen entspricht.',
        highlights: [
          { label: 'Lösung', value: '{{resolutionSummary}}' },
          { label: 'Kompensation', value: '{{compensationInfo}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Lösung', value: '{{resolutionSummary}}' },
          { label: 'Abgeschlossen am', value: '{{resolvedAt}}' },
          { label: 'Kompensation / Erstattung', value: '{{compensationInfo}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Sollte die vereinbarte Lösung eine finanzielle Kompensation oder Erstattung beinhalten, wird diese in Kürze bearbeitet. Bitte prüfen Sie Ihre Daten im Kundenkonto auf Vollständigkeit.</p><p style="margin:0;">Falls Sie mit der Lösung nicht einverstanden sein sollten, kontaktieren Sie uns bitte innerhalb von 14 Tagen. Wir helfen Ihnen gerne weiter.</p>',
        ctaLabel: 'Abschluss bestätigen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir bedanken uns für Ihr Vertrauen und hoffen, Sie bald als zufriedenen Kunden zu begrüßen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht bestätigt den Abschluss Ihrer Reklamation.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('resolutionSummary', 'Zusammenfassung der erarbeiteten Lösung', true),
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
        preheader: 'Wir informieren Sie über die Entscheidung zu Ihrer Reklamation.',
        eyebrow: 'Reklamationsergebnis',
        title: 'Ergebnis zu Ihrer Reklamation liegt vor',
        intro: 'Hallo {{customerName}}, nach eingehender Prüfung Ihrer Reklamation möchten wir Ihnen das Ergebnis unserer Bewertung mitteilen.',
        highlights: [
          { label: 'Entscheidung', value: '{{decision}}' },
          { label: 'Begründung', value: '{{decisionReason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Reklamationsnummer', value: '{{complaintNumber}}' },
          { label: 'Kategorie', value: '{{complaintCategory}}' },
          { label: 'Entscheidung', value: '{{decision}}' },
          { label: 'Entschieden am', value: '{{decidedAt}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Unsere Entscheidung basiert auf einer sorgfältigen Prüfung aller Informationen und angefuehrten Unterlagen. Bitte lesen Sie die detaillierte Begründung in Ihrem Kundenkonto.</p><p style="margin:0;">Falls Sie Fragen zur Entscheidung haben oder einen Widerspruch einlegen möchten, können Sie sich innerhalb von 14 Tagen an unseren Support wenden.</p>',
        ctaLabel: 'Entscheidung einsehen',
        ctaUrl: '{{complaintUrl}}',
        closing: 'Wir stehen für weitere Fragen selbstverständlich gerne zur Verfügung.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht stellt die offizielle Entscheidung zu Ihrer Reklamation dar.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('complaintNumber', 'Reklamationsnummer', true),
        createVariable('complaintCategory', 'Kategorie der Reklamation'),
        createVariable('decision', 'Entscheidung (z.B. Abgelehnt / Teilweise anerkannt)', true),
        createVariable('decisionReason', 'Begründung der Entscheidung'),
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
        intro: 'Hallo {{customerName}}, wir erinnern Sie an Ihren bevorstehenden Termin bei {{companyName}}. Bitte halten Sie alle relevanten Unterlagen und Ihr Gerät bereit.',
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
        body: '<p style="margin:0 0 16px 0;">Bitte erscheinen Sie pünktlich zu Ihrem Termin. Falls Sie den Termin nicht einhalten können, bitten wir Sie, uns frühzeitig zu informieren, damit wir den Termin umplanen können.</p><p style="margin:0;">Halten Sie bitte Ihren Auftrag oder Ihre Buchungsnummer sowie ein Ausweisdokument bereit.</p>',
        ctaLabel: 'Termindetails einsehen',
        ctaUrl: '{{appointmentUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Erinnerung wurde automatisch für Ihren bevorstehenden Termin erstellt.'
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
      subject: 'Ihre Gerätegarantie bei {{companyName}} laeuft bald ab',
      content: renderEmailTemplate({
        preheader: 'Ihre Garantie für dieses Gerät laeuft in Kürze ab.',
        eyebrow: 'Garantiehinweis',
        title: 'Ihre Gerätegarantie laeuft demnächst ab',
        intro: 'Hallo {{customerName}}, wir möchten Sie darauf hinweisen, dass die Garantie für Ihr Gerät in Kürze auslaeuft. Nutzen Sie die verbleibende Zeit, um eventuelle Ansprueche geltend zu machen.',
        highlights: [
          { label: 'Garantie laeuft ab am', value: '{{warrantyExpiryDate}}' },
          { label: 'Restgarantie', value: '{{remainingWarrantyDays}} Tage', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Garantiebeginn', value: '{{warrantyStartDate}}' },
          { label: 'Garantieende', value: '{{warrantyExpiryDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Falls Sie an Ihrem Gerät einen Defekt oder eine Fehlfunktion feststellen, empfehlen wir Ihnen, dies noch vor Ablauf der Garantiefrist bei uns zu melden.</p><p style="margin:0;">Auch nach Ablauf der Garantie stehen wir Ihnen selbstverständlich mit unseren Reparaturleistungen zur Verfügung.</p>',
        ctaLabel: 'Garantieanspruch prüfen',
        ctaUrl: '{{warrantyUrl}}',
        closing: 'Wir kümmern uns auch weiterhin professionell um Ihre Geräte.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht ist eine automatische Garantieerinnerung.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('deviceBrand', 'Gerätemarke', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        preheader: 'Eine neue Rechnung für Ihren Auftrag wurde erstellt.',
        eyebrow: 'Rechnungsdokument',
        title: 'Ihre Rechnung ist verfügbar',
        intro: 'Hallo {{customerName}}, für Ihren Auftrag wurde eine Rechnung erstellt. Sie können das Dokument über den untenstehenden Link abrufen und herunterladen.',
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
        body: '<p style="margin:0 0 16px 0;">Bitte begleichen Sie den ausstehenden Betrag bis zum angegebenen Zahlungsziel. Für Fragen zur Rechnung steht Ihnen unser Team gerne zur Verfügung.</p><p style="margin:0;">Nach vollständigem Zahlungseingang erhalten Sie eine separate Zahlungsbestätigung.</p>',
        ctaLabel: 'Rechnung herunterladen',
        ctaUrl: '{{invoiceUrl}}',
        closing: 'Vielen Dank für Ihr Vertrauen in {{companyName}}.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht informiert Sie über eine neu ausgestellte Rechnung.'
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
        intro: 'Hallo {{customerName}}, wir möchten Ihnen eine wichtige Information mitteilen.',
        highlights: [
          { label: 'Betrifft', value: '{{notificationTopic}}' },
          { label: 'Gültig ab', value: '{{effectiveDate}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Betrifft', value: '{{notificationTopic}}' },
          { label: 'Datum', value: '{{notificationDate}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">{{notificationBody}}</p>',
        ctaLabel: '{{ctaLabel}}',
        ctaUrl: '{{ctaUrl}}',
        closing: 'Bei Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br /><strong>Ihr {{companyName}} Team</strong>',
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
      subject: 'Bitte holen Sie Ihr Gerät bei {{companyName}} ab – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Ihr Gerät wartet auf Sie – bitte holen Sie es zeitnah ab.',
        eyebrow: 'Abholung ausstehend',
        title: 'Ihr Gerät wartet noch auf Abholung',
        intro: 'Hallo {{customerName}}, Ihr Gerät steht bei uns noch zur Abholung bereit. Wir möchten Sie freundlich erinnern, damit es nicht in weitere Kosten auslaeuft.',
        highlights: [
          { label: 'Bereit seit', value: '{{readySince}}' },
          { label: 'Aufbewahrung bis', value: '{{holdUntil}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Abholtage & Zeiten', value: '{{pickupHours}}' },
          { label: 'Adresse', value: '{{workshopAddress}}' }
        ],
        body: '<p style="margin:0 0 16px 0;">Wir bewahren Ihr Gerät bis zum angegebenen Termin kostenlos für Sie auf. Sollten Sie das Gerät nicht persönlich abholen können, kontaktieren Sie uns bitte, um eine alternative Lösung zu vereinbaren.</p><p style="margin:0;">Bitte bringen Sie Ihren Abholcode oder die Auftragsnummer mit.</p>',
        ctaLabel: 'Abholdetails einsehen',
        ctaUrl: '{{trackingUrl}}',
        closing: 'Wir freuen uns auf Ihren Besuch.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Erinnerung wurde automatisch versendet, da Ihre Abholung noch aussteht.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätemarke'),
        createVariable('deviceModel', 'Gerätemodell'),
        createVariable('readySince', 'Zeitpunkt der Fertigstellung'),
        createVariable('holdUntil', 'Aufbewahrungsfrist'),
        createVariable('pickupHours', 'Öffnungszeiten'),
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
        title: 'Neue Benachrichtigung für Ihr Kundenkonto',
        intro: 'Hallo {{customerName}}, es gibt ein neues Update zu Ihrem Konto. Unten finden Sie die wichtigsten Informationen zur aktuellen Benachrichtigung sowie eine kompakte Übersicht aller relevanten Benachrichtigungstypen.',
        highlights: [
          { label: 'Kategorie', value: '{{notificationCategoryLabel}}' },
          { label: 'Erstellt am', value: '{{notificationCreatedAt}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Titel', value: '{{notificationTitle}}' },
          { label: 'Inhalt', value: '{{notificationMessage}}' },
          { label: 'Referenz', value: '{{notificationReference}}' },
          { label: 'Empfohlene Aktion', value: '{{notificationActionLabel}}' }
        ],
        extraTableRows: '{{notificationTypeSummary}}',
        body: '<p style="margin:0 0 16px 0;">Mit dieser E-Mail informieren wir Sie automatisch über jede neue Benachrichtigung. So bleiben Sie bei Aufträgen, Zahlungen, Nachrichten, Zuweisungen, Erinnerungen und Systemhinweisen stets auf dem neuesten Stand.</p><p style="margin:0;">Im Kundenkonto können Sie alle Eintraege im Detail ansehen und als gelesen markieren. <a href="{{notificationsUrl}}" style="color:#1a2a5e;font-weight:700;">Alle Benachrichtigungen ansehen</a></p>',
        ctaLabel: 'Direkt zur Benachrichtigung',
        ctaUrl: '{{notificationActionUrl}}',
        closing: 'Vielen Dank für Ihr Vertrauen. Wir halten Sie aktiv und transparent informiert.<br /><strong>Ihr {{companyName}} Team</strong>',
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
        createVariable('notificationActionLabel', 'Empfohlene Aktion für den Kunden'),
        createVariable('notificationTypeSummary', 'Vorgerenderte HTML-Tabellenzeile für die aktive Benachrichtigungskategorie'),
        createVariable('notificationsUrl', 'Vollständiger Link zur Benachrichtigungsseite (/notifications)', true),
        createVariable('notificationActionUrl', 'Vollständiger direkter Link zur auslösenden Ressource (Auftrag, Anfrage etc.) oder Benachrichtigungsseite', true),
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
      content: '{{companyName}}: Willkommen {{customerName}}! Bitte bestätigen Sie Ihre E-Mail unter {{verificationUrl}} Viel Erfolg!',
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
      content: '{{companyName}}: Auftrag {{orderNumber}} für {{deviceBrand}} {{deviceModel}} eingegangen. Status: {{trackingUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
      subject: 'Gerät eingegangen',
      content: '{{companyName}}: Ihr {{deviceBrand}} {{deviceModel}} ist eingegangen. Auftrag: {{orderNumber}}. Ihr Team',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('quoteAmount', 'Kostenvoranschlag', true),
        createVariable('approvalUrl', 'Short-Link zur Freigabe', true),
        createVariable('approvalDeadline', 'Frist für Genehmigung', true)
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('trackingUrl', 'Versand-Tracking-Link', true)
      ],
      isActive: true
    },
    {
      name: 'Zahlungsbestaetigung SMS',
      type: 'sms',
      subject: 'Zahlung erhalten',
      content: '{{companyName}}: Zahlung von {{amountPaid}} für Auftrag {{orderNumber}} eingegangen. Rechnung: {{invoiceNumber}}',
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
      subject: 'Passwort zurücksetzen',
      content: '{{companyName}}: Passwort-Reset für {{customerEmail}}: {{passwordResetUrl}} Gültig {{resetExpiresAt}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerEmail', 'E-Mail des Kunden', true),
        createVariable('passwordResetUrl', 'Short-Link zum Reset', true),
        createVariable('resetExpiresAt', 'Gültigkeitsdauer des Links', true)
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
      content: '{{companyName}}: Ihre Buchung {{bookingNumber}} ist abholbereit. Öffnungszeiten: {{pickupHours}}',
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
      content: '{{companyName}}: Reparaturanfrage {{requestNumber}} für {{deviceBrand}} {{deviceModel}} eingegangen. Status: {{requestUrl}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
      content: '{{companyName}}: Gerät {{deviceBrand}} {{deviceModel}} wartet auf Abholung. Abholbar bis: {{holdUntil}}',
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('resetExpiresAt', 'Gültigkeitsdauer', true)
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
      content: 'Reparaturanfrage #{{requestNumber}} für {{deviceBrand}} {{deviceModel}} eingegangen.',
      variables: [
        createVariable('requestNumber', 'Anfragenummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
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
    },
    {
      name: 'Kontaktformular Bestaetigung an Absender',
      type: 'email',
      subject: 'Wir haben Ihre Anfrage erhalten - {{companyName}}',
      content: renderEmailTemplate({
        preheader: 'Ihre Kontaktanfrage wurde erfolgreich übermittelt.',
        eyebrow: 'Kontakt & Service',
        title: 'Danke für Ihre Nachricht',
        intro: 'Hallo {{customerName}}, wir haben Ihre Anfrage erhalten und an unser Service-Team weitergeleitet. Sie erhalten in der Regel innerhalb eines Werktages eine persönliche Rückmeldung.',
        highlights: [
          { label: 'Anliegen', value: '{{contactSubject}}' },
          { label: 'Eingang', value: '{{submittedAt}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Absender', value: '{{customerName}}' },
          { label: 'E-Mail', value: '{{customerEmail}}' },
          { label: 'Anliegen', value: '{{contactSubject}}' }
        ],
        body: '<p style="margin:0 0 14px 0;">Zur schnellen Einordnung haben wir folgenden Auszug Ihrer Nachricht gespeichert:</p><div style="padding:14px 16px;border:1px solid #d8dce6;background:#f8f9fc;border-radius:12px;font-size:14px;line-height:1.7;color:#2d3748;">{{messagePreview}}</div><p style="margin:16px 0 0 0;">Falls Sie weitere Informationen nachreichen möchten, antworten Sie einfach auf diese E-Mail.</p>',
        ctaLabel: 'Kontaktseite aufrufen',
        ctaUrl: '{{contactUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihr Vertrauen in {{companyName}}.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Dies ist eine automatische Eingangsbestätigung auf Ihre Kontaktanfrage.'
      }),
      variables: [
        createVariable('companyName', 'Name des Unternehmens', true),
        createVariable('customerName', 'Vor- und Nachname des Absenders', true),
        createVariable('customerEmail', 'E-Mail-Adresse des Absenders', true),
        createVariable('contactSubject', 'Kategorie der Anfrage', true),
        createVariable('submittedAt', 'Zeitpunkt der Anfrage', true),
        createVariable('messagePreview', 'Kurzvorschau der Anfrage', true),
        createVariable('contactUrl', 'Link zur Kontaktseite', true),
        createVariable('supportEmail', 'Service-E-Mail-Adresse', true),
        createVariable('supportPhone', 'Service-Telefonnummer')
      ],
      isActive: true
    },
    {
      name: 'Defektes Bauteil gemeldet',
      type: 'email',
      subject: 'Zwischenfall bei Reparatur: Defektes Bauteil – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Während der Reparatur wurde ein defektes Bauteil entdeckt.',
        eyebrow: 'Reparaturupdate',
        title: 'Defektes Bauteil entdeckt',
        intro: 'Hallo {{customerName}}, während der Reparatur Ihres {{deviceBrand}} {{deviceModel}} wurde ein defektes Bauteil entdeckt. Dies führt zu einer Verzögerung in der Reparatur.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Problem', value: '{{reason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Fehlerbeschreibung', value: '{{reason}}' },
          { label: 'Techniker', value: '{{technicianName}}' }
        ],
        body: '<p style="margin:0;">Wir werden Kontakt mit Ihnen aufnehmen, um die nächsten Schritte zu besprechen. Üblicherweise bestellen wir das erforderliche Bauteil, was einige zusätzliche Tage in Anspruch nehmen kann.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihre Geduld und Vertrauen in {{companyName}}.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('reason', 'Begründung / Fehlerbeschreibung', true),
        createVariable('technicianName', 'Name des Technikers', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    },
    {
      name: 'Ersatzteil benötigt',
      type: 'email',
      subject: 'Reparaturupdate: Ersatzteil erforderlich – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Für die Reparatur wird ein Ersatzteil benötigt.',
        eyebrow: 'Reparaturupdate',
        title: 'Ersatzteil wird benötigt',
        intro: 'Hallo {{customerName}}, für die Reparatur Ihres {{deviceBrand}} {{deviceModel}} wird ein Ersatzteil benötigt. Wir kümmern uns um die Beschaffung.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Erforderliches Teil', value: '{{reason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Beschreibung des Teils', value: '{{reason}}' },
          { label: 'Techniker', value: '{{technicianName}}' }
        ],
        body: '<p style="margin:0;">Das Ersatzteil wird in der Regel innerhalb von 2-5 Werktagen verfügbar sein. Wir werden Sie informieren, sobald die Reparatur fortgesetzt werden kann.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihre Geduld und Vertrauen in {{companyName}}.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('reason', 'Beschreibung des benötigten Teils', true),
        createVariable('technicianName', 'Name des Technikers', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    },
    {
      name: 'Info von Kunde benötigt',
      type: 'email',
      subject: 'Wir benötigen Ihre Hilfe – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Für die Reparatur benötigen wir zusätzliche Informationen von Ihnen.',
        eyebrow: 'Reparaturupdate',
        title: 'Zusätzliche Informationen benötigt',
        intro: 'Hallo {{customerName}}, um die Reparatur Ihres {{deviceBrand}} {{deviceModel}} fortzuführen, benötigen wir noch einige Informationen von Ihnen.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Benötigte Information', value: '{{reason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Anforderung', value: '{{reason}}' },
          { label: 'Techniker', value: '{{technicianName}}' }
        ],
        body: '<p style="margin:0;">Bitte nehmen Sie Kontakt mit uns auf oder antworten Sie auf diese E-Mail mit den erforderlichen Informationen. Damit können wir die Reparatur schnellstmöglich abschließen.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihre Zusammenarbeit.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('reason', 'Beschreibung der benötigten Information', true),
        createVariable('technicianName', 'Name des Technikers', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    },
    {
      name: 'Zusätzliche Reparatur notwendig',
      type: 'email',
      subject: 'Zusätzliche Reparatur erforderlich – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Während der Diagnostik wurde ein zusätzliches Problem gefunden.',
        eyebrow: 'Reparaturupdate',
        title: 'Zusätzliche Reparatur erforderlich',
        intro: 'Hallo {{customerName}}, während der Reparatur Ihres {{deviceBrand}} {{deviceModel}} wurde ein zusätzliches Problem identifiziert, das ebenfalls behoben werden sollte.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Zusätzliche Reparatur', value: '{{reason}}', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Problem', value: '{{reason}}' },
          { label: 'Geschätzte Dauer', value: '{{timeMinutes}} Minuten' },
          { label: 'Zusätzliche Kosten', value: '{{priceEur}} EUR' }
        ],
        body: '<p style="margin:0;">Bitte teilen Sie uns mit, ob Sie die zusätzliche Reparatur durchführen lassen möchten. Wir warten auf Ihre Bestätigung.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihre Aufmerksamkeit.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('reason', 'Beschreibung der zusätzlichen Reparatur', true),
        createVariable('timeMinutes', 'Geschätzte Reparaturdauer in Minuten', true),
        createVariable('priceEur', 'Zusätzliche Kosten in EUR', true),
        createVariable('technicianName', 'Name des Technikers', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    },
    {
      name: 'Übergabe an anderen Techniker',
      type: 'email',
      subject: 'Reparaturstatus Update – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Ihre Reparatur wurde an einen anderen Techniker übergeben.',
        eyebrow: 'Reparaturupdate',
        title: 'Reparatur in neuen Händen',
        intro: 'Hallo {{customerName}}, um die Reparatur Ihres {{deviceBrand}} {{deviceModel}} zu optimieren, haben wir diese an einen anderen qualifizierten Techniker übergeben.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Neuer Techniker', value: '{{technicianName}}' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Zuständiger Techniker', value: '{{technicianName}}' }
        ],
        body: '<p style="margin:0;">Die Reparatur wird ohne Verzögerung fortgesetzt. Sie erhalten weitere Updates von unserem Team.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihr Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('technicianName', 'Name des neuen Technikers', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    },
    {
      name: 'Reparatur braucht Zeit',
      type: 'email',
      subject: 'Reparaturstatus Update – Auftrag {{orderNumber}}',
      content: renderEmailTemplate({
        preheader: 'Die Reparatur benötigt mehr Zeit als ursprünglich geplant.',
        eyebrow: 'Reparaturupdate',
        title: 'Reparatur dauert länger',
        intro: 'Hallo {{customerName}}, die Reparatur Ihres {{deviceBrand}} {{deviceModel}} benötigt leider mehr Zeit als ursprünglich geschätzt.',
        highlights: [
          { label: 'Auftragsnummer', value: '{{orderNumber}}' },
          { label: 'Zusätzliche Zeit', value: '{{timeHours}} Stunden', tone: 'yellow' }
        ],
        detailRows: [
          { label: 'Gerät', value: '{{deviceBrand}} {{deviceModel}}' },
          { label: 'Geschätzte zusätzliche Dauer', value: '{{timeHours}} Stunden' }
        ],
        body: '<p style="margin:0;">Dies ist nicht ungewöhnlich bei komplexeren Reparaturen. Wir arbeiten sorgfältig, um Ihrem Gerät zu optimaler Funktionalität zurückzuverhelfen. Sie erhalten baldmöglich ein weiteres Update.</p>',
        ctaLabel: 'Auftrag überprüfen',
        ctaUrl: '{{orderUrl}}',
        ctaTone: 'primary',
        closing: 'Vielen Dank für Ihre Geduld und Vertrauen.<br /><strong>Ihr {{companyName}} Team</strong>',
        footerNote: 'Diese Nachricht wurde von unserem Reparaturteam generiert.'
      }),
      variables: [
        createVariable('customerName', 'Name des Kunden', true),
        createVariable('orderNumber', 'Auftragsnummer', true),
        createVariable('deviceBrand', 'Gerätehersteller', true),
        createVariable('deviceModel', 'Gerätemodell', true),
        createVariable('timeHours', 'Zusätzliche Reparaturdauer in Stunden', true),
        createVariable('orderUrl', 'Link zum Auftrag', true)
      ],
      isActive: true
    }
  ];
}

module.exports = {
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
  getDefaultNotificationTemplates
};