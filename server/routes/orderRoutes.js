const express = require('express');
const OrderService = require('../services/orderService');
const Order = require('../models/Order');
const ComplaintService = require('../services/complaintService');
const Complaint = require('../models/Complaint');
const EmailService = require('../services/emailService');
const DHLService = require('../services/dhlService');
const DHLReturnsService = require('../services/dhlReturnsService');
const NotificationService = require('../services/notificationService');
const OrderRevisionService = require('../services/orderRevisionService');
const OrderHistory = require('../utils/orderHistory');
const User = require('../models/User');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Interne Abgleich-Details einer Versandrichtung (Admin-Endpunkt, Abgleichgrund, Sperrzeit,
// DHL-Referenz) - nur fuer Mitarbeiter. Kunden sehen Status und Sendungsnummern, keine
// internen Aktionsentscheidungen.
const STAFF_ONLY_SHIPMENT_KEYS = ['reconcileUrl', 'reconciliationReason', 'lockStale', 'lockStartedAt', 'reference', 'lockScope'];
// Interner Statustext "... – Abgleich erforderlich" (DHLService.mark*ReconciliationRequired):
// Kunden sehen stattdessen einen neutralen Text.
const INTERNAL_SHIPPING_DESCRIPTION = /Abgleich/i;
const CUSTOMER_PENDING_LABEL_TEXT = 'Versandlabel wird vorbereitet';
const CUSTOMER_PENDING_INBOUND_LABEL_TEXT = 'Einsendelabel wird vorbereitet';
// Dummy-Modus (DHL-5): interner Text "DHL-Dummy-Versandlabel ..." -> klarer Kundentext.
const DUMMY_SHIPPING_DESCRIPTION = /Dummy/i;
const CUSTOMER_DUMMY_LABEL_TEXT = 'Einsendelabel (Testmodus) – nicht für den Versand verwenden';
const toCustomerStatusDescription = (text, neutralText = CUSTOMER_PENDING_LABEL_TEXT) => {
  if (DUMMY_SHIPPING_DESCRIPTION.test(String(text || ''))) return CUSTOMER_DUMMY_LABEL_TEXT;
  return INTERNAL_SHIPPING_DESCRIPTION.test(String(text || '')) ? neutralText : text;
};
const toCustomerShipments = (shipments) => {
  if (!shipments || typeof shipments !== 'object') return shipments;
  const view = { ...shipments };
  // K11: Anschriften je Richtung sind eine reine Team-Ansicht.
  delete view.parties;
  ['outbound', 'inbound'].forEach((direction) => {
    if (!view[direction] || typeof view[direction] !== 'object') return;
    const directionView = { ...view[direction] };
    STAFF_ONLY_SHIPMENT_KEYS.forEach((key) => { delete directionView[key]; });
    if (directionView.statusDescription !== undefined) {
      directionView.statusDescription = toCustomerStatusDescription(
        directionView.statusDescription,
        direction === 'inbound' ? CUSTOMER_PENDING_INBOUND_LABEL_TEXT : CUSTOMER_PENDING_LABEL_TEXT
      );
    }
    view[direction] = directionView;
  });
  if (Array.isArray(view.inboundLabels)) {
    view.inboundLabels = view.inboundLabels.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const entryView = { ...entry };
      STAFF_ONLY_SHIPMENT_KEYS.forEach((key) => { delete entryView[key]; });
      if (entryView.statusDescription !== undefined) {
        entryView.statusDescription = toCustomerStatusDescription(entryView.statusDescription, CUSTOMER_PENDING_INBOUND_LABEL_TEXT);
      }
      return entryView;
    });
  }
  view.outboundAction = { allowed: false, code: 'NOT_PERMITTED', reason: '' };
  view.inboundAction = { allowed: false, code: 'NOT_PERMITTED', reason: '', target: '' };
  return view;
};

// Verlauf fuer Kunden: POSITIVLISTE (OrderHistory.toCustomerView, HIST-15) statt der frueheren
// Ausschlussliste - keine Mitarbeiternamen, Pausengruende, Ersatzteil-/Workflow-Details oder
// DHL-Abgleichtexte. Dieselbe Projektion nutzen Gast-Tracking und GET /:id/history.
const toCustomerOrderView = (order) => {
  if (!order || typeof order !== 'object') return order;
  if (Array.isArray(order.timeline)) {
    order.timeline = OrderHistory.toCustomerView(order.timeline);
  }
  // Personalbezogene Felder (gleiche Projektion wie das Gast-Tracking, HIST-15/K04):
  // addOns[].assignedStaff (Arbeitsplanung), Mitarbeitername in pickupConfirmation, interne
  // Pruefnotiz und Name in unlockConfirmation - nur fuer Mitarbeiter.
  Object.assign(order, OrderHistory.customerOrderOverrides(order));
  if (order.shippingStatusDescription !== undefined) {
    order.shippingStatusDescription = toCustomerStatusDescription(order.shippingStatusDescription);
  }
  if (order.returnShipmentStatusDescription !== undefined) {
    order.returnShipmentStatusDescription = toCustomerStatusDescription(order.returnShipmentStatusDescription, CUSTOMER_PENDING_INBOUND_LABEL_TEXT);
  }
  return order;
};

