const { Supplier, EPartOrder } = require('../models/EPartOrder');
const Inventory = require('../models/Inventory');
const NeedList = require('../models/NeedList');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');
const mongoose = require('mongoose');
const ListFilterGroups = require('../utils/listFilterGroups');

// ---- gemeinsame Regeln fuer Ersatzteilbestellungen (01.10.2026) ----
const MANUAL_STATUSES = ['draft', 'pending', 'confirmed', 'shipped'];
const CREATE_STATUSES = ['draft', 'pending', 'confirmed'];
const RECEIVABLE_STATUSES = ['confirmed', 'shipped', 'partial'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
const PAYMENT_METHODS = ['credit_card', 'bank_transfer', 'check', 'cash', 'account'];
const STATUS_LABELS = {
  draft: 'Entwurf',
  pending: 'Offen',
  confirmed: 'Bestellt',
  shipped: 'Versendet',
  partial: 'Teilweise erhalten',
  received: 'Erhalten',
  cancelled: 'Storniert'
};
const PAYMENT_LABELS = { unpaid: 'Unbezahlt', partial: 'Teilweise bezahlt', paid: 'Bezahlt' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isValidObjectId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(String(value)) && /^[a-f0-9]{24}$/i.test(String(value));
}

function assertObjectId(value, message) {
  if (!isValidObjectId(value)) throw httpError(400, message);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOptionalDate(value, message) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, message);
  return date;
}

function formatDateDe(date) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(date);
}

class EPartOrderService {
  static getSafeVersionForAllocation(part, requestedQuantity = 1) {
    if (!part || !Array.isArray(part.versions) || part.versions.length === 0) {
      return null;
    }

    const normalizedRequested = Math.max(1, Number(requestedQuantity) || 1);
    const versions = part.versions.filter((version) => Number(version.quantity || 0) > 0);
    if (versions.length === 0) {
      return null;
    }

    const fittingVersion = versions.find((version) => Number(version.quantity || 0) >= normalizedRequested);
    if (fittingVersion) {
      return fittingVersion;
    }

    return versions.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
  }

  static async autoAssignConvertedNeedListOrderItems(epartOrder, userId) {
    const needList = await NeedList.findOne({ convertedToOrder: epartOrder._id });
    if (!needList) {
      return;
    }

    const linkedOrders = await Order.find({
      'ePartNeedListEntries.needListId': needList._id,
    }).setOptions({ skipAutoPopulate: true });

    if (!linkedOrders.length) {
      return;
    }

    for (const linkedOrder of linkedOrders) {
      let orderChanged = false;
      let autoAssignedLines = 0;

      for (const entry of [...linkedOrder.ePartNeedListEntries]) {
        const matchesNeedList = String(entry.needListId || '') === String(needList._id);
        const pendingQuantity = Math.max(0, Number(entry.quantity) || 0);
        if (!matchesNeedList || pendingQuantity === 0) {
          continue;
        }

        const part = await Inventory.findById(entry.partId);
        if (!part) {
          continue;
        }

        const chosenVersion = this.getSafeVersionForAllocation(part, pendingQuantity);
        if (!chosenVersion) {
          continue;
        }

        const assignableQuantity = Math.min(
          pendingQuantity,
          Math.max(0, Number(chosenVersion.quantity) || 0)
        );

        if (assignableQuantity <= 0) {
          continue;
        }

        chosenVersion.quantity -= assignableQuantity;
        await part.save();

        const existingEPart = linkedOrder.eParts.find(
          (ep) => String(ep.partId) === String(entry.partId)
            && String(ep.versionId) === String(chosenVersion._id)
        );

        if (existingEPart) {
          existingEPart.quantity += assignableQuantity;
          existingEPart.status = 'allocated';
          existingEPart.assignedAt = new Date();
          existingEPart.assignedBy = userId;
        } else {
          linkedOrder.eParts.push({
            partId: entry.partId,
            versionId: String(chosenVersion._id),
            quantity: assignableQuantity,
            status: 'allocated',
            assignedAt: new Date(),
            assignedBy: userId,
          });
        }

        if (assignableQuantity >= pendingQuantity) {
          linkedOrder.ePartNeedListEntries.pull(entry._id);
        } else {
          entry.quantity = pendingQuantity - assignableQuantity;
          entry.needListStatus = 'ordered';
        }

        linkedOrder.timeline.push({
          status: 'EPart Assigned',
          description: `${part.itemName} × ${assignableQuantity} automatisch aus der eingegangenen Bedarfsliste „${needList.name}“ zugewiesen`,
          completedAt: new Date(),
          staffId: userId || 'system',
          staffName: 'System',
        });

        autoAssignedLines += 1;
        orderChanged = true;
      }

      if (orderChanged) {
        await linkedOrder.save({ validateModifiedOnly: true });

        const assignedStaffIds = Array.isArray(linkedOrder.assignedStaff)
          ? [...new Set(
            linkedOrder.assignedStaff
              .map((assignment) => String(assignment?.staffId || ''))
              .filter((staffId) => staffId)
          )]
          : [];

        await Promise.all(
          assignedStaffIds.map(async (staffId) => {
            try {
              await NotificationService.createNotification({
                userId: staffId,
                title: 'Ersatzteil für Reparatur verfügbar',
                message: `Für Auftrag ${linkedOrder.orderNumber || linkedOrder._id} wurde ein angefordertes Ersatzteil empfangen und der Reparatur zugewiesen.`,
                type: 'assignment',
                orderId: linkedOrder._id,
                actionUrl: `/admin/orders/${linkedOrder._id}`,
              }, { sendEmail: false });
            } catch (notificationError) {
              console.error('EPartOrderService: Failed to notify assigned staff:', notificationError.message || notificationError);
            }
          })
        );

        if (autoAssignedLines > 0) {
          linkedOrder.timeline.push({
            status: 'Staff Notified',
            description: `Zugewiesenes Personal benachrichtigt: ${autoAssignedLines} Ersatzteilposition(en) für die Reparatur verfügbar`,
            completedAt: new Date(),
            staffId: userId || 'system',
            staffName: 'System',
          });
          await linkedOrder.save({ validateModifiedOnly: true });
        }
      }
    }
  }

