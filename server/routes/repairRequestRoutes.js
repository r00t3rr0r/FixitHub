const express = require('express');
const router = express.Router();
const RepairRequestService = require('../services/repairRequestService');
const RepairRequestCommunicationService = require('../services/repairRequestCommunicationService');
const { requireUser, requireStaff } = require('./middleware/auth');
// Gast-Routen ohne Anmeldung: Anlegen (IP/E-Mail/gesamt) und Token-Zugriffe (Fehlversuche,
// Lese-/Schreibvolumen) begrenzt - Werte und Begruendung in middleware/guestAccess.js.
const { guestAccessLimits, guestCreateLimits } = require('./middleware/guestAccess');

// Fehlerantwort: deutsche Meldung, passender Status, keine internen Fehlertexte bei 500.
const sendError = (res, error, fallback) => {
  const isValidation = error?.name === 'ValidationError' || error?.name === 'CastError';
  const status = Number(error?.statusCode) || (isValidation ? 400 : 500);
  const message = error?.statusCode
    ? error.message
    : (isValidation ? 'Ungültige Eingabe. Bitte prüfen Sie Ihre Angaben.' : fallback);
  if (status >= 500) {
    console.error(`RepairRequestRoutes: ${fallback}`, error);
  }
  return res.status(status).json({ success: false, message, error: message, ...(error?.code ? { code: error.code } : {}) });
};

const actorOf = (user) => ({
  _id: user._id,
  name: RepairRequestService.actorNameOf(user),
  role: user.role,
});

// Gast: Token+E-Mail prüfen UND an die angefragte ID binden (sonst Zugriff auf fremde Anfragen).
const resolveGuestRequest = async (req, source) => {
  const { token, email } = source || {};
  let repairRequest;
  try {
    repairRequest = await RepairRequestService.trackGuestRepairRequest(token, email);
  } catch (error) {
    const denied = new Error('Zugriff verweigert.');
    denied.statusCode = 403;
    throw denied;
  }
  if (String(repairRequest._id) !== String(req.params.id)) {
    const denied = new Error('Zugriff verweigert.');
    denied.statusCode = 403;
    throw denied;
  }
  return repairRequest;
};

// ─────────────────────────────────────────────────────────────────────────────
// GUEST ROUTES (no auth required) — must be declared before /:id routes
// ─────────────────────────────────────────────────────────────────────────────

// Description: Create a repair request as a guest
// Endpoint: POST /api/repair-requests/guest
// Request: { guestInfo: { firstName, lastName, email, phone }, deviceSource: 'catalog'|'manual', deviceModelId?, deviceType, deviceBrand, deviceModel, modelNumber?, issueDescription, … }
// Response: { success: true, requestNumber, guestTrackingToken }
router.post('/guest', ...guestCreateLimits, async (req, res) => {
  try {
    const { guestInfo, ...data } = req.body || {};
    const result = await RepairRequestService.createGuestRepairRequest(guestInfo, data);
    res.status(201).json({
      success: true,
      requestNumber: result.repairRequest.requestNumber,
      guestTrackingToken: result.guestTrackingToken,
      message: 'Reparaturanfrage erfolgreich übermittelt.',
    });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht erstellt werden. Bitte später erneut versuchen.');
  }
});

// Description: Track a guest repair request (Kundensicht ohne interne Daten)
// Endpoint: GET /api/repair-requests/guest/track?token=...&email=...
// Response: { success: true, request: CustomerRepairRequestView }
router.get('/guest/track', ...guestAccessLimits, async (req, res) => {
  try {
    const { token, email } = req.query;
    const request = await RepairRequestService.getGuestView(token, email);
    res.status(200).json({ success: true, request });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht geladen werden.');
  }
});

// Description: Get communication thread for a guest repair request
// Endpoint: GET /api/repair-requests/guest/:id/communication?token=...&email=...
// Response: { success: true, communication: Object | null }
router.get('/guest/:id/communication', ...guestAccessLimits, async (req, res) => {
  try {
    const repairRequest = await resolveGuestRequest(req, req.query);
    const communication = await RepairRequestCommunicationService.getCommunicationThread(repairRequest._id);
    res.status(200).json({ success: true, communication: communication || null });
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht geladen werden.');
  }
});