// Create a new order (customer)
router.post('/', requireUser, async (req, res) => {
  console.log('Create order request received from user:', req.user.email);
  console.log('Order data:', req.body);

  try {
    // Nur Angaben, die ein Kunde bei einer Auftragsanlage wirklich machen darf. Frueher
    // ging req.body komplett in den Auftrag: ein Kunde konnte so u. a. Status, Zahlstatus,
    // Sendungsnummer, Versandlabel oder den Auftragswert selbst setzen. Geldwerte bildet
    // OrderService.create serverseitig aus den Katalogpreisen (Preisregel des Auftrags).
    const CUSTOMER_ORDER_FIELDS = [
      'deviceType', 'deviceBrand', 'deviceModel', 'deviceImage', 'imei', 'serialNumber',
      'services', 'addOns', 'serviceNames', 'customerNotes', 'photos',
      'unlockPattern', 'unlockCode', 'noLock',
      'errorDescription', 'waterDamage', 'previousRepairAttempts', 'previousRepairDetails', 'itemCondition'
    ];
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderData = { customerId: req.user._id };
    CUSTOMER_ORDER_FIELDS.forEach((field) => {
      if (body[field] !== undefined) orderData[field] = body[field];
    });

    const order = await OrderService.create(orderData);

    // Send order confirmation email asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const confirmationData = {
          customerName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
          orderNumber: order.orderNumber,
          deviceBrand: order.deviceBrand || 'Unbekannt',
          deviceModel: order.deviceModel || 'Unbekannt',
          serviceName: order.serviceName || 'Reparatur',
          estimatedCompletion: order.estimatedCompletion || 'innerhalb von 7–10 Werktagen',
          orderId: order._id,
          trackingUrl: await EmailService.buildSystemUrl(`/orders/${order._id}`)
        };

        const emailResult = await EmailService.sendOrderConfirmationEmail(
          req.user.email,
          confirmationData
        );

        if (emailResult.success) {
          console.log('Order confirmation email sent to:', req.user.email);
        } else {
          console.error('Failed to send order confirmation email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Error sending order confirmation email:', emailError.message);
        // Don't block the response - email failure shouldn't affect order creation
      }
    });

    return res.status(201).json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      message: 'Der Auftrag wurde erfolgreich angelegt.'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(400).json({
      error: error.message || 'Der Auftrag konnte nicht angelegt werden.'
    });
  }
});

// Get orders for current user (customer)
router.get('/', requireUser, async (req, res) => {
  console.log('Get orders request received from user:', req.user.email);

  try {
    const filters = {
      status: req.query.status
    };

    const orders = await OrderService.getByCustomer(req.user._id, filters);
    
    console.log('Orders route: Returning orders response:', JSON.stringify({ orders }, null, 2));

    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Error getting orders:', error);
    return res.status(500).json({
      error: error.message || 'Die Aufträge konnten nicht geladen werden.'
    });
  }
});

// Get single order by ID (customer)
router.get('/:id', requireUser, async (req, res) => {
  console.log('Get order by ID request received:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check if user owns this order - fix the access control check
    const orderCustomerId = order.customerId ? String(order.customerId._id || order.customerId) : '';
    const currentUserId = req.user._id.toString();

    console.log('Access control check - Order customer ID:', orderCustomerId);
    console.log('Access control check - Current user ID:', currentUserId);
    console.log('Access control check - User role:', req.user.role);

    // Allow access if user owns the order OR if user is admin/staff
    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      console.log('Access denied - User does not own order and is not admin/staff');
      return res.status(403).json({
        error: 'Zugriff verweigert.'
      });
    }

    console.log('Access granted - returning order details');

    // Versandstand GETRENNT nach Richtung (Einsendung / Auslieferung) und die serverseitige
    // Entscheidung, ob "An Kunden versenden" moeglich ist - die Oberflaeche rendert genau das.
    try {
      const shipmentState = await DHLService.getOrderShipmentState(order._id);
      order.shipments = ['admin', 'staff'].includes(req.user.role)
        ? shipmentState.shipments
        : toCustomerShipments(shipmentState.shipments);
      order.hasShippingLabel = shipmentState.shipments.outbound.hasLabel;
    } catch (shipmentStateError) {
      console.error('Order detail: shipment state could not be resolved:', shipmentStateError.message);
    }
    // Das Label-PDF (Base64, mehrere hundert KB) gehoert nicht in die Detailantwort; der
    // Download laeuft ueber GET /api/orders/:id/shipping-label.
    if (order.shippingLabelUrl) {
      order.shippingLabelUrl = '';
    }
    if (!['admin', 'staff'].includes(req.user.role)) {
      toCustomerOrderView(order);
    }

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error getting order by ID:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Der Auftrag konnte nicht geladen werden.'
    });
  }
});

// Description: Get order progress timeline with milestone data
// Endpoint: GET /api/orders/:id/progress-timeline
// Request: {}
// Response (ehrliche Meilensteine, OrderHistory.buildMilestones):
//   { stages: Array<{ id, label, state: 'reached'|'current'|'skipped'|'pending',
//       status: 'completed'|'in-progress'|'skipped'|'pending' (Altfeld), reachedAt: ISO|null,
//       timeKnown, date: 'TT.MM.JJJJ, HH:MM'|null, detail|null, note|null,
//       actorName?|null, sourceEntryId?|null (nur Personal) }>,
//     currentStage: string, orderStatus, progress, paused, cancelled }
router.get('/:id/progress-timeline', requireUser, async (req, res) => {
  console.log('Get order progress timeline request received for order:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check if user owns this order or is admin/staff
    const orderCustomerId = order.customerId ? String(order.customerId._id || order.customerId) : '';
    const currentUserId = req.user._id.toString();

    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      console.log('Access denied - User does not own order and is not admin/staff');
      return res.status(403).json({
        error: 'Zugriff verweigert.'
      });
    }

    const timeline = await OrderService.getProgressTimeline(req.params.id, {
      forCustomer: !['admin', 'staff'].includes(req.user.role),
    });
    console.log('Progress timeline retrieved successfully for order:', req.params.id);

    return res.status(200).json(timeline);
  } catch (error) {
    console.error('Error getting order progress timeline:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    return res.status(500).json({
      error: 'Der Fortschrittsverlauf konnte nicht geladen werden.'
    });
  }
});

