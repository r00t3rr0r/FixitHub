const RepairRequest = require('../models/RepairRequest');
const Order = require('../models/Order');
const User = require('../models/User');
const BookingService = require('./bookingService');
const mongoose = require('mongoose');
const crypto = require('crypto');
const EmailService = require('./emailService');
const RepairRequestCommunicationService = require('./repairRequestCommunicationService');

const { httpError, escapeRegex } = RepairRequestCommunicationService;

// ─────────────────────────────────────────────────────────────────────────────
// Konstanten und Helfer
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  pending: 'Ausstehend',
  reviewing: 'In Prüfung',
  approved: 'Kostenvoranschlag angenommen',
  rejected: 'Abgelehnt',
  converted: 'In Auftrag umgewandelt',
};
const PRIORITY_LABELS = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', urgent: 'Dringend' };
// 'approved' ("Kostenvoranschlag angenommen") setzt ausschliesslich die Annahme durch den Kunden
// (applyQuoteDecision); 'converted' nur die Umwandlung. Beide sind keine manuellen Status.
const MANUAL_STATUSES = ['pending', 'reviewing', 'rejected'];
// Altbestand: früher manuell gesetztes 'approved' ohne angenommenen Kostenvoranschlag.
const APPROVED_WITHOUT_QUOTE_LABEL = 'Freigegeben';
const statusLabelOf = (rr, effectiveQuote) => {
  if (rr?.status === 'approved' && effectiveQuote?.status !== 'accepted') return APPROVED_WITHOUT_QUOTE_LABEL;
  return STATUS_LABELS[rr?.status] || rr?.status;
};
const QUOTE_CHANGED_MESSAGE = 'Der Kostenvoranschlag wurde inzwischen geändert. Bitte Seite neu laden.';

const CATALOG_MODEL_GONE = 'Das gewählte Modell ist nicht mehr in unserem Katalog. Bitte erneut auswählen oder „Mein Gerät ist nicht aufgeführt“ nutzen.';
const MAX_IMAGES = 5;
const MAX_IMAGES_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB (dekodiert) – Dokumentgrenze von MongoDB ist 16 MB
const CONVERSION_LOCK_MS = 10 * 60 * 1000;

const COMPANY = () => process.env.COMPANY_NAME || 'McRepair.de';
const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL || 'support@mcrepair.de';
const SUPPORT_PHONE = () => process.env.SUPPORT_PHONE || '+49 (0) 123/456789';

const trimTo = (value, max) => String(value ?? '').trim().slice(0, max);
const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};
const toDisplayName = (key = '') => String(key)
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

// Deutsches Betragsformat: 89 -> "89,00 €" (gemeinsamer Formatter server/utils/money.js)
const formatEuro = require('../utils/money').formatEuroDe;
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

const actorNameOf = (user) => {
  const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return full || String(user?.name || '').trim() || String(user?.email || '').trim() || 'Mitarbeiter';
};

class RepairRequestService {
  static STATUS_LABELS = STATUS_LABELS;
  static formatEuro = formatEuro;
  static actorNameOf = actorNameOf;
  static formatDeviceLabel = (brand, model) => RepairRequestCommunicationService.formatDeviceLabel(brand, model);
  static buildRepairRequestPath = (rr, audience, role) => RepairRequestCommunicationService.buildRepairRequestPath(rr, audience, role);

  static isStaffUser(user) {
    return ['staff', 'admin'].includes(String(user?.role || '').toLowerCase());
  }

  /**
   * EINE Zugriffsregel für alle Reparaturanfrage-Routen (Anfrage + Kommunikation):
   *  - Personal/Admin: Zugriff; unbekannte/ungültige ID => 404.
   *  - Kunde: nur eigene Anfrage (customerId); fremde, unbekannte oder ungültige ID => 403
   *    (keine Existenzprüfung über 403/404). staffOnly => Kunden immer 403.
   * @returns lean RepairRequest (Grundfelder)
   */
  static async assertAccess(user, repairRequestId, { staffOnly = false } = {}) {
    const staff = this.isStaffUser(user);
    if (!staff && staffOnly) throw httpError('Zugriff verweigert.', 403, 'FORBIDDEN');
    const valid = mongoose.Types.ObjectId.isValid(String(repairRequestId || ''));
    const rr = valid
      ? await RepairRequest.findById(repairRequestId)
        .select('_id requestNumber customerId customerName customerEmail isGuest guestTrackingToken assignedStaffId status')
        .lean()
      : null;
    if (staff) {
      if (!rr) throw httpError('Reparaturanfrage nicht gefunden.', 404, 'NOT_FOUND');
      return rr;
    }
    if (!rr || !rr.customerId || String(rr.customerId) !== String(user?._id || '')) {
      throw httpError('Zugriff verweigert.', 403, 'FORBIDDEN');
    }
    return rr;
  }

  static getRepairRequestStatusTrigger(status) {
    const normalized = String(status || '').toLowerCase();
    if (['in_progress', 'in-progress', 'processing', 'assigned', 'under_review', 'reviewing'].includes(normalized)) {
      return 'repair_request_processing';
    }
    if (['diagnosed', 'quote_ready', 'awaiting_approval'].includes(normalized)) {
      return 'repair_request_diagnosed';
    }
    if (['completed', 'resolved', 'closed'].includes(normalized)) {
      return 'repair_request_completed';
    }
    return 'repair_request_processing';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Geräte-Vertrag (Katalog oder manuelle Angabe) – EINE Stelle für Mitglied, Gast und Personal
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Prüft und normalisiert die Geräteangabe.
   *  - catalog: deviceModelId muss ein aktives Katalogmodell sein; Marke/Modell/Typ kommen aus
   *    dem Katalog (der Client-Text wird nicht übernommen). Ungültige ID => 400, nie stiller Fallback.
   *  - manual: keine Katalog-ID; Typ, Marke und Modellbezeichnung sind Pflicht.
   * Ohne deviceSource (alte Clients): ID vorhanden => catalog, sonst manual.
   */
  static async normalizeDeviceInput(data = {}) {
    const rawId = toIdString(data.deviceModelId).trim();
    let source = data.deviceSource;
    if (source !== 'catalog' && source !== 'manual') {
      source = rawId ? 'catalog' : 'manual';
    }

    if (source === 'catalog') {
      if (!rawId || !mongoose.Types.ObjectId.isValid(rawId)) {
        throw httpError(CATALOG_MODEL_GONE, 400, 'CATALOG_MODEL_INVALID');
      }
      const { DeviceModel, DeviceType } = require('../models/Device');
      const model = await DeviceModel.findOne({ _id: rawId, isActive: true })
        .select('name brandId deviceType')
        .populate('brandId', 'name')
        .lean();
      if (!model) {
        throw httpError(CATALOG_MODEL_GONE, 400, 'CATALOG_MODEL_INVALID');
      }
      let typeName = '';
      try {
        const typeDoc = await DeviceType.findById(String(model.deviceType || '').toLowerCase()).select('name').lean();
        typeName = typeDoc?.name || '';
      } catch (error) {
        typeName = '';
      }
      return {
        deviceSource: 'catalog',
        deviceModelId: model._id,
        deviceType: typeName || toDisplayName(model.deviceType) || 'Smartphone',
        deviceBrand: model.brandId?.name || trimTo(data.deviceBrand, 80) || 'Unbekannt',
        deviceModel: model.name,
        modelNumber: trimTo(data.modelNumber, 60),
      };
    }

    if (rawId) {
      throw httpError('Für eine manuelle Geräteangabe darf kein Katalogmodell übermittelt werden.', 400, 'MANUAL_WITH_CATALOG_ID');
    }
    const deviceType = trimTo(data.deviceType, 40) || 'Anderes';
    const deviceBrand = trimTo(data.deviceBrand, 80);
    const deviceModel = trimTo(data.deviceModel, 120);
    if (!deviceBrand || !deviceModel) {
      throw httpError('Bitte geben Sie Marke und Modellbezeichnung Ihres Geräts an.', 400, 'MANUAL_DEVICE_INCOMPLETE');
    }
    return {
      deviceSource: 'manual',
      deviceModelId: undefined,
      deviceType,
      deviceBrand,
      deviceModel,
      modelNumber: trimTo(data.modelNumber, 60),
    };
  }

  static effectiveDeviceSource(rr) {
    if (rr?.deviceSource === 'catalog' || rr?.deviceSource === 'manual') return rr.deviceSource;
    return rr?.deviceModelId ? 'catalog' : 'manual';
  }

  // Lese-Kompatibilität: ohne Snapshot sind die aktuellen Felder die Kundenangabe (für
  // Altbestand bewiesen – vor dieser Änderung konnte keine Route die Gerätefelder ändern).
  static effectiveReportedDevice(rr) {
    if (rr?.reportedDevice && (rr.reportedDevice.model || rr.reportedDevice.brand)) return rr.reportedDevice;
    return {
      deviceType: rr?.deviceType || '',
      brand: rr?.deviceBrand || '',
      model: rr?.deviceModel || '',
      modelNumber: rr?.modelNumber || '',
      deviceModelId: rr?.deviceModelId?._id || rr?.deviceModelId || undefined,
      source: this.effectiveDeviceSource(rr),
      capturedAt: rr?.createdAt || undefined,
    };
  }

  static validateImages(images) {
    if (images === undefined || images === null) return [];
    if (!Array.isArray(images)) throw httpError('Ungültige Fotodaten.', 400);
    if (images.length > MAX_IMAGES) throw httpError(`Maximal ${MAX_IMAGES} Fotos erlaubt.`, 400);
    let totalBytes = 0;
    const clean = images.map((image) => {
      const text = String(image || '');
      if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(text) && !/^https?:\/\//i.test(text)) {
        throw httpError('Ungültiges Fotoformat. Bitte JPG, PNG oder GIF verwenden.', 400);
      }
      const base64 = text.includes(',') ? text.slice(text.indexOf(',') + 1) : '';
      totalBytes += Math.floor(base64.length * 0.75);
      return text;
    });
    if (totalBytes > MAX_IMAGES_TOTAL_BYTES) {
      throw httpError('Die Fotos sind zusammen zu groß (max. 8 MB). Bitte weniger oder kleinere Fotos wählen.', 413, 'IMAGES_TOO_LARGE');
    }
    return clean;
  }