// Description: Send a message as a guest
// Endpoint: POST /api/repair-requests/guest/:id/message
// Request: { token, email, content, clientMessageId? }
// Response: { success: true, communication: Object, duplicate: boolean }
router.post('/guest/:id/message', ...guestAccessLimits, async (req, res) => {
  try {
    const { content, clientMessageId } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Nachrichteninhalt darf nicht leer sein.' });
    }
    const repairRequest = await resolveGuestRequest(req, req.body);
    const communication = await RepairRequestCommunicationService.sendMessage(
      repairRequest._id,
      null,
      repairRequest.customerName,
      String(content).trim(),
      'customer',
      'customer',
      { clientMessageId }
    );
    const duplicate = Boolean(communication?.$locals?.duplicate);
    res.status(duplicate ? 200 : 201).json({ success: true, communication, duplicate });
  } catch (error) {
    sendError(res, error, 'Die Nachricht konnte nicht gesendet werden.');
  }
});

// Description: Structured answer of a guest to a feedback request (incl. Kostenvoranschlag)
// Endpoint: POST /api/repair-requests/guest/:id/feedback-response
// Request: { token, email, messageId, response: { label?, value } }
// Response: { success: true, communication: Object, request: CustomerRepairRequestView }
router.post('/guest/:id/feedback-response', ...guestAccessLimits, async (req, res) => {
  try {
    const { messageId, response } = req.body || {};
    if (!messageId || !response) {
      return res.status(400).json({ success: false, message: 'Rückfrage und Antwort sind erforderlich.' });
    }
    const repairRequest = await resolveGuestRequest(req, req.body);
    const communication = await RepairRequestCommunicationService.respondToFeedback(
      repairRequest._id,
      messageId,
      response,
      null,
      repairRequest.customerName,
      { channel: 'guest' }
    );
    const request = await RepairRequestService.getGuestView(req.body.token, req.body.email);
    res.status(200).json({ success: true, communication, request });
  } catch (error) {
    sendError(res, error, 'Die Antwort konnte nicht gespeichert werden.');
  }
});