// Description: Zusammengefuehrter Auftragsverlauf (Lesemodell, schreibt nichts)
// Endpoint: GET /api/orders/:id/history?types=status,pricing&before=<cursor>&limit=100
// Zugriff: Personal/Admin -> vollstaendig (Verlauf + nicht verknuepfte Revisionen + Rechnungen +
//   Zahlungen + Alt-Zeitstempel Reparatur-Workflow/Eingangspruefung) mit Akteur, Quelle,
//   Aenderungen, Grund, refs und link. Eigentuemer (Kunde) -> nur Positivliste
//   (OrderHistory.toCustomerView). Fremde Kunden sowie unbekannte/ungueltige IDs -> 403
//   (keine Existenzpruefung), Personal: 404 bei unbekannter ID.
// Query: types = kommagetrennte Liste aus OrderHistory.TYPES; before = nextCursor der
//   vorherigen Seite; limit 1..300 (Standard 100).
// Response: { success, orderId, orderNumber, entries: HistoryEntry[], total, nextCursor|null,
//   groups: [{ id, label, types, count }], milestones (wie /progress-timeline) }
//   HistoryEntry (Personal): { id, at: ISO|null, timeKnown, timeNote, key, type, typeLabel, title,
//     description, actor: { id|null, name }, source, changes: [{ field, label, from, to, fromText,
//     toText }], reason|null, refs|null, link: { kind, id, label, href|null, apiUrl|null }|null,
//     visibility: 'customer'|'staff', eventKey|null, origin }
//   HistoryEntry (Kunde): { id, at, timeKnown, timeNote, key, type, typeLabel, title, description, origin }
router.get('/:id/history', requireUser, async (req, res) => {
  const isPrivileged = ['admin', 'staff'].includes(req.user.role);
  const deny = () => (isPrivileged
    ? res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' })
    : res.status(403).json({ success: false, error: 'Zugriff verweigert.' }));
  try {
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id || ''))) {
      return deny();
    }
    const owner = await Order.findById(req.params.id).setOptions({ skipAutoPopulate: true }).select('customerId').lean();
    if (!owner || (!isPrivileged && String(owner.customerId || '') !== String(req.user._id))) {
      return deny();
    }
    const types = String(req.query.types || '')
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean);
    const unknownTypes = types.filter((type) => !OrderHistory.TYPES.includes(type));
    if (unknownTypes.length) {
      return res.status(400).json({
        success: false,
        error: `Unbekannte Eintragsart: ${unknownTypes.join(', ')}. Erlaubt: ${OrderHistory.TYPES.join(', ')}.`,
      });
    }
    const result = await OrderService.getOrderHistory(req.params.id, {
      viewer: { isStaff: isPrivileged },
      types,
      before: typeof req.query.before === 'string' ? req.query.before : undefined,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error loading order history:', error);
    if (error && error.statusCode === 404) return deny();
    return res.status(500).json({ success: false, error: 'Der Verlauf konnte nicht geladen werden.' });
  }
});

