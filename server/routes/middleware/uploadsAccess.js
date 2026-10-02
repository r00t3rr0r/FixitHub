const path = require('path');
const express = require('express');

/**
 * Auslieferung von /uploads mit geschuetzten Unterordnern (K04).
 *
 * Ein Praefix-Mount wie app.use('/uploads/reports', requireStaff) reicht NICHT: express.static
 * dekodiert und normalisiert den Pfad selbst, sodass /uploads//reports/x.pdf,
 * /uploads/%72eports/x.pdf, /uploads/./reports/x.pdf, /uploads/a/../reports/x.pdf oder
 * /uploads/reports%2fx.pdf dieselbe Datei ohne Anmeldung liefern wuerden.
 *
 * Deshalb wird hier das Ziel GENAU so aufgeloest wie von express.static/send
 * (decodeURIComponent -> normalize('.' + sep + p) -> join(root, ...)) und anhand der
 * tatsaechlichen Datei entschieden, ob sie in einem geschuetzten Ordner liegt.
 */
function resolveUploadTarget(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(requestPath || '/'));
  } catch (error) {
    return null; // send antwortet hier ohnehin mit 400
  }
  if (decoded.includes('\0')) return null;
  const relative = path.normalize(`.${path.sep}${decoded}`);
  return path.normalize(path.join(root, relative));
}

function isInsideDirectory(target, directory) {
  // Vergleich ohne Gross-/Kleinschreibung: auf Dateisystemen ohne Unterscheidung
  // (macOS/Windows) waere /uploads/REPORTS/... sonst ein weiterer Umweg.
  const t = target.toLowerCase();
  const d = directory.toLowerCase();
  return t === d || t.startsWith(d + path.sep);
}

/**
 * Middleware, die Anfragen auf Dateien in einem der geschuetzten Unterordner durch
 * `guard` (z. B. requireStaff) schickt; alles andere geht unveraendert weiter.
 * Nicht dekodierbare Pfade werden mit 400 abgewiesen (wie von send).
 */
function protectUploadSubdirectories(root, protectedSubdirectories, guard) {
  const resolvedRoot = path.resolve(root);
  const protectedDirs = (protectedSubdirectories || []).map((dir) => path.resolve(resolvedRoot, dir));
  const guards = (Array.isArray(guard) ? guard : [guard]).filter(Boolean);

  return function uploadsAccessGuard(req, res, next) {
    const target = resolveUploadTarget(resolvedRoot, req.path);
    if (target === null) {
      return res.status(400).json({ success: false, error: 'Ungültiger Dateipfad.' });
    }
    if (!protectedDirs.some((dir) => isInsideDirectory(target, dir))) return next();

    let index = 0;
    const runNext = (error) => {
      if (error) return next(error);
      const current = guards[index++];
      if (!current) return next();
      try {
        return current(req, res, runNext);
      } catch (guardError) {
        return next(guardError);
      }
    };
    return runNext();
  };
}

/**
 * Komplette Auslieferung fuer app.use('/uploads', ...): Zugriffspruefung + express.static.
 * Nur fuer angemeldetes Personal:
 *   reports  - Pruefberichte (Kundenname, E-Mail, Telefon, interne Notiz)
 *   invoices - Lieferantenrechnungen der Ersatzteilbestellungen (Download ueber GET /api/epart-orders/:id/invoice)
 *   chat     - Anhaenge des internen Team-Chats
 *   messages - Anhaenge des alten Nachrichtensystems (Conversation/Message, ohne Oberflaeche)
 *   csv      - hochgeladene Importdateien
 * Oeffentlich bleiben bewusst: device-images (Katalogbilder) und avatars.
 */
const STAFF_ONLY_UPLOAD_DIRS = ['reports', 'invoices', 'chat', 'messages', 'csv'];
function serveUploads(root, { staffOnly = STAFF_ONLY_UPLOAD_DIRS, guard } = {}) {
  const staffGuard = guard || require('./auth').requireStaff;
  return [
    protectUploadSubdirectories(root, staffOnly, staffGuard),
    express.static(root),
  ];
}

module.exports = { serveUploads, protectUploadSubdirectories, resolveUploadTarget, STAFF_ONLY_UPLOAD_DIRS };