// Description: Guest accepts/declines the published Kostenvoranschlag
// Endpoint: POST /api/repair-requests/guest/:id/quote/respond
// Request: { token, email, decision: 'accept' | 'decline', quoteVersion: number (Pflicht), amount?: number }
// Response: { success: true, request: CustomerRepairRequestView }
//           409 { code: 'QUOTE_CHANGED' } wenn der gesehene Stand nicht mehr aktuell ist.
router.post('/guest/:id/quote/respond', ...guestAccessLimits, async (req, res) => {
  try {
    const repairRequest = await resolveGuestRequest(req, req.body);
    await RepairRequestService.applyQuoteDecision(repairRequest._id, {
      decision: req.body?.decision,
      responderName: repairRequest.customerName,
      channel: 'guest',
      quoteVersion: req.body?.quoteVersion,
      amount: req.body?.amount,
    });
    const request = await RepairRequestService.getGuestView(req.body.token, req.body.email);
    res.status(200).json({ success: true, request });
  } catch (error) {
    sendError(res, error, 'Die Antwort konnte nicht gespeichert werden.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Endpoint: POST /api/repair-requests
// Request: { deviceSource: 'catalog'|'manual', deviceModelId?, deviceType, deviceBrand, deviceModel, modelNumber?, issueDescription, issueOccurredDate, images[] }
// Response: { success: true, request: CustomerRepairRequestView }
router.post('/', requireUser, async (req, res) => {
  try {
    const request = await RepairRequestService.createRepairRequest(req.user._id, req.body || {});
    res.status(201).json({
      success: true,
      request: RepairRequestService.toCustomerView(request),
      message: 'Reparaturanfrage erfolgreich übermittelt.',
    });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht erstellt werden. Bitte später erneut versuchen.');
  }
});

// Description: Get all repair requests with filtering and pagination (staff/admin)
// Endpoint: GET /api/repair-requests
// Request: { status?, priority?, quoteStatus?, customerId?, assignedStaffId?, search?, page?, limit? (max 200), sortBy?, sortOrder? }
// Response: { success: true, requests: StaffRepairRequestView[], pagination: { page, limit, total, pages } }
router.get('/', requireStaff, async (req, res) => {
  try {
    const result = await RepairRequestService.getRepairRequests(
      {
        status: req.query.status,
        priority: req.query.priority,
        quoteStatus: req.query.quoteStatus,
        customerId: req.query.customerId,
        assignedStaffId: req.query.assignedStaffId,
        search: req.query.search,
      },
      {
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      },
      { _id: req.user._id, role: req.user.role }
    );
    res.status(200).json({
      success: true,
      requests: result.requests.map((item) => RepairRequestService.toStaffView(item)),
      pagination: result.pagination,
    });
  } catch (error) {
    sendError(res, error, 'Reparaturanfragen konnten nicht geladen werden.');
  }
});

// Description: Get customer's own repair requests (Kundensicht)
// Endpoint: GET /api/repair-requests/my-requests
// Response: { success: true, requests: CustomerRepairRequestView[] }
router.get('/my-requests', requireUser, async (req, res) => {
  try {
    const result = await RepairRequestService.getRepairRequests(
      { customerId: req.user._id },
      { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      { _id: req.user._id, role: 'customer' }
    );
    res.status(200).json({
      success: true,
      requests: result.requests.map((item) => RepairRequestService.toCustomerView(item, {
        includeImages: false,
        communicationSummary: item.communicationSummary,
      })),
      total: result.pagination.total,
    });
  } catch (error) {
    sendError(res, error, 'Reparaturanfragen konnten nicht geladen werden.');
  }
});

// Description: Get repair request statistics
// Endpoint: GET /api/repair-requests/statistics
router.get('/statistics', requireStaff, async (req, res) => {
  try {
    const statistics = await RepairRequestService.getStatistics();
    res.status(200).json({ success: true, statistics });
  } catch (error) {
    sendError(res, error, 'Statistik konnte nicht geladen werden.');
  }
});

// Description: Get a single repair request by ID
// Endpoint: GET /api/repair-requests/:id
// Response: staff => { success, request: StaffRepairRequestView (inkl. adminNotes) };
//           owner => { success, request: CustomerRepairRequestView (ohne interne Daten) }
router.get('/:id', requireUser, async (req, res) => {
  try {
    await RepairRequestService.assertAccess(req.user, req.params.id);
    const request = await RepairRequestService.getRepairRequestById(req.params.id);
    const summaries = await RepairRequestCommunicationService.getThreadSummaries([request._id], req.user);
    const communicationSummary = summaries.get(String(request._id));
    if (RepairRequestService.isStaffUser(req.user)) {
      return res.status(200).json({ success: true, request: RepairRequestService.toStaffView(request, { communicationSummary }) });
    }
    const convertedOrder = request.status === 'converted' ? await RepairRequestService.resolveConvertedOrderLink(request) : undefined;
    return res.status(200).json({
      success: true,
      request: RepairRequestService.toCustomerView(request, { convertedOrder, communicationSummary }),
    });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht geladen werden.');
  }
});

// Description: Update repair request status ('converted' only via /convert)
// Endpoint: PUT /api/repair-requests/:id/status
// Request: { status: 'pending'|'reviewing'|'approved'|'rejected' }
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: 'Bitte einen Status wählen.' });
    const actor = actorOf(req.user);
    const request = await RepairRequestService.updateStatus(req.params.id, status, actor._id, actor.name);
    res.status(200).json({
      success: true,
      request: RepairRequestService.toStaffView(request),
      changed: request.$locals?.statusChanged !== false,
      message: request.$locals?.statusChanged === false ? 'Status unverändert.' : 'Status gespeichert.',
    });
  } catch (error) {
    sendError(res, error, 'Der Status konnte nicht gespeichert werden.');
  }
});

// Description: Assign staff to repair request
// Endpoint: PUT /api/repair-requests/:id/assign
// Request: { staffId: string }
router.put('/:id/assign', requireStaff, async (req, res) => {
  try {
    const { staffId } = req.body || {};
    if (!staffId) return res.status(400).json({ success: false, message: 'Bitte einen Mitarbeiter wählen.' });
    const actor = actorOf(req.user);
    const request = await RepairRequestService.assignStaff(req.params.id, staffId, actor._id, actor.name);
    res.status(200).json({ success: true, request: RepairRequestService.toStaffView(request), message: 'Mitarbeiter zugewiesen.' });
  } catch (error) {
    sendError(res, error, 'Die Zuweisung konnte nicht gespeichert werden.');
  }
});