// Description: Create a complaint for an order (customer)
// Endpoint: POST /api/orders/:orderId/complaint
// Request: { reason: string, description: string }
// Response: { success: boolean, complaint: Complaint }
router.post('/:orderId/complaint', requireUser, async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({
        success: false,
        error: 'Bitte Grund und Beschreibung der Reklamation angeben.'
      });
    }

    const order = await OrderService.getById(req.params.orderId);
    const orderCustomerId = order.customerId?._id ? order.customerId._id.toString() : order.customerId.toString();
    if (orderCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Eine Reklamation ist erst nach Abschluss des Auftrags möglich.'
      });
    }

    const existingOpenComplaint = await Complaint.findOne({
      orderId: order._id,
      status: { $in: ['pending_approval', 'approved', 'acknowledged', 'denied', 'new_repair'] }
    });

    if (existingOpenComplaint) {
      return res.status(409).json({
        success: false,
        error: 'Für diesen Auftrag läuft bereits eine Reklamation.',
        complaintId: existingOpenComplaint._id
      });
    }

    const complaintData = {
      bookingId: order.bookingId || null,
      orderId: order._id,
      customerId: req.user._id,
      subject: `Reklamation für Auftrag ${order.orderNumber}`,
      description,
      category: 'service',
      priority: 'medium',
      status: 'pending_approval',
      workflowType: 'order-complaint',
      complaintReason: reason,
      complaintLogs: [{
        actorId: req.user._id,
        actorName: req.user.firstName
          ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
          : (req.user.name || req.user.email),
        actorRole: req.user.role,
        action: 'complaint_created',
        fromStatus: '',
        toStatus: 'pending_approval',
        notes: reason,
        metadata: {
          reason,
          description
        }
      }]
    };

    // Die Nummer vergibt das Modell (CMP-JJJJ-NNNN). Frueher wurde sie hier mit "R<Auftrags-ID>"
    // ueberschrieben, was Kunden und Personal als unlesbare Kennung angezeigt bekamen.
    const complaint = await ComplaintService.create(complaintData);

    await Order.updateOne(
      { _id: order._id },
      { $set: { hasComplaint: true, complaintReason: reason } }
    );

    const admins = await User.find({ role: 'admin', isActive: true }).select('_id email');
    const customerName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : (req.user.name || req.user.email);

    await Promise.all(admins.map(async (admin) => {
      try {
        await NotificationService.createNotification({
          userId: admin._id,
          title: 'Neue Reklamation',
          message: `${customerName} hat eine Reklamation für Auftrag ${order.orderNumber} gemeldet.`,
          type: 'system',
          orderId: order._id,
          actionUrl: `/admin/complaints?complaintId=${complaint._id}`,
          metadata: {
            complaintId: complaint._id,
            orderNumber: order.orderNumber,
            reason
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
            orderStatus: 'Neue Reklamation',
            statusMessage: `${customerName} hat eine Reklamation gemeldet: ${reason}`,
            statusUpdatedAt: new Date().toLocaleDateString('de-DE'),
            trackingUrl: await EmailService.buildSystemUrl('/admin/complaints'),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        }
      } catch (notifyError) {
        console.error('Error notifying admin about complaint:', notifyError.message);
      }
    }));

    // Notify customer with complaint-created template
    try {
      if (req.user?.email) {
        await EmailService.sendTriggerEmail('complaint_created', req.user.email, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName,
          complaintNumber: complaint.complaintNumber,
          complaintCategory: complaint.category || 'service',
          complaintSubject: complaint.subject || `Reklamation für Auftrag ${order.orderNumber}`,
          orderNumber: order.orderNumber,
          priority: complaint.priority || 'medium',
          submittedAt: new Date().toLocaleDateString('de-DE'),
          complaintUrl: await EmailService.buildSystemUrl(`/my-complaints/${complaint._id}`),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (customerNotifyError) {
      console.error('Error notifying customer about complaint creation:', customerNotifyError.message);
    }

    return res.status(201).json({
      success: true,
      complaint,
      message: 'Die Reklamation wurde übermittelt.'
    });
  } catch (error) {
    console.error('Error creating complaint for order:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Die Reklamation konnte nicht angelegt werden.'
    });
  }
});

// ============================================
// SHIPPING & TRACKING ROUTES
// ============================================

// Description: Auslieferung an den Kunden (McRepair -> Kunde) - "An Kunden versenden"
// Endpoint: POST /api/orders/:id/shipping/create-label
// Request: { shipmentData?: { weight?, product?, serviceType?, shipmentDate?, shippingCost? } }
//   Absender ist IMMER der in der DHL-Integration hinterlegte Shop, Empfaenger IMMER die
//   Lieferadresse des Kunden. Absender-/Empfaengerfelder, Abrechnungsnummer und rohe DHL-
//   Payloads aus dem Request werden ignoriert.
// Response: { success, direction: 'outbound', trackingNumber, labelDownloadUrl, estimatedDelivery, alreadyExists? }
router.post('/:id/shipping/create-label', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Create outbound shipping label request received for order:', req.params.id);

  try {
    const requested = (req.body && typeof req.body.shipmentData === 'object' && req.body.shipmentData) || req.body || {};
    const allowed = ['weight', 'product', 'serviceType', 'shipmentDate', 'shippingCost', 'length', 'width', 'height', 'sendDimensions'];
    const shipmentData = {};
    allowed.forEach((key) => {
      if (requested[key] !== undefined && requested[key] !== null && requested[key] !== '') {
        shipmentData[key] = requested[key];
      }
    });
    // Nur die angebotenen DHL-Paket-Produkte (DHLService.OFFERED_PRODUCTS, gespiegelt in
    // client/src/api/shipping.ts) UND das in der DHL-Integration konfigurierte Produkt; alte
    // Kurzcodes P/N/Y und Kleinschreibung werden normalisiert. Geprueft wird - wie im Service
    // (DHLService.resolveShippingProduct) - nur das Feld, das der Service verwendet: product,
    // sonst serviceType. Ein anderer Code wird mit 400 abgelehnt - vor jedem DHL-Aufruf und
    // ohne ihn still durch ein anderes Produkt zu ersetzen. Ist die Integration nicht lesbar,
    // entscheidet der Service (er meldet dann die fehlende Konfiguration).
    const productField = shipmentData.product !== undefined ? 'product' : (shipmentData.serviceType !== undefined ? 'serviceType' : null);
    if (productField) {
      let configuredProduct = null;
      try {
        configuredProduct = DHLService.getParcelDEConfig(await DHLService.getDHLConfig()).product || '';
      } catch (configError) {
        console.warn('Create label: DHL configuration not readable for product check:', configError.message);
      }
      if (configuredProduct !== null) {
        try {
          shipmentData[productField] = DHLService.resolveShippingProduct({ product: shipmentData[productField] }, configuredProduct);
        } catch (productError) {
          return res.status(productError.status || 400).json({
            success: false,
            error: productError.message,
            message: productError.message,
            code: productError.code || 'DHL_PRODUCT_NOT_OFFERED',
            retryable: false,
            details: Array.isArray(productError.details) ? productError.details : []
          });
        }
      }
    }
    // Versandkosten: nur eine Zahl >= 0 wird uebernommen; ohne Angabe bleibt der am Auftrag
    // gespeicherte Wert erhalten (DHLService ueberschreibt ihn dann nicht).
    if (shipmentData.shippingCost !== undefined) {
      const cost = Number(shipmentData.shippingCost);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(422).json({
          success: false,
          error: 'Die Versandkosten müssen eine Zahl größer oder gleich 0 sein.',
          message: 'Die Versandkosten müssen eine Zahl größer oder gleich 0 sein.',
          code: 'SHIPPING_COST_INVALID',
          retryable: false,
          details: []
        });
      }
      shipmentData.shippingCost = cost;
    }

    // HIST-16: handelnde Person fuer den Verlaufseintrag "Versandlabel erstellt".
    const result = await DHLService.createShipment(req.params.id, shipmentData, { direction: 'outbound', actor: req.user });

    console.log('Outbound shipping label created successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error creating shipping label:', error.message);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Versandlabel konnte nicht erstellt werden.',
      message: error.message || 'Versandlabel konnte nicht erstellt werden.',
      code: error.code || 'LABEL_CREATION_FAILED',
      retryable: error.retryable === true,
      details: Array.isArray(error.details) ? error.details : []
    });
  }
});

