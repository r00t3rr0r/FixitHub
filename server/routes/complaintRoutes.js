const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireUser, requireAdmin, requireRole } = require('./middleware/auth');
const ComplaintService = require('../services/complaintService');
const OrderService = require('../services/orderService');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const EmailService = require('../services/emailService');
const InspectionCommunicationService = require('../services/inspectionCommunicationService');
const FinancialService = require('../services/financialService');
const DHLService = require('../services/dhlService');
const OrderRevisionService = require('../services/orderRevisionService');

const ADMIN_NOTIFICATION_TYPE = 'system';
const Invoice = require('../models/Invoice');

// Servicepauschale fuer eine abgelehnte Reklamation, wenn an der Reklamation selbst
// keine hinterlegt ist. Der Betrag kommt NIE vom Kunden (Request-Body).
const DEFAULT_COMPLAINT_SERVICE_FEE = 39;

function formatEuroDe(value) {
  return `${Number(Number(value) || 0).toFixed(2).replace('.', ',')} €`;
}

/**
 * Legt fest, was der Reklamationsauftrag nach der Entscheidung des Kunden kostet: seine
 * Positionen werden durch GENAU die abzurechnende Leistung ersetzt (angenommenes
 * Angebot bzw. Servicepauschale), der Auftragswert wird mit DER Preisregel des
 * Auftrags daraus gebildet (ohne Rabatt - Angebot und Pauschale sind Endbetraege).
 *
 * Warum ersetzen statt aufaddieren: der Reklamationsauftrag ist bei der Freigabe eine
 * KOPIE des Originalauftrags (buildComplaintOrderPayload) - inklusive dessen Positionen
 * und Auftragswert, die bereits mit dem Originalauftrag berechnet wurden. Frueher wurde
 * totalCost direkt ueberschrieben bzw. erhoeht; Positionen und Wert passten dann nicht
 * mehr zusammen, und die naechste Positionsbearbeitung hat Angebot/Pauschale still
 * verworfen. Jetzt ist die Leistung eine Position und ueberlebt jede Bearbeitung.
 *
 * Konfliktsicher ueber OrderService.runGuardedOrderEdit; schreibt einen Historieneintrag.
 */
async function setComplaintOrderBillablePositions(orderId, { services = [], addOns = [], applyExtra, action, actor }) {
  const { order, context } = await OrderService.runGuardedOrderEdit(orderId, async (freshOrder) => {
    const previousGross = Number(freshOrder.totalCost || 0);
    const replacedPositions = [
      ...(freshOrder.services || []).filter((line) => line && typeof line === 'object')
        .map((line) => `${line.name || 'Reparaturservice'} (${formatEuroDe(line.price)})`),
      ...(freshOrder.addOns || []).map((addOn) => `${addOn.name} (${formatEuroDe(addOn.price)})`),
      ...(freshOrder.shopProducts || []).map((product) => `Produkt x${product.quantity} (${formatEuroDe(product.priceAtOrder)})`),
    ];
    freshOrder.services = services;
    freshOrder.addOns = addOns;
    freshOrder.shopProducts = [];
    freshOrder.appliedPromoCode = '';
    OrderService.applyOrderPricing(freshOrder, {
      groupDiscountPercent: 0,
      promoDiscountAmount: 0,
      source: 'none',
      appliedAt: new Date(),
    });
    if (typeof applyExtra === 'function') applyExtra(freshOrder);
    return { previousGross, replacedPositions };
  });

  await OrderRevisionService.recordRevision(order, {
    triggerReason: 'manual_edit',
    previousGrossAmount: context.previousGross,
    changedBy: actor?._id || undefined,
    changedByName: actorName(actor),
    notes: [
      action,
      `Auftragswert ${formatEuroDe(context.previousGross)} → ${formatEuroDe(order.totalCost)}`,
      context.replacedPositions.length > 0
        ? `Ersetzte Positionen (aus dem Originalauftrag kopiert): ${context.replacedPositions.join(', ')}`
        : '',
    ].filter(Boolean).join(' | '),
  });

  return order;
}

/**
 * Fehlerantwort der Reklamationsrouten: Fehler mit statusCode (deutsche Meldung aus
 * ensureTransition, buildComplaintError, OrderService ...) und DHL-Fehler
 * (ShippingLabelError, deutsche Meldung mit status) werden durchgereicht; alles andere
 * (Mongo 'E11000 duplicate key ...', Verbindungsfehler, Programmfehler) erreicht die
 * Oberflaeche nur als deutsche Ersatzmeldung - der Rohtext steht im Log.
 */
function respondComplaintError(res, error, fallbackMessage, fallbackStatus = 500) {
  if (error && Number(error.statusCode)) {
    return res.status(Number(error.statusCode)).json({
      success: false,
      error: error.message,
      code: error.code || undefined,
      details: error.details || undefined,
    });
  }
  if (error && error.name === 'ShippingLabelError') {
    return res.status(Number(error.status) || 502).json({ success: false, error: error.message, code: error.code || undefined });
  }
  if (error && (error.name === 'ValidationError' || error.name === 'CastError')) {
    return res.status(400).json({ success: false, error: 'Die Eingaben zur Reklamation sind ungültig. Bitte prüfen Sie die Angaben.' });
  }
  return res.status(fallbackStatus).json({ success: false, error: fallbackMessage });
}

function buildComplaintError(message, statusCode = 400, code = 'COMPLAINT_INVALID') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value._id && value._id !== value) return toIdString(value._id);
  return String(value);
};

/**
 * Pauschale, die Personal/Admin ausdruecklich setzt. null, undefined und '' bedeuten
 * "nicht angegeben" (dann gilt die gespeicherte bzw. die Standardpauschale) - frueher
 * wurde daraus Number(null) = 0 und still eine 0,00-€-Rechnung. Negative oder nicht
 * numerische Werte werden abgelehnt. Kunden koennen den Betrag nie setzen.
 */
function parseStaffServiceFee(user, rawValue) {
  if (!['admin', 'staff'].includes(user?.role)) return { provided: false };
  if (rawValue === undefined || rawValue === null) return { provided: false };
  if (typeof rawValue === 'string' && rawValue.trim() === '') return { provided: false };
  const numeric = typeof rawValue === 'string' ? Number(rawValue.trim().replace(',', '.')) : Number(rawValue);
  if (typeof rawValue === 'boolean' || !Number.isFinite(numeric) || numeric < 0) {
    throw buildComplaintError('Die Servicepauschale muss eine Zahl größer oder gleich 0 sein.', 400, 'INVALID_SERVICE_FEE');
  }
  return { provided: true, value: Math.round(numeric * 100) / 100 };
}

// Bestehende (nicht stornierte) Rechnung des Reklamationsauftrags - eine Wiederholung
// der Ablehnung stellt keine zweite aus.
async function findComplaintOrderInvoice(complaintOrderId) {
  if (!complaintOrderId) return null;
  return Invoice.findOne({
    $or: [{ orderId: complaintOrderId }, { repairOrderIds: complaintOrderId }],
    isCreditNote: { $ne: true },
    status: { $ne: 'cancelled' },
  }).sort({ createdAt: 1 });
}

// Rechnung ueber die Servicepauschale einer abgelehnten Reklamation (Bruttoposition, kein
// Rabatt). EINE Stelle fuer den ersten Lauf und das kontrollierte Nachholen.
async function createComplaintFeeInvoice({ complaint, complaintOrderId, serviceFee }) {
  return FinancialService.createInvoice({
    orderId: complaintOrderId,
    customerId: getComplaintCustomerId(complaint),
    items: [{
      serviceName: 'Servicepauschale',
      description: `Servicepauschale für abgelehnte Reklamation ${complaint.complaintNumber || ''}`.trim(),
      quantity: 1,
      unitPrice: serviceFee,
      total: serviceFee,
      type: 'fee'
    }],
    discount: 0,
  });
}

