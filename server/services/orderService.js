const Order = require('../models/Order');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const NeedList = require('../models/NeedList');
const Product = require('../models/Product');
const Complaint = require('../models/Complaint');
const Service = require('../models/Service');
const { WorkflowTemplate, AddOnWorkflow } = require('../models/Workflow');
const WorkflowService = require('./workflowService');
const NotificationService = require('./notificationService');
const OrderRevisionService = require('./orderRevisionService');
const FinancialService = require('./financialService');
const CalculationHelper = require('./calculationHelper');
const AddOnService = require('../models/AddOnService');
const mongoose = require('mongoose');

// Projection used by OrderService.getById. This is an explicit ALLOW list on a
// customer-reachable route (GET /api/orders/:id), so it must never become an
// exclusion list - fields such as guestTrackingToken, workflows, eParts and the
// internal notes have to stay out of the customer payload.
// When a new field has to be visible on the order detail screen, add it here;
// otherwise it silently arrives as `undefined` in the UI (that is how the
// customer discount stopped being rendered in the Auftrag).
const ORDER_DETAIL_SELECT_FIELDS = [
  'customerId orderNumber status priority createdAt updatedAt progress',
  'deviceBrand deviceModel deviceType imei serialNumber',
  'errorDescription waterDamage previousRepairAttempts previousRepairDetails itemCondition',
  'unlockPattern unlockCode noLock unlockConfirmation pickupConfirmation',
  'services shopProducts addOns assignedStaff guestInfo',
  // Money (gross-first): totalCost is the GROSS total AFTER discount, discount is
  // the gross discount already contained in it, netAmount/taxAmount/taxRate are the
  // extracted net and VAT (taxRate is a PERCENT, e.g. 19).
  'totalCost discount appliedPromoCode pricingConditions originalGrossAmount dealerDiscountPercent dealerDiscountAmount',
  'netAmount taxAmount taxRate paymentStatus estimatedCompletion estimatedDelivery actualDelivery',
  'billingAddress shippingAddress',
  // AUSLIEFERUNG (McRepair -> Kunde) - NOT the inbound shipment. The label PDF itself
  // (shippingLabelUrl, full base64) is deliberately NOT in this list: it is projected only
  // with { includeLabelData: true } (LABEL_DATA_FIELDS below), which is what the two label
  // downloads in orderRoutes.js pass (GET /:id/shipping-label and GET /:id/return-label).
  // Every other caller gets hasShippingLabel, computed from an existence probe.
  'trackingNumber carrier shippingStatus shippingStatusDescription shippingCost trackingEvents',
  // Einsendung/Retoure (Kunde -> McRepair, return*). returnLabelUrl/returnQRCodeUrl are
  // deliberately NOT here either (base64 PDFs); same includeLabelData rule.
  'bookingId returnTrackingNumber returnShipmentId returnShipmentStatus returnShipmentStatusDescription returnCreatedAt returnReceivedAt',
  'timeline customerEmail customerName',
  'hasComplaint complaintReason isComplaintFollowup parentOrderId sourceComplaintId'
].join(' ');

// Label PDFs (base64), projected by getById only with { includeLabelData: true }. The
// guard below keeps hasShippingLabel correct should shippingLabelUrl ever be added back
// to the default projection.
const SHIPPING_LABEL_IN_DEFAULT_PROJECTION = ORDER_DETAIL_SELECT_FIELDS.split(' ').includes('shippingLabelUrl');
const LABEL_DATA_FIELDS = ['shippingLabelUrl', 'returnLabelUrl', 'returnQRCodeUrl']
  .filter((field) => !ORDER_DETAIL_SELECT_FIELDS.split(' ').includes(field))
  .join(' ');

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }
  if (typeof value === 'object') {
    // ObjectId zuerst: ein ObjectId einer anderen bson-Instanz liefert auf `_id`
    // sich selbst zurueck (Endlosrekursion, vgl. orderServiceManagementService).
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    if (value._id != null && value._id !== value) return toIdString(value._id);
    if (value.id != null && value.id !== value) return toIdString(value.id);
    return '';
  }
  return String(value).trim();
};

const getUniqueQueryObjectIds = (rawValues = []) => {
  const seen = new Set();
  const objectIds = [];

  for (const rawValue of rawValues) {
    const normalized = toIdString(rawValue);
    if (!normalized || seen.has(normalized)) continue;
    if (!mongoose.Types.ObjectId.isValid(normalized)) continue;
    seen.add(normalized);
    objectIds.push(normalized);
  }

  return objectIds;
};

const getUniqueStaffIds = (staffIds = []) => {
  if (!Array.isArray(staffIds)) return [];

  const seen = new Set();
  const uniqueIds = [];

  for (const rawId of staffIds) {
    const normalized = toIdString(rawId).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueIds.push(normalized);
  }

  return uniqueIds;
};

const buildWorkflowStepAssignments = (staffMembers = []) => (
  staffMembers.map((staff) => ({
    staffId: staff._id,
    name: staff.name,
    avatar: staff.avatar || '',
    assignedAt: new Date(),
  }))
);

const applyWorkflowStepAssignment = (step, staffMembers = [], preferredStaffId = null) => {
  step.assignedStaff = buildWorkflowStepAssignments(staffMembers);

  if (!Array.isArray(step.assignedStaff) || step.assignedStaff.length === 0) {
    step.assignedStaffId = undefined;
    return;
  }

  const preferredId = toIdString(preferredStaffId);
  const primaryAssignment = preferredId
    ? step.assignedStaff.find((assignment) => toIdString(assignment.staffId) === preferredId)
    : null;

  step.assignedStaffId = (primaryAssignment || step.assignedStaff[0]).staffId;
};

const ensureOrderStaffAssignments = (order, staffMembers = []) => {
  if (!Array.isArray(order.assignedStaff)) {
    order.assignedStaff = [];
  }

  for (const staff of staffMembers) {
    const exists = order.assignedStaff.some(
      (assignment) => toIdString(assignment.staffId) === toIdString(staff._id)
    );

    if (!exists) {
      order.assignedStaff.push({
        staffId: staff._id,
        name: staff.name,
        avatar: staff.avatar || '',
        assignedAt: new Date(),
      });
    }
  }
};

// Geldfelder, die NIE aus einem Request-Body uebernommen werden: der Auftragswert
// wird ausschliesslich serverseitig ueber OrderService.applyOrderPricing gebildet.
// (trustedPricing steht hier, damit niemand ein "vertrauenswuerdig"-Flag im Body
// einschmuggeln kann - die Checkout-Preisbildung kommt nur ueber das zweite Argument.)
const ORDER_MONEY_FIELDS = [
  'totalCost', 'discount', 'originalGrossAmount', 'dealerDiscountPercent', 'dealerDiscountAmount',
  'netAmount', 'taxAmount', 'pricingConditions', 'revisionCount', 'trustedPricing', 'editRevision'
];
// Zusaetzlich bei Anlage OHNE interne Option (POST /api/orders): Zahl- und
// Aktionsfelder darf ein Kunde nicht selbst setzen.
const ORDER_UNTRUSTED_EXTRA_FIELDS = ['appliedPromoCode', 'paymentStatus', 'paymentMethod', 'paidAt', 'taxRate'];

const buildOrderValueError = (message, statusCode = 400, code = 'ORDER_VALUE_INVALID') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Gleichzeitige Bearbeitungen: so oft wird eine Aenderung auf dem jeweils frisch
// geladenen Stand wiederholt, bevor der Aufrufer eine deutsche 409-Meldung bekommt.
const ORDER_EDIT_MAX_ATTEMPTS = 6;
// Toleranz beim Abgleich "Positionen - Rabatt = Auftragswert" (Rundung).
const ORDER_VALUE_TOLERANCE = 0.02;
// Eine bestaetigte Abweichung gilt nur, wenn gespeicherter Wert und Positionen-minus-Rabatt
// noch auf den Cent den bei der Bestaetigung gezeigten Werten entsprechen.
const REPRICING_BASIS_TOLERANCE = 0.005;

const formatEuroDe = (value) => `${CalculationHelper.round(Number(value) || 0).toFixed(2).replace('.', ',')} €`;

class OrderService {
  static getStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    const labels = {
      pending: 'Ausstehend',
      'diagnostic-assessment': 'Diagnosebewertung',
      diagnosed: 'Diagnose abgeschlossen',
      'awaiting-parts': 'Wartet auf Teile',
      'in-progress': 'Reparatur in Bearbeitung',
      paused: 'Pausiert',
      'on-hold': 'Angehalten',
      'quality-check': 'Qualitaetskontrolle',
      'ready-for-pickup': 'Abholbereit',
      completed: 'Abgeschlossen',
      cancelled: 'Storniert'
    };