// Description: Versandstand eines Auftrags getrennt nach Richtung (Einsendung / Auslieferung)
//   inklusive der serverseitigen Entscheidung, welche Label-Aktion moeglich ist. Die
//   Auftragsdetailseite (Admin, Staff UND Kunde) liest genau diese Antwort - Admin/Staff laden
//   den Auftrag selbst ueber /api/admin/orders/:id, der Versandstand kommt fuer alle von hier.
// Endpoint: GET /api/orders/:id/shipments
// Response: { success, shipments: { outbound, inbound, inboundLabels, outboundAction, inboundAction, legacy } }
router.get('/:id/shipments', requireUser, async (req, res) => {
  // Kunden bekommen fuer fremde, fehlende und ungueltige Auftrags-IDs DIESELBE Antwort (403) -
  // sonst liesse sich ueber 403/404 erkennen, welche Auftraege existieren. Die Besitzpruefung
  // kommt VOR der (aufwendigen) Versandstand-Berechnung.
  const isPrivileged = ['admin', 'staff'].includes(req.user.role);
  const deny = () => (isPrivileged
    ? res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' })
    : res.status(403).json({ success: false, error: 'Zugriff verweigert.' }));
  try {
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id || ''))) {
      return deny();
    }
    const owner = await Order.findById(req.params.id).setOptions({ skipAutoPopulate: true }).select('customerId').lean();
    const orderCustomerId = owner?.customerId ? String(owner.customerId) : '';
    if (!owner || (!isPrivileged && orderCustomerId !== String(req.user._id))) {
      return deny();
    }

    const state = await DHLService.getOrderShipmentState(req.params.id);
    // Kunden sehen den Versandstand, aber keine internen Aktionsentscheidungen/Abgleich-Details.
    const shipments = isPrivileged ? state.shipments : toCustomerShipments(state.shipments);
    if (isPrivileged) {
      // K11: Absender/Empfaenger je Richtung (gleiche Quellen wie die Label-Erstellung) - NUR
      // fuer das Team; ein Fehler hier darf den Versandstand nicht verdecken.
      try {
        shipments.parties = await DHLService.getShipmentPartiesForStaff(req.params.id);
      } catch (partiesError) {
        console.error('Order shipments: parties could not be resolved:', partiesError.message);
        shipments.parties = null;
      }
    }
    return res.status(200).json({ success: true, shipments });
  } catch (error) {
    console.error('Error loading order shipments:', error.message);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({ success: false, error: error.message || 'Der Versandstand konnte nicht geladen werden.' });
  }
});

// Description: Einsendestatus (Kunde -> McRepair) fuer die Auftragsdetailseite - Inhaber oder Team.
//   Mit Buchung: identisch mit GET /api/bookings/:bookingId/inbound-label (ein Paket fuer alle
//   Geraete der Buchung, Erstellung durch den Inhaber ueber POST /api/bookings/:bookingId/inbound-label).
//   Ohne Buchung: aus dem Versandstand des Auftrags (Erstellung nur durch das Team).
// Endpoint: GET /api/orders/:id/inbound-label
// Response: { success, scope: 'booking'|'order', orderId, booking|null, orders, inbound } (Form siehe bookingRoutes)
router.get('/:id/inbound-label', requireUser, async (req, res) => {
  const isPrivileged = ['admin', 'staff'].includes(req.user.role);
  const deny = () => (isPrivileged
    ? res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' })
    : res.status(403).json({ success: false, error: 'Zugriff verweigert.' }));
  try {
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id || ''))) {
      return deny();
    }
    const owner = await Order.findById(req.params.id).setOptions({ skipAutoPopulate: true })
      .select('customerId bookingId orderNumber deviceBrand deviceModel deviceType status').lean();
    if (!owner || (!isPrivileged && String(owner.customerId || '') !== String(req.user._id))) {
      return deny();
    }

    const BookingService = require('../services/bookingService');
    const Booking = require('../models/Booking');
    const booking = owner.bookingId
      ? { _id: owner.bookingId }
      : await Booking.findOne({ $or: [{ orderIds: owner._id }, { repairOrderIds: owner._id }] })
        .setOptions({ skipAutoPopulate: true }).select('_id').lean();
    if (booking) {
      const view = await BookingService.getInboundLabelState(booking._id, { includeStaffFields: isPrivileged });
      if (view) {
        return res.status(200).json({ success: true, scope: 'booking', orderId: String(owner._id), ...view });
      }
    }

    // Auftrag ohne Buchung: Einsendung am Auftrag (DHL-Retoure), nur durch das Team erstellbar.
    const isProduct = owner.deviceType === 'Shop Products';
    const { shipments } = await DHLService.getOrderShipmentState(owner._id);
    const shipmentInbound = shipments.inbound || {};
    const inbound = {
      state: 'none',
      canCreate: false,
      message: 'Ihr DHL-Einsendelabel erstellt unser Team. Sie erhalten es per E-Mail.',
      trackingNumber: shipmentInbound.trackingNumber || '',
      downloadUrl: shipmentInbound.hasLabel ? shipmentInbound.downloadUrl : '',
      filename: shipmentInbound.hasLabel ? `DHL-Einsendelabel_${String(owner.orderNumber || owner._id).replace(/[^A-Za-z0-9\-_]/g, '')}.pdf` : '',
      source: shipmentInbound.source || '',
      placeholder: Boolean(shipmentInbound.placeholder),
      shippingStatus: shipmentInbound.status || '',
      deviceReceived: Boolean(owner.status && owner.status !== 'pending'),
    };
    if (isProduct) {
      Object.assign(inbound, { state: 'not-needed', message: 'Für Shop-Artikel ist keine Einsendung nötig.' });
    } else if (shipmentInbound.hasLabel) {
      Object.assign(inbound, { state: 'ready', message: 'Drucken Sie das kostenlose DHL-Einsendelabel aus und geben Sie das Paket bei DHL ab.' });
    } else if (shipmentInbound.trackingNumber) {
      Object.assign(inbound, { state: 'registered', message: `Ihr DHL-Einsendelabel ist bei DHL angelegt (Sendungsnummer ${shipmentInbound.trackingNumber}). Das PDF senden wir Ihnen per E-Mail zu.` });
    } else if (shipmentInbound.reconciliationRequired) {
      Object.assign(inbound, { state: 'review', message: 'Ihr Einsendelabel wird geprüft. Bitte nicht erneut erstellen – wir melden uns per E-Mail, sobald es bereitsteht.' });
    } else if (shipmentInbound.inProgress) {
      Object.assign(inbound, { state: 'creating', message: 'Ihr DHL-Einsendelabel wird erstellt …' });
    } else if (owner.status === 'cancelled') {
      Object.assign(inbound, { state: 'cancelled', message: 'Der Auftrag wurde storniert – bitte kein Gerät einsenden.' });
    }
    return res.status(200).json({
      success: true,
      scope: 'order',
      orderId: String(owner._id),
      booking: null,
      orders: [{
        orderId: String(owner._id),
        orderNumber: owner.orderNumber || '',
        type: isProduct ? 'product' : 'repair',
        device: isProduct ? 'Shop-Artikel' : `${owner.deviceBrand || ''} ${owner.deviceModel || ''}`.trim(),
        status: owner.status || 'pending',
      }],
      inbound,
    });
  } catch (error) {
    console.error('Error loading order inbound label state:', error.message);
    return res.status(500).json({ success: false, error: 'Der Status des Einsendelabels konnte nicht geladen werden.' });
  }
});

