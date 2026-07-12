const EmailService = require('./emailService');
const ContactMessageService = require('./contactMessageService');

const SUBJECT_LABELS = {
  repair: 'Reparaturanfrage',
  status: 'Statusanfrage',
  business: 'Geschaeftliche Anfrage',
  complaint: 'Reklamation',
  other: 'Allgemeine Anfrage',
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

class ContactService {
  static async submitInquiry(data) {
    // Save to database asynchronously (don't block)
    ContactMessageService.saveContactMessage(data).catch(err => {
      console.error('ContactService: Failed to save message to database:', err);
    });
    const transporter = await EmailService.getTransporter();
    const subjectLabel = SUBJECT_LABELS[data.subject] || SUBJECT_LABELS.other;
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || 'support@mcrepair.de';
    const submittedAt = new Date().toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const details = [
      ['Anliegen', subjectLabel],
      ['Name', data.name],
      ['E-Mail', data.email],
      ['Telefon', data.phone || 'Nicht angegeben'],
      ['Auftrags-/Buchungsnummer', data.orderNumber || 'Nicht angegeben'],
      ['Eingang', submittedAt],
      ['Client-IP', data.ipAddress || 'Nicht ermittelt'],
      ['User-Agent', data.userAgent || 'Nicht ermittelt'],
    ];

    const rows = details
      .map(([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1a2a5e;width:220px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#334155;">${escapeHtml(value)}</td>
        </tr>
      `)
      .join('');

    const escapedMessage = escapeHtml(data.message).replace(/\n/g, '<br />');
    const textDetails = details.map(([label, value]) => `${label}: ${value}`).join('\n');

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@mcrepair.de',
      to: supportEmail,
      replyTo: data.email,
      subject: `[Kontaktformular] ${subjectLabel} - ${data.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);">
            <div style="background:linear-gradient(135deg,#1a2a5e 0%,#2f57b0 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">McRepair.de Kontaktformular</div>
              <h1 style="margin:10px 0 6px;font-size:28px;line-height:1.2;">Neue Kontaktanfrage</h1>
              <p style="margin:0;font-size:15px;opacity:0.88;">Eine neue Anfrage wurde ueber die oeffentliche Kontaktseite eingereicht.</p>
            </div>
            <div style="padding:28px 32px;">
              <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;">
                <tbody>${rows}</tbody>
              </table>
              <div style="margin-top:24px;padding:20px 22px;border-radius:16px;background:#f8fafc;border:1px solid #e5e7eb;">
                <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Nachricht</div>
                <div style="font-size:15px;line-height:1.7;color:#0f172a;">${escapedMessage}</div>
              </div>
            </div>
          </div>
        </div>
      `,
      text: `Neue Kontaktanfrage\n\n${textDetails}\n\nNachricht:\n${data.message}`,
    };

    const result = await transporter.sendMail(mailOptions);

    // Sender confirmation should not block successful form intake.
    try {
      await EmailService.sendContactFormConfirmationEmail(data.email, {
        name: data.name,
        subject: data.subject,
        message: data.message,
        submittedAt,
      });
    } catch (confirmationError) {
      console.error('ContactService: Confirmation email could not be sent:', confirmationError.message);
    }

    return {
      messageId: result.messageId,
      recipient: supportEmail,
    };
  }
}

module.exports = ContactService;