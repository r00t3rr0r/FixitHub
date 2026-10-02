// Test-Postfach fuer den lokalen E2E-Server (NUR per NODE_OPTIONS --require geladen, kein Produktivcode).
// nodemailer streamTransport puffert jede Nachricht; dieser Hook legt sie zusaetzlich als .eml in
// MAIL_CAPTURE_DIR ab, damit Inhalt, Empfaenger und Links geprueft werden koennen. Es verlaesst
// keine Nachricht den Rechner (streamTransport sendet nichts; netguard blockiert alles Externe).
const fs = require('fs');
const path = require('path');
const DIR = process.env.MAIL_CAPTURE_DIR;
if (DIR) {
  fs.mkdirSync(DIR, { recursive: true });
  const nodemailer = require('/home/adar/Projects/FixitHub/server/node_modules/nodemailer');
  const original = nodemailer.createTransport;
  let seq = 0;
  nodemailer.createTransport = function patched(options, defaults) {
    const transporter = original.call(this, options, defaults);
    if (options && options.streamTransport) {
      const send = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (mail, cb) => {
        const info = await send(mail);
        try {
          seq += 1;
          const to = String(mail.to || 'unbekannt').replace(/[^a-z0-9@._-]/gi, '_').slice(0, 60);
          const file = path.join(DIR, `${Date.now()}-${String(seq).padStart(4, '0')}-${to}.eml`);
          fs.writeFileSync(file, info.message);
        } catch (e) { /* Erfassung darf den Versandpfad nicht stoeren */ }
        if (typeof cb === 'function') { cb(null, info); return undefined; }
        return info;
      };
    }
    return transporter;
  };
}