    return labels[normalized] || status;
  }

  static async notifyCustomerOrderUpdate(order, message, statusOverride = null) {
    try {
      const customerId = toIdString(order?.customerId);
      if (!customerId) return;

      await NotificationService.createOrderUpdateNotification(
        order._id,
        customerId,
        statusOverride || order.status,
        message
      );
    } catch (notificationError) {
      console.error('OrderService: Failed to notify customer about order update:', notificationError.message || notificationError);
    }
  }

  // ------------------------------------------------------------------------
  // Auftragswert: EINE serverseitige Preisregel fuer jeden Schreiber
  // ------------------------------------------------------------------------

  // Geschaetzte Zeit in Minuten. Katalogservices speichern sie als Text ('', '60',
  // '2 hours', '30 Minuten'); ohne diese Umrechnung landete parseFloat('') = NaN in
  // der Position und das Speichern scheiterte.
  static parseEstimatedMinutes(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? value : 0;
    }
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 0;
    const match = text.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return 0;
    const amount = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return /hour|stunde|std/.test(text) ? Math.round(amount * 60) : amount;
  }

  // Summe der LISTEN-Bruttopreise aller Positionen (Services, Zusatzleistungen,
  // Produkte x Menge) - dieselben Positionen, die auch auf der Rechnung stehen.
  static calculatePositionsGross(order) {
    const sum = (list, pick) => (Array.isArray(list) ? list : []).reduce(
      (acc, entry) => acc + (Number(pick(entry)) || 0),
      0
    );
    return CalculationHelper.round(
      sum(order?.services, (service) => (service && typeof service === 'object' ? service.price : 0))
      + sum(order?.addOns, (addOn) => addOn?.price)
      + sum(order?.shopProducts, (product) => (Number(product?.priceAtOrder) || 0) * (Number(product?.quantity) || 0))
    );
  }

  // Aktuelle Konditionen des Kunden (gleiche Quelle wie der Warenkorb:
  // FinancialService.resolveFinancialProfile) als zeitgebundener Snapshot.
  static async resolveCustomerPricingConditions(customerId, appliedAt = new Date()) {
    const profile = await FinancialService.resolveFinancialProfile({ customerId: customerId || null });
    const percent = Math.min(100, Math.max(0, Number(profile?.defaultDiscountPercent) || 0));
    const customerPercent = Number(profile?.customer?.discount) || 0;
    const groupPercent = Number(profile?.group?.financeProfile?.discountPercent) || 0;

    let source = 'none';
    if (percent > 0) {
      if (customerPercent > 0) source = 'customer';
      else if (groupPercent > 0) source = 'customer_group';
      else source = 'settings_default';
    }

    return {
      groupDiscountPercent: percent,
      promoDiscountAmount: 0,
      source,
      customerGroupId: profile?.group?._id || null,
      customerGroupName: profile?.group?.name || '',
      appliedAt,
    };
  }

  // Altauftrag ohne Snapshot: die Kondition wird aus den EIGENEN gespeicherten Werten
  // des Auftrags abgeleitet (nie aus dem heutigen Kundenstamm). MUSS vor einer
  // Positionsaenderung aufgerufen werden.
  //
  // Als gespeicherter Rabatt zaehlt discount PLUS der alte, separat abgezogene
  // Haendlerrabatt (dealerDiscountAmount aus dealerDiscountPercent) - applyOrderPricing
  // setzt dealerDiscountPercent anschliessend auf 0, der Rabatt steckt dann allein in
  // order.discount und geht so nicht verloren.
  //  - kein Rabatt                          -> 0 %
  //  - Rabatt mit Aktionscode oder Positionen passen nicht zur Summe
  //                                         -> Rabatt bleibt FESTER Betrag
  //  - sonst                                -> Prozentsatz = Rabatt / Positionen
  //                                            (auf 0,5 %-Schritte gerundet, wenn das
  //                                            den gespeicherten Rabatt exakt ergibt)
  // Ob ein nicht aufgehender Auftrag ueberhaupt neu berechnet werden darf, entscheidet
  // getPricingConditionsForEdit (Bestaetigung erforderlich).
  static deriveLegacyPricingConditions(order) {
    const check = OrderService.checkOrderValueReconciles(order);
    const recordedDiscount = CalculationHelper.round(check.discount + check.dealerDiscountAmount);
    const positionsGross = check.positionsGross;
    const conditions = {
      groupDiscountPercent: 0,
      promoDiscountAmount: 0,
      source: 'legacy',
      customerGroupId: null,
      customerGroupName: '',
      appliedAt: order?.createdAt || new Date(),
    };

    if (recordedDiscount <= 0) return conditions;

    if (order?.appliedPromoCode || !check.reconciles || positionsGross <= 0) {
      conditions.promoDiscountAmount = recordedDiscount;
      return conditions;
    }

    const rawPercent = (recordedDiscount / positionsGross) * 100;
    const snapped = Math.round(rawPercent * 2) / 2;
    const snappedDiscount = CalculationHelper.round((positionsGross * snapped) / 100);
    conditions.groupDiscountPercent = Math.abs(snappedDiscount - recordedDiscount) <= 0.01
      ? snapped
      : Number(rawPercent.toFixed(4));
    return conditions;
  }

  // Passt der gespeicherte Auftragswert zu den gespeicherten Positionen?
  //   Positionen (Listenbrutto) - discount === totalCost   (Toleranz 0,02 EUR)
  // Der alte Haendlerrabatt (dealerDiscountAmount) wird zusaetzlich zu totalCost
  // abgezogen (siehe buildOrderPricingSummary) und kuerzt sich deshalb heraus.
  static checkOrderValueReconciles(order) {
    const positionsGross = OrderService.calculatePositionsGross(order);
    const discount = CalculationHelper.round(Math.max(0, Number(order?.discount) || 0));
    const dealerDiscountAmount = CalculationHelper.round(Math.max(0, Number(order?.dealerDiscountAmount) || 0));
    const totalCost = CalculationHelper.round(Number(order?.totalCost) || 0);
    const expectedTotal = CalculationHelper.round(positionsGross - discount);
    const difference = CalculationHelper.round(totalCost - expectedTotal);
    return {
      reconciles: Math.abs(difference) <= ORDER_VALUE_TOLERANCE,
      positionsGross,
      discount,
      dealerDiscountAmount,
      totalCost,
      expectedTotal,
      difference,
    };
  }

  // Kondition fuer eine PREISRELEVANTE Bearbeitung (Service, Zusatzleistung, Produkt,
  // Geraetewechsel). Passt der gespeicherte Auftragswert nicht zu den Positionen
  // (Altauftrag, Reklamationsgebuehr direkt auf totalCost, fruehere Bearbeitung ohne
  // Neuberechnung), ist unklar, welcher Wert stimmt: eine automatische Neuberechnung
  // wuerde die Differenz STILL verwerfen (oder dazugewinnen). Deshalb wird sie ohne
  // ausdrueckliche Bestaetigung (options.confirmRepricing === true) mit einer deutschen
  // 409-Meldung abgelehnt. error.details beschreibt die Abweichung fuer die Oberflaeche.
  //
  // Bindung an die GEZEIGTE Abweichung: schickt die Oberflaeche mit der Bestaetigung
  // options.repricingBasis = { storedTotal, expectedTotal } (die details der 409) zurueck,
  // gilt die Bestaetigung nur, solange der Auftrag noch genau diese Abweichung hat. Hat
  // ein anderer Vorgang den Auftrag zwischen 409 und Bestaetigung geaendert, kommt eine
  // FRISCHE 409 mit der neuen Abweichung (details.confirmationOutdated = true) - es wird
  // nichts gespeichert. Eine unlesbare Grundlage gilt nicht als Bestaetigung. Aufrufer
  // ohne repricingBasis (bisheriger Vertrag, z. B. Reparaturpositionen ueber
  // orderServiceRoutes) bleiben bei der reinen Ja/Nein-Bestaetigung.
  static getPricingConditionsForEdit(order, options = {}) {
    const reconciliation = OrderService.checkOrderValueReconciles(order);
    const confirmed = options.confirmRepricing === true || options.confirmRepricing === 'true';
    const basis = OrderService.readRepricingBasis(options.repricingBasis);
    const basisOutdated = confirmed && basis.provided && (
      !basis.valid
      || Math.abs(basis.storedTotal - reconciliation.totalCost) > REPRICING_BASIS_TOLERANCE
      || Math.abs(basis.expectedTotal - reconciliation.expectedTotal) > REPRICING_BASIS_TOLERANCE
    );
    if (!reconciliation.reconciles && (!confirmed || basisOutdated)) {
      const describeGap = `Der gespeicherte Auftragswert (${formatEuroDe(reconciliation.totalCost)}) passt nicht zu den Positionen `
        + `(${formatEuroDe(reconciliation.positionsGross)} abzüglich ${formatEuroDe(reconciliation.discount)} Rabatt = `
        + `${formatEuroDe(reconciliation.expectedTotal)}). Eine automatische Neuberechnung würde die Differenz von `
        + `${formatEuroDe(Math.abs(reconciliation.difference))} ${reconciliation.difference > 0 ? 'verwerfen' : 'aufschlagen'}. `;
      const error = buildOrderValueError(
        basisOutdated
          ? 'Der Auftrag wurde seit Ihrer Prüfung geändert, die bestätigte Abweichung gilt nicht mehr. '
            + `${describeGap}Bitte prüfen Sie die neue Abweichung und bestätigen Sie die Neuberechnung erneut.`
          : `${describeGap}Bitte prüfen Sie den Auftrag und bestätigen Sie die Neuberechnung ausdrücklich.`,
        409,
        'ORDER_VALUE_NOT_RECONCILED'
      );
      error.details = {
        storedTotal: reconciliation.totalCost,
        positionsGross: reconciliation.positionsGross,
        discount: reconciliation.discount,
        expectedTotal: reconciliation.expectedTotal,
        difference: reconciliation.difference,
        ...(basisOutdated ? { confirmationOutdated: true } : {}),
      };
      throw error;
    }
    return {
      conditions: OrderService.getPricingConditions(order),
      reconciliation,
      repricingConfirmed: !reconciliation.reconciles && confirmed,
    };
  }

  // Grundlage einer Bestaetigung (details der 409): { storedTotal, expectedTotal }. Nicht
  // angegeben -> { provided: false }; angegeben, aber unlesbar -> { provided, valid: false }.
  static readRepricingBasis(rawBasis) {
    if (rawBasis === undefined || rawBasis === null || rawBasis === '') return { provided: false };
    let basis = rawBasis;
    if (typeof basis === 'string') {
      try { basis = JSON.parse(basis); } catch (parseError) { return { provided: true, valid: false }; }
    }
    const readAmount = (value) => {
      if (value === undefined || value === null || value === '' || typeof value === 'boolean') return NaN;
      return Number(value);
    };
    const storedTotal = readAmount(basis?.storedTotal);
    const expectedTotal = readAmount(basis?.expectedTotal);
    if (!Number.isFinite(storedTotal) || !Number.isFinite(expectedTotal)) return { provided: true, valid: false };
    return {
      provided: true,
      valid: true,
      storedTotal: CalculationHelper.round(storedTotal),
      expectedTotal: CalculationHelper.round(expectedTotal),
    };
  }

  // Historientext, wenn ein nicht aufgehender Auftrag nach Bestaetigung neu berechnet wurde.
  static describeConfirmedRepricing(reconciliation) {
    if (!reconciliation || reconciliation.reconciles) return '';
    return `Neuberechnung trotz Abweichung bestätigt: gespeicherter Auftragswert ${formatEuroDe(reconciliation.totalCost)}, `
      + `Positionen abzüglich Rabatt ${formatEuroDe(reconciliation.expectedTotal)}`;
  }

  // Speichert einen Auftrag NUR, wenn er seit dem Laden nicht von einem anderen Vorgang
  // geaendert wurde (Bearbeitungsstand editRevision), und zaehlt den Stand hoch. Ein
  // Konflikt wirft einen Fehler mit code 'ORDER_EDIT_CONFLICT_RETRY'.
  // Voraussetzung: das Dokument wurde mit editRevision geladen (keine Projektion ohne
  // dieses Feld) und ist kein neues Dokument.
  static async saveOrderGuarded(order, saveOptions = {}) {
    if (!order || order.isNew) {
      throw new Error('saveOrderGuarded: nur fuer bereits gespeicherte Auftraege');
    }
    if (order.$locals?.editRevisionLoaded === false) {
      throw new Error('saveOrderGuarded: editRevision wurde nicht mitgeladen');
    }
    const loadedRevision = Number(order.$locals?.loadedEditRevision) || 0;
    order.editRevision = loadedRevision + 1;
    order.$where = loadedRevision > 0
      ? { editRevision: loadedRevision }
      : { editRevision: { $in: [null, 0] } };
    try {
      const saved = await order.save(saveOptions);
      order.$locals.loadedEditRevision = loadedRevision + 1;
      return saved;
    } catch (error) {
      if (error && error.name === 'DocumentNotFoundError') {
        const conflict = new Error('Der Auftrag wurde zwischenzeitlich geändert.');
        conflict.code = 'ORDER_EDIT_CONFLICT_RETRY';
        throw conflict;
      }
      throw error;
    } finally {
      order.$where = undefined;
    }
  }

  // Fuehrt eine Positions-/Wertaenderung konfliktsicher aus:
  //   laden -> mutate(order) -> bedingt speichern (saveOrderGuarded)
  // Hat ein anderer Vorgang den Auftrag inzwischen geaendert, wird auf dem FRISCH
  // geladenen Stand wiederholt (mutate prueft und rechnet dann erneut - z. B. greift
  // die Doppelt-Pruefung eines Katalogservices). Positionen und Auftragswert stammen
  // so immer aus demselben Stand. mutate darf deutsche Fehler (statusCode) werfen;
  // die werden sofort weitergereicht. Rueckgabe: { order, context } (context =
  // Rueckgabewert von mutate des erfolgreichen Durchlaufs).
  static async runGuardedOrderEdit(orderId, mutate, options = {}) {
    const loadOrder = typeof options.load === 'function'
      ? options.load
      : () => Order.findById(orderId).setOptions({ skipAutoPopulate: true });

    for (let attempt = 1; attempt <= ORDER_EDIT_MAX_ATTEMPTS; attempt += 1) {
      const order = await loadOrder();
      if (!order) {
        throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }
      const context = await mutate(order, { attempt });
      try {
        await OrderService.saveOrderGuarded(order, (context && context.saveOptions) || {});
        return { order, context };
      } catch (error) {
        if (error?.code !== 'ORDER_EDIT_CONFLICT_RETRY') throw error;
        console.warn(`OrderService: gleichzeitige Aenderung an Auftrag ${order._id} erkannt (Versuch ${attempt}/${ORDER_EDIT_MAX_ATTEMPTS}) - wird auf frischem Stand wiederholt.`);
        const stillExists = await Order.exists({ _id: order._id });
        if (!stillExists) {
          throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
        }
        // kurze, zufaellige Wartezeit, damit parallele Vorgaenge nicht im Gleichschritt kollidieren
        await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 20 * attempt)));
      }
    }

    throw buildOrderValueError(
      'Der Auftrag wurde gerade gleichzeitig von jemand anderem geändert. Bitte laden Sie die Seite neu und prüfen Sie die Änderung.',
      409,
      'ORDER_EDIT_CONFLICT'
    );
  }

  // Kondition, mit der dieser Auftrag gerechnet wird: der gespeicherte Snapshot, sonst
  // (Altauftrag) die aus den eigenen Werten abgeleitete Kondition.
  static getPricingConditions(order) {
    const snapshot = order?.pricingConditions;
    if (snapshot && snapshot.appliedAt) {
      const plain = typeof snapshot.toObject === 'function' ? snapshot.toObject() : { ...snapshot };
      return {
        groupDiscountPercent: Number(plain.groupDiscountPercent) || 0,
        promoDiscountAmount: Number(plain.promoDiscountAmount) || 0,
        source: plain.source || 'none',
        customerGroupId: plain.customerGroupId || null,
        customerGroupName: plain.customerGroupName || '',
        appliedAt: plain.appliedAt,
      };
    }
    return OrderService.deriveLegacyPricingConditions(order);
  }

  // Schreibt order.discount / order.totalCost nach DER Preisregel
  // (CalculationHelper.calculateOrderPricing) und haelt den Snapshot fest.
  // netAmount/taxAmount leitet der Order-pre('save')-Hook aus totalCost ab; der alte
  // separate Haendlerrabatt (dealerDiscountPercent) wird auf 0 gesetzt, weil der
  // Rabatt ausschliesslich in order.discount steckt - sonst zoege der Hook ihn ein
  // zweites Mal ab.
  static applyOrderPricing(order, conditions) {
    const pricing = CalculationHelper.calculateOrderPricing({
      positionsGross: OrderService.calculatePositionsGross(order),
      groupDiscountPercent: conditions?.groupDiscountPercent,
      promoDiscountAmount: conditions?.promoDiscountAmount,
      taxRatePercent: Number.isFinite(Number(order?.taxRate)) ? Number(order.taxRate) : CalculationHelper.DEFAULT_TAX_RATE,
    });

    order.pricingConditions = {
      groupDiscountPercent: pricing.groupDiscountPercent,
      promoDiscountAmount: pricing.promoDiscountAmount,
      source: conditions?.source || 'none',
      customerGroupId: conditions?.customerGroupId || null,
      customerGroupName: conditions?.customerGroupName || '',
      appliedAt: conditions?.appliedAt || new Date(),
    };
    order.discount = pricing.discount;
    order.totalCost = pricing.totalCost;
    order.dealerDiscountPercent = 0;

    return pricing;
  }

  // Positionen einer Anlage OHNE interne Option (POST /api/orders) gegen den Katalog
  // aufloesen: Preise, Namen und Zeiten kommen aus Service/AddOnService/Product, nie
  // aus dem Request.
  static async resolveUntrustedPositions(orderData) {
    const services = Array.isArray(orderData.services) ? orderData.services : [];
    const resolvedServices = [];
    for (const entry of services) {
      if (entry && typeof entry === 'object' && entry.isManual === true) {
        throw buildOrderValueError(
          'Manuelle Reparaturpositionen können nur vom Personal am Auftrag angelegt werden.',
          400,
          'MANUAL_LINE_NOT_ALLOWED'
        );
      }
      const serviceId = toIdString(typeof entry === 'object' && entry !== null ? entry.serviceId || entry._id : entry);
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        throw buildOrderValueError('Ein ausgewählter Reparaturservice ist ungültig.', 400, 'SERVICE_INVALID');
      }
      const catalogService = await Service.findOne({ _id: serviceId, isActive: { $ne: false } }).lean();
      if (!catalogService) {
        throw buildOrderValueError('Ein ausgewählter Reparaturservice wurde nicht gefunden.', 400, 'SERVICE_NOT_FOUND');
      }
      resolvedServices.push({
        serviceId: catalogService._id,
        name: catalogService.name || '',
        price: CalculationHelper.round(Number(catalogService.price) || 0),
        estimatedTime: OrderService.parseEstimatedMinutes(catalogService.estimatedTime),
        notes: typeof entry === 'object' && entry !== null ? String(entry.notes || '') : '',
      });
    }

    const addOns = Array.isArray(orderData.addOns) ? orderData.addOns : [];
    const resolvedAddOns = [];
    for (const entry of addOns) {
      const addOnId = toIdString(entry?._id || entry?.addOnId);
      let catalogAddOn = null;
      if (addOnId && mongoose.Types.ObjectId.isValid(addOnId)) {
        catalogAddOn = await AddOnService.findOne({ _id: addOnId, isActive: { $ne: false } }).lean();
      }
      if (!catalogAddOn && entry?.name) {
        const escapedName = String(entry.name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        catalogAddOn = await AddOnService.findOne({
          name: new RegExp(`^${escapedName}$`, 'i'),
          isActive: { $ne: false },
        }).lean();
      }
      if (!catalogAddOn) {
        throw buildOrderValueError(
          `Die Zusatzleistung „${String(entry?.name || '').trim() || 'unbekannt'}“ wurde im Katalog nicht gefunden.`,
          400,
          'ADDON_NOT_FOUND'
        );
      }
      resolvedAddOns.push({
        name: catalogAddOn.name,
        description: catalogAddOn.description || '',
        price: CalculationHelper.round(Number(catalogAddOn.price) || 0),
        status: 'pending',
        estimatedTime: String(catalogAddOn.estimatedTime || ''),
        progress: 0,
      });
    }

    const shopProducts = Array.isArray(orderData.shopProducts) ? orderData.shopProducts : [];
    const resolvedProducts = [];
    for (const entry of shopProducts) {
      const productId = toIdString(entry?.productId);
      const product = productId && mongoose.Types.ObjectId.isValid(productId)
        ? await Product.findById(productId).lean()
        : null;
      if (!product) {
        throw buildOrderValueError('Ein ausgewähltes Produkt wurde nicht gefunden.', 400, 'PRODUCT_NOT_FOUND');
      }
      resolvedProducts.push({
        productId: product._id,
        quantity: Math.max(1, Math.floor(Number(entry?.quantity) || 1)),
        priceAtOrder: CalculationHelper.round(Number(product.price) || 0),
        addedBy: orderData.customerId || undefined,
      });
    }

    return { services: resolvedServices, addOns: resolvedAddOns, shopProducts: resolvedProducts };
  }

  // Create a new order
  //
  // options.trustedPricing (NUR fuer interne Aufrufer, z.B. den Checkout):
  //   { totalCost, discount, promoDiscountAmount, groupDiscountPercent }
  //   Der Checkout verteilt den Warenkorb-Rabatt (Aktion + Gruppe) auf mehrere
  //   Auftraege - das kann eine Rechnung pro Auftrag nicht exakt nachbilden, deshalb
  //   wird diese Preisbildung unveraendert uebernommen und als Snapshot festgehalten.
  // Ohne diese Option (POST /api/orders) werden alle vom Client gelieferten Summen,
  // Rabatte und Positionspreise IGNORIERT und serverseitig neu berechnet.
  static async create(orderData, options = {}) {
    console.log('OrderService: Creating new order with data:', orderData);

    try {
      const trustedPricing = options && typeof options.trustedPricing === 'object' && options.trustedPricing
        ? options.trustedPricing
        : null;
      const data = { ...(orderData || {}) };
      ORDER_MONEY_FIELDS.forEach((field) => { delete data[field]; });
      if (!trustedPricing) {
        ORDER_UNTRUSTED_EXTRA_FIELDS.forEach((field) => { delete data[field]; });
      }

      // Validate customer exists (skip for guest orders)
      if (data.customerId) {
        const customer = mongoose.Types.ObjectId.isValid(String(toIdString(data.customerId) || ''))
          ? await User.findById(toIdString(data.customerId))
          : null;
        if (!customer) {
          throw buildOrderValueError('Der Kunde wurde nicht gefunden.', 400, 'CUSTOMER_NOT_FOUND');
        }
      }

      if (!trustedPricing) {
        const resolved = await OrderService.resolveUntrustedPositions(data);
        data.services = resolved.services;
        data.addOns = resolved.addOns;
        data.shopProducts = resolved.shopProducts;
      } else if (Array.isArray(data.services)) {
        // Interner Aufrufer: Positionspreise sind bereits aus dem Katalog gebildet.
        // Nur reine IDs aufloesen und den Namens-Snapshot ergaenzen.
        data.services = await Promise.all(data.services.map(async (service) => {
          if (typeof service === 'string') {
            const serviceObj = mongoose.Types.ObjectId.isValid(service) ? await Service.findById(service) : null;
            if (!serviceObj) {
              throw buildOrderValueError('Ein ausgewählter Reparaturservice wurde nicht gefunden.', 400, 'SERVICE_NOT_FOUND');
            }
            return {
              serviceId: serviceObj._id,
              name: serviceObj.name || '',
              price: serviceObj.price,
              estimatedTime: OrderService.parseEstimatedMinutes(serviceObj.estimatedTime),
              notes: ''
            };
          }
          if (service && typeof service === 'object' && service.serviceId && !service.name) {
            const serviceObj = await Service.findById(service.serviceId).select('name').lean();
            return {
              ...service,
              name: serviceObj?.name || '',
              estimatedTime: OrderService.parseEstimatedMinutes(service.estimatedTime),
            };
          }
          return service;
        }));
      }

      const order = new Order(data);
      const now = new Date();
      const conditions = await OrderService.resolveCustomerPricingConditions(data.customerId, now);

      if (trustedPricing) {
        conditions.groupDiscountPercent = Math.min(100, Math.max(0,
          Number(trustedPricing.groupDiscountPercent ?? conditions.groupDiscountPercent) || 0));
        conditions.promoDiscountAmount = CalculationHelper.round(Math.max(0, Number(trustedPricing.promoDiscountAmount) || 0));
        if (conditions.groupDiscountPercent <= 0 && conditions.source !== 'none') {
          conditions.source = 'none';
        }
        const ruleCheck = OrderService.applyOrderPricing(order, conditions);
        order.totalCost = CalculationHelper.round(Math.max(0, Number(trustedPricing.totalCost) || 0));
        order.discount = CalculationHelper.round(Math.max(0, Number(trustedPricing.discount) || 0));
        if (Math.abs(ruleCheck.totalCost - order.totalCost) > 0.02) {
          console.warn(
            `OrderService: Checkout-Preisbildung weicht von der Preisregel ab (Checkout ${order.totalCost}, Regel ${ruleCheck.totalCost}).`
          );
        }
      } else {
        OrderService.applyOrderPricing(order, conditions);
      }

      const savedOrder = await order.save();

      // Historize initial order creation
      try {
        await OrderRevisionService.recordRevision(savedOrder, {
          triggerReason: 'initial_creation',
          previousGrossAmount: 0,
          notes: `Auftrag angelegt: Positionen ${OrderService.calculatePositionsGross(savedOrder).toFixed(2)} EUR, `
            + `Rabatt ${Number(savedOrder.discount || 0).toFixed(2)} EUR, Auftragswert ${Number(savedOrder.totalCost || 0).toFixed(2)} EUR (brutto)`
        });
      } catch (revError) {
        console.warn('OrderService: Warning recording initial revision:', revError.message);
      }

      console.log('OrderService: Order created successfully with ID:', savedOrder._id);
      console.log('OrderService: Order unlock data - Pattern:', savedOrder.unlockPattern, 'Code:', savedOrder.unlockCode, 'NoLock:', savedOrder.noLock);

      return savedOrder;
    } catch (error) {
      console.error('OrderService: Error creating order:', error);
      throw error;
    }
  }

  // Get orders for a specific customer
  static async getByCustomer(customerId, filters = {}) {
    console.log('OrderService: Getting orders for customer:', customerId);

    try {
      const query = { customerId };

      if (filters.status) {
        query.status = filters.status;
      }

      const orders = await Order.find(query)
        .select('customerId orderNumber status priority totalCost createdAt updatedAt progress deviceBrand deviceModel deviceType services shopProducts assignedStaff')
        .sort({ createdAt: -1 })
        .lean();

      console.log('OrderService: Found', orders.length, 'orders for customer');

      const serviceIds = getUniqueQueryObjectIds(
        orders
          .flatMap((order) => Array.isArray(order.services) ? order.services : [])
          .map((service) => service?.serviceId)
      );
      const productIds = getUniqueQueryObjectIds(
        orders
          .flatMap((order) => Array.isArray(order.shopProducts) ? order.shopProducts : [])
          .map((product) => product?.productId)
      );

      const [serviceDocs, productDocs] = await Promise.all([
        serviceIds.length ? Service.find({ _id: { $in: serviceIds } }).select('_id name').lean() : [],
        productIds.length ? Product.find({ _id: { $in: productIds } }).select('_id name').lean() : []
      ]);

      const serviceNameMap = new Map(serviceDocs.map((service) => [String(service._id), service.name]));
      const productNameMap = new Map(productDocs.map((product) => [String(product._id), product.name]));

      const plainOrders = orders.map((order) => {
        const plain = { ...order };

        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
        }
        if (plain.progress !== undefined && typeof plain.progress === 'object') {
          plain.progress = Number(plain.progress);
        }

        plain.services = Array.isArray(order.services)
          ? order.services.map((service) => {
              if (service && typeof service === 'object') {
                const serviceId = toIdString(service.serviceId);
                return serviceNameMap.get(serviceId) || service.name || 'Unknown Service';
              }
              return String(service);
            })
          : [];

        plain.shopProducts = Array.isArray(order.shopProducts)
          ? order.shopProducts.map((product) => ({
              ...product,
              name: productNameMap.get(String(product?.productId)) || product?.name || 'Unknown Product'
            }))
          : [];

        return plain;
      });

      return plainOrders;
    } catch (error) {
      console.error('OrderService: Error getting customer orders:', error);
      throw error;
    }
  }

  // Get all orders (admin view)
  static async getAll(filters = {}) {
    console.log('OrderService: Getting all orders with filters:', filters);

    try {
      const query = {};
      const andFilters = [];

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.deviceType) {
        query.deviceType = filters.deviceType;
      }

      if (filters.assignedStaff) {
        andFilters.push({
          $or: [
            { 'assignedStaff.staffId': filters.assignedStaff },
            { 'workflows.assignedStaffId': filters.assignedStaff },
            { 'workflows.assignedStaff.staffId': filters.assignedStaff },
            { 'workflows.steps.assignedStaffId': filters.assignedStaff },
            { 'workflows.steps.assignedStaff.staffId': filters.assignedStaff },
            ...(filters.includeComplaintFollowups ? [{ isComplaintFollowup: true }] : []),
          ],
        });
      }

      if (filters.search) {
        andFilters.push({
          $or: [
          { orderNumber: { $regex: filters.search, $options: 'i' } },
          { deviceBrand: { $regex: filters.search, $options: 'i' } },
          { deviceModel: { $regex: filters.search, $options: 'i' } }
          ],
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      if (andFilters.length > 0) {
        query.$and = andFilters;
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const orders = await Order.find(query)
        .populate('customerId', 'name email phone avatar role isActive createdAt')
        .populate('workflows', 'workflowTemplateId workflowName status steps assignedStaffId startedAt completedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalOrders = await Order.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);

      // Get stats
      const stats = await this.getOrderStats();

      console.log('OrderService: Found', orders.length, 'orders out of', totalOrders, 'total');

      // Convert to plain objects and ensure numeric fields are numbers
      const plainOrders = orders.map(order => {
        const plain = order.toObject ? order.toObject() : order;
        
        // Convert numeric fields from Decimal128 to Number
        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
        }
        if (plain.progress !== undefined && typeof plain.progress === 'object') {
          plain.progress = Number(plain.progress);
        }

        // Transform services array from objects to service names
        if (plain.services && Array.isArray(plain.services)) {
          plain.services = plain.services.map(service => {
            // Handle populated service objects
            if (typeof service === 'object' && service !== null) {
              if (service.serviceId && typeof service.serviceId === 'object') {
                return service.serviceId.name || service.name || 'Unknown Service';
              }
              return service.name || 'Unknown Service';
            }
            return String(service);
          });
        }

        return plain;
      });

      return {
        orders: plainOrders,
        totalPages,
        currentPage: page,
        totalOrders,
        stats
      };
    } catch (error) {
      console.error('OrderService: Error getting all orders:', error);
      throw error;
    }
  }

  // Build the money breakdown the order detail screen renders.
  //
  // Contract (gross-first, identical to the invoice):
  //   positionsGross       = sum of the stored LIST prices of all positions (Brutto)
  //   discount             = cart/promo gross discount already subtracted from totalCost
  //   dealerDiscountAmount = Haendlerrabatt (Brutto) that is NOT yet contained in
  //                          totalCost - the Order pre('save') hook stores it
  //                          separately and derives netAmount/taxAmount from
  //                          totalCost MINUS it (models/Order.js:892-901 ->
  //                          CalculationHelper.calculateOrderValue).
  //   grossTotal           = totalCost - dealerDiscountAmount (the authoritative
  //                          Auftragswert, both discounts applied exactly once)
  //   netTotal             = grossTotal / (1 + taxRate/100)
  //   taxAmount            = grossTotal - netTotal
  // Every discount is subtracted from the GROSS exactly once and never again from
  // the net. taxRate is a PERCENT (19), never a fraction.
  static buildOrderPricingSummary(order) {
    const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
    const sum = (list, pick) => (Array.isArray(list) ? list : []).reduce(
      (acc, entry) => acc + (Number(pick(entry)) || 0),
      0
    );

    const servicesGross = sum(
      order?.services,
      (service) => (service && typeof service === 'object' ? service.price : 0)
    );
    const addOnsGross = sum(order?.addOns, (addOn) => addOn?.price);
    const shopProductsGross = sum(
      order?.shopProducts,
      (product) => (Number(product?.priceAtOrder) || 0) * (Number(product?.quantity) || 0)
    );

    const positionsGross = round2(servicesGross + addOnsGross + shopProductsGross);
    const discount = round2(order?.discount);
    // Konditionen, mit denen der Rabatt gebildet wurde (Snapshot bzw. bei Altauftraegen
    // aus den eigenen Werten abgeleitet) - fuer die Anzeige "Listenpreis / Rabatt % /
    // Endpreis". Der Rabatt selbst wird hier NICHT neu gerechnet.
    const conditions = OrderService.getPricingConditions(order);
    const promoDiscountAmount = round2(Math.min(discount, Number(conditions.promoDiscountAmount) || 0));
    const dealerDiscountPercent = Math.max(0, Number(order?.dealerDiscountPercent) || 0);
    const dealerDiscountAmount = round2(order?.dealerDiscountAmount);
    // totalCost still carries the Haendlerrabatt; the stored netAmount/taxAmount do
    // not. Subtract it here or the screen overstates a Haendler order.
    const grossTotal = round2(round2(order?.totalCost) - dealerDiscountAmount);
    const taxRate = Number.isFinite(Number(order?.taxRate)) ? Number(order.taxRate) : 19;
    const netTotal = round2(grossTotal / (1 + taxRate / 100));
    const taxAmount = round2(grossTotal - netTotal);

    return {
      positionsGross,
      servicesGross: round2(servicesGross),
      addOnsGross: round2(addOnsGross),
      shopProductsGross: round2(shopProductsGross),
      discount,
      appliedPromoCode: order?.appliedPromoCode || '',
      groupDiscountPercent: Number(conditions.groupDiscountPercent) || 0,
      groupDiscountAmount: round2(discount - promoDiscountAmount),
      promoDiscountAmount,
      conditionsSource: conditions.source || 'none',
      conditionsAppliedAt: conditions.appliedAt || null,
      dealerDiscountPercent,
      dealerDiscountAmount,
      grossTotal,
      netTotal,
      taxAmount,
      taxRate,
      // false when the stored positions no longer add up to the order total
      // (legacy orders, or positions edited without recalculating the order).
      positionsReconcile: Math.abs(positionsGross - discount - dealerDiscountAmount - grossTotal) <= 0.02
    };
  }

  // Get order by ID
  //
  // options.includeLabelData: also project the stored base64 label PDFs
  // (shippingLabelUrl / returnLabelUrl / returnQRCodeUrl). Keep this OFF for the normal
  // detail and polling endpoints - a DHL label is a `data:application/pdf;base64,...`
  // string of several hundred KB. The download routes ask for it explicitly.
  // options.audience: 'customer' (default, safe) strips the internal parts of the
  // conditions snapshot (customer group id/name, source) - the percent stays visible in
  // `pricing`. 'staff' keeps the full snapshot (admin/staff routes only).
  static async getById(orderId, options = {}) {
    console.log('OrderService: Getting order by ID:', orderId);

    try {
      const includeLabelData = options.includeLabelData === true;
      const staffAudience = options.audience === 'staff';
      const selectFields = `${ORDER_DETAIL_SELECT_FIELDS}${includeLabelData ? ` ${LABEL_DATA_FIELDS}` : ''}`;

      const order = await Order.findById(orderId)
        .select(selectFields)
        .lean();

      if (!order) {
        throw new Error('Order not found');
      }

      const customer = order.customerId
        ? await User.findById(order.customerId).select('name email phone avatar role isActive createdAt').lean()
        : null;

      const serviceIds = [...new Set(
        getUniqueQueryObjectIds(Array.isArray(order.services) ? order.services.map((service) => service?.serviceId) : [])
      )];
      const productIds = [...new Set(
        getUniqueQueryObjectIds(Array.isArray(order.shopProducts) ? order.shopProducts.map((product) => product?.productId) : [])
      )];

      const [serviceDocs, productDocs, linkedComplaint, storedReturnLabel, storedShippingLabel] = await Promise.all([
        serviceIds.length ? Service.find({ _id: { $in: serviceIds } }).select('_id name').lean() : [],
        productIds.length ? Product.find({ _id: { $in: productIds } }).select('_id name').lean() : [],
        Complaint.findOne({ orderId: order._id })
          .setOptions({ skipAutoPopulate: true })
          .select('_id complaintNumber status createdAt newOrderId')
          .populate('newOrderId', '_id orderNumber')
          .sort({ createdAt: -1 })
          .lean(),
        // hasReturnLabel must be EXACT, not inferred from returnShipmentId. The PDF
        // itself stays out of the default projection, so probe the field directly
        // (indexed _id lookup, returns only the _id).
        includeLabelData
          ? null
          : Order.exists({ _id: order._id, returnLabelUrl: { $exists: true, $nin: [null, ''] } }),
        // Same exact probe for the Auslieferungslabel (McRepair -> Kunde) whenever the PDF
        // itself was not projected.
        includeLabelData || SHIPPING_LABEL_IN_DEFAULT_PROJECTION
          ? null
          : Order.exists({ _id: order._id, shippingLabelUrl: { $exists: true, $nin: [null, ''] } })
      ]);

      const serviceNameMap = new Map(serviceDocs.map((service) => [String(service._id), service.name]));
      const productNameMap = new Map(productDocs.map((product) => [String(product._id), product.name]));

      const plain = { ...order, customerId: customer || order.customerId || null };

      if (linkedComplaint) {
        plain.complaintId = linkedComplaint._id;
        plain.complaintNumber = linkedComplaint.complaintNumber;
        plain.complaintStatus = linkedComplaint.status;
        plain.complaintOrderId = linkedComplaint.newOrderId?._id || linkedComplaint.newOrderId || null;
        plain.complaintOrderNumber = linkedComplaint.newOrderId?.orderNumber || '';
      }

      if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
        plain.totalCost = Number(plain.totalCost);
      }
      if (plain.progress !== undefined && typeof plain.progress === 'object') {
        plain.progress = Number(plain.progress);
      }

      // The label PDFs themselves are not shipped with the detail payload (see the
      // projection comment), so expose a boolean the UI can gate the download on.
      // This is EXACT: it reads returnLabelUrl itself - from the projected value when
      // the caller asked for the label data, otherwise from the existence probe above.
      // It deliberately does NOT infer from returnShipmentId: DHLReturnsService happens
      // to write all four fields in one save today (dhlReturnsService.js:468-473), but a
      // legacy or partially written row with only returnLabelUrl would then hide a label
      // that GET /api/orders/:id/return-label serves without complaint.
      plain.hasReturnLabel = includeLabelData
        ? Boolean(order.returnLabelUrl)
        : Boolean(storedReturnLabel);
      plain.hasShippingLabel = includeLabelData || SHIPPING_LABEL_IN_DEFAULT_PROJECTION
        ? Boolean(order.shippingLabelUrl)
        : Boolean(storedShippingLabel);

      // Konditionen-Snapshot: Kunden sehen nur Prozent/Aktionsbetrag/Zeitpunkt, nicht
      // die internen Angaben (Kundengruppe, Herkunft).
      if (plain.pricingConditions && !staffAudience) {
        plain.pricingConditions = {
          groupDiscountPercent: Number(plain.pricingConditions.groupDiscountPercent) || 0,
          promoDiscountAmount: Number(plain.pricingConditions.promoDiscountAmount) || 0,
          appliedAt: plain.pricingConditions.appliedAt || null,
        };
      }

      // Authoritative, self-consistent money breakdown for the order detail screen.
      // Gross-first: totalCost is the GROSS after discount, net is derived from it.
      plain.pricing = OrderService.buildOrderPricingSummary(order);

      plain.services = Array.isArray(order.services)
        ? order.services.map((service) => {
            if (service && typeof service === 'object') {
              const serviceId = toIdString(service.serviceId);
              return serviceNameMap.get(serviceId) || service.name || 'Unknown Service';
            }
            return String(service);
          })
        : [];

      plain.shopProducts = Array.isArray(order.shopProducts)
        ? order.shopProducts.map((product) => ({
            ...product,
            name: productNameMap.get(String(product?.productId)) || product?.name || 'Unknown Product'
          }))
        : [];

      return plain;
    } catch (error) {
      console.error('OrderService: Error getting order by ID:', error);
      throw error;
    }
  }

  // Auto-assign a staff member to the order if not already assigned
  static async _autoAssignStaff(order, staffId) {
    if (!staffId || staffId === 'system') return;

    const alreadyAssigned = order.assignedStaff.some(
      s => s.staffId && s.staffId.toString() === staffId.toString()
    );
    if (alreadyAssigned) return;

    const staff = await User.findById(staffId);
    if (!staff || !['staff', 'admin'].includes(staff.role)) return;

    order.assignedStaff.push({
      staffId: staff._id,
      name: staff.name,
      avatar: staff.avatar || '',
      assignedAt: new Date()
    });
  }

  // Update order status
  static async updateStatus(orderId, status, note = null, staffId = null) {
    console.log('OrderService: Updating order status:', orderId, 'to', status);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      if (status === 'completed' && order.requiresPaymentBeforeCompletion && order.paymentStatus !== 'paid') {
        throw new Error('Zahlung erforderlich, bevor der Reklamationsauftrag abgeschlossen und versendet werden kann');
      }

      const oldStatus = order.status;
      const previousProgress = Number(order.progress || 0);
      order.status = status;
      
      // Update progress based on status
      const progressMap = {
        'pending': 0,
        'in-progress': 50,
        'quality-check': 75,
        'ready-for-pickup': 90,
        'completed': 100,
        'cancelled': 0
      };
      
      order.progress = progressMap[status] || order.progress;

      if (status === 'completed') {
        order.actualCompletion = new Date();
      }

      await OrderService._autoAssignStaff(order, staffId);

      // Add timeline entry
      let staffName = 'System';
      if (staffId) {
        const staff = await User.findById(staffId);
        staffName = staff ? staff.name : 'Staff Member';
      }

      if (!Array.isArray(order.timeline)) {
        order.timeline = [];
      }

      order.timeline.push({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
        description: note || `Status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName
      });

      const updatedOrder = await order.save();

      if (oldStatus !== status || previousProgress !== Number(updatedOrder.progress || 0)) {
        const statusLabel = this.getStatusLabel(status);
        const updateMessage = note
          ? `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Hinweis: ${note}`
          : `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`;

        await this.notifyCustomerOrderUpdate(updatedOrder, updateMessage, status);
      }
      
      console.log('OrderService: Order status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating order status:', error);
      throw error;
    }
  }

  // Assign staff to order
  static async assignStaff(orderId, staffIds) {
    console.log('OrderService: Assigning staff to order:', orderId, 'staff:', staffIds);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      // Get staff details
      const staffMembers = await User.find({ 
        _id: { $in: staffIds },
        role: { $in: ['staff', 'admin'] }
      });

      if (staffMembers.length !== staffIds.length) {
        throw new Error('One or more staff members not found');
      }

      // Update assigned staff
      order.assignedStaff = staffMembers.map(staff => ({
        staffId: staff._id,
        name: staff.name,
        avatar: staff.avatar || '',
        assignedAt: new Date()
      }));

      // Add timeline entry
      order.timeline.push({
        status: 'Staff Assigned',
        description: `Assigned to: ${staffMembers.map(s => s.name).join(', ')}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System'
      });

      const updatedOrder = await order.save();
      
      console.log('OrderService: Staff assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning staff:', error);
      throw error;
    }
  }

  // Add staff note
  static async addNote(orderId, note, type, staffId) {
    console.log('OrderService: Adding note to order:', orderId);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      await OrderService._autoAssignStaff(order, staffId);

      const newNote = {
        staffId,
        staffName: staff.name,
        note,
        type,
        createdAt: new Date()
      };

      order.staffNotes.push(newNote);
      await order.save();
      
      console.log('OrderService: Note added successfully');
      return newNote;
    } catch (error) {
      console.error('OrderService: Error adding note:', error);
      throw error;
    }
  }

  // Get order statistics
  static async getOrderStats() {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalCost' }
          }
        }
      ]);

      const result = {
        pending: 0,
        inProgress: 0,
        qualityCheck: 0,
        completed: 0,
        totalRevenue: 0,
        averageCompletionTime: '2.5 days' // This would need more complex calculation
      };

      stats.forEach(stat => {
        switch (stat._id) {
          case 'pending':
            result.pending = stat.count;
            break;
          case 'in-progress':
            result.inProgress = stat.count;
            break;
          case 'quality-check':
            result.qualityCheck = stat.count;
            break;
          case 'completed':
            result.completed = stat.count;
            result.totalRevenue += stat.totalRevenue;
            break;
        }
      });

      return result;
    } catch (error) {
      console.error('OrderService: Error getting order stats:', error);
      throw error;
    }
  }

  // Assign EPart to order
  static async assignEPart(orderId, partId, versionId, quantity, staffId) {
    console.log('OrderService: Assigning EPart to order:', { orderId, partId, versionId, quantity, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const part = await Inventory.findById(partId);
      if (!part) {
        throw new Error('Part not found');
      }

      // Find the specific version
      const version = part.versions.id(versionId);
      if (!version) {
        throw new Error('Part version not found');
      }

      // Check if enough stock is available
      if (version.quantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${version.quantity}, Requested: ${quantity}`);
      }

      // Check if this part version is already assigned to the order
      const existingEPart = order.eParts.find(
        ep => ep.partId.toString() === partId && ep.versionId === versionId
      );

      if (existingEPart) {
        throw new Error('This part version is already assigned to this order');
      }

      // Reduce inventory stock
      version.quantity -= quantity;
      await part.save();

      // Add EPart to order
      order.eParts.push({
        partId,
        versionId,
        quantity,
        status: 'allocated',
        assignedAt: new Date(),
        assignedBy: staffId
      });

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Assigned',
        description: `${part.itemName} (${version.versionType}) x${quantity} assigned to order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning EPart:', error);
      throw error;
    }
  }

  // Remove EPart from order
  static async removeEPart(orderId, ePartId, staffId) {
    console.log('OrderService: Removing EPart from order:', { orderId, ePartId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const ePart = order.eParts.id(ePartId);
      if (!ePart) {
        throw new Error('EPart not found in order');
      }

      // Restore inventory stock
      const part = await Inventory.findById(ePart.partId);
      if (part) {
        const version = part.versions.id(ePart.versionId);
        if (version) {
          version.quantity += ePart.quantity;
          await part.save();
        }
      }

      // Get part info for timeline before removing
      const partName = part ? part.itemName : 'Unknown Part';
      const versionType = part && part.versions.id(ePart.versionId)
        ? part.versions.id(ePart.versionId).versionType
        : 'Unknown';

      // Remove EPart from order
      order.eParts.pull(ePartId);

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Removed',
        description: `${partName} (${versionType}) x${ePart.quantity} removed from order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing EPart:', error);
      throw error;
    }
  }

  // Update EPart status (pending -> allocated -> used)
  static async updateEPartStatus(orderId, ePartId, status, staffId) {
    console.log('OrderService: Updating EPart status:', { orderId, ePartId, status, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const ePart = order.eParts.id(ePartId);
      if (!ePart) {
        throw new Error('EPart not found in order');
      }

      const oldStatus = ePart.status;
      ePart.status = status;

      // Add timeline entry
      const staff = await User.findById(staffId);
      const part = await Inventory.findById(ePart.partId);
      const partName = part ? part.itemName : 'Unknown Part';

      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Status Updated',
        description: `${partName} status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating EPart status:', error);
      throw error;
    }
  }

  // Record missing EPart that was added to a need list
  static async recordEPartNeedListEntry(orderId, entryData, staffId) {
    console.log('OrderService: Recording EPart need list entry:', { orderId, entryData, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const part = await Inventory.findById(entryData.partId);
      if (!part) {
        throw new Error('Part not found');
      }

      let needList = null;
      if (entryData.needListId) {
        needList = await NeedList.findById(entryData.needListId);
        if (!needList) {
          throw new Error('Need list not found');
        }
      }

      const resolvedNeedListName = needList?.name || entryData.needListName || '';
      if (!resolvedNeedListName.trim()) {
        throw new Error('Need list name is required');
      }

      order.ePartNeedListEntries.push({
        partId: entryData.partId,
        quantity: entryData.quantity,
        needListId: needList?._id || null,
        needListName: resolvedNeedListName,
        needListStatus: needList?.status || entryData.needListStatus || 'draft',
        targetType: entryData.targetType || 'existing',
        notes: entryData.notes || '',
        requestedAt: new Date(),
        requestedBy: staffId,
      });

      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Need List Added',
        description: `${part.itemName} x${entryData.quantity} added to need list "${resolvedNeedListName}"`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart need list entry recorded successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error recording EPart need list entry:', error);
      throw error;
    }
  }

  // Add add-on service to order
  // addonData.confirmRepricing: ausdrueckliche Bestaetigung, einen Auftrag neu zu
  // berechnen, dessen gespeicherter Wert nicht zu den Positionen passt (siehe
  // getPricingConditionsForEdit).
  static async addAddonToOrder(orderId, addonData, staffId) {
    console.log('OrderService: Adding add-on to order:', { orderId, addonData, staffId });

    try {
      const staff = staffId ? await User.findById(staffId) : null;
      const staffName = staff ? staff.name : 'Mitarbeiter';

      // Konfliktsicher: Positionen und Auftragswert werden auf demselben (bei Bedarf
      // frisch geladenen) Stand gebildet und nur gemeinsam gespeichert.
      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        const newAddon = {
          name: addonData.name,
          description: addonData.description || '',
          price: addonData.price,
          status: addonData.status || 'pending',
          estimatedTime: addonData.estimatedTime || '',
          progress: 0
        };

        const prevGrossAmount = order.totalCost;
        // Kondition VOR der Aenderung festhalten (Altauftraege leiten sie aus ihren
        // eigenen Werten ab; passt der Wert nicht, nur nach Bestaetigung), dann mit DER
        // Preisregel neu rechnen.
        const { conditions, reconciliation } = OrderService.getPricingConditionsForEdit(order, addonData);
        order.addOns.push(newAddon);
        OrderService.applyOrderPricing(order, conditions);

        await OrderService._autoAssignStaff(order, staffId);
        order.timeline.push({
          status: 'Add-on Service Added',
          description: `Zusatzleistung „${addonData.name}“ hinzugefügt (${formatEuroDe(addonData.price)})`,
          completedAt: new Date(),
          staffId: staffId || 'system',
          staffName
        });

        // validateModifiedOnly: bestehende unvollstaendige Altpositionen nicht erneut validieren
        return { prevGrossAmount, reconciliation, saveOptions: { validateModifiedOnly: true } };
      });

      // Historize order change
      try {
        await OrderRevisionService.recordRevision(updatedOrder, {
          triggerReason: 'addon_added',
          previousGrossAmount: context.prevGrossAmount,
          changedBy: staffId || undefined,
          changedByName: staffName,
          notes: [
            `Zusatzleistung „${addonData.name}“ hinzugefügt (${formatEuroDe(addonData.price)})`,
            OrderService.describeConfirmedRepricing(context.reconciliation),
          ].filter(Boolean).join(' | ')
        });
        await FinancialService.syncOrderAndBookingValue(updatedOrder._id, 'order');
      } catch (revErr) {
        console.warn('OrderService: Warning recording revision on addon add:', revErr.message);
      }

      console.log('OrderService: Add-on added successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error adding add-on:', error);
      throw error;
    }
  }

  // Update add-on service in order
  static async updateOrderAddon(orderId, addonId, updateData, staffId) {
    console.log('OrderService: Updating add-on in order:', { orderId, addonId, updateData, staffId });

    try {
      const staff = staffId ? await User.findById(staffId) : null;
      const staffName = staff ? staff.name : 'Mitarbeiter';

      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        const addon = order.addOns.id(addonId);
        if (!addon) {
          throw buildOrderValueError('Die Zusatzleistung wurde in diesem Auftrag nicht gefunden.', 404, 'ADDON_NOT_FOUND');
        }

        const oldPrice = addon.price;
        const prevTotalCost = order.totalCost;
        const priceChanged = updateData.price !== undefined && Number(updateData.price) !== Number(oldPrice);
        // Nur bei einer Preisaenderung neu rechnen (Status-/Fortschrittsupdates duerfen
        // den Auftragswert nicht anfassen) - dann mit DER Preisregel, Rabatt bleibt.
        const edit = priceChanged ? OrderService.getPricingConditionsForEdit(order, updateData) : null;

        if (updateData.name !== undefined) addon.name = updateData.name;
        if (updateData.description !== undefined) addon.description = updateData.description;
        if (updateData.price !== undefined) addon.price = updateData.price;
        if (updateData.status !== undefined) addon.status = updateData.status;
        if (updateData.estimatedTime !== undefined) addon.estimatedTime = updateData.estimatedTime;
        if (updateData.progress !== undefined) addon.progress = updateData.progress;

        if (edit) {
          OrderService.applyOrderPricing(order, edit.conditions);
        }

        await OrderService._autoAssignStaff(order, staffId);
        order.timeline.push({
          status: 'Add-on Service Updated',
          description: `Zusatzleistung „${addon.name}“ geändert`,
          completedAt: new Date(),
          staffId: staffId || 'system',
          staffName
        });

        return { oldPrice, newPrice: addon.price, addonName: addon.name, prevTotalCost, reconciliation: edit?.reconciliation };
      });

      // Historize order change if price changed or data updated
      try {
        await OrderRevisionService.recordRevision(updatedOrder, {
          triggerReason: 'addon_updated',
          previousGrossAmount: context.prevTotalCost,
          changedBy: staffId || undefined,
          changedByName: staffName,
          notes: [
            `Zusatzleistung „${context.addonName}“ geändert (${formatEuroDe(context.oldPrice)} → ${formatEuroDe(context.newPrice)})`,
            OrderService.describeConfirmedRepricing(context.reconciliation),
          ].filter(Boolean).join(' | ')
        });
        await FinancialService.syncOrderAndBookingValue(updatedOrder._id, 'order');
      } catch (revErr) {
        console.warn('OrderService: Warning recording revision on addon update:', revErr.message);
      }

      console.log('OrderService: Add-on updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating add-on:', error);
      throw error;
    }
  }

  // Remove add-on service from order
  // options.confirmRepricing: siehe addAddonToOrder
  static async removeAddonFromOrder(orderId, addonId, staffId, options = {}) {
    console.log('OrderService: Removing add-on from order:', { orderId, addonId, staffId });

    try {
      const staff = staffId ? await User.findById(staffId) : null;
      const staffName = staff ? staff.name : 'Mitarbeiter';

      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        const addon = order.addOns.id(addonId);
        if (!addon) {
          throw buildOrderValueError('Die Zusatzleistung wurde in diesem Auftrag nicht gefunden.', 404, 'ADDON_NOT_FOUND');
        }

        const addonName = addon.name;
        const addonPrice = addon.price;
        const prevTotalCost = order.totalCost;
        const { conditions, reconciliation } = OrderService.getPricingConditionsForEdit(order, options);

        order.addOns.pull(addonId);

        // Auftragswert mit DER Preisregel neu rechnen (Rabatt bleibt erhalten).
        OrderService.applyOrderPricing(order, conditions);

        await OrderService._autoAssignStaff(order, staffId);
        order.timeline.push({
          status: 'Add-on Service Removed',
          description: `Zusatzleistung „${addonName}“ entfernt (${formatEuroDe(addonPrice)})`,
          completedAt: new Date(),
          staffId: staffId || 'system',
          staffName
        });

        return { addonName, addonPrice, prevTotalCost, reconciliation };
      });

      // Historize order change
      try {
        await OrderRevisionService.recordRevision(updatedOrder, {
          triggerReason: 'addon_removed',
          previousGrossAmount: context.prevTotalCost,
          changedBy: staffId || undefined,
          changedByName: staffName,
          notes: [
            `Zusatzleistung „${context.addonName}“ entfernt (${formatEuroDe(context.addonPrice)})`,
            OrderService.describeConfirmedRepricing(context.reconciliation),
          ].filter(Boolean).join(' | ')
        });
        await FinancialService.syncOrderAndBookingValue(updatedOrder._id, 'order');
      } catch (revErr) {
        console.warn('OrderService: Warning recording revision on addon removal:', revErr.message);
      }

      console.log('OrderService: Add-on removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing add-on:', error);
      throw error;
    }
  }

  // Assign staff to add-on service
  // Konfliktsicher wie alle Positionsschreiber (runGuardedOrderEdit): die Zuweisung wird
  // auf dem frisch geladenen Stand ueber die _id der Zusatzleistung gesetzt. Frueher
  // schrieb ein normales save() ueber den beim Laden gueltigen Array-Index
  // (addOns.N.assignedStaff) - entfernte ein paralleler Vorgang eine andere
  // Zusatzleistung, landete die Zuweisung an der falschen Stelle oder ging verloren.
  // Kein Einfluss auf den Auftragswert.
  static async assignStaffToAddon(orderId, addonId, staffId, assigningStaffId) {
    console.log('OrderService: Assigning staff to add-on:', { orderId, addonId, staffId, assigningStaffId });

    try {
      // Get staff details (einmal, vor dem ggf. wiederholten Speichern)
      const staff = mongoose.Types.ObjectId.isValid(String(staffId || '')) ? await User.findById(staffId) : null;
      if (!staff || !['staff', 'admin'].includes(staff.role)) {
        throw buildOrderValueError('Der ausgewählte Mitarbeiter wurde nicht gefunden oder ist kein Mitarbeiterkonto.', 400, 'INVALID_STAFF');
      }
      const assigningStaff = assigningStaffId ? await User.findById(assigningStaffId) : null;

      // Deutsche Fehler mit statusCode/code: adminOrderRoutes (PUT /:id/addons/:addonId/assign)
      // reicht sie ueber respondOrderEditError an die Oberflaeche weiter.
      const loadOrder = async () => {
        const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
        if (!order) {
          throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
        }
        return order;
      };

      const { order: updatedOrder } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        const addon = order.addOns.id(addonId);
        if (!addon) {
          throw buildOrderValueError('Die Zusatzleistung wurde in diesem Auftrag nicht gefunden.', 404, 'ADDON_NOT_FOUND');
        }

        // Add assignedStaff field to add-on if it doesn't exist
        if (!addon.assignedStaff) {
          addon.assignedStaff = [];
        }

        // Check if staff is already assigned
        const isAlreadyAssigned = addon.assignedStaff.some(
          (s) => toIdString(s.staffId) === toIdString(staff._id)
        );

        if (!isAlreadyAssigned) {
          addon.assignedStaff.push({
            staffId: staff._id,
            name: staff.name,
            avatar: staff.avatar || ''
          });
        }

        // Add timeline entry
        order.timeline.push({
          status: 'Add-on Staff Assigned',
          description: `${staff.name} der Zusatzleistung „${addon.name}“ zugewiesen`,
          completedAt: new Date(),
          staffId: assigningStaffId || 'system',
          staffName: assigningStaff ? assigningStaff.name : 'System'
        });

        // validateModifiedOnly: unvollstaendige Altpositionen nicht erneut validieren
        return { saveOptions: { validateModifiedOnly: true } };
      }, { load: loadOrder });

      console.log('OrderService: Staff assigned to add-on successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning staff to add-on:', error);
      throw error;
    }
  }

  // Assign workflow to order
  static async assignWorkflowToOrder(orderId, workflowTemplateId, staffId, assignedWorkflowStaffId = null) {
    console.log('OrderService: Assigning workflow to order:', { orderId, workflowTemplateId, staffId, assignedWorkflowStaffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }
      console.log('OrderService: Order found:', { orderId, orderNumber: order.orderNumber });

      const workflowTemplate = await WorkflowTemplate.findById(workflowTemplateId);
      if (!workflowTemplate) {
        console.error('OrderService: Workflow template not found:', workflowTemplateId);
        throw new Error('Workflow template not found');
      }
      console.log('OrderService: Workflow template found:', { templateId: workflowTemplate._id, name: workflowTemplate.name });

      let workflowAssignedStaffMembers = [];
      if (assignedWorkflowStaffId) {
        const assignedStaff = await User.findById(assignedWorkflowStaffId);
        if (!assignedStaff || !['staff', 'admin'].includes(assignedStaff.role)) {
          console.error('OrderService: Invalid assigned staff:', { assignedWorkflowStaffId, found: !!assignedStaff, role: assignedStaff?.role });
          throw new Error('Assigned workflow staff member not found or invalid role');
        }
        workflowAssignedStaffMembers = [assignedStaff];
        console.log('OrderService: Assigned staff validated:', { staffId: assignedStaff._id, name: assignedStaff.name, role: assignedStaff.role });
      }

      // Check if workflow is already assigned
      const existingWorkflow = order.workflows.find(
        w => w.workflowTemplateId.toString() === workflowTemplateId
      );
      if (existingWorkflow) {
        console.warn('OrderService: Workflow already assigned to order (idempotent return):', {
          workflowTemplateId,
          existingWorkflowId: existingWorkflow._id,
        });

        // Keep assignment API idempotent: if the template is already attached,
        // return the current order instead of failing with 400.
        order._workflowAlreadyAssigned = true;
        return order;
      }
      console.log('OrderService: Workflow not yet assigned, proceeding...');

      // Create workflow execution steps from template
      const workflowSteps = workflowTemplate.steps.map(step => ({
        stepId: step._id.toString(),
        stepName: step.name,
        status: 'pending',
        formData: {},
        checklistData: {},
        photos: []
      }));

      // Add workflow to order
      order.workflows.push({
        workflowTemplateId,
        workflowName: workflowTemplate.name,
        assignedStaffId: workflowAssignedStaffMembers[0]?._id,
        assignedStaff: buildWorkflowStepAssignments(workflowAssignedStaffMembers),
        steps: workflowSteps,
        currentStepIndex: 0,
        status: 'not-started',
        estimatedCompletionTime: workflowTemplate.estimatedTotalTime
      });

      ensureOrderStaffAssignments(order, workflowAssignedStaffMembers);

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Assigned',
        description: workflowAssignedStaffMembers.length > 0
          ? `Workflow "${workflowTemplate.name}" assigned to order and ${workflowAssignedStaffMembers[0].name}`
          : `Workflow "${workflowTemplate.name}" assigned to order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'System'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning workflow:', error);
      throw error;
    }
  }

  // Start workflow execution
  static async startWorkflow(orderId, workflowId, staffId) {
    console.log('OrderService: Starting workflow:', { orderId, workflowId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      if (workflow.status !== 'not-started') {
        throw new Error('Workflow has already been started');
      }

      // Get staff details for assignment
      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      console.log('OrderService: Updating order status to in-progress and assigning staff');

      // Update order status to 'in-progress' if it's not already
      const previousStatus = order.status;
      if (order.status !== 'in-progress') {
        order.status = 'in-progress';
        console.log(`OrderService: Order status changed from "${previousStatus}" to "in-progress"`);
      }

      // Assign staff member to order if not already assigned
      const staffAssignmentExists = order.assignedStaff.some(
        s => s.staffId.toString() === staffId.toString()
      );

      if (!staffAssignmentExists) {
        console.log('OrderService: Assigning staff to order:', staff.name);
        order.assignedStaff.push({
          staffId: staffId,
          name: staff.name,
          avatar: staff.avatar || ''
        });
      } else {
        console.log('OrderService: Staff already assigned to order');
      }

      // Update workflow status
      workflow.status = 'in-progress';
      workflow.startedAt = new Date();

      // Set first step to in-progress
      if (workflow.steps.length > 0) {
        workflow.steps[0].status = 'in-progress';
        workflow.steps[0].startedAt = new Date();
        applyWorkflowStepAssignment(workflow.steps[0], [staff], staffId);
      }

      // Add timeline entries
      // First entry for order status change
      if (previousStatus !== 'in-progress') {
        order.timeline.push({
          status: 'Repair in Progress',
          description: `Order status updated to "Repair in Progress" and assigned to ${staff.name} upon workflow initiation`,
          completedAt: new Date(),
          staffId: staffId,
          staffName: staff.name
        });
        console.log('OrderService: Added timeline entry for order status change');
      }

      // Second entry for workflow start
      order.timeline.push({
        status: 'Workflow Started',
        description: `Workflow "${workflow.workflowName}" started by ${staff.name}`,
        completedAt: new Date(),
        staffId: staffId,
        staffName: staff.name
      });
      console.log('OrderService: Added timeline entry for workflow start');

      const updatedOrder = await order.save();

      if (previousStatus !== 'in-progress') {
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} ist jetzt in Bearbeitung. Wir haben mit der Reparatur begonnen. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`,
          'in-progress'
        );
      }

      console.log('OrderService: Workflow started successfully with order status updated and staff assigned');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error starting workflow:', error);
      console.error('OrderService: Error details:', error.message, error.stack);
      throw error;
    }
  }

  // Assign one or multiple staff members to a workflow step
  static async assignWorkflowStepStaff(orderId, workflowId, stepId, staffIds, assigningStaffId) {
    console.log('OrderService: Assigning staff to workflow step:', {
      orderId,
      workflowId,
      stepId,
      staffIds,
      assigningStaffId,
    });

    try {
      const uniqueStaffIds = getUniqueStaffIds(staffIds);
      if (uniqueStaffIds.length === 0) {
        throw new Error('At least one valid staff ID is required');
      }

      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      const staffMembers = await User.find({
        _id: { $in: uniqueStaffIds },
        role: { $in: ['staff', 'admin'] },
      });

      if (staffMembers.length !== uniqueStaffIds.length) {
        throw new Error('One or more staff members not found');
      }

      applyWorkflowStepAssignment(step, staffMembers, step.assignedStaffId || assigningStaffId);
      ensureOrderStaffAssignments(order, staffMembers);

      const stepIndex = workflow.steps.findIndex((stepItem) => toIdString(stepItem._id) === toIdString(step._id));
      const isCurrentStep = Number(workflow.currentStepIndex) === stepIndex;

      // Assigning an active task should make the current pending step actionable immediately.
      if (isCurrentStep && workflow.status === 'in-progress' && step.status === 'pending') {
        step.status = 'in-progress';
        if (!step.startedAt) {
          step.startedAt = new Date();
        }
      }

      const assigningStaff = assigningStaffId ? await User.findById(assigningStaffId) : null;
      order.timeline.push({
        status: 'Workflow Task Assigned',
        description: `Step "${step.stepName}" in workflow "${workflow.workflowName}" assigned to: ${staffMembers.map((staff) => staff.name).join(', ')}`,
        completedAt: new Date(),
        staffId: assigningStaffId || 'system',
        staffName: assigningStaff ? assigningStaff.name : 'System',
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow step staff assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning workflow step staff:', error);
      throw error;
    }
  }

  // Complete workflow step
  static async completeWorkflowStep(orderId, workflowId, stepId, stepData, staffId) {
    console.log('OrderService: Completing workflow step:', { orderId, workflowId, stepId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      if (step.status === 'completed') {
        throw new Error('Step has already been completed');
      }

      const previousProgress = Number(order.progress || 0);

      // Update step data
      const completedAt = new Date();
      step.status = 'completed';
      step.completedAt = completedAt;

      if (!step.startedAt) {
        const startedFromPayload = stepData?.timing?.startedAt ? new Date(stepData.timing.startedAt) : null;
        if (startedFromPayload && Number.isFinite(startedFromPayload.getTime())) {
          step.startedAt = startedFromPayload;
        } else {
          step.startedAt = completedAt;
        }
      }

      const estimatedDurationMinutes = Number(step.estimatedTime || 0);
      const payloadElapsedMinutes = Number(stepData?.timing?.elapsedMinutes);
      let actualDurationMinutes = 0;
      let effectivePausedMinutes = Number(step.totalPausedMinutes || 0);

      if (step.currentPauseStartedAt) {
        const pauseStartTs = new Date(step.currentPauseStartedAt).getTime();
        const completedAtTs = completedAt.getTime();
        if (Number.isFinite(pauseStartTs) && completedAtTs > pauseStartTs) {
          const openPauseDuration = Math.round((completedAtTs - pauseStartTs) / (1000 * 60));
          effectivePausedMinutes += openPauseDuration;

          if (!Array.isArray(step.pauseHistory)) {
            step.pauseHistory = [];
          }

          const openPauseEntry = [...step.pauseHistory].reverse().find((entry) => !entry.resumedAt);
          if (openPauseEntry) {
            openPauseEntry.resumedAt = completedAt;
            openPauseEntry.durationMinutes = openPauseDuration;
          }

          step.currentPauseStartedAt = undefined;
        }
      }

      step.totalPausedMinutes = Math.max(0, Math.round(effectivePausedMinutes));

      if (Number.isFinite(payloadElapsedMinutes) && payloadElapsedMinutes >= 0) {
        actualDurationMinutes = Math.round(payloadElapsedMinutes);
      } else if (step.startedAt) {
        const startedAtTs = new Date(step.startedAt).getTime();
        const completedAtTs = completedAt.getTime();
        if (Number.isFinite(startedAtTs) && completedAtTs > startedAtTs) {
          const rawDuration = Math.round((completedAtTs - startedAtTs) / (1000 * 60));
          actualDurationMinutes = Math.max(0, rawDuration - step.totalPausedMinutes);
        }
      }

      step.actualDurationMinutes = Math.max(0, actualDurationMinutes);
      step.estimatedDurationMinutes = Math.max(0, Math.round(estimatedDurationMinutes));
      step.durationDeltaMinutes = step.actualDurationMinutes - step.estimatedDurationMinutes;

      if (stepData.formData) step.formData = stepData.formData;
      if (stepData.checklistData) step.checklistData = stepData.checklistData;
      if (stepData.notes) step.notes = stepData.notes;
      if (stepData.photos) step.photos = stepData.photos;

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      // Fetch staff once for use in both timeline entries and step assignment
      const staff = await User.findById(staffId);
      const previousOrderStatus = order.status;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        if (staff) {
          applyWorkflowStepAssignment(workflow.steps[nextIndex], [staff], staffId);
        }
      } else {
        // All steps in this workflow completed
        const workflowCompletedAt = new Date();
        workflow.status = 'completed';
        workflow.completedAt = workflowCompletedAt;

        // Add workflow completion timeline entry
        order.timeline.push({
          status: 'Workflow Completed',
          description: `Workflow "${workflow.workflowName}" wurde vollständig abgeschlossen (${workflow.steps.length} Schritte)`,
          completedAt: workflowCompletedAt,
          staffId: staffId || 'system',
          staffName: staff ? staff.name : 'Staff Member',
        });

        // If every workflow on this order is now done, advance the order status
        const allWorkflowsDone = order.workflows.every(wf =>
          wf._id.toString() === workflowId.toString() ? true : wf.status === 'completed'
        );
        if (allWorkflowsDone && ['in-progress', 'quality-check', 'diagnostic-assessment'].includes(order.status)) {
          order.status = 'ready-for-pickup';
          order.actualCompletion = workflowCompletedAt;
          order.timeline.push({
            status: 'Order Ready',
            description: `Auftrag ${order.orderNumber} ist abgeschlossen und bereit zur Abholung`,
            completedAt: workflowCompletedAt,
            staffId: staffId || 'system',
            staffName: staff ? staff.name : 'Staff Member',
          });
        }
      }

      // Add step completion timeline entry
      const timingSummary = step.estimatedDurationMinutes > 0
        ? ` (actual ${step.actualDurationMinutes} min vs estimated ${step.estimatedDurationMinutes} min)`
        : ` (actual ${step.actualDurationMinutes} min)`;
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Step Completed',
        description: `Step "${step.stepName}" completed in workflow "${workflow.workflowName}"${timingSummary}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member',
        photos: stepData.photos || []
      });

      // Update order progress based on workflow completion
      const totalSteps = workflow.steps.length;
      const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
      const workflowProgress = Math.round((completedSteps / totalSteps) * 100);

      // Calculate overall order progress (weighted average of all workflows)
      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat einen neuen Reparaturfortschritt erreicht: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Letzter Schritt: ${step.stepName}.`
        );
      }

      // Notify customer if order became ready for pickup
      if (previousOrderStatus !== updatedOrder.status && updatedOrder.status === 'ready-for-pickup') {
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Gute Nachrichten! Ihr Auftrag ${updatedOrder.orderNumber} ist fertig und kann abgeholt werden. Alle Reparaturschritte wurden erfolgreich abgeschlossen.`,
          'ready-for-pickup'
        );
      }

      console.log('OrderService: Workflow step completed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error completing workflow step:', error);
      throw error;
    }
  }

  // Skip workflow step
  static async skipWorkflowStep(orderId, workflowId, stepId, reason, staffId) {
    console.log('OrderService: Skipping workflow step:', { orderId, workflowId, stepId, reason, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      if (step.status === 'completed' || step.status === 'skipped') {
        throw new Error('Step has already been completed or skipped');
      }

      const previousProgress = Number(order.progress || 0);

      // Update step status
      const skippedAt = new Date();
      step.status = 'skipped';
      step.completedAt = skippedAt;

      if (step.startedAt) {
        const startedAtTs = new Date(step.startedAt).getTime();
        const skippedAtTs = skippedAt.getTime();
        if (Number.isFinite(startedAtTs) && skippedAtTs > startedAtTs) {
          const rawDurationMinutes = Math.round((skippedAtTs - startedAtTs) / (1000 * 60));
          const pausedMinutes = Number(step.totalPausedMinutes || 0);
          step.actualDurationMinutes = Math.max(0, rawDurationMinutes - pausedMinutes);
        }
      }

      if (step.currentPauseStartedAt) {
        const pauseStartTs = new Date(step.currentPauseStartedAt).getTime();
        const skippedAtTs = skippedAt.getTime();
        if (Number.isFinite(pauseStartTs) && skippedAtTs > pauseStartTs) {
          const openPauseDuration = Math.round((skippedAtTs - pauseStartTs) / (1000 * 60));
          step.totalPausedMinutes = Number(step.totalPausedMinutes || 0) + openPauseDuration;

          if (!Array.isArray(step.pauseHistory)) {
            step.pauseHistory = [];
          }

          const openPauseEntry = [...step.pauseHistory].reverse().find((entry) => !entry.resumedAt);
          if (openPauseEntry) {
            openPauseEntry.resumedAt = skippedAt;
            openPauseEntry.durationMinutes = openPauseDuration;
          }
        }
        step.currentPauseStartedAt = undefined;
      }

      step.estimatedDurationMinutes = Number(step.estimatedTime || 0);
      step.durationDeltaMinutes = (step.actualDurationMinutes || 0) - (step.estimatedDurationMinutes || 0);
      step.notes = reason || 'Step skipped';

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        if (staffId) {
          const staff = await User.findById(staffId);
          if (staff) {
            applyWorkflowStepAssignment(workflow.steps[nextIndex], [staff], staffId);
          }
        }
      } else {
        // All steps completed or skipped
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Step Skipped',
        description: `Step "${step.stepName}" skipped in workflow "${workflow.workflowName}". Reason: ${reason || 'Not provided'}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      // Update order progress
      const totalSteps = workflow.steps.length;
      const completedOrSkippedSteps = workflow.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;

      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess aktualisiert: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Ein Schritt wurde uebersprungen.`
        );
      }

      console.log('OrderService: Workflow step skipped successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error skipping workflow step:', error);
      throw error;
    }
  }

  // Pause/Resume workflow
  static async updateWorkflowStatus(orderId, workflowId, status, staffId, pauseReason = null) {
    console.log('OrderService: Updating workflow status:', { orderId, workflowId, status, staffId, pauseReason });

    try {
      // Fetch order without auto-population to avoid validation issues when saving
      // The skipAutoPopulate option prevents the pre-find hook from populating references
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        console.error('OrderService: Order not found:', orderId);
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        console.error('OrderService: Workflow not found in order:', workflowId);
        throw new Error('Workflow not found in order');
      }

      const validStatuses = ['not-started', 'in-progress', 'on-hold', 'completed'];
      if (!validStatuses.includes(status)) {
        console.error('OrderService: Invalid workflow status:', status);
        throw new Error('Invalid workflow status');
      }

      const oldStatus = workflow.status;
      const oldOrderStatus = order.status;
      workflow.status = status;

      const hasActiveWorkflow = () => order.workflows.some((workflowItem) => {
        if (!workflowItem || String(workflowItem._id) === String(workflowId)) {
          return false;
        }

        return workflowItem.status === 'in-progress';
      });

      console.log('OrderService: Workflow status updating from', oldStatus, 'to', status);

      // If pausing workflow (status = 'on-hold'), handle pause reason and keep the order in the repair stage.
      if (status === 'on-hold' && oldStatus !== 'on-hold') {
        console.log('OrderService: Pausing workflow with reason:', pauseReason);
        const pauseStartedAt = new Date();

        // Record pause reason and timestamp
        if (pauseReason) {
          workflow.pauseReason = pauseReason;
          console.log('OrderService: Pause reason recorded:', pauseReason);
        }

        workflow.pausedAt = pauseStartedAt;
        console.log('OrderService: Pause timestamp recorded');

        const activeStepIndex = Number(workflow.currentStepIndex || 0);
        const activeStep = workflow.steps[activeStepIndex] || workflow.steps.find((stepItem) => stepItem.status === 'in-progress');

        if (activeStep && activeStep.status === 'in-progress') {
          if (!activeStep.currentPauseStartedAt) {
            activeStep.currentPauseStartedAt = pauseStartedAt;
          }

          if (!Array.isArray(activeStep.pauseHistory)) {
            activeStep.pauseHistory = [];
          }

          activeStep.pauseHistory.push({
            pausedAt: pauseStartedAt,
            reason: pauseReason || 'Kein Grund angegeben',
            stepId: activeStep.stepId,
            stepName: activeStep.stepName,
            stepIndex: activeStepIndex,
          });

          if (!Array.isArray(workflow.pauseHistory)) {
            workflow.pauseHistory = [];
          }

          workflow.pauseHistory.push({
            pausedAt: pauseStartedAt,
            reason: pauseReason || 'Kein Grund angegeben',
            stepId: activeStep.stepId,
            stepName: activeStep.stepName,
            stepIndex: activeStepIndex,
          });
        }

        const nextOrderStatus = hasActiveWorkflow() ? 'in-progress' : 'paused';
        order.status = nextOrderStatus;
        console.log('OrderService: Order status changed from', oldOrderStatus, 'to', nextOrderStatus);
      }

      // If resuming workflow (status = 'in-progress'), clear pause reason and return the order to repair mode.
      if (status === 'in-progress' && oldStatus === 'on-hold') {
        console.log('OrderService: Resuming workflow, clearing pause reason');
        const resumedAt = new Date();

        if (workflow.pausedAt) {
          const pausedAtTs = new Date(workflow.pausedAt).getTime();
          const resumedAtTs = resumedAt.getTime();
          if (Number.isFinite(pausedAtTs) && resumedAtTs > pausedAtTs) {
            const workflowPauseDuration = Math.round((resumedAtTs - pausedAtTs) / (1000 * 60));
            workflow.totalPausedMinutes = Number(workflow.totalPausedMinutes || 0) + workflowPauseDuration;

            if (!Array.isArray(workflow.pauseHistory)) {
              workflow.pauseHistory = [];
            }

            const openWorkflowPause = [...workflow.pauseHistory].reverse().find((entry) => !entry.resumedAt);
            if (openWorkflowPause) {
              openWorkflowPause.resumedAt = resumedAt;
              openWorkflowPause.durationMinutes = workflowPauseDuration;
            }
          }
        }

        const activeStepIndex = Number(workflow.currentStepIndex || 0);
        const activeStep = workflow.steps[activeStepIndex] || workflow.steps.find((stepItem) => stepItem.status === 'in-progress');

        if (activeStep && activeStep.currentPauseStartedAt) {
          const stepPausedAtTs = new Date(activeStep.currentPauseStartedAt).getTime();
          const resumedAtTs = resumedAt.getTime();
          if (Number.isFinite(stepPausedAtTs) && resumedAtTs > stepPausedAtTs) {
            const stepPauseDuration = Math.round((resumedAtTs - stepPausedAtTs) / (1000 * 60));
            activeStep.totalPausedMinutes = Number(activeStep.totalPausedMinutes || 0) + stepPauseDuration;

            if (!Array.isArray(activeStep.pauseHistory)) {
              activeStep.pauseHistory = [];
            }

            const openStepPause = [...activeStep.pauseHistory].reverse().find((entry) => !entry.resumedAt);
            if (openStepPause) {
              openStepPause.resumedAt = resumedAt;
              openStepPause.durationMinutes = stepPauseDuration;
            }
          }

          activeStep.currentPauseStartedAt = undefined;
        }

        workflow.pauseReason = '';
        workflow.pausedAt = null;
        if (order.status === 'paused' || order.status === 'pending') {
          order.status = 'in-progress';
        }
        console.log('OrderService: Pause reason and timestamp cleared');
      }

      // Get staff details for timeline entry
      const staff = await User.findById(staffId);
      const staffName = staff ? staff.name : 'Staff Member';

      await OrderService._autoAssignStaff(order, staffId);

      // Add timeline entry for workflow status change
      let timelineDescription = `Workflow "${workflow.workflowName}" status changed from ${oldStatus} to ${status}`;
      if (status === 'on-hold' && pauseReason) {
        timelineDescription += ` - Reason: ${pauseReason}`;
      }

      order.timeline.push({
        status: status === 'on-hold' ? 'Workflow Paused' : (status === 'in-progress' ? 'Workflow Resumed' : 'Workflow Status Updated'),
        description: timelineDescription,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staffName
      });
      console.log('OrderService: Timeline entry added for workflow status change');

      // If order status changed (pausing), add separate timeline entry
      if (oldOrderStatus !== order.status) {
        order.timeline.push({
          status: 'Order Status Updated',
          description: `Order status changed from ${oldOrderStatus} to ${order.status} due to workflow status update`,
          completedAt: new Date(),
          staffId: staffId || 'system',
          staffName: staffName
        });
        console.log('OrderService: Timeline entry added for order status change');
      }

      const updatedOrder = await order.save();

      if (oldOrderStatus !== updatedOrder.status) {
        const oldStatusLabel = this.getStatusLabel(oldOrderStatus);
        const newStatusLabel = this.getStatusLabel(updatedOrder.status);
        const pauseHint = status === 'on-hold' && pauseReason ? ` Grund: ${pauseReason}` : '';

        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat den Status gewechselt: ${oldStatusLabel} -> ${newStatusLabel}.${pauseHint} Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`,
          updatedOrder.status
        );
      }

      console.log('OrderService: Workflow status updated successfully:', {
        workflowStatus: status,
        orderStatus: updatedOrder.status,
        pauseReason: pauseReason || 'N/A'
      });
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating workflow status:', error);
      console.error('OrderService: Error details:', {
        message: error.message,
        stack: error.stack,
        orderId,
        workflowId,
        status,
        staffId,
        pauseReason
      });
      throw error;
    }
  }

  // Navigate to previous step
  static async goBackToStep(orderId, workflowId, stepId, staffId) {
    console.log('OrderService: Going back to workflow step:', { orderId, workflowId, stepId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const stepIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      if (stepIndex === -1) {
        throw new Error('Step not found in workflow');
      }

      const step = workflow.steps[stepIndex];

      // Can only go back to completed or skipped steps
      if (step.status !== 'completed' && step.status !== 'skipped') {
        throw new Error('Can only navigate back to completed or skipped steps');
      }

      const previousProgress = Number(order.progress || 0);

      // Reset the target step to in-progress
      step.status = 'in-progress';
      step.startedAt = new Date();
      if (staffId) {
        const stepStaff = await User.findById(staffId);
        if (stepStaff) {
          applyWorkflowStepAssignment(step, [stepStaff], staffId);
        }
      }
      step.completedAt = undefined;

      // Reset all steps after the target step to pending
      for (let i = stepIndex + 1; i < workflow.steps.length; i++) {
        workflow.steps[i].status = 'pending';
        workflow.steps[i].startedAt = undefined;
        workflow.steps[i].completedAt = undefined;
        workflow.steps[i].assignedStaffId = undefined;
        workflow.steps[i].assignedStaff = [];
      }

      // Update workflow
      workflow.currentStepIndex = stepIndex;
      workflow.status = 'in-progress';
      workflow.completedAt = undefined;

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Navigation',
        description: `Navigated back to step "${step.stepName}" in workflow "${workflow.workflowName}"`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      // Update order progress
      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess zurueckgesetzt. Neuer Fortschritt: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%).`
        );
      }

      console.log('OrderService: Successfully navigated back to step');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error navigating back to step:', error);
      throw error;
    }
  }

  // Get workflow for order
  static async getOrderWorkflows(orderId) {
    console.log('OrderService: Getting workflows for order:', orderId);

    try {
      const order = await Order.findById(orderId)
        .populate('workflows.workflowTemplateId')
        .populate('workflows.assignedStaffId', 'name avatar')
        .populate('workflows.assignedStaff.staffId', 'name avatar')
        .populate('workflows.steps.assignedStaffId', 'name avatar')
        .populate('workflows.steps.assignedStaff.staffId', 'name avatar');

      if (!order) {
        throw new Error('Order not found');
      }

      // Enrich workflow steps with form fields and checklist items from template
      const enrichedWorkflows = order.workflows.map((workflow) => {
        const workflowObj = workflow.toObject();

        if (workflowObj.workflowTemplateId && workflowObj.workflowTemplateId.steps) {
          // Create a map of template steps by stepId for quick lookup
          const templateStepsMap = {};
          workflowObj.workflowTemplateId.steps.forEach((step) => {
            templateStepsMap[step._id.toString()] = step;
          });

          // Enrich execution steps with template data
          workflowObj.steps = workflowObj.steps.map((execStep) => {
            const templateStep = templateStepsMap[execStep.stepId?.toString()];
            if (templateStep) {
              return {
                ...execStep,
                name: templateStep.name || execStep.stepName,
                description: templateStep.description,
                checklistItems: templateStep.checklistItems || [],
                formFields: templateStep.formFields || [],
                requiresFormCompletion: templateStep.requiresFormCompletion,
                canSkip: templateStep.canSkip,
                estimatedTime: templateStep.estimatedTime,
              };
            }
            return execStep;
          });
        }

        return workflowObj;
      });

      console.log('OrderService: Found', order.workflows.length, 'workflows for order');
      console.log('OrderService: Enriched workflows with form fields and checklist items');
      return enrichedWorkflows;
    } catch (error) {
      console.error('OrderService: Error getting order workflows:', error);
      throw error;
    }
  }

  // —SUGGESTED_WORKFLOWS_FIX (file `server/services/orderService.js`) —
  // Description: Get suggested workflows for order based on device type and services, including general workflows available for all devices/services
  // Enhancement: Now returns both specific device/service type matches and general workflows with empty arrays
  // This allows German workflows (like general repair process, quality check, etc.) to be suggested for all orders
  static async getSuggestedWorkflows(orderId) {
    console.log('OrderService: Getting suggested workflows for order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('services.serviceId');
      if (!order) {
        throw new Error('Order not found');
      }

      console.log('OrderService: Order details for workflow matching:', {
        orderId,
        deviceType: order.deviceType,
        serviceCount: order.services?.length || 0,
        services: order.services?.map(s => ({
          serviceId: s.serviceId?._id,
          serviceName: s.serviceId?.name,
          serviceCategory: s.serviceId?.category
        }))
      });

      // Extract service categories from the order services
      const serviceCategories = [];
      if (order.services && order.services.length > 0) {
        order.services.forEach(orderService => {
          if (orderService.serviceId && orderService.serviceId.category) {
            if (!serviceCategories.includes(orderService.serviceId.category)) {
              serviceCategories.push(orderService.serviceId.category);
            }
          }
        });
      }

      // serviceTypes on a WorkflowTemplate is a [String] that may hold EITHER a
      // service CATEGORY (what the old matching assumed) or a Service ObjectId
      // (what the admin UI actually writes). Pass both so scope matching works
      // for templates saved either way - see F1-D.
      const serviceIds = [];
      if (order.services && order.services.length > 0) {
        order.services.forEach((orderService) => {
          const serviceId = toIdString(orderService.serviceId);
          if (serviceId && !serviceIds.includes(serviceId)) {
            serviceIds.push(serviceId);
          }
        });
      }

      console.log('OrderService: Extracted service categories:', serviceCategories);
      console.log('OrderService: Extracted service ids:', serviceIds);

      const assignedTemplateIds = (order.workflows || [])
        .map((assignedWorkflow) => toIdString(assignedWorkflow.workflowTemplateId))
        .filter(Boolean);

      // Single source of truth for the suggestion rule (WorkflowService):
      //  - a template scoped to this device type / these services wins;
      //  - a general catch-all template (no deviceTypes AND no serviceTypes) is
      //    only offered when NO specific template matches the order;
      //  - a template already assigned to the order is never suggested again
      //    (the former alwaysVisibleWorkflowNameMarkers whitelist is gone).
      const suggestedWorkflows = await WorkflowService.getSuggestedWorkflows({
        deviceType: order.deviceType,
        serviceCategories,
        serviceIds,
        assignedTemplateIds
      });

      console.log('OrderService: Found', suggestedWorkflows.length, 'suggested workflows');
      console.log('OrderService: Suggested workflows:', suggestedWorkflows.map(w => ({
        id: w._id,
        name: w.name,
        deviceTypes: w.deviceTypes,
        serviceTypes: w.serviceTypes,
        stepsCount: w.steps?.length || 0
      })));

      return suggestedWorkflows;
    } catch (error) {
      console.error('OrderService: Error getting suggested workflows:', error);
      throw error;
    }
  }
  // —END_OF_SUGGESTED_WORKFLOWS_FIX—

  // Description: Get order progress timeline with milestone data
  // Returns structured stages with completion status and dates
  static async getProgressTimeline(orderId) {
    console.log('OrderService: Getting progress timeline for order:', orderId);

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Map timeline entries by status
      const timelineMap = {};
      if (order.timeline && order.timeline.length > 0) {
        order.timeline.forEach(entry => {
          timelineMap[entry.status] = entry;
        });
      }

      // Helper function to format date
      const formatDate = (date) => {
        if (!date) return null;
        return new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      };

      // Define timeline stages
      const stages = [
        {
          id: 'order-received',
          label: 'Order Received',
          status: 'completed', // Always completed when order exists
          date: formatDate(order.createdAt)
        },
        {
          id: 'diagnostic',
          label: 'Diagnostic Assessment',
          status: timelineMap['Diagnostic Assessment']
            ? 'completed'
            : order.status === 'diagnostic-assessment'
              ? 'in-progress'
              : (order.status !== 'pending' ? 'completed' : 'pending'),
          date: timelineMap['Diagnostic Assessment'] ? formatDate(timelineMap['Diagnostic Assessment'].completedAt) : null
        },
        {
          id: 'repair',
          label: 'Repair in Progress',
          status: (order.status === 'in-progress' || order.status === 'paused')
            ? 'in-progress'
            : (order.status === 'quality-check' || order.status === 'completed' || order.status === 'ready-for-pickup'
              ? 'completed'
              : 'pending'),
          date: timelineMap['Repair in Progress'] ? formatDate(timelineMap['Repair in Progress'].completedAt) : null
        },
        {
          id: 'quality-check',
          label: 'Quality Check',
          status: order.status === 'quality-check' ? 'in-progress' : (order.status === 'completed' || order.status === 'ready-for-pickup' ? 'completed' : 'pending'),
          date: timelineMap['Quality Check'] ? formatDate(timelineMap['Quality Check'].completedAt) : null
        },
        {
          id: 'pickup',
          label: order.status === 'ready-for-pickup' ? 'Ready for Pickup' : 'Completed',
          status: order.status === 'completed' || order.status === 'ready-for-pickup' ? 'completed' : 'pending',
          date: order.actualCompletion ? formatDate(order.actualCompletion) : null
        }
      ];

      // Determine current stage based on order status
      let currentStage = 'order-received';
      if (order.status === 'diagnostic-assessment') {
        currentStage = 'diagnostic';
      } else if (order.status === 'in-progress' || order.status === 'paused') {
        currentStage = 'repair';
      } else if (order.status === 'quality-check') {
        currentStage = 'quality-check';
      } else if (order.status === 'completed' || order.status === 'ready-for-pickup') {
        currentStage = 'pickup';
      }

      console.log('OrderService: Progress timeline calculated for order:', orderId, 'Current stage:', currentStage);

      return {
        stages,
        currentStage,
        orderStatus: order.status,
        progress: order.progress
      };
    } catch (error) {
      console.error('OrderService: Error getting progress timeline:', error);
      throw error;
    }
  }

  // Confirm/verify unlock code or pattern
  static async confirmUnlock(orderId, userId, userName, confirmationStatus, notes = '') {
    console.log('OrderService: Confirming unlock for order:', orderId, 'by user:', userName);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate user has unlock information
      if (!order.unlockPattern.length && !order.unlockCode && !order.noLock) {
        throw new Error('No unlock information to confirm for this order');
      }

      // Validate confirmation status
      if (!['verified', 'incorrect', 'unable-to-verify'].includes(confirmationStatus)) {
        throw new Error('Invalid confirmation status. Must be verified, incorrect, or unable-to-verify');
      }

      // Update order with confirmation
      order.unlockConfirmation = {
        confirmedBy: userId,
        confirmedByName: userName,
        confirmationStatus: confirmationStatus,
        notes: notes,
        confirmedAt: new Date()
      };

      const updatedOrder = await order.save();
      console.log('OrderService: Unlock confirmation recorded for order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error confirming unlock:', error);
      throw error;
    }
  }

  // Update device information for order
  static async updateDevice(orderId, deviceData, userId, userName) {
    console.log('OrderService: Updating device information for order:', orderId, 'Device:', deviceData);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Store old device information for timeline
      const oldDeviceBrand = order.deviceBrand;
      const oldDeviceModel = order.deviceModel;
      const oldDeviceType = order.deviceType;

      // Update device information
      if (deviceData.deviceBrand) {
        order.deviceBrand = deviceData.deviceBrand;
      }
      if (deviceData.deviceModel) {
        order.deviceModel = deviceData.deviceModel;
      }
      if (deviceData.deviceType) {
        order.deviceType = deviceData.deviceType;
      }

      // Add timeline entry for device change
      order.timeline.push({
        status: 'Device Changed',
        description: `Device changed from ${oldDeviceBrand} ${oldDeviceModel} to ${deviceData.deviceBrand} ${deviceData.deviceModel}`,
        completedAt: new Date(),
        staffId: userId,
        staffName: userName
      });

      const updatedOrder = await order.save();
      console.log('OrderService: Device information updated for order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating device information:', error);
      throw error;
    }
  }

  // Add shop product to order
  // options.confirmRepricing: siehe getPricingConditionsForEdit
  static async addShopProduct(orderId, productId, quantity, userId, options = {}) {
    console.log('OrderService: Adding shop product to order:', orderId, 'Product:', productId, 'Quantity:', quantity);

    try {
      // Validate product exists and has stock
      const product = mongoose.Types.ObjectId.isValid(String(productId || '')) ? await Product.findById(productId) : null;
      if (!product) {
        throw buildOrderValueError('Das Produkt wurde nicht gefunden.', 404, 'PRODUCT_NOT_FOUND');
      }

      if (product.stock < quantity) {
        throw buildOrderValueError(
          `Nicht genügend Bestand: verfügbar ${product.stock}, angefragt ${quantity}.`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      // Konfliktsicher (siehe runGuardedOrderEdit): Menge/Position und Auftragswert
      // stammen aus demselben Stand.
      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        const prevTotalCost = order.totalCost;
        const { conditions, reconciliation, repricingConfirmed } = OrderService.getPricingConditionsForEdit(order, options);

        // Check if product already exists in order
        const existingProductIndex = order.shopProducts.findIndex(
          p => p.productId && p.productId.toString() === productId.toString()
        );

        if (existingProductIndex !== -1) {
          // Update quantity
          order.shopProducts[existingProductIndex].quantity += quantity;
          console.log('OrderService: Updated quantity for existing product in order');
        } else {
          // Add new product
          order.shopProducts.push({
            productId: productId,
            quantity: quantity,
            priceAtOrder: product.price,
            addedBy: userId,
            addedAt: new Date()
          });
          console.log('OrderService: Added new product to order');
        }

        // Recalculate total cost
        await OrderService.recalculateOrderTotal(order, conditions);
        return { prevTotalCost, reconciliation, repricingConfirmed };
      });
      console.log('OrderService: Shop product added successfully to order:', orderId);
      await OrderService.recordConfirmedShopRepricing(updatedOrder, context, {
        triggerReason: 'scope_change',
        note: `Produkt „${product.name || 'Produkt'}“ ×${quantity} hinzugefügt (${formatEuroDe(product.price)} je Stück)`,
        userId,
      });

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error adding shop product to order:', error);
      throw error;
    }
  }

  // Bestaetigte Neuberechnung eines nicht aufgehenden Auftrags bei einer Produktaenderung in
  // der Auftragshistorie festhalten - wie bei Services, Zusatzleistungen und
  // Geraetewechsel (die Oberflaeche sagt das bei der Bestaetigung zu). Ohne bestaetigte
  // Abweichung wird hier nichts geschrieben (bisheriges Verhalten).
  static async recordConfirmedShopRepricing(order, context, { triggerReason, note, userId }) {
    if (!context || !context.repricingConfirmed) return;
    try {
      const staff = userId ? await User.findById(userId).select('name') : null;
      await OrderRevisionService.recordRevision(order, {
        triggerReason,
        previousGrossAmount: context.prevTotalCost,
        changedBy: userId || undefined,
        changedByName: staff?.name || 'Mitarbeiter',
        notes: [note, OrderService.describeConfirmedRepricing(context.reconciliation)].filter(Boolean).join(' | '),
      });
    } catch (revErr) {
      console.warn('OrderService: Warning recording revision on confirmed product repricing:', revErr.message);
    }
  }

  // Remove shop product from order
  static async removeShopProduct(orderId, productItemId, userId, options = {}) {
    console.log('OrderService: Removing shop product from order:', orderId, 'Product item:', productItemId);

    try {
      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        // Find and remove the product
        const productIndex = order.shopProducts.findIndex(
          p => p._id && p._id.toString() === productItemId.toString()
        );

        if (productIndex === -1) {
          throw buildOrderValueError('Das Produkt wurde in diesem Auftrag nicht gefunden.', 404, 'PRODUCT_NOT_IN_ORDER');
        }

        const prevTotalCost = order.totalCost;
        const removedItem = order.shopProducts[productIndex];
        const { conditions, reconciliation, repricingConfirmed } = OrderService.getPricingConditionsForEdit(order, options);
        order.shopProducts.splice(productIndex, 1);
        console.log('OrderService: Shop product removed from order');

        // Recalculate total cost
        await OrderService.recalculateOrderTotal(order, conditions);
        return {
          prevTotalCost,
          reconciliation,
          repricingConfirmed,
          removedQuantity: Number(removedItem?.quantity) || 0,
          removedPrice: Number(removedItem?.priceAtOrder) || 0,
        };
      });
      console.log('OrderService: Shop product removed successfully from order:', orderId);
      await OrderService.recordConfirmedShopRepricing(updatedOrder, context, {
        triggerReason: 'scope_change',
        note: `Produkt ×${context.removedQuantity} entfernt (${formatEuroDe(context.removedPrice)} je Stück)`,
        userId,
      });

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing shop product from order:', error);
      throw error;
    }
  }

  // Update shop product quantity in order
  static async updateShopProductQuantity(orderId, productItemId, quantity, userId, options = {}) {
    console.log('OrderService: Updating shop product quantity in order:', orderId, 'Product item:', productItemId, 'New quantity:', quantity);

    try {
      const { order: updatedOrder, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        // Find the product
        const productItem = order.shopProducts.find(
          p => p._id && p._id.toString() === productItemId.toString()
        );

        if (!productItem) {
          throw buildOrderValueError('Das Produkt wurde in diesem Auftrag nicht gefunden.', 404, 'PRODUCT_NOT_IN_ORDER');
        }

        // Validate product stock
        const product = await Product.findById(productItem.productId);
        if (!product) {
          throw buildOrderValueError('Das Produkt existiert nicht mehr im Katalog.', 404, 'PRODUCT_NOT_FOUND');
        }

        if (product.stock < quantity) {
          throw buildOrderValueError(
            `Nicht genügend Bestand: verfügbar ${product.stock}, angefragt ${quantity}.`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }

        // Update quantity
        const prevTotalCost = order.totalCost;
        const previousQuantity = Number(productItem.quantity) || 0;
        const { conditions, reconciliation, repricingConfirmed } = OrderService.getPricingConditionsForEdit(order, options);
        productItem.quantity = quantity;
        console.log('OrderService: Shop product quantity updated');

        // Recalculate total cost
        await OrderService.recalculateOrderTotal(order, conditions);
        return { prevTotalCost, reconciliation, repricingConfirmed, previousQuantity, productName: product.name || 'Produkt' };
      });
      console.log('OrderService: Shop product quantity updated successfully in order:', orderId);
      await OrderService.recordConfirmedShopRepricing(updatedOrder, context, {
        triggerReason: 'scope_change',
        note: `Menge „${context.productName}“ geändert (${context.previousQuantity} → ${quantity})`,
        userId,
      });

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating shop product quantity:', error);
      throw error;
    }
  }

  // Helper method to recalculate order total
  //
  // Delegiert an DIE Preisregel (applyOrderPricing): Positionen zu Listen-Brutto,
  // Kunden-/Haendlerrabatt genau einmal auf Auftragsebene, Aktionsrabatt fest.
  // pricingConditions sollte VOR der Positionsaenderung ermittelt worden sein;
  // fehlt sie, gilt der gespeicherte Snapshot bzw. die Altauftrags-Ableitung.
  static async recalculateOrderTotal(order, pricingConditions = null) {
    console.log('OrderService: Recalculating order total for order:', order._id);

    const conditions = pricingConditions || OrderService.getPricingConditions(order);
    OrderService.applyOrderPricing(order, conditions);
    console.log('OrderService: Total cost recalculated:', order.totalCost);
  }

  // Remove workflow from order
  static async removeWorkflowFromOrder(orderId, workflowId, staffId) {
    console.log('OrderService: Removing workflow from order:', { orderId, workflowId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Find the workflow to remove
      const workflowIndex = order.workflows.findIndex(
        w => w._id.toString() === workflowId
      );

      if (workflowIndex === -1) {
        throw new Error('Workflow not found in order');
      }

      const removedWorkflow = order.workflows[workflowIndex];
      console.log('OrderService: Found workflow to remove:', removedWorkflow.workflowName);

      // Remove workflow from array
      order.workflows.splice(workflowIndex, 1);

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Removed',
        description: `Workflow "${removedWorkflow.workflowName}" removed from order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'System'
      });

      const updatedOrder = await order.save();
      console.log('OrderService: Workflow removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing workflow:', error);
      throw error;
    }
  }
}

module.exports = OrderService;