// Description: Staff matches the device to a catalog model (or corrects the manual data).
//              The customer's original declaration (reportedDevice) is never overwritten.
// Endpoint: PUT /api/repair-requests/:id/device
// Request: { deviceModelId } | { manual: { deviceType, deviceBrand, deviceModel, modelNumber? } }
// Response: { success, request: StaffRepairRequestView, changed: boolean }
router.put('/:id/device', requireStaff, async (req, res) => {
  try {
    const request = await RepairRequestService.updateDevice(req.params.id, req.body || {}, actorOf(req.user));
    res.status(200).json({
      success: true,
      request: RepairRequestService.toStaffView(request),
      changed: request.$locals?.deviceChanged === true,
      message: request.$locals?.deviceChanged ? 'Gerät zugeordnet.' : 'Keine Änderung.',
    });
  } catch (error) {
    sendError(res, error, 'Das Gerät konnte nicht zugeordnet werden.');
  }
});

// Description: Add a legacy message (RepairRequest.messages) – staff only. Kunden/Gäste sehen
//              diesen Altbestand nicht; neue Nachrichten über /api/repair-request-communication.
// Endpoint: POST /api/repair-requests/:id/messages
router.post('/:id/messages', requireStaff, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Bitte eine Nachricht eingeben.' });
    }
    const actor = actorOf(req.user);
    const request = await RepairRequestService.addMessage(req.params.id, actor._id, actor.name, req.user.role, String(message).trim());
    res.status(201).json({ success: true, request: RepairRequestService.toStaffView(request), message: 'Nachricht gespeichert.' });
  } catch (error) {
    sendError(res, error, 'Die Nachricht konnte nicht gespeichert werden.');
  }
});

// Description: Mark legacy messages as read (owner or staff)
// Endpoint: PUT /api/repair-requests/:id/messages/read
router.put('/:id/messages/read', requireUser, async (req, res) => {
  try {
    await RepairRequestService.assertAccess(req.user, req.params.id);
    await RepairRequestService.markMessagesAsRead(req.params.id, req.user._id);
    res.status(200).json({ success: true });
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht als gelesen markiert werden.');
  }
});

// Description: Add internal note ("Intern – nur für das Team")
// Endpoint: POST /api/repair-requests/:id/admin-notes
// Request: { note: string }
router.post('/:id/admin-notes', requireStaff, async (req, res) => {
  try {
    const actor = actorOf(req.user);
    const request = await RepairRequestService.addAdminNote(req.params.id, actor._id, actor.name, req.body?.note);
    res.status(201).json({ success: true, request: RepairRequestService.toStaffView(request), message: 'Interne Notiz gespeichert.' });
  } catch (error) {
    sendError(res, error, 'Die interne Notiz konnte nicht gespeichert werden.');
  }
});

// Description: Update priority
// Endpoint: PUT /api/repair-requests/:id/priority
router.put('/:id/priority', requireStaff, async (req, res) => {
  try {
    const { priority } = req.body || {};
    if (!priority) return res.status(400).json({ success: false, message: 'Bitte eine Priorität wählen.' });
    const actor = actorOf(req.user);
    const request = await RepairRequestService.updatePriority(req.params.id, priority, actor._id, actor.name);
    res.status(200).json({ success: true, request: RepairRequestService.toStaffView(request), message: 'Priorität gespeichert.' });
  } catch (error) {
    sendError(res, error, 'Die Priorität konnte nicht gespeichert werden.');
  }
});

// Description: Kompatibilität – speichert den Kostenvoranschlag nur als ENTWURF (sendet nichts)
// Endpoint: PUT /api/repair-requests/:id/estimated-cost
// Request: { estimatedCost: number }
router.put('/:id/estimated-cost', requireStaff, async (req, res) => {
  try {
    const request = await RepairRequestService.saveQuoteDraft(req.params.id, { amount: req.body?.estimatedCost }, actorOf(req.user));
    res.status(200).json({ success: true, request: RepairRequestService.toStaffView(request), message: 'Entwurf gespeichert (nicht an den Kunden gesendet).' });
  } catch (error) {
    sendError(res, error, 'Der Entwurf konnte nicht gespeichert werden.');
  }
});

// Description: Save Kostenvoranschlag draft (sends nothing)
// Endpoint: PUT /api/repair-requests/:id/quote
// Request: { amount: number (>= 0, brutto EUR), description?: string }
// Response: { success, request: StaffRepairRequestView, changed }
router.put('/:id/quote', requireStaff, async (req, res) => {
  try {
    const request = await RepairRequestService.saveQuoteDraft(req.params.id, req.body || {}, actorOf(req.user));
    res.status(200).json({
      success: true,
      request: RepairRequestService.toStaffView(request),
      changed: request.$locals?.quoteChanged === true,
      message: 'Entwurf gespeichert (nicht an den Kunden gesendet).',
    });
  } catch (error) {
    sendError(res, error, 'Der Entwurf konnte nicht gespeichert werden.');
  }
});