// Nachholen einer fehlgeschlagenen Pauschalenrechnung: hoechstens EIN Lauf - OHNE Zeitablauf.
// Die Beanspruchung ist ein Protokolleintrag 'fee_invoice_retry' (metadata.finished: false),
// seine _id ist das Token des Laufs. Solange er offen ist, beansprucht KEIN weiterer Aufruf,
// auch nicht nach Minuten: eine langsame Rechnungserstellung kann noch laufen (mit der
// frueheren 2-Minuten-Sperre konnte eine zweite Wiederholung dann eine ZWEITE Rechnung
// erstellen). Jeder Lauf endet in einem Schreibvorgang, der das Token prueft
// (completeFeeInvoiceRetry / failFeeInvoiceRetry). Bricht der Prozess mitten im Lauf ab,
// bleibt die Beanspruchung stehen: es entsteht KEINE Rechnung auf Verdacht; das Personal
// prueft in der Finanzverwaltung und legt die Rechnung ggf. manuell an - die liefert dann
// jede Wiederholung (findComplaintOrderInvoice). Liefert { claimed, retryId }.
const FEE_INVOICE_RETRY_STALE_MS = 15 * 60 * 1000;
async function claimFeeInvoiceRetry(complaintId, actor) {
  const now = new Date();
  const retryId = new mongoose.Types.ObjectId();
  const claimed = await Complaint.findOneAndUpdate(
    {
      _id: complaintId,
      status: 'awaiting_payment',
      'repairOffer.status': 'rejected',
      complaintLogs: {
        $not: {
          $elemMatch: {
            action: 'fee_invoice_retry',
            'metadata.finished': { $ne: true },
          },
        },
      },
    },
    {
      $push: {
        complaintLogs: {
          _id: retryId,
          actorId: actor?._id,
          actorName: actorName(actor),
          actorRole: actor?.role || '',
          action: 'fee_invoice_retry',
          fromStatus: 'awaiting_payment',
          toStatus: 'awaiting_payment',
          notes: 'Rechnung über die Servicepauschale wird nachgeholt.',
          metadata: { finished: false },
          createdAt: now,
        },
      },
    },
    { new: true }
  ).setOptions({ skipAutoPopulate: true });
  return { claimed, retryId };
}

// Hinweis, wenn ein anderer Lauf die Rechnung gerade erstellt (oder ein frueherer Lauf nicht
// abgeschlossen wurde) - es wird nichts erstellt.
async function describeRunningFeeInvoiceRetry(complaintId) {
  const current = await Complaint.findById(complaintId).setOptions({ skipAutoPopulate: true }).select('complaintLogs').lean();
  const open = (current?.complaintLogs || []).find((entry) => entry && entry.action === 'fee_invoice_retry' && entry.metadata?.finished !== true);
  const startedAt = open?.createdAt ? new Date(open.createdAt).getTime() : Date.now();
  if (Date.now() - startedAt > FEE_INVOICE_RETRY_STALE_MS) {
    return 'Die Rechnung über die Servicepauschale wird gerade erstellt oder ein früherer Versuch wurde unterbrochen. '
      + 'Bitte in der Finanzverwaltung prüfen, ob die Rechnung vorliegt, und sie andernfalls manuell erstellen.';
  }
  return 'Die Rechnung über die Servicepauschale wird gerade erstellt. Bitte laden Sie die Seite in Kürze neu.';
}

// Erfolg: der Beanspruchungs-Eintrag (Token retryId) wird in EINEM Schreibvorgang zum
// Protokolleintrag der nachgeholten Rechnung - kein zweiter Eintrag.
async function completeFeeInvoiceRetry(complaintId, retryId, { actor, notes, metadata }) {
  try {
    const result = await Complaint.updateOne(
      { _id: complaintId },
      {
        $set: {
          'complaintLogs.$[retry].action': 'fee_invoice_created',
          'complaintLogs.$[retry].actorId': actor?._id,
          'complaintLogs.$[retry].actorName': actorName(actor),
          'complaintLogs.$[retry].actorRole': actor?.role || '',
          'complaintLogs.$[retry].notes': notes,
          'complaintLogs.$[retry].metadata': { finished: true, ...metadata },
          'complaintLogs.$[retry].createdAt': new Date(),
        },
      },
      { arrayFilters: [{ 'retry._id': retryId, 'retry.metadata.finished': { $ne: true } }] }
    );
    if (!result.modifiedCount) {
      console.error('ComplaintRoutes: fee invoice retry token no longer open - log entry not updated:', String(retryId));
    }
  } catch (finishError) {
    console.error('ComplaintRoutes: fee invoice retry could not be marked as finished:', finishError.message);
  }
}

// Freigeben: bereits vorhandene Rechnung (Token-Eintrag abschliessen) oder Fehlschlag.
// Fehlschlaege werden in EINEM Eintrag 'fee_invoice_retry_failed' gezaehlt (attempts), statt
// je Versuch einen neuen Protokolleintrag anzuhaengen; danach wird die Beanspruchung entfernt.
async function releaseFeeInvoiceRetry(complaintId, retryId, { failed = false, actor, result = {} } = {}) {
  try {
    if (failed) {
      const now = new Date();
      const counted = await Complaint.updateOne(
        { _id: complaintId, 'complaintLogs.action': 'fee_invoice_retry_failed' },
        {
          $inc: { 'complaintLogs.$.metadata.attempts': 1 },
          $set: {
            'complaintLogs.$.metadata.lastFailedAt': now,
            'complaintLogs.$.actorId': actor?._id,
            'complaintLogs.$.actorName': actorName(actor),
            'complaintLogs.$.actorRole': actor?.role || '',
          },
        }
      );
      if (!counted.matchedCount) {
        await Complaint.updateOne(
          { _id: complaintId },
          {
            $push: {
              complaintLogs: {
                actorId: actor?._id,
                actorName: actorName(actor),
                actorRole: actor?.role || '',
                action: 'fee_invoice_retry_failed',
                fromStatus: 'awaiting_payment',
                toStatus: 'awaiting_payment',
                notes: 'Rechnung über die Servicepauschale konnte nicht nachgeholt werden.',
                metadata: { attempts: 1, lastFailedAt: now },
                createdAt: now,
              },
            },
          }
        );
      }
      await Complaint.updateOne({ _id: complaintId }, { $pull: { complaintLogs: { _id: retryId } } });
      return;
    }
    await Complaint.updateOne(
      { _id: complaintId },
      { $set: { 'complaintLogs.$[retry].metadata': { finished: true, ...result } } },
      { arrayFilters: [{ 'retry._id': retryId }] }
    );
  } catch (finishError) {
    console.error('ComplaintRoutes: fee invoice retry could not be released:', finishError.message);
  }
}

/**
 * Entscheidung des Kunden ueber das Reparaturangebot ATOMAR beanspruchen: nur EINE
 * Anfrage (Doppelklick, Wiederholung, Annehmen und Ablehnen gleichzeitig) kommt von
 * 'denied' in den Zielstatus; alle anderen sehen den neuen Stand. Liefert das
 * beanspruchte Dokument (ohne Auto-Populate) oder null.
 */
async function claimOfferDecision(complaintId, { toStatus, offerStatus, timestampField }) {
  return Complaint.findOneAndUpdate(
    { _id: complaintId, status: 'denied' },
    {
      $set: {
        status: toStatus,
        'repairOffer.status': offerStatus,
        [`repairOffer.${timestampField}`]: new Date(),
      },
    },
    { new: true }
  ).setOptions({ skipAutoPopulate: true });
}

