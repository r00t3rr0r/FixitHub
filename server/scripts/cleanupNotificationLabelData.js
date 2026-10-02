#!/usr/bin/env node

/**
 * Bereinigt Benachrichtigungen und Reklamationsprotokolle, in die frueher das komplette
 * Versandlabel-PDF (base64-Data-URI) kopiert wurde (Befund K05 / NOTIF-1):
 *   - Notification.message enthielt "Versandlabel: data:application/pdf;base64,..."
 *   - Notification.metadata.shippingLabelUrl enthielt das PDF
 *   - Complaint.complaintLogs[].metadata.shippingLabelUrl enthielt das PDF
 *
 * Die Oberflaeche ist auch OHNE dieses Skript sicher: NotificationService bereinigt beim Lesen
 * (sanitizeNotificationForClient) und Complaint.toJSON entfernt die PDF-Daten aus jeder Antwort.
 * Das Skript verkleinert nur die gespeicherten Datensaetze.
 *
 * Was NICHT geaendert wird:
 *   - Complaint.shippingLabelUrl (das PDF am Datensatz bleibt die Quelle fuer den Download
 *     GET /api/complaints/:id/shipping-label, falls am Reklamationsauftrag keines liegt)
 *   - Order.returnLabelUrl
 *
 * Umschreibung je Benachrichtigung:
 *   message  -> kurzer deutscher Text (NotificationService.buildComplaintApprovedMessage bei
 *               'admin_approved', sonst der Text ohne eingebettete Daten)
 *   metadata -> Data-URI-Werte entfernt; bei Reklamationsgenehmigung metadata.document
 *               (strukturierte Label-Referenz) und actionUrl '/my-complaints/<id>'
 * Umschreibung je Reklamationsprotokoll-Eintrag:
 *   metadata.shippingLabelUrl (data:) -> entfernt, metadata.shippingLabelStored = true
 *
 * Idempotent: ein zweiter Lauf findet nichts mehr.
 * Sicherung/Rollback: vor dem Schreiben werden die betroffenen Originaldokumente als JSON in
 * eine Sicherungsdatei geschrieben (Standard: Systemtemp-Verzeichnis, Pfad wird ausgegeben;
 * anderer Ort mit --backup-dir=<pfad>). Rollback: Dokumente per _id aus der Datei
 * zuruckschreiben (replaceOne je Dokument).
 *
 * Aufruf:
 *   node server/scripts/cleanupNotificationLabelData.js            # Dry-Run (Standard, schreibt nichts)
 *   node server/scripts/cleanupNotificationLabelData.js --confirm  # schreibt (mit Sicherung)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const DATA_URI_REGEX = /data:[\w.+\/-]+;base64,/;

function loadModels() {
  const Notification = require('../models/Notification');
  const Complaint = require('../models/Complaint');
  const NotificationService = require('../services/notificationService');
  return { Notification, Complaint, NotificationService };
}

function isDataUri(value) {
  return typeof value === 'string' && /^data:/i.test(value.trim());
}

function buildNotificationUpdate(notification, NotificationService) {
  const metadata = notification.metadata && typeof notification.metadata === 'object' ? { ...notification.metadata } : {};
  const removedKeys = [];
  Object.keys(metadata).forEach((key) => {
    if (isDataUri(metadata[key])) {
      removedKeys.push(key);
      delete metadata[key];
    }
  });

  const isComplaintApproval = String(metadata.event || '') === 'admin_approved' && metadata.complaintId;
  const set = {};
  const unset = {};
  removedKeys.forEach((key) => { unset[`metadata.${key}`] = ''; });

  if (DATA_URI_REGEX.test(String(notification.message || ''))) {
    set.message = isComplaintApproval
      ? NotificationService.buildComplaintApprovedMessage({
          complaintNumber: metadata.complaintNumber,
          complaintOrderNumber: metadata.complaintOrderNumber,
        })
      : (NotificationService.stripEmbeddedData(String(notification.message).replace(/Versandlabel:\s*/gi, '')) || 'Es liegt ein neues Update vor.');
  }
  if (isComplaintApproval) {
    if (!metadata.document) {
      set['metadata.document'] = NotificationService.buildComplaintShippingLabelDocument({
        complaintId: metadata.complaintId,
        complaintNumber: metadata.complaintNumber,
        trackingNumber: metadata.trackingNumber,
      });
    }
    const desiredUrl = `/my-complaints/${metadata.complaintId}`;
    if (!notification.actionUrl || notification.actionUrl === '/my-complaints') {
      set.actionUrl = desiredUrl;
    }
  }

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  return update;
}