// Description: Offenen Abgleich nach unklarer DHL-Antwort abschliessen (nur Administratoren)
// Endpoint: POST /api/orders/:id/shipping/reconcile
// Request: { resolution: 'not-created' | 'created', trackingNumber?: string }
// Response: { success, shipments }
router.post('/:id/shipping/reconcile', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const shipments = await DHLService.reconcileOutboundShipment(
      req.params.id,
      { resolution: req.body?.resolution, trackingNumber: req.body?.trackingNumber },
      req.user
    );
    return res.status(200).json({ success: true, shipments, message: 'Der Abgleich wurde abgeschlossen.' });
  } catch (error) {
    console.error('Error reconciling shipping label:', error.message);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Der Abgleich konnte nicht abgeschlossen werden.',
      code: error.code || 'RECONCILIATION_FAILED'
    });
  }
});

// Description: Get tracking information for an order
// Endpoint: GET /api/orders/:id/tracking

// Description: Download shipping label PDF for an order
// Endpoint: GET /api/orders/:id/shipping-label
// Request: {}
// Response: PDF file download
router.get('/:id/shipping-label', requireUser, async (req, res) => {
  try {
    // includeLabelData: das Base64-PDF wird nur fuer diesen Download projiziert.
    const order = await OrderService.getById(req.params.id, { includeLabelData: true });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' });
    }

    const orderCustomerId = order.customerId ? String(order.customerId._id || order.customerId) : '';
    if (orderCustomerId !== req.user._id.toString() && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    // Dieser Download ist die AUSLIEFERUNG (McRepair -> Kunde). Eine Einsendelabel-Kopie im
    // Auslieferungsfeld (Altbestand) darf hier NIE ausgeliefert werden - sonst klebt ein
    // an McRepair adressiertes Label auf dem Paket fuer den Kunden.
    const shipmentState = await DHLService.getOrderShipmentState(order._id);
    if (!order.shippingLabelUrl || !shipmentState.shipments.outbound.hasLabel) {
      return res.status(404).json({
        success: false,
        error: shipmentState.shipments.outbound.trackingNumber
          ? `Für die Auslieferung (Sendungsnummer ${shipmentState.shipments.outbound.trackingNumber}) liegt kein PDF-Label vor. Bitte das Label im DHL-Geschäftskundenportal abrufen.`
          : 'Für diesen Auftrag ist kein Auslieferungslabel hinterlegt.'
      });
    }

    const base64Match = order.shippingLabelUrl.match(/^data:application\/pdf;base64,(.+)$/);
    if (!base64Match) {
      return res.redirect(order.shippingLabelUrl);
    }

    const pdfBuffer = Buffer.from(base64Match[1], 'base64');
    // Einheitlicher Dateiname der Auslieferung (McRepair -> Kunde).
    const filename = `DHL-Versandlabel_${String(order.orderNumber || order._id).replace(/[^A-Za-z0-9\-_]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading shipping label:', error);
    return res.status(500).json({ success: false, error: 'Das Versandlabel konnte nicht heruntergeladen werden.' });
  }
});

// Description: EINSENDElabel per DHL-Retoure fuer einen Auftrag ohne Buchung.
//   ACHTUNG Richtung: bei der DHL-Retoure ist der KUNDE der Absender und McRepair (receiverId)
//   der Empfaenger - das ist die Einsendung (Kunde -> McRepair), KEIN Versand an den Kunden.
//   Die Auslieferung laeuft ueber POST /:id/shipping/create-label.
// Endpoint: POST /api/orders/:id/return-label
// Response: { success: boolean, returnId, returnTrackingNumber, labelUrl, qrCodeUrl }
router.post('/:id/return-label', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Create order inbound (DHL Retoure) label request received for order:', req.params.id);

  try {
    // Mit Buchung gehoert das Einsendelabel an die Buchung (ein Paket fuer alle Geraete);
    // ein zweites Einsendelabel am Auftrag waere ein doppelt bezahltes Label.
    const state = await DHLService.getOrderShipmentState(req.params.id);
    const bookingInbound = state.shipments.inboundLabels.find((entry) => entry.source !== 'order' && (entry.hasLabel || entry.trackingNumber));
    if (bookingInbound) {
      return res.status(409).json({
        success: false,
        code: 'INBOUND_LABEL_EXISTS',
        error: `Für die Einsendung existiert bereits ein Label an der Buchung${bookingInbound.trackingNumber ? ` (Sendungsnummer ${bookingInbound.trackingNumber})` : ''}.`,
        message: 'Für die Einsendung existiert bereits ein Label an der Buchung.'
      });
    }

    // actor (HIST-16) immer aus der Anmeldung, nie aus dem Body.
    const result = await DHLReturnsService.createReturnLabelForOrder(req.params.id, { ...(req.body || {}), actor: req.user });
    return res.status(200).json({ ...result, direction: 'inbound' });
  } catch (error) {
    console.error('Error creating order inbound label:', error.message);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Einsendelabel konnte nicht erstellt werden.',
      message: error.message || 'Einsendelabel konnte nicht erstellt werden.',
      code: error.code || 'LABEL_CREATION_FAILED',
      retryable: error.retryable === true
    });
  }
});

// Description: Offenen Abgleich der EINSENDUNG am Auftrag abschliessen (nur Administratoren) -
//   nach unklarer DHL-Antwort bei DHL-Retoure bzw. Parcel-DE-Einsendelabel (Reklamation) oder
//   bei einer verwaisten Reservierung. Spiegelt POST /:id/shipping/reconcile.
// Endpoint: POST /api/orders/:id/return-label/reconcile
// Request: { resolution: 'not-created' | 'created', trackingNumber?: string }
// Response: { success, shipments }
router.post('/:id/return-label/reconcile', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const shipments = await DHLService.reconcileInboundShipment(
      req.params.id,
      { resolution: req.body?.resolution, trackingNumber: req.body?.trackingNumber },
      req.user
    );
    return res.status(200).json({ success: true, shipments, message: 'Der Abgleich der Einsendung wurde abgeschlossen.' });
  } catch (error) {
    console.error('Error reconciling inbound label:', error.message);
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Der Abgleich konnte nicht abgeschlossen werden.',
      code: error.code || 'RECONCILIATION_FAILED'
    });
  }
});

// Description: Download return label PDF for an order
// Endpoint: GET /api/orders/:id/return-label
// Response: PDF file download
router.get('/:id/return-label', requireUser, async (req, res) => {
  try {
    // includeLabelData: the stored base64 PDF is only projected for this download
    // route, not for the normal order detail / polling payloads.
    const order = await OrderService.getById(req.params.id, { includeLabelData: true });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' });
    }

    const orderCustomerId = order.customerId ? String(order.customerId._id || order.customerId) : '';
    if (orderCustomerId !== req.user._id.toString() && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Zugriff verweigert.' });
    }

    if (!order.returnLabelUrl) {
      return res.status(404).json({ success: false, error: 'Für diesen Auftrag ist kein Einsendelabel hinterlegt.' });
    }

    const base64Match = order.returnLabelUrl.match(/^data:application\/pdf;base64,(.+)$/);
    if (!base64Match) {
      return res.redirect(order.returnLabelUrl);
    }

    const pdfBuffer = Buffer.from(base64Match[1], 'base64');
    // Der return*-Platz des Auftrags ist die EINSENDUNG (Kunde -> McRepair).
    const filename = `DHL-Einsendelabel_${String(order.orderNumber || order._id).replace(/[^A-Za-z0-9\-_]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading order return label:', error);
    return res.status(500).json({ success: false, error: 'Das Rücksendelabel konnte nicht heruntergeladen werden.' });
  }
});

// Description: Get tracking information for an order
// Endpoint: GET /api/orders/:id/tracking
router.get('/:id/tracking', requireUser, async (req, res) => {
  console.log('Get tracking info request received for order:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check access
    const orderCustomerId = order.customerId ? String(order.customerId._id || order.customerId) : '';
    const currentUserId = req.user._id.toString();

    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Zugriff verweigert.'
      });
    }

    // Nur die AUSLIEFERUNG (McRepair -> Kunde): eine Kopie des Einsendelabels im
    // Versandfeld (Altbestand) ist nicht die Sendung, die der Kunde erwartet.
    const shipmentState = await DHLService.getOrderShipmentState(order._id);
    const outboundTrackingNumber = shipmentState.shipments.outbound.trackingNumber;
    if (!outboundTrackingNumber) {
      return res.status(404).json({
        success: false,
        error: 'Für die Auslieferung dieses Auftrags ist noch keine Sendungsnummer hinterlegt.'
      });
    }

    // Get latest tracking info from DHL
    const trackingInfo = await DHLService.getTrackingInfo(outboundTrackingNumber);

    console.log('Tracking info retrieved successfully');
    return res.status(200).json({
      ...trackingInfo,
      order: {
        orderNumber: order.orderNumber,
        shippingStatus: order.shippingStatus,
        estimatedDelivery: order.estimatedDelivery,
        actualDelivery: order.actualDelivery,
        trackingEvents: order.trackingEvents
      }
    });
  } catch (error) {
    console.error('Error getting tracking info:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Die Sendungsverfolgung konnte nicht geladen werden.'
    });
  }
});

