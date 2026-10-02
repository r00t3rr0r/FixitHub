const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const FinancialService = require('./financialService');
const OrderService = require('./orderService');
const OrderRevisionService = require('./orderRevisionService');
const ServiceService = require('./serviceService');
const CalculationHelper = require('./calculationHelper');
const OrderHistory = require('../utils/orderHistory');

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (typeof value === 'object') {
    // ObjectId ZUERST pruefen: ein Mongoose-ObjectId liefert auf `_id` sich selbst
    // zurueck. Stand die _id-Verzweigung vorne, rief sich die Funktion endlos selbst
    // auf ("Maximum call stack size exceeded") und jede Positionsbearbeitung am
    // Auftrag brach ab. Gleiche Reihenfolge wie in financialService/paymentService.
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    if (value._id != null && value._id !== value) return toIdString(value._id);
    if (value.id != null && value.id !== value) return toIdString(value.id);
    return '';
  }
  return String(value).trim();
};

// Fehler mit HTTP-Status und deutscher Meldung (die Route reicht sie unveraendert an
// die Oberflaeche weiter).
const buildError = (message, statusCode = 400, code = 'ORDER_SERVICE_INVALID') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Gemeinsame de-DE-Formatierung (mit Tausenderpunkt), wie im restlichen Verlauf.
const formatEuro = (value) => require('../utils/money').formatEuroDe(CalculationHelper.round(value)); // eslint-disable-line global-require

const toMoney = (value, label) => {
  const numeric = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw buildError(`${label} muss eine Zahl größer oder gleich 0 sein.`, 400, 'INVALID_PRICE');
  }
  return CalculationHelper.round(numeric);
};

// Anzeigename einer Position fuer Historie/Meldungen: Namens-Snapshot, sonst (Altdaten
// ohne Snapshot) der Katalogname.
const resolveLineName = async (line) => {
  if (!line) return 'Reparaturservice';
  if (line.name) return line.name;
  if (line.serviceId && typeof line.serviceId === 'object' && line.serviceId.name) return line.serviceId.name;
  const serviceId = toIdString(line.serviceId);
  if (serviceId) {
    const service = await Service.findById(serviceId).select('name').lean().catch(() => null);
    if (service?.name) return service.name;
  }
  return 'Reparaturservice';
};

class OrderServiceManagementService {
  /**
   * Get all services for an order (populated with full details)
   * @param {string} orderId - Order ID
   * @returns {Promise<Array>} Array of services with full details
   */
  static async getOrderServices(orderId) {
    const { services } = await OrderServiceManagementService.getOrderServicesWithPricing(orderId);
    return services;
  }

  /**
   * Get all services for an order together with the order's money breakdown.
   *
   * The stored `services[].price` is the GROSS LIST price of the position; the
   * customer/dealer discount is only taken off the aggregate `order.totalCost`. The
   * `pricing` block carries that reconciliation (Zwischensumme / Rabatt (in % und
   * EUR) / Netto / MwSt. / Brutto) plus the time-bound conditions snapshot.
   *
   * @param {string} orderId - Order ID
   * @returns {Promise<{ services: Array, pricing: Object, order: Object }>}
   */
  static async getOrderServicesWithPricing(orderId) {
    try {
      const order = await Order.findById(orderId).populate({
        path: 'services.serviceId',
        model: Service,
      });

      if (!order) {
        throw buildError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }

      // Old format (array of strings) is not a position object - skip it.
      const services = (order.services || []).filter((s) => typeof s !== 'string');

      const pricing = OrderService.buildOrderPricingSummary({
        services: services.map((s) => ({ price: s.price })),
        addOns: order.addOns,
        shopProducts: order.shopProducts,
        totalCost: order.totalCost,
        discount: order.discount,
        appliedPromoCode: order.appliedPromoCode,
        pricingConditions: order.pricingConditions,
        createdAt: order.createdAt,
        dealerDiscountPercent: order.dealerDiscountPercent,
        dealerDiscountAmount: order.dealerDiscountAmount,
        taxRate: order.taxRate
      }, { defaultTaxRate: await OrderService.resolveDefaultTaxRate(order) });

      console.log(`[OrderServiceManagement] Retrieved ${services.length} services for order ${orderId}`);
      return { services, pricing, order };
    } catch (error) {
      console.error(`[OrderServiceManagement] Error getting order services: ${error.message}`);
      throw error;
    }
  }