  static buildRequestFields(data, device) {
    const issueDescription = String(data.issueDescription || '').trim();
    if (!issueDescription) throw httpError('Bitte beschreiben Sie den Defekt.', 400);
    const images = this.validateImages(data.images);
    return {
      deviceType: device.deviceType,
      deviceBrand: device.deviceBrand,
      deviceModel: device.deviceModel,
      deviceModelId: device.deviceModelId,
      deviceSource: device.deviceSource,
      modelNumber: device.modelNumber,
      reportedDevice: {
        deviceType: device.deviceType,
        brand: device.deviceBrand,
        model: device.deviceModel,
        modelNumber: device.modelNumber,
        deviceModelId: device.deviceModelId,
        source: device.deviceSource,
        capturedAt: new Date(),
      },
      issueDescription: issueDescription.slice(0, 5000),
      issueOccurredDate: trimTo(data.issueOccurredDate, 200),
      repairAttempts: trimTo(data.repairAttempts, 40),
      waterDamage: ['no', 'yes', 'unsure'].includes(data.waterDamage) ? data.waterDamage : 'no',
      previousRepairDetails: trimTo(data.previousRepairDetails, 2000),
      itemCondition: ['original', 'refurbished', 'unsure'].includes(data.itemCondition) ? data.itemCondition : 'unsure',
      images,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Anlegen
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new repair request
   */
  static async createRepairRequest(customerId, data) {
    const customer = await User.findById(customerId).select('firstName lastName name email phone');
    if (!customer) {
      throw httpError('Kundenkonto nicht gefunden.', 404);
    }

    const device = await this.normalizeDeviceInput(data);
    const fields = this.buildRequestFields(data, device);
    const resolvedCustomerPhone = String(customer.phone || data.customerPhone || data.phone || '').trim();

    const reviewDeadline = new Date();
    reviewDeadline.setDate(reviewDeadline.getDate() + 3);

    const repairRequest = new RepairRequest({
      customerId,
      customerName: actorNameOf(customer),
      customerEmail: customer.email,
      // Keep requests creatable even if legacy customer profiles have no phone saved.
      customerPhone: resolvedCustomerPhone || 'Nicht angegeben',
      ...fields,
      reviewDeadline,
    });

    await repairRequest.save();

    setImmediate(async () => {
      try {
        await EmailService.sendTriggerEmail('repair_request_created', repairRequest.customerEmail, {
          companyName: COMPANY(),
          customerName: repairRequest.customerName,
          requestNumber: repairRequest.requestNumber,
          deviceBrand: repairRequest.deviceBrand,
          deviceModel: repairRequest.deviceModel,
          issueDescription: repairRequest.issueDescription,
          submittedAt: new Date(repairRequest.createdAt || Date.now()).toLocaleDateString('de-DE'),
          requestUrl: await EmailService.buildSystemUrl(this.buildRepairRequestPath(repairRequest, 'customer')),
          supportEmail: SUPPORT_EMAIL(),
          supportPhone: SUPPORT_PHONE(),
        });
      } catch (notificationError) {
        console.error('RepairRequestService: Error sending repair request created email:', notificationError.message);
      }
    });

    return repairRequest;
  }

  /**
   * Create a repair request as a guest (no account required)
   */
  static async createGuestRepairRequest(guestInfo = {}, data = {}) {
    const firstName = trimTo(guestInfo?.firstName, 80);
    const lastName = trimTo(guestInfo?.lastName, 80);
    const email = trimTo(guestInfo?.email, 200).toLowerCase();
    const phone = trimTo(guestInfo?.phone, 60);

    if (!firstName || !lastName || !email) {
      throw httpError('Vorname, Nachname und E-Mail sind für Gäste erforderlich.', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw httpError('Bitte geben Sie eine gültige E-Mail-Adresse an.', 400);
    }

    const device = await this.normalizeDeviceInput(data);
    const fields = this.buildRequestFields(data, device);
    const guestTrackingToken = crypto.randomBytes(32).toString('hex');

    const reviewDeadline = new Date();
    reviewDeadline.setDate(reviewDeadline.getDate() + 3);

    const repairRequest = new RepairRequest({
      isGuest: true,
      guestTrackingToken,
      guestFirstName: firstName,
      guestLastName: lastName,
      customerName: `${firstName} ${lastName}`,
      customerEmail: email,
      customerPhone: phone || 'Nicht angegeben',
      ...fields,
      reviewDeadline,
    });

    await repairRequest.save();

    const trackingUrl = await EmailService.buildSystemUrl(this.buildRepairRequestPath(repairRequest, 'customer'));

    setImmediate(async () => {
      try {
        await EmailService.sendTriggerEmail('repair_request_created', email, {
          companyName: COMPANY(),
          customerName: `${firstName} ${lastName}`,
          requestNumber: repairRequest.requestNumber,
          deviceBrand: repairRequest.deviceBrand,
          deviceModel: repairRequest.deviceModel,
          issueDescription: repairRequest.issueDescription,
          submittedAt: new Date(repairRequest.createdAt || Date.now()).toLocaleDateString('de-DE'),
          requestUrl: trackingUrl,
          trackingUrl,
          supportEmail: SUPPORT_EMAIL(),
          supportPhone: SUPPORT_PHONE(),
        });
      } catch (notificationError) {
        console.error('RepairRequestService: Error sending guest repair request email:', notificationError.message);
      }
    });

    return { repairRequest, guestTrackingToken };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lesen / Projektionen
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Kostenvoranschlag, wie er gilt. Altbestand ohne quote mit estimatedCost > 0 gilt als
   * veröffentlicht (Kunden behalten, was sie gesehen haben) – wird nie automatisch versendet.
   */
  static getEffectiveQuote(rr) {
    if (rr?.quote && rr.quote.status) {
      const q = typeof rr.quote.toObject === 'function' ? rr.quote.toObject() : rr.quote;
      return { ...q, legacy: Boolean(q.legacy) };
    }
    const amount = Number(rr?.estimatedCost);
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, description: '', status: 'sent', version: 0, legacy: true, publishedAt: null };
    }
    return null;
  }

  /**
   * Kundensicht (Mitglied und Gast) – Allowlist. Interne Notizen, Mitarbeiterdaten, Priorität,
   * Altnachrichten, Token und Kostenvoranschlags-Entwürfe verlassen den Server nie.
   */
  static toCustomerView(doc, extras = {}) {
    if (!doc) return null;
    const rr = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const effective = this.getEffectiveQuote(rr);
    const quote = effective && effective.status !== 'draft'
      ? {
          amount: roundMoney(effective.amount || 0),
          description: effective.description || '',
          status: effective.status,
          version: effective.version || 0,
          legacy: Boolean(effective.legacy),
          publishedAt: effective.publishedAt || null,
          respondedAt: effective.respondedAt || null,
          feedbackMessageId: effective.feedbackMessageId ? String(effective.feedbackMessageId) : null,
        }
      : null;
    const closed = ['converted', 'rejected'].includes(rr.status);
    const converted = rr.convertedToOrderId && typeof rr.convertedToOrderId === 'object'
      ? { _id: String(rr.convertedToOrderId._id || ''), orderNumber: rr.convertedToOrderId.orderNumber || '', status: rr.convertedToOrderId.status || '' }
      : (rr.convertedToOrderId ? { _id: String(rr.convertedToOrderId), orderNumber: '', status: '' } : undefined);
    const model = rr.deviceModelId && typeof rr.deviceModelId === 'object'
      ? { _id: String(rr.deviceModelId._id || ''), name: rr.deviceModelId.name, image: rr.deviceModelId.image, images: rr.deviceModelId.images }
      : undefined;
    const reported = this.effectiveReportedDevice(rr);

    return {
      _id: String(rr._id),
      requestNumber: rr.requestNumber,
      customerName: rr.customerName,
      customerEmail: rr.customerEmail,
      customerPhone: rr.customerPhone,
      isGuest: Boolean(rr.isGuest && !rr.customerId),
      deviceType: rr.deviceType,
      deviceBrand: rr.deviceBrand,
      deviceModel: rr.deviceModel,
      deviceLabel: this.formatDeviceLabel(rr.deviceBrand, rr.deviceModel),
      deviceModelId: model,
      deviceSource: this.effectiveDeviceSource(rr),
      reportedDevice: {
        deviceType: reported.deviceType || '',
        brand: reported.brand || '',
        model: reported.model || '',
        modelNumber: reported.modelNumber || '',
        source: reported.source || this.effectiveDeviceSource(rr),
      },
      issueDescription: rr.issueDescription,
      issueOccurredDate: rr.issueOccurredDate,
      repairAttempts: rr.repairAttempts,
      modelNumber: rr.modelNumber,
      waterDamage: rr.waterDamage,
      previousRepairDetails: rr.previousRepairDetails,
      itemCondition: rr.itemCondition,
      images: extras.includeImages === false ? undefined : (rr.images || []),
      status: rr.status,
      statusLabel: statusLabelOf(rr, effective),
      quote,
      responseRequired: Boolean(quote && quote.status === 'sent' && !closed),
      convertedToOrderId: converted,
      convertedAt: rr.convertedAt,
      convertedOrder: extras.convertedOrder || undefined,
      createdAt: rr.createdAt,
      updatedAt: rr.updatedAt,
      reviewDeadline: rr.reviewDeadline,
      communicationSummary: extras.communicationSummary || undefined,
    };
  }

  /**
   * Personalsicht: vollständiger Datensatz + abgeleitete Felder.
   */
  static toStaffView(doc, extras = {}) {
    if (!doc) return null;
    const rr = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete rr.guestTrackingToken; // Gast-Zugangsschlüssel wird auch im Team nicht angezeigt
    delete rr.conversionStartedAt;
    return {
      ...rr,
      isGuest: Boolean(rr.isGuest && !rr.customerId),
      deviceLabel: this.formatDeviceLabel(rr.deviceBrand, rr.deviceModel),
      deviceSource: this.effectiveDeviceSource(rr),
      reportedDevice: this.effectiveReportedDevice(rr),
      effectiveQuote: this.getEffectiveQuote(rr),
      statusLabel: statusLabelOf(rr, this.getEffectiveQuote(rr)),
      communicationSummary: extras.communicationSummary || rr.communicationSummary || undefined,
    };
  }

  /**
   * Link zum umgewandelten Auftrag – nur für den bereits geprüften Gast bzw. das Mitglied.
   */
  static async resolveConvertedOrderLink(rr) {
    const orderRef = rr?.convertedToOrderId;
    if (!orderRef) return undefined;
    const orderId = toIdString(orderRef);
    const order = await Order.findById(orderId).select('orderNumber status bookingId').lean();
    if (!order) return undefined;
    const result = { orderNumber: order.orderNumber || '', status: order.status || '', path: null };
    if (rr.customerId) {
      result.path = `/orders/${orderId}`;
      return result;
    }
    if (order.bookingId) {
      const Booking = mongoose.model('Booking');
      const booking = await Booking.findById(order.bookingId).select('guestTrackingToken guestInfo.email bookingNumber').lean();
      const email = String(booking?.guestInfo?.email || rr.customerEmail || '').toLowerCase();
      if (booking?.guestTrackingToken && email) {
        result.path = `/track-order/booking?token=${encodeURIComponent(booking.guestTrackingToken)}&email=${encodeURIComponent(email)}`;
        result.bookingNumber = booking.bookingNumber || '';
      }
    }
    return result;
  }

  /**
   * Track a guest repair request by token and email (liefert das Rohdokument;
   * Routen geben nur toCustomerView heraus).
   */
  static async trackGuestRepairRequest(token, email) {
    // Gemeinsame Gast-Regeln (routes/middleware/guestAccess.js): nur Zeichenketten, Token im
    // erlaubten Format (alle bisher ausgegebenen Links passen), E-Mail zeitkonstant verglichen.
    const { normalizeGuestToken, normalizeGuestEmail, guestEmailMatches } = require('../routes/middleware/guestAccess'); // eslint-disable-line global-require
    const normalizedEmail = normalizeGuestEmail(email);
    if (!token || !normalizedEmail || typeof token !== 'string') {
      throw httpError('Token und E-Mail sind erforderlich.', 400);
    }
    const guestToken = normalizeGuestToken(token);

    const repairRequest = guestToken
      ? await RepairRequest.findOne({ guestTrackingToken: guestToken, isGuest: true })
        .populate('convertedToOrderId', 'orderNumber status')
        .populate('deviceModelId', 'name image images')
        .lean()
      : null;

    if (!repairRequest || !guestEmailMatches(repairRequest.customerEmail, normalizedEmail)) {
      // Keine Unterscheidung "Token falsch" / "E-Mail falsch" (kein Ausspähen).
      throw httpError('Reparaturanfrage nicht gefunden. Bitte prüfen Sie Link, Tracking-Code und E-Mail.', 404);
    }

    return repairRequest;
  }

  static async getGuestView(token, email) {
    const rr = await this.trackGuestRepairRequest(token, email);
    const convertedOrder = rr.status === 'converted' ? await this.resolveConvertedOrderLink(rr) : undefined;
    return this.toCustomerView(rr, { convertedOrder });
  }

  static LIST_PROJECTION = 'customerId assignedStaffId assignedStaffName convertedToOrderId requestNumber customerName customerEmail customerPhone isGuest deviceType deviceBrand deviceModel deviceModelId deviceSource modelNumber issueDescription status priority estimatedCost quote createdAt updatedAt reviewDeadline convertedAt';

  /**
   * Get all repair requests with filtering and pagination (serverseitig, Suche escaped).
   * viewer (optional): {_id, role} => je Eintrag communicationSummary (ungelesen / Antwort ausstehend).
   */
  static async getRepairRequests(filters = {}, pagination = {}, viewer = null) {
    const { status, priority, customerId, assignedStaffId, search, quoteStatus } = filters;
    const page = Math.max(1, parseInt(pagination.page, 10) || 1);
    // Obergrenze 200: Plantafel/Dashboard laden bis zu 200 Einträge.
    const limit = Math.min(200, Math.max(1, parseInt(pagination.limit, 10) || 20));
    const sortBy = ['createdAt', 'updatedAt', 'requestNumber', 'status', 'priority'].includes(pagination.sortBy) ? pagination.sortBy : 'createdAt';
    const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    if (status && STATUS_LABELS[status]) query.status = status;
    if (priority && PRIORITY_LABELS[priority]) query.priority = priority;
    if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) query.customerId = new mongoose.Types.ObjectId(String(customerId));
    if (assignedStaffId && mongoose.Types.ObjectId.isValid(String(assignedStaffId))) query.assignedStaffId = new mongoose.Types.ObjectId(String(assignedStaffId));
    if (quoteStatus === 'none') {
      query.quote = { $exists: false };
      query.$or = [{ estimatedCost: { $exists: false } }, { estimatedCost: { $lte: 0 } }];
    } else if (['draft', 'sent', 'accepted', 'declined'].includes(quoteStatus)) {
      query['quote.status'] = quoteStatus;
    }

    const searchText = String(search || '').trim().slice(0, 100);
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), 'i');
      const searchOr = [
        { requestNumber: regex },
        { customerName: regex },
        { customerEmail: regex },
        { deviceBrand: regex },
        { deviceModel: regex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      RepairRequest.find(query)
        .sort({ [sortBy]: sortOrder, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select(this.LIST_PROJECTION)
        .lean(),
      RepairRequest.countDocuments(query),
    ]);

    const staffIds = [...new Set(requests.map((r) => r.assignedStaffId).filter(Boolean).map(String))];
    const convertedOrderIds = [...new Set(requests.map((r) => r.convertedToOrderId).filter(Boolean).map(String))];
    const [staffMembers, convertedOrders, summaries] = await Promise.all([
      staffIds.length ? User.find({ _id: { $in: staffIds } }).select('firstName lastName name email').lean() : [],
      convertedOrderIds.length ? Order.find({ _id: { $in: convertedOrderIds } }).select('orderNumber status').lean() : [],
      viewer ? RepairRequestCommunicationService.getThreadSummaries(requests.map((r) => r._id), viewer) : new Map(),
    ]);
    const staffMap = new Map(staffMembers.map((s) => [String(s._id), s]));
    const convertedOrderMap = new Map(convertedOrders.map((o) => [String(o._id), o]));

    const hydratedRequests = requests.map((request) => ({
      ...request,
      assignedStaffId: staffMap.get(String(request.assignedStaffId)) || request.assignedStaffId || null,
      convertedToOrderId: convertedOrderMap.get(String(request.convertedToOrderId)) || request.convertedToOrderId || null,
      communicationSummary: summaries.get(String(request._id)) || {
        unreadCount: 0, awaitingReply: false, pendingFeedbackCount: 0, pendingActionsCount: 0, messageCount: 0, lastMessageAt: null,
      },
    }));

    return {
      requests: hydratedRequests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single repair request by ID (Rohdokument, populiert). 404 deutsch.
   */
  static async getRepairRequestById(requestId) {
    if (!mongoose.Types.ObjectId.isValid(String(requestId || ''))) {
      throw httpError('Reparaturanfrage nicht gefunden.', 404);
    }
    const request = await RepairRequest.findById(requestId)
      .populate('customerId', 'firstName lastName name email phone avatar')
      .populate('assignedStaffId', 'firstName lastName name email')
      .populate('convertedToOrderId', 'orderNumber status totalCost bookingId')
      .populate('deviceModelId', 'name image images')
      .lean();

    if (!request) {
      throw httpError('Reparaturanfrage nicht gefunden.', 404);
    }
    return request;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Status, Zuweisung, Priorität, Notizen
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Update repair request status. "converted" nur über die Umwandlung; E-Mail nur bei echter
   * Änderung (und nie für pending/converted).
   */
  static async updateStatus(requestId, status, staffId, staffName) {
    if (status === 'converted') {
      throw httpError('Umwandlung nur über „In Auftrag umwandeln“.', 400, 'STATUS_CONVERTED_MANUAL');
    }
    if (status === 'approved') {
      throw httpError('„Kostenvoranschlag angenommen“ setzt nur die Annahme durch den Kunden. Bitte den Kostenvoranschlag an den Kunden senden.', 400, 'STATUS_APPROVED_MANUAL');
    }
    if (!MANUAL_STATUSES.includes(status)) {
      throw httpError('Ungültiger Status.', 400);
    }
    const current = await RepairRequest.findById(requestId).select('status').lean();
    if (!current) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    if (current.status === 'converted') {
      throw httpError('Diese Anfrage wurde bereits in einen Auftrag umgewandelt; der Status kann nicht mehr geändert werden.', 409);
    }
    if (current.status === status) {
      const unchanged = await RepairRequest.findById(requestId);
      unchanged.$locals.statusChanged = false;
      return unchanged;
    }

    const request = await RepairRequest.findOneAndUpdate(
      { _id: requestId, status: current.status },
      {
        $set: { status, updatedAt: new Date() },
        $push: {
          adminNotes: {
            staffId,
            staffName,
            note: `Status geändert: ${STATUS_LABELS[current.status] || current.status} → ${STATUS_LABELS[status] || status}`,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
    if (!request) {
      throw httpError('Die Anfrage wurde gerade von jemand anderem geändert. Bitte neu laden.', 409);
    }
    request.$locals.statusChanged = true;

    if (status === 'rejected') {
      // Offene Rückfrage zum Kostenvoranschlag verfällt; sie kann nicht mehr beantwortet werden.
      await this.expireOpenQuoteQuestion(request);
    }

    setImmediate(async () => {
      try {
        await this.sendStatusEmail(request, status, staffName);
      } catch (notificationError) {
        console.error('RepairRequestService: Error sending repair request status email:', notificationError.message);
      }
    });

    return request;
  }

  static async sendStatusEmail(request, status, staffName) {
    const customerUrl = await EmailService.buildSystemUrl(this.buildRepairRequestPath(request, 'customer'));
    if (status === 'reviewing') {
      return EmailService.sendTriggerEmail('repair_request_processing', request.customerEmail, {
        companyName: COMPANY(),
        customerName: request.customerName,
        requestNumber: request.requestNumber,
        deviceBrand: request.deviceBrand,
        deviceModel: request.deviceModel,
        technicianName: request.assignedStaffName || staffName || 'Service-Team',
        processingStartedAt: new Date().toLocaleDateString('de-DE'),
        estimatedResponseDate: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
        requestUrl: customerUrl,
        supportEmail: SUPPORT_EMAIL(),
        supportPhone: SUPPORT_PHONE(),
      });
    }
    if (status === 'approved' || status === 'rejected') {
      const title = status === 'approved'
        ? `Ihre Reparaturanfrage ${request.requestNumber} wurde freigegeben`
        : `Ihre Reparaturanfrage ${request.requestNumber} wurde abgelehnt`;
      const body = status === 'approved'
        ? 'Wir melden uns in Kürze mit den nächsten Schritten.'
        : 'Leider können wir diese Reparatur nicht anbieten. Bei Fragen antworten Sie uns gern über den Link.';
      return EmailService.sendTriggerEmail('system_notification', request.customerEmail, {
        companyName: COMPANY(),
        customerName: request.customerName,
        notificationTitle: title,
        notificationPreview: title,
        notificationTopic: `Reparaturanfrage ${request.requestNumber}`,
        notificationBody: body,
        notificationDate: new Date().toLocaleString('de-DE'),
        effectiveDate: new Date().toLocaleDateString('de-DE'),
        ctaLabel: 'Anfrage ansehen',
        ctaUrl: customerUrl,
        supportEmail: SUPPORT_EMAIL(),
        supportPhone: SUPPORT_PHONE(),
      });
    }
    return null; // pending: keine E-Mail
  }

  /**
   * Assign staff to repair request
   */
  static async assignStaff(requestId, staffId, assignedByStaffId, assignedByStaffName) {
    if (!mongoose.Types.ObjectId.isValid(String(staffId || ''))) throw httpError('Mitarbeiter nicht gefunden.', 404);
    const staff = await User.findById(staffId).select('firstName lastName name email role');
    if (!staff || !['staff', 'admin'].includes(staff.role)) {
      throw httpError('Mitarbeiter nicht gefunden.', 404);
    }
    const staffDisplayName = actorNameOf(staff);
    const request = await RepairRequest.findByIdAndUpdate(
      requestId,
      {
        $set: { assignedStaffId: staff._id, assignedStaffName: staffDisplayName, updatedAt: new Date() },
        $push: { adminNotes: { staffId: assignedByStaffId, staffName: assignedByStaffName, note: `Zugewiesen an: ${staffDisplayName}`, createdAt: new Date() } },
      },
      { new: true }
    );
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    return request;
  }

  /**
   * Legacy-Nachricht in RepairRequest.messages (Altbestand; nur noch Personal). Neue Nachrichten
   * laufen über RepairRequestCommunication (Kunden/Gäste sehen nur diesen Thread).
   */
  static async addMessage(requestId, senderId, senderName, senderRole, message) {
    const request = await RepairRequest.findById(requestId);
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);

    request.messages.push({ senderId, senderName, senderRole, message, sentAt: Date.now(), isRead: false });
    request.updatedAt = Date.now();
    await request.save();

    if (String(senderRole || '').toLowerCase() !== 'customer') {
      setImmediate(async () => {
        try {
          await EmailService.sendTriggerEmail('repair_request_message', request.customerEmail, {
            companyName: COMPANY(),
            customerName: request.customerName,
            requestNumber: request.requestNumber,
            deviceBrand: request.deviceBrand,
            deviceModel: request.deviceModel,
            senderName: senderName || 'Service-Team',
            messageSentAt: new Date().toLocaleString('de-DE'),
            requestUrl: await EmailService.buildSystemUrl(this.buildRepairRequestPath(request, 'customer')),
            supportEmail: SUPPORT_EMAIL(),
            supportPhone: SUPPORT_PHONE(),
          });
        } catch (notificationError) {
          console.error('RepairRequestService: Error sending repair request message email:', notificationError.message);
        }
      });
    }
    return request;
  }

  /**
   * Mark legacy messages as read
   */
  static async markMessagesAsRead(requestId, userId) {
    const request = await RepairRequest.findById(requestId);
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    request.messages.forEach((msg) => {
      if (String(msg.senderId) !== String(userId) && !msg.isRead) {
        msg.isRead = true;
      }
    });
    await request.save();
    return request;
  }

  /**
   * Interne Notiz (nur Personal; nie in Kunden-/Gastsichten).
   */
  static async addAdminNote(requestId, staffId, staffName, note) {
    const text = String(note || '').trim();
    if (!text) throw httpError('Bitte eine Notiz eingeben.', 400);
    const request = await RepairRequest.findByIdAndUpdate(
      requestId,
      {
        $set: { updatedAt: new Date() },
        $push: { adminNotes: { staffId, staffName, note: text.slice(0, 2000), createdAt: new Date() } },
      },
      { new: true }
    );
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    return request;
  }

  /**
   * Update priority
   */
  static async updatePriority(requestId, priority, staffId, staffName) {
    if (!PRIORITY_LABELS[priority]) throw httpError('Ungültige Priorität.', 400);
    const request = await RepairRequest.findByIdAndUpdate(
      requestId,
      {
        $set: { priority, updatedAt: new Date() },
        $push: { adminNotes: { staffId, staffName, note: `Priorität geändert: ${PRIORITY_LABELS[priority]}`, createdAt: new Date() } },
      },
      { new: true }
    );
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    return request;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Gerät zuordnen (Personal) – die ursprüngliche Kundenangabe bleibt erhalten
  // ───────────────────────────────────────────────────────────────────────────

  static async updateDevice(requestId, body = {}, actor = {}) {
    const rr = await RepairRequest.findById(requestId);
    if (!rr) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    if (rr.status === 'converted') {
      throw httpError('Nach der Umwandlung bitte das Gerät im Auftrag korrigieren.', 409, 'ALREADY_CONVERTED');
    }

    const input = body.deviceModelId
      ? { deviceSource: 'catalog', deviceModelId: body.deviceModelId, modelNumber: body.modelNumber ?? rr.modelNumber }
      : { deviceSource: 'manual', ...(body.manual || {}) };
    const device = await this.normalizeDeviceInput(input);

    const before = {
      deviceType: rr.deviceType || '',
      deviceBrand: rr.deviceBrand || '',
      deviceModel: rr.deviceModel || '',
      modelNumber: rr.modelNumber || '',
      deviceModelId: rr.deviceModelId ? String(rr.deviceModelId) : '',
      deviceSource: this.effectiveDeviceSource(rr),
    };
    const after = {
      deviceType: device.deviceType || '',
      deviceBrand: device.deviceBrand || '',
      deviceModel: device.deviceModel || '',
      modelNumber: device.modelNumber || '',
      deviceModelId: device.deviceModelId ? String(device.deviceModelId) : '',
      deviceSource: device.deviceSource,
    };
    const changed = Object.keys(before).some((key) => before[key] !== after[key]);
    if (!changed) {
      rr.$locals.deviceChanged = false;
      return rr;
    }

    const set = {
      deviceType: after.deviceType,
      deviceBrand: after.deviceBrand,
      deviceModel: after.deviceModel,
      modelNumber: after.modelNumber,
      deviceSource: after.deviceSource,
      updatedAt: new Date(),
    };
    const unset = {};
    if (device.deviceModelId) set.deviceModelId = device.deviceModelId;
    else unset.deviceModelId = '';
    // Kompatibilität: fehlt der Snapshot (Altbestand), wird jetzt die bisherige Angabe festgehalten.
    if (!rr.reportedDevice || !(rr.reportedDevice.model || rr.reportedDevice.brand)) {
      const reported = this.effectiveReportedDevice(rr);
      set.reportedDevice = { ...reported, capturedAt: reported.capturedAt || rr.createdAt || new Date() };
    }

    const oldLabel = `${this.formatDeviceLabel(before.deviceBrand, before.deviceModel)} (${before.deviceSource === 'catalog' ? 'Katalog' : 'manuell'})`;
    const newLabel = `${this.formatDeviceLabel(after.deviceBrand, after.deviceModel)} (${after.deviceSource === 'catalog' ? 'Katalog' : 'manuell'})`;
    const update = {
      $set: set,
      $push: { adminNotes: { staffId: actor._id, staffName: actor.name, note: `Gerät zugeordnet: ${oldLabel} → ${newLabel}`, createdAt: new Date() } },
    };
    if (Object.keys(unset).length) update.$unset = unset;

    const updated = await RepairRequest.findOneAndUpdate({ _id: rr._id, status: { $ne: 'converted' } }, update, { new: true });
    if (!updated) throw httpError('Nach der Umwandlung bitte das Gerät im Auftrag korrigieren.', 409, 'ALREADY_CONVERTED');
    updated.$locals.deviceChanged = true;
    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Kostenvoranschlag: Entwurf -> Senden (einmal) -> Antwort des Kunden (einmal)
  // ───────────────────────────────────────────────────────────────────────────

  static parseQuoteAmount(amount) {
    if (amount === undefined || amount === null || amount === '') {
      throw httpError('Bitte einen Betrag angeben (0 € ist erlaubt).', 400);
    }
    const value = typeof amount === 'string' ? Number(amount.replace(',', '.')) : Number(amount);
    if (!Number.isFinite(value) || value < 0 || value > 100000) {
      throw httpError('Ungültiger Betrag. Bitte einen Betrag ab 0,00 € angeben.', 400);
    }
    return roundMoney(value);
  }

  /**
   * Entwurf speichern – sendet NICHTS. Ein bereits gesendeter Kostenvoranschlag wird bei einer
   * Änderung zurück auf Entwurf gesetzt; seine offene Rückfrage beim Kunden verfällt.
   */
  static async saveQuoteDraft(requestId, { amount, description } = {}, actor = {}) {
    const value = this.parseQuoteAmount(amount);
    const text = trimTo(description, 2000);
    const rr = await RepairRequest.findById(requestId);
    if (!rr) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    if (rr.status === 'converted') throw httpError('Die Anfrage wurde bereits in einen Auftrag umgewandelt.', 409);

    const current = this.getEffectiveQuote(rr);
    if (current?.status === 'accepted') {
      throw httpError('Der Kunde hat den Kostenvoranschlag bereits angenommen. Änderungen bitte nach der Umwandlung im Auftrag vornehmen.', 409, 'QUOTE_ALREADY_ACCEPTED');
    }
    const descriptionValue = description === undefined ? (current?.description || '') : text;
    if (current && roundMoney(current.amount) === value && (current.description || '') === descriptionValue && current.status === 'draft') {
      rr.$locals.quoteChanged = false;
      return rr;
    }
    if (current && current.status === 'sent' && roundMoney(current.amount) === value && (current.description || '') === descriptionValue) {
      // Unverändert und bereits gesendet: kein Rücksetzen, kein erneuter Versand.
      rr.$locals.quoteChanged = false;
      return rr;
    }

    const now = new Date();
    const filter = { _id: rr._id, status: { $ne: 'converted' } };
    if (rr.quote && rr.quote.status) {
      filter['quote.status'] = rr.quote.status;
      filter['quote.version'] = rr.quote.version || 0;
    } else {
      filter.quote = { $exists: false };
    }
    const update = {
      $set: {
        'quote.amount': value,
        'quote.description': descriptionValue,
        'quote.status': 'draft',
        'quote.version': rr.quote?.version || 0,
        'quote.legacy': Boolean(current?.legacy && !rr.quote),
        'quote.draftUpdatedAt': now,
        'quote.draftUpdatedByName': actor.name || '',
        estimatedCost: value,
        updatedAt: now,
      },
      $push: {
        adminNotes: { staffId: actor._id, staffName: actor.name || 'Mitarbeiter', note: `Kostenvoranschlag-Entwurf gespeichert: ${formatEuro(value)}`, createdAt: now },
      },
    };
    if (!rr.quote) {
      // Ganz neues Unterdokument: als Ganzes setzen (Punktpfade auf nicht existentes Single-Nested).
      update.$set = {
        quote: {
          amount: value,
          description: descriptionValue,
          status: 'draft',
          version: 0,
          legacy: Boolean(current?.legacy),
          draftUpdatedAt: now,
          draftUpdatedByName: actor.name || '',
        },
        estimatedCost: value,
        updatedAt: now,
      };
    }
    const updated = await RepairRequest.findOneAndUpdate(filter, update, { new: true });
    if (!updated) throw httpError('Der Kostenvoranschlag wurde gerade geändert. Bitte neu laden.', 409, 'QUOTE_CONFLICT');

    if (current?.status === 'sent' && rr.quote?.feedbackMessageId) {
      await RepairRequestCommunicationService.expireFeedbackRequest(rr._id, rr.quote.feedbackMessageId).catch(() => false);
    }
    updated.$locals.quoteChanged = true;
    return updated;
  }

  static async sendQuoteEmail(rr, quote) {
    const amountText = formatEuro(quote.amount);
    const title = `Kostenvoranschlag zu Ihrer Reparaturanfrage ${rr.requestNumber}`;
    const lines = [
      `Kostenvoranschlag: ${amountText} (inkl. MwSt.)${Number(quote.amount) === 0 ? ' – kostenlos' : ''}`,
      `Gerät: ${this.formatDeviceLabel(rr.deviceBrand, rr.deviceModel)}`,
    ];
    if (quote.description) lines.push(`Leistung: ${quote.description}`);
    lines.push('Bitte nehmen Sie den Kostenvoranschlag an oder lehnen Sie ihn ab – direkt über den Link. Die Reparatur beginnt erst nach Ihrer Zustimmung.');
    try {
      const result = await EmailService.sendTriggerEmail('system_notification', rr.customerEmail, {
        companyName: COMPANY(),
        customerName: rr.customerName || rr.customerEmail,
        notificationTitle: title,
        notificationPreview: `Kostenvoranschlag: ${amountText}`,
        notificationTopic: `Reparaturanfrage ${rr.requestNumber}`,
        notificationBody: lines.join('\n'),
        notificationDate: new Date().toLocaleString('de-DE'),
        effectiveDate: new Date().toLocaleDateString('de-DE'),
        ctaLabel: 'Kostenvoranschlag ansehen und beantworten',
        ctaUrl: this.buildRepairRequestPath(rr, 'customer'),
        supportEmail: SUPPORT_EMAIL(),
        supportPhone: SUPPORT_PHONE(),
      });
      return result?.success ? { status: 'accepted', error: '' } : { status: 'failed', error: String(result?.error || 'Unbekannter Fehler') };
    } catch (error) {
      return { status: 'failed', error: String(error?.message || error) };
    }
  }

  /**
   * "Kostenvoranschlag an Kunden senden": veröffentlicht genau einmal je Version und
   * benachrichtigt einmal (In-App für Mitglieder + EINE E-Mail mit Antwort-Link; Gäste:
   * E-Mail mit Tracking-Link). Erneutes Klicken ohne Änderung sendet nichts.
   * @returns {Promise<{request, quote, alreadySent, email: {status, error}}>}
   */
  static async sendQuote(requestId, body = {}, actor = {}) {
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      await this.saveQuoteDraft(requestId, { amount: body.amount, description: body.description }, actor);
    }
    let rr = await RepairRequest.findById(requestId);
    if (!rr) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    if (['converted', 'rejected'].includes(rr.status)) {
      throw httpError(rr.status === 'converted'
        ? 'Die Anfrage wurde bereits in einen Auftrag umgewandelt.'
        : 'Die Anfrage ist abgelehnt. Bitte zuerst den Status ändern.', 409);
    }

    if (!rr.quote || !rr.quote.status) {
      const legacy = this.getEffectiveQuote(rr);
      if (!legacy) throw httpError('Bitte zuerst einen Betrag als Entwurf speichern.', 400, 'QUOTE_MISSING');
      // Altbestand: nie automatisch versendet; erst jetzt (ausdrücklicher Klick) als Entwurf übernehmen.
      rr = await RepairRequest.findOneAndUpdate(
        { _id: rr._id, quote: { $exists: false } },
        { $set: { quote: { amount: roundMoney(legacy.amount), description: '', status: 'draft', version: 0, legacy: true, draftUpdatedAt: new Date(), draftUpdatedByName: actor.name || '' } } },
        { new: true }
      ) || await RepairRequest.findById(requestId);
    }

    if (rr.quote.status === 'sent') {
      return { request: rr, quote: rr.quote, alreadySent: true, email: { status: rr.quote.emailStatus || null, error: rr.quote.emailError || '' } };
    }
    if (rr.quote.status === 'accepted') {
      throw httpError('Der Kunde hat den Kostenvoranschlag bereits angenommen.', 409, 'QUOTE_ALREADY_ACCEPTED');
    }

    const now = new Date();
    const nextVersion = (rr.quote.version || 0) + 1;
    const claimed = await RepairRequest.findOneAndUpdate(
      { _id: rr._id, 'quote.status': { $in: ['draft', 'declined'] }, 'quote.version': rr.quote.version || 0, status: { $nin: ['converted', 'rejected'] } },
      {
        $set: {
          'quote.status': 'sent',
          'quote.version': nextVersion,
          'quote.publishedAt': now,
          'quote.publishedById': actor._id,
          'quote.publishedByName': actor.name || '',
          'quote.respondedAt': null,
          'quote.respondedByName': '',
          'quote.emailError': '',
          estimatedCost: rr.quote.amount,
          ...(rr.status === 'pending' ? { status: 'reviewing' } : {}),
          updatedAt: now,
        },
        $unset: { 'quote.responseChannel': '', 'quote.emailStatus': '' },
        $push: {
          adminNotes: { staffId: actor._id, staffName: actor.name || 'Mitarbeiter', note: `Kostenvoranschlag an Kunden gesendet: ${formatEuro(rr.quote.amount)} (Version ${nextVersion})`, createdAt: now },
        },
      },
      { new: true }
    );
    if (!claimed) {
      const fresh = await RepairRequest.findById(requestId);
      if (fresh?.quote?.status === 'sent') {
        return { request: fresh, quote: fresh.quote, alreadySent: true, email: { status: fresh.quote.emailStatus || null, error: fresh.quote.emailError || '' } };
      }
      throw httpError('Der Kostenvoranschlag wurde gerade geändert. Bitte neu laden.', 409, 'QUOTE_CONFLICT');
    }

    const quote = claimed.quote;
    const amountText = formatEuro(quote.amount);
    const question = `Kostenvoranschlag: ${amountText} (inkl. MwSt.)${quote.description ? ` – ${quote.description}` : ''}`;
    let feedbackMessageId = null;
    try {
      const created = await RepairRequestCommunicationService.createFeedbackRequest(
        claimed._id,
        actor._id,
        actor.name || 'McRepair Team',
        question,
        [
          { label: 'Kostenvoranschlag annehmen', value: 'quote_accept' },
          { label: 'Ablehnen', value: 'quote_decline' },
        ],
        actor.role || 'staff',
        { metadata: { kind: 'quote', quoteVersion: quote.version, amount: quote.amount }, notify: false }
      );
      feedbackMessageId = created.messageId;
    } catch (error) {
      console.error('RepairRequestService: Rückfrage zum Kostenvoranschlag konnte nicht angelegt werden:', error.message);
    }

    // Mitglied: In-App-Hinweis ohne generische Zusatz-E-Mail (die eigene Kostenvoranschlags-E-Mail folgt).
    if (claimed.customerId) {
      await RepairRequestCommunicationService.notifyCustomer(claimed, {
        title: `Kostenvoranschlag zu Ihrer Reparaturanfrage ${claimed.requestNumber}`,
        message: `Kostenvoranschlag: ${amountText} – bitte annehmen oder ablehnen.`,
        messageType: 'quote',
        messageId: feedbackMessageId,
        sendEmailToMember: false,
      });
    }
    const email = await this.sendQuoteEmail(claimed, quote);

    const final = await RepairRequest.findOneAndUpdate(
      { _id: claimed._id, 'quote.version': quote.version },
      {
        $set: {
          ...(feedbackMessageId ? { 'quote.feedbackMessageId': feedbackMessageId } : {}),
          'quote.emailStatus': email.status,
          'quote.emailError': email.error || '',
          'quote.emailSentAt': new Date(),
        },
      },
      { new: true }
    ) || claimed;

    // Kunde hat schon über die Karte geantwortet, bevor die Rückfrage-ID gespeichert war:
    // die Rückfrage im Thread zeigt dieselbe Entscheidung statt "offen".
    if (feedbackMessageId && final.quote && ['accepted', 'declined'].includes(final.quote.status) && final.quote.version === quote.version) {
      await this.markQuoteQuestionResponded(final._id, feedbackMessageId, {
        decision: final.quote.status === 'accepted' ? 'accept' : 'decline',
        responderName: final.quote.respondedByName || '',
        channel: final.quote.responseChannel || 'customer',
      });
    }

    return { request: final, quote: final.quote, alreadySent: false, email };
  }

  /**
   * Rückfrage zum Kostenvoranschlag im Thread als beantwortet markieren (nur solange offen).
   * Gemeinsame Stelle für Karte, Rückfrage und nachträglich gespeicherte feedbackMessageId.
   */
  static async markQuoteQuestionResponded(requestId, messageId, { decision, responderName = '', responderId = null, channel = 'customer', at = new Date() } = {}) {
    if (!messageId) return false;
    const RepairRequestCommunication = require('../models/RepairRequestCommunication');
    const label = decision === 'accept' ? 'Kostenvoranschlag annehmen' : 'Ablehnen';
    try {
      const result = await RepairRequestCommunication.updateOne(
        { repairRequestId: requestId, messages: { $elemMatch: { _id: messageId, 'feedbackRequest.status': 'pending' } } },
        {
          $set: {
            'messages.$.feedbackRequest.status': 'responded',
            'messages.$.feedbackRequest.response': { label, value: decision === 'accept' ? 'quote_accept' : 'quote_decline' },
            'messages.$.feedbackRequest.respondedBy': trimTo(responderName, 120),
            'messages.$.feedbackRequest.respondedAt': at,
            ...(responderId && mongoose.Types.ObjectId.isValid(String(responderId))
              ? { 'messages.$.feedbackRequest.respondedById': responderId }
              : {}),
            'messages.$.feedbackRequest.responseChannel': channel === 'guest' ? 'guest' : 'customer',
            lastMessageAt: at,
          },
          $inc: { pendingFeedbackCount: -1 },
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('RepairRequestService: Rückfrage konnte nicht als beantwortet markiert werden:', error.message);
      return false;
    }
  }

  /**
   * Offene Kostenvoranschlags-Rückfrage verfallen lassen (Umwandlung, Ablehnung). Nie werfend.
   */
  static async expireOpenQuoteQuestion(rr) {
    const messageId = rr?.quote?.feedbackMessageId;
    if (!messageId) return false;
    return RepairRequestCommunicationService.expireFeedbackRequest(rr._id, messageId).catch(() => false);
  }

  /**
   * Antwort des Kunden auf den Kostenvoranschlag – genau einmal und nur für GENAU die Version,
   * die der Kunde gesehen hat (quoteVersion ist Pflicht; optional zusätzlich amount).
   *  annehmen => quote.status accepted, Anfrage-Status approved ("Kostenvoranschlag angenommen")
   *  ablehnen => quote.status declined, Anfrage bleibt in Prüfung
   * Die zugehörige Rückfrage im Thread wird hier (und nur hier) als beantwortet markiert; scheitert
   * die Entscheidung, wird eine Rückfrage-Antwort nicht als beantwortet gespeichert.
   */
  static async applyQuoteDecision(requestId, {
    decision,
    responderName = '',
    responderId = null,
    channel = 'customer',
    feedbackMessageId = null,
    quoteVersion = undefined,
    amount = undefined,
    fromFeedback = false,
  } = {}) {
    if (!['accept', 'decline'].includes(decision)) throw httpError('Ungültige Antwort.', 400);
    const versionNumber = (quoteVersion === undefined || quoteVersion === null || quoteVersion === '') ? NaN : Number(quoteVersion);
    const expectedAmount = (amount === undefined || amount === null || amount === '') ? null : Number(amount);

    const failQuestion = async () => {
      // Rückfrage-Pfad: eine nicht mehr beantwortbare Rückfrage nie als "beantwortet" zeigen.
      if (!fromFeedback || !feedbackMessageId) return;
      const fresh = await RepairRequest.findById(requestId).select('quote').lean().catch(() => null);
      const freshQuote = fresh?.quote;
      if (freshQuote && ['accepted', 'declined'].includes(freshQuote.status) && Number(freshQuote.version) === versionNumber) {
        // Parallel über die Karte beantwortet: Thread zeigt die tatsächliche Entscheidung.
        await this.markQuoteQuestionResponded(requestId, feedbackMessageId, {
          decision: freshQuote.status === 'accepted' ? 'accept' : 'decline',
          responderName: freshQuote.respondedByName || '',
          channel: freshQuote.responseChannel || 'customer',
        });
        return;
      }
      await RepairRequestCommunicationService.expireFeedbackRequest(requestId, feedbackMessageId).catch(() => false);
    };

    if (!Number.isInteger(versionNumber) || versionNumber < 0) {
      await failQuestion();
      throw httpError(QUOTE_CHANGED_MESSAGE, 409, 'QUOTE_CHANGED');
    }

    let rr = await RepairRequest.findById(requestId);
    if (!rr) throw httpError('Reparaturanfrage nicht gefunden.', 404);

    if (!rr.quote || !rr.quote.status) {
      const legacy = this.getEffectiveQuote(rr);
      if (!legacy || ['converted', 'rejected'].includes(rr.status)) {
        await failQuestion();
        throw httpError(legacy ? 'Der Kostenvoranschlag wurde bereits beantwortet oder ist nicht mehr gültig.' : 'Es liegt kein Kostenvoranschlag vor.', 409, legacy ? 'QUOTE_NOT_OPEN' : 'QUOTE_MISSING');
      }
      // Altbestand (Version 0): erst bei der ausdrücklichen Antwort als Unterdokument festgehalten.
      rr = await RepairRequest.findOneAndUpdate(
        { _id: rr._id, quote: { $exists: false } },
        { $set: { quote: { amount: roundMoney(legacy.amount), description: '', status: 'sent', version: 0, legacy: true } } },
        { new: true }
      ) || await RepairRequest.findById(requestId);
    }

    const now = new Date();
    const filter = {
      _id: rr._id,
      'quote.status': 'sent',
      'quote.version': versionNumber,
      status: { $nin: ['converted', 'rejected'] },
    };
    if (expectedAmount !== null && Number.isFinite(expectedAmount)) filter['quote.amount'] = roundMoney(expectedAmount);
    if (fromFeedback && feedbackMessageId && rr.quote?.feedbackMessageId) {
      filter['quote.feedbackMessageId'] = feedbackMessageId;
    }
    const responder = trimTo(responderName, 120);
    const channelValue = channel === 'guest' ? 'guest' : 'customer';
    const decisionText = decision === 'accept' ? 'angenommen' : 'abgelehnt';
    const set = {
      'quote.status': decision === 'accept' ? 'accepted' : 'declined',
      'quote.respondedAt': now,
      'quote.respondedByName': responder,
      'quote.responseChannel': channelValue,
      status: decision === 'accept' ? 'approved' : 'reviewing',
      updatedAt: now,
    };
    const updated = await RepairRequest.findOneAndUpdate(
      filter,
      {
        $set: set,
        $push: {
          adminNotes: {
            actorType: channelValue,
            staffName: `${responder || (channelValue === 'guest' ? 'Gast' : 'Kunde')} (${channelValue === 'guest' ? 'Gast' : 'Kunde'})`,
            note: `Kostenvoranschlag ${decisionText}: ${formatEuro(rr.quote.amount)} (Version ${versionNumber}) – ${channelValue === 'guest' ? 'über den Gast-Link' : 'im Kundenkonto'}${fromFeedback ? ', Antwort im Nachrichtenverlauf' : ''}`,
            createdAt: now,
          },
        },
      },
      { new: true }
    );
    if (!updated) {
      await failQuestion();
      const fresh = await RepairRequest.findById(rr._id).select('quote status').lean();
      const freshQuote = fresh?.quote;
      const changed = freshQuote && (
        freshQuote.status === 'draft'
        || (freshQuote.status === 'sent' && (Number(freshQuote.version) !== versionNumber
          || (expectedAmount !== null && Number.isFinite(expectedAmount) && roundMoney(freshQuote.amount) !== roundMoney(expectedAmount))))
      ) && !['converted', 'rejected'].includes(fresh?.status);
      if (changed) throw httpError(QUOTE_CHANGED_MESSAGE, 409, 'QUOTE_CHANGED');
      throw httpError('Der Kostenvoranschlag wurde bereits beantwortet oder ist nicht mehr gültig.', 409, 'QUOTE_NOT_OPEN');
    }

    if (fromFeedback && feedbackMessageId && !updated.quote.feedbackMessageId) {
      await RepairRequest.updateOne({ _id: updated._id, 'quote.version': updated.quote.version }, { $set: { 'quote.feedbackMessageId': feedbackMessageId } }).catch(() => null);
    }
    const questionId = (fromFeedback && feedbackMessageId) || updated.quote.feedbackMessageId;
    if (questionId) {
      await this.markQuoteQuestionResponded(updated._id, questionId, {
        decision, responderName: responder, responderId, channel: channelValue, at: now,
      });
    }

    await RepairRequestCommunicationService.notifyStaff(updated, {
      title: `${decision === 'accept' ? 'Kostenvoranschlag angenommen' : 'Kostenvoranschlag abgelehnt'} – ${updated.requestNumber}`,
      message: `${trimTo(responderName, 120) || 'Kunde'} hat den Kostenvoranschlag über ${formatEuro(updated.quote.amount)} ${decision === 'accept' ? 'angenommen' : 'abgelehnt'}.`,
      messageType: 'quote_response',
      messageId: updated.quote.feedbackMessageId || null,
    });

    return updated;
  }

  /**
   * Update estimated cost (Kompatibilität): speichert nur den Entwurf, sendet nichts.
   */
  static async updateEstimatedCost(requestId, estimatedCost, staffId, staffName) {
    return this.saveQuoteDraft(requestId, { amount: estimatedCost }, { _id: staffId, name: staffName });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Umwandlung in einen Auftrag (atomar, Gast bleibt Gast, kein Label ohne ausdrückliche Wahl)
  // ───────────────────────────────────────────────────────────────────────────

  static buildGuestInfo(rr) {
    let firstName = String(rr.guestFirstName || '').trim();
    let lastName = String(rr.guestLastName || '').trim();
    if (!firstName && !lastName) {
      const name = String(rr.customerName || '').trim();
      const idx = name.indexOf(' ');
      firstName = idx > 0 ? name.slice(0, idx) : name;
      lastName = idx > 0 ? name.slice(idx + 1) : '';
    }
    const phone = String(rr.customerPhone || '').trim();
    return {
      isGuest: true,
      email: String(rr.customerEmail || '').trim().toLowerCase(),
      firstName,
      lastName,
      phone: phone === 'Nicht angegeben' ? '' : phone,
    };
  }

  /**
   * Convert repair request to an order.
   * orderData: { services: string[], addOns?: [], shippingMode?: 'none' | 'inbound_label' }
   */
  static async convertToOrder(requestId, orderData = {}, staffId, staffName) {
    // Positionen kommen ausschliesslich aus dem Katalog (Service-IDs); Preise, Namen
    // und Zeiten loest OrderService.create serverseitig auf. Der Auftragswert wird
    // mit DER Preisregel des Auftrags gebildet (Listenpreise + Kunden-/Haendler-
    // konditionen, Snapshot) - weder ein mitgeschicktes orderData.totalCost noch der
    // Kostenvoranschlag der Anfrage werden als Auftragswert uebernommen.
    const serviceIds = Array.isArray(orderData.services)
      ? orderData.services.map((entry) => (entry && typeof entry === 'object' ? (entry.serviceId || entry._id) : entry))
        .filter(Boolean)
        .map(String)
      : [];
    if (serviceIds.length === 0) {
      throw httpError('Bitte mindestens eine Reparaturleistung auswählen.', 400, 'NO_SERVICES');
    }
    const shippingMode = orderData.shippingMode === 'inbound_label' ? 'inbound_label' : 'none';

    if (!mongoose.Types.ObjectId.isValid(String(requestId || ''))) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    const now = new Date();
    const request = await RepairRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: { $ne: 'converted' },
        $or: [
          { conversionStartedAt: null },
          { conversionStartedAt: { $lt: new Date(now.getTime() - CONVERSION_LOCK_MS) } },
        ],
      },
      { $set: { conversionStartedAt: now } },
      { new: true }
    );
    if (!request) {
      const exists = await RepairRequest.exists({ _id: requestId });
      if (!exists) throw httpError('Reparaturanfrage nicht gefunden.', 404);
      throw httpError('Diese Anfrage wird bereits umgewandelt oder wurde schon umgewandelt.', 409, 'CONVERSION_IN_PROGRESS');
    }

    const OrderService = require('./orderService');
    let order = null;
    try {
      if (request.convertedToOrderId) {
        // Wiederaufnahme nach einem Abbruch: vorhandenen Auftrag wiederverwenden, keinen zweiten anlegen.
        order = await Order.findById(request.convertedToOrderId);
      }
      if (!order) {
        const reported = this.effectiveReportedDevice(request);
        const isGuest = !request.customerId && request.isGuest;
        const quote = this.getEffectiveQuote(request);
        const quoteNote = quote && quote.status === 'accepted'
          ? `\nKostenvoranschlag (angenommen): ${formatEuro(quote.amount)} – Auftragswert nach Katalogpreisen und Kundenkonditionen.`
          : (quote ? `\nKostenvoranschlag (${quote.status === 'sent' ? 'gesendet, unbeantwortet' : quote.status === 'declined' ? 'abgelehnt' : 'Entwurf'}): ${formatEuro(quote.amount)}` : '');
        const deviceNote = `${this.formatDeviceLabel(reported.brand, reported.model)}${reported.modelNumber ? ` (Modellnr. ${reported.modelNumber})` : ''}${reported.source === 'manual' ? ' – manuell angegeben' : ''}`;

        order = await OrderService.create({
          ...(request.customerId ? { customerId: request.customerId } : {}),
          ...(isGuest ? { guestInfo: this.buildGuestInfo(request) } : {}),
          deviceType: request.deviceType,
          deviceBrand: request.deviceBrand,
          deviceModel: request.deviceModel,
          reportedDevice: {
            brand: reported.brand,
            model: reported.model,
            deviceType: reported.deviceType,
            capturedAt: reported.capturedAt || request.createdAt || now,
          },
          services: serviceIds,
          addOns: Array.isArray(orderData.addOns) ? orderData.addOns : [],
          customerNotes: `Aus Reparaturanfrage ${request.requestNumber} übernommen.\nKundenangabe Gerät: ${deviceNote}\nFehlerbeschreibung: ${request.issueDescription}${quoteNote}`,
          photos: request.images,
          status: 'pending',
        });
        await RepairRequest.updateOne({ _id: request._id }, { $set: { convertedToOrderId: order._id } });
      }
    } catch (error) {
      await RepairRequest.updateOne({ _id: request._id, convertedToOrderId: null }, { $unset: { conversionStartedAt: '' } }).catch(() => null);
      throw error;
    }

    let booking = null;
    let bookingError = null;
    if (!order.bookingId) {
      try {
        const isGuest = !request.customerId && request.isGuest;
        booking = await BookingService.create({
          ...(request.customerId ? { customerId: request.customerId } : {}),
          ...(isGuest ? { guestInfo: this.buildGuestInfo(request) } : {}),
          orderIds: [order._id],
          status: 'pending',
          billingStatus: 'unpaid',
          paymentStatus: 'pending',
          discount: 0,
          // Kein DHL-Einsendelabel ohne ausdrückliche Wahl (Gerät kann bereits vorliegen).
          createShippingLabel: shippingMode === 'inbound_label',
        });
        order.bookingId = booking._id;
      } catch (error) {
        bookingError = error;
        console.error('RepairRequestService: Error creating booking (non-fatal):', error.message);
      }
    }

    const quote = this.getEffectiveQuote(request);
    let differenceNote = '';
    if (quote && quote.status === 'accepted') {
      const fresh = await Order.findById(order._id).select('totalCost').lean();
      const total = Number(fresh?.totalCost || 0);
      const diff = roundMoney(total - Number(quote.amount || 0));
      differenceNote = ` · Kostenvoranschlag (angenommen): ${formatEuro(quote.amount)} · Auftragswert nach Katalog: ${formatEuro(total)} · Abweichung ${diff > 0 ? '+' : ''}${formatEuro(diff)}`;
    }
    const noteText = `In Auftrag umgewandelt: ${order.orderNumber}${booking ? ` (Buchung ${booking.bookingNumber})` : ''}`
      + `${shippingMode === 'inbound_label' ? ' · DHL-Einsendelabel angefordert' : ' · ohne DHL-Einsendelabel'}`
      + `${bookingError ? ' · Buchung konnte nicht angelegt werden' : ''}${differenceNote}`;

    const updated = await RepairRequest.findOneAndUpdate(
      { _id: request._id },
      {
        $set: {
          status: 'converted',
          convertedToOrderId: order._id,
          convertedAt: new Date(),
          convertedByStaffId: staffId,
          convertedByStaffName: staffName,
          updatedAt: new Date(),
        },
        $unset: { conversionStartedAt: '' },
        $push: { adminNotes: { staffId, staffName, note: noteText, createdAt: new Date() } },
      },
      { new: true }
    );
    // Eine noch offene Kostenvoranschlags-Rückfrage ist nach der Umwandlung nicht mehr beantwortbar.
    await this.expireOpenQuoteQuestion(updated);

    return { request: updated, order, booking, shippingMode };
  }

  /**
   * Get statistics
   */
  static async getStatistics() {
    const [total, pending, reviewing, approved, rejected, converted, highPriority, unassigned, quoteSent] = await Promise.all([
      RepairRequest.countDocuments(),
      RepairRequest.countDocuments({ status: 'pending' }),
      RepairRequest.countDocuments({ status: 'reviewing' }),
      RepairRequest.countDocuments({ status: 'approved' }),
      RepairRequest.countDocuments({ status: 'rejected' }),
      RepairRequest.countDocuments({ status: 'converted' }),
      RepairRequest.countDocuments({ priority: { $in: ['high', 'urgent'] } }),
      RepairRequest.countDocuments({ assignedStaffId: { $exists: false } }),
      RepairRequest.countDocuments({ 'quote.status': 'sent' }),
    ]);
    return {
      total,
      byStatus: { pending, reviewing, approved, rejected, converted },
      highPriority,
      unassigned,
      quoteSent,
    };
  }

  /**
   * Delete a repair request (only for non-converted requests)
   */
  static async deleteRepairRequest(requestId) {
    const request = await RepairRequest.findById(requestId);
    if (!request) throw httpError('Reparaturanfrage nicht gefunden.', 404);
    if (request.status === 'converted' || request.convertedToOrderId) {
      throw httpError('Eine in einen Auftrag umgewandelte Anfrage kann nicht gelöscht werden.', 409);
    }
    await RepairRequest.findByIdAndDelete(requestId);
    return { success: true };
  }
}

module.exports = RepairRequestService;