// Description: Update order tracking from DHL API
// Endpoint: PUT /api/orders/:id/tracking/update
// Request: {}
// Response: { success: boolean, order: Order, trackingInfo: Object }
router.put('/:id/tracking/update', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Update order tracking request received for order:', req.params.id);

  try {
    const result = await DHLService.updateOrderTracking(req.params.id);

    console.log('Order tracking updated successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating order tracking:', error);
    return res.status(Number.isInteger(error.status) ? error.status : 500).json({
      success: false,
      error: error.message || 'Die Sendungsverfolgung konnte nicht aktualisiert werden.'
    });
  }
});

// Description: Update order status and send notification email to customer
// Endpoint: PUT /api/orders/:id/status
// Request: { status: one of Order.ORDER_STATUSES, statusMessage?: string (Hinweis AN DEN KUNDEN),
//            reason?: string (nur Verlauf, intern) }
// Response: { success: boolean, order: Order, unchanged?: true }
router.put('/:id/status', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Update order status request received for order:', req.params.id);

  try {
    const { status, statusMessage, reason, reopen } = req.body || {};
    if (reopen === true && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Nur Administratoren können eine Stornierung aufheben.', code: 'REOPEN_ADMIN_ONLY' });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Bitte einen Status angeben.'
      });
    }
    if (!Order.ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Unbekannter Auftragsstatus.', code: 'INVALID_ORDER_STATUS' });
    }

    // Update order status via service (Benachrichtigung zentral in OrderService.updateStatus;
    // statusMessage ist hier ausdruecklich der Kundenhinweis dieser Route).
    const order = await OrderService.updateStatus(req.params.id, status, null, req.user._id, {
      reason: typeof reason === 'string' ? reason.trim() : '',
      customerMessage: typeof statusMessage === 'string' ? statusMessage.trim() : '',
      source: reopen === true ? 'Storno aufheben' : 'Statusmenü',
      reopen: reopen === true,
    });
    const unchanged = Boolean(order?.$locals?.unchanged);

    return res.status(200).json({
      success: true,
      order,
      unchanged: unchanged || undefined,
      message: unchanged
        ? 'Der Auftrag hat bereits diesen Status – keine Änderung gespeichert.'
        : 'Der Auftragsstatus wurde aktualisiert.'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(Number(error?.statusCode) || 400).json({
      success: false,
      error: error?.statusCode ? error.message : 'Der Auftragsstatus konnte nicht aktualisiert werden.',
      code: error?.code || undefined,
    });
  }
});