  /**
   * Alle aktiven Katalogservices, die zum AKTUELLEN Geraet des Auftrags passen
   * (Backend-Filter, vollstaendig, ohne Seitenbegrenzung).
   */
  static async getAvailableServicesForOrder(orderId) {
    const order = await Order.findById(orderId)
      .setOptions({ skipAutoPopulate: true })
      .select('deviceBrand deviceModel deviceType')
      .lean();
    if (!order) {
      throw buildError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
    }
    const services = await ServiceService.findServicesForDevice({
      deviceType: order.deviceType,
      deviceBrand: order.deviceBrand,
      deviceModel: order.deviceModel,
    });
    return {
      device: { brand: order.deviceBrand, model: order.deviceModel, type: order.deviceType },
      services,
    };
  }

  static async loadOrderForEdit(orderId) {
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
    if (!order) {
      throw buildError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
    }
    // Old format (array of strings) cannot be priced - drop it before editing.
    if (Array.isArray(order.services) && order.services.some((s) => typeof s === 'string')) {
      order.services = order.services.filter((s) => typeof s !== 'string');
    }
    return order;
  }

  static async resolveActor(actorId) {
    const id = toIdString(actorId);
    if (!id) return { id: undefined, name: 'System' };
    const user = await User.findById(id).select('name firstName lastName').lean();
    const name = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mitarbeiter';
    return { id, name };
  }

  static findLine(order, orderServiceId) {
    const index = (order.services || []).findIndex((s) => s && s._id && s._id.toString() === String(orderServiceId));
    if (index === -1) {
      throw buildError('Die Reparaturposition wurde in diesem Auftrag nicht gefunden.', 404, 'ORDER_SERVICE_NOT_FOUND');
    }
    return index;
  }

  /**
   * Finanzabgleich (Buchung, Rechnung, Zahlungen). Er laeuft NACH dem atomaren
   * Speichern des Auftrags; ein Fehler wird nicht verschluckt, sondern als sichtbare
   * Warnung zurueckgegeben. Der Abgleich rechnet aus dem gespeicherten Auftragswert
   * neu und ist wiederholbar, ohne doppelte Finanzbelege zu erzeugen
   * (FinancialService.syncOrderAndBookingValue; manuell ueber
   * POST /api/financial/bookings/:id/sync mit { type: 'order' }).
   */
  static async syncFinancials(order) {
    try {
      const result = await FinancialService.syncOrderAndBookingValue(order._id, 'order');
      if (result && result.ok === false) {
        throw new Error(result.error || result.message || 'unbekannter Fehler');
      }
      return { ok: true };
    } catch (error) {
      console.error(`[OrderServiceManagement] Financial sync failed for order ${order._id}: ${error.message}`);
      return {
        ok: false,
        message: 'Die Position wurde gespeichert, der Abgleich mit Buchung/Rechnung ist jedoch fehlgeschlagen. '
          + 'Bitte den Finanzabgleich für diesen Auftrag erneut ausführen.',
      };
    }
  }

  static async notifyCustomer(order, message) {
    try {
      await OrderService.notifyCustomerOrderUpdate(order, message);
    } catch (notifError) {
      console.warn(`[OrderServiceManagement] Failed to send notification: ${notifError.message}`);
    }
  }