// Anspruch zuruecknehmen, wenn die Entscheidung vor ihrem ersten bleibenden Beleg
// scheitert - der Kunde kann es dann erneut versuchen.
async function releaseOfferDecision(complaintId, { fromStatus, previousOffer }) {
  try {
    await Complaint.updateOne(
      { _id: complaintId, status: fromStatus },
      {
        $set: {
          status: 'denied',
          'repairOffer.status': previousOffer?.status || 'pending',
          'repairOffer.acceptedAt': previousOffer?.acceptedAt || null,
          'repairOffer.rejectedAt': previousOffer?.rejectedAt || null,
        },
      }
    );
  } catch (releaseError) {
    console.error('ComplaintRoutes: offer decision could not be released:', releaseError.message);
  }
}

function hasComplaintLog(complaint, action) {
  return Array.isArray(complaint?.complaintLogs) && complaint.complaintLogs.some((entry) => entry && entry.action === action);
}

function actorName(user) {
  return user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : (user?.name || user?.email || 'System');
}

function ensureTransition(currentStatus, allowedStatuses, actionLabel) {
  if (!allowedStatuses.includes(currentStatus)) {
    // Deutsche Meldung fuer die Oberflaeche; Aktion und Statuswert (englische Enums)
    // nur im Log, nicht im Satz.
    console.warn(`ComplaintRoutes: ${actionLabel} not allowed while complaint status is ${currentStatus}`);
    const error = new Error('Diese Aktion ist im aktuellen Bearbeitungsstand der Reklamation nicht möglich. Bitte laden Sie die Seite neu.');
    error.statusCode = 409;
    error.code = 'COMPLAINT_STATUS_CONFLICT';
    throw error;
  }
}

function getComplaintCustomerId(complaint) {
  if (!complaint?.customerId) return '';
  return complaint.customerId?._id
    ? complaint.customerId._id.toString()
    : complaint.customerId.toString();
}

function getComplaintEmailTrigger(complaint, metadata = {}) {
  const event = String(metadata.event || '').toLowerCase();
  const status = String(complaint?.status || '').toLowerCase();

  if (event === 'complaint_created') return 'complaint_created';
  if (event === 'admin_approved') return 'complaint_approved';
  if (event === 'technician_acknowledged') return 'complaint_approved';
  if (event === 'comment_added' || event === 'message_added') return 'complaint_message';
  if (event === 'offer_rejected' || event === 'complaint_rejected') return 'complaint_rejected';
  if (event === 'complaint_resolved') return 'complaint_resolved';

  if (['resolved', 'closed', 'new_repair'].includes(status)) return 'complaint_resolved';
  if (['rejected', 'denied'].includes(status)) return 'complaint_rejected';
  if (['in-progress', 'pending_approval', 'approved', 'acknowledged'].includes(status)) return 'complaint_processing';

  return 'complaint_processing';
}

