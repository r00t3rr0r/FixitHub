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
const OrderHistory = require('../utils/orderHistory');

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

// Ein Geldformat fuer alle Servertexte (utils/money: "1.234,50 €"; nicht endliche Werte -> "0,00 €").
const { formatEuroDe } = require('../utils/money');
// Deutsche Anzeige der E-Teil-Status (Order.eParts.status) fuer Verlaufstexte.
const E_PART_STATUS_LABELS = { pending: 'Ausstehend', allocated: 'Zugewiesen', used: 'Verbaut' };

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
      'quality-check': 'Qualitätskontrolle',
      // Reparatur fertig - Rueckgabe per Versand ODER Abholung (HIST-17: nie pauschal "Abholung").
      'ready-for-pickup': 'Reparatur abgeschlossen',
      completed: 'Abgeschlossen',
      cancelled: 'Storniert'
    };

    return labels[normalized] || status;
  }

  /**
   * Ein stornierter Auftrag wird nicht weiter bearbeitet (HIST-14): Template-Workflow zuweisen,
   * Schritt abschliessen/ueberspringen und Schritt-Personal zuweisen -> 409 WORKFLOW_ORDER_CLOSED.
   * includeCompleted: auch ein abgeschlossener Auftrag ist geschlossen (wie beim Starten).
   * Hinweis: Pausieren und Entfernen bleiben erlaubt (beendet nur Arbeit).
   */
  static _assertOrderOpenForWorkflow(order, actionText, { includeCompleted = false } = {}) {
    const status = String(order?.status || '');
    if (status === 'cancelled' || (includeCompleted && status === 'completed')) {
      throw buildOrderValueError(
        `Der Auftrag ist ${status === 'cancelled' ? 'storniert' : 'abgeschlossen'} – ${actionText}`,
        409,
        'WORKFLOW_ORDER_CLOSED'
      );
    }
  }

  /**
   * Einen laufenden Template-Workflow anhalten (Workflow- und Schrittpause mit Grund).
   * EINE Regel fuer "Workflow pausieren" (updateWorkflowStatus) und den Storno (HIST-14).
   * Mutiert nur das Unterdokument; der Aufrufer speichert.
   */
  static _pauseTemplateWorkflow(workflow, pauseReason, pauseStartedAt = new Date()) {
    workflow.status = 'on-hold';
    if (pauseReason) {
      workflow.pauseReason = pauseReason;
    }
    workflow.pausedAt = pauseStartedAt;

    const activeStepIndex = Number(workflow.currentStepIndex || 0);
    const activeStep = workflow.steps[activeStepIndex] || workflow.steps.find((stepItem) => stepItem.status === 'in-progress');

    if (activeStep && activeStep.status === 'in-progress') {
      if (!activeStep.currentPauseStartedAt) {
        activeStep.currentPauseStartedAt = pauseStartedAt;
      }
      const pauseEntry = {
        pausedAt: pauseStartedAt,
        reason: pauseReason || 'Kein Grund angegeben',
        stepId: activeStep.stepId,
        stepName: activeStep.stepName,
        stepIndex: activeStepIndex,
      };
      if (!Array.isArray(activeStep.pauseHistory)) {
        activeStep.pauseHistory = [];
      }
      activeStep.pauseHistory.push({ ...pauseEntry });
      if (!Array.isArray(workflow.pauseHistory)) {
        workflow.pauseHistory = [];
      }
      workflow.pauseHistory.push({ ...pauseEntry });
    }
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
      // FIN-13: gespeicherter Satz (auch 0); null/leer = nicht gespeichert -> Standardsatz.
      // Netto/MwSt. dieses Rueckgabewerts sind vorlaeufig: verbindlich rechnet der Order-pre('save')-Hook
      // mit dem konfigurierten Standardsatz aus den Finanzeinstellungen.
      taxRatePercent: conditions?.defaultTaxRate !== undefined && !CalculationHelper.hasStoredTaxRate(order?.taxRate)
        ? CalculationHelper.resolveTaxRate(null, conditions.defaultTaxRate).taxRate
        : CalculationHelper.resolveTaxRate(order?.taxRate).taxRate,
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
          notes: `Auftrag angelegt: Positionen ${formatEuroDe(OrderService.calculatePositionsGross(savedOrder))}, `
            + `Rabatt ${formatEuroDe(savedOrder.discount)}, Auftragswert ${formatEuroDe(savedOrder.totalCost)} (brutto)`
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

      if (filters.priority === 'high-urgent') {
        // Liste "Reparaturaufträge" / Dashboard-Link "Prioritätsaufträge": Hoch und Dringend.
        query.priority = { $in: ['high', 'urgent'] };
      } else if (filters.priority) {
        query.priority = filters.priority;
      }

      // Nur diese Auftrags-IDs (z. B. Filter "Warten auf Kundenrückmeldung"); ungueltige IDs fallen weg.
      if (filters.ids !== undefined) {
        const rawIds = Array.isArray(filters.ids) ? filters.ids : String(filters.ids || '').split(',');
        const validIds = rawIds
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .slice(0, 500);
        andFilters.push({ _id: { $in: validIds } });
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

      if (filters.search && String(filters.search).trim()) {
        // Eingabe woertlich suchen (kein Regex vom Client). Auch Kundenname/-E-Mail (registriert
        // oder Gast), damit die Suche der Admin-Liste nicht nur die geladenen Auftraege trifft.
        const term = String(filters.search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = { $regex: term, $options: 'i' };
        const matchingCustomers = await User.find({ $or: [{ name: regex }, { email: regex }] })
          .select('_id')
          .limit(200)
          .lean();
        andFilters.push({
          $or: [
            { orderNumber: regex },
            { deviceBrand: regex },
            { deviceModel: regex },
            { 'guestInfo.email': regex },
            { 'guestInfo.firstName': regex },
            { 'guestInfo.lastName': regex },
            ...(matchingCustomers.length > 0 ? [{ customerId: { $in: matchingCustomers.map((user) => user._id) } }] : []),
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
  //
  // FIN-13: taxRate is the rate STORED on the order - an explicit 0 stays 0. A missing /
  // null / empty / non-numeric rate is "not stored": the configured default rate
  // (options.defaultTaxRate, from the financial settings; otherwise 19) is used and
  // `taxRateSource` says 'default' instead of 'stored', so the screen can label it.
  static buildOrderPricingSummary(order, options = {}) {
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
    const { taxRate, taxRateSource } = CalculationHelper.resolveTaxRate(order?.taxRate, options.defaultTaxRate);
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
      taxRateSource,
      // false when the stored positions no longer add up to the order total
      // (legacy orders, or positions edited without recalculating the order).
      positionsReconcile: Math.abs(positionsGross - discount - dealerDiscountAmount - grossTotal) <= 0.02
    };
  }

  // FIN-13: konfigurierter Standardsatz (Finanzeinstellungen, normalerweise 19) - nur
  // fuer Auftraege OHNE gespeicherten Satz. Liest die Einstellungen nur, wenn einer der
  // uebergebenen Auftraege keinen Satz gespeichert hat (sonst keine zusaetzliche Abfrage).
  static async resolveDefaultTaxRate(orders = null) {
    const list = orders === null ? null : (Array.isArray(orders) ? orders : [orders]);
    if (list && list.filter(Boolean).every((entry) => CalculationHelper.hasStoredTaxRate(entry.taxRate))) {
      return undefined;
    }
    try {
      // Lazy: FinancialService <-> OrderService laden sich gegenseitig.
      const settings = await require('./financialService').getFinancialSettings(); // eslint-disable-line global-require
      return CalculationHelper.resolveTaxRate(settings?.defaults?.taxRate).taxRate;
    } catch (error) {
      console.error('OrderService: default tax rate could not be read:', error.message);
      return CalculationHelper.DEFAULT_TAX_RATE;
    }
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
      // HIST-9: das urspruenglich gebuchte Geraet (reportedDevice, unveraenderlich) nur fuer die
      // Personalansicht - die Geraetekarte zeigt "Vom Kunden gemeldet" neben dem korrigierten Geraet.
      const selectFields = `${ORDER_DETAIL_SELECT_FIELDS}${includeLabelData ? ` ${LABEL_DATA_FIELDS}` : ''}${staffAudience ? ' reportedDevice' : ''}`;

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
      plain.pricing = OrderService.buildOrderPricingSummary(order, {
        defaultTaxRate: await OrderService.resolveDefaultTaxRate(order),
      });

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

    const previousNames = (order.assignedStaff || []).map((assignment) => assignment.name).filter(Boolean);
    order.assignedStaff.push({
      staffId: staff._id,
      name: staff.name,
      avatar: staff.avatar || '',
      assignedAt: new Date()
    });
    // Implizite Zuweisung (wer am Auftrag arbeitet, wird zugewiesen) im SELBEN Schreibvorgang
    // wie die ausloesende Aenderung protokollieren (HIST-8) - der Aufrufer speichert.
    OrderHistory.push(order, OrderHistory.entry({
      key: 'Staff Assigned',
      type: 'staff',
      description: `${staff.name} automatisch zugewiesen (bei Bearbeitung des Auftrags)`,
      actor: { id: String(staff._id), name: staff.name },
      source: 'automatisch bei Bearbeitung',
      changes: [{
        field: 'assignedStaff',
        label: 'Zugewiesenes Personal',
        from: previousNames,
        to: [...previousNames, staff.name],
      }],
    }));
  }

  /**
   * Auftragsstatus aendern (Statusmenue, Workflows, Inspektion, Entsperrdaten).
   *
   * @param {string} orderId
   * @param {string} status   ein Wert aus Order.ORDER_STATUSES (sonst 400 'Unbekannter Auftragsstatus.')
   * @param {string|null} note Grund/Notiz des Personals - NUR im Verlauf (reason), nie an Kunden
   * @param {string|null} staffId Akteur
   * @param {Object} [options]
   * @param {string} [options.reason]          Grund (hat Vorrang vor note)
   * @param {string} [options.customerMessage] ausdruecklich kundenseitiger Hinweis (Benachrichtigung)
   * @param {boolean} [options.notifyCustomer=true]
   * @param {string} [options.key='Order Status Updated'] Verlaufsschluessel
   * @param {string} [options.source='Statusmenü']
   * @param {Object} [options.refs]
   * @param {string} [options.eventKey]        Idempotenzschluessel
   * Gleicher Status oder bereits gespeicherter eventKey: keine Aenderung, kein Eintrag, keine
   * Benachrichtigung; Rueckgabe des unveraenderten Auftrags mit order.$locals.unchanged = true.
   */
  static async updateStatus(orderId, status, note = null, staffId = null, options = {}) {
    console.log('OrderService: Updating order status:', orderId, 'to', status);

    if (!Order.ORDER_STATUSES.includes(status)) {
      throw buildOrderValueError('Unbekannter Auftragsstatus.', 400, 'INVALID_ORDER_STATUS');
    }
    // Stornieren nur mit Grund (HIST-14). Der Grund steht nur im Verlauf (intern), nie beim Kunden.
    if (status === 'cancelled' && !String(options.reason || note || '').trim()) {
      throw buildOrderValueError('Bitte einen Grund für die Stornierung angeben.', 400, 'CANCEL_REASON_REQUIRED');
    }
    // Bedingt speichern (nur wenn der gelesene Status noch gilt). Hat ein paralleler Vorgang
    // den Status inzwischen geaendert, wird auf dem FRISCHEN Stand neu entschieden: gleicher
    // Zielstatus -> unveraendert (kein zweiter Eintrag, keine zweite Benachrichtigung), sonst
    // Wechsel vom tatsaechlichen Status (der Eintrag nennt das echte "von") - HIST-6.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await OrderService._updateStatusAttempt(orderId, status, note, staffId, options);
      if (result) return result;
    }
    throw buildOrderValueError('Der Auftragsstatus wurde gleichzeitig geändert. Bitte die Seite neu laden und erneut versuchen.', 409, 'ORDER_STATUS_CONFLICT');
  }

  // Ein Versuch von updateStatus; null = Status wurde parallel geaendert (erneut versuchen).
  static async _updateStatusAttempt(orderId, status, note, staffId, options = {}) {
    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }

      const oldStatus = order.status;
      // Wiederholte Anfrage / gleicher Status: kein zweiter Eintrag, keine Benachrichtigung (HIST-6).
      if (oldStatus === status || (options.eventKey && OrderHistory.hasEventKey(order, options.eventKey))) {
        order.$locals.unchanged = true;
        return order;
      }

      // Storno ist kein gewoehnlicher Zwischenstatus: ein stornierter Auftrag wird weder ueber das
      // Statusmenue noch ueber Workflow-Wege fortgesetzt. Wieder oeffnen geht nur ausdruecklich
      // ("Storno aufheben", options.reopen) mit Begruendung - und immer nach "Ausstehend". Angehaltene
      // Workflows bleiben angehalten und werden bewusst fortgesetzt.
      if (oldStatus === 'cancelled' && status !== 'cancelled') {
        if (!options.reopen) {
          throw buildOrderValueError('Der Auftrag ist storniert. Er kann nur über „Storno aufheben“ mit Begründung wieder geöffnet werden.', 409, 'ORDER_CANCELLED');
        }
        if (!String(options.reason || note || '').trim()) {
          throw buildOrderValueError('Bitte einen Grund für das Aufheben der Stornierung angeben.', 400, 'REOPEN_REASON_REQUIRED');
        }
        if (status !== 'pending') {
          throw buildOrderValueError('Ein stornierter Auftrag wird immer als „Ausstehend“ wieder geöffnet.', 400, 'REOPEN_TARGET_INVALID');
        }
      }

      if (status === 'completed' && order.requiresPaymentBeforeCompletion && order.paymentStatus !== 'paid') {
        throw buildOrderValueError('Zahlung erforderlich, bevor der Reklamationsauftrag abgeschlossen und versendet werden kann', 409, 'PAYMENT_REQUIRED');
      }

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

      // ?? statt ||: 0 (pending/cancelled) ist ein gueltiger Wert (HIST-7).
      order.progress = progressMap[status] ?? order.progress;

      if (status === 'completed') {
        order.actualCompletion = new Date();
      }

      await OrderService._autoAssignStaff(order, staffId);

      const actor = await OrderHistory.resolveActor(staffId);
      const reason = String(options.reason || note || '').trim();
      const isReopen = oldStatus === 'cancelled' && status !== 'cancelled';
      OrderHistory.push(order, OrderHistory.entry({
        key: options.key || (isReopen ? 'Order Reopened' : 'Order Status Updated'),
        type: 'status',
        description: isReopen
          ? `Stornierung aufgehoben: ${OrderHistory.statusLabelDe(oldStatus)} → ${OrderHistory.statusLabelDe(status)}`
          : `Status geändert: ${OrderHistory.statusLabelDe(oldStatus)} → ${OrderHistory.statusLabelDe(status)}`,
        actor,
        source: options.source || 'Statusmenü',
        changes: [{ field: 'status', label: 'Auftragsstatus', from: oldStatus, to: status }],
        reason,
        refs: options.refs,
        visibility: 'customer',
        eventKey: options.eventKey,
      }));

      // Storno (HIST-14): laufende Template-Workflows im SELBEN Speichervorgang anhalten (Zeiterfassung
      // stoppt). Nichts wird abgeschlossen oder geloescht; Rechnungen/Zahlungen bleiben unberuehrt.
      const pausedTemplateWorkflows = [];
      if (status === 'cancelled') {
        const pausedAt = new Date();
        (Array.isArray(order.workflows) ? order.workflows : []).forEach((workflowItem) => {
          if (workflowItem && workflowItem.status === 'in-progress') {
            OrderService._pauseTemplateWorkflow(workflowItem, 'Auftrag storniert', pausedAt);
            pausedTemplateWorkflows.push(workflowItem.workflowName || 'Workflow');
          }
        });
        if (pausedTemplateWorkflows.length) {
          OrderHistory.push(order, OrderHistory.entry({
            key: 'Workflow Paused',
            type: 'workflow',
            description: `Workflow angehalten (Auftrag storniert): ${pausedTemplateWorkflows.map((name) => `„${name}“`).join(', ')}`,
            actor,
            source: options.source || 'Statusmenü',
            reason,
          }));
        }
      }

      order.$where = oldStatus == null ? { status: { $in: [null] } } : { status: oldStatus };
      if (options.eventKey) order.$where['timeline.eventKey'] = { $ne: String(options.eventKey) };
      let updatedOrder;
      try {
        updatedOrder = await order.save();
      } catch (saveError) {
        if (saveError && (saveError.name === 'DocumentNotFoundError' || saveError.name === 'VersionError')) {
          return null; // paralleler Statuswechsel - auf frischem Stand neu entscheiden
        }
        throw saveError;
      } finally {
        order.$where = undefined;
      }

      // Storno: eine laufende Techniker-Reparatur (RepairWorkflow) pausieren. Ein Fehler hier macht
      // den gespeicherten Storno nicht rueckgaengig, wird aber gemeldet ($locals.warnings).
      if (status === 'cancelled') {
        updatedOrder.$locals.cancelEffects = { templateWorkflowsPaused: pausedTemplateWorkflows, repairWorkflowPaused: false };
        updatedOrder.$locals.warnings = [];
        try {
          // eslint-disable-next-line global-require
          const RepairWorkflowService = require('./repairWorkflowService');
          const { paused } = await RepairWorkflowService.pauseForOrderCancellation(updatedOrder._id, actor);
          updatedOrder.$locals.cancelEffects.repairWorkflowPaused = paused;
        } catch (cancelPauseError) {
          console.error('OrderService: Could not pause repair workflow after cancellation:', cancelPauseError);
          updatedOrder.$locals.warnings.push('Auftrag storniert, aber die laufende Reparatur konnte nicht pausiert werden. Bitte im Reparatur-Workflow pausieren.');
        }
      }

      // Benachrichtigung erst NACH dem erfolgreichen bedingten Speichern.
      if (options.notifyCustomer !== false
        && (oldStatus !== status || previousProgress !== Number(updatedOrder.progress || 0))) {
        const statusLabel = this.getStatusLabel(status);
        // Interne Notizen/Gruende gehen NIE an Kunden - nur ein ausdruecklicher Kundenhinweis.
        const customerMessage = String(options.customerMessage || '').trim();
        // Storno: keine Aussage ueber eine automatische Erstattung (es gibt keine).
        const defaultMessage = status === 'cancelled'
          ? `Ihr Auftrag ${updatedOrder.orderNumber} wurde storniert. Bereits geleistete Zahlungen prüfen wir und melden uns bei Ihnen.`
          : `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`;
        const updateMessage = customerMessage
          ? `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Hinweis: ${customerMessage}`
          : defaultMessage;

        await this.notifyCustomerOrderUpdate(updatedOrder, updateMessage, status);
      }

      console.log('OrderService: Order status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Abholung bestaetigen (HIST-13): Status 'completed', pickupConfirmation, Verlaufseintrag
   * 'Pickup Confirmed' - alles in EINEM bedingten Schreibvorgang. Idempotent: ist die Abholung
   * bereits bestaetigt, wird nichts geaendert ({ alreadyConfirmed: true }).
   */
  static async confirmPickup(orderId, actorUser) {
    const actor = OrderHistory.normalizeActor(actorUser);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }
      if (order.pickupConfirmation?.confirmedAt) {
        order.$locals.alreadyConfirmed = true;
        return { order, alreadyConfirmed: true };
      }
      if (order.status === 'cancelled') {
        throw buildOrderValueError('Ein stornierter Auftrag kann nicht als abgeholt bestätigt werden.', 409, 'ORDER_CANCELLED');
      }
      if (order.requiresPaymentBeforeCompletion && order.paymentStatus !== 'paid') {
        throw buildOrderValueError('Zahlung erforderlich, bevor der Reklamationsauftrag abgeschlossen und versendet werden kann', 409, 'PAYMENT_REQUIRED');
      }

      const now = new Date();
      const oldStatus = order.status;
      order.status = 'completed';
      order.progress = 100;
      if (!order.actualCompletion) order.actualCompletion = now;
      order.pickupConfirmation = {
        confirmedBy: actor.id !== 'system' ? actor.id : undefined,
        confirmedByName: actor.name,
        confirmedAt: now,
      };
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Pickup Confirmed',
        type: 'shipping',
        description: `Abholung durch den Kunden bestätigt von ${actor.name}`,
        actor,
        source: 'Abholung',
        changes: [{ field: 'status', label: 'Auftragsstatus', from: oldStatus, to: 'completed' }],
        visibility: 'customer',
        eventKey: 'pickup-confirmed',
        at: now,
        force: true,
      }));

      order.$where = { 'pickupConfirmation.confirmedAt': { $exists: false } };
      try {
        const saved = await order.save();
        return { order: saved, alreadyConfirmed: false };
      } catch (error) {
        if (error && error.name === 'DocumentNotFoundError') {
          continue; // paralleler Klick hat gewonnen -> frisch laden, dann alreadyConfirmed
        }
        throw error;
      } finally {
        order.$where = undefined;
      }
    }
    throw buildOrderValueError('Die Abholung konnte gerade nicht gespeichert werden. Bitte erneut versuchen.', 409, 'ORDER_EDIT_CONFLICT');
  }

  // Assign staff to order
  // actor: req.user (wer die Zuweisung vornimmt) - frueher stand hier immer 'System' (HIST-8).
  static async assignStaff(orderId, staffIds, actorUser = null) {
    console.log('OrderService: Assigning staff to order:', orderId, 'staff:', staffIds);

    // Get staff details (einmal, vor den Speicherversuchen)
    const uniqueStaffIds = getUniqueStaffIds(staffIds);
    const staffMembers = await User.find({
      _id: { $in: uniqueStaffIds },
      role: { $in: ['staff', 'admin'] }
    });

    if (staffMembers.length !== uniqueStaffIds.length) {
      throw new Error('One or more staff members not found');
    }

    // Bedingt speichern auf der gelesenen Zuweisung; paralleler Doppelklick -> frisch laden,
    // dann ist die Zuweisung gleich und es entsteht kein zweiter Eintrag (HIST-6).
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await OrderService._assignStaffAttempt(orderId, staffMembers, actorUser);
      if (result) return result;
    }
    throw buildOrderValueError('Die Zuweisung wurde gleichzeitig geändert. Bitte die Seite neu laden und erneut versuchen.', 409, 'ORDER_ASSIGNMENT_CONFLICT');
  }

  // Ein Versuch von assignStaff; null = Zuweisung wurde parallel geaendert.
  static async _assignStaffAttempt(orderId, staffMembers, actorUser) {
    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      const previousIds = (order.assignedStaff || []).map((assignment) => toIdString(assignment.staffId)).sort();
      const nextIds = staffMembers.map((staff) => toIdString(staff._id)).sort();
      if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) {
        // Gleiche Zuweisung erneut gesendet: nichts aendern, kein Eintrag (HIST-6).
        order.$locals.unchanged = true;
        return order;
      }
      const previousNames = (order.assignedStaff || []).map((assignment) => assignment.name).filter(Boolean);

      // Update assigned staff
      order.assignedStaff = staffMembers.map(staff => ({
        staffId: staff._id,
        name: staff.name,
        avatar: staff.avatar || '',
        assignedAt: new Date()
      }));

      const actor = actorUser ? OrderHistory.normalizeActor(actorUser) : { id: 'system', name: 'System' };
      const nextNames = staffMembers.map((s) => s.name);
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Staff Assigned',
        type: 'staff',
        description: `Zugewiesen an: ${nextNames.join(', ')}`,
        actor,
        source: 'Personalzuweisung',
        changes: [{ field: 'assignedStaff', label: 'Zugewiesenes Personal', from: previousNames, to: nextNames }],
        force: true,
      }));

      const previousObjectIds = previousIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      order.$where = previousObjectIds.length
        ? { 'assignedStaff.staffId': { $all: previousObjectIds }, assignedStaff: { $size: previousIds.length } }
        : { $or: [{ assignedStaff: { $exists: false } }, { assignedStaff: { $size: 0 } }] };
      let updatedOrder;
      try {
        updatedOrder = await order.save();
      } catch (saveError) {
        if (saveError && (saveError.name === 'DocumentNotFoundError' || saveError.name === 'VersionError')) {
          return null;
        }
        throw saveError;
      } finally {
        order.$where = undefined;
      }

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

      // Additiv fuer die Admin-Liste "Reparaturaufträge": Gesamtzahl und Hoch/Dringend (alle
      // Auftraege, gleiche Regel wie der Filter priority=high-urgent in getAll).
      result.total = stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0);
      result.highOrUrgent = await Order.countDocuments({ priority: { $in: ['high', 'urgent'] } });

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
      // HIST-5 (e): scheitert danach das Speichern des Auftrags, wird der Bestand wieder gutgeschrieben -
      // sonst waere das Teil vom Lager abgebucht, aber keinem Auftrag zugeordnet.
      const restoreStock = async () => {
        try {
          await Inventory.updateOne({ _id: part._id, 'versions._id': version._id }, { $inc: { 'versions.$.quantity': quantity } });
        } catch (restoreError) {
          console.error('OrderService: Bestand konnte nach fehlgeschlagener Zuordnung nicht zurueckgebucht werden:', restoreError.message);
        }
      };

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
        description: `${part.itemName} (${version.versionType}) ×${quantity} dem Auftrag zugewiesen`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Mitarbeiter',
        type: 'parts',
      });

      let updatedOrder;
      try {
        updatedOrder = await order.save();
      } catch (saveError) {
        await restoreStock();
        throw saveError;
      }

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
      const partName = part ? part.itemName : 'Unbekanntes Ersatzteil';
      const versionType = part && part.versions.id(ePart.versionId)
        ? part.versions.id(ePart.versionId).versionType
        : 'unbekannte Version';

      // Remove EPart from order
      order.eParts.pull(ePartId);

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Removed',
        description: `${partName} (${versionType}) ×${ePart.quantity} vom Auftrag entfernt`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Mitarbeiter',
        type: 'parts',
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
      const partName = part ? part.itemName : 'Unbekanntes Ersatzteil';

      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Status Updated',
        description: `Status von ${partName}: ${E_PART_STATUS_LABELS[oldStatus] || oldStatus} → ${E_PART_STATUS_LABELS[status] || status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Mitarbeiter',
        type: 'parts',
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
        description: `${part.itemName} ×${entryData.quantity} auf Bedarfsliste „${resolvedNeedListName}“ gesetzt`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Mitarbeiter',
        type: 'parts',
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart need list entry recorded successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error recording EPart need list entry:', error);
      throw error;
    }
  }

  // Eindeutiger eventKey fuer einen Verlaufseintrag einer Positionsaenderung - verknuepft den
  // Eintrag nach dem Speichern mit seiner Revision (refs.revisionId), damit
  // GET /api/orders/:id/history die Revision nicht ein zweites Mal anzeigt.
  static newEditEventKey() {
    return `edit:${new mongoose.Types.ObjectId().toHexString()}`;
  }

  // Revision dem Verlaufseintrag zuordnen (Folge-Schreibvorgang; schlaegt er fehl, bleibt der
  // Eintrag erhalten und die Revision erscheint im Verlauf als eigener Eintrag).
  static async linkRevisionToHistory(orderId, eventKey, revision) {
    if (!eventKey || !revision || !revision._id) return false;
    try {
      const result = await Order.updateOne(
        { _id: orderId, 'timeline.eventKey': eventKey },
        { $set: { 'timeline.$.refs.revisionId': revision._id, 'timeline.$.refs.revisionNumber': revision.revisionNumber } }
      );
      return Number(result?.modifiedCount || 0) > 0;
    } catch (error) {
      console.warn('OrderService: Revision konnte nicht mit dem Verlaufseintrag verknuepft werden:', error.message);
      return false;
    }
  }

  /**
   * Abschluss einer Positionsaenderung NACH dem atomaren Speichern (Verlaufseintrag ist bereits
   * im selben Speichervorgang wie die Aenderung): Revision (Finanz-Snapshot) schreiben und
   * verknuepfen, Finanzabgleich ausfuehren. Fehler werden NICHT verschluckt, sondern als
   * deutsche Warnungen in order.$locals.warnings abgelegt (die Routen geben sie als
   * `warnings` zurueck).
   */
  static async finishOrderEdit(order, { eventKey = null, revision = null, syncFinancials = false } = {}) {
    const warnings = [];
    if (revision) {
      let recorded = null;
      try {
        recorded = await OrderRevisionService.recordRevision(order, revision);
      } catch (error) {
        recorded = null;
      }
      if (!recorded) {
        warnings.push('Die Änderung wurde gespeichert, der Änderungsbeleg (Revision) konnte jedoch nicht angelegt werden.');
      } else {
        await OrderService.linkRevisionToHistory(order._id, eventKey, recorded);
      }
    }
    if (syncFinancials) {
      try {
        const result = await FinancialService.syncOrderAndBookingValue(order._id, 'order');
        if (result && result.ok === false) {
          throw new Error(result.error || result.message || 'unbekannter Fehler');
        }
      } catch (error) {
        console.error(`OrderService: Financial sync failed for order ${order._id}: ${error.message}`);
        warnings.push('Die Änderung wurde gespeichert, der Abgleich mit Buchung/Rechnung ist jedoch fehlgeschlagen. '
          + 'Bitte den Finanzabgleich für diesen Auftrag erneut ausführen.');
      }
    }
    if (order && order.$locals) order.$locals.warnings = warnings;
    return warnings;
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
        const eventKey = OrderService.newEditEventKey();
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Add-on Service Added',
          type: 'services',
          description: `Zusatzleistung „${addonData.name}“ hinzugefügt (${formatEuroDe(addonData.price)})`,
          actor: { id: toIdString(staffId), name: staffName },
          source: 'Zusatzleistungen',
          changes: [{ field: 'totalCost', label: 'Auftragswert', from: prevGrossAmount, to: order.totalCost }],
          eventKey,
          force: true,
        }));

        // validateModifiedOnly: bestehende unvollstaendige Altpositionen nicht erneut validieren
        return { prevGrossAmount, reconciliation, eventKey, saveOptions: { validateModifiedOnly: true } };
      });

      // Revision (Finanz-Snapshot) und Finanzabgleich NACH dem atomaren Speichern; Fehler
      // werden als Warnung an die Oberflaeche gegeben statt nur geloggt (HIST-5b).
      await OrderService.finishOrderEdit(updatedOrder, {
        eventKey: context.eventKey,
        revision: {
          triggerReason: 'addon_added',
          previousGrossAmount: context.prevGrossAmount,
          changedBy: staffId || undefined,
          changedByName: staffName,
          notes: [
            `Zusatzleistung „${addonData.name}“ hinzugefügt (${formatEuroDe(addonData.price)})`,
            OrderService.describeConfirmedRepricing(context.reconciliation),
          ].filter(Boolean).join(' | ')
        },
        syncFinancials: true,
      });

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
        const before = {
          name: addon.name, price: addon.price, status: addon.status, progress: addon.progress,
          estimatedTime: addon.estimatedTime, description: addon.description,
        };
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
        // Nur echte Feldaenderungen protokollieren (HIST-6): ein Fortschritts-/Status-Tick ohne
        // Aenderung erzeugt keinen Eintrag und keine Revision.
        const addonChanges = [
          { field: 'addOns.name', label: 'Name', from: before.name, to: addon.name },
          { field: 'addOns.price', label: `Preis „${addon.name}“`, from: Number(before.price), to: Number(addon.price) },
          { field: 'addOns.status', label: 'Status', from: before.status, to: addon.status },
          { field: 'addOns.progress', label: 'Fortschritt (%)', from: before.progress, to: addon.progress },
          { field: 'addOns.estimatedTime', label: 'Geschätzte Zeit', from: before.estimatedTime, to: addon.estimatedTime },
          { field: 'addOns.description', label: 'Beschreibung', from: before.description, to: addon.description },
          { field: 'totalCost', label: 'Auftragswert', from: prevTotalCost, to: order.totalCost },
        ];
        const eventKey = OrderService.newEditEventKey();
        const historyEntry = OrderHistory.entry({
          key: 'Add-on Service Updated',
          type: priceChanged ? 'pricing' : 'services',
          description: `Zusatzleistung „${addon.name}“ geändert`,
          actor: { id: toIdString(staffId), name: staffName },
          source: 'Zusatzleistungen',
          changes: addonChanges,
          eventKey,
        });
        const recorded = OrderHistory.push(order, historyEntry);

        return {
          oldPrice, newPrice: addon.price, addonName: addon.name, prevTotalCost, reconciliation: edit?.reconciliation,
          priceChanged, recorded, eventKey,
        };
      });

      // Revision nur bei einer Preisaenderung; Finanzabgleich ebenfalls nur dann (HIST-5b/HIST-6).
      if (context.priceChanged) {
        await OrderService.finishOrderEdit(updatedOrder, {
          eventKey: context.recorded ? context.eventKey : null,
          revision: {
            triggerReason: 'addon_updated',
            previousGrossAmount: context.prevTotalCost,
            changedBy: staffId || undefined,
            changedByName: staffName,
            notes: [
              `Zusatzleistung „${context.addonName}“ geändert (${formatEuroDe(context.oldPrice)} → ${formatEuroDe(context.newPrice)})`,
              OrderService.describeConfirmedRepricing(context.reconciliation),
            ].filter(Boolean).join(' | ')
          },
          syncFinancials: true,
        });
      } else {
        updatedOrder.$locals.warnings = [];
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
        const eventKey = OrderService.newEditEventKey();
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Add-on Service Removed',
          type: 'services',
          description: `Zusatzleistung „${addonName}“ entfernt (${formatEuroDe(addonPrice)})`,
          actor: { id: toIdString(staffId), name: staffName },
          source: 'Zusatzleistungen',
          changes: [{ field: 'totalCost', label: 'Auftragswert', from: prevTotalCost, to: order.totalCost }],
          eventKey,
          force: true,
        }));

        return { addonName, addonPrice, prevTotalCost, reconciliation, eventKey };
      });

      await OrderService.finishOrderEdit(updatedOrder, {
        eventKey: context.eventKey,
        revision: {
          triggerReason: 'addon_removed',
          previousGrossAmount: context.prevTotalCost,
          changedBy: staffId || undefined,
          changedByName: staffName,
          notes: [
            `Zusatzleistung „${context.addonName}“ entfernt (${formatEuroDe(context.addonPrice)})`,
            OrderService.describeConfirmedRepricing(context.reconciliation),
          ].filter(Boolean).join(' | ')
        },
        syncFinancials: true,
      });

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
      OrderService._assertOrderOpenForWorkflow(order, 'es kann kein Workflow mehr zugewiesen werden.', { includeCompleted: true });

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
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Assigned',
        type: 'workflow',
        description: workflowAssignedStaffMembers.length > 0
          ? `Workflow „${workflowTemplate.name}“ zugewiesen (bearbeitet von ${workflowAssignedStaffMembers[0].name})`
          : `Workflow „${workflowTemplate.name}“ zugewiesen`,
        actor: staff ? OrderHistory.normalizeActor(staff) : { id: toIdString(staffId) || 'system', name: 'System' },
        source: 'Workflow',
      }));

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

      // Ein Workflow-Start wirft einen stornierten/abgeschlossenen Auftrag nicht zurueck (HIST-12).
      if (order.status === 'cancelled' || order.status === 'completed') {
        throw buildOrderValueError(
          `Der Auftrag ist ${order.status === 'cancelled' ? 'storniert' : 'abgeschlossen'} – der Workflow kann nicht gestartet werden.`,
          409,
          'WORKFLOW_ORDER_CLOSED'
        );
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
        const previousNames = (order.assignedStaff || []).map((assignment) => assignment.name).filter(Boolean);
        order.assignedStaff.push({
          staffId: staffId,
          name: staff.name,
          avatar: staff.avatar || ''
        });
        // Implizite Zuweisung beim Workflow-Start im selben Speichervorgang protokollieren (HIST-8).
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Staff Assigned',
          type: 'staff',
          description: `${staff.name} automatisch zugewiesen (Workflow „${workflow.workflowName}“ gestartet)`,
          actor: { id: String(staff._id), name: staff.name },
          source: 'automatisch bei Workflow-Start',
          changes: [{ field: 'assignedStaff', label: 'Zugewiesenes Personal', from: previousNames, to: [...previousNames, staff.name] }],
        }));
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
      // Deutsch mit Typ/Bezug (HIST-2); Schluessel 'Repair in Progress' bleibt stabil (Meilenstein "Reparatur").
      const startActor = OrderHistory.normalizeActor(staff);
      if (previousStatus !== 'in-progress') {
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Repair in Progress',
          type: 'status',
          description: `Reparatur begonnen (Workflow „${workflow.workflowName}“ gestartet), zugewiesen an ${staff.name}`,
          actor: startActor,
          source: 'Workflow',
          changes: [{ field: 'status', label: 'Auftragsstatus', from: previousStatus, to: 'in-progress' }],
          refs: { workflowId: workflow._id },
          visibility: 'customer',
        }));
        console.log('OrderService: Added timeline entry for order status change');
      }

      // Second entry for workflow start
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Started',
        type: 'workflow',
        description: `Workflow „${workflow.workflowName}“ gestartet von ${staff.name}`,
        actor: startActor,
        source: 'Workflow',
        refs: { workflowId: workflow._id },
      }));
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
      OrderService._assertOrderOpenForWorkflow(order, 'Schritte können nicht mehr zugewiesen werden.');

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
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Task Assigned',
        type: 'workflow',
        description: `Schritt „${step.stepName}“ im Workflow „${workflow.workflowName}“ zugewiesen an: ${staffMembers.map((staff) => staff.name).join(', ')}`,
        actor: assigningStaff ? OrderHistory.normalizeActor(assigningStaff) : { id: toIdString(assigningStaffId) || 'system', name: 'System' },
        source: 'Workflow',
        refs: { workflowId: workflow._id, workflowStepId: step._id },
      }));

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow step staff assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning workflow step staff:', error);
      throw error;
    }
  }

  // Speichert einen Workflow-Schritt-Abschluss nur, wenn der Schritt in der DB noch weder
  // abgeschlossen noch uebersprungen ist. Sonst 409 (deutsch), nichts wird geschrieben.
  static async saveIfStepOpen(order, workflowId, stepId) {
    const wfObjectId = mongoose.Types.ObjectId.isValid(String(workflowId)) ? new mongoose.Types.ObjectId(String(workflowId)) : workflowId;
    const stepObjectId = mongoose.Types.ObjectId.isValid(String(stepId)) ? new mongoose.Types.ObjectId(String(stepId)) : stepId;
    order.$where = {
      // Ein Storno zwischen Lesen und Speichern darf keinen Schritt mehr abschliessen (und den
      // letzten Schritt nicht 'ready-for-pickup' ueber 'cancelled' schreiben lassen).
      status: { $ne: 'cancelled' },
      workflows: {
        $elemMatch: {
          _id: wfObjectId,
          steps: { $elemMatch: { _id: stepObjectId, status: { $nin: ['completed', 'skipped'] } } },
        },
      },
    };
    try {
      return await order.save();
    } catch (error) {
      if (error && (error.name === 'DocumentNotFoundError' || error.name === 'VersionError')) {
        const current = await Order.findById(order._id).setOptions({ skipAutoPopulate: true }).select('status').lean();
        if (current && current.status === 'cancelled') {
          OrderService._assertOrderOpenForWorkflow(current, 'der Workflow kann nicht fortgesetzt werden.');
        }
        throw buildOrderValueError('Dieser Schritt wurde bereits abgeschlossen oder übersprungen.', 409, 'WORKFLOW_STEP_ALREADY_DONE');
      }
      throw error;
    } finally {
      order.$where = undefined;
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

      if (step.status === 'completed' || step.status === 'skipped') {
        throw buildOrderValueError('Dieser Schritt wurde bereits abgeschlossen oder übersprungen.', 409, 'WORKFLOW_STEP_ALREADY_DONE');
      }
      // Stornierter Auftrag: kein Schrittabschluss (sonst "Reparatur abgeschlossen" + Kundennachricht).
      OrderService._assertOrderOpenForWorkflow(order, 'Workflow-Schritte können nicht mehr abgeschlossen werden.');

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
      const workflowActor = staff ? OrderHistory.normalizeActor(staff) : { id: toIdString(staffId) || 'system', name: 'Mitarbeiter' };
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

        // Verlauf: deutsch, mit Typ und Bezug (HIST-2) - Schluessel bleiben stabil.
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Workflow Completed',
          type: 'workflow',
          description: `Workflow „${workflow.workflowName}“ vollständig abgeschlossen (${workflow.steps.length} Schritte)`,
          actor: workflowActor,
          source: 'Workflow',
          refs: { workflowId: workflow._id },
          at: workflowCompletedAt,
        }));

        // If every workflow on this order is now done, advance the order status
        const allWorkflowsDone = order.workflows.every(wf =>
          wf._id.toString() === workflowId.toString() ? true : wf.status === 'completed'
        );
        if (allWorkflowsDone && ['in-progress', 'quality-check', 'diagnostic-assessment'].includes(order.status)) {
          const statusBefore = order.status;
          order.status = 'ready-for-pickup';
          order.actualCompletion = workflowCompletedAt;
          // Reparatur fertig ist NICHT "bereit zur Abholung": Rueckgabe per Versand oder Abholung (HIST-17).
          OrderHistory.push(order, OrderHistory.entry({
            key: 'Order Ready',
            type: 'status',
            description: `Reparatur abgeschlossen – alle Workflow-Schritte erledigt (${OrderHistory.statusLabelDe(statusBefore)} → ${OrderHistory.statusLabelDe('ready-for-pickup')})`,
            actor: workflowActor,
            source: 'Workflow',
            changes: [{ field: 'status', label: 'Auftragsstatus', from: statusBefore, to: 'ready-for-pickup' }],
            refs: { workflowId: workflow._id },
            visibility: 'customer',
            at: workflowCompletedAt,
          }));
        }
      }

      // Add step completion timeline entry
      const timingSummary = step.estimatedDurationMinutes > 0
        ? ` (tatsächlich ${step.actualDurationMinutes} Min., geplant ${step.estimatedDurationMinutes} Min.)`
        : ` (tatsächlich ${step.actualDurationMinutes} Min.)`;
      await OrderService._autoAssignStaff(order, staffId);
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Step Completed',
        type: 'workflow',
        description: `Schritt „${step.stepName}“ im Workflow „${workflow.workflowName}“ abgeschlossen${timingSummary}`,
        actor: workflowActor,
        source: 'Workflow',
        refs: { workflowId: workflow._id, workflowStepId: step._id },
        photos: stepData.photos || [],
      }));

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

      // Bedingt speichern: nur wenn der Schritt in der DB noch offen ist. Zwei parallele Klicks
      // bestehen sonst beide die Pruefung oben und schreiben doppelte Eintraege und
      // Benachrichtigungen (HIST-6).
      const updatedOrder = await OrderService.saveIfStepOpen(order, workflowId, stepId);
      const becameReady = previousOrderStatus !== updatedOrder.status && updatedOrder.status === 'ready-for-pickup';

      // Eine Nachricht je Ereignis: wird die Reparatur fertig, ersetzt die Fertig-Meldung die
      // Fortschrittsmeldung (vorher zwei Benachrichtigungen fuer denselben Klick).
      if (!becameReady && Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat einen neuen Reparaturfortschritt erreicht: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Letzter Schritt: ${step.stepName}.`
        );
      }

      // Reparatur fertig: Text nach dem echten Rueckgabeweg (Versand / Abholung, sonst neutral) -
      // Versandauftraege werden nicht "abgeholt" (HIST-17, utils/returnMethod).
      if (becameReady) {
        const ReturnMethod = require('../utils/returnMethod'); // eslint-disable-line global-require
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          ReturnMethod.readyCustomerMessage(
            await ReturnMethod.resolveReturnMethodForOrder(updatedOrder._id),
            `Ihres Auftrags ${updatedOrder.orderNumber}`
          ),
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
        throw buildOrderValueError('Dieser Schritt wurde bereits abgeschlossen oder übersprungen.', 409, 'WORKFLOW_STEP_ALREADY_DONE');
      }
      OrderService._assertOrderOpenForWorkflow(order, 'Workflow-Schritte können nicht mehr übersprungen werden.');

      // Vorlagen-Option „Überspringen erlaubt“ (canSkip) serverseitig durchsetzen – dieselbe Quelle,
      // aus der getOrderWorkflows den Schalter für die Oberfläche liest (Vorlagenschritt per stepId).
      const template = workflow.workflowTemplateId
        ? await WorkflowTemplate.findById(workflow.workflowTemplateId).select('steps._id steps.canSkip').lean()
        : null;
      const templateStep = template && Array.isArray(template.steps)
        ? template.steps.find((candidate) => String(candidate._id) === String(step.stepId))
        : null;
      if (!templateStep || templateStep.canSkip !== true) {
        throw buildOrderValueError(
          'Dieser Schritt darf nicht übersprungen werden („Überspringen erlaubt“ ist in der Workflow-Vorlage nicht aktiviert).',
          409,
          'WORKFLOW_STEP_NOT_SKIPPABLE'
        );
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
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Step Skipped',
        type: 'workflow',
        description: `Schritt „${step.stepName}“ im Workflow „${workflow.workflowName}“ übersprungen`,
        actor: staff ? OrderHistory.normalizeActor(staff) : { id: toIdString(staffId) || 'system', name: 'Mitarbeiter' },
        source: 'Workflow',
        reason: reason || 'nicht angegeben',
        refs: { workflowId: workflow._id, workflowStepId: step._id },
      }));

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

      const updatedOrder = await OrderService.saveIfStepOpen(order, workflowId, stepId);

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess aktualisiert: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Ein Schritt wurde übersprungen.`
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
  // Bedingt gespeichert auf dem gelesenen Workflow- UND Auftragsstatus: ein paralleler
  // Doppelklick (Pause/Fortsetzen) wird auf dem frischen Stand neu entschieden und ist dann
  // ein No-op - kein zweiter Eintrag, keine zweite Benachrichtigung (HIST-6).
  static async updateWorkflowStatus(orderId, workflowId, status, staffId, pauseReason = null) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await OrderService._updateWorkflowStatusAttempt(orderId, workflowId, status, staffId, pauseReason);
      if (result) return result;
    }
    throw buildOrderValueError('Der Workflow wurde gleichzeitig geändert. Bitte die Seite neu laden und erneut versuchen.', 409, 'WORKFLOW_STATUS_CONFLICT');
  }

  // Ein Versuch von updateWorkflowStatus; null = parallel geaendert (erneut versuchen).
  static async _updateWorkflowStatusAttempt(orderId, workflowId, status, staffId, pauseReason = null) {
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
        throw buildOrderValueError('Unbekannter Workflow-Status.', 400, 'INVALID_WORKFLOW_STATUS');
      }

      const oldStatus = workflow.status;
      const oldOrderStatus = order.status;
      // Gleicher Status erneut gesendet (Doppelklick, Wiederholung): nichts aendern, kein
      // Verlaufseintrag, keine Benachrichtigung (HIST-6).
      if (oldStatus === status) {
        order.$locals.unchanged = true;
        return order;
      }
      // Uebergangstabelle (HIST-12): hier nur Pausieren (in-progress -> on-hold) und Fortsetzen
      // (on-hold -> in-progress). Abschliessen geht nur ueber die Schritte, Starten ueber "Starten",
      // und ein abgeschlossener Workflow kann den Auftrag nicht zurueckwerfen.
      const ALLOWED_WORKFLOW_TRANSITIONS = { 'in-progress': ['on-hold'], 'on-hold': ['in-progress'] };
      if (!(ALLOWED_WORKFLOW_TRANSITIONS[oldStatus] || []).includes(status)) {
        throw buildOrderValueError(
          oldStatus === 'completed'
            ? 'Dieser Workflow ist abgeschlossen und kann nicht mehr pausiert oder zurückgesetzt werden – ein abgeschlossener Workflow ändert den Auftragsstatus nicht mehr.'
            : 'Dieser Statuswechsel ist hier nicht möglich. Bitte den Workflow über „Starten“ bzw. die Schritte abschließen.',
          409,
          'WORKFLOW_TRANSITION_NOT_ALLOWED'
        );
      }
      if (status === 'in-progress' && (oldOrderStatus === 'cancelled' || oldOrderStatus === 'completed')) {
        throw buildOrderValueError(
          `Der Auftrag ist ${oldOrderStatus === 'cancelled' ? 'storniert' : 'abgeschlossen'} – der Workflow kann nicht fortgesetzt werden.`,
          409,
          'WORKFLOW_ORDER_CLOSED'
        );
      }
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
        OrderService._pauseTemplateWorkflow(workflow, pauseReason, new Date());

        // Ein fertiger, stornierter oder abgeschlossener Auftrag wird durch eine Workflow-Pause
        // nicht zurueckgeworfen (HIST-12).
        if (!['ready-for-pickup', 'completed', 'cancelled'].includes(oldOrderStatus)) {
          const nextOrderStatus = hasActiveWorkflow() ? 'in-progress' : 'paused';
          order.status = nextOrderStatus;
          console.log('OrderService: Order status changed from', oldOrderStatus, 'to', nextOrderStatus);
        }
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

      // Verlauf deutsch mit Typ/Bezug (HIST-2); der Pausengrund steht nur in reason (intern).
      OrderHistory.push(order, OrderHistory.entry({
        key: status === 'on-hold' ? 'Workflow Paused' : 'Workflow Resumed',
        type: 'workflow',
        description: status === 'on-hold'
          ? `Workflow „${workflow.workflowName}“ pausiert`
          : `Workflow „${workflow.workflowName}“ fortgesetzt`,
        actor: { id: toIdString(staffId), name: staffName },
        source: 'Workflow',
        reason: status === 'on-hold' ? pauseReason : '',
        refs: { workflowId: workflow._id },
      }));
      console.log('OrderService: Timeline entry added for workflow status change');

      // If order status changed (pausing), add separate timeline entry
      if (oldOrderStatus !== order.status) {
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Order Status Updated',
          type: 'status',
          description: `Status geändert: ${OrderHistory.statusLabelDe(oldOrderStatus)} → ${OrderHistory.statusLabelDe(order.status)} (durch Workflow „${workflow.workflowName}“)`,
          actor: { id: toIdString(staffId), name: staffName },
          source: 'Workflow',
          changes: [{ field: 'status', label: 'Auftragsstatus', from: oldOrderStatus, to: order.status }],
          reason: status === 'on-hold' ? pauseReason : '',
          refs: { workflowId: workflow._id },
          visibility: 'customer',
        }));
        console.log('OrderService: Timeline entry added for order status change');
      }

      const workflowObjectId = mongoose.Types.ObjectId.isValid(String(workflow._id))
        ? new mongoose.Types.ObjectId(String(workflow._id))
        : workflow._id;
      order.$where = {
        status: oldOrderStatus == null ? { $in: [null] } : oldOrderStatus,
        workflows: { $elemMatch: { _id: workflowObjectId, status: oldStatus == null ? { $in: [null] } : oldStatus } },
      };
      let updatedOrder;
      try {
        updatedOrder = await order.save();
      } catch (saveError) {
        if (saveError && (saveError.name === 'DocumentNotFoundError' || saveError.name === 'VersionError')) {
          return null;
        }
        throw saveError;
      } finally {
        order.$where = undefined;
      }

      if (oldOrderStatus !== updatedOrder.status) {
        const oldStatusLabel = this.getStatusLabel(oldOrderStatus);
        const newStatusLabel = this.getStatusLabel(updatedOrder.status);
        // Der Pausengrund ist intern (K04) und geht nie an den Kunden - nur der neutrale Status.

        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat den Status gewechselt: ${oldStatusLabel} → ${newStatusLabel}. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`,
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
  static async goBackToStep(orderId, workflowId, stepId, staffId, reason = '') {
    console.log('OrderService: Going back to workflow step:', { orderId, workflowId, stepId, staffId });
    const reopenReason = String(reason || '').trim().slice(0, 2000);

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
        throw buildOrderValueError('Nur abgeschlossene oder übersprungene Schritte können erneut geöffnet werden.', 409, 'WORKFLOW_STEP_NOT_DONE');
      }

      // Erneutes Oeffnen darf einen abgeschlossenen/stornierten Auftrag nicht zurueckwerfen und
      // nicht einen Auftrag, dessen Auslieferung schon angestossen ist (HIST-12, wie HIST-11).
      const oldOrderStatus = order.status;
      if (oldOrderStatus === 'completed' || oldOrderStatus === 'cancelled') {
        throw buildOrderValueError(
          `Der Auftrag ist ${oldOrderStatus === 'completed' ? 'abgeschlossen' : 'storniert'} – der Schritt kann nicht erneut geöffnet werden.`,
          409,
          'WORKFLOW_ORDER_CLOSED'
        );
      }
      if (oldOrderStatus === 'ready-for-pickup') {
        // Wie die Wiederaufnahme der Reparatur (reopenRepair): eine fertige Reparatur wird nur mit
        // Grund wieder geoeffnet.
        if (!reopenReason) {
          throw buildOrderValueError(
            'Bitte einen Grund angeben – die Reparatur ist abgeschlossen und wird durch das erneute Öffnen wieder aufgenommen.',
            400,
            'WORKFLOW_REOPEN_REASON_REQUIRED'
          );
        }
        // eslint-disable-next-line global-require
        const RepairWorkflowService = require('./repairWorkflowService');
        if (await RepairWorkflowService.isOutboundShippingStarted(order._id)) {
          throw buildOrderValueError(
            'Das Gerät ist bereits für den Versand vorbereitet (Versandlabel an den Kunden vorhanden) – der Schritt kann nicht erneut geöffnet werden.',
            409,
            'WORKFLOW_REOPEN_OUTBOUND_EXISTS'
          );
        }
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
      const reopenActor = staff ? OrderHistory.normalizeActor(staff) : { id: toIdString(staffId) || 'system', name: 'Mitarbeiter' };
      await OrderService._autoAssignStaff(order, staffId);
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Step Reopened',
        type: 'workflow',
        description: `Schritt „${step.stepName}“ im Workflow „${workflow.workflowName}“ erneut geöffnet`,
        actor: reopenActor,
        source: 'Workflow',
        reason: reopenReason,
        refs: { workflowId: workflow._id, workflowStepId: step._id },
      }));

      // War der Auftrag durch diesen Workflow "Reparatur abgeschlossen", wird wieder repariert.
      if (oldOrderStatus === 'ready-for-pickup') {
        order.status = 'in-progress';
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Order Status Updated',
          type: 'status',
          description: `Status geändert: ${OrderHistory.statusLabelDe(oldOrderStatus)} → ${OrderHistory.statusLabelDe('in-progress')} (Schritt erneut geöffnet)`,
          actor: reopenActor,
          source: 'Workflow',
          changes: [{ field: 'status', label: 'Auftragsstatus', from: oldOrderStatus, to: 'in-progress' }],
          reason: reopenReason,
          refs: { workflowId: workflow._id },
          visibility: 'customer',
        }));
      }

      // Update order progress
      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      // Bedingt speichern: nur wenn Auftragsstatus und Schritt noch dem gelesenen Stand entsprechen
      // (Doppelklick -> genau ein Eintrag, die zweite Anfrage bekommt 409).
      const toObjectId = (value) => (mongoose.Types.ObjectId.isValid(String(value)) ? new mongoose.Types.ObjectId(String(value)) : value);
      order.$where = {
        status: oldOrderStatus == null ? { $in: [null] } : oldOrderStatus,
        workflows: {
          $elemMatch: {
            _id: toObjectId(workflow._id),
            steps: { $elemMatch: { _id: toObjectId(step._id), status: { $in: ['completed', 'skipped'] } } },
          },
        },
      };
      let updatedOrder;
      try {
        updatedOrder = await order.save();
      } catch (saveError) {
        if (saveError && (saveError.name === 'DocumentNotFoundError' || saveError.name === 'VersionError')) {
          throw buildOrderValueError('Der Schritt wurde gleichzeitig geändert. Bitte die Ansicht neu laden.', 409, 'WORKFLOW_STATUS_CONFLICT');
        }
        throw saveError;
      } finally {
        order.$where = undefined;
      }

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess zurückgesetzt. Neuer Fortschritt: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%).`
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
  // Ehrliche Meilensteine (HIST-1): jede Stufe nur aus echten Ereignissen des Verlaufs.
  // Nie erreichte Stufen heissen 'skipped' ("Übersprungen – nicht erfasst"), fehlende
  // Zeitpunkte "Zeitpunkt nicht erfasst" - es wird nichts aus dem Endstatus abgeleitet und
  // kein Zeitstempel erfunden. Vertrag: OrderHistory.buildMilestones (server/utils/orderHistory.js).
  // options.forCustomer: ohne Mitarbeiternamen/Eintrags-IDs.
  static async getProgressTimeline(orderId, options = {}) {
    try {
      const order = await Order.findById(orderId)
        .setOptions({ skipAutoPopulate: true })
        .select('status progress createdAt timeline pickupConfirmation')
        .lean();
      if (!order) {
        throw new Error('Order not found');
      }
      return OrderHistory.buildMilestones(order, { forCustomer: options.forCustomer === true });
    } catch (error) {
      console.error('OrderService: Error getting progress timeline:', error);
      throw error;
    }
  }

  /**
   * Zusammengefuehrter Verlauf eines Auftrags (Lesemodell, schreibt nichts).
   * Personal (viewer.isStaff): order.timeline + nicht verknuepfte OrderRevisions + Rechnungen
   *   (Erstellung, auditTrail) + Zahlungen/Erstattungen (Auftrag und Buchung) + Alt-Zeitstempel
   *   aus RepairWorkflow/DeviceInspection, sofern kein Verlaufseintrag mit demselben eventKey
   *   existiert. Kunde: nur OrderHistory.toCustomerView(order.timeline).
   * options: { viewer: { isStaff }, types: string[] (OrderHistory.TYPES), before: cursor, limit }
   * Rueckgabe: { entries, total, nextCursor, groups: [{id,label,types,count}], milestones }
   */
  static async getOrderHistory(orderId, options = {}) {
    const isStaff = Boolean(options.viewer?.isStaff);
    const order = await Order.findById(orderId)
      .setOptions({ skipAutoPopulate: true })
      .select('orderNumber status progress createdAt timeline pickupConfirmation bookingId customerId')
      .lean();
    if (!order) {
      throw buildOrderValueError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
    }
    const orderIdText = String(order._id);
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];

    let entries;
    if (!isStaff) {
      entries = OrderHistory.toCustomerView(timeline).map((item) => ({
        id: item._id || '',
        at: item.completedAt,
        timeKnown: Boolean(item.completedAt),
        timeNote: item.completedAt ? null : 'Zeitpunkt nicht erfasst',
        key: item.status,
        type: item.type,
        typeLabel: OrderHistory.TYPE_LABELS[item.type] || item.type,
        title: item.title,
        description: item.description,
        origin: 'timeline',
      }));
    } else {
      entries = timeline.map((item) => OrderHistory.toView(item, { orderId: orderIdText }));
      const knownKeys = new Set(timeline.map((item) => item && item.eventKey).filter(Boolean));
      const linkedRevisionIds = new Set(
        timeline.map((item) => item?.refs?.revisionId && String(item.refs.revisionId)).filter(Boolean)
      );
      const derived = (input) => OrderHistory.toView({ ...input, type: input.type }, { orderId: orderIdText, origin: input.origin });
      const pushDerived = (input) => {
        if (input.eventKey && knownKeys.has(input.eventKey)) return;
        entries.push(derived(input));
      };

      // eslint-disable-next-line global-require
      const OrderRevision = require('../models/OrderRevision');
      // eslint-disable-next-line global-require
      const Invoice = require('../models/Invoice');
      // eslint-disable-next-line global-require
      const Payment = require('../models/Payment');
      const optionalModel = (name) => {
        try {
          return mongoose.model(name);
        } catch (error) {
          return null;
        }
      };

      const REVISION_LABELS = {
        initial_creation: 'Auftragswert bei Anlage',
        diagnostic_addition: 'Diagnose ergänzt',
        scope_change: 'Leistungsumfang geändert',
        addon_added: 'Zusatzleistung hinzugefügt',
        addon_updated: 'Zusatzleistung geändert',
        addon_removed: 'Zusatzleistung entfernt',
        service_updated: 'Position geändert',
        device_change: 'Gerätewechsel',
        price_adjustment: 'Preis angepasst',
        discount_applied: 'Rabatt angewendet',
        manual_edit: 'Manuelle Änderung',
      };
      const revisions = await OrderRevision.find({ orderId: order._id }).sort({ revisionNumber: 1 }).lean();
      revisions
        .filter((revision) => !linkedRevisionIds.has(String(revision._id)))
        .forEach((revision) => {
          const delta = Number(revision.deltaGrossAmount || 0);
          pushDerived({
            _id: `rev:${revision._id}`,
            status: 'Order Revision',
            type: revision.triggerReason === 'initial_creation' || revision.triggerReason === 'price_adjustment'
              || revision.triggerReason === 'discount_applied' ? 'pricing' : 'services',
            description: [
              `${REVISION_LABELS[revision.triggerReason] || 'Änderung'} (Änderungsbeleg #${revision.revisionNumber})`,
              revision.notes || '',
            ].filter(Boolean).join(' · '),
            completedAt: revision.createdAt,
            staffId: revision.changedBy ? String(revision.changedBy) : 'system',
            staffName: revision.changedByName || 'System',
            source: 'Änderungsbeleg',
            changes: delta !== 0 || revision.triggerReason === 'initial_creation'
              ? [{ field: 'totalCost', label: 'Auftragswert', from: revision.previousGrossAmount, to: revision.newGrossAmount }]
              : [],
            refs: { revisionId: revision._id, revisionNumber: revision.revisionNumber },
            origin: 'revision',
          });
        });

      const bookingId = order.bookingId || null;
      const invoiceFilter = { $or: [{ orderId: order._id }, { repairOrderIds: order._id }] };
      if (bookingId) invoiceFilter.$or.push({ bookingId });
      const invoices = await Invoice.find(invoiceFilter)
        .select('invoiceNumber isCreditNote total status createdAt auditTrail orderId bookingId')
        .lean();
      const INVOICE_ACTIONS = {
        sent: 'Rechnung versendet',
        email_sent: 'Rechnung per E-Mail versendet',
        cancelled: 'Rechnung storniert',
        storno: 'Rechnung storniert',
        archived: 'Rechnung archiviert',
        dunning: 'Mahnung erstellt',
        reminder: 'Zahlungserinnerung versendet',
        payment_request: 'Zahlungsaufforderung versendet',
      };
      invoices.forEach((invoice) => {
        const label = invoice.isCreditNote ? 'Gutschrift' : 'Rechnung';
        const scope = invoice.bookingId && bookingId && toIdString(invoice.bookingId) === toIdString(bookingId)
          && (!invoice.orderId || toIdString(invoice.orderId) !== orderIdText) ? ' (Buchung)' : '';
        pushDerived({
          _id: `inv:${invoice._id}`,
          status: invoice.isCreditNote ? 'Credit Note Created' : 'Invoice Created',
          type: 'invoice',
          description: `${label} ${invoice.invoiceNumber || ''} erstellt${scope} · Gesamt (brutto) ${OrderHistory.formatEuroDe(invoice.total)}`.replace(/\s+/g, ' '),
          completedAt: invoice.createdAt,
          staffName: 'System',
          source: 'Rechnungen',
          refs: { invoiceId: invoice._id },
          origin: 'invoice',
        });
        (Array.isArray(invoice.auditTrail) ? invoice.auditTrail : []).forEach((audit, index) => {
          pushDerived({
            _id: `inv:${invoice._id}:audit:${index}`,
            status: 'Invoice Action',
            type: 'invoice',
            description: [
              `${INVOICE_ACTIONS[String(audit.action || '').toLowerCase()] || `${label}: ${audit.action}`} (${invoice.invoiceNumber || label})`,
              audit.detail || '',
            ].filter(Boolean).join(' · '),
            completedAt: audit.at,
            staffId: audit.actorId ? String(audit.actorId) : 'system',
            staffName: audit.actorName || 'System',
            source: 'Rechnungen',
            refs: { invoiceId: invoice._id },
            origin: 'invoice',
          });
        });
      });

      const paymentFilter = { $or: [{ orderId: order._id }] };
      if (bookingId) paymentFilter.$or.push({ bookingId });
      const payments = await Payment.find(paymentFilter)
        .select('amount currency paymentDate createdAt status paymentMethod recordedBy refundedAt refundAmount invoiceId orderId bookingId source')
        .populate({ path: 'recordedBy', select: 'name', options: { skipAutoPopulate: true } })
        .lean();
      const METHOD_LABELS = {
        credit_card: 'Kreditkarte', debit_card: 'Debitkarte', paypal: 'PayPal', stripe: 'Stripe', bank_transfer: 'Überweisung',
        invoice: 'Rechnung', sepa: 'SEPA', cash: 'Bar', apple_pay: 'Apple Pay', google_pay: 'Google Pay',
      };
      const PAYMENT_STATUS = {
        pending: 'ausstehend', processing: 'in Bearbeitung', completed: 'eingegangen', failed: 'fehlgeschlagen',
        refunded: 'erstattet', disputed: 'angefochten',
      };
      payments.forEach((payment) => {
        const bookingScope = !payment.orderId || toIdString(payment.orderId) !== orderIdText ? ' (gilt für die gesamte Buchung)' : '';
        pushDerived({
          _id: `pay:${payment._id}`,
          status: 'Payment Recorded',
          type: 'payment',
          description: `Zahlung ${OrderHistory.formatEuroDe(payment.amount)} (${METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || 'unbekannt'}) – ${PAYMENT_STATUS[payment.status] || payment.status}${bookingScope}`,
          completedAt: payment.paymentDate || payment.createdAt,
          staffId: payment.recordedBy?._id ? String(payment.recordedBy._id) : 'system',
          staffName: payment.recordedBy?.name || (payment.source === 'manual' ? 'Mitarbeiter' : 'System'),
          source: 'Zahlungen',
          refs: { paymentId: payment._id, invoiceId: payment.invoiceId || undefined },
          origin: 'payment',
        });
        if (payment.refundedAt && Number(payment.refundAmount || 0) > 0) {
          pushDerived({
            _id: `pay:${payment._id}:refund`,
            status: 'Refund Recorded',
            type: 'payment',
            description: `Erstattung ${OrderHistory.formatEuroDe(payment.refundAmount)}${bookingScope}`,
            completedAt: payment.refundedAt,
            staffName: 'System',
            source: 'Zahlungen',
            refs: { paymentId: payment._id },
            origin: 'payment',
          });
        }
      });

      // Alt-Zeitstempel aus Reparatur-Workflow und Eingangspruefung (nur echte Zeitpunkte).
      const RepairWorkflow = optionalModel('RepairWorkflow');
      if (RepairWorkflow) {
        const workflow = await RepairWorkflow.findOne({ orderId: order._id }).lean();
        if (workflow) {
          const wfId = workflow._id;
          const add = (transition, at, key, description, actorName, reason) => {
            if (!at) return;
            pushDerived({
              _id: `rwf:${wfId}:${transition}:${new Date(at).getTime()}`,
              status: key,
              type: 'workflow',
              description,
              completedAt: at,
              staffName: actorName || 'Techniker',
              source: 'Reparatur-Workflow',
              reason,
              refs: { repairWorkflowId: wfId },
              eventKey: OrderHistory.repairWorkflowEventKey(wfId, transition, at),
              origin: 'repair-workflow',
            });
          };
          add('approve', workflow.approvalData?.approvedAt, 'Repair Workflow Started', 'Reparatur gestartet', workflow.approvalData?.approvedByTechnicianName);
          (workflow.timerData?.pauseHistory || []).forEach((pause) => {
            add('pause', pause.pausedAt, 'Repair Workflow Paused', 'Reparatur pausiert', pause.pausedByTechnicianName, pause.reason);
            add('resume', pause.resumedAt, 'Repair Workflow Resumed', 'Reparatur fortgesetzt', pause.resumedByTechnicianName);
          });
          (workflow.incidents || []).forEach((incident) => {
            add('incident', incident.timestamp, 'Repair Workflow Incident', `Zwischenfall gemeldet (${incident.type})`, incident.reportedByTechnicianName, incident.reason);
            add('incident-resolved', incident.resolvedAt, 'Repair Workflow Incident Resolved', 'Zwischenfall erledigt', incident.resolvedByTechnicianName, incident.resolutionNote);
          });
          add('complete', workflow.timerData?.completedAt, 'Repair Workflow Completed', 'Reparatur abgeschlossen', workflow.metadata?.completedByTechnicianName);
        }
      }
      const DeviceInspection = optionalModel('DeviceInspection');
      if (DeviceInspection) {
        const inspection = await DeviceInspection.findOne({ orderId: order._id })
          .select('startedAt completedAt technicianName status')
          .lean();
        if (inspection) {
          const addInspection = (kind, at, key, description) => {
            if (!at) return;
            pushDerived({
              _id: `insp:${inspection._id}:${kind}`,
              status: key,
              type: 'inspection',
              description,
              completedAt: at,
              staffName: inspection.technicianName || 'Techniker',
              source: 'Eingangsprüfung',
              refs: { inspectionId: inspection._id },
              eventKey: OrderHistory.inspectionEventKey(kind, inspection._id),
              origin: 'inspection',
            });
          };
          addInspection('start', inspection.startedAt, 'Inspection Started', 'Eingangsprüfung gestartet');
          addInspection('complete', inspection.completedAt, 'Inspection Completed', 'Eingangsprüfung abgeschlossen');
        }
      }
    }

    // Neueste zuerst; Eintraege ohne Zeitpunkt ans Ende (ehrlich als "Zeitpunkt nicht erfasst").
    const timeOf = (item) => (item.at ? new Date(item.at).getTime() : -Infinity);
    entries.sort((left, right) => {
      const diff = timeOf(right) - timeOf(left);
      if (diff !== 0) return diff;
      return String(right.id).localeCompare(String(left.id));
    });

    const groups = OrderHistory.TYPE_GROUPS.map((group) => ({
      ...group,
      count: entries.filter((item) => group.types.includes(item.type)).length,
    }));

    const types = Array.isArray(options.types) ? options.types.filter((type) => OrderHistory.TYPES.includes(type)) : [];
    let filtered = types.length ? entries.filter((item) => types.includes(item.type)) : entries;
    const total = filtered.length;

    // Cursor: '<ms>|<id>' des letzten gelieferten Eintrags (absteigend sortiert).
    if (options.before) {
      const [msText, ...idParts] = String(options.before).split('|');
      const cursorMs = msText === 'none' ? -Infinity : Number(msText);
      const cursorId = idParts.join('|');
      const index = filtered.findIndex((item) => timeOf(item) === cursorMs && String(item.id) === cursorId);
      if (index >= 0) {
        filtered = filtered.slice(index + 1);
      } else if (Number.isFinite(cursorMs)) {
        filtered = filtered.filter((item) => timeOf(item) < cursorMs);
      }
    }
    const limit = Math.min(300, Math.max(1, Number(options.limit) || 100));
    const page = filtered.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = filtered.length > limit && last
      ? `${last.at ? new Date(last.at).getTime() : 'none'}|${last.id}`
      : null;

    return {
      orderId: orderIdText,
      orderNumber: order.orderNumber,
      entries: page,
      total,
      nextCursor,
      groups,
      milestones: OrderHistory.buildMilestones(order, { forCustomer: !isStaff }),
    };
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
      const confirmedAt = new Date();
      order.unlockConfirmation = {
        confirmedBy: userId,
        confirmedByName: userName,
        confirmationStatus: confirmationStatus,
        notes: notes,
        confirmedAt
      };

      // Verlauf im selben Speichervorgang (HIST-13). Nur Personal - Entsperrdaten sind intern.
      const unlockMeta = {
        verified: { key: 'Unlock Verified', text: 'Entsperrdaten geprüft: korrekt' },
        incorrect: { key: 'Unlock Incorrect', text: 'Entsperrdaten geprüft: falsch' },
        'unable-to-verify': { key: 'Unlock Unverifiable', text: 'Entsperrdaten konnten nicht geprüft werden' },
      }[confirmationStatus];
      OrderHistory.push(order, OrderHistory.entry({
        key: unlockMeta.key,
        type: 'inspection',
        description: unlockMeta.text,
        actor: { id: toIdString(userId), name: userName },
        source: 'Entsperrdaten',
        reason: notes,
        at: confirmedAt,
      }));

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

        const previousQuantity = existingProductIndex !== -1
          ? Number(order.shopProducts[existingProductIndex].quantity) || 0
          : 0;
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
        const eventKey = OrderService.newEditEventKey();
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Order Products Changed',
          type: 'services',
          description: `Produkt „${product.name || 'Produkt'}“ ×${quantity} hinzugefügt (${formatEuroDe(product.price)} je Stück)`,
          actor: await OrderHistory.resolveActor(userId),
          source: 'Produkte',
          changes: [
            { field: 'shopProducts.quantity', label: `Menge „${product.name || 'Produkt'}“`, from: previousQuantity, to: previousQuantity + quantity },
            { field: 'totalCost', label: 'Auftragswert', from: prevTotalCost, to: order.totalCost },
          ],
          eventKey,
          force: true,
        }));
        return { prevTotalCost, reconciliation, repricingConfirmed, eventKey };
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
      const revision = await OrderRevisionService.recordRevision(order, {
        triggerReason,
        previousGrossAmount: context.prevTotalCost,
        changedBy: userId || undefined,
        changedByName: staff?.name || 'Mitarbeiter',
        notes: [note, OrderService.describeConfirmedRepricing(context.reconciliation)].filter(Boolean).join(' | '),
      });
      await OrderService.linkRevisionToHistory(order._id, context.eventKey, revision);
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
        const removedProduct = removedItem?.productId
          ? await Product.findById(removedItem.productId).select('name').lean().catch(() => null)
          : null;
        const productName = removedProduct?.name || 'Produkt';
        order.shopProducts.splice(productIndex, 1);
        console.log('OrderService: Shop product removed from order');

        // Recalculate total cost
        await OrderService.recalculateOrderTotal(order, conditions);
        const removedQuantity = Number(removedItem?.quantity) || 0;
        const removedPrice = Number(removedItem?.priceAtOrder) || 0;
        const eventKey = OrderService.newEditEventKey();
        OrderHistory.push(order, OrderHistory.entry({
          key: 'Order Products Changed',
          type: 'services',
          description: `Produkt „${productName}“ ×${removedQuantity} entfernt (${formatEuroDe(removedPrice)} je Stück)`,
          actor: await OrderHistory.resolveActor(userId),
          source: 'Produkte',
          changes: [
            { field: 'shopProducts.quantity', label: `Menge „${productName}“`, from: removedQuantity, to: 0 },
            { field: 'totalCost', label: 'Auftragswert', from: prevTotalCost, to: order.totalCost },
          ],
          eventKey,
          force: true,
        }));
        return {
          prevTotalCost,
          reconciliation,
          repricingConfirmed,
          removedQuantity,
          removedPrice,
          productName,
          eventKey,
        };
      });
      console.log('OrderService: Shop product removed successfully from order:', orderId);
      await OrderService.recordConfirmedShopRepricing(updatedOrder, context, {
        triggerReason: 'scope_change',
        note: `Produkt „${context.productName}“ ×${context.removedQuantity} entfernt (${formatEuroDe(context.removedPrice)} je Stück)`,
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
        const eventKey = OrderService.newEditEventKey();
        const productName = product.name || 'Produkt';
        const recorded = OrderHistory.push(order, OrderHistory.entry({
          key: 'Order Products Changed',
          type: 'services',
          description: `Menge „${productName}“ geändert (${previousQuantity} → ${quantity}, ${formatEuroDe(productItem.priceAtOrder)} je Stück)`,
          actor: await OrderHistory.resolveActor(userId),
          source: 'Produkte',
          changes: [
            { field: 'shopProducts.quantity', label: `Menge „${productName}“`, from: previousQuantity, to: Number(quantity) },
            { field: 'totalCost', label: 'Auftragswert', from: prevTotalCost, to: order.totalCost },
          ],
          eventKey,
        }));
        return { prevTotalCost, reconciliation, repricingConfirmed, previousQuantity, productName, eventKey: recorded ? eventKey : null };
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
      OrderHistory.push(order, OrderHistory.entry({
        key: 'Workflow Removed',
        type: 'workflow',
        description: `Workflow „${removedWorkflow.workflowName}“ entfernt`,
        actor: staff ? OrderHistory.normalizeActor(staff) : { id: toIdString(staffId) || 'system', name: 'System' },
        source: 'Workflow',
      }));

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