// Kunden sehen in der Historie IHRES Auftrags nur Zeitpunkt, Anlass, Betraege und Positionen -
// keine Mitarbeiternamen/-IDs (changedBy, changedByName) und keine internen Notizen (notes).
const CUSTOMER_REVISION_FIELDS = [
  '_id', 'orderId', 'revisionNumber', 'triggerReason',
  'previousGrossAmount', 'newGrossAmount', 'deltaGrossAmount', 'snapshotItems', 'createdAt'
];
const toCustomerRevision = (revision) => CUSTOMER_REVISION_FIELDS.reduce((view, key) => {
  if (revision && revision[key] !== undefined) view[key] = revision[key];
  return view;
}, {});

// Description: Get order revisions (history of modifications)
// Endpoint: GET /api/orders/:id/revisions
// Zugriff: Personal/Admin -> vollstaendige Historie; Kunde -> nur fuer den EIGENEN Auftrag und
//   gefiltert (toCustomerRevision). Fremde, fehlende und ungueltige IDs bekommen Kunden
//   einheitlich als 403 (wie GET /:id/shipments - keine Existenzpruefung ueber 403/404).
// Response: { success, revisions }
router.get('/:id/revisions', requireUser, async (req, res) => {
  const isPrivileged = ['admin', 'staff'].includes(req.user.role);
  const deny = () => (isPrivileged
    ? res.status(404).json({ success: false, error: 'Auftrag wurde nicht gefunden.' })
    : res.status(403).json({ success: false, error: 'Zugriff verweigert.' }));
  try {
    if (!/^[a-f0-9]{24}$/i.test(String(req.params.id || ''))) {
      return deny();
    }
    const owner = await Order.findById(req.params.id).setOptions({ skipAutoPopulate: true }).select('customerId').lean();
    const orderCustomerId = owner?.customerId ? String(owner.customerId) : '';
    if (!owner || (!isPrivileged && orderCustomerId !== String(req.user._id))) {
      return deny();
    }

    const revisions = await OrderRevisionService.getOrderRevisions(req.params.id);
    return res.status(200).json({
      success: true,
      revisions: isPrivileged ? revisions : revisions.map(toCustomerRevision)
    });
  } catch (error) {
    console.error('Error fetching order revisions:', error);
    return res.status(500).json({
      success: false,
      error: 'Die Auftragshistorie konnte nicht geladen werden.'
    });
  }
});

// Description: DHL webhook endpoint for automatic status updates
// Endpoint: POST /api/orders/tracking/webhook
// Request: { trackingNumber: string, status: string, events: Array }
// Response: { success: boolean, message: string }
router.post('/tracking/webhook', async (req, res) => {
  console.log('DHL webhook received:', JSON.stringify(req.body));

  try {
    const result = await DHLService.handleWebhook(req.body);

    console.log('Webhook processed successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
});

module.exports = router;