// Description: Publish Kostenvoranschlag to the customer (once per version) + notify once
// Endpoint: POST /api/repair-requests/:id/quote/send
// Request: { amount?: number, description?: string }  (with amount: saves the draft first)
// Response: { success, request: StaffRepairRequestView, alreadySent: boolean,
//             email: { status: 'accepted'|'failed'|null, error } }
router.post('/:id/quote/send', requireStaff, async (req, res) => {
  try {
    const result = await RepairRequestService.sendQuote(req.params.id, req.body || {}, actorOf(req.user));
    res.status(200).json({
      success: true,
      request: RepairRequestService.toStaffView(result.request),
      alreadySent: result.alreadySent,
      email: result.email,
      message: result.alreadySent
        ? 'Dieser Kostenvoranschlag wurde bereits gesendet – es wurde nichts erneut verschickt.'
        : (result.email?.status === 'failed'
          ? 'Kostenvoranschlag veröffentlicht, aber die E-Mail an den Kunden ist fehlgeschlagen.'
          : 'Kostenvoranschlag gesendet.'),
    });
  } catch (error) {
    sendError(res, error, 'Der Kostenvoranschlag konnte nicht gesendet werden.');
  }
});

// Description: Customer (owner) accepts/declines the Kostenvoranschlag. Staff may NOT answer
//              on the customer's behalf.
// Endpoint: POST /api/repair-requests/:id/quote/respond
// Request: { decision: 'accept' | 'decline', quoteVersion: number (Pflicht), amount?: number }
// Response: { success, request: CustomerRepairRequestView }
//           409 { code: 'QUOTE_CHANGED' } wenn der gesehene Stand nicht mehr aktuell ist.
router.post('/:id/quote/respond', requireUser, async (req, res) => {
  try {
    if (RepairRequestService.isStaffUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Mitarbeitende können den Kostenvoranschlag nicht im Namen des Kunden beantworten.' });
    }
    await RepairRequestService.assertAccess(req.user, req.params.id);
    await RepairRequestService.applyQuoteDecision(req.params.id, {
      decision: req.body?.decision,
      responderName: RepairRequestService.actorNameOf(req.user),
      responderId: req.user._id,
      channel: 'customer',
      quoteVersion: req.body?.quoteVersion,
      amount: req.body?.amount,
    });
    const request = await RepairRequestService.getRepairRequestById(req.params.id);
    res.status(200).json({ success: true, request: RepairRequestService.toCustomerView(request) });
  } catch (error) {
    sendError(res, error, 'Die Antwort konnte nicht gespeichert werden.');
  }
});

// Description: Convert repair request to order (atomar; Katalogpreise; Gast bleibt Gast)
// Endpoint: POST /api/repair-requests/:id/convert
// Request: { services: string[], addOns?: AddOn[], shippingMode?: 'none' | 'inbound_label' }
// Response: { success, request, order: { _id, orderNumber, totalCost, bookingId }, booking?: { _id, bookingNumber } }
router.post('/:id/convert', requireStaff, async (req, res) => {
  try {
    const actor = actorOf(req.user);
    const { request, order, booking, shippingMode } = await RepairRequestService.convertToOrder(
      req.params.id,
      req.body || {},
      actor._id,
      actor.name
    );
    res.status(201).json({
      success: true,
      request: RepairRequestService.toStaffView(request),
      order: order ? { _id: order._id, orderNumber: order.orderNumber, totalCost: order.totalCost, bookingId: order.bookingId || null } : null,
      booking: booking ? { _id: booking._id, bookingNumber: booking.bookingNumber } : null,
      shippingMode,
      message: `In Auftrag ${order?.orderNumber || ''} umgewandelt.`.replace('  ', ' '),
    });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht umgewandelt werden.');
  }
});

// Description: Delete repair request
// Endpoint: DELETE /api/repair-requests/:id
router.delete('/:id', requireStaff, async (req, res) => {
  try {
    await RepairRequestService.deleteRepairRequest(req.params.id);
    res.status(200).json({ success: true, message: 'Reparaturanfrage gelöscht.' });
  } catch (error) {
    sendError(res, error, 'Die Anfrage konnte nicht gelöscht werden.');
  }
});

module.exports = router;