  static roundTo(value, decimals = 4) {
    const factor = 10 ** decimals;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  static allocateShippingProportionally(items, shippingTotal) {
    const normalizedItems = items.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const additionalCost = Math.max(0, Number(item.additionalCost) || 0);
      const lineTotal = this.roundTo(quantity * unitPrice, 4);

      return {
        ...item,
        quantity,
        unitPrice,
        additionalCost,
        lineTotal,
      };
    });

    const orderSubtotal = this.roundTo(
      normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0),
      4
    );
    const roundedShippingTotal = this.roundTo(Math.max(0, Number(shippingTotal) || 0), 2);

    const shares = normalizedItems.map(() => 0);
    if (orderSubtotal > 0 && roundedShippingTotal > 0) {
      let allocatedShipping = 0;

      normalizedItems.forEach((item, index) => {
        const rawShare = (item.lineTotal / orderSubtotal) * roundedShippingTotal;
        const roundedShare = this.roundTo(rawShare, 2);
        shares[index] = roundedShare;
        allocatedShipping += roundedShare;
      });

      const roundingDelta = this.roundTo(roundedShippingTotal - allocatedShipping, 2);
      if (roundingDelta !== 0 && normalizedItems.length > 0) {
        const targetIndex = normalizedItems.reduce((bestIndex, item, index, arr) => {
          if (item.lineTotal > arr[bestIndex].lineTotal) {
            return index;
          }
          return bestIndex;
        }, 0);
        shares[targetIndex] = this.roundTo(shares[targetIndex] + roundingDelta, 2);
      }
    }

    const pricedItems = normalizedItems.map((item, index) => {
      const shippingShare = Math.max(0, this.roundTo(shares[index], 2));
      const adjustedLineTotal = this.roundTo(item.lineTotal + shippingShare, 4);
      const adjustedUnitPrice = this.roundTo(adjustedLineTotal / item.quantity, 4);
      const totalPrice = this.roundTo(item.lineTotal + item.additionalCost + shippingShare, 4);

      return {
        ...item,
        shippingShare,
        adjustedLineTotal,
        adjustedUnitPrice,
        totalPrice,
      };
    });

    const subtotal = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.lineTotal + item.additionalCost, 0),
      4
    );
    const distributedShippingCost = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.shippingShare, 0),
      2
    );

    return {
      items: pricedItems,
      subtotal,
      shippingCost: distributedShippingCost,
    };
  }

  // ============ SUPPLIER OPERATIONS ============

  /**
   * Get all suppliers with optional filtering
   */
  static async getSuppliers(filters = {}) {
    const query = {};

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      const pattern = escapeRegex(String(filters.search).trim());
      query.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { contactPerson: { $regex: pattern, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 });
    return suppliers;
  }

  /**
   * Get supplier by ID
   */
  static async getSupplierById(supplierId) {
    assertObjectId(supplierId, 'Ungültige Lieferanten-ID.');
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw httpError(404, 'Lieferant nicht gefunden.');
    }
    return supplier;
  }

  /**
   * Whitelist + Normalisierung der Lieferanten-Eingaben. Unbekannte Felder
   * (_id, createdAt, updatedAt, __v ...) werden verworfen.
   */
  static normalizeSupplierInput(input = {}, { partial = false } = {}) {
    const data = input && typeof input === 'object' ? input : {};
    const result = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(data, key);
    const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

    if (!partial || has('name')) {
      result.name = text(data.name);
      if (!result.name) throw httpError(400, 'Bitte einen Namen für den Lieferanten eingeben.');
      if (result.name.length > 200) throw httpError(400, 'Der Name darf höchstens 200 Zeichen lang sein.');
    }
    if (!partial || has('email')) {
      result.email = text(data.email).toLowerCase();
      if (!EMAIL_PATTERN.test(result.email)) {
        throw httpError(400, 'Bitte eine gültige E-Mail-Adresse eingeben (z. B. bestellung@lieferant.de).');
      }
    }
    ['contactPerson', 'phone', 'website', 'ustId', 'paymentTerms', 'notes'].forEach((key) => {
      if (has(key)) result[key] = text(data[key]);
    });
    if (has('address')) {
      const address = data.address && typeof data.address === 'object' ? data.address : {};
      result.address = {};
      ['street', 'city', 'state', 'zipCode', 'country'].forEach((key) => {
        result.address[key] = text(address[key]);
      });
    }
    if (has('paymentInformation')) {
      const info = data.paymentInformation && typeof data.paymentInformation === 'object' ? data.paymentInformation : {};
      result.paymentInformation = {};
      ['iban', 'bic', 'bankName', 'accountHolder'].forEach((key) => {
        result.paymentInformation[key] = text(info[key]);
      });
      result.paymentInformation.iban = result.paymentInformation.iban.replace(/\s+/g, '').toUpperCase();
      result.paymentInformation.bic = result.paymentInformation.bic.replace(/\s+/g, '').toUpperCase();
    }
    if (has('leadTime')) {
      const raw = data.leadTime;
      if (raw === '' || raw === null || raw === undefined) {
        result.leadTime = 7;
      } else {
        const leadTime = Number(raw);
        if (!Number.isInteger(leadTime) || leadTime < 0 || leadTime > 365) {
          throw httpError(400, 'Lieferzeit muss eine ganze Zahl zwischen 0 und 365 Tagen sein.');
        }
        result.leadTime = leadTime;
      }
    }
    if (has('rating')) {
      const raw = data.rating;
      if (raw === '' || raw === null || raw === undefined) {
        result.rating = undefined;
      } else {
        const rating = Number(raw);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
          throw httpError(400, 'Bewertung muss zwischen 1 und 5 liegen.');
        }
        result.rating = rating;
      }
    }
    if (has('isActive')) {
      result.isActive = data.isActive === true || data.isActive === 'true';
    }
    return result;
  }

  /**
   * Dublettenpruefung: gleicher Name (ohne Gross-/Kleinschreibung) UND gleiche
   * E-Mail unter den AKTIVEN Lieferanten -> 409.
   */
  static async assertNoDuplicateSupplier({ name, email, excludeId = null }) {
    if (!name || !email) return;
    const query = {
      isActive: true,
      email: String(email).toLowerCase(),
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    };
    if (excludeId) query._id = { $ne: excludeId };
    const duplicate = await Supplier.findOne(query).select('_id name');
    if (duplicate) {
      throw httpError(409, 'Ein Lieferant mit diesem Namen und dieser E-Mail existiert bereits.');
    }
  }

  /**
   * Create new supplier
   */
  static async createSupplier(supplierData) {
    const data = this.normalizeSupplierInput(supplierData, { partial: false });
    if (data.isActive === undefined) data.isActive = true;
    if (data.isActive) {
      await this.assertNoDuplicateSupplier({ name: data.name, email: data.email });
    }
    const supplier = new Supplier(data);
    await supplier.save();
    return supplier;
  }

  /**
   * Update supplier (also used to deactivate / reactivate)
   */
  static async updateSupplier(supplierId, updateData) {
    assertObjectId(supplierId, 'Ungültige Lieferanten-ID.');
    const existing = await Supplier.findById(supplierId);
    if (!existing) {
      throw httpError(404, 'Lieferant nicht gefunden.');
    }

    const data = this.normalizeSupplierInput(updateData, { partial: true });
    const nextName = data.name !== undefined ? data.name : existing.name;
    const nextEmail = data.email !== undefined ? data.email : existing.email;
    const nextActive = data.isActive !== undefined ? data.isActive : existing.isActive;
    if (nextActive) {
      await this.assertNoDuplicateSupplier({ name: nextName, email: nextEmail, excludeId: existing._id });
    }

    const $set = {};
    const $unset = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) $unset[key] = 1;
      else $set[key] = value;
    });
    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return existing;

    const supplier = await Supplier.findByIdAndUpdate(supplierId, update, { new: true, runValidators: true });
    return supplier;
  }

  /**
   * Delete (deactivate) supplier
   */
  static async deleteSupplier(supplierId) {
    assertObjectId(supplierId, 'Ungültige Lieferanten-ID.');
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      throw httpError(404, 'Lieferant nicht gefunden.');
    }

    return { message: 'Lieferant deaktiviert.', supplier };
  }

  // ============ ORDER OPERATIONS ============

  static async loadOrderOrFail(orderId) {
    assertObjectId(orderId, 'Ungültige Bestell-ID.');
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw httpError(404, 'Bestellung nicht gefunden.');
    }
    return order;
  }

  /**
   * Get all epart orders with filtering and pagination
   */
  static async getEPartOrders(filters = {}) {
    const query = {};
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Status filter (einzelner Status oder Gruppe aktiv/ausstehend/verzoegert - dieselbe Regel
    // wie der Dashboard-Zaehler, server/utils/listFilterGroups.js)
    ListFilterGroups.applyEPartStatusFilter(query, filters.status);

    // Supplier filter
    if (filters.supplierId) {
      assertObjectId(filters.supplierId, 'Ungültige Lieferanten-ID.');
      query.supplierId = filters.supplierId;
    }

    // Payment status filter
    if (filters.paymentStatus) {
      query.paymentStatus = String(filters.paymentStatus);
    }

    // Search filter (order number, notes or tracking number) - Eingabe wird escaped,
    // damit z. B. "(" keinen Regex-Fehler (500) ausloest.
    if (filters.search) {
      const pattern = escapeRegex(String(filters.search).trim());
      query.$or = [
        { orderNumber: { $regex: pattern, $options: 'i' } },
        { notes: { $regex: pattern, $options: 'i' } },
        { trackingNumber: { $regex: pattern, $options: 'i' } }
      ];
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) {
        query.orderDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.orderDate.$lte = new Date(filters.endDate);
      }
    }

    const total = await EPartOrder.countDocuments(query);
    const orders = await EPartOrder.find(query)
      .populate('supplierId', 'name email contactPerson isActive')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .sort({ orderDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    return {
      orders,
      pagination: {
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        limit
      }
    };
  }

  /**
   * Get order by ID
   */
  static async getEPartOrderById(orderId) {
    assertObjectId(orderId, 'Ungültige Bestell-ID.');
    const order = await EPartOrder.findById(orderId)
      .populate('supplierId')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .populate('items.partId');

    if (!order) {
      throw httpError(404, 'Bestellung nicht gefunden.');
    }

    return order;
  }

  /**
   * Create new epart order
   */
  static async createEPartOrder(orderData = {}, userId) {
    const data = orderData && typeof orderData === 'object' ? orderData : {};

    if (!data.supplierId || !isValidObjectId(data.supplierId)) {
      throw httpError(400, 'Bitte einen Lieferanten auswählen.');
    }
    const supplier = await Supplier.findById(data.supplierId).select('_id name isActive');
    if (!supplier) {
      throw httpError(400, 'Der ausgewählte Lieferant wurde nicht gefunden.');
    }
    if (supplier.isActive === false) {
      throw httpError(400, `Der Lieferant „${supplier.name}“ ist inaktiv. Bitte zuerst wieder aktivieren.`);
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      throw httpError(400, 'Bitte mindestens eine Position hinzufügen.');
    }

    const preparedItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] || {};
      const position = `Position ${index + 1}`;
      if (!item.partId || !isValidObjectId(item.partId)) {
        throw httpError(400, `${position}: Bitte ein Ersatzteil auswählen.`);
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw httpError(400, `${position}: Menge muss eine ganze Zahl von mindestens 1 sein.`);
      }
      const unitPrice = item.unitPrice === undefined || item.unitPrice === '' ? 0 : Number(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw httpError(400, `${position}: Einzelpreis muss 0 oder größer sein.`);
      }
      const additionalCost = item.additionalCost === undefined || item.additionalCost === '' ? 0 : Number(item.additionalCost);
      if (!Number.isFinite(additionalCost) || additionalCost < 0) {
        throw httpError(400, `${position}: Zusatzkosten müssen 0 oder größer sein.`);
      }

      // Get part details from inventory (Inventory hat itemName, nicht name).
      const part = await Inventory.findById(item.partId).select('itemName sku');
      if (!part) {
        throw httpError(400, `${position}: Das Ersatzteil wurde nicht gefunden.`);
      }

      preparedItems.push({
        partId: part._id,
        partName: part.itemName || part.name || part.sku || String(part._id),
        sku: part.sku || String(part._id),
        quantity,
        unitPrice,
        additionalCost,
        priceType: item.priceType === 'gross' ? 'gross' : 'net',
        receivedQuantity: 0,
        status: 'pending'
      });
    }

    const shippingInput = data.shippingCost === undefined || data.shippingCost === '' ? 0 : Number(data.shippingCost);
    if (!Number.isFinite(shippingInput) || shippingInput < 0) {
      throw httpError(400, 'Versandkosten müssen 0 oder größer sein.');
    }
    const tax = data.tax === undefined || data.tax === '' ? 0 : Number(data.tax);
    if (!Number.isFinite(tax) || tax < 0) {
      throw httpError(400, 'MwSt.-Betrag muss 0 oder größer sein.');
    }
    const status = data.status || 'draft';
    if (!CREATE_STATUSES.includes(status)) {
      throw httpError(400, 'Neue Bestellungen können nur als Entwurf, Offen oder Bestellt angelegt werden.');
    }
    const paymentMethod = data.paymentMethod || 'account';
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw httpError(400, 'Ungültige Zahlungsart.');
    }
    const expectedDeliveryDate = parseOptionalDate(data.expectedDeliveryDate, 'Voraussichtliche Lieferung ist kein gültiges Datum.');

    const allocation = this.allocateShippingProportionally(preparedItems, shippingInput);
    const totalCost = this.roundTo(allocation.subtotal + tax + allocation.shippingCost, 4);

    const order = new EPartOrder({
      supplierId: supplier._id,
      items: allocation.items,
      status,
      orderDate: parseOptionalDate(data.orderDate, 'Bestelldatum ist kein gültiges Datum.') || new Date(),
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      subtotal: allocation.subtotal,
      tax: tax,
      shippingCost: allocation.shippingCost,
      totalCost: totalCost,
      paymentMethod,
      notes: typeof data.notes === 'string' ? data.notes.trim() : undefined,
      createdBy: userId,
      timeline: [{
        status: 'created',
        description: 'Bestellung angelegt',
        completedAt: new Date(),
        userId: userId
      }]
    });

    await order.save();
    return await this.getEPartOrderById(order._id);
  }

  /**
   * Update epart order (Lieferung & Zahlung). "Teilweise erhalten"/"Erhalten" entstehen
   * ausschliesslich ueber receiveOrderItems, "Storniert" ueber cancelEPartOrder.
   * Leere Strings loeschen Sendungsnummer / Lieferdatum.
   */
  static async updateEPartOrder(orderId, updateData = {}, userId) {
    const data = updateData && typeof updateData === 'object' ? updateData : {};
    const order = await this.loadOrderOrFail(orderId);
    const now = new Date();
    const pushTimeline = (status, description, notes) => {
      order.timeline.push({ status, description, completedAt: now, userId, notes });
    };

    if (data.status !== undefined && data.status !== null && data.status !== '' && data.status !== order.status) {
      const nextStatus = String(data.status);
      if (nextStatus === 'partial' || nextStatus === 'received') {
        throw httpError(400, '„Teilweise erhalten“ und „Erhalten“ werden nur über „Wareneingang buchen“ gesetzt.');
      }
      if (nextStatus === 'cancelled') {
        throw httpError(400, 'Bitte „Bestellung stornieren“ verwenden.');
      }
      if (!MANUAL_STATUSES.includes(nextStatus)) {
        throw httpError(400, 'Ungültiger Bestellstatus.');
      }
      if (!MANUAL_STATUSES.includes(order.status)) {
        throw httpError(400, `Der Status einer Bestellung im Zustand „${STATUS_LABELS[order.status] || order.status}“ kann nicht mehr manuell geändert werden.`);
      }
      const previous = order.status;
      // Statuswechsel nur, wenn der gelesene Status noch aktuell ist (z. B. kein paralleler Wareneingang).
      order.$where = { status: previous };
      order.status = nextStatus;
      pushTimeline(
        nextStatus,
        `Bestellstatus geändert: ${STATUS_LABELS[previous] || previous} → ${STATUS_LABELS[nextStatus] || nextStatus}`,
        typeof data.statusNotes === 'string' ? data.statusNotes : undefined
      );
    }

    if (data.trackingNumber !== undefined) {
      const nextTracking = data.trackingNumber === null ? '' : String(data.trackingNumber).trim();
      if (nextTracking.length > 64) {
        throw httpError(400, 'Die Sendungsnummer darf höchstens 64 Zeichen lang sein.');
      }
      const previousTracking = order.trackingNumber || '';
      if (nextTracking !== previousTracking) {
        order.trackingNumber = nextTracking || undefined;
        if (!nextTracking) {
          pushTimeline('tracking_updated', `Sendungsnummer entfernt (vorher: ${previousTracking})`);
        } else if (!previousTracking) {
          pushTimeline('tracking_updated', `Sendungsnummer erfasst: ${nextTracking}`);
        } else {
          pushTimeline('tracking_updated', `Sendungsnummer geändert: ${previousTracking} → ${nextTracking}`);
        }
      }
    }

    if (data.paymentStatus !== undefined && data.paymentStatus !== null && data.paymentStatus !== '') {
      const nextPayment = String(data.paymentStatus);
      if (!PAYMENT_STATUSES.includes(nextPayment)) {
        throw httpError(400, 'Ungültiger Zahlungsstatus.');
      }
      if (nextPayment !== order.paymentStatus) {
        const previousPayment = order.paymentStatus;
        order.paymentStatus = nextPayment;
        pushTimeline(
          'payment_updated',
          `Zahlungsstatus geändert: ${PAYMENT_LABELS[previousPayment] || previousPayment} → ${PAYMENT_LABELS[nextPayment]}`
        );
      }
    }

    if (data.expectedDeliveryDate !== undefined) {
      const nextDate = parseOptionalDate(data.expectedDeliveryDate, 'Voraussichtliche Lieferung ist kein gültiges Datum.');
      const previousTime = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).getTime() : null;
      const nextTime = nextDate ? nextDate.getTime() : null;
      if (previousTime !== nextTime) {
        order.expectedDeliveryDate = nextDate || undefined;
        pushTimeline(
          'delivery_date_updated',
          nextDate
            ? `Voraussichtliche Lieferung: ${formatDateDe(nextDate)}`
            : 'Voraussichtliche Lieferung entfernt'
        );
      }
    }

    if (data.notes !== undefined) {
      const nextNotes = data.notes === null ? '' : String(data.notes);
      if (nextNotes !== (order.notes || '')) {
        order.notes = nextNotes;
        pushTimeline('notes_updated', 'Notiz geändert');
      }
    }

    if (data.tax !== undefined) {
      const tax = Number(data.tax);
      if (!Number.isFinite(tax) || tax < 0) {
        throw httpError(400, 'MwSt.-Betrag muss 0 oder größer sein.');
      }
      order.tax = tax;
      order.totalCost = this.roundTo(order.subtotal + order.tax + order.shippingCost, 4);
    }

    if (data.shippingCost !== undefined) {
      const shippingInput = Number(data.shippingCost);
      if (!Number.isFinite(shippingInput) || shippingInput < 0) {
        throw httpError(400, 'Versandkosten müssen 0 oder größer sein.');
      }
      const allocation = this.allocateShippingProportionally(
        order.items.map((item) => ({
          ...item.toObject(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          additionalCost: item.additionalCost || 0,
        })),
        shippingInput
      );

      order.items.forEach((item, index) => {
        const allocated = allocation.items[index];
        item.shippingShare = allocated.shippingShare;
        item.adjustedLineTotal = allocated.adjustedLineTotal;
        item.adjustedUnitPrice = allocated.adjustedUnitPrice;
        item.totalPrice = allocated.totalPrice;
      });

      order.shippingCost = allocation.shippingCost;
      order.subtotal = allocation.subtotal;
      order.totalCost = this.roundTo(order.subtotal + order.tax + order.shippingCost, 4);
    }

    await this.saveGuarded(order);

    return await this.getEPartOrderById(orderId);
  }

  /**
   * save() mit optionalem $where-Guard; gleichzeitige Aenderungen -> deutsches 409.
   */
  static async saveGuarded(order) {
    try {
      await order.save();
    } catch (error) {
      if (error && (error.name === 'DocumentNotFoundError' || error.name === 'VersionError')) {
        throw httpError(409, 'Die Bestellung wurde inzwischen geändert. Bitte neu laden und erneut versuchen.');
      }
      throw error;
    }
  }

  /**
   * Wareneingang buchen (voll oder teilweise).
   * - nur fuer Bestellt / Versendet / Teilweise erhalten
   * - je Position ganze Zahl 0 < Menge <= offene Menge (keine Mehrbuchung)
   * - Positionen mit Menge 0 werden ignoriert; leere Buchung -> 400
   * - zuerst atomares, bedingtes Update der Bestellung (erwartete receivedQuantity),
   *   erst danach Lagerbestand erhoehen -> Doppelklick/Retry bucht nicht doppelt (409).
   */
  static async receiveOrderItems(orderId, itemsToReceive, userId) {
    const order = await this.loadOrderOrFail(orderId);

    if (!RECEIVABLE_STATUSES.includes(order.status)) {
      throw httpError(400, 'Wareneingang ist nur für Bestellungen mit Status „Bestellt“, „Versendet“ oder „Teilweise erhalten“ möglich.');
    }

    const requested = Array.isArray(itemsToReceive) ? itemsToReceive : [];
    const lines = [];
    const seenItems = new Set();
    for (const receivedItem of requested) {
      const quantity = Number(receivedItem && receivedItem.quantity);
      if (receivedItem && (receivedItem.quantity === 0 || receivedItem.quantity === '0')) {
        continue;
      }
      const itemId = receivedItem && receivedItem.itemId ? String(receivedItem.itemId) : '';
      const orderItem = isValidObjectId(itemId) ? order.items.id(itemId) : null;
      if (!orderItem) {
        throw httpError(400, 'Position nicht in dieser Bestellung gefunden.');
      }
      if (seenItems.has(itemId)) {
        throw httpError(400, `„${orderItem.partName}“ ist mehrfach angegeben.`);
      }
      seenItems.add(itemId);
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw httpError(400, `Menge für „${orderItem.partName}“ muss eine ganze Zahl sein.`);
      }
      if (quantity === 0) continue;
      const alreadyReceived = Math.max(0, Number(orderItem.receivedQuantity) || 0);
      const remaining = Math.max(0, Number(orderItem.quantity) - alreadyReceived);
      if (quantity > remaining) {
        throw httpError(400, `Für „${orderItem.partName}“ sind nur noch ${remaining} Stück offen.`);
      }
      lines.push({ itemId: orderItem._id, partId: orderItem.partId, partName: orderItem.partName, quantity, expected: alreadyReceived, ordered: Number(orderItem.quantity) });
    }

    if (lines.length === 0) {
      throw httpError(400, 'Bitte für mindestens eine Position eine Menge größer 0 eingeben.');
    }

    // Lagerziel (Teil + Version) VOR dem Claim bestimmen, damit nichts halb gebucht wird.
    // Positionen ohne vorhandenes Lagerteil werden wie bisher ohne Bestandsbuchung erfasst.
    for (const line of lines) {
      line.inventoryId = null;
      line.versionId = null;
      if (!isValidObjectId(line.partId)) continue;
      const inventoryPart = await Inventory.findById(line.partId).select('versions').lean();
      if (!inventoryPart) continue;
      const targetVersion = this.getSafeVersionForAllocation(inventoryPart, line.quantity)
        || (Array.isArray(inventoryPart.versions) ? inventoryPart.versions[0] : null);
      if (targetVersion && targetVersion._id) {
        line.inventoryId = inventoryPart._id;
        line.versionId = targetVersion._id;
      }
    }

    // Atomarer Claim: nur wenn alle betroffenen Positionen noch den gelesenen Stand haben.
    // Der Verlaufseintrag wird im selben Update geschrieben (kein spaeteres save(), das scheitern kann).
    const now = new Date();
    const timelineEntryId = new mongoose.Types.ObjectId();
    const filter = {
      _id: order._id,
      status: { $in: RECEIVABLE_STATUSES },
      $and: lines.map((line) => ({
        items: {
          $elemMatch: {
            _id: line.itemId,
            // Altdaten ohne Feld receivedQuantity zaehlen als 0.
            receivedQuantity: line.expected === 0 ? { $in: [0, null] } : line.expected
          }
        }
      }))
    };
    const $inc = {};
    const arrayFilters = [];
    lines.forEach((line, index) => {
      $inc[`items.$[r${index}].receivedQuantity`] = line.quantity;
      arrayFilters.push({ [`r${index}._id`]: line.itemId });
    });
    const claimed = await EPartOrder.findOneAndUpdate(
      filter,
      {
        $inc,
        $push: {
          timeline: {
            _id: timelineEntryId,
            status: 'items_received',
            description: `Wareneingang gebucht: ${lines.map((line) => `${line.quantity} × ${line.partName} (offen danach: ${line.ordered - line.expected - line.quantity})`).join(', ')}`,
            completedAt: now,
            userId: userId
          }
        }
      },
      { new: true, arrayFilters }
    );
    if (!claimed) {
      throw httpError(409, 'Die Bestellung wurde inzwischen geändert (z. B. Wareneingang bereits gebucht). Bitte neu laden und erneut prüfen.');
    }

    // Lagerbestand erst nach erfolgreichem Claim erhoehen: atomares $inc ohne Validierung des
    // gesamten Lagerdokuments (Altdaten mit fehlenden Pflichtfeldern blockieren die Buchung nicht).
    const bookedStock = [];
    let stockFailure = null;
    for (const line of lines) {
      if (!line.inventoryId || !line.versionId) continue;
      try {
        const updatedPart = await Inventory.findOneAndUpdate(
          { _id: line.inventoryId, 'versions._id': line.versionId },
          { $inc: { 'versions.$.quantity': line.quantity } },
          { new: true }
        ).select('versions').lean();
        if (!updatedPart) {
          stockFailure = line;
          break;
        }
        bookedStock.push(line);
        const version = (updatedPart.versions || []).find((entry) => String(entry._id) === String(line.versionId));
        if (version) {
          const minStock = Number(version.minStockLevel);
          await Inventory.updateOne(
            { _id: line.inventoryId, 'versions._id': line.versionId },
            { $set: { 'versions.$.lowStockAlert': Number(version.quantity) <= (Number.isFinite(minStock) ? minStock : 0) } }
          );
        }
      } catch (error) {
        console.error('EPart Wareneingang: Lagerbuchung fehlgeschlagen', error && error.message);
        stockFailure = line;
        break;
      }
    }

    if (stockFailure) {
      // Kompensation: bereits gebuchte Bestaende und den Claim dieser Anfrage zuruecknehmen.
      for (const line of bookedStock) {
        await Inventory.updateOne(
          { _id: line.inventoryId, 'versions._id': line.versionId },
          { $inc: { 'versions.$.quantity': -line.quantity } }
        ).catch((error) => console.error('EPart Wareneingang: Rueckbuchung Lager fehlgeschlagen', error && error.message));
      }
      const undoInc = {};
      lines.forEach((line, index) => {
        undoInc[`items.$[r${index}].receivedQuantity`] = -line.quantity;
      });
      await EPartOrder.updateOne(
        { _id: order._id },
        { $inc: undoInc, $pull: { timeline: { _id: timelineEntryId } } },
        { arrayFilters }
      );
      await this.finalizeReceiptStatus(order._id, userId);
      throw httpError(409, `Der Lagerbestand für „${stockFailure.partName}“ konnte nicht erhöht werden. Der Wareneingang wurde nicht gebucht. Bitte neu laden und erneut versuchen.`);
    }

    await this.finalizeReceiptStatus(order._id, userId);

    return await this.getEPartOrderById(orderId);
  }

  /**
   * Positions- und Bestellstatus aus dem aktuellen DB-Stand ableiten und bedingt schreiben.
   * Wiederholt bei gleichzeitigen Wareneingaengen (Guard auf alle receivedQuantity-Werte und den
   * gelesenen Status), damit die zuletzt abschliessende Anfrage immer alle Buchungen sieht.
   * Die Bedarfslisten-Zuweisung laeuft genau einmal: beim Uebergang nach "Erhalten".
   */
  static async finalizeReceiptStatus(orderId, userId, maxAttempts = 6) {
    const FINALIZABLE = [...RECEIVABLE_STATUSES, 'received'];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await EPartOrder.findById(orderId).lean();
      if (!current || !FINALIZABLE.includes(current.status)) return;

      const items = Array.isArray(current.items) ? current.items : [];
      let allItemsReceived = true;
      let anyReceived = false;
      const nextItemStatuses = items.map((item) => {
        if (item.status === 'cancelled') return 'cancelled';
        const received = Math.max(0, Number(item.receivedQuantity) || 0);
        if (received > 0) anyReceived = true;
        if (received >= Number(item.quantity)) return 'received';
        allItemsReceived = false;
        return received > 0 ? 'partial' : 'pending';
      });
      let nextStatus = current.status;
      if (allItemsReceived && items.length > 0) {
        nextStatus = 'received';
      } else if (anyReceived) {
        nextStatus = 'partial';
      } else if (current.status === 'partial' || current.status === 'received') {
        // nur nach einer Kompensation moeglich: ohne gebuchte Menge zurueck auf "Bestellt"
        nextStatus = 'confirmed';
      }

      const itemsUnchanged = items.every((item, index) => (item.status || 'pending') === nextItemStatuses[index]);
      if (itemsUnchanged && nextStatus === current.status) return;

      const $set = { status: nextStatus };
      const arrayFilters = [];
      items.forEach((item, index) => {
        if ((item.status || 'pending') !== nextItemStatuses[index]) {
          $set[`items.$[s${index}].status`] = nextItemStatuses[index];
          arrayFilters.push({ [`s${index}._id`]: item._id });
        }
      });
      const becameReceived = nextStatus === 'received' && current.status !== 'received';
      if (becameReceived) {
        $set.actualDeliveryDate = new Date();
        if (userId) $set.receivedBy = userId;
      }

      const guard = {
        _id: current._id,
        status: current.status,
        items: { $size: items.length }
      };
      if (items.length > 0) {
        guard.$and = items.map((item) => ({
          items: { $elemMatch: { _id: item._id, receivedQuantity: item.receivedQuantity == null ? null : item.receivedQuantity } }
        }));
      }
      const result = await EPartOrder.updateOne(guard, { $set }, arrayFilters.length ? { arrayFilters } : {});
      if (result && result.modifiedCount > 0) {
        if (becameReceived) {
          const fresh = await EPartOrder.findById(orderId);
          if (fresh) await this.autoAssignConvertedNeedListOrderItems(fresh, userId);
        }
        return;
      }
      // Gleichzeitige Aenderung -> neu lesen und erneut ableiten.
    }
    console.warn(`EPart Wareneingang: Status von ${orderId} konnte nach ${maxAttempts} Versuchen nicht abgeleitet werden (gleichzeitige Buchungen).`);
  }

  /**
   * Cancel epart order
   */
  static async cancelEPartOrder(orderId, reason, userId) {
    const order = await this.loadOrderOrFail(orderId);

    if (order.status === 'received') {
      throw httpError(400, 'Eine vollständig erhaltene Bestellung kann nicht storniert werden.');
    }
    if (order.status === 'cancelled') {
      throw httpError(400, 'Die Bestellung ist bereits storniert.');
    }

    order.$where = { status: order.status };
    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      description: 'Bestellung storniert',
      completedAt: new Date(),
      userId: userId,
      notes: reason
    });

    // Mark all items as cancelled
    order.items.forEach(item => {
      if (item.status !== 'received') {
        item.status = 'cancelled';
      }
    });

    await this.saveGuarded(order);
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Upload invoice file for order
   */
  static async uploadInvoice(orderId, fileInfo, userId) {
    const order = await this.loadOrderOrFail(orderId);

    order.invoiceFile = {
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      mimetype: fileInfo.mimetype,
      size: fileInfo.size,
      uploadedAt: new Date(),
      uploadedBy: userId
    };

    order.timeline.push({
      status: 'invoice_uploaded',
      description: `Rechnung „${fileInfo.originalName}“ hochgeladen`,
      completedAt: new Date(),
      userId: userId
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Request return or exchange for broken parts
   */
  static async requestReturnExchange(orderId, returnData, userId) {
    const order = await this.loadOrderOrFail(orderId);

    if (order.status === 'cancelled') {
      throw httpError(400, 'Für eine stornierte Bestellung kann keine Rücksendung/kein Umtausch angefordert werden.');
    }

    // Validate affected items exist in the order
    for (const affectedItem of returnData.affectedItems) {
      const orderItem = order.items.id(affectedItem.itemId);
      if (!orderItem) {
        throw httpError(400, 'Position nicht in dieser Bestellung gefunden.');
      }
      if (affectedItem.quantity > orderItem.receivedQuantity) {
        throw httpError(400, `Für „${orderItem.partName}“ kann höchstens die erhaltene Menge zurückgesendet/umgetauscht werden.`);
      }
    }

    order.returnExchange = {
      status: 'requested',
      type: returnData.type,
      reason: returnData.reason,
      description: returnData.description,
      requestedAt: new Date(),
      requestedBy: userId,
      affectedItems: returnData.affectedItems
    };

    order.timeline.push({
      status: 'return_exchange_requested',
      description: `${returnData.type === 'return' ? 'Rücksendung' : 'Umtausch'} angefordert: ${returnData.reason}`,
      completedAt: new Date(),
      userId: userId,
      notes: returnData.description
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Update return/exchange status
   */
  static async updateReturnExchange(orderId, status, notes, userId) {
    const order = await this.loadOrderOrFail(orderId);

    if (!order.returnExchange || order.returnExchange.status === 'none') {
      throw httpError(400, 'Für diese Bestellung gibt es keine Rücksende-/Umtauschanfrage.');
    }

    order.returnExchange.status = status;

    if (status === 'completed' || status === 'rejected') {
      order.returnExchange.resolvedAt = new Date();
      order.returnExchange.resolvedBy = userId;
    }

    if (notes) {
      order.returnExchange.notes = notes;
    }

    // If completed and it was a return, adjust inventory
    if (status === 'completed' && order.returnExchange.type === 'return') {
      for (const affectedItem of order.returnExchange.affectedItems) {
        const orderItem = order.items.id(affectedItem.itemId);
        if (orderItem) {
          // Decrease inventory stock
          await Inventory.findByIdAndUpdate(orderItem.partId, {
            $inc: { quantityInStock: -affectedItem.quantity }
          });
        }
      }
    }

    order.timeline.push({
      status: `return_exchange_${status}`,
      description: `Rücksendung/Umtausch: ${({ requested: 'angefordert', approved: 'genehmigt', in_transit: 'unterwegs', completed: 'abgeschlossen', rejected: 'abgelehnt', none: 'keine' })[status] || status}`,
      completedAt: new Date(),
      userId: userId,
      notes: notes
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Get order statistics
   */
  static async getOrderStatistics(filters = {}) {
    const query = {};

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) {
        query.orderDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.orderDate.$lte = new Date(filters.endDate);
      }
    }

    // Total orders
    const totalOrders = await EPartOrder.countDocuments(query);

    // Bestellwert gesamt (brutto) OHNE stornierte Bestellungen
    const totalSpentResult = await EPartOrder.aggregate([
      { $match: { ...query, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalCost' } } }
    ]);
    const totalSpent = totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

    // Orders by status
    const ordersByStatusResult = await EPartOrder.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const ordersByStatus = {};
    ordersByStatusResult.forEach(item => {
      ordersByStatus[item._id] = item.count;
    });

    // Top suppliers (ohne Stornos)
    const topSuppliersResult = await EPartOrder.aggregate([
      { $match: { ...query, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$supplierId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$totalCost' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          supplierId: '$_id',
          supplierName: '$supplier.name',
          orderCount: 1,
          totalSpent: 1
        }
      }
    ]);

    return {
      totalOrders,
      totalSpent,
      totalSpentExcludesCancelled: true,
      ordersByStatus,
      topSuppliers: topSuppliersResult
    };
  }
}

EPartOrderService.STATUS_LABELS = STATUS_LABELS;
EPartOrderService.PAYMENT_LABELS = PAYMENT_LABELS;
EPartOrderService.MANUAL_STATUSES = MANUAL_STATUSES;
EPartOrderService.RECEIVABLE_STATUSES = RECEIVABLE_STATUSES;

module.exports = EPartOrderService;