async function notifyAdminsAboutComplaint(complaint, customer, order) {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id email');
  if (!admins.length) {
    return;
  }

  const notificationText = `Neue Reklamation ${complaint.complaintNumber} zu Auftrag ${order.orderNumber} von ${customer.email}`;

  await Promise.all(admins.map(async (admin) => {
    try {
      await NotificationService.createNotification({
        userId: admin._id,
        title: 'Neue Reklamation eingegangen',
        message: notificationText,
        type: ADMIN_NOTIFICATION_TYPE,
        orderId: order._id,
        actionUrl: `/admin/complaints?complaintId=${complaint._id}`,
        metadata: {
          complaintId: complaint._id,
          orderId: order._id,
          event: 'complaint_created'
        }
      });

      if (admin.email) {
        await EmailService.sendTemplateEmail('Statusupdate Auftrag oder Buchung', admin.email, {
          companyName: 'McRepair.de',
          customerName: 'Admin Team',
          orderId: order._id,
          orderNumber: order.orderNumber,
          deviceBrand: order.deviceBrand || '',
          deviceModel: order.deviceModel || '',
          orderStatus: 'Reklamation eingegangen',
          statusMessage: notificationText,
          statusUpdatedAt: new Date().toLocaleDateString('de-DE'),
          trackingUrl: await EmailService.buildSystemUrl('/admin/complaints'),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (notificationError) {
      console.error('ComplaintRoutes: Failed to notify admin:', notificationError.message);
    }
  }));
}

async function notifyCustomer(complaint, customerId, title, message, metadata = {}, emailOptions = {}) {
  try {
    const event = String(metadata.event || '').toLowerCase();
    const isMessageEvent = ['comment_added', 'message_added', 'feedback_request', 'quick_action'].includes(event);

    await NotificationService.createNotification({
      userId: customerId,
      title,
      message,
      type: isMessageEvent ? 'message' : 'order_update',
      orderId: complaint.orderId,
      actionUrl: '/my-complaints',
      metadata: {
        complaintId: complaint._id,
        complaintNumber: complaint.complaintNumber || null,
        ...metadata
      }
    });

    const customer = await User.findById(customerId).select('email firstName lastName');
    if (customer?.email) {
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
      const trigger = getComplaintEmailTrigger(complaint, metadata);

      await EmailService.sendTriggerEmail(trigger, customer.email, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName,
        complaintNumber: complaint.complaintNumber || String(complaint._id),
        complaintStatus: complaint.status,
        complaintCategory: complaint.category || 'other',
        complaintSubject: complaint.subject || 'Reklamation',
        orderNumber: complaint.orderId?.orderNumber || 'N/A',
        priority: complaint.priority || 'medium',
        submittedAt: new Date(complaint.createdAt || Date.now()).toLocaleDateString('de-DE'),
        handlerName: complaint.assignedToName || complaint.technicianName || 'Service Team',
        processingStartedAt: new Date().toLocaleDateString('de-DE'),
        estimatedResolutionDate: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
        senderName: metadata.senderName || complaint.assignedToName || 'Service Team',
        messageSentAt: new Date().toLocaleString('de-DE'),
        resolutionSummary: message,
        compensationInfo: complaint.partialRefund ? `Teil-Erstattung: ${formatEuroDe(complaint.partialRefund)}` : 'Keine zusätzliche Kompensation',
        resolvedAt: ['resolved', 'closed', 'new_repair'].includes(String(complaint.status || '').toLowerCase())
          ? new Date().toLocaleDateString('de-DE')
          : '',
        decision: title,
        decisionReason: message,
        decidedAt: new Date().toLocaleDateString('de-DE'),
        complaintUrl: await EmailService.buildSystemUrl(`/my-complaints/${complaint._id}`),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      }, emailOptions);
    }
  } catch (error) {
    console.error('ComplaintRoutes: Error notifying customer:', error.message);
  }
}

async function createComplaintReturnLabel(complaintOrder, customer) {
  const dhlConfig = await DHLService.getDHLConfig();
  const parcelDeConfig = DHLService.getParcelDEConfig(dhlConfig);
  const companyAddress = dhlConfig.settings?.shipper || {};
  const addresses = [complaintOrder.shippingAddress, customer.shippingAddress, customer.invoiceAddress, customer.paymentAddress].filter(Boolean);
  const firstAddressValue = (...fields) => fields.find((value) => String(value || '').trim()) || '';
  const customerAddress = {
    street: firstAddressValue(...addresses.map((address) => address.street)),
    // Strasse und Hausnummer stammen aus DERSELBEN Anschrift. Die gespeicherten
    // Adressen fuehren kein eigenes `number`-Feld - die Hausnummer steckt in der
    // kombinierten Strasse und wird serverseitig von DHLService abgetrennt. Ein
    // Platzhalter '1' wuerde die echte Nummer verdraengen und ein zustellbar
    // aussehendes, falsches Label erzeugen.
    number: firstAddressValue(...addresses.map((address) => address.number || address.house)),
    city: firstAddressValue(...addresses.map((address) => address.city)),
    zipCode: firstAddressValue(...addresses.map((address) => address.zipCode || address.postalCode)),
    country: firstAddressValue(...addresses.map((address) => address.country)) || 'DE'
  };
  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || customer.email || 'Customer';
  const receiverStreet = dhlConfig.settings?.shipperStreet || companyAddress.street;
  const receiverCity = dhlConfig.settings?.shipperCity || companyAddress.city;
  const receiverPostalCode = dhlConfig.settings?.shipperPostalCode || companyAddress.postalCode;

  if (!receiverStreet || !receiverCity || !receiverPostalCode) {
    throw buildComplaintError('Die McRepair-Empfängeradresse ist für das Reklamationslabel nicht vollständig konfiguriert.', 400, 'COMPLAINT_LABEL_ADDRESS_MISSING');
  }

  const shipmentResult = await DHLService.createShipment(complaintOrder._id, {
    // Einsendung (Kunde -> McRepair): ausdruecklich angeben, statt die Richtung aus der
    // Absenderadresse ableiten zu lassen - das Label gehoert in den return*-Slot des
    // Auftrags, nie in die Auslieferung.
    labelDirection: 'inbound',
    receiverName: dhlConfig.settings?.shipperCompany || companyAddress.company || 'McRepair.de GmbH',
    receiverAddress: receiverStreet,
    receiverNumber: dhlConfig.settings?.shipperNumber || companyAddress.number || '',
    receiverCity,
    receiverPostalCode,
    receiverCountry: dhlConfig.settings?.shipperCountry || companyAddress.country || 'DE',
    receiverEmail: dhlConfig.settings?.shipperEmail || companyAddress.email || process.env.SUPPORT_EMAIL || 'info@mcrepair.de',
    receiverPhone: dhlConfig.settings?.shipperPhone || companyAddress.phone || '+49301234567',
    shipperName: customerName,
    shipperStreet: customerAddress.street,
    shipperNumber: customerAddress.number || '',
    shipperCity: customerAddress.city,
    shipperPostalCode: customerAddress.zipCode || customerAddress.postalCode,
    shipperCountry: customerAddress.country || 'DE',
    shipperEmail: customer.email,
    shipperPhone: customer.phone,
    accountNumber: parcelDeConfig.accountNumber,
    profile: parcelDeConfig.profile,
    product: parcelDeConfig.product,
    weight: Number(complaintOrder.weight || 1),
    shipmentDate: new Date().toISOString().slice(0, 10)
  });

  if (!/^data:application\/pdf;base64,/.test(shipmentResult?.labelUrl || '')) {
    throw buildComplaintError('DHL hat kein PDF für das Reklamationslabel zurückgegeben.', 502, 'COMPLAINT_LABEL_NO_PDF');
  }

  return shipmentResult;
}

function complaintToAdminRow(complaint) {
  const partsCosts = (complaint.additionalParts || []).reduce((sum, part) => sum + (part.cost || 0), 0);
  const sourceOrderId = complaint.orderId?._id || complaint.orderId;
  const complaintOrderId = complaint.newOrderId?._id || complaint.newOrderId;
  return {
    _id: complaint._id,
    complaintNumber: complaint.complaintNumber,
    orderId: sourceOrderId,
    orderNumber: complaint.orderId?.orderNumber || 'N/A',
    complaintOrderId,
    complaintOrderNumber: complaint.newOrderId?.orderNumber || '',
    customer: complaint.customerId
      ? `${complaint.customerId.firstName || ''} ${complaint.customerId.lastName || ''}`.trim() || complaint.customerId.email
      : 'N/A',
    processor: complaint.technicianName || complaint.assignedToName || '',
    status: complaint.status,
    createdAt: complaint.createdAt,
    extraCosts: Number((complaint.extraCosts || 0) + partsCosts + (complaint.serviceFee || 0)),
    partialRefund: complaint.partialRefund || 0
  };
}

function buildComplaintOrderPayload(sourceOrder, complaint) {
  const source = sourceOrder.toObject();
  delete source._id;
  delete source.orderNumber;
  delete source.createdAt;
  delete source.updatedAt;
  // Neuer Auftrag, neuer Bearbeitungsstand (siehe Order.editRevision).
  delete source.editRevision;

  source.deviceBrand = sourceOrder.deviceBrand;
  source.deviceModel = sourceOrder.deviceModel;
  source.deviceType = sourceOrder.deviceType;
  source.imei = sourceOrder.imei || '';
  source.serialNumber = sourceOrder.serialNumber || '';
  source.unlockPattern = Array.isArray(sourceOrder.unlockPattern)
    ? [...sourceOrder.unlockPattern]
    : [];
  source.unlockCode = sourceOrder.unlockCode || '';
  source.noLock = sourceOrder.noLock ?? false;
  source.unlockConfirmation = sourceOrder.unlockConfirmation
    ? sourceOrder.unlockConfirmation.toObject?.() || { ...sourceOrder.unlockConfirmation }
    : undefined;

  source.status = 'pending';
  source.progress = 0;
  source.actualCompletion = undefined;
  source.estimatedCompletion = undefined;
  source.assignedStaff = [];
  source.staffNotes = [];
  source.timeline = [];
  source.workflows = [];
  source.hasComplaint = true;
  source.parentOrderId = sourceOrder._id;
  source.sourceComplaintId = complaint._id;
  source.isComplaintFollowup = true;
  source.customerNotes = `${source.customerNotes || ''}\nReklamationsauftrag aus ${complaint.complaintNumber}`.trim();

  return source;
}

// Description: Get all complaints for a booking
// Endpoint: GET /api/complaints/booking/:bookingId
router.get('/booking/:bookingId', requireUser, async (req, res) => {
  try {
    const complaints = await ComplaintService.getByBooking(req.params.bookingId);
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaints by booking:', error);
    return respondComplaintError(res, error, 'Die Reklamationen zur Buchung konnten nicht geladen werden.');
  }
});

// Description: Get all complaints (admin only)
// Endpoint: GET /api/complaints
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, category, priority, limit = 50, skip = 0, from, to, technicianId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (technicianId) query.technicianId = technicianId;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const complaints = await Complaint.find(query)
      .populate('orderId', 'orderNumber')
      .populate('newOrderId', 'orderNumber status')
      .populate('customerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));

    return res.json({
      success: true,
      complaints,
      rows: complaints.map(complaintToAdminRow)
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting all complaints:', error);
    return respondComplaintError(res, error, 'Die Reklamationen konnten nicht geladen werden.');
  }
});

// Description: Accept new repair offer (customer)
// Endpoint: POST /api/complaints/:id/accept-offer
// Idempotent: die Entscheidung wird atomar beansprucht (denied -> new_repair). Eine
// Wiederholung nach erfolgter Annahme liefert 200 mit alreadyProcessed: true; eine
// gleichzeitige zweite Entscheidung (auch Ablehnen) bekommt eine deutsche 409.
// Response: { success, complaint, newOrder: { _id, orderNumber, status }, alreadyProcessed? }
router.post('/:id/accept-offer', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    const respondAlreadyAccepted = async (current) => {
      const repairOrder = await Order.findById(toIdString(current.newOrderId))
        .setOptions({ skipAutoPopulate: true })
        .select('_id orderNumber status')
        .lean();
      return res.json({
        success: true,
        alreadyProcessed: true,
        complaint: current,
        newOrder: repairOrder ? { _id: repairOrder._id, orderNumber: repairOrder.orderNumber, status: repairOrder.status } : null,
      });
    };
    const isAcceptedAndDone = (current) => current?.status === 'new_repair'
      && current?.repairOffer?.status === 'accepted'
      && hasComplaintLog(current, 'offer_accepted');

    if (complaint.status !== 'denied' && isAcceptedAndDone(complaint)) {
      return respondAlreadyAccepted(complaint);
    }
    ensureTransition(complaint.status, ['denied'], 'Accept offer');

    if (!complaint.newOrderId) {
      return res.status(400).json({ success: false, error: 'Für diese Reklamation existiert kein Reklamationsauftrag.' });
    }

    const repairOrderExists = await Order.exists({ _id: toIdString(complaint.newOrderId) });
    if (!repairOrderExists) {
      return res.status(404).json({ success: false, error: 'Der Reklamationsauftrag wurde nicht gefunden.' });
    }

    const previousOffer = {
      status: complaint.repairOffer?.status,
      acceptedAt: complaint.repairOffer?.acceptedAt,
      rejectedAt: complaint.repairOffer?.rejectedAt,
    };
    const claimed = await claimOfferDecision(complaint._id, {
      toStatus: 'new_repair', offerStatus: 'accepted', timestampField: 'acceptedAt',
    });
    if (!claimed) {
      const current = await Complaint.findById(complaint._id);
      if (isAcceptedAndDone(current)) return respondAlreadyAccepted(current);
      throw buildComplaintError(
        'Über dieses Reparaturangebot wurde bereits entschieden oder die Entscheidung wird gerade verarbeitet. Bitte laden Sie die Seite neu.',
        409,
        'COMPLAINT_DECISION_IN_PROGRESS'
      );
    }

    // Der bestehende Reklamationsauftrag wird mit dem angenommenen Angebot als
    // Reparaturauftrag eroeffnet. Das Angebot ist die (einzige) abzurechnende POSITION
    // dieses Auftrags - Endbetrag brutto, ohne weiteren Rabatt.
    const offerAmount = Math.max(0, Math.round(Number(claimed.repairOffer?.amount || 0) * 100) / 100);
    const offerDescription = String(claimed.repairOffer?.description || '').trim();
    let repairOrder;
    try {
      repairOrder = await setComplaintOrderBillablePositions(toIdString(claimed.newOrderId), {
        services: [{
          isManual: true,
          name: `Reparaturangebot (Reklamation ${claimed.complaintNumber || claimed._id})`,
          description: offerDescription,
          price: offerAmount,
          estimatedTime: 0,
          notes: '',
        }],
        addOns: [],
        applyExtra: (order) => {
          order.status = 'in-progress';
          order.progress = 0;
          order.actualCompletion = undefined;
          order.estimatedCompletion = undefined;
          order.hasComplaint = false;
          order.isComplaintFollowup = true;
          order.paymentStatus = 'pending';
          order.requiresPaymentBeforeCompletion = true;
        },
        action: `Reparaturangebot angenommen: ${formatEuroDe(offerAmount)}`,
        actor: req.user,
      });
    } catch (positionError) {
      await releaseOfferDecision(claimed._id, { fromStatus: 'new_repair', previousOffer });
      throw positionError;
    }

    claimed.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'offer_accepted',
      fromStatus: 'denied',
      toStatus: 'new_repair',
      notes: 'Kunde hat das Reparaturangebot angenommen.',
      metadata: {
        repairOrderId: repairOrder._id,
        repairOrderNumber: repairOrder.orderNumber,
        offerAmount
      }
    });

    await claimed.save();
    // Antwort und Benachrichtigung mit dem vollstaendigen (populierten) Stand wie bisher.
    const acceptedComplaint = (await Complaint.findById(claimed._id)) || claimed;

    // Update repair offer message status in the communication thread
    try {
      const targetOrderId = toIdString(claimed.newOrderId || claimed.orderId);
      await InspectionCommunicationService.updateRepairOfferStatus(
        targetOrderId, claimed._id, 'accepted'
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error updating repair offer message status (accept):', commError);
    }

    await notifyCustomer(
      acceptedComplaint,
      acceptedComplaint.customerId,
      'Neues Reparaturangebot angenommen',
      `Der Reklamationsauftrag wurde als Reparaturauftrag eröffnet: ${repairOrder.orderNumber}`,
      { event: 'offer_accepted', repairOrderId: repairOrder._id, offerAmount }
    );

    return res.json({
      success: true,
      complaint: acceptedComplaint,
      newOrder: {
        _id: repairOrder._id,
        orderNumber: repairOrder.orderNumber,
        status: repairOrder.status
      }
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error accepting offer:', error);
    return respondComplaintError(res, error, 'Das Reparaturangebot konnte nicht angenommen werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Reject new repair offer (customer)
// Endpoint: POST /api/complaints/:id/reject-offer
// Request: { serviceFee?: number } - nur Personal/Admin; null/'' = nicht angegeben
// Idempotent: die Entscheidung wird atomar beansprucht (denied -> awaiting_payment), es
// entsteht genau EINE Pauschalen-Position und genau EINE Rechnung. Eine Wiederholung nach
// erfolgter Ablehnung liefert 200 mit alreadyProcessed: true und der bestehenden
// Rechnung; eine gleichzeitige zweite Entscheidung bekommt eine deutsche 409.
// Response: { success, complaint, invoice, warnings: string[], alreadyProcessed? }
router.post('/:id/reject-offer', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    // Eine Wiederholung nach abgeschlossener Ablehnung ist erfolgreich und stellt nichts
    // ein zweites Mal aus. Fehlt die Pauschalenrechnung, weil sie beim ersten Lauf nicht
    // erstellt werden konnte, wird sie hier KONTROLLIERT nachgeholt: nur wenn die Ablehnung
    // abgeschlossen ist (Protokoll offer_rejected), nur EIN Nachholversuch gleichzeitig
    // (claimFeeInvoiceRetry) und erst nach erneuter Pruefung, dass noch keine Rechnung
    // existiert - die Pauschale wird so nie doppelt berechnet.
    const respondAlreadyRejected = async (current) => {
      const complaintOrderId = toIdString(current.newOrderId);
      let invoice = await findComplaintOrderInvoice(complaintOrderId);
      const warnings = [];
      if (!invoice && hasComplaintLog(current, 'offer_rejected') && complaintOrderId) {
        const outcome = await retryComplaintFeeInvoice(current, complaintOrderId);
        invoice = outcome.invoice;
        if (outcome.warning) warnings.push(outcome.warning);
      }
      const freshComplaint = invoice && warnings.length === 0 ? ((await Complaint.findById(current._id)) || current) : current;
      return res.json({ success: true, alreadyProcessed: true, complaint: freshComplaint, invoice, warnings });
    };
    const retryComplaintFeeInvoice = async (current, complaintOrderId) => {
      const rejectedLog = [...(current.complaintLogs || [])].reverse().find((entry) => entry && entry.action === 'offer_rejected');
      const loggedFee = Number(rejectedLog?.metadata?.serviceFee);
      const serviceFee = Math.round((Number.isFinite(loggedFee) && loggedFee >= 0 ? loggedFee : Number(current.serviceFee || 0)) * 100) / 100;
      if (!(await Order.exists({ _id: complaintOrderId })) || !(serviceFee > 0)) {
        return {
          invoice: null,
          warning: 'Für diese Reklamation fehlt die Rechnung über die Servicepauschale. Bitte die Rechnung in der Finanzverwaltung prüfen.',
        };
      }
      const { claimed: retryClaim, retryId } = await claimFeeInvoiceRetry(current._id, req.user);
      if (!retryClaim) {
        const existing = await findComplaintOrderInvoice(complaintOrderId);
        return existing
          ? { invoice: existing }
          : { invoice: null, warning: await describeRunningFeeInvoiceRetry(current._id) };
      }
      // Erneut pruefen: ein frueherer Versuch kann die Rechnung inzwischen erstellt haben.
      const existing = await findComplaintOrderInvoice(complaintOrderId);
      if (existing) {
        await releaseFeeInvoiceRetry(current._id, retryId, {
          result: { invoiceId: existing._id, invoiceNumber: existing.invoiceNumber, alreadyExisted: true },
        });
        return { invoice: existing };
      }
      let created;
      try {
        created = await createComplaintFeeInvoice({ complaint: current, complaintOrderId, serviceFee });
      } catch (retryError) {
        console.error('ComplaintRoutes: Error re-creating invoice for rejected offer:', retryError.message);
        await releaseFeeInvoiceRetry(current._id, retryId, { failed: true, actor: req.user });
        return {
          invoice: null,
          warning: 'Die Rechnung über die Servicepauschale konnte weiterhin nicht erstellt werden. '
            + 'Bitte später erneut versuchen oder die Rechnung in der Finanzverwaltung manuell erstellen.',
        };
      }
      await completeFeeInvoiceRetry(current._id, retryId, {
        actor: req.user,
        notes: `Rechnung über die Servicepauschale nachgeholt: ${created.invoiceNumber || ''} (${formatEuroDe(created.total)})`.trim(),
        metadata: { serviceFee, complaintOrderId, invoiceId: created._id, invoiceNumber: created.invoiceNumber },
      });
      return { invoice: created };
    };
    const isRejectedAndDone = async (current) => current?.status === 'awaiting_payment'
      && current?.repairOffer?.status === 'rejected'
      && (hasComplaintLog(current, 'offer_rejected') || Boolean(await findComplaintOrderInvoice(toIdString(current.newOrderId))));

    if (complaint.status !== 'denied' && await isRejectedAndDone(complaint)) {
      return respondAlreadyRejected(complaint);
    }
    ensureTransition(complaint.status, ['denied'], 'Reject offer');

    // Pauschale serverseitig: an der Reklamation hinterlegt, sonst Standard. Ein Kunde
    // kann den Betrag nicht selbst setzen; nur Personal/Admin darf ihn ausdruecklich
    // uebersteuern (vor dem Beanspruchen pruefen - ein Eingabefehler aendert nichts).
    const staffFee = parseStaffServiceFee(req.user, req.body?.serviceFee);

    const previousOffer = {
      status: complaint.repairOffer?.status,
      acceptedAt: complaint.repairOffer?.acceptedAt,
      rejectedAt: complaint.repairOffer?.rejectedAt,
    };
    const claimed = await claimOfferDecision(complaint._id, {
      toStatus: 'awaiting_payment', offerStatus: 'rejected', timestampField: 'rejectedAt',
    });
    if (!claimed) {
      const current = await Complaint.findById(complaint._id);
      if (await isRejectedAndDone(current)) return respondAlreadyRejected(current);
      throw buildComplaintError(
        'Über dieses Reparaturangebot wurde bereits entschieden oder die Entscheidung wird gerade verarbeitet. Bitte laden Sie die Seite neu.',
        409,
        'COMPLAINT_DECISION_IN_PROGRESS'
      );
    }

    const storedFee = Number(claimed.serviceFee || 0);
    const serviceFee = Math.round(
      (staffFee.provided ? staffFee.value : (storedFee > 0 ? storedFee : DEFAULT_COMPLAINT_SERVICE_FEE)) * 100
    ) / 100;
    const warnings = [];

    // Die Pauschale gehoert zum REKLAMATIONSAUFTRAG, nie zum Originalauftrag (der ist in
    // der Regel schon berechnet - frueher lief die Rechnung dort in die
    // Doppelrechnungssperre und wurde still nicht erstellt, bzw. davor wurde der
    // Originalauftrag ein zweites Mal berechnet). Fehlt der Reklamationsauftrag
    // (Altdaten), wird er jetzt aus dem Originalauftrag angelegt und SOFORT verknuepft -
    // scheitert ein spaeterer Schritt, verwendet ein neuer Versuch ihn wieder (kein
    // verwaister zweiter Reklamationsauftrag).
    let complaintOrder;
    try {
      let complaintOrderId = toIdString(claimed.newOrderId) || null;
      if (complaintOrderId && !(await Order.exists({ _id: complaintOrderId }))) {
        complaintOrderId = null;
      }
      if (!complaintOrderId) {
        const sourceOrder = await Order.findById(toIdString(claimed.orderId)).setOptions({ skipAutoPopulate: true });
        if (!sourceOrder) {
          throw buildComplaintError('Der Auftrag zu dieser Reklamation wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
        }
        const createdComplaintOrder = await Order.create(buildComplaintOrderPayload(sourceOrder, claimed));
        complaintOrderId = String(createdComplaintOrder._id);
        claimed.newOrderId = createdComplaintOrder._id;
        await Complaint.updateOne({ _id: claimed._id }, { $set: { newOrderId: createdComplaintOrder._id } });
      }

      // Pauschale als POSITION (Zusatzleistung); der Wert des Reklamationsauftrags ist
      // genau die Pauschale. Wiederholbar: die Positionen werden ersetzt, nicht ergaenzt.
      complaintOrder = await setComplaintOrderBillablePositions(complaintOrderId, {
        services: [],
        addOns: [{
          name: 'Servicepauschale (abgelehnte Reklamation)',
          description: `Servicepauschale für die abgelehnte Reklamation ${claimed.complaintNumber || claimed._id}`,
          price: serviceFee,
          status: 'completed',
          estimatedTime: '',
          progress: 100,
        }],
        applyExtra: (order) => {
          order.requiresPaymentBeforeCompletion = true;
          order.paymentStatus = 'pending';
        },
        action: `Reparaturangebot abgelehnt: Servicepauschale ${formatEuroDe(serviceFee)}`,
        actor: req.user,
      });
    } catch (positionError) {
      await releaseOfferDecision(claimed._id, { fromStatus: 'awaiting_payment', previousOffer });
      throw positionError;
    }

    // Eigene Rechnung NUR ueber die Pauschale (Bruttoposition, kein Rabatt). Nicht ueber
    // createInvoiceFromOrder: der Reklamationsauftrag traegt als Kopie die bookingId des
    // Originals, dessen Buchungsrechnung die Anlage sonst blockiert. Gibt es fuer den
    // Reklamationsauftrag bereits eine gueltige Rechnung, wird KEINE zweite erstellt.
    let invoice = await findComplaintOrderInvoice(complaintOrder._id);
    if (invoice) {
      if (Math.abs(Number(invoice.total || 0) - serviceFee) > 0.009) {
        warnings.push(
          `Für den Reklamationsauftrag besteht bereits die Rechnung ${invoice.invoiceNumber || ''} über ${formatEuroDe(invoice.total)}; `
          + 'es wurde keine weitere Rechnung erstellt. Bitte die Rechnung in der Finanzverwaltung prüfen.'
        );
      }
    } else {
      try {
        invoice = await createComplaintFeeInvoice({ complaint: claimed, complaintOrderId: complaintOrder._id, serviceFee });
      } catch (invoiceError) {
        console.error('ComplaintRoutes: Error creating invoice for rejected offer:', invoiceError.message);
        invoice = null;
        warnings.push(
          'Die Servicepauschale wurde am Reklamationsauftrag gespeichert, die Rechnung konnte jedoch nicht erstellt werden. '
          + 'Ein erneuter Aufruf der Ablehnung holt sie nach; alternativ die Rechnung in der Finanzverwaltung manuell erstellen.'
        );
      }
    }

    claimed.serviceFee = serviceFee;
    claimed.extraCosts = Number(claimed.extraCosts || 0) + serviceFee;
    claimed.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'offer_rejected',
      fromStatus: 'denied',
      toStatus: 'awaiting_payment',
      notes: `Reparaturangebot abgelehnt. Servicepauschale: ${formatEuroDe(serviceFee)}. Rechnung: ${invoice?.invoiceNumber || 'nicht erstellt'}`,
      metadata: {
        serviceFee,
        complaintOrderId: complaintOrder._id,
        invoiceId: invoice?._id,
        invoiceNumber: invoice?.invoiceNumber
      }
    });

    await claimed.save();
    // Antwort und Benachrichtigung mit dem vollstaendigen (populierten) Stand wie bisher.
    const rejectedComplaint = (await Complaint.findById(claimed._id)) || claimed;

    // Update repair offer message status in the communication thread
    try {
      const targetOrderId = toIdString(claimed.newOrderId || claimed.orderId);
      await InspectionCommunicationService.updateRepairOfferStatus(
        targetOrderId, claimed._id, 'rejected'
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error updating repair offer message status (reject):', commError);
    }

    await notifyCustomer(
      rejectedComplaint,
      rejectedComplaint.customerId,
      'Reparaturangebot abgelehnt',
      `Die Reklamation und Reparatur werden nach Zahlungseingang versendet. Rechnungsbetrag: ${formatEuroDe(invoice?.total || serviceFee)}`,
      { event: 'offer_rejected', serviceFee, invoiceId: invoice?._id, invoiceNumber: invoice?.invoiceNumber }
    );

    return res.json({ success: true, complaint: rejectedComplaint, invoice, warnings });
  } catch (error) {
    console.error('ComplaintRoutes: Error rejecting offer:', error);
    return respondComplaintError(res, error, 'Die Ablehnung des Reparaturangebots konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Admin approves complaint
// Endpoint: PATCH /api/complaints/:id/approve
router.patch('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    ensureTransition(complaint.status, ['pending_approval'], 'Approve complaint');

    const order = await Order.findById(complaint.orderId).setOptions({ skipAutoPopulate: true });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Der Auftrag zu dieser Reklamation wurde nicht gefunden.' });
    }

    order.hasComplaint = true;
    order.complaintReason = complaint.complaintReason || complaint.description || complaint.subject;
    await order.save();

    let complaintOrder = null;
    if (complaint.newOrderId) {
      complaintOrder = await Order.findById(complaint.newOrderId).setOptions({ skipAutoPopulate: true });
    }

    if (!complaintOrder) {
      const complaintOrderPayload = buildComplaintOrderPayload(order, complaint);
      complaintOrder = await Order.create(complaintOrderPayload);
      complaint.newOrderId = complaintOrder._id;
    }

    const customer = await User.findById(complaint.customerId)
      .select('name firstName lastName email phone shippingAddress invoiceAddress paymentAddress');
    if (!customer?.email) {
      return res.status(400).json({ success: false, error: 'Der Kunde besitzt keine E-Mail-Adresse.' });
    }

    const shipmentResult = await createComplaintReturnLabel(complaintOrder, customer);
    const previousStatus = complaint.status;
    complaint.status = 'approved';
    complaint.adminApprovedAt = new Date();
    complaint.adminApprovedBy = req.user._id;
    complaint.shippingLabelUrl = shipmentResult.labelUrl;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'admin_approved',
      fromStatus: previousStatus,
      toStatus: 'approved',
      notes: 'Complaint approved and shipping label generated',
      metadata: {
        shippingLabelUrl: complaint.shippingLabelUrl,
        trackingNumber: shipmentResult.trackingNumber,
        complaintOrderId: complaintOrder?._id,
        complaintOrderNumber: complaintOrder?.orderNumber
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation genehmigt',
      `Deine Reklamation wurde genehmigt. Versandlabel: ${complaint.shippingLabelUrl}${complaintOrder ? `. Reklamationsauftrag: ${complaintOrder.orderNumber}` : ''}`,
      {
        event: 'admin_approved',
        shippingLabelUrl: complaint.shippingLabelUrl,
        trackingNumber: shipmentResult.trackingNumber,
        complaintOrderId: complaintOrder?._id,
        complaintOrderNumber: complaintOrder?.orderNumber
      },
      {
        attachments: [{
          filename: `Reklamationslabel-${complaint.complaintNumber || complaint._id}.pdf`,
          content: complaint.shippingLabelUrl.replace(/^data:application\/pdf;base64,/, ''),
          encoding: 'base64',
          contentType: 'application/pdf'
        }]
      }
    );

    return res.json({
      success: true,
      complaint,
      complaintOrder: complaintOrder
        ? {
            _id: complaintOrder._id,
            orderNumber: complaintOrder.orderNumber,
            status: complaintOrder.status
          }
        : null
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error approving complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht genehmigt werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Admin rejects complaint
// Endpoint: PATCH /api/complaints/:id/reject
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('orderId', 'orderNumber')
      .populate('newOrderId', 'orderNumber status')
      .populate('customerId', 'firstName lastName email');
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const rejectionReason = req.body?.rejection_reason;
    if (!rejectionReason) {
      return res.status(400).json({ success: false, error: 'Bitte geben Sie einen Ablehnungsgrund an.' });
    }

    ensureTransition(complaint.status, ['pending_approval'], 'Reject complaint');

    const previousStatus = complaint.status;
    complaint.status = 'rejected';
    complaint.rejectionReason = rejectionReason;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'admin_rejected',
      fromStatus: previousStatus,
      toStatus: 'rejected',
      notes: rejectionReason,
      metadata: {
        rejectionReason
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation abgelehnt',
      `Deine Reklamation wurde abgelehnt. Grund: ${rejectionReason}`,
      { event: 'admin_rejected', rejectionReason }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error rejecting complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht abgelehnt werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Technician acknowledges complaint
// Endpoint: PATCH /api/complaints/:id/acknowledge
router.patch('/:id/acknowledge', requireUser, requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const technicianReason = req.body?.technician_reason;
    if (!technicianReason) {
      return res.status(400).json({ success: false, error: 'Bitte geben Sie eine Begründung des Technikers an.' });
    }

    ensureTransition(complaint.status, ['approved'], 'Acknowledge complaint');

    const additionalParts = Array.isArray(req.body?.additional_parts) ? req.body.additional_parts : [];
    const partsCost = additionalParts.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const partialRefund = Number(req.body?.partial_refund || 0);
    const repairNotes = req.body?.repair_notes || '';
    const previousStatus = complaint.status;

    complaint.status = 'acknowledged';
    complaint.technicianId = req.user._id;
    complaint.technicianName = actorName(req.user);
    complaint.technicianReason = technicianReason;
    complaint.additionalParts = additionalParts;
    complaint.partialRefund = partialRefund;
    complaint.repairNotes = repairNotes;
    complaint.extraCosts = Number(complaint.extraCosts || 0) + partsCost;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'technician_acknowledged',
      fromStatus: previousStatus,
      toStatus: 'acknowledged',
      notes: technicianReason,
      metadata: {
        additionalParts,
        partsCost,
        partialRefund,
        repairNotes
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation anerkannt',
      'Der Techniker hat die Reklamation anerkannt. Wir starten die Ausbesserung.',
      { event: 'technician_acknowledged', technicianReason }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error acknowledging complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht anerkannt werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Technician denies complaint and creates repair offer
// Endpoint: PATCH /api/complaints/:id/deny
router.patch('/:id/deny', requireUser, requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const technicianReason = req.body?.technician_reason;
    if (!technicianReason) {
      return res.status(400).json({ success: false, error: 'Bitte geben Sie eine Begründung des Technikers an.' });
    }

    if (req.user.role === 'staff') {
      ensureTransition(complaint.status, ['approved'], 'Escalate denied complaint');
    } else {
      // Admin confirmation is only allowed after technician escalation.
      ensureTransition(complaint.status, ['pending_approval'], 'Confirm denied complaint');
    }

    const hasOfferAmountField = req.body?.offer_amount !== undefined && req.body?.offer_amount !== null;
    const offerAmount = Number(req.body?.offer_amount || 0);
    const offerDescription = (req.body?.offer_description || '').trim();
    const existingOfferAmount = Number(complaint.repairOffer?.amount || 0);
    const existingOfferDescription = (complaint.repairOffer?.description || '').trim();
    const resolvedOfferAmount = hasOfferAmountField ? offerAmount : existingOfferAmount;
    const resolvedOfferDescription = offerDescription || existingOfferDescription;

    if (req.user.role === 'admin' && !resolvedOfferDescription) {
      return res.status(400).json({
        success: false,
        error: 'Bitte hinterlegen Sie vor der Bestätigung ein Reparaturangebot (Beschreibung).',
      });
    }
    const previousStatus = complaint.status;

    complaint.status = req.user.role === 'staff' ? 'pending_approval' : 'denied';
    complaint.technicianId = req.user._id;
    complaint.technicianName = actorName(req.user);
    complaint.technicianReason = technicianReason;
    complaint.repairOffer = {
      amount: resolvedOfferAmount,
      description: resolvedOfferDescription || 'Neues Reparaturangebot nach Reklamationspruefung',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      status: 'pending'
    };
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: req.user.role === 'staff' ? 'technician_denied_escalated' : 'admin_denied_confirmed',
      fromStatus: previousStatus,
      toStatus: complaint.status,
      notes: technicianReason,
      metadata: {
        offerAmount: resolvedOfferAmount,
        offerDescription: resolvedOfferDescription
      }
    });

    await complaint.save();

    if (req.user.role === 'staff') {
      try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        await Promise.all(admins.map((admin) => NotificationService.createNotification({
          userId: admin._id,
          title: 'Reklamation zur Ablehnungspruefung eskaliert',
          message: `Reklamation ${complaint.complaintNumber} wurde mit Reparaturangebot zur Admin-Freigabe eingereicht.`,
          type: ADMIN_NOTIFICATION_TYPE,
          orderId: complaint.newOrderId || complaint.orderId,
          actionUrl: `/orders/${complaint.newOrderId || complaint.orderId}`,
          metadata: {
            complaintId: complaint._id,
            event: 'technician_denied_escalated',
            offerAmount: resolvedOfferAmount,
            offerDescription: resolvedOfferDescription,
          },
        })));
      } catch (adminNotifyError) {
        console.error('ComplaintRoutes: Error notifying admins about escalation:', adminNotifyError);
      }

      return res.json({
        success: true,
        escalated: true,
        complaint,
      });
    }

    // Send repair offer as a message into the follow-up order's communication thread (the Reklamationsauftrag the customer views)
    try {
      const targetOrderId = (complaint.newOrderId || complaint.orderId).toString();
      await InspectionCommunicationService.sendRepairOfferMessage(
        targetOrderId,
        req.user._id,
        actorName(req.user),
        { complaintId: complaint._id, offerAmount: resolvedOfferAmount, offerDescription: resolvedOfferDescription }
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error sending repair offer message:', commError);
    }

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Neues Reparaturangebot verfügbar',
      `Die Reklamation wurde abgelehnt. Neues Angebot: ${formatEuroDe(resolvedOfferAmount)}. Bitte annehmen oder ablehnen.`,
      { event: 'technician_denied', offerAmount: resolvedOfferAmount, offerDescription: resolvedOfferDescription }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error denying complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht abgelehnt werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Get all complaints for the authenticated customer
// Endpoint: GET /api/complaints/my
router.get('/my', requireUser, async (req, res) => {
  try {
    const complaints = await Complaint.find({ customerId: req.user._id })
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 });
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting customer complaints:', error);
    return respondComplaintError(res, error, 'Ihre Reklamationen konnten nicht geladen werden.');
  }
});

// Description: Get a specific complaint by ID
// Endpoint: GET /api/complaints/:id
router.get('/:id', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht geladen werden.');
  }
});

// Description: Create a new legacy complaint
// Endpoint: POST /api/complaints
router.post('/', requireUser, async (req, res) => {
  try {
    const { bookingId, orderId, subject, description, category, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'Bitte geben Sie Betreff, Beschreibung und Kategorie der Reklamation an.'
      });
    }

    const complaintData = {
      bookingId,
      orderId,
      customerId: req.user._id,
      subject,
      description,
      category,
      priority: priority || 'medium',
      workflowType: 'legacy'
    };

    const complaint = await ComplaintService.create(complaintData);

    try {
      const customer = await User.findById(req.user._id).select('email firstName lastName');
      if (customer?.email) {
        await EmailService.sendTriggerEmail('complaint_created', customer.email, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
          complaintNumber: complaint.complaintNumber || String(complaint._id),
          complaintCategory: complaint.category,
          complaintSubject: complaint.subject,
          orderNumber: complaint.orderId?.orderNumber || 'N/A',
          priority: complaint.priority || 'medium',
          submittedAt: new Date(complaint.createdAt || Date.now()).toLocaleDateString('de-DE'),
          complaintUrl: await EmailService.buildSystemUrl(`/my-complaints/${complaint._id}`),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (notificationError) {
      console.error('ComplaintRoutes: Error sending complaint-created email:', notificationError.message);
    }

    return res.status(201).json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error creating complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht angelegt werden. Bitte versuchen Sie es erneut.');
  }
});

// Description: Update complaint status (legacy)
// Endpoint: PUT /api/complaints/:id/status
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Bitte geben Sie einen Status an.' });
    }

    const validStatuses = ['open', 'in-progress', 'pending-customer', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Dieser Status ist für eine Reklamation nicht zulässig.'
      });
    }

    const complaint = await ComplaintService.updateStatus(
      req.params.id,
      status,
      req.user._id,
      actorName(req.user),
      req.user.role
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error updating complaint status:', error);
    return respondComplaintError(res, error, 'Der Status der Reklamation konnte nicht geändert werden.');
  }
});

// Description: Add comment to complaint
// Endpoint: POST /api/complaints/:id/comments
router.post('/:id/comments', requireUser, async (req, res) => {
  try {
    const { comment, isInternal } = req.body;

    if (!comment) {
      return res.status(400).json({ success: false, error: 'Bitte geben Sie einen Kommentar ein.' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Die Reklamation wurde nicht gefunden.' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    const commentData = {
      userId: req.user._id,
      userName: actorName(req.user),
      userRole: req.user.role,
      comment,
      isInternal: isInternal && (req.user.role === 'admin' || req.user.role === 'staff')
    };

    const updatedComplaint = await ComplaintService.addComment(req.params.id, commentData);

    const shouldNotifyCustomer =
      !commentData.isInternal &&
      req.user.role !== 'customer' &&
      complaintCustomerId;

    if (shouldNotifyCustomer) {
      await notifyCustomer(
        updatedComplaint,
        complaintCustomerId,
        'Neue Nachricht zu Ihrer Reklamation',
        `${commentData.userName}: ${String(comment).trim()}`,
        {
          event: 'comment_added',
          senderName: commentData.userName,
          commentId: updatedComplaint.comments?.[updatedComplaint.comments.length - 1]?._id,
        }
      );
    }

    return res.json({ success: true, complaint: updatedComplaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error adding comment:', error);
    return respondComplaintError(res, error, 'Der Kommentar zur Reklamation konnte nicht gespeichert werden.');
  }
});

// Description: Assign complaint to staff
// Endpoint: PUT /api/complaints/:id/assign
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { staffId, staffName } = req.body;

    if (!staffId || !staffName) {
      return res.status(400).json({ success: false, error: 'Bitte wählen Sie eine Mitarbeiterin bzw. einen Mitarbeiter aus.' });
    }

    const complaint = await ComplaintService.assign(req.params.id, staffId, staffName);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error assigning complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht zugewiesen werden.');
  }
});

// Description: Resolve complaint
// Endpoint: PUT /api/complaints/:id/resolve
router.put('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ success: false, error: 'Bitte beschreiben Sie die Lösung der Reklamation.' });
    }

    const complaint = await ComplaintService.resolve(req.params.id, resolution, req.user._id);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error resolving complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht als gelöst markiert werden.');
  }
});

// Description: Close complaint
// Endpoint: PUT /api/complaints/:id/close
router.put('/:id/close', requireAdmin, async (req, res) => {
  try {
    const complaint = await ComplaintService.close(req.params.id);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error closing complaint:', error);
    return respondComplaintError(res, error, 'Die Reklamation konnte nicht geschlossen werden.');
  }
});

module.exports = router;