async function runCleanup({ confirm = false, backupDir = os.tmpdir(), log = console.log } = {}) {
  const { Notification, Complaint, NotificationService } = loadModels();

  const notificationFilter = {
    $or: [
      { message: { $regex: 'data:[A-Za-z0-9.+/-]+;base64,' } },
      { 'metadata.shippingLabelUrl': { $regex: '^data:' } },
    ],
  };
  const complaintFilter = { 'complaintLogs.metadata.shippingLabelUrl': { $regex: '^data:' } };

  const notifications = await Notification.find(notificationFilter).lean();
  const complaints = await Complaint.find(complaintFilter).setOptions({ skipAutoPopulate: true }).lean();

  const report = {
    mode: confirm ? 'confirm' : 'dry-run',
    notificationsMatched: notifications.length,
    complaintsMatched: complaints.length,
    complaintLogEntriesMatched: complaints.reduce((sum, complaint) => sum + (complaint.complaintLogs || [])
      .filter((entry) => isDataUri(entry?.metadata?.shippingLabelUrl)).length, 0),
    bytesInNotificationMessages: notifications.reduce((sum, n) => sum + String(n.message || '').length, 0),
    notificationsUpdated: 0,
    complaintsUpdated: 0,
    backupFile: null,
  };

  log(`[cleanupNotificationLabelData] Modus: ${report.mode}`);
  log(`  Benachrichtigungen mit eingebetteten Labeldaten: ${report.notificationsMatched} (Textlaenge gesamt ${report.bytesInNotificationMessages} Zeichen)`);
  notifications.slice(0, 50).forEach((n) => {
    log(`   - ${n._id} Empfaenger ${n.userId} "${String(n.title || '').slice(0, 60)}" Text ${String(n.message || '').length} Zeichen, Metadaten: ${Object.keys(n.metadata || {}).join(', ')}`);
  });
  log(`  Reklamationen mit Label-PDF im Protokoll: ${report.complaintsMatched} (Eintraege: ${report.complaintLogEntriesMatched})`);

  if (!confirm) {
    log('  Dry-Run: es wurde nichts geschrieben. Mit --confirm ausfuehren, um zu bereinigen.');
    return report;
  }
  if (!notifications.length && !complaints.length) {
    log('  Nichts zu tun.');
    return report;
  }

  const backupFile = path.join(backupDir, `notification-label-cleanup-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ createdAt: new Date().toISOString(), notifications, complaints }, null, 2), 'utf8');
  report.backupFile = backupFile;
  log(`  Sicherung geschrieben: ${backupFile}`);

  for (const notification of notifications) {
    const update = buildNotificationUpdate(notification, NotificationService);
    if (!update.$set && !update.$unset) continue;
    const result = await Notification.updateOne({ _id: notification._id }, update);
    report.notificationsUpdated += result.modifiedCount || 0;
  }

  for (const complaint of complaints) {
    let changed = false;
    const logs = (complaint.complaintLogs || []).map((entry) => {
      if (!entry || !isDataUri(entry.metadata?.shippingLabelUrl)) return entry;
      changed = true;
      const metadata = { ...entry.metadata };
      delete metadata.shippingLabelUrl;
      metadata.shippingLabelStored = true;
      return { ...entry, metadata };
    });
    if (!changed) continue;
    const result = await Complaint.updateOne({ _id: complaint._id }, { $set: { complaintLogs: logs } });
    report.complaintsUpdated += result.modifiedCount || 0;
  }

  log(`  Aktualisiert: ${report.notificationsUpdated} Benachrichtigungen, ${report.complaintsUpdated} Reklamationen.`);
  return report;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const mongoose = require('mongoose');
  const confirm = process.argv.includes('--confirm');
  const backupArg = process.argv.find((arg) => arg.startsWith('--backup-dir='));
  const backupDir = backupArg ? backupArg.slice('--backup-dir='.length) : os.tmpdir();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  await mongoose.connect(process.env.DATABASE_URL);
  try {
    await runCleanup({ confirm, backupDir });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[cleanupNotificationLabelData] Fehler:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { runCleanup, buildNotificationUpdate };