  // Historieneintrag. Die Revisionsnummer wird ueber countDocuments vergeben
  // (OrderRevisionService); bei gleichzeitigen Bearbeitungen kann die eindeutige
  // Nummer (orderId + revisionNumber) kollidieren - dann mit frischer Zaehlung
  // wiederholen, statt den Eintrag zu verlieren.
  static async recordRevisionWithRetry(order, payload, attempts = 3) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const revision = await OrderRevisionService.recordRevision(order, payload);
      if (revision) return revision;
      await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 25)));
    }
    return null;
  }

  /**
   * Gemeinsamer Ablauf JEDER Positionsbearbeitung (konfliktsicher):
   *  1. Auftrag laden, Kondition VOR der Aenderung bestimmen (nicht aufgehende
   *     Auftraege nur nach Bestaetigung, siehe OrderService.getPricingConditionsForEdit)
   *  2. Aenderung anwenden (applyChange) und DIE Preisregel anwenden
   *  3. bedingt speichern (nur wenn der Auftrag seit dem Laden unveraendert ist) -
   *     sonst auf dem frischen Stand wiederholen (OrderService.runGuardedOrderEdit)
   *  4. Historie: wer, wann, vorher/nachher, Grund
   *  5. Finanzabgleich - Fehler werden als Warnung sichtbar gemacht
   *  6. Kunde benachrichtigen
   *
   * applyChange(order) wendet die Aenderung an und liefert
   *   { priced: boolean, action: string, customerMessage?: string, logLine?: string }.
   * priced=false (z. B. nur Notiz geaendert): kein Neu-Rechnen, kein Finanzabgleich.
   */
  static async commitOrderEdit(orderId, {
    applyChange,
    triggerReason,
    actorId,
    reason,
    confirmRepricing,
    pricedDefault = true,
  }) {
    const actor = await OrderServiceManagementService.resolveActor(actorId);

    const { order, context } = await OrderService.runGuardedOrderEdit(
      orderId,
      async (freshOrder) => {
        const previousGross = CalculationHelper.round(freshOrder.totalCost);
        // Kondition und Abgleich auf dem Stand VOR der Aenderung.
        let edit = null;
        const ensureEdit = () => {
          if (!edit) {
            edit = OrderService.getPricingConditionsForEdit(freshOrder, { confirmRepricing });
          }
          return edit;
        };
        if (pricedDefault) ensureEdit();

        const change = await applyChange(freshOrder, { ensurePricing: ensureEdit });
        const priced = change && change.priced !== undefined ? change.priced : pricedDefault;
        if (priced) {
          const { conditions } = ensureEdit();
          OrderService.applyOrderPricing(freshOrder, conditions);
        }

        // Verlaufseintrag im SELBEN bedingten Speichervorgang wie Position und Auftragswert
        // (HIST-3/HIST-5a). Die Revision (Finanz-Snapshot) folgt nach dem Speichern und wird
        // ueber den eventKey verknuepft (refs.revisionId), damit der Verlauf sie nicht doppelt zeigt.
        let historyEventKey = null;
        // Nur echte Aenderungen erzeugen einen Eintrag: ein erneut gesendeter oder parallel
        // doppelt gesendeter Stand (Preis bereits gesetzt) bleibt ohne Eintrag, auch mit Grund
        // (HIST-6/HIST-3). Ein Grund allein ist keine Aenderung.
        const wantsHistory = priced || (change && change.recordHistory === true);
        if (wantsHistory) {
          historyEventKey = OrderService.newEditEventKey();
          const structuredChanges = [
            ...(Array.isArray(change?.historyChanges) ? change.historyChanges : []),
            ...(priced ? [{ field: 'totalCost', label: 'Auftragswert', from: previousGross, to: CalculationHelper.round(freshOrder.totalCost) }] : []),
          ];
          const onlyPrice = structuredChanges.length > 0
            && structuredChanges.every((item) => /price|totalCost/.test(item.field));
          OrderHistory.push(freshOrder, OrderHistory.entry({
            key: 'Order Services Changed',
            type: triggerReason === 'service_updated' && onlyPrice ? 'pricing' : 'services',
            description: change?.action || 'Leistungen geändert',
            actor,
            source: 'Leistungen bearbeiten',
            changes: structuredChanges,
            reason,
            eventKey: historyEventKey,
            force: true,
          }));
        }
        return {
          ...change,
          priced,
          previousGross,
          historyEventKey,
          reconciliation: edit ? edit.reconciliation : null,
        };
      },
      { load: () => OrderServiceManagementService.loadOrderForEdit(orderId) }
    );

    const warnings = [];
    const hasHistoryEntry = Boolean(context.historyEventKey);
    if (hasHistoryEntry) {
      const revision = await OrderServiceManagementService.recordRevisionWithRetry(order, {
        triggerReason,
        previousGrossAmount: context.previousGross,
        changedBy: actor.id,
        changedByName: actor.name,
        notes: [
          OrderServiceManagementService.buildRevisionNotes(context.action, {
            reason,
            before: context.priced ? context.previousGross : null,
            after: context.priced ? order.totalCost : null,
          }),
          OrderService.describeConfirmedRepricing(context.reconciliation),
        ].filter(Boolean).join(' | '),
      });
      if (!revision) {
        warnings.push('Die Änderung wurde gespeichert und im Verlauf protokolliert, der Änderungsbeleg (Revision) konnte jedoch nicht angelegt werden.');
      } else {
        await OrderService.linkRevisionToHistory(order._id, context.historyEventKey, revision);
      }
    }

    let financialSync = { ok: true, skipped: true };
    if (context.priced) {
      financialSync = await OrderServiceManagementService.syncFinancials(order);
      if (!financialSync.ok) {
        warnings.push(financialSync.message);
      }
      if (context.customerMessage) {
        await OrderServiceManagementService.notifyCustomer(order, context.customerMessage);
      }
    }

    if (context.logLine) {
      console.log(`[OrderServiceManagement] ${context.logLine} Order value: ${order.totalCost}`);
    }

    return {
      order,
      pricing: OrderService.buildOrderPricingSummary(order, {
        defaultTaxRate: await OrderService.resolveDefaultTaxRate(order),
      }),
      warnings,
      financialSync,
    };
  }

  static buildRevisionNotes(action, { reason, before, after }) {
    const parts = [action];
    if (before != null && after != null) {
      parts.push(`Auftragswert ${formatEuro(before)} → ${formatEuro(after)}`);
    }
    if (reason) parts.push(`Grund: ${reason}`);
    return parts.join(' | ');
  }

  /**
   * Update an existing service in an order
   * @param {string} orderId - Order ID
   * @param {string} serviceId - the _id of the position in order.services
   * @param {Object} updateData - { price?, estimatedTime?, notes?, name?, description?, actorId?, reason?,
   *   confirmRepricing? }
   *   price ist der LISTEN-Bruttopreis (Standardpreis) der Position; der Kunden-/
   *   Haendlerrabatt wird auf Auftragsebene abgezogen, nie in der Position.
   *   confirmRepricing: ausdrueckliche Bestaetigung, einen Auftrag neu zu berechnen,
   *   dessen gespeicherter Wert nicht zu den Positionen passt (sonst 409
   *   ORDER_VALUE_NOT_RECONCILED).
   * @returns {Promise<{ order, pricing, warnings, financialSync }>}
   */
  static async updateOrderService(orderId, serviceId, updateData = {}) {
    try {
      // Eingaben VOR dem Laden pruefen - ein Validierungsfehler speichert nichts.
      const hasPrice = updateData.price !== undefined && updateData.price !== null && updateData.price !== '';
      const newPriceInput = hasPrice ? toMoney(updateData.price, 'Der Standardpreis') : null;

      const result = await OrderServiceManagementService.commitOrderEdit(orderId, {
        triggerReason: 'service_updated',
        actorId: updateData.actorId,
        reason: updateData.reason,
        confirmRepricing: updateData.confirmRepricing,
        pricedDefault: false,
        applyChange: async (order, { ensurePricing }) => {
          const serviceIndex = OrderServiceManagementService.findLine(order, serviceId);
          const line = order.services[serviceIndex];
          const previousPrice = CalculationHelper.round(line.price);
          const changes = [];
          const historyChanges = [];
          const previousName = await resolveLineName(line);

          const priceChanged = newPriceInput !== null && newPriceInput !== previousPrice;
          if (priceChanged) {
            // Abgleich/Kondition auf dem Stand VOR der Preisaenderung (wirft ggf. 409).
            ensurePricing();
            line.price = newPriceInput;
            changes.push(`Standardpreis ${formatEuro(previousPrice)} → ${formatEuro(newPriceInput)}`);
            historyChanges.push({ field: 'services.price', label: `Standardpreis „${previousName}“`, from: previousPrice, to: newPriceInput });
          }

          if (updateData.estimatedTime !== undefined && updateData.estimatedTime !== null && updateData.estimatedTime !== '') {
            const minutes = OrderService.parseEstimatedMinutes(
              typeof updateData.estimatedTime === 'number' ? updateData.estimatedTime : String(updateData.estimatedTime)
            );
            if (minutes !== Number(line.estimatedTime)) {
              changes.push(`Zeit ${Number(line.estimatedTime) || 0} → ${minutes} Min.`);
              historyChanges.push({ field: 'services.estimatedTime', label: `Zeit „${previousName}“ (Min.)`, from: Number(line.estimatedTime) || 0, to: minutes });
              line.estimatedTime = minutes;
            }
          }

          if (updateData.notes !== undefined) {
            const nextNotes = String(updateData.notes || '');
            if (nextNotes !== String(line.notes || '')) {
              changes.push('Notiz geändert');
              historyChanges.push({ field: 'services.notes', label: `Notiz „${previousName}“`, from: String(line.notes || ''), to: nextNotes });
            }
            line.notes = nextNotes;
          }

          if (line.isManual === true) {
            if (updateData.name !== undefined) {
              const name = String(updateData.name || '').trim();
              if (!name) {
                throw buildError('Bitte geben Sie einen Namen für die manuelle Reparaturposition an.', 400, 'MANUAL_NAME_REQUIRED');
              }
              if (name !== line.name) {
                changes.push(`Name „${line.name}“ → „${name}“`);
                historyChanges.push({ field: 'services.name', label: 'Name der Position', from: line.name, to: name });
                line.name = name;
              }
            }
            if (updateData.description !== undefined) {
              line.description = String(updateData.description || '');
            }
          }

          const name = await resolveLineName(line);
          return {
            // Keine Geldaenderung: Auftragswert bleibt unangetastet (kein Neu-Runden
            // eines aus dem Checkout uebernommenen Werts, kein Finanzabgleich).
            priced: priceChanged,
            recordHistory: changes.length > 0,
            historyChanges,
            action: `Position „${name}“ geändert${changes.length ? `: ${changes.join(', ')}` : ''}`,
            customerMessage: `Ein Reparaturservice in Ihrem Auftrag #${order.orderNumber} wurde aktualisiert.`,
            logLine: `Service ${serviceId} updated in order ${orderId}. List price: ${line.price}.`,
          };
        },
      });
      return result;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error updating order service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a new service to an order - a catalogue service or a MANUAL repair line.
   * @param {string} orderId - Order ID
   * @param {string|null} serviceId - catalogue Service ID (null for a manual line)
   * @param {Object} options - { price?, estimatedTime?, notes?, isManual?, name?, description?, actorId?, reason?,
   *   confirmRepricing? }
   *   price ist der LISTEN-Bruttopreis (Standardpreis). Kunden-/Haendlerkonditionen
   *   greifen automatisch auf Auftragsebene - auch fuer manuelle Positionen.
   * @returns {Promise<{ order, pricing, warnings, financialSync }>}
   */
  static async addServiceToOrder(orderId, serviceId, options = {}) {
    try {
      const isManualLine = options.isManual === true && !toIdString(serviceId);
      let manualLine = null;
      let service = null;

      // Eingaben und Katalogservice EINMAL vor dem (ggf. wiederholten) Speichern pruefen.
      if (isManualLine) {
        const name = String(options.name || '').trim();
        if (!name) {
          throw buildError('Bitte geben Sie einen Namen für die manuelle Reparaturposition an.', 400, 'MANUAL_NAME_REQUIRED');
        }
        if (options.price === undefined || options.price === null || options.price === '') {
          throw buildError('Bitte geben Sie den Standardpreis (brutto) der manuellen Position an.', 400, 'MANUAL_PRICE_REQUIRED');
        }
        // Bewusst KEINE Katalog-ID - es wird keine ObjectId erfunden.
        manualLine = {
          isManual: true,
          name,
          description: String(options.description || ''),
          price: toMoney(options.price, 'Der Standardpreis'),
          estimatedTime: OrderService.parseEstimatedMinutes(options.estimatedTime),
          notes: String(options.notes || ''),
        };
      } else {
        const catalogId = toIdString(serviceId);
        if (!catalogId) {
          throw buildError('Bitte wählen Sie einen Reparaturservice aus.', 400, 'SERVICE_REQUIRED');
        }
        service = await Service.findById(catalogId).catch(() => null);
        if (!service) {
          throw buildError('Der ausgewählte Reparaturservice wurde nicht gefunden.', 404, 'SERVICE_NOT_FOUND');
        }
      }
      const catalogPrice = !isManualLine && options.price !== undefined && options.price !== null && options.price !== ''
        ? toMoney(options.price, 'Der Standardpreis')
        : null;

      let addedLine = null;
      const result = await OrderServiceManagementService.commitOrderEdit(orderId, {
        triggerReason: 'scope_change',
        actorId: options.actorId,
        reason: options.reason,
        confirmRepricing: options.confirmRepricing,
        applyChange: async (order) => {
          let newLine;
          if (isManualLine) {
            newLine = { ...manualLine };
          } else {
            // Der Service muss zum TATSAECHLICHEN Geraet des Auftrags passen (T03).
            const match = await ServiceService.checkServiceForDevice(service, {
              deviceType: order.deviceType,
              deviceBrand: order.deviceBrand,
              deviceModel: order.deviceModel,
            });
            if (!match.ok) {
              throw buildError(
                ServiceService.describeDeviceMismatch(service, match, `dem Gerät dieses Auftrags (${order.deviceBrand} ${order.deviceModel})`),
                400,
                'SERVICE_DEVICE_MISMATCH'
              );
            }

            // Auf dem (bei Konflikt frisch geladenen) Stand pruefen - so wird ein
            // Doppelklick auch bei gleichzeitigen Anfragen genau einmal gespeichert.
            const catalogId = toIdString(service._id);
            const alreadyAdded = (order.services || []).some((s) => s && s.serviceId && toIdString(s.serviceId) === catalogId);
            if (alreadyAdded) {
              throw buildError(`Der Service „${service.name}“ ist bereits in diesem Auftrag enthalten.`, 409, 'SERVICE_ALREADY_ADDED');
            }

            newLine = {
              serviceId: service._id,
              // Namens-Snapshot: die Position bleibt lesbar, auch wenn der Katalog sich aendert.
              name: service.name || '',
              price: catalogPrice !== null ? catalogPrice : CalculationHelper.round(Number(service.price) || 0),
              estimatedTime: OrderService.parseEstimatedMinutes(
                options.estimatedTime !== undefined && options.estimatedTime !== null && options.estimatedTime !== ''
                  ? options.estimatedTime
                  : service.estimatedTime
              ),
              notes: String(options.notes || ''),
            };
          }

          order.services.push(newLine);
          addedLine = newLine;
          return {
            action: `${newLine.isManual ? 'Manuelle Position' : 'Position'} „${newLine.name}“ hinzugefügt (Standardpreis ${formatEuro(newLine.price)})`,
            customerMessage: `Ein neuer Reparaturservice wurde Ihrem Auftrag #${order.orderNumber} hinzugefügt.`,
            logLine: `${newLine.isManual ? 'Manual line' : `Service ${serviceId}`} added to order ${orderId}. List price: ${newLine.price}.`,
          };
        },
      });

      if (!addedLine) {
        throw buildError('Die Reparaturposition konnte nicht hinzugefügt werden.', 500, 'ORDER_SERVICE_NOT_ADDED');
      }
      return result;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error adding service to order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a service from an order
   * @param {string} orderId - Order ID
   * @param {string} serviceId - the _id of the position in order.services
   * @param {Object} options - { actorId?, reason?, confirmRepricing? }
   * @returns {Promise<{ order, pricing, warnings, financialSync }>}
   */
  static async removeServiceFromOrder(orderId, serviceId, options = {}) {
    try {
      return await OrderServiceManagementService.commitOrderEdit(orderId, {
        triggerReason: 'scope_change',
        actorId: options.actorId,
        reason: options.reason,
        confirmRepricing: options.confirmRepricing,
        applyChange: async (order) => {
          const serviceIndex = OrderServiceManagementService.findLine(order, serviceId);

          if (order.services.length <= 1) {
            throw buildError('Ein Auftrag muss mindestens einen Reparaturservice enthalten.', 409, 'LAST_SERVICE');
          }

          const name = await resolveLineName(order.services[serviceIndex]);
          const [removed] = order.services.splice(serviceIndex, 1);
          return {
            action: `Position „${name}“ entfernt (Standardpreis ${formatEuro(removed?.price)})`,
            customerMessage: `Ein Reparaturservice wurde aus Ihrem Auftrag #${order.orderNumber} entfernt.`,
            logLine: `Service ${serviceId} removed from order ${orderId}.`,
          };
        },
      });
    } catch (error) {
      console.error(`[OrderServiceManagement] Error removing service from order: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OrderServiceManagementService;
