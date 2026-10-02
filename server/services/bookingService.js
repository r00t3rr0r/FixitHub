const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const InspectionCommunication = require('../models/InspectionCommunication');
const DHLService = require('./dhlService');
const { isMessageUnreadFor } = require('../utils/communicationReadRules');
const SystemConfiguration = require('../models/SystemConfiguration');
const EmailService = require('./emailService');
const { describeGross } = require('../utils/money');

// Ab wann eine Einsendelabel-Sperre ohne Abgleich-Vermerk als verwaist gilt. Der
// DHL-Aufruf selbst ist nach ~30 Sekunden beendet; eine aeltere Sperre stammt von einem
// abgebrochenen Prozess und darf per Abgleich geloest werden.
const BOOKING_LABEL_LOCK_STALE_MS = 10 * 60 * 1000;
// Zahlungsziel (Tage), wenn weder Kunden- noch Standardprofil lesbar sind - derselbe Wert,
// den FinancialService.normalizePaymentDueDays ohne gueltige Angabe verwendet.
const BOOKING_INVOICE_FALLBACK_DUE_DAYS = 7;
// Steuerprofile ohne ausgewiesene MwSt. (wie profitabilityService TAX_EXEMPT_MODES).
const BOOKING_TAX_EXEMPT_MODES = ['tax_free', 'reverse_charge'];

class BookingService {
  static shouldRefreshShipping(filters = {}) {
    const value = String(
      filters.refreshShipping ?? filters.includeLiveTracking ?? ''
    ).toLowerCase();

    return value === '1' || value === 'true' || value === 'yes';
  }

  static async applyLiveShippingTracking(bookings = [], maxItems = 10) {
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return bookings;
    }

    const candidates = bookings
      .filter(
        (booking) =>
          booking?.trackingNumber &&
          !this.isDummyBookingTrackingNumber(booking.trackingNumber)
      )
      .slice(0, maxItems);

    await Promise.all(
      candidates.map(async (booking) => {
        try {
          const trackingInfo = await DHLService.getTrackingInfo(booking.trackingNumber);
          const mappedStatus = this.mapTrackingStatusToBookingStatus(
            trackingInfo.status || trackingInfo.statusCodeRaw
          );

          if (mappedStatus) booking.shippingStatus = mappedStatus;
          if (trackingInfo.description) booking.shippingStatusDescription = trackingInfo.description;
          if (trackingInfo.estimatedDelivery) booking.estimatedDelivery = trackingInfo.estimatedDelivery;
        } catch (trackingError) {
          console.error(
            'BookingService: Failed to refresh shipping status for booking:',
            booking._id,
            trackingError.message
          );
        }
      })
    );

    return bookings;
  }

  static normalizeAddress(address) {
    if (!address || typeof address !== 'object') return null;

    const street = String(address.street || address.line1 || '').trim();
    const city = String(address.city || address.town || '').trim();
    const zip = String(address.zip || address.zipCode || address.postalCode || '').trim();
    const state = String(address.state || address.province || '').trim();
    const country = String(address.country || '').trim();

    if (!street && !city && !zip && !state && !country) return null;

    return { street, city, zip, zipCode: zip, state, country };
  }

  static pickFirstAddress(...candidates) {
    for (const candidate of candidates) {
      const normalized = this.normalizeAddress(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  static escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static formatCurrencyEUR(amount) {
    const numericValue = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return require('../utils/money').formatEuroDe(numericValue); // eslint-disable-line global-require
  }

  static roundCurrency(amount) {
    return Math.round(Number(amount || 0) * 100) / 100;
  }

  /**
   * EINE Ableitung der Buchungssummen aus ihren Auftraegen (FIN-2), mit DERSELBEN
   * Preisfunktion wie die Auftragsdetailseite (OrderService.buildOrderPricingSummary):
   *   subtotal = Summe Listen-Brutto der Positionen (vor Rabatt)
   *   discount = Summe der Rabatte (Brutto, je einmal)
   *   totalCost = Summe Auftragswert brutto (grossTotal)
   *   tax      = Summe enthaltene MwSt. (taxAmount)
   * Invariante: subtotal - discount = totalCost. Stornierte Auftraege zaehlen mit, wie
   * bisher in booking.totalCost (Zahlungsstand behandelt sie ueber PaymentService).
   *
   * options.taxExempt: Kunde mit Steuerprofil reverse_charge / tax_free. Auftraege
   * speichern dort weiterhin taxRate 19 (gespeicherte Auftragsregel, bewusst NICHT
   * geaendert); die Buchung traegt dann - wie der Checkout - MwSt. 0. Ohne dieses Flag
   * wuerde jede Auftragsaenderung 19 % ueber einen korrekten Checkout-Wert 0 schreiben.
   */
  //
  // options.defaultTaxRate (FIN-13): konfigurierter Standardsatz fuer Auftraege OHNE
  // gespeicherten Satz (OrderService.resolveDefaultTaxRate). Ein gespeicherter Satz 0
  // bleibt 0 - dieselbe Regel wie die Auftragsdetailseite.
  static computeBookingTotalsFromOrders(orders = [], { taxExempt = false, defaultTaxRate } = {}) {
    const OrderService = require('./orderService');
    const totals = (orders || []).filter(Boolean).reduce((acc, order) => {
      const pricing = OrderService.buildOrderPricingSummary(order, { defaultTaxRate });
      const orderDiscount = this.roundCurrency(Number(pricing.discount || 0) + Number(pricing.dealerDiscountAmount || 0));
      const gross = this.roundCurrency(pricing.grossTotal);
      const listGross = pricing.positionsReconcile
        ? this.roundCurrency(pricing.positionsGross)
        : this.roundCurrency(gross + orderDiscount);
      return {
        subtotal: acc.subtotal + listGross,
        discount: acc.discount + orderDiscount,
        totalCost: acc.totalCost + gross,
        tax: acc.tax + Number(pricing.taxAmount || 0),
      };
    }, { subtotal: 0, discount: 0, totalCost: 0, tax: 0 });
    return {
      subtotal: this.roundCurrency(totals.subtotal),
      discount: this.roundCurrency(totals.discount),
      totalCost: this.roundCurrency(totals.totalCost),
      tax: taxExempt ? 0 : this.roundCurrency(totals.tax),
    };
  }

  /**
   * Steuerbefreiung des Buchungskunden (dieselbe Regel wie Controlling/Rechnung:
   * FinancialService.resolveFinancialProfile -> taxMode reverse_charge | tax_free).
   * Rueckgabe: true / false, oder null wenn das Profil nicht lesbar ist (Aufrufer
   * lassen die gespeicherte MwSt. dann unveraendert). Gast (kein Kunde) = false.
   */
  static async resolveCustomerTaxExempt(customerId) {
    const id = customerId?._id || customerId || null;
    if (!id) return false;
    try {
      const FinancialService = require('./financialService');
      const profile = await FinancialService.resolveFinancialProfile({ customerId: id });
      return BOOKING_TAX_EXEMPT_MODES.includes(String(profile?.taxMode || 'default'));
    } catch (error) {
      console.error('BookingService: tax profile could not be resolved:', error.message);
      return null;
    }
  }

  static resolveBookingPricing({ orderGrossTotal, bookingData = {}, orders = null, taxExempt = false, defaultTaxRate }) {
    const checkoutPricing = bookingData.checkoutPricing || {};
    const hasCheckoutTotal = Number.isFinite(Number(checkoutPricing.total));

    if (hasCheckoutTotal) {
      return {
        subtotal: this.roundCurrency(checkoutPricing.subtotal),
        discount: this.roundCurrency(checkoutPricing.totalDiscount),
        tax: this.roundCurrency(checkoutPricing.tax),
        totalCost: this.roundCurrency(checkoutPricing.total),
      };
    }

    // Ohne Checkout-Snapshot (manuelle Buchung, Umwandlung einer Reparaturanfrage):
    // Summen aus den Auftraegen. Frueher stand hier tax: 0 - die MwSt. war damit
    // unsichtbar und galt im Controlling als echte Null.
    const extraDiscount = Math.max(0, this.roundCurrency(bookingData.discount));
    if (Array.isArray(orders) && orders.length > 0) {
      const fromOrders = this.computeBookingTotalsFromOrders(orders, { taxExempt: taxExempt === true, defaultTaxRate });
      if (extraDiscount <= 0) return fromOrders;
      const totalCost = Math.max(0, this.roundCurrency(fromOrders.totalCost - extraDiscount));
      const taxShare = fromOrders.totalCost > 0 ? totalCost / fromOrders.totalCost : 0;
      return {
        subtotal: fromOrders.subtotal,
        discount: this.roundCurrency(fromOrders.discount + (fromOrders.totalCost - totalCost)),
        tax: this.roundCurrency(fromOrders.tax * taxShare),
        totalCost,
      };
    }

    const subtotal = this.roundCurrency(orderGrossTotal);
    const discount = extraDiscount;
    return {
      subtotal,
      discount,
      tax: 0,
      totalCost: Math.max(0, this.roundCurrency(subtotal - discount)),
    };
  }

  static parseDeviceLabel(deviceLabel = '') {
    const normalized = String(deviceLabel || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return { deviceBrand: '', deviceModel: '' };
    }

    const parts = normalized.split(' ');
    if (parts.length < 2) {
      return { deviceBrand: normalized, deviceModel: '' };
    }

    return {
      deviceBrand: parts[0],
      deviceModel: parts.slice(1).join(' '),
    };
  }

  static async buildBookingOrdersSummary(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return 'Keine Auftraege enthalten';
    }

    const orderLabel = items.length === 1 ? 'Auftrag' : 'Auftraege';
    const lines = await Promise.all(items.map(async (item, index) => {
      const amount = this.formatCurrencyEUR(item?.cost);

      if (item?.type === 'product') {
        const products = Array.isArray(item?.products)
          ? item.products
              .map((product) => {
                const name = this.escapeHtml(product?.name || 'Produkt');
                const quantity = Number.isFinite(Number(product?.quantity)) ? Number(product.quantity) : 1;
                return `${name} (${quantity}x)`;
              })
              .filter(Boolean)
          : [];

        const productsDisplay = products.length > 0
          ? products.join(', ')
          : 'Produkte werden fuer Sie vorbereitet';

        return [
          `<strong>Position ${index + 1}: Produktbestellung</strong>`,
          `Produkte: ${productsDisplay}`,
          `Betrag: ${amount}`,
        ].join('<br />');
      }

      const deviceLabel = item?.device || 'Geraet wird noch zugeordnet';
      const { deviceBrand, deviceModel } = this.parseDeviceLabel(deviceLabel);
      const modelImageUrl = await EmailService.resolveDeviceModelImageUrl({
        deviceBrand,
        deviceModel,
      });
      const deviceVisual = EmailService.buildDeviceModelVisualHtml({
        deviceBrand,
        deviceModel,
        imageUrl: modelImageUrl,
      });

      const serviceNames = Array.isArray(item?.services)
        ? item.services
            .map((service) => service?.name)
            .filter(Boolean)
            .map((name) => this.escapeHtml(name))
        : [];

      const servicesDisplay = serviceNames.length > 0
        ? serviceNames.join(', ')
        : 'Leistungen werden fuer Sie vorbereitet';

      return `
        <div style="border:1px solid #d8dce6;border-radius:14px;padding:12px 14px;background:#ffffff;">
          <div style="font-size:14px;font-weight:700;color:#1a2a5e;margin-bottom:10px;">Position ${index + 1}: Reparatur</div>
          <div style="margin-bottom:10px;">${deviceVisual}</div>
          <div style="font-size:13px;line-height:1.6;color:#2d3748;word-break:break-word;overflow-wrap:anywhere;">
            <div><strong>Gebuchte Leistungen:</strong> ${servicesDisplay}</div>
            <div><strong>Betrag:</strong> ${amount}</div>
          </div>
        </div>
      `.trim();
    }));

    return `${items.length} ${orderLabel}<br /><br />${lines.join('<br /><br />')}`;
  }

  static clampProgress(value) {
    const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    return Math.max(0, Math.min(100, Math.round(numericValue)));
  }

  static resolveOrderProgress(order) {
    const rawProgress = this.clampProgress(order?.progress || 0);
    const normalizedStatus = String(order?.status || '').toLowerCase();

    switch (normalizedStatus) {
      case 'pending':
        return Math.min(rawProgress, 24);
      case 'diagnosed':
      case 'awaiting-parts':
        return Math.max(25, Math.min(rawProgress || 25, 49));
      case 'in-progress':
      case 'paused':
      case 'on-hold':
        return Math.max(50, Math.min(rawProgress || 50, 74));
      case 'quality-check':
        return Math.max(75, Math.min(rawProgress || 75, 99));
      case 'ready-for-pickup':
      case 'completed':
        return 100;
      case 'cancelled':
        return 0;
      default:
        return rawProgress;
    }
  }

  static async getBookingShippingLabelMode() {
    const envMode = String(process.env.BOOKING_DHL_LABEL_MODE || '').trim().toLowerCase();

    if (envMode === 'dummy' || envMode === 'live') {
      return envMode;
    }

    try {
      const systemConfig = await SystemConfiguration.findOne({});
      const dhlIntegration = systemConfig?.integrations?.find(
        (integration) => integration.provider === 'DHL' &&
          integration.type === 'shipping' &&
          integration.isActive !== false &&
          !String(integration.name || '').toLowerCase().includes('returns')
      );

      const configuredMode = String(dhlIntegration?.settings?.bookingLabelMode || '').trim().toLowerCase();

      if (configuredMode === 'dummy' || configuredMode === 'live') {
        return configuredMode;
      }
    } catch (error) {
      console.error('BookingService: Failed to resolve booking label mode from configuration:', error.message);
    }

    return 'dummy';
  }

  static isDummyBookingTrackingNumber(trackingNumber) {
    return String(trackingNumber || '').startsWith('DHL-DUMMY-');
  }

  static buildDummyBookingTrackingNumber(booking) {
    const bookingReference = String(booking.bookingNumber || booking._id || 'BOOKING')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(-10);

    return `DHL-DUMMY-${bookingReference}-${Date.now().toString().slice(-6)}`;
  }

  static buildDummyBookingLabelUrl(booking, trackingNumber) {
    const customerName = booking.guestInfo?.isGuest
      ? `${booking.guestInfo.firstName || ''} ${booking.guestInfo.lastName || ''}`.trim()
      : 'Registered customer';

    const createdAt = new Date().toISOString();
    const pdfLines = [
      'BT',
      '/F1 18 Tf',
      '50 770 Td',
      '(McRepair.de DHL Dummy Shipping Label) Tj',
      '0 -28 Td',
      '/F1 12 Tf',
      `(Booking: ${this.escapePdfText(booking.bookingNumber || String(booking._id))}) Tj`,
      '0 -18 Td',
      `(Tracking: ${this.escapePdfText(trackingNumber)}) Tj`,
      '0 -18 Td',
      `(Customer: ${this.escapePdfText(customerName || 'N/A')}) Tj`,
      '0 -18 Td',
      `(Created: ${this.escapePdfText(createdAt)}) Tj`,
      '0 -30 Td',
      '(Placeholder label until live DHL integration is enabled.) Tj',
      'ET',
    ];

    const stream = pdfLines.join('\n');
    const pdfContent = this.buildMinimalPdfDocument(stream);

    return `data:application/pdf;base64,${Buffer.from(pdfContent, 'utf8').toString('base64')}`;
  }

  static buildMinimalPdfDocument(stream) {
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
      `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    const xrefRows = offsets
      .map((offset, index) => (index === 0
        ? '0000000000 65535 f '
        : `${String(offset).padStart(10, '0')} 00000 n `))
      .join('\n');

    pdf += `xref\n0 ${offsets.length}\n${xrefRows}\n`;
    pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  }

  static escapePdfText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  static buildDummyBookingTrackingInfo(booking) {
    const createdAt = booking.shippingCreatedAt || booking.createdAt || new Date();
    const estimatedDelivery = booking.estimatedDelivery || new Date(new Date(createdAt).getTime() + (3 * 24 * 60 * 60 * 1000));

    return {
      success: true,
      trackingNumber: booking.trackingNumber,
      status: 'pre-transit',
      description: booking.shippingStatusDescription || 'DHL-Dummy-Versandlabel wurde vorbereitet',
      estimatedDelivery,
      events: [
        {
          timestamp: createdAt,
          location: 'McRepair.de',
          status: 'label-created',
          description: 'DHL-Dummy-Versandlabel bei der Buchungsanlage vorbereitet',
        },
      ],
      origin: null,
      destination: null,
    };
  }

  static mapTrackingStatusToBookingStatus(trackingStatus = '') {
    const normalizedTrackingStatus = String(trackingStatus || '').trim().toLowerCase();

    const statusMapping = {
      'pre-transit': 'label-created',
      'pre_transit': 'label-created',
      'label-created': 'label-created',
      'label_created': 'label-created',
      'transit': 'in-transit',
      'in-transit': 'in-transit',
      'in_transit': 'in-transit',
      'out-for-delivery': 'out-for-delivery',
      'out_for_delivery': 'out-for-delivery',
      'outfordelivery': 'out-for-delivery',
      'delivered': 'delivered',
      'failure': 'failed',
      'failed': 'failed',
      'exception': 'failed',
    };

    return statusMapping[normalizedTrackingStatus] || '';
  }

  // Create a new booking from orders (consolidated from cart checkout)
  static async create(bookingData) {
    console.log('BookingService: Creating new booking with data:', bookingData);

    try {
      // Validate that at least one order exists
      if (!bookingData.orderIds || bookingData.orderIds.length === 0) {
        throw new Error('Für eine Buchung wird mindestens ein Auftrag benötigt.');
      }

      // Calculate totals from orders
      let orderGrossTotal = 0;
      let subtotal = 0;
      let tax = 0;
      let discount = 0;
      const items = [];
      const repairOrderIds = [];
      let shopProductOrderId = null;
      const loadedOrders = [];

      // Fetch all orders and calculate totals
      for (const orderId of bookingData.orderIds) {
        const order = await Order.findById(orderId);
        if (!order) {
          console.warn('BookingService: Order not found:', orderId);
          continue;
        }

        console.log('BookingService: Processing order:', order._id, 'Type:', order.deviceType);

        // Determine order type and add to appropriate list
        if (order.deviceType === 'Shop Products') {
          shopProductOrderId = order._id;
        } else {
          repairOrderIds.push(order._id);
        }

        // Calculate costs
        orderGrossTotal += Number(order.totalCost || 0);
        loadedOrders.push(order);

        // Build booking item from order
        let itemData = {
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          orderId: order._id,
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          status: order.status || 'pending',
          progress: order.progress || 0,
          cost: order.totalCost,
        };

        if (order.deviceType === 'Shop Products') {
          // Shop product order
          itemData.products = order.shopProducts.map(product => ({
            name: product.productId?.name || 'Unknown Product',
            quantity: product.quantity,
            price: product.priceAtOrder,
            totalPrice: product.priceAtOrder * product.quantity,
          }));
        } else {
          // Repair order
          itemData.device = `${order.deviceBrand} ${order.deviceModel}`;
          itemData.services = order.services.map(service => ({
            // Manuelle Positionen haben keine serviceId, nur ihren gespeicherten Namen.
            name: service.serviceId?.name || service.name || 'Reparaturservice',
            price: service.price,
            estimatedTime: service.estimatedTime,
          }));
        }

        items.push(itemData);
      }

      // Order prices are gross. Use the checkout calculation as the authoritative
      // financial snapshot so VAT is never added a second time during booking creation.
      // Steuerprofil nur noetig, wenn kein Checkout-Snapshot vorliegt (der Snapshot
      // enthaelt die MwSt. bereits nach Profil). Unlesbares Profil (null) = Standard.
      const needsTaxProfile = !Number.isFinite(Number(bookingData?.checkoutPricing?.total)) && loadedOrders.length > 0;
      const bookingTaxExempt = needsTaxProfile
        ? (await this.resolveCustomerTaxExempt(bookingData.customerId)) === true
        : false;
      const bookingPricing = this.resolveBookingPricing({
        orderGrossTotal,
        bookingData,
        orders: loadedOrders,
        taxExempt: bookingTaxExempt,
        // FIN-13: Standardsatz nur fuer Auftraege ohne gespeicherten Satz (sonst keine Abfrage).
        defaultTaxRate: needsTaxProfile
          ? await require('./orderService').resolveDefaultTaxRate(loadedOrders) // eslint-disable-line global-require
          : undefined,
      });
      ({ subtotal, discount, tax } = bookingPricing);
      const finalTotal = bookingPricing.totalCost;

      // Create booking data
      const booking = new Booking({
        customerId: bookingData.customerId,
        guestInfo: bookingData.guestInfo || undefined,
        orderIds: bookingData.orderIds,
        repairOrderIds: repairOrderIds,
        shopProductOrderId: shopProductOrderId,
        items: items,
        status: bookingData.status || 'pending',
        billingStatus: bookingData.billingStatus || 'unpaid',
        paymentStatus: bookingData.paymentStatus || 'pending',
        subtotal: subtotal,
        tax: tax,
        discount: discount,
        totalCost: finalTotal,
        appliedPromoCode: bookingData.appliedPromoCode || '',
        // Zahlungsart des Checkouts (DHL-12): das Schemafeld existierte, wurde aber nie
        // geschrieben. Nur die erlaubten Werte; alles andere bleibt leer (kein Raten).
        paymentMethod: this.normalizeBookingPaymentMethod(bookingData.paymentMethod),
        // Idempotenzschluessel des Checkouts (DHL-14): eine Wiederholung nach verlorener
        // Antwort liefert diese Buchung statt einer zweiten (inkl. zweitem DHL-Label).
        ...(bookingData.checkoutAttemptId ? { checkoutAttemptId: String(bookingData.checkoutAttemptId) } : {}),
      });

      const savedBooking = await booking.save();
      console.log('BookingService: Booking created successfully with ID:', savedBooking._id, 'Number:', savedBooking.bookingNumber);

      // Link booking to all orders
      console.log('BookingService: Linking booking to orders');
      for (const orderId of bookingData.orderIds) {
        await Order.findByIdAndUpdate(
          orderId,
          { bookingId: savedBooking._id },
          { new: true }
        );
      }

      console.log('BookingService: Booking creation completed. Total orders:', savedBooking.orderIds.length);

      // Versandlabel nur erzeugen, wenn mindestens eine Reparatur enthalten ist
      if (repairOrderIds.length > 0 && bookingData.createShippingLabel !== false) {
        try {
          const updatedBookingWithShipping = await this.createShippingLabelForBooking(savedBooking, {
            preferredOrderId: repairOrderIds[0] || bookingData.orderIds[0] || null,
          });
          if (updatedBookingWithShipping) {
            savedBooking.set(updatedBookingWithShipping.toObject ? updatedBookingWithShipping.toObject() : updatedBookingWithShipping);
          }
        } catch (shippingLabelError) {
          console.error('BookingService: Error creating inbound shipping label for booking (non-fatal):', shippingLabelError.message);
          // Nicht mehr nur ins Log (DHL-6): Grund am Verlauf festhalten und das Team
          // informieren. Der Kunde sieht im Einsendestatus "Erneut versuchen" bzw. einen
          // neutralen Hinweis - nie interne Konfigurationstexte.
          await this.recordAutomaticInboundLabelFailure(savedBooking, shippingLabelError);
        }
      } else {
        console.log(
          bookingData.createShippingLabel === false
            ? 'BookingService: Shipping label creation disabled for booking.'
            : 'BookingService: No repair orders in booking – no shipping label will be generated.'
        );
      }

      const bookingToReturn = savedBooking;

      // Send booking created notification email asynchronously
      setImmediate(async () => {
        try {
          const isGuestBooking = Boolean(bookingData?.guestInfo?.isGuest);
          let customerEmail = bookingData?.guestInfo?.email || '';
          let customerName = `${bookingData?.guestInfo?.firstName || ''} ${bookingData?.guestInfo?.lastName || ''}`.trim();

          if (!customerEmail && bookingData.customerId) {
            const customer = await User.findById(bookingData.customerId).select('firstName lastName email');
            if (customer?.email) {
              customerEmail = customer.email;
              customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
            }
          }

          if (!customerEmail) {
            return;
          }

          const itemSummary = await this.buildBookingOrdersSummary(savedBooking.items);

          // For emails, link to the bookings page (data: URLs don't work in email clients)
          const labelDataUrl = savedBooking.shippingLabelUrl || bookingToReturn?.shippingLabelUrl;
          const hasLabel = !!labelDataUrl;
          const guestTrackingPath = savedBooking.guestTrackingToken
            ? `/track-order/booking?token=${encodeURIComponent(savedBooking.guestTrackingToken)}&email=${encodeURIComponent(customerEmail)}`
            : '/track-order/booking';
          const trackingUrl = await EmailService.buildSystemUrl(
            isGuestBooking ? guestTrackingPath : '/bookings'
          );
          const shippingLabelUrl = hasLabel ? trackingUrl : '';

          // Build PDF attachment from base64 data URL if available
          const emailOptions = {};
          if (hasLabel && labelDataUrl) {
            const base64Match = labelDataUrl.match(/^data:application\/pdf;base64,(.+)$/);
            if (base64Match) {
              emailOptions.attachments = [{
                // Einheitlicher Dateiname wie beim Download (DHL-Einsendelabel_<BKG>.pdf);
                // Dummy-Modus: als Testlabel erkennbar.
                filename: this.inboundLabelFilename(savedBooking.bookingNumber || savedBooking._id, {
                  placeholder: this.isDummyBookingTrackingNumber(savedBooking.trackingNumber),
                }),
                content: Buffer.from(base64Match[1], 'base64'),
                contentType: 'application/pdf'
              }];
            }
          }

          const firstRepairItem = (savedBooking.items || []).find((item) => item?.type !== 'product');
          const primaryDevice = this.parseDeviceLabel(firstRepairItem?.device || '');

          await EmailService.sendTriggerEmail(isGuestBooking ? 'guest_booking_created' : 'booking_created', customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName: customerName || customerEmail,
            bookingNumber: savedBooking.bookingNumber,
            bookingDate: new Date(savedBooking.createdAt || Date.now()).toLocaleDateString('de-DE'),
            itemSummary,
            // FIN-4: "47,40 € (nach 2,50 € Rabatt, inkl. 7,57 € MwSt.)"; ohne bekannte
            // Steuer nur der Bruttobetrag (nie "0,00 € MwSt.").
            totalAmount: describeGross({
              gross: savedBooking.totalCost || 0,
              tax: Number(savedBooking.tax) > 0 ? savedBooking.tax : null,
              discount: savedBooking.discount || 0,
            }),
            bookingStatus: savedBooking.status,
            deviceBrand: primaryDevice.deviceBrand,
            deviceModel: primaryDevice.deviceModel,
            bookingUrl: trackingUrl,
            trackingUrl,
            shippingLabelUrl,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          }, emailOptions);
        } catch (notificationError) {
          console.error('BookingService: Error sending booking created email:', notificationError.message);
        }
      });

      return bookingToReturn;
    } catch (error) {
      console.error('BookingService: Error creating booking:', error);
      throw error;
    }
  }

  static async createShippingLabelForBooking(booking, options = {}) {
    if (!booking?._id) {
      return null;
    }

    // Das Buchungslabel ist ausschliesslich das EINSENDELABEL (Kunde -> McRepair, ein Paket
    // fuer alle Geraete der Buchung). Die AUSLIEFERUNG (McRepair -> Kunde) wird je Auftrag
    // erstellt ("An Kunden versenden"): so markiert ein fertiges Geraet nie die anderen
    // Geraete derselben Buchung als versendet. Eine Sammel-Auslieferung mehrerer Geraete in
    // einem Paket wird bewusst NICHT unterstuetzt und hier mit Erklaerung abgelehnt, statt
    // sie in das Einsendefeld der Buchung zu schreiben.
    const requestedDirection = this.resolveBookingLabelDirection(options.shipmentData || {});
    if (requestedDirection === 'outbound') {
      const error = new Error(
        'Die Auslieferung an den Kunden (McRepair → Kunde) wird je Auftrag erstellt: bitte im jeweiligen '
        + 'Auftrag „An Kunden versenden“ verwenden. Ein gemeinsames Paket für mehrere Geräte einer Buchung '
        + 'wird derzeit nicht unterstützt.'
      );
      error.status = 422;
      error.code = 'BOOKING_OUTBOUND_NOT_SUPPORTED';
      throw error;
    }

    if (booking.shippingLabelUrl && booking.trackingNumber) {
      // Altbestand: das Feld kann ein frueher erzeugtes Rueckweg-Label tragen. Das ist kein
      // Einsendelabel und darf weder als solches gemeldet noch ueberschrieben werden.
      if (this.resolveStoredShippingDirection(booking) === 'outbound') {
        const error = new Error(
          'An dieser Buchung ist bereits ein älteres Rückweg-Label (McRepair → Kunde) gespeichert. '
          + 'Ein Einsendelabel kann hier nicht zusätzlich abgelegt werden – bitte im Auftrag das Einsendelabel per DHL-Retoure erstellen.'
        );
        error.status = 409;
        error.code = 'BOOKING_LABEL_SLOT_OCCUPIED';
        throw error;
      }
      return booking;
    }

    // Sendungsnummer OHNE PDF: das Einsendelabel existiert bei DHL bereits (Abgleich
    // 'created' nach einer unklaren DHL-Antwort). Ein neues Label waere ein ZWEITES,
    // bezahltes Label und wuerde die abgeglichene Sendungsnummer ueberschreiben.
    if (String(booking.trackingNumber || '').trim() && !String(booking.shippingLabelUrl || '').trim()) {
      const error = new Error(
        `Für diese Buchung existiert bei DHL bereits ein Einsendelabel (Sendungsnummer ${String(booking.trackingNumber).trim()}). `
        + 'Das PDF bitte im DHL-Geschäftskundenportal abrufen – ein zweites Label wird nicht erstellt.'
      );
      error.status = 409;
      error.code = 'EXISTING_SHIPMENT_LABEL_MISSING';
      throw error;
    }

    // Eine DHL-Retoure an der Buchung IST bereits das Einsendelabel (gleiche Richtung
    // Kunde -> McRepair). Ein zusaetzliches Parcel-DE-Label waere ein zweites bezahltes Label.
    if (String(booking.returnLabelUrl || '').trim() || String(booking.returnTrackingNumber || '').trim()) {
      const error = new Error(
        `Für diese Buchung existiert bereits ein DHL-Einsendelabel (Retoure${booking.returnTrackingNumber ? `, Sendungsnummer ${booking.returnTrackingNumber}` : ''}). `
        + 'Ein zweites Label wird nicht erstellt.'
      );
      error.status = 409;
      error.code = 'INBOUND_LABEL_EXISTS';
      throw error;
    }

    const mode = await this.getBookingShippingLabelMode();
    if (mode === 'dummy') {
      return this.createDummyShippingLabelForBooking(booking, options);
    }
    return this.createLiveShippingLabelForBooking(booking, options);
  }

  /** Erlaubte Werte von Booking.paymentMethod; alles andere bleibt leer. */
  static normalizeBookingPaymentMethod(paymentMethod) {
    const value = String(paymentMethod || '').trim().toLowerCase();
    return ['card', 'paypal', 'invoice'].includes(value) ? value : '';
  }

  /**
   * Einheitlicher Dateiname des Einsendelabels (Kunde -> McRepair): DHL-Einsendelabel_<BKG|ORD>.pdf.
   * Testlabel des Dummy-Modus: DHL-Testlabel_<BKG>.pdf.
   */
  static inboundLabelFilename(reference, { placeholder = false } = {}) {
    const safe = String(reference || 'Buchung').replace(/[^A-Za-z0-9\-_]/g, '');
    return `${placeholder ? 'DHL-Testlabel' : 'DHL-Einsendelabel'}_${safe || 'Buchung'}.pdf`;
  }

  /**
   * Fehlgeschlagenes AUTOMATISCHES Einsendelabel beim Checkout (DHL-6): Verlaufseintrag mit
   * deutschem Grund + Hinweis an alle aktiven Administratoren. Laufende Erstellung (409) und
   * unklare DHL-Antwort (Sperre + Abgleich-Vermerk existieren bereits) werden nicht als
   * Fehler vermerkt. Wirft nie (die Buchung ist bereits angelegt).
   */
  static async recordAutomaticInboundLabelFailure(booking, labelError, { context = 'checkout' } = {}) {
    try {
      if (!booking?._id) return;
      if (labelError?.indeterminate || labelError?.code === 'LABEL_CREATION_IN_PROGRESS') return;
      const reason = String(labelError?.message || 'Unbekannter Fehler').slice(0, 500);
      const when = context === 'checkout' ? 'beim Checkout nicht automatisch' : 'auf Anforderung nicht';
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: { shippingStatusDescription: 'Einsendelabel konnte nicht automatisch erstellt werden' },
          $push: {
            timeline: {
              status: 'Shipping Label Failed',
              description: `Das DHL-Einsendelabel (Kunde an McRepair) konnte ${when} erstellt werden: ${reason}`,
              completedAt: new Date(),
              staffId: 'system',
              staffName: 'DHL Parcel Integration',
            },
          },
        }
      );

      const NotificationService = require('./notificationService');
      const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
      const bookingLabel = booking.bookingNumber || String(booking._id);
      // Hoechstens EIN Hinweis je Buchung und Tag (wiederholte Kundenversuche fluten sonst
      // alle Administratoren); Notification.dedupeKey mit partiellem eindeutigem Index.
      const dedupeKey = `inbound-label-failed:${booking._id}:${new Date().toISOString().slice(0, 10)}`;
      await Promise.all(admins.map((admin) => NotificationService.createNotification({
        userId: admin._id,
        title: 'Einsendelabel fehlt',
        message: `Für die Buchung ${bookingLabel} konnte das DHL-Einsendelabel ${when} erstellt werden. Grund: ${reason}`,
        type: 'system',
        // openBookingId = bestehender Deep-Link (App.tsx), oeffnet den Buchungsdialog direkt.
        actionUrl: `/admin/bookings?openBookingId=${booking._id}`,
        dedupeKey,
      }, { sendEmail: false }).catch((notifyError) => {
        console.error('BookingService: Could not notify admin about missing inbound label:', notifyError.message);
      })));
    } catch (recordError) {
      console.error('BookingService: Could not record inbound label failure:', recordError.message);
    }
  }

  /**
   * Einsendestatus einer Buchung (Kunde -> McRepair) fuer Kunde UND Team - EIN Lesemodell fuer
   * Bestellbestaetigung (/order-success), Auftragsdetail und Buchungsliste. Kein DHL-Aufruf,
   * kein Base64 in der Antwort. Sperr-, Platzhalter- und Richtungsregeln kommen aus DHLService
   * (dieselben wie in getOrderShipmentState), damit beide Ansichten nicht auseinanderlaufen.
   *
   * inbound.state:
   *   'ready'      PDF vorhanden (downloadUrl)
   *   'registered' bei DHL angelegt (Sendungsnummer), PDF liegt nicht vor
   *   'creating'   Erstellung laeuft gerade (Sperre)
   *   'review'     unklare DHL-Antwort bzw. verwaiste Sperre - Abgleich durch das Team
   *   'error'      automatische/angeforderte Erstellung fehlgeschlagen (canCreate = erneut versuchen)
   *   'none'       noch kein Label
   *   'not-needed' keine Reparatur in der Buchung (nur Shop-Artikel)
   *   'cancelled'  alle Reparaturauftraege storniert
   */
  static async getInboundLabelState(bookingId, { includeStaffFields = false } = {}) {
    const booking = await Booking.findById(bookingId)
      .setOptions({ skipAutoPopulate: true })
      .select('-shippingLabelUrl -returnLabelUrl -returnQRCodeUrl')
      .lean();
    if (!booking) return null;

    const nonEmpty = { $exists: true, $nin: [null, ''] };
    const orderIds = Array.isArray(booking.orderIds) ? booking.orderIds : [];
    const [parcelPdf, retourePdf, orders, ordersWithInboundPdf] = await Promise.all([
      Booking.exists({ _id: booking._id, shippingLabelUrl: nonEmpty }),
      Booking.exists({ _id: booking._id, returnLabelUrl: nonEmpty }),
      Order.find({ _id: { $in: orderIds } })
        .setOptions({ skipAutoPopulate: true })
        .select('orderNumber deviceBrand deviceModel deviceType status returnTrackingNumber returnShipmentStatus returnLabelCreationStartedAt timeline')
        .lean(),
      Order.find({ _id: { $in: orderIds }, returnLabelUrl: nonEmpty }).setOptions({ skipAutoPopulate: true }).select('_id').lean(),
    ]);

    return this.buildInboundLabelView({
      booking,
      parcelPdf: Boolean(parcelPdf),
      retourePdf: Boolean(retourePdf),
      orders,
      orderPdfIds: new Set(ordersWithInboundPdf.map((order) => String(order._id))),
      includeStaffFields,
    });
  }

  static buildInboundLabelView({ booking, parcelPdf, retourePdf, orders = [], orderPdfIds = new Set(), includeStaffFields = false }) {
    const bookingId = String(booking._id);
    const orderIndex = new Map((booking.orderIds || []).map((id, index) => [String(id), index]));
    const sortedOrders = [...orders].sort((a, b) => (orderIndex.get(String(a._id)) ?? 0) - (orderIndex.get(String(b._id)) ?? 0));
    const isProduct = (order) => order.deviceType === 'Shop Products';
    const repairOrders = sortedOrders.filter((order) => !isProduct(order));
    const activeRepairOrders = repairOrders.filter((order) => order.status !== 'cancelled');
    const deviceReceived = activeRepairOrders.some((order) => order.status && order.status !== 'pending');

    const ordersView = sortedOrders.map((order) => ({
      orderId: String(order._id),
      orderNumber: order.orderNumber || '',
      type: isProduct(order) ? 'product' : 'repair',
      device: isProduct(order) ? 'Shop-Artikel' : `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim(),
      status: order.status || 'pending',
    }));

    const bookingView = {
      _id: bookingId,
      bookingNumber: booking.bookingNumber || '',
      createdAt: booking.createdAt || null,
      status: booking.status || 'pending',
      totalCost: Number(booking.totalCost || 0),
      // Die Buchung kennt nur Euro; keine Umrechnung.
      currency: 'EUR',
      paymentStatus: booking.paymentStatus || 'pending',
      billingStatus: booking.billingStatus || 'unpaid',
      paymentMethod: booking.paymentMethod || '',
      deviceCount: repairOrders.length,
      isGuest: Boolean(booking.guestInfo?.isGuest),
    };

    const inbound = {
      state: 'none',
      canCreate: false,
      message: '',
      trackingNumber: '',
      downloadUrl: '',
      filename: '',
      source: '',
      placeholder: false,
      shippingStatus: '',
      deviceReceived,
      lastError: '',
    };
    const result = () => {
      const view = { booking: bookingView, orders: ordersView, inbound };
      if (!includeStaffFields) {
        delete inbound.lastError;
      }
      return view;
    };

    if (repairOrders.length === 0) {
      inbound.state = 'not-needed';
      inbound.message = 'Für Shop-Artikel ist keine Einsendung nötig. Wir senden Ihre Bestellung an Ihre Lieferadresse.';
      return result();
    }
    if (activeRepairOrders.length === 0 || booking.status === 'cancelled') {
      inbound.state = 'cancelled';
      inbound.message = 'Der Auftrag wurde storniert – bitte kein Gerät einsenden.';
      return result();
    }

    // Einsendeplaetze: Parcel-DE-Label der Buchung (nur Richtung Einsendung), Buchungs-
    // Retoure, Einsendung am Auftrag (Altbestand/ohne Buchung). Das erste mit PDF zaehlt.
    const direction = DHLService.resolveStoredBookingLabelDirection(booking);
    const slots = [];
    if (direction === 'inbound' && (parcelPdf || String(booking.trackingNumber || '').trim())) {
      slots.push({
        source: 'booking',
        hasPdf: parcelPdf,
        trackingNumber: booking.trackingNumber || '',
        status: booking.shippingStatus || '',
        downloadUrl: `/api/bookings/${bookingId}/shipping-label`,
        reference: booking.bookingNumber || bookingId,
      });
    }
    if (retourePdf || String(booking.returnTrackingNumber || '').trim()) {
      slots.push({
        source: 'booking-retoure',
        hasPdf: retourePdf,
        trackingNumber: booking.returnTrackingNumber || '',
        status: booking.returnShipmentStatus || '',
        downloadUrl: `/api/bookings/${bookingId}/return-label`,
        reference: booking.bookingNumber || bookingId,
      });
    }
    repairOrders.forEach((order) => {
      const hasPdf = orderPdfIds.has(String(order._id));
      if (hasPdf || String(order.returnTrackingNumber || '').trim()) {
        slots.push({
          source: 'order',
          orderId: String(order._id),
          hasPdf,
          trackingNumber: order.returnTrackingNumber || '',
          status: order.returnShipmentStatus || '',
          downloadUrl: `/api/orders/${order._id}/return-label`,
          reference: order.orderNumber || String(order._id),
        });
      }
    });
    const primary = slots.find((slot) => slot.hasPdf) || slots[0] || null;

    if (primary) {
      const placeholder = DHLService.isPlaceholderTrackingNumber(primary.trackingNumber);
      Object.assign(inbound, {
        state: primary.hasPdf ? 'ready' : 'registered',
        trackingNumber: primary.trackingNumber,
        downloadUrl: primary.hasPdf ? primary.downloadUrl : '',
        filename: primary.hasPdf ? this.inboundLabelFilename(primary.reference, { placeholder }) : '',
        source: primary.source,
        placeholder,
        shippingStatus: primary.status,
        message: primary.hasPdf
          ? (placeholder
            ? 'Testlabel – nicht für den Versand verwenden. Im Testmodus werden keine echten DHL-Labels erzeugt.'
            : 'Drucken Sie das kostenlose DHL-Einsendelabel aus und geben Sie das Paket bei DHL ab. Ein Paket für alle Geräte dieser Buchung.')
          : `Ihr DHL-Einsendelabel ist bei DHL angelegt${primary.trackingNumber ? ` (Sendungsnummer ${primary.trackingNumber})` : ''}. Das PDF senden wir Ihnen per E-Mail zu.`,
      });
      return result();
    }

    // Sperre an der Buchung bzw. an einem Auftrag (Retoure am Auftrag).
    const bookingLock = DHLService.describeBookingLabelLock(booking);
    const orderLocks = repairOrders.map((order) => DHLService.describeLabelLock({
      locked: String(order.returnShipmentStatus || '') === 'pending',
      startedAt: order.returnLabelCreationStartedAt,
      markerPresent: DHLService.hasPendingInboundReconciliation(order),
    }));
    const reviewRequired = bookingLock.reconciliationRequired || orderLocks.some((lock) => lock.reconciliationRequired);
    const creating = bookingLock.inProgress || orderLocks.some((lock) => lock.inProgress);
    if (reviewRequired) {
      inbound.state = 'review';
      inbound.message = 'Ihr Einsendelabel wird geprüft. Bitte nicht erneut erstellen – wir melden uns per E-Mail, sobald es bereitsteht.';
      if (includeStaffFields && bookingLock.reconciliationRequired) {
        inbound.reconcileUrl = `/api/bookings/${bookingId}/shipping/reconcile`;
        inbound.reconciliationReason = bookingLock.reconciliationReason;
      }
      return result();
    }
    if (creating) {
      inbound.state = 'creating';
      inbound.message = 'Ihr DHL-Einsendelabel wird erstellt …';
      return result();
    }

    if (deviceReceived) {
      inbound.state = 'none';
      inbound.message = 'Ihr Gerät ist bereits bei uns eingegangen – ein Einsendelabel ist nicht mehr nötig.';
      return result();
    }
    if (direction === 'outbound' && String(booking.trackingNumber || '').trim()) {
      // Altbestand: der Buchungsplatz traegt ein Rueckweg-Label. Das Team erstellt die
      // Einsendung als Retoure am Auftrag.
      inbound.state = 'none';
      inbound.message = 'Bitte kontaktieren Sie uns – wir erstellen Ihr Einsendelabel für Sie.';
      return result();
    }

    const timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
    const timeOf = (entry) => new Date(entry?.completedAt || 0).getTime() || 0;
    const lastFailure = timeline.filter((entry) => entry?.status === 'Shipping Label Failed')
      .reduce((latest, entry) => (timeOf(entry) >= timeOf(latest) ? entry : latest), null);
    const lastSettled = Math.max(0, ...timeline
      .filter((entry) => ['Shipping Label Created', 'Shipping Label Prepared', 'Shipping Label Reconciled', 'Return Label Created'].includes(entry?.status))
      .map(timeOf));

    inbound.canCreate = true;
    if (lastFailure && timeOf(lastFailure) >= lastSettled) {
      inbound.state = 'error';
      inbound.message = 'Das Einsendelabel konnte noch nicht erstellt werden. Sie können es jetzt erneut anfordern.';
      inbound.lastError = String(lastFailure.description || '');
    } else {
      inbound.state = 'none';
      inbound.message = 'Für diese Buchung wurde noch kein DHL-Einsendelabel erstellt. Das Label ist für Sie kostenlos.';
    }
    return result();
  }

  /**
   * "DHL-Einsendelabel erstellen" durch den Buchungsinhaber oder das Team (DHL-6), wenn das
   * automatische Label fehlt bzw. fehlgeschlagen ist. Hoechstens EIN Label je Buchung: es
   * laeuft ueber createShippingLabelForBooking mit derselben atomaren Sperre wie der Checkout.
   * Der Request-Body wird bewusst ignoriert (keine Adressen/Produkte vom Kunden).
   * Wirft Fehler mit status/code; fuer Kunden (actor.role customer) mit neutralem Text.
   */
  static async createInboundLabelForBooking(bookingId, actor = {}) {
    const isStaff = ['admin', 'staff'].includes(String(actor?.role || ''));
    const fail = (status, code, message) => {
      const error = new Error(message);
      error.status = status;
      error.code = code;
      return error;
    };

    const before = await this.getInboundLabelState(bookingId, { includeStaffFields: true });
    if (!before) throw fail(404, 'BOOKING_NOT_FOUND', 'Buchung wurde nicht gefunden.');
    const { inbound } = before;
    if (inbound.state === 'ready' || inbound.state === 'registered') {
      return { created: false, alreadyExists: true };
    }
    if (inbound.state === 'creating') {
      throw fail(409, 'LABEL_CREATION_IN_PROGRESS', 'Ihr DHL-Einsendelabel wird gerade erstellt. Bitte einen Moment warten.');
    }
    if (inbound.state === 'review') {
      throw fail(409, 'LABEL_RECONCILIATION_REQUIRED', 'Ihr Einsendelabel wird geprüft. Bitte nicht erneut erstellen – wir melden uns per E-Mail.');
    }
    if (inbound.state === 'not-needed') {
      throw fail(422, 'INBOUND_NOT_NEEDED', inbound.message);
    }
    if (inbound.state === 'cancelled') {
      throw fail(409, 'BOOKING_CANCELLED', inbound.message);
    }
    if (!inbound.canCreate) {
      throw fail(409, 'INBOUND_NOT_ALLOWED', inbound.message || 'Für diese Buchung kann derzeit kein Einsendelabel erstellt werden.');
    }

    const booking = await Booking.findById(bookingId);
    const preferredOrder = before.orders.find((order) => order.type === 'repair' && order.status !== 'cancelled');
    try {
      await this.createShippingLabelForBooking(booking, {
        preferredOrderId: preferredOrder?.orderId || null,
        actor,
        shipmentData: { labelDirection: 'inbound' },
      });
      return { created: true, alreadyExists: false };
    } catch (labelError) {
      console.error('BookingService: Inbound label on request failed:', labelError.message);
      if (labelError?.code === 'LABEL_CREATION_IN_PROGRESS') {
        throw fail(409, 'LABEL_CREATION_IN_PROGRESS', 'Ihr DHL-Einsendelabel wird gerade erstellt. Bitte einen Moment warten.');
      }
      if (labelError?.indeterminate || labelError?.code === 'DHL_RESULT_UNKNOWN') {
        throw fail(409, 'DHL_RESULT_UNKNOWN', 'Ihr Einsendelabel wird geprüft. Bitte nicht erneut erstellen – wir melden uns per E-Mail, sobald es bereitsteht.');
      }
      await this.recordAutomaticInboundLabelFailure(booking, labelError, { context: 'manual' });
      if (isStaff) {
        const status = Number.isInteger(labelError?.status) ? labelError.status : 500;
        throw fail(status, labelError?.code || 'LABEL_CREATION_FAILED', labelError?.message || 'Das Einsendelabel konnte nicht erstellt werden.');
      }
      const message = String(labelError?.message || '');
      // Konfigurationsfehler (Integration, Abrechnungsnummer, Shop-Anschrift) gehen nie als
      // Text an den Kunden; das Team wurde oben benachrichtigt. Zuerst der Fehlercode der
      // Wurfstelle (createLiveShippingLabelForBooking), nur ohne Code die Textsuche (Altpfade).
      const code = String(labelError?.code || '');
      const CONFIG_CODES = ['SHOP_ADDRESS_INCOMPLETE', 'DHL_CONFIG_INCOMPLETE', 'DHL_NOT_ACTIVE'];
      const ADDRESS_CODES = ['CUSTOMER_ADDRESS_INCOMPLETE', 'DHL_PAYLOAD_INVALID'];
      const configProblem = CONFIG_CODES.includes(code)
        || (!ADDRESS_CODES.includes(code) && /Abrechnungsnummer|Integration|Shop-Adresse|nicht aktiv|EKP|deaktiviert/i.test(message));
      const addressProblem = !configProblem
        && (ADDRESS_CODES.includes(code) || /Hausnummer|Rechnungsadresse|Absenderdaten|Straße|PLZ/i.test(message));
      if (addressProblem) {
        throw fail(422, 'CUSTOMER_ADDRESS_INCOMPLETE', 'Bitte prüfen Sie Ihre Rechnungsadresse (Straße mit Hausnummer, PLZ, Ort) im Profil und versuchen Sie es dann erneut.');
      }
      throw fail(503, 'INBOUND_LABEL_UNAVAILABLE', 'Das Einsendelabel kann gerade nicht erstellt werden. Unser Team wurde informiert und meldet sich bei Ihnen.');
    }
  }

  static splitStreetAndHouse(rawStreet = '') {
    const value = String(rawStreet || '').trim();
    if (!value) {
      return { street: '', house: '' };
    }

    const match = value.match(/^(.*?)(\s+(\d+[\w\-\/]*)?)$/);
    if (match && match[1]) {
      return {
        street: String(match[1]).trim(),
        house: String(match[3] || '').trim(),
      };
    }

    return { street: value, house: '' };
  }

  static resolveBookingReceiverAddress(order, booking) {
    const orderShipping = order?.shippingAddress || {};
    const orderGuestShipping = order?.guestInfo?.shippingAddress || {};
    const bookingGuestShipping = booking?.guestInfo?.shippingAddress || {};
    const bookingGuestBilling = booking?.guestInfo?.billingAddress || {};
    const customerInvoice = order?.customerId?.invoiceAddress || {};

    const streetCandidate =
      orderShipping.street ||
      orderGuestShipping.street ||
      bookingGuestShipping.street ||
      bookingGuestBilling.street ||
      customerInvoice.street ||
      '';

    const houseCandidate = orderShipping.number || orderGuestShipping.number || bookingGuestShipping.number || '';
    const streetInfo = this.splitStreetAndHouse(streetCandidate);

    return {
      street: streetInfo.street || streetCandidate,
      house: streetInfo.house || houseCandidate || '',
      city:
        orderShipping.city ||
        orderGuestShipping.city ||
        bookingGuestShipping.city ||
        bookingGuestBilling.city ||
        customerInvoice.city ||
        '',
      postalCode:
        orderShipping.zipCode ||
        orderGuestShipping.zipCode ||
        bookingGuestShipping.zipCode ||
        bookingGuestBilling.zipCode ||
        customerInvoice.zipCode ||
        '',
      country:
        orderShipping.country ||
        orderGuestShipping.country ||
        bookingGuestShipping.country ||
        bookingGuestBilling.country ||
        customerInvoice.country ||
        'DE',
    };
  }

  /**
   * Richtung des Buchungslabels.
   *
   * 'inbound'  = Einsendelabel: KUNDE (Absender) -> McRepair (Empfaenger). Das ist die
   *              Bedeutung von `booking.trackingNumber` im gesamten Produkt
   *              ("Versand an McRepair (Hinweg)", "Sendung des Kunden an McRepair").
   * 'outbound' = Ruecksendung des reparierten Geraets: McRepair -> KUNDE.
   *
   * Die Richtung ist eine ANGABE DES AUFRUFERS und darf niemals daraus entstehen, in
   * welcher Reihenfolge Adressbloecke zusammengefuehrt werden.
   */
  static resolveBookingLabelDirection(requestedShipmentData = {}) {
    const requested = String(requestedShipmentData?.labelDirection || '').trim().toLowerCase();
    if (requested === 'inbound' || requested === 'outbound') {
      return requested;
    }
    // "Shop-Adresse kommt vom Server" kann nur fuer die Seite gelten, auf welcher der
    // Shop steht: als Absender ist es ein Hinweg an den Kunden, als Empfaenger ein
    // Einsendelabel.
    if (requestedShipmentData?.shipperFromConfiguration === true) return 'outbound';
    if (requestedShipmentData?.receiverFromConfiguration === true) return 'inbound';
    return 'inbound';
  }

  /**
   * Richtung des BEREITS GESPEICHERTEN Buchungslabels (Lesepfad, fuer die Beschriftung
   * der Versandkarte).
   *
   * Es gibt kein eigenes Feld dafuer (Booking.trackingNumber traegt beide Richtungen),
   * und `shippingStatusDescription` wird von jedem Live-Tracking-Abgleich ueberschrieben.
   * Dauerhaft ist allein der Timeline-Eintrag, den createLiveShippingLabelForBooking beim
   * Anlegen schreibt ('... (Hinweg: Kunde an McRepair)' bzw. '(Rückweg: McRepair an Kunde)';
   * Altbestand: '(inbound: customer -> shop)' / '(outbound: shop -> customer)').
   * Ohne Treffer gilt 'inbound': das automatische Einsendelabel und das Dummy-Label
   * ('Shipping Label Prepared') sind immer Kunde -> McRepair.
   */
  /** Deutsche Bezeichnung eines Buchungsstatus - kein roher Enum-Wert im Verlauf. */
  static bookingStatusLabel(status) {
    const labels = {
      'pending': 'Ausstehend',
      'payment-pending': 'Zahlung ausstehend',
      'confirmed': 'Bestätigt',
      'processing': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'cancelled': 'Storniert',
    };
    return labels[String(status || '')] || String(status || 'Unbekannt');
  }

  /** Deutsche Bezeichnung eines Zahlungsstatus - kein roher Enum-Wert im Verlauf. */
  static billingStatusLabel(billingStatus) {
    const labels = {
      'unpaid': 'Offen',
      'partially-paid': 'Teilbezahlt',
      'partially_paid': 'Teilbezahlt',
      'paid': 'Bezahlt',
      'overdue': 'Überfällig',
      'cancelled': 'Storniert',
      'refunded': 'Erstattet',
      'draft': 'Entwurf',
      'sent': 'Gesendet',
    };
    return labels[String(billingStatus || '')] || String(billingStatus || 'Unbekannt');
  }

  /**
   * Kundenprojektion des Buchungsverlaufs (K04, Review DHL-6): Positivliste statt Rohdaten.
   * Interne Eintraege (fehlgeschlagenes Label mit technischem Grund, Abgleich-Vermerke,
   * verwaiste Labels) und Akteursfelder gehen nie an Kunden. Erlaubt sind
   *  - Buchungs-/Zahlungsstatuswechsel (Text neu aus dem Statuswert, nie die gespeicherte
   *    Beschreibung, die das Team frei setzen kann),
   *  - Versand-/Einsendestatus von DHL (Sendungsstatus-Text),
   *  - die kundensichtbaren Schluessel des Verlaufsvertrags (OrderHistory.toCustomerView).
   * Felder wie bei OrderHistory.toCustomerView: _id, status, title, description, completedAt, type.
   */
  static toCustomerTimeline(timeline) {
    const OrderHistory = require('../utils/orderHistory');
    const BOOKING_STATUS_VALUES = ['pending', 'payment-pending', 'confirmed', 'processing', 'completed', 'cancelled'];
    const BILLING_STATUS_VALUES = ['unpaid', 'partially-paid', 'partially_paid', 'paid', 'overdue', 'refunded', 'draft', 'sent'];
    const TRACKING_STATUS_KEYS = ['Shipping Status Updated', 'Return Status Updated'];
    const isoOrNull = (value) => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    };
    return (Array.isArray(timeline) ? timeline : []).flatMap((entry) => {
      if (!entry) return [];
      const status = String(entry.status || '');
      const base = { _id: entry._id ? String(entry._id) : undefined, status, completedAt: isoOrNull(entry.completedAt) };
      if (BOOKING_STATUS_VALUES.includes(status)) {
        return [{ ...base, title: 'Status geändert', description: `Status der Buchung: ${BookingService.bookingStatusLabel(status)}`, type: 'status' }];
      }
      if (BILLING_STATUS_VALUES.includes(status)) {
        return [{ ...base, title: 'Zahlungsstatus geändert', description: `Zahlungsstatus: ${BookingService.billingStatusLabel(status)}`, type: 'payment' }];
      }
      if (TRACKING_STATUS_KEYS.includes(status)) {
        return [{ ...base, title: 'Versandstatus aktualisiert', description: String(entry.description || '').slice(0, 300), type: 'shipping' }];
      }
      // Der Buchungsplatz traegt meist das Einsendelabel (Hinweg); die Richtung steht im Text.
      if (status === 'Shipping Label Created' && /Hinweg|inbound/i.test(String(entry.description || ''))) {
        return [{ ...base, title: 'DHL-Einsendelabel erstellt', description: 'Ihr DHL-Einsendelabel wurde erstellt.', type: 'shipping' }];
      }
      return OrderHistory.toCustomerView([entry]);
    });
  }

  static resolveStoredShippingDirection(booking) {
    // Neue Eintraege sind deutsch ('Rückweg'/'Hinweg'), Altbestand englisch
    // ('outbound'/'inbound') - die Auswertung liegt an EINER Stelle in DHLService.
    return DHLService.resolveStoredBookingLabelDirection(booking);
  }

  /**
   * Die Shop-Anschrift aus der aktiven DHL-Integration - EINE Quelle, Strasse und
   * Hausnummer immer als Paar. Wird gebraucht, weil der Endpunkt auch von Mitarbeitenden
   * aufgerufen wird, die die (nur fuer Administratoren lesbare) Integrationseinstellung
   * selbst nicht lesen koennen und deshalb nur ein Flag schicken.
   */
  static resolveConfiguredShopAddress(dhlConfig) {
    // EINE Quelle fuer die Shop-Anschrift: DHLService (auch die Auslieferung nutzt sie).
    // Nur Kontaktdaten erhalten hier - wie bisher - eine Vorgabe, weil DHL sie beim
    // Einsendelabel als Empfaengerkontakt akzeptiert; Adressfelder werden nie erfunden.
    const shop = DHLService.resolveConfiguredShopAddress(dhlConfig);
    return {
      ...shop,
      email: shop.email || process.env.SUPPORT_EMAIL || 'info@mcrepair.de',
      phone: shop.phone || '+49301234567',
    };
  }

  /** Deutsche Namen der fehlenden Pflichtfelder der Shop-Anschrift (leer = vollstaendig). */
  static missingShopAddressFields(shopAddress = {}) {
    return [
      ['Straße', shopAddress.street],
      ['Hausnummer', shopAddress.house],
      ['PLZ', shopAddress.postalCode],
      ['Ort', shopAddress.city],
    ].filter(([, value]) => !String(value || '').trim()).map(([field]) => field);
  }

  static buildBookingShipmentData(order, booking, dhlConfig, direction = 'inbound') {
    const parcelDeConfig = DHLService.getParcelDEConfig(dhlConfig);
    const customerAddress = order?.customerId?.invoiceAddress ||
      order?.guestInfo?.shippingAddress ||
      booking?.guestInfo?.shippingAddress ||
      booking?.guestInfo?.billingAddress || {};
    const customerStreet = this.splitStreetAndHouse(customerAddress.street || '');

    const customerName =
      `${order?.customerId?.firstName || ''} ${order?.customerId?.lastName || ''}`.trim() ||
      order?.customerId?.name ||
      `${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim() ||
      `${booking?.guestInfo?.firstName || ''} ${booking?.guestInfo?.lastName || ''}`.trim() ||
      'Customer';

    const customerEmail =
      order?.customerId?.email ||
      order?.guestInfo?.email ||
      booking?.guestInfo?.email ||
      '';

    const customerPhone =
      order?.customerId?.phone ||
      order?.guestInfo?.phone ||
      booking?.guestInfo?.phone ||
      '';

    const accountNumber =
      dhlConfig?.settings?.accountId ||
      dhlConfig?.settings?.accountNumber ||
      dhlConfig?.metadata?.accountNumber ||
      dhlConfig?.credentials?.accountNumber ||
      dhlConfig?.credentials?.accountId ||
      parcelDeConfig.accountNumber ||
      '';

    const weight = Number(order?.weight || 1);

    // Beide Parteien werden EINMAL gebaut und danach der Richtung zugeordnet. Frueher
    // war der Kunde fest der Absender und der Shop fest der Empfaenger; ein Aufrufer, der
    // beide Bloecke vollstaendig mitschickte, hat die Richtung dadurch stillschweigend
    // umgedreht. Jetzt entscheidet ausschliesslich `direction`.
    const shop = this.resolveConfiguredShopAddress(dhlConfig);
    const customerParty = {
      name: customerName,
      // Keine erfundene Hausnummer: Strasse und Hausnummer stammen aus DERSELBEN
      // Anschrift, sonst entsteht ein zustellbar aussehendes, falsches Label.
      street: customerStreet.street || String(customerAddress.street || '').trim(),
      house: customerStreet.house || String(customerAddress.number || '').trim(),
      city: customerAddress.city || '',
      postalCode: customerAddress.zipCode || '',
      country: customerAddress.country || 'DE',
      email: customerEmail,
      phone: customerPhone,
    };

    const normalizedDirection = direction === 'outbound' ? 'outbound' : 'inbound';
    const sender = normalizedDirection === 'outbound' ? shop : customerParty;
    const recipient = normalizedDirection === 'outbound' ? customerParty : shop;

    return {
      labelDirection: normalizedDirection,
      shipperName: sender.name,
      shipperStreet: sender.street,
      shipperNumber: sender.house,
      shipperCity: sender.city,
      shipperPostalCode: sender.postalCode,
      shipperCountry: sender.country || 'DE',
      shipperEmail: sender.email,
      shipperPhone: sender.phone,
      receiverName: recipient.name,
      receiverAddress: recipient.street,
      receiverNumber: recipient.house,
      receiverCity: recipient.city,
      receiverPostalCode: recipient.postalCode,
      receiverCountry: recipient.country || 'DE',
      receiverEmail: recipient.email,
      receiverPhone: recipient.phone,
      profile: dhlConfig?.settings?.profile || dhlConfig?.metadata?.profile || parcelDeConfig.profile,
      product: dhlConfig?.settings?.product || dhlConfig?.metadata?.product || parcelDeConfig.product,
      accountNumber,
      shipmentDate: new Date().toISOString().slice(0, 10),
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      shippingCost: Number(booking?.shippingCost || 0),
    };
  }

  static normalizeEntityId(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value._id) return String(value._id);
    if (typeof value.toString === 'function') return String(value.toString());
    return '';
  }

  /**
   * HIST-LABEL: Das Einsendelabel der Buchung gilt fuer alle Geraete der Buchung, der
   * Auftragsverlauf (Kunde und Team) liest aber nur order.timeline. Daher EIN Eintrag
   * 'Inbound Label Created' je Reparaturauftrag der Buchung - nur fuer neu erstellte Labels,
   * idempotent ueber eventKey, kein Nachtrag fuer Altbestand. Ein Fehler hier macht das
   * bereits erstellte Label nicht ungueltig (nur protokolliert).
   */
  static async recordInboundLabelOnOrders(bookingId, { trackingNumber = '', actor = null, at = new Date(), test = false } = {}) {
    try {
      const OrderHistory = require('../utils/orderHistory'); // eslint-disable-line global-require
      const booking = await Booking.findById(bookingId).setOptions({ skipAutoPopulate: true })
        .select('repairOrderIds orderIds items.type items.orderId').lean();
      if (!booking) return 0;
      const toIds = (list) => (Array.isArray(list) ? list : []).map((id) => this.normalizeEntityId(id)).filter(Boolean);
      let orderIds = toIds(booking.repairOrderIds);
      if (orderIds.length === 0) {
        orderIds = toIds((booking.items || []).filter((item) => item && item.type === 'repair').map((item) => item.orderId));
      }
      if (orderIds.length === 0) orderIds = toIds(booking.orderIds);
      const actorFields = DHLService.timelineActor(actor);
      let written = 0;
      for (const orderId of [...new Set(orderIds)]) {
        // Eigener Schluessel: 'Inbound Label Created' beendet im Auftragsverlauf einen offenen
        // Retoure-Abgleich (DHLService.hasPendingInboundReconciliation) - das Buchungslabel darf das nicht.
        const historyEntry = OrderHistory.entry({
          key: 'Booking Inbound Label Created',
          type: 'shipping',
          description: `${test ? 'DHL-Testlabel' : 'DHL-Einsendelabel'} der Buchung (Kunde → McRepair) erstellt. Sendungsnummer: ${trackingNumber || 'noch offen'}`,
          actor: { id: actorFields.staffId, name: actorFields.staffName },
          source: actorFields.source,
          refs: { bookingId, trackingNumber },
          visibility: 'customer',
          eventKey: `booking-inbound-label:${bookingId}:${trackingNumber || 'pending'}`,
          at,
        });
        const { filter, update } = OrderHistory.updateFor(historyEntry, { _id: orderId });
        const result = await Order.updateOne(filter, update);
        written += Number(result?.modifiedCount || 0);
      }
      return written;
    } catch (error) {
      console.error('BookingService: Einsendelabel konnte nicht im Auftragsverlauf vermerkt werden:', error.message);
      return 0;
    }
  }

  static async createDummyShippingLabelForBooking(booking, options = {}) {
    const refreshedBooking = await Booking.findById(booking._id).setOptions({ skipAutoPopulate: true })
      .select('bookingNumber guestInfo estimatedDelivery').lean();

    if (!refreshedBooking) {
      throw new Error('Die Buchung wurde nach dem Anlegen nicht mehr gefunden.');
    }

    const trackingNumber = this.buildDummyBookingTrackingNumber(refreshedBooking);
    const shippingCreatedAt = new Date();
    const actorFields = DHLService.timelineActor(options.actor, 'DHL Dummy Integration');

    // Atomar (DHL-6): EIN Schreibzugriff, der nur greift, solange kein Einsendelabel und keine
    // laufende Erstellung existiert. Ein Doppelklick erzeugt damit nie zwei Sendungsnummern.
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        shippingLabelCreationInProgress: { $ne: true },
        shippingLabelUrl: { $in: ['', null] },
        trackingNumber: { $in: ['', null] },
        returnLabelUrl: { $in: ['', null] },
        returnTrackingNumber: { $in: ['', null] },
      },
      {
        $set: {
          trackingNumber,
          carrier: 'DHL',
          shippingStatus: 'label-created',
          shippingStatusDescription: 'DHL-Dummy-Versandlabel wurde vorbereitet',
          shippingLabelUrl: this.buildDummyBookingLabelUrl(refreshedBooking, trackingNumber),
          estimatedDelivery: refreshedBooking.estimatedDelivery || new Date(shippingCreatedAt.getTime() + (3 * 24 * 60 * 60 * 1000)),
          shippingCreatedAt,
          updatedAt: shippingCreatedAt,
        },
        $push: {
          timeline: {
            status: 'Shipping Label Prepared',
            description: `DHL-Dummy-Versandlabel für die Buchung vorbereitet (Hinweg: Kunde an McRepair). Sendungsnummer: ${trackingNumber}`,
            completedAt: shippingCreatedAt,
            staffId: actorFields.staffId,
            staffName: actorFields.staffName,
          },
        },
      },
      { new: true }
    );

    if (claimed) {
      await this.recordInboundLabelOnOrders(booking._id, {
        trackingNumber, actor: options.actor, at: shippingCreatedAt, test: true,
      });
      return claimed;
    }

    // Kein Treffer: inzwischen existiert ein Label (paralleler Aufruf) - dann ist es das
    // Ergebnis; sonst laeuft gerade eine Erstellung.
    const current = await Booking.findById(booking._id);
    if (current && String(current.trackingNumber || '').trim() && String(current.shippingLabelUrl || '').trim()) {
      return current;
    }
    const error = new Error('Das Einsendelabel dieser Buchung wird bereits erstellt oder ist schon vorhanden. Bitte die Seite neu laden.');
    error.status = 409;
    error.code = 'LABEL_CREATION_IN_PROGRESS';
    throw error;
  }

  /**
   * Fuehrt die vom Aufrufer gelieferten Versanddaten mit den serverseitigen
   * Vorgaben zusammen.
   *
   * Frueher war das ein blankes `{...default, ...requested}`. Das Dialogformular
   * schickt jedes Feld mit, auch leere und vorbefuellte - dadurch hat ein leeres
   * Feld die korrekte Vorgabe ueberschrieben (der Versand scheiterte an leerer
   * shipperCity/shipperPostalCode), und die im Formular vorbefuellte KUNDEN-Adresse
   * hat den vorgesehenen Empfaenger (die Werkstatt) verdraengt.
   *
   * Regeln:
   *  - Ein leerer/nicht gesetzter Wert ueberschreibt NIE eine Vorgabe.
   *  - Adressbloecke (Empfaenger/Absender) werden als GANZES uebernommen oder gar
   *    nicht: ein Aufrufer, der nur die Haelfte liefert, erzeugt sonst eine
   *    Mischadresse aus zwei verschiedenen Parteien. Vollstaendig heisst:
   *    Strasse + Ort + PLZ sind gesetzt.
   *  - Einzelfelder ohne Adressbezug (Gewicht, Masse, Produkt, Versanddatum ...)
   *    werden wie bisher uebernommen, sobald sie gesetzt sind.
   *  - `shipperFromConfiguration` / `receiverFromConfiguration`: der Aufrufer kann die
   *    Shop-Adresse nicht lesen (die Integrationseinstellungen sind nur fuer
   *    Administratoren sichtbar) und ueberlaesst diese Seite dem Server. Der
   *    entsprechende Block kommt dann AUSSCHLIESSLICH aus der Vorgabe; Felder aus dem
   *    Request werden fuer diese Seite ignoriert.
   */
  static mergeBookingShipmentData(defaultShipmentData = {}, requestedShipmentData = {}) {
    const isSet = (value) => String(value ?? '').trim() !== '';
    const merged = { ...defaultShipmentData };
    const shipperFromConfiguration = requestedShipmentData?.shipperFromConfiguration === true;
    const receiverFromConfiguration = requestedShipmentData?.receiverFromConfiguration === true;

    const addressGroups = {
      receiver: ['receiverName', 'receiverAddress', 'receiverNumber', 'receiverCity', 'receiverPostalCode', 'receiverCountry', 'receiverEmail', 'receiverPhone'],
      shipper: ['shipperName', 'shipperStreet', 'shipperAddress', 'shipperNumber', 'shipperCity', 'shipperPostalCode', 'shipperCountry', 'shipperEmail', 'shipperPhone', 'shipperCompany'],
    };
    const groupedKeys = new Set([...addressGroups.receiver, ...addressGroups.shipper]);

    // 1. Einzelfelder ausserhalb der Adressbloecke.
    Object.entries(requestedShipmentData).forEach(([key, value]) => {
      if (groupedKeys.has(key)) return;
      if (!isSet(value) && typeof value !== 'number' && typeof value !== 'boolean') return;
      merged[key] = value;
    });

    // 2. Adressbloecke nur komplett.
    const receiverComplete = !receiverFromConfiguration
      && isSet(requestedShipmentData.receiverAddress)
      && isSet(requestedShipmentData.receiverCity)
      && isSet(requestedShipmentData.receiverPostalCode);
    if (receiverComplete) {
      addressGroups.receiver.forEach((key) => {
        if (isSet(requestedShipmentData[key])) merged[key] = requestedShipmentData[key];
      });
    }

    const shipperStreetCandidate = requestedShipmentData.shipperStreet || requestedShipmentData.shipperAddress;
    const shipperComplete = !shipperFromConfiguration
      && isSet(shipperStreetCandidate)
      && isSet(requestedShipmentData.shipperCity)
      && isSet(requestedShipmentData.shipperPostalCode);
    if (shipperComplete) {
      addressGroups.shipper.forEach((key) => {
        if (isSet(requestedShipmentData[key])) merged[key] = requestedShipmentData[key];
      });
      merged.shipperStreet = shipperStreetCandidate;
    }

    // DHL-Produkt: auch ein reiner serviceType des Aufrufers wird honoriert.
    merged.product = requestedShipmentData.product
      || requestedShipmentData.serviceType
      || defaultShipmentData.product;

    return merged;
  }

  static async createLiveShippingLabelForBooking(booking, options = {}) {
    const dhlConfig = await DHLService.getDHLConfig();
    if (!dhlConfig?.isActive) {
      throw new Error('Die DHL-Versandintegration ist nicht aktiv. Bitte unter Systemkonfiguration → Integrationen → DHL aktivieren.');
    }

    const preferredOrderId = this.normalizeEntityId(options.preferredOrderId);
    const candidateOrderIds = [
      preferredOrderId,
      ...(Array.isArray(booking.repairOrderIds) ? booking.repairOrderIds.map((id) => this.normalizeEntityId(id)) : []),
      ...(Array.isArray(booking.orderIds) ? booking.orderIds.map((id) => this.normalizeEntityId(id)) : []),
    ].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);

    if (candidateOrderIds.length === 0) {
      throw new Error('Zu dieser Buchung ist kein Auftrag hinterlegt, für den ein DHL-Versandlabel erstellt werden kann.');
    }

    // Atomare Sperre an der BUCHUNG: das Einsendelabel wird nicht mehr am Auftrag abgelegt,
    // also schuetzt die Buchung selbst vor Doppelklick und parallelen Aufrufen.
    const claimedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        shippingLabelCreationInProgress: { $ne: true },
        shippingLabelUrl: { $in: ['', null] },
        // Auch eine abgeglichene Sendungsnummer ohne PDF ist ein vorhandenes Label.
        trackingNumber: { $in: ['', null] },
        // Eine Buchungs-Retoure ist dieselbe Einsendung - symmetrisch zu
        // DHLReturnsService.createReturnLabel (DHL-3).
        returnLabelUrl: { $in: ['', null] },
        returnTrackingNumber: { $in: ['', null] },
      },
      // updatedAt = Beginn der Sperre: daran erkennt der Abgleich eine verwaiste Sperre.
      { $set: { shippingLabelCreationInProgress: true, updatedAt: new Date() } },
      { new: true, projection: { _id: 1 } }
    ).setOptions({ skipAutoPopulate: true });
    if (!claimedBooking) {
      const error = new Error('Das Einsendelabel dieser Buchung wird bereits erstellt, ist schon vorhanden oder sein Ergebnis wird noch abgeglichen. Bitte die Buchung neu laden.');
      error.status = 409;
      error.code = 'LABEL_CREATION_IN_PROGRESS';
      throw error;
    }
    let keepBookingLock = false;

    let lastError = null;

    try {
      for (const orderId of candidateOrderIds) {
        try {
          const sourceOrder = await Order.findById(orderId)
            .setOptions({ skipAutoPopulate: true })
            .populate('customerId', 'name firstName lastName email phone invoiceAddress');

          if (!sourceOrder) {
            console.error(`BookingService: Order not found for booking label generation: ${orderId}`);
            throw new Error('Der zur Buchung gehörende Auftrag wurde nicht gefunden.');
          }

          const requestedShipmentData = options.shipmentData && typeof options.shipmentData === 'object'
            ? options.shipmentData
            : {};

          // Die Richtung kommt vom Aufrufer, nicht aus der Reihenfolge der Adressbloecke.
          const labelDirection = this.resolveBookingLabelDirection(requestedShipmentData);
          const defaultShipmentData = this.buildBookingShipmentData(sourceOrder, booking, dhlConfig, labelDirection);
          const shipmentData = this.mergeBookingShipmentData(defaultShipmentData, requestedShipmentData);
          shipmentData.labelDirection = labelDirection;

          // Der Aufrufer darf die Shop-Adresse dem Server ueberlassen (die
          // Integrationseinstellungen sind nur fuer Administratoren lesbar). Dann muss der
          // Server sie aufloesen - und laut scheitern, wenn sie gar nicht hinterlegt ist,
          // statt ein Label mit falschem Absender zu erzeugen.
          const shopSideRequested =
            (requestedShipmentData.shipperFromConfiguration === true && 'Absenderadresse')
            || (requestedShipmentData.receiverFromConfiguration === true && 'Empfängeradresse')
            || '';
          if (shopSideRequested) {
            const shopAddress = this.resolveConfiguredShopAddress(dhlConfig);
            const missingShopFields = this.missingShopAddressFields(shopAddress);
            if (missingShopFields.length > 0) {
              throw Object.assign(new Error(
                `Die Shop-Adresse ist in der DHL-Integration nicht vollständig hinterlegt (${missingShopFields.join(', ')}). `
                + 'Bitte unter Systemkonfiguration → Integrationen → DHL Straße mit Hausnummer, PLZ und Ort eintragen.'
              ), { code: 'SHOP_ADDRESS_INCOMPLETE' });
            }
            console.log(`BookingService: ${shopSideRequested} wird aus der DHL-Integration übernommen (${labelDirection}).`);
          }

          const missingReceiverFields = [
            ['Name', shipmentData.receiverName],
            ['Straße', shipmentData.receiverAddress],
            ['Hausnummer', shipmentData.receiverNumber],
            ['Ort', shipmentData.receiverCity],
            ['PLZ', shipmentData.receiverPostalCode],
          ].filter(([, value]) => !String(value || '').trim());

          if (missingReceiverFields.length > 0) {
            // Fehlercode statt Textsuche (Kundenmeldung in createInboundLabelForBooking): beim
            // Einsendelabel ist der Empfaenger der Shop, beim Versandlabel der Kunde.
            throw Object.assign(
              new Error(`Empfängeradresse unvollständig: ${missingReceiverFields.map(([field]) => field).join(', ')}.`),
              { code: labelDirection === 'outbound' ? 'CUSTOMER_ADDRESS_INCOMPLETE' : 'SHOP_ADDRESS_INCOMPLETE' }
            );
          }

          const missingShipperFields = [
            ['Name', shipmentData.shipperName],
            ['Straße', shipmentData.shipperStreet],
            ['Hausnummer', shipmentData.shipperNumber],
            ['Ort', shipmentData.shipperCity],
            ['PLZ', shipmentData.shipperPostalCode],
            ['DHL-Abrechnungsnummer', shipmentData.accountNumber],
          ].filter(([, value]) => !String(value || '').trim());

          if (missingShipperFields.length > 0) {
            const shipperCode = missingShipperFields.some(([field]) => field === 'DHL-Abrechnungsnummer')
              ? 'DHL_CONFIG_INCOMPLETE'
              : (labelDirection === 'outbound' ? 'SHOP_ADDRESS_INCOMPLETE' : 'CUSTOMER_ADDRESS_INCOMPLETE');
            throw Object.assign(
              new Error(`Absenderdaten unvollständig: ${missingShipperFields.map(([field]) => field).join(', ')}.`),
              { code: shipperCode }
            );
          }

          // Schutz gegen eine halb uebernommene Gegenpartei: wenn Absender und
          // Empfaenger nach dem Zusammenfuehren dieselbe Anschrift tragen, ist genau
          // eine der beiden Seiten falsch belegt. Lieber laut abbrechen als ein Label
          // an die eigene Adresse erzeugen.
          const addressKey = (prefix) => [
            shipmentData[`${prefix}Street`] || shipmentData[`${prefix}Address`],
            shipmentData[`${prefix}PostalCode`],
            shipmentData[`${prefix}City`],
          ].map((value) => String(value || '').trim().toLowerCase()).join('|');

          if (addressKey('shipper') === addressKey('receiver')) {
            throw new Error('Absender und Empfänger sind identisch. Bitte prüfen Sie die Versandadressen des Auftrags.');
          }

          // Einsendelabel: am Auftrag wird NICHTS gespeichert (persist:false) - das
          // Auslieferungsfeld des Auftrags bleibt fuer "An Kunden versenden" frei.
          let shipmentResult;
          try {
            shipmentResult = await DHLService.createShipment(orderId, shipmentData, { direction: 'inbound', persist: false });
          } catch (shipmentError) {
            if (shipmentError?.indeterminate) {
              // Unklares DHL-Ergebnis: Sperre halten, NICHT mit dem naechsten Auftrag erneut senden.
              keepBookingLock = true;
              await Booking.updateOne(
                { _id: booking._id },
                {
                  $set: { shippingStatusDescription: 'Ergebnis der DHL-Labelerstellung unklar – Abgleich im DHL-Geschäftskundenportal erforderlich' },
                  $push: {
                    timeline: {
                      status: 'Shipping Label Reconciliation Required',
                      description: `DHL hat beim Einsendelabel (Kunde an McRepair) nicht eindeutig geantwortet${shipmentError.trackingNumber ? ` (Sendungsnummer ${shipmentError.trackingNumber})` : ''}. Bitte im DHL-Geschäftskundenportal prüfen, bevor erneut ein Label erstellt wird.`,
                      completedAt: new Date(),
                      staffId: 'system',
                      staffName: 'DHL Parcel Integration',
                    },
                  },
                }
              );
              throw shipmentError;
            }
            throw shipmentError;
          }

          const now = new Date();
          const trackingNumber = shipmentResult?.trackingNumber || '';
          await Booking.updateOne(
            { _id: booking._id },
            {
              $set: {
                trackingNumber,
                carrier: 'DHL',
                shippingStatus: 'label-created',
                shippingStatusDescription: 'DHL-Einsendelabel (Hinweg: Kunde an McRepair) wurde erstellt',
                shippingLabelUrl: shipmentResult?.labelUrl || '',
                shippingCost: shipmentResult?.shippingCost || booking.shippingCost || 0,
                estimatedDelivery: shipmentResult?.estimatedDelivery || booking.estimatedDelivery,
                shippingCreatedAt: now,
                shippingLabelCreationInProgress: false,
              },
              $push: {
                timeline: {
                  status: 'Shipping Label Created',
                  description: `DHL-Versandlabel für die Buchung erstellt (Hinweg: Kunde an McRepair). Sendungsnummer: ${trackingNumber || 'noch offen'}`,
                  completedAt: now,
                  // HIST-16: die ausloesende Person (Mitarbeiter bzw. Kunde), sonst System.
                  staffId: DHLService.timelineActor(options.actor).staffId,
                  staffName: DHLService.timelineActor(options.actor).staffName,
                },
              },
            }
          );

          await this.recordInboundLabelOnOrders(booking._id, { trackingNumber, actor: options.actor, at: now });

          const refreshedBooking = await Booking.findById(booking._id);
          if (!refreshedBooking) {
            throw new Error('Die Buchung wurde nach der Label-Erstellung nicht mehr gefunden.');
          }
          return refreshedBooking;
        } catch (error) {
          lastError = error;
          console.error(`BookingService: Failed to create live shipping label for order ${orderId}:`, error.message);
          if (error?.indeterminate) break;
        }
      }
    } finally {
      if (!keepBookingLock) {
        await Booking.updateOne(
          { _id: booking._id, shippingLabelCreationInProgress: true },
          { $set: { shippingLabelCreationInProgress: false } }
        ).catch((releaseError) => {
          console.error('BookingService: Could not release booking label lock:', releaseError.message);
        });
      }
    }

    throw lastError || new Error('Das DHL-Versandlabel für diese Buchung konnte nicht erstellt werden.');
  }

  /**
   * Offenen Abgleich des Einsendelabels nach einer unklaren DHL-Antwort abschliessen
   * (nur Administratoren, nach Pruefung im DHL-Geschaeftskundenportal).
   *  - 'not-created': bei DHL keine Sendung -> Sperre loesen, Label kann neu erstellt werden
   *  - 'created' + trackingNumber: Sendung existiert -> Sendungsnummer uebernehmen
   */
  static async reconcileBookingInboundLabel(bookingId, { resolution, trackingNumber } = {}, actor = {}) {
    const booking = await Booking.findById(bookingId).setOptions({ skipAutoPopulate: true })
      .select('shippingLabelCreationInProgress trackingNumber updatedAt timeline').lean();
    if (!booking) {
      const error = new Error('Buchung nicht gefunden.');
      error.status = 404;
      throw error;
    }
    if (booking.shippingLabelCreationInProgress !== true) {
      const error = new Error('Für diese Buchung ist kein Abgleich offen.');
      error.status = 409;
      error.code = 'NO_RECONCILIATION_PENDING';
      throw error;
    }
    // Eine noch LAUFENDE Erstellung darf nicht abgeglichen werden: wuerde die Sperre
    // waehrend des DHL-Aufrufs mit 'nicht angelegt' geloest, koennte ein zweiter Klick
    // ein zweites bezahltes Label erzeugen. Erlaubt ist der Abgleich nur, wenn die
    // unklare DHL-Antwort vermerkt ist oder die Sperre verwaist ist (Prozessabbruch).
    if (!BookingService.isBookingLabelReconciliationAllowed(booking)) {
      const error = new Error(
        'Die Erstellung des Einsendelabels läuft gerade noch. Bitte einige Minuten warten und die Buchung neu laden – '
        + 'ein Abgleich ist erst nach einer unklaren DHL-Antwort oder nach Ablauf der Sperre möglich.'
      );
      error.status = 409;
      error.code = 'LABEL_CREATION_STILL_RUNNING';
      throw error;
    }

    const actorName = String(actor.name || actor.email || 'Administrator');
    const cleanTracking = String(trackingNumber || '').replace(/\s+/g, '');
    const timelineEntry = (description) => ({
      status: 'Shipping Label Reconciled',
      description,
      completedAt: new Date(),
      staffId: String(actor._id || 'system'),
      staffName: actorName,
    });

    // Welches Produkt haelt die Sperre? Die Buchungs-Retoure (dhlReturnsService) nutzt dieselbe
    // Sperre und denselben Abgleich-Vermerk, speichert ihr Label aber in return*. Ihr Ergebnis
    // darf nie in den Parcel-DE-Platz (trackingNumber) geschrieben werden - im Altbestand traegt
    // dieser Platz ein Rueckweg-Label, das nicht still ueberschrieben werden darf.
    const timeOf = (entry) => new Date(entry?.completedAt || 0).getTime() || 0;
    const openMarker = (Array.isArray(booking.timeline) ? booking.timeline : [])
      .filter((entry) => entry?.status === 'Shipping Label Reconciliation Required')
      .reduce((latest, entry) => (timeOf(entry) >= timeOf(latest) ? entry : latest), null);
    const retoureLock = Boolean(openMarker) && (
      String(openMarker.staffName || '') === 'DHL Returns Integration'
      || /Retourenlabel/i.test(String(openMarker.description || ''))
    );
    const parcelSlotUsed = Boolean(String(booking.trackingNumber || '').trim());

    if (resolution === 'not-created') {
      await Booking.updateOne(
        { _id: bookingId, shippingLabelCreationInProgress: true },
        {
          // Beschreibung nur leeren, wenn der Parcel-Platz leer ist (Altbestand behaelt seinen Text).
          $set: { shippingLabelCreationInProgress: false, ...(parcelSlotUsed ? {} : { shippingStatusDescription: '' }) },
          $push: { timeline: timelineEntry(`Abgleich abgeschlossen: Bei DHL wurde kein Einsendelabel angelegt (geprüft von ${actorName}).`) },
        }
      );
    } else if (resolution === 'created' && (retoureLock || parcelSlotUsed)) {
      if (!/^[0-9A-Za-z]{8,40}$/.test(cleanTracking)) {
        const error = new Error('Bitte die DHL-Sendungsnummer aus dem Geschäftskundenportal angeben (8 bis 40 Ziffern/Buchstaben).');
        error.status = 422;
        error.code = 'TRACKING_NUMBER_INVALID';
        throw error;
      }
      await Booking.updateOne(
        { _id: bookingId, shippingLabelCreationInProgress: true },
        {
          $set: {
            shippingLabelCreationInProgress: false,
            returnTrackingNumber: cleanTracking,
            returnShipmentStatus: 'label-created',
            returnShipmentStatusDescription: 'Einsendelabel (Retoure) bei DHL angelegt (per Abgleich übernommen) – PDF im DHL-Geschäftskundenportal abrufen',
          },
          $push: { timeline: timelineEntry(`Abgleich abgeschlossen: Retouren-Einsendelabel ${cleanTracking} (Kunde an McRepair) existiert bei DHL (geprüft von ${actorName}).`) },
        }
      );
    } else if (resolution === 'created') {
      if (!/^[0-9A-Za-z]{8,40}$/.test(cleanTracking)) {
        const error = new Error('Bitte die DHL-Sendungsnummer aus dem Geschäftskundenportal angeben (8 bis 40 Ziffern/Buchstaben).');
        error.status = 422;
        error.code = 'TRACKING_NUMBER_INVALID';
        throw error;
      }
      await Booking.updateOne(
        { _id: bookingId, shippingLabelCreationInProgress: true },
        {
          $set: {
            shippingLabelCreationInProgress: false,
            trackingNumber: cleanTracking,
            carrier: 'DHL',
            shippingStatus: 'label-created',
            shippingStatusDescription: 'Einsendelabel bei DHL angelegt (per Abgleich übernommen) – PDF im DHL-Geschäftskundenportal abrufen',
          },
          $push: { timeline: timelineEntry(`Abgleich abgeschlossen: Einsendelabel ${cleanTracking} (Hinweg: Kunde an McRepair) existiert bei DHL (geprüft von ${actorName}).`) },
        }
      );
    } else {
      const error = new Error('Unbekannte Abgleich-Entscheidung.');
      error.status = 422;
      throw error;
    }

    return Booking.findById(bookingId);
  }

  /**
   * Darf eine gesetzte Einsendelabel-Sperre abgeglichen werden?
   *  - ja, wenn nach dem letzten Abschluss (Label erstellt / abgeglichen) eine unklare
   *    DHL-Antwort vermerkt ist ('Shipping Label Reconciliation Required'),
   *  - ja, wenn die Sperre aelter als BOOKING_LABEL_LOCK_STALE_MS ist (Prozessabbruch
   *    waehrend des DHL-Aufrufs; der Aufruf selbst dauert hoechstens ~30 Sekunden),
   *  - sonst nein: die Erstellung laeuft noch.
   * Der Sperrbeginn steht in updatedAt (wird beim Setzen der Sperre geschrieben).
   */
  static isBookingLabelReconciliationAllowed(booking, now = Date.now()) {
    // EINE Regel fuer Abgleich und Lesemodell (Auftragsansicht, Buchungs-Einsendestatus):
    // sie liegt in DHLService, damit beide Seiten nicht auseinanderlaufen.
    return DHLService.isBookingLabelReconciliationAllowed(booking, now);
  }

  static async bulkUpdateShippingStatuses() {
    console.log('BookingService: Starting bulk shipping status update')

    const activeStatuses = ['label-created', 'shipped', 'in-transit', 'out-for-delivery']
    const bookings = await Booking.find({
      trackingNumber: { $exists: true, $ne: '' },
      shippingStatus: { $in: activeStatuses },
    }).select('_id trackingNumber shippingStatus')

    console.log(`BookingService: Found ${bookings.length} bookings to update`)

    const results = []
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const booking of bookings) {
      try {
        const result = await this.updateShippingStatus(booking._id.toString())
        const statusChanged = result.booking.shippingStatus !== booking.shippingStatus
        results.push({
          bookingId: booking._id,
          trackingNumber: booking.trackingNumber,
          previousStatus: booking.shippingStatus,
          newStatus: result.booking.shippingStatus,
          changed: statusChanged,
        })
        if (statusChanged) updated++
        else skipped++
      } catch (error) {
        console.error(`BookingService: Failed to update shipping status for booking ${booking._id}:`, error.message)
        errors++
        results.push({
          bookingId: booking._id,
          trackingNumber: booking.trackingNumber,
          previousStatus: booking.shippingStatus,
          error: error.message,
        })
      }
    }

    console.log(`BookingService: Bulk update complete — updated: ${updated}, unchanged: ${skipped}, errors: ${errors}`)

    return {
      success: true,
      total: bookings.length,
      updated,
      skipped,
      errors,
      results,
    }
  }

  static async updateShippingStatus(bookingId) {
    console.log('BookingService: Updating shipping status for booking:', bookingId)

    const booking = await Booking.findById(bookingId)

    if (!booking) {
      throw new Error('Buchung nicht gefunden.')
    }

    if (!booking.trackingNumber) {
      throw new Error('Für diese Buchung ist keine Sendungsnummer hinterlegt.')
    }

    if (this.isDummyBookingTrackingNumber(booking.trackingNumber)) {
      const trackingInfo = this.buildDummyBookingTrackingInfo(booking)

      booking.shippingStatus = 'label-created'
      booking.shippingStatusDescription = trackingInfo.description

      if (trackingInfo.estimatedDelivery) {
        booking.estimatedDelivery = trackingInfo.estimatedDelivery
      }

      await booking.save()

      return {
        success: true,
        booking,
        trackingInfo,
      }
    }

    const trackingInfo = await DHLService.getTrackingInfo(booking.trackingNumber)

    const mappedStatus = this.mapTrackingStatusToBookingStatus(
      trackingInfo.status || trackingInfo.statusCodeRaw || ''
    )
    const newStatus = mappedStatus || booking.shippingStatus
    const statusChanged = newStatus !== booking.shippingStatus

    booking.shippingStatus = newStatus
    booking.shippingStatusDescription = trackingInfo.description || trackingInfo.status || booking.shippingStatusDescription

    if (trackingInfo.estimatedDelivery) {
      booking.estimatedDelivery = trackingInfo.estimatedDelivery
    }

    if (newStatus === 'delivered' && !booking.actualDelivery) {
      booking.actualDelivery = new Date()
    }

    if (statusChanged) {
      booking.timeline.push({
        status: 'Shipping Status Updated',
        description: `Sendungsstatus der Buchung: ${trackingInfo.description || newStatus}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'DHL Integration',
      })
    }

    await booking.save()

    return {
      success: true,
      booking,
      trackingInfo,
    }
  }

  // Get booking by ID
  static async getById(bookingId) {
    console.log('BookingService: Getting booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .setOptions({ skipAutoPopulate: true })
        .populate('customerId', 'firstName lastName name email phone avatar invoiceAddress paymentAddress')
        .populate({
          path: 'orderIds',
          select: 'orderNumber status totalCost progress deviceType deviceBrand deviceModel paymentStatus',
          options: { skipAutoPopulate: true },
        })
        .populate({
          path: 'repairOrderIds',
          select: 'orderNumber status totalCost progress deviceBrand deviceModel paymentStatus',
          options: { skipAutoPopulate: true },
        })
        .populate({
          path: 'shopProductOrderId',
          select: 'orderNumber status totalCost progress paymentStatus',
          options: { skipAutoPopulate: true },
        });

      if (!booking) {
        console.log('BookingService: Booking not found:', bookingId);
        return null;
      }

      console.log('BookingService: Booking retrieved successfully');
      return booking;
    } catch (error) {
      console.error('BookingService: Error getting booking:', error);
      throw error;
    }
  }

  // Build search $or clause matching bookingNumber, guestInfo fields, and registered customers
  static async buildSearchClause(search) {
    const normalizedSearch = String(search || '').trim();
    const regex = new RegExp(normalizedSearch, 'i');
    const orderSearch = normalizedSearch.replace(/^#/, '');
    const orderRegex = new RegExp(orderSearch || normalizedSearch, 'i');

    const matchingUsers = await User.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
      ],
    }).select('_id');
    const matchingUserIds = matchingUsers.map((u) => u._id);

    const matchingOrders = await Order.find({
      orderNumber: orderRegex,
    })
      .setOptions({ skipAutoPopulate: true })
      .select('_id');
    const matchingOrderIds = matchingOrders.map((order) => order._id);

    return [
      { bookingNumber: regex },
      { 'guestInfo.email': regex },
      { 'guestInfo.firstName': regex },
      { 'guestInfo.lastName': regex },
      { 'guestInfo.phone': regex },
      ...(matchingUserIds.length > 0 ? [{ customerId: { $in: matchingUserIds } }] : []),
      ...(matchingOrderIds.length > 0 ? [{ orderIds: { $in: matchingOrderIds } }] : []),
    ];
  }

  /**
   * Suche in "Meine Buchungen" (CUSTUX-3): Buchungsnummer, Auftragsnummer und Geraet - immer
   * nur innerhalb der Buchungen/Auftraege DIESES Kunden. Die Eingabe wird als Text behandelt
   * (Regex-Sonderzeichen escaped, Laenge begrenzt), damit '.*' oder '(' weder alles findet noch
   * einen Fehler wirft. Liefert die $or-Bedingungen fuer Booking.find (mit customerId kombiniert)
   * oder null bei leerer Suche.
   */
  static async buildCustomerSearchClause(customerId, search) {
    const normalized = String(search || '').trim().replace(/^#/, '').slice(0, 100);
    if (!normalized || !customerId) return null;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const matchingOrders = await Order.find({
      customerId,
      $or: [
        { orderNumber: regex },
        { deviceBrand: regex },
        { deviceModel: regex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: [{ $ifNull: ['$deviceBrand', ''] }, ' ', { $ifNull: ['$deviceModel', ''] }] },
              regex: escaped,
              options: 'i',
            },
          },
        },
      ],
    })
      .setOptions({ skipAutoPopulate: true })
      .select('_id bookingId parentOrderId')
      .limit(500)
      .lean();
    // Treffer in Reklamations-Folgeauftraegen (nicht in booking.items) finden die Buchung
    // ueber ihre bookingId bzw. ueber den Ursprungsauftrag - wie die Liste sie anzeigt.
    const orderIds = [
      ...matchingOrders.map((order) => order._id),
      ...matchingOrders.map((order) => order.parentOrderId).filter(Boolean),
    ];
    const bookingIds = matchingOrders.map((order) => order.bookingId).filter(Boolean);
    return [
      { bookingNumber: regex },
      { 'items.orderNumber': regex },
      { 'items.device': regex },
      ...(orderIds.length > 0 ? [{ orderIds: { $in: orderIds } }, { 'items.orderId': { $in: orderIds } }] : []),
      ...(bookingIds.length > 0 ? [{ _id: { $in: bookingIds } }] : []),
    ];
  }

  static async getCommunicationOrderIds(communication, userId, viewerRole = 'staff') {
    if (communication !== 'unread-customer-response' || !userId) {
      return [];
    }

    const communications = await InspectionCommunication.find({
      status: 'active',
      $or: [
        { 'messages.senderType': 'customer' },
        {
          'messages.feedbackRequest.status': 'responded',
          'messages.feedbackRequest.respondedAt': { $exists: true },
        },
      ],
    }).select('orderId messages').lean();

    // EINE Regel fuer "ungelesen" (server/utils/communicationReadRules.js): dieselbe wie Postfach,
    // Zaehler und Badges. Die Admin-Buchungsliste wird nur von Personal/Admin abgefragt.
    const viewer = { userId, role: viewerRole || 'staff' };
    return communications
      .filter((communicationThread) => (communicationThread.messages || [])
        .some((message) => isMessageUnreadFor(message, viewer)))
      .map((communicationThread) => communicationThread.orderId);
  }

  // Get total count of bookings matching filters
  static async getBookingsCount(filters = {}) {
    console.log('BookingService: Getting bookings count with filters:', filters);

    try {
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.billingStatus) query.billingStatus = filters.billingStatus;
      if (filters.customerId) query.customerId = filters.customerId;

      if (filters.communication) {
        query.orderIds = { $in: await BookingService.getCommunicationOrderIds(filters.communication, filters.communicationUserId) };
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      if (filters.search) {
        // Kundenzaehlung (customerId gesetzt) nutzt dieselbe Suche wie getByCustomer,
        // damit Trefferliste und Gesamtzahl zusammenpassen.
        query.$or = filters.customerId
          ? ((await BookingService.buildCustomerSearchClause(filters.customerId, filters.search)) || [{}])
          : await BookingService.buildSearchClause(filters.search);
      }

      const count = await Booking.countDocuments(query);
      console.log('BookingService: Total bookings count:', count);

      return count;
    } catch (error) {
      console.error('BookingService: Error getting bookings count:', error);
      throw error;
    }
  }

  /**
   * Zahlungsstand (total / allocated / open / overpaid) fuer eine Liste von Buchungen.
   *
   * Abgeleitet aus den gueltigen Zahlungszuordnungen, NICHT aus einem Belegstatus:
   * ein Auftrag kann gleichzeitig 'versendet' (Erfuellung) und 'teilbezahlt'
   * (Zahlung) sein, und eine Ueberzahlung erscheint nie als negativer offener Betrag.
   *
   * Schlaegt die Berechnung fehl, ist der Zahlungsstand UNBEKANNT: jede Buchung wird mit
   * null eingetragen (die Oberflaeche zeigt dann '–'), nie mit einem erfundenen
   * 0,00-€-Saldo, der wie "ausgeglichen" aussieht.
   */
  static async buildPaymentBalanceMap(bookings = []) {
    const result = new Map();
    if (!bookings || bookings.length === 0) return result;

    try {
      const PaymentService = require('./paymentService');
      const balances = await PaymentService.getBookingBalancesBulk(bookings.map((booking) => booking._id));

      bookings.forEach((booking) => {
        const key = String(booking._id);
        const orderValue = BookingService.roundCurrency(Number(booking.totalCost || 0));
        const entry = balances.get(key) || {
          invoicedTotal: 0, allocated: 0, open: 0, overpaid: 0, received: 0, unallocated: 0,
          reference: orderValue, bookingOpen: orderValue,
        };
        // Bezugsgroesse, offen und ueberzahlt kommen UNVERAENDERT aus der gemeinsamen
        // Berechnung (PaymentService.computeBookingBalancesCore) - dieselben Zahlen wie
        // in der Detailansicht. Frueher rechnete die Liste hier selbst
        // (Rechnungssumme ODER Auftragswert) und zeigte bei teilweise berechneten
        // Buchungen eine Ueberzahlung, die es nicht gab.
        const reference = BookingService.roundCurrency(Number(entry.reference ?? orderValue));

        result.set(key, {
          total: reference,
          reference,
          orderValue,
          invoicedTotal: entry.invoicedTotal,
          allocated: entry.allocated,
          received: entry.received,
          unallocated: entry.unallocated,
          open: BookingService.roundCurrency(Number(entry.bookingOpen ?? Math.max(0, reference - entry.received))),
          invoiceOpen: entry.open,
          overpaid: BookingService.roundCurrency(Number(entry.overpaid ?? Math.max(0, entry.received - reference))),
        });
      });
    } catch (error) {
      console.error('BookingService: Error computing payment balances:', error);
      result.clear();
      bookings.forEach((booking) => result.set(String(booking._id), null));
    }

    return result;
  }

  // paymentBalance einer Buchung aus buildPaymentBalanceMap: null = unbekannt (Berechnung
  // fehlgeschlagen oder Buchung fehlt in der Map) - kein Null-Saldo als Ersatz.
  static readPaymentBalance(balanceByBookingId, bookingId) {
    const value = balanceByBookingId.get(String(bookingId));
    return value === undefined ? null : value;
  }

  // Get all bookings (admin view)
  static async getAllBookings(filters = {}) {
    console.log('BookingService: Getting all bookings with filters:', filters);

    try {
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.billingStatus) query.billingStatus = filters.billingStatus;

      if (filters.communication) {
        query.orderIds = { $in: await BookingService.getCommunicationOrderIds(filters.communication, filters.communicationUserId) };
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      if (filters.search) {
        query.$or = await BookingService.buildSearchClause(filters.search);
      }

      // ADMUX-5: orderIds, Retoure-Status/-Sendungsnummer und finalCost gehoeren zur Projektion,
      // weil die Liste sie anzeigt (Spalten Geraete/Auftraege, Einsendung, Gesamt). Label-URLs
      // werden bewusst NICHT geladen (koennen grosse data:-PDFs sein); fuer die Liste genuegen
      // Sendungsnummern und Status.
      const bookings = await Booking.find(query)
        .setOptions({ skipAutoPopulate: true })
        .select('customerId bookingNumber status billingStatus paymentStatus totalCost finalCost items orderIds createdAt updatedAt shippingStatus trackingNumber shippingLabelCreationInProgress returnShipmentStatus returnTrackingNumber returnCreatedAt guestInfo')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0)
        .lean();

      console.log('BookingService: Found', bookings.length, 'bookings on current page');

      const customerIds = [...new Set(bookings.map((booking) => booking.customerId).filter(Boolean).map((id) => String(id)))];
      const customerMap = new Map(
        customerIds.length
          ? (await User.find({ _id: { $in: customerIds } }).select('firstName lastName email phone avatar name').lean()).map((user) => [String(user._id), user])
          : []
      );

      const bookingIds = bookings.map((booking) => booking._id);
      const invoiceSummaries = await Invoice.aggregate([
        {
          $match: {
            bookingId: { $in: bookingIds },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$bookingId',
            receivableTotal: {
              $sum: {
                $cond: [{ $eq: ['$isCreditNote', false] }, '$total', 0],
              },
            },
            receivablePaid: {
              $sum: {
                $cond: [{ $eq: ['$isCreditNote', false] }, '$paidAmount', 0],
              },
            },
            creditTotal: {
              $sum: {
                $cond: [{ $eq: ['$isCreditNote', true] }, '$total', 0],
              },
            },
            creditPaid: {
              $sum: {
                $cond: [{ $eq: ['$isCreditNote', true] }, '$paidAmount', 0],
              },
            },
          },
        },
      ]);

      const invoiceSummaryByBookingId = new Map(
        invoiceSummaries.map((summary) => [
          String(summary._id),
          {
            receivableTotal: Number(summary.receivableTotal || 0),
            receivablePaid: Number(summary.receivablePaid || 0),
            creditTotal: Number(summary.creditTotal || 0),
            creditPaid: Number(summary.creditPaid || 0),
          },
        ])
      );

      const allOrders = bookingIds.length
        ? await Order.find({ bookingId: { $in: bookingIds } })
            .setOptions({ skipAutoPopulate: true })
            .select('_id bookingId status progress hasComplaint orderNumber deviceBrand deviceModel deviceType createdAt')
            .sort({ createdAt: 1 })
            .lean()
        : [];

      const ordersByBookingId = new Map();
      const directOrderIds = [];

      allOrders.forEach((order) => {
        const bookingKey = String(order.bookingId);
        if (!ordersByBookingId.has(bookingKey)) {
          ordersByBookingId.set(bookingKey, []);
        }

        ordersByBookingId.get(bookingKey).push(order);
        directOrderIds.push(order._id);
      });

      const complaintParents = directOrderIds.length
        ? await Order.aggregate([
            {
              $match: {
                isComplaintFollowup: true,
                parentOrderId: { $in: directOrderIds },
              },
            },
            {
              $group: {
                _id: '$parentOrderId',
              },
            },
          ])
        : [];

      const complaintParentIdSet = new Set(
        complaintParents.map((entry) => String(entry._id))
      );

      // Abgeleiteter Zahlungsstand fuer alle Buchungen der Seite in EINEM Durchlauf.
      const balanceByBookingId = await BookingService.buildPaymentBalanceMap(bookings);

      // Calculate real-time progress for all bookings from their associated orders
      const bookingsWithProgress = bookings.map((booking) => {
        try {
          const bookingPlain = {
            ...booking,
            customerId: booking.customerId ? (customerMap.get(String(booking.customerId)) || null) : null,
          };
          const bookingKey = String(booking._id);
          const bookingOrders = ordersByBookingId.get(bookingKey) || [];
          const invoiceSummary = invoiceSummaryByBookingId.get(bookingKey);

          if (invoiceSummary) {
            const receivableOpen = Math.max(
              0,
              invoiceSummary.receivableTotal - invoiceSummary.receivablePaid
            );
            const customerCreditOpen = Math.max(
              0,
              invoiceSummary.creditTotal - invoiceSummary.creditPaid
            );

            bookingPlain.invoiceOpenAmount = receivableOpen;
            bookingPlain.customerCreditOpenAmount = customerCreditOpen;
            bookingPlain.netOpenAmount = receivableOpen - customerCreditOpen;
          }

          // Einheitlicher Zahlungssatz fuer die Liste: total / allocated / open /
          // overpaid. Der Client soll die Werte anzeigen und nicht selbst rechnen -
          // und er soll den ZAHLUNGSstand nie aus einem Belegstatus ableiten.
          // null = unbekannt (Saldenberechnung fehlgeschlagen) - kein 0,00-€-Ersatz.
          bookingPlain.paymentBalance = BookingService.readPaymentBalance(balanceByBookingId, bookingKey);

          if (bookingOrders.length > 0) {
            let totalProgress = 0;
            bookingOrders.forEach((order) => {
              totalProgress += this.resolveOrderProgress(order);
            });

            bookingPlain.overallProgress = Math.round(totalProgress / bookingOrders.length);
          }

          bookingPlain.hasComplaintOrders = bookingOrders.some((order) =>
            complaintParentIdSet.has(String(order._id))
          );

          // ADMUX-5: Auftraege der Buchung fuer die Spalte "Geraete / Auftraege" (Nummer, Geraet,
          // Status, Fortschritt) - ohne Aufklappen. Nur Staff/Admin rufen getAllBookings auf.
          // Shop-Auftraege (Checkout-Platzhalter deviceBrand 'N/A' / deviceModel 'Shop Products Order')
          // bekommen dasselbe Etikett wie buildInboundLabelView ('Shop-Artikel') bzw. die Produktnamen
          // aus booking.items - nie den Rohplatzhalter.
          bookingPlain.orders = bookingOrders.map((order) => {
            const isProduct = order.deviceType === 'Shop Products';
            const productItem = isProduct
              ? (booking.items || []).find((item) => String(item.orderId || '') === String(order._id))
              : null;
            const productNames = productItem && Array.isArray(productItem.products)
              ? productItem.products.map((product) => product && product.name).filter(Boolean).join(', ')
              : '';
            return {
              _id: order._id,
              orderNumber: order.orderNumber || '',
              type: isProduct ? 'product' : 'repair',
              device: isProduct
                ? (productNames || 'Shop-Artikel')
                : `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim(),
              deviceBrand: isProduct ? '' : (order.deviceBrand || ''),
              deviceModel: isProduct ? '' : (order.deviceModel || ''),
              deviceType: order.deviceType || '',
              status: order.status || '',
              progress: this.resolveOrderProgress(order),
            };
          });
          if (!Array.isArray(bookingPlain.orderIds) || bookingPlain.orderIds.length === 0) {
            bookingPlain.orderIds = bookingOrders.map((order) => order._id);
          }
          // DHL-5: Testlabel (Dummy-Modus) erkennbar machen - gleiche Regel wie das Einsendelabel-Lesemodell.
          bookingPlain.inboundLabelPlaceholder = DHLService.isPlaceholderTrackingNumber(booking.trackingNumber)
            || DHLService.isPlaceholderTrackingNumber(booking.returnTrackingNumber);

          return bookingPlain;
        } catch (error) {
          console.error('BookingService: Error calculating progress for booking:', booking._id, error);
          return { ...booking, customerId: booking.customerId ? (customerMap.get(String(booking.customerId)) || null) : null };
        }
      });

      if (this.shouldRefreshShipping(filters)) {
        await this.applyLiveShippingTracking(bookingsWithProgress);
      }

      console.log('BookingService: Calculated real-time progress for all bookings');
      return bookingsWithProgress;
    } catch (error) {
      console.error('BookingService: Error getting all bookings:', error);
      throw error;
    }
  }

  // Get all bookings for a customer
  static async getByCustomer(customerId, filters = {}) {
    console.log('BookingService: Getting bookings for customer:', customerId);

    try {
      const query = { customerId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      if (filters.search) {
        const searchClause = await BookingService.buildCustomerSearchClause(customerId, filters.search);
        if (searchClause) query.$or = searchClause;
      }

      const [bookings, customer] = await Promise.all([
        Booking.find(query)
          .setOptions({ skipAutoPopulate: true })
          .select('customerId bookingNumber status billingStatus paymentStatus totalCost items createdAt updatedAt shippingStatus trackingNumber guestInfo')
          .sort({ createdAt: -1 })
          .limit(filters.limit || 50)
          .skip(filters.skip || 0)
          .lean(),
        User.findById(customerId).select('firstName lastName email phone avatar name').lean()
      ]);

      const bookingIds = bookings.map((booking) => booking._id);
      const customerOrderFields = '_id bookingId customerId status progress hasComplaint orderNumber deviceBrand deviceModel deviceType isComplaintFollowup parentOrderId services.name';
      const allOrders = bookingIds.length
        ? await Order.find({ bookingId: { $in: bookingIds } })
            .setOptions({ skipAutoPopulate: true })
            .select(customerOrderFields)
            .lean()
        : [];
      // Reklamations-Folgeauftraege ohne bookingId haengen am Ursprungsauftrag (wie in
      // getBookingOrders) - sie gehoeren zur Buchung des Ursprungsauftrags.
      const directOrderIds = allOrders.map((order) => order._id);
      const knownOrderIds = new Set(directOrderIds.map(String));
      const parentBookingById = new Map(allOrders.map((order) => [String(order._id), String(order.bookingId)]));
      const followupOrders = directOrderIds.length
        ? (await Order.find({ isComplaintFollowup: true, parentOrderId: { $in: directOrderIds } })
            .setOptions({ skipAutoPopulate: true })
            .select(customerOrderFields)
            .lean()).filter((order) => !knownOrderIds.has(String(order._id)))
        : [];

      const ordersByBookingId = new Map();
      allOrders.forEach((order) => {
        const bookingKey = String(order.bookingId);
        if (!ordersByBookingId.has(bookingKey)) {
          ordersByBookingId.set(bookingKey, []);
        }
        ordersByBookingId.get(bookingKey).push(order);
      });
      const followupsByBookingId = new Map();
      followupOrders.forEach((order) => {
        const bookingKey = parentBookingById.get(String(order.parentOrderId));
        if (!bookingKey) return;
        if (!followupsByBookingId.has(bookingKey)) followupsByBookingId.set(bookingKey, []);
        followupsByBookingId.get(bookingKey).push(order);
      });

      const balanceByBookingId = await BookingService.buildPaymentBalanceMap(bookings);

      const bookingsWithProgress = bookings.map((booking) => {
        try {
          const bookingPlain = {
            ...booking,
            customerId: customer || booking.customerId || null,
            // Gleicher Satz wie in der Adminliste, damit beide Oberflaechen dieselben
            // Zahlen zeigen (null = unbekannt).
            paymentBalance: BookingService.readPaymentBalance(balanceByBookingId, booking._id),
          };
          const bookingOrders = ordersByBookingId.get(String(booking._id)) || [];
          const orderById = new Map(bookingOrders.map((order) => [String(order._id), order]));

          bookingPlain.items = (booking.items || []).map((item) => {
            const currentOrder = item?.orderId ? orderById.get(String(item.orderId)) : null;
            if (!currentOrder) return item;
            // CUSTUX-14: Geraet und Auftragsnummer zur Lesezeit aus dem AKTUELLEN Auftrag
            // (korrigiertes Modell nach Geraetewechsel); der Buchungs-Snapshot bleibt gespeichert.
            const currentDevice = item.type === 'product' || currentOrder.deviceType === 'Shop Products'
              ? ''
              : `${currentOrder.deviceBrand || ''} ${currentOrder.deviceModel || ''}`.trim();
            return {
              ...item,
              device: currentDevice || item.device,
              orderNumber: currentOrder.orderNumber || item.orderNumber,
              status: currentOrder.status,
              progress: this.resolveOrderProgress(currentOrder),
              hasComplaint: Boolean(currentOrder.hasComplaint),
              isComplaintFollowup: Boolean(currentOrder.isComplaintFollowup),
            };
          });

          // Decision O4: Auftraege der Buchung, die nicht in booking.items stehen (vor allem
          // Reklamations-Folgeauftraege, aber auch Altbuchungen ohne Positionen), als eigene
          // Lesezeit-Position anhaengen - sonst sind sie aus "Meine Buchungen" nicht mehr
          // erreichbar. Gespeicherte Buchungspositionen bleiben unveraendert; nur Auftraege
          // DIESES Kunden.
          const referencedOrderIds = new Set(
            (booking.items || []).map((item) => (item?.orderId ? String(item.orderId) : '')).filter(Boolean)
          );
          const orderNumberById = new Map(
            [...bookingOrders, ...(followupsByBookingId.get(String(booking._id)) || [])]
              .map((order) => [String(order._id), order.orderNumber || ''])
          );
          const extraOrders = [...bookingOrders, ...(followupsByBookingId.get(String(booking._id)) || [])]
            .filter((order) => !referencedOrderIds.has(String(order._id)))
            .filter((order) => !order.customerId || String(order.customerId) === String(customerId));
          extraOrders.forEach((order) => {
            const isProduct = order.deviceType === 'Shop Products';
            const parentId = order.parentOrderId ? String(order.parentOrderId) : '';
            bookingPlain.items.push({
              type: isProduct ? 'product' : 'repair',
              orderId: String(order._id),
              orderNumber: order.orderNumber || '',
              device: isProduct ? '' : `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim(),
              services: (order.services || []).map((service) => ({ name: service?.name || '' })).filter((service) => service.name),
              status: order.status || 'pending',
              progress: this.resolveOrderProgress(order),
              hasComplaint: Boolean(order.hasComplaint),
              isComplaintFollowup: Boolean(order.isComplaintFollowup),
              parentOrderId: parentId || null,
              parentOrderNumber: parentId ? (orderNumberById.get(parentId) || '') : '',
              readTimeItem: true,
            });
          });

          if (bookingOrders.length > 0) {
            let totalProgress = 0;
            bookingOrders.forEach((order) => {
              totalProgress += this.resolveOrderProgress(order);
            });
            bookingPlain.overallProgress = Math.round(totalProgress / bookingOrders.length);
          }

          return bookingPlain;
        } catch (error) {
          console.error('BookingService: Error calculating customer booking progress for booking:', booking._id, error);
          return {
            ...booking,
            customerId: customer || booking.customerId || null,
          };
        }
      });

      if (this.shouldRefreshShipping(filters)) {
        await this.applyLiveShippingTracking(bookingsWithProgress, 5);
      }

      console.log('BookingService: Found', bookingsWithProgress.length, 'bookings for customer on current page');
      return bookingsWithProgress;
    } catch (error) {
      console.error('BookingService: Error getting bookings:', error);
      throw error;
    }
  }

  // Group existing orders into a new booking
  static async groupOrders(orderIds, customerId) {
    console.log('BookingService: Grouping orders:', orderIds, 'for customer:', customerId);

    try {
      // Validate all orders exist and belong to the customer
      const orders = await Order.find({ _id: { $in: orderIds }, customerId: customerId });

      if (orders.length !== orderIds.length) {
        throw new Error('Mindestens ein Auftrag wurde nicht gefunden oder gehört nicht zu diesem Kunden.');
      }

      // Check if orders are already in a booking
      const bookedOrders = orders.filter(o => o.bookingId);
      if (bookedOrders.length > 0) {
        console.warn('BookingService: Some orders already have bookings');
        // Could optionally remove them from existing bookings first
      }

      // Create booking data
      const bookingData = {
        customerId: customerId,
        orderIds: orderIds,
        discount: 0,
      };

      return await this.create(bookingData);
    } catch (error) {
      console.error('BookingService: Error grouping orders:', error);
      throw error;
    }
  }

  // Update booking status
  static async updateStatus(bookingId, newStatus, description = '', actor = null) {
    console.log('BookingService: Updating booking status:', bookingId, 'to:', newStatus);

    // Storno ueber das Statusmenue: dieselbe Regel wie DELETE (Grund Pflicht, keine offenen
    // Auftraege, Storno-E-Mail ohne den internen Grund) - nie ein zweiter Weg.
    if (newStatus === 'cancelled') {
      return BookingService.cancel(bookingId, actor, { reason: description });
    }

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      const previousStatus = booking.status;
      booking.status = newStatus;
      // HIST-16: handelnde Person statt 'System' (ohne Person bleibt 'System').
      const actorFields = DHLService.timelineActor(actor, 'System');

      // Add timeline entry
      booking.timeline.push({
        status: newStatus,
        description: description || `Status geändert auf „${BookingService.bookingStatusLabel(newStatus)}“`,
        completedAt: new Date(),
        staffId: actorFields.staffId,
        staffName: actorFields.staffName,
      });

      const savedBooking = await booking.save();
      console.log('BookingService: Booking status updated successfully');

      // Send status email asynchronously
      setImmediate(async () => {
        try {
          const populatedBooking = await Booking.findById(savedBooking._id).populate('customerId', 'firstName lastName email');
          const customerEmail = populatedBooking?.customerId?.email || populatedBooking?.guestInfo?.email;
          if (!customerEmail) {
            return;
          }

          const customerName = populatedBooking?.customerId
            ? `${populatedBooking.customerId.firstName || ''} ${populatedBooking.customerId.lastName || ''}`.trim() || customerEmail
            : `${populatedBooking?.guestInfo?.firstName || ''} ${populatedBooking?.guestInfo?.lastName || ''}`.trim() || customerEmail;

          // PAR-3 (HIST-17): 'Abgeschlossen' ist nur dann eine Abholmeldung, wenn JEDER
          // Reparaturauftrag der Buchung abgeholt wird; Versandauftraege (Online-Buchungen)
          // bekommen die Statusmeldung mit dem Rueckversandtext - Regel aus utils/returnMethod.
          let trigger = 'booking_status_updated';
          let statusNote = description
            || `Status geändert: ${BookingService.bookingStatusLabel(previousStatus)} → ${BookingService.bookingStatusLabel(newStatus)}`;
          if (newStatus === 'completed') {
            const ReturnMethod = require('../utils/returnMethod'); // eslint-disable-line global-require
            const repairOrderIds = (populatedBooking.items || [])
              .filter((item) => item && item.type !== 'product' && item.orderId)
              .map((item) => item.orderId);
            if (repairOrderIds.length > 0) {
              const methods = await Promise.all(repairOrderIds.map((id) => ReturnMethod.resolveReturnMethodForOrder(id)));
              const method = methods.every((m) => m === 'pickup')
                ? 'pickup'
                : (methods.every((m) => m === 'shipping') ? 'shipping' : 'unknown');
              if (method === 'pickup') {
                trigger = 'booking_ready_for_pickup';
              } else if (!description) {
                statusNote = ReturnMethod.readyCustomerMessage(method, `Ihrer Buchung ${populatedBooking.bookingNumber}`);
              }
            }
          }

          const itemSummary = await this.buildBookingOrdersSummary(populatedBooking.items || []);

          const firstRepairItem = (populatedBooking.items || []).find((item) => item?.type !== 'product');
          const primaryDevice = this.parseDeviceLabel(firstRepairItem?.device || '');

          await EmailService.sendTriggerEmail(trigger, customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName,
            bookingNumber: populatedBooking.bookingNumber,
            bookingStatus: BookingService.bookingStatusLabel(newStatus),
            statusNote,
            itemSummary,
            progressPercent: populatedBooking.overallProgress || 0,
            updatedAt: new Date().toLocaleDateString('de-DE'),
            deviceBrand: primaryDevice.deviceBrand,
            deviceModel: primaryDevice.deviceModel,
            bookingUrl: await EmailService.buildSystemUrl(`/bookings/${populatedBooking._id}`),
            pickupHours: process.env.PICKUP_HOURS || 'Mo-Fr 09:00-18:00',
            workshopAddress: process.env.WORKSHOP_ADDRESS || 'Service Center',
            readySince: new Date().toLocaleDateString('de-DE'),
            holdUntil: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        } catch (notificationError) {
          console.error('BookingService: Error sending booking status email:', notificationError.message);
        }
      });

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error updating booking status:', error);
      throw error;
    }
  }

  // Update booking billing status
  static async updateBillingStatus(bookingId, billingStatus, paymentStatus = null, actor = null) {
    console.log('BookingService: Updating billing status:', bookingId, 'to:', billingStatus);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      booking.billingStatus = billingStatus;
      if (paymentStatus) {
        booking.paymentStatus = paymentStatus;
      }
      const actorFields = DHLService.timelineActor(actor, 'System');

      // Add timeline entry
      booking.timeline.push({
        status: billingStatus,
        description: `Zahlungsstatus geändert auf „${BookingService.billingStatusLabel(billingStatus)}“`,
        completedAt: new Date(),
        staffId: actorFields.staffId,
        staffName: actorFields.staffName,
      });

      const savedBooking = await booking.save();
      console.log('BookingService: Billing status updated successfully');

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error updating billing status:', error);
      throw error;
    }
  }

  // Get booking summary
  static async getSummary(bookingId) {
    console.log('BookingService: Getting booking summary:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .setOptions({ skipAutoPopulate: true })
        .populate('customerId', 'firstName lastName email phone')
        .lean();

      if (!booking) {
        console.log('BookingService: Booking not found');
        return null;
      }

      const summary = {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customer: {
          name: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim(),
          email: booking.customerId?.email || '',
          phone: booking.customerId?.phone || '',
        },
        status: booking.status,
        billingStatus: booking.billingStatus,
        totalCost: booking.totalCost,
        itemsCount: Array.isArray(booking.items) ? booking.items.length : 0,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      };

      console.log('BookingService: Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('BookingService: Error getting summary:', error);
      throw error;
    }
  }

  /**
   * Offene Reparatur-/Produktauftraege einer Buchung (nicht storniert, nicht abgeschlossen).
   * Quelle: Order.bookingId und Booking.orderIds (Altbestand).
   */
  static async getOpenOrdersOfBooking(booking) {
    const orderIds = (Array.isArray(booking?.orderIds) ? booking.orderIds : [])
      .map((value) => (value && value._id ? value._id : value))
      .filter(Boolean);
    return Order.find({
      $or: [{ bookingId: booking._id }, ...(orderIds.length ? [{ _id: { $in: orderIds } }] : [])],
      status: { $nin: ['cancelled', 'completed'] },
    })
      .setOptions({ skipAutoPopulate: true })
      .select('_id orderNumber status')
      .lean();
  }

  // Cancel booking (soft delete/status change)
  // EINE Storno-Regel fuer DELETE /api/bookings/:id und PUT /:id/status 'cancelled' (ORD-1):
  //  - Grund ist Pflicht (400 CANCEL_REASON_REQUIRED); er steht nur im internen Buchungsverlauf
  //    (toCustomerTimeline zeigt nie die gespeicherte Beschreibung, die E-Mail nennt ihn nicht).
  //  - Solange Auftraege der Buchung offen sind: 409 BOOKING_HAS_OPEN_ORDERS. Auftraege werden
  //    einzeln mit Grund storniert ("Auftrag stornieren", haelt laufende Workflows an) - so laeuft
  //    nie ein Workflow einer stornierten Buchung weiter.
  //  - Bereits storniert: unveraendert, keine zweite E-Mail.
  static async cancel(bookingId, actor = null, options = {}) {
    console.log('BookingService: Cancelling booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        const notFoundError = new Error('Buchung wurde nicht gefunden.');
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      if (booking.status === 'cancelled') {
        booking.$locals = booking.$locals || {};
        booking.$locals.unchanged = true;
        return booking;
      }

      const reason = String(options.reason || '').trim();
      if (!reason) {
        const reasonError = new Error('Bitte einen Grund für die Stornierung angeben.');
        reasonError.statusCode = 400;
        reasonError.code = 'CANCEL_REASON_REQUIRED';
        throw reasonError;
      }

      const openOrders = await BookingService.getOpenOrdersOfBooking(booking);
      if (openOrders.length > 0) {
        const numbers = openOrders.map((order) => order.orderNumber || String(order._id)).join(', ');
        const openError = new Error(
          `Die Buchung hat noch offene Aufträge (${numbers}). Bitte zuerst jeden Auftrag mit Grund stornieren („Auftrag stornieren“) – laufende Reparaturen werden dabei angehalten.`
        );
        openError.statusCode = 409;
        openError.code = 'BOOKING_HAS_OPEN_ORDERS';
        openError.openOrders = openOrders.map((order) => ({ _id: String(order._id), orderNumber: order.orderNumber || '', status: order.status }));
        throw openError;
      }

      const previousStatus = booking.status;
      booking.status = 'cancelled';
      const actorFields = DHLService.timelineActor(actor, 'System');
      booking.timeline.push({
        status: 'cancelled',
        description: `Buchung storniert – Grund (intern): ${reason.slice(0, 500)}`,
        completedAt: new Date(),
        staffId: actorFields.staffId,
        staffName: actorFields.staffName,
      });

      // Bedingt speichern: ein paralleler Storno sendet keine zweite E-Mail.
      booking.$where = { status: previousStatus };
      let savedBooking;
      try {
        savedBooking = await booking.save();
      } catch (saveError) {
        if (saveError && saveError.name === 'DocumentNotFoundError') {
          const current = await Booking.findById(bookingId);
          if (current && current.status === 'cancelled') {
            current.$locals = current.$locals || {};
            current.$locals.unchanged = true;
            return current;
          }
          const conflictError = new Error('Der Buchungsstatus wurde gleichzeitig geändert. Bitte neu laden und erneut versuchen.');
          conflictError.statusCode = 409;
          conflictError.code = 'BOOKING_STATUS_CONFLICT';
          throw conflictError;
        }
        throw saveError;
      } finally {
        booking.$where = undefined;
      }
      console.log('BookingService: Booking cancelled successfully');

      setImmediate(async () => {
        try {
          const populatedBooking = await Booking.findById(savedBooking._id).populate('customerId', 'firstName lastName email');
          const customerEmail = populatedBooking?.customerId?.email || populatedBooking?.guestInfo?.email;
          if (!customerEmail) {
            return;
          }

          const customerName = populatedBooking?.customerId
            ? `${populatedBooking.customerId.firstName || ''} ${populatedBooking.customerId.lastName || ''}`.trim() || customerEmail
            : `${populatedBooking?.guestInfo?.firstName || ''} ${populatedBooking?.guestInfo?.lastName || ''}`.trim() || customerEmail;

          await EmailService.sendTriggerEmail('booking_cancelled', customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName,
            bookingNumber: populatedBooking.bookingNumber,
            cancellationReason: 'Durch Service-Team storniert',
            // Keine automatische Erstattung (HIST-14): Zahlungen werden gesondert geprueft.
            refundInfo: 'Bereits geleistete Zahlungen prüfen wir und melden uns zur Erstattung bei Ihnen.',
            // Nicht der Buchungsbetrag: ob und wie viel erstattet wird, ergibt sich erst aus den Zahlungen.
            refundAmount: 'Wird nach Prüfung der Zahlungen mitgeteilt',
            cancelledAt: new Date().toLocaleDateString('de-DE'),
            cancelledBy: 'McRepair Service-Team',
            newBookingUrl: await EmailService.buildSystemUrl('/bookings/new'),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        } catch (notificationError) {
          console.error('BookingService: Error sending booking cancellation email:', notificationError.message);
        }
      });

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error cancelling booking:', error);
      throw error;
    }
  }

  // Get all orders associated with a booking with their current repair progress status
  static async getBookingOrders(bookingId) {
    console.log('BookingService: Getting orders for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      // Fetch all orders directly linked to booking
      const directOrders = await Order.find({ bookingId: bookingId })
        .setOptions({ skipAutoPopulate: true })
        .select('orderNumber deviceType deviceBrand deviceModel status paymentStatus progress totalCost services shopProducts timeline hasComplaint isComplaintFollowup sourceComplaintId parentOrderId trackingNumber shippingStatus shippingStatusDescription')
        .lean();

      // Also include complaint follow-up orders that may not have bookingId set yet
      const directOrderIds = directOrders.map((order) => order._id);
      const followupOrders = directOrderIds.length
        ? await Order.find({
            isComplaintFollowup: true,
            parentOrderId: { $in: directOrderIds }
          })
            .setOptions({ skipAutoPopulate: true })
            .select('orderNumber deviceType deviceBrand deviceModel status paymentStatus progress totalCost services shopProducts timeline hasComplaint isComplaintFollowup sourceComplaintId parentOrderId trackingNumber shippingStatus shippingStatusDescription')
            .lean()
        : [];

      const allOrders = [...directOrders, ...followupOrders];
      const serviceIds = [...new Set(
        allOrders
          .flatMap((order) => Array.isArray(order.services) ? order.services : [])
          .map((service) => service?.serviceId)
          .filter(Boolean)
          .map((id) => String(id)))
      ];
      const productIds = [...new Set(
        allOrders
          .flatMap((order) => Array.isArray(order.shopProducts) ? order.shopProducts : [])
          .map((product) => product?.productId)
          .filter(Boolean)
          .map((id) => String(id)))
      ];

      const [serviceDocs, productDocs] = await Promise.all([
        serviceIds.length ? Service.find({ _id: { $in: serviceIds } }).select('name').lean() : [],
        productIds.length ? Product.find({ _id: { $in: productIds } }).select('name').lean() : [],
      ]);

      const serviceMap = new Map(serviceDocs.map((service) => [String(service._id), service]));
      const productMap = new Map(productDocs.map((product) => [String(product._id), product]));

      const allOrdersById = new Map();
      allOrders.forEach((order) => {
        allOrdersById.set(order._id.toString(), order);
      });

      const orders = Array.from(allOrdersById.values());
      const bookingItemByOrderId = new Map();
      (booking.items || []).forEach((item) => {
        if (item?.orderId) {
          bookingItemByOrderId.set(String(item.orderId), item);
        }
      });

      console.log('BookingService: Found', orders.length, 'orders for booking');

      // Transform orders to match expected structure with current repair progress status
      const transformedOrders = orders.map(order => {
        const orderIdString = order._id.toString();
        const bookingItem = bookingItemByOrderId.get(orderIdString);
        const timelineEntries = Array.isArray(order.timeline) ? order.timeline : [];
        const deviceChangeEntries = timelineEntries.filter((entry) => {
          if (!entry) return false;
          const status = String(entry.status || '').toLowerCase();
          const description = String(entry.description || '').toLowerCase();
          return status === 'device changed' || description.includes('device changed');
        });
        const orderProgress = this.resolveOrderProgress(order);
        let orderData = {
          orderId: orderIdString,
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          isComplaintFollowup: Boolean(order.isComplaintFollowup),
          sourceComplaintId: order.sourceComplaintId ? order.sourceComplaintId.toString() : null,
          parentOrderId: order.parentOrderId ? order.parentOrderId.toString() : null,
          status: order.status || 'pending',
          paymentStatus: order.paymentStatus || 'pending',
          progress: orderProgress,
          hasComplaint: Boolean(order.hasComplaint),
          // Auslieferung DIESES Geraets (McRepair -> Kunde), je Auftrag getrennt. Eine
          // Kopie des Einsendelabels der Buchung im Versandfeld (Altbestand) ist keine
          // Auslieferung und wird hier nicht als solche gezeigt.
          outboundShipment: order.trackingNumber && !(
            String(order.trackingNumber) === String(booking.trackingNumber || '')
            && this.resolveStoredShippingDirection(booking) === 'inbound'
          )
            ? {
              trackingNumber: order.trackingNumber,
              status: order.shippingStatus || '',
              statusDescription: order.shippingStatusDescription || '',
            }
            : null,
          cost: order.totalCost,
          bookingItemCost: Number(bookingItem?.cost || 0),
          hasDeviceChangeHistory: deviceChangeEntries.length > 0,
          deviceChangeCount: deviceChangeEntries.length,
          lastDeviceChangeAt:
            deviceChangeEntries.length > 0
              ? deviceChangeEntries[deviceChangeEntries.length - 1].completedAt || null
              : null,
        };

        if (order.deviceType === 'Shop Products') {
          // Shop product order
          orderData.products = order.shopProducts.map(product => ({
            name: productMap.get(String(product.productId))?.name || 'Unknown Product',
            quantity: product.quantity,
            price: product.priceAtOrder,
            totalPrice: product.priceAtOrder * product.quantity,
          }));
          orderData.device = 'Shop Products';
        } else {
          // Repair order
          orderData.device = `${order.deviceBrand} ${order.deviceModel}`;
          orderData.services = order.services.map(service => ({
            name: serviceMap.get(String(service.serviceId))?.name || service.name || 'Reparaturservice',
            price: service.price,
            estimatedTime: service.estimatedTime,
            status: service.status || 'pending',
          }));
        }

        return orderData;
      });

      console.log('BookingService: Transformed orders with current repair progress status');
      return transformedOrders;
    } catch (error) {
      console.error('BookingService: Error getting booking orders:', error);
      throw error;
    }
  }

  // Build invoice line items from actual (current) Order documents for a booking.
  // Produces one InvoiceItem per service / addOn / shop-product so the invoice
  // reflects the latest repair data, not the stale booking.items snapshot.
  static async _loadInvoiceOrders(booking) {
    const orderIds = Array.isArray(booking.orderIds)
      ? booking.orderIds.map((orderId) => String(orderId?._id || orderId)).filter(Boolean)
      : [];

    if (orderIds.length === 0) return [];

    const orders = await Order.find({ _id: { $in: orderIds } })
      .setOptions({ skipAutoPopulate: true })
      .select('orderNumber status totalCost deviceType deviceBrand deviceModel services shopProducts addOns')
      .populate('services.serviceId', 'name')
      .populate('shopProducts.productId', 'name');

    const orderPositionById = new Map(orderIds.map((orderId, index) => [orderId, index]));
    orders.sort((left, right) => {
      const leftIndex = orderPositionById.get(String(left._id)) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderPositionById.get(String(right._id)) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });

    return orders;
  }

  static _buildInvoiceItemsFromOrders(booking, orders = []) {
    if (!Array.isArray(orders) || orders.length === 0) return [];

    const bookingItemByOrderId = new Map();
    (booking.items || []).forEach((item) => {
      if (item?.orderId) bookingItemByOrderId.set(item.orderId.toString(), item);
    });

    const invoiceItems = [];

    for (const order of orders) {
      const bookingItem = bookingItemByOrderId.get(order._id.toString());
      const deviceLabel = (
        bookingItem?.device
        || `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim()
        || 'Gerät'
      );

      const isProductOrder = order.deviceType === 'Shop Products';

      if (isProductOrder) {
        if (order.shopProducts && order.shopProducts.length > 0) {
          for (const prod of order.shopProducts) {
            const qty = prod.quantity || 1;
            const serviceName = prod.productId?.name || 'Produkt';
            invoiceItems.push({
              serviceName,
              description: serviceName,
              quantity: qty,
              unitPrice: prod.priceAtOrder,
              total: prod.priceAtOrder * qty,
              type: 'product',
            });
          }
        } else {
          invoiceItems.push({
            serviceName: 'Produkte',
            description: 'Produkte',
            quantity: 1,
            unitPrice: order.totalCost,
            total: order.totalCost,
            type: 'product',
          });
        }
      } else {
        let hasItems = false;

        for (const svc of (order.services || [])) {
          // Manuelle Position: gespeicherter Name (und Beschreibung) statt Platzhalter.
          const serviceName = svc.serviceId?.name || String(svc.name || '').trim() || 'Reparaturservice';
          const manualDescription = svc.isManual ? String(svc.description || '').trim() : '';
          invoiceItems.push({
            serviceName,
            description: manualDescription ? `${deviceLabel} – ${serviceName}: ${manualDescription}` : `${deviceLabel} – ${serviceName}`,
            quantity: 1,
            unitPrice: svc.price,
            total: svc.price,
            type: 'service',
          });
          hasItems = true;
        }

        for (const addon of (order.addOns || [])) {
          invoiceItems.push({
            serviceName: addon.name,
            description: addon.name,
            quantity: 1,
            unitPrice: addon.price,
            total: addon.price,
            type: 'addon',
          });
          hasItems = true;
        }

        if (!hasItems) {
          const serviceName = `${deviceLabel} Reparatur`;
          invoiceItems.push({
            serviceName,
            description: serviceName,
            quantity: 1,
            unitPrice: order.totalCost,
            total: order.totalCost,
            type: 'service',
          });
        }
      }
    }

    return invoiceItems;
  }

  static async _buildInvoiceItems(booking, orders = null) {
    const resolvedOrders = Array.isArray(orders) ? orders : await BookingService._loadInvoiceOrders(booking);
    return BookingService._buildInvoiceItemsFromOrders(booking, resolvedOrders);
  }

  static _createInvoiceEligibilityError(message, details = {}) {
    const error = new Error(message);
    error.statusCode = 400;
    error.details = details;
    return error;
  }

  static _normalizeSelectedOrderIds(orderIds = []) {
    return orderIds.map((orderId) => String(orderId?._id || orderId)).filter(Boolean);
  }

  static _resolveInvoiceSelection(booking, orders, invoiceData = {}) {
    const bookingOrderIds = BookingService._normalizeSelectedOrderIds(booking.orderIds || []);
    if (bookingOrderIds.length === 0) {
      throw BookingService._createInvoiceEligibilityError('Für eine Rechnung muss der Buchung mindestens ein Auftrag zugeordnet sein.');
    }

    const orderById = new Map(orders.map((order) => [String(order._id), order]));
    const requestedOrderId = String(invoiceData.orderId || '').trim();
    const invoiceMode = requestedOrderId || invoiceData.invoiceMode === 'order' ? 'order' : 'booking';

    if (invoiceMode === 'order') {
      if (!requestedOrderId) {
        throw BookingService._createInvoiceEligibilityError('Für eine Teilrechnung bitte einen abgeschlossenen Auftrag auswählen.');
      }

      if (!bookingOrderIds.includes(requestedOrderId)) {
        throw BookingService._createInvoiceEligibilityError('Der gewählte Auftrag gehört nicht zu dieser Buchung.');
      }

      const selectedOrder = orderById.get(requestedOrderId);
      if (!selectedOrder) {
        throw BookingService._createInvoiceEligibilityError('Der gewählte Auftrag konnte nicht geladen werden.');
      }

      if (selectedOrder.status !== 'completed') {
        throw BookingService._createInvoiceEligibilityError(
          `Eine Teilrechnung ist nur für abgeschlossene Aufträge möglich. Auftrag ${selectedOrder.orderNumber || requestedOrderId} ist derzeit „${BookingService._orderStatusLabelDe(selectedOrder.status)}“.`
        );
      }

      return {
        invoiceMode,
        selectedOrders: [selectedOrder],
        selectedOrderIds: [requestedOrderId],
      };
    }

    const incompleteOrders = orders.filter((order) => order.status !== 'completed');
    if (incompleteOrders.length > 0) {
      const incompleteOrderLabels = incompleteOrders
        .map((order) => `${order.orderNumber || order._id} (${BookingService._orderStatusLabelDe(order.status)})`)
        .join(', ');

      throw BookingService._createInvoiceEligibilityError(
        `Eine Buchungsrechnung ist erst möglich, wenn alle Aufträge abgeschlossen sind. Offen: ${incompleteOrderLabels}.`,
        {
          incompleteOrders: incompleteOrders.map((order) => ({
            _id: String(order._id),
            orderNumber: order.orderNumber,
            status: order.status,
          })),
        }
      );
    }

    return {
      invoiceMode,
      selectedOrders: orders,
      selectedOrderIds: bookingOrderIds,
    };
  }

  static _orderStatusLabelDe(status) {
    try {
      const { statusLabelDe } = require('../utils/orderHistory');
      if (typeof statusLabelDe === 'function') return statusLabelDe(status);
    } catch (error) {
      // Hilfsmodul nicht ladbar: Rohwert anzeigen statt abzubrechen.
    }
    return String(status || 'unbekannt');
  }

  /**
   * FIN-3: DIESELBE Duplikatregel wie alle anderen Rechnungswege (FinancialService):
   * gezaehlt werden nur AKTIVE Rechnungen (keine Gutschriften, nicht storniert, nicht
   * vollstaendig gutgeschrieben). Frueher blockierte hier jede Rechnung inkl. Storno-
   * Gutschrift ("An invoice already exists for this booking (INV-CN-…)") - nach einem
   * Storno war keine neue Buchungsrechnung moeglich. Meldungen deutsch.
   */
  static async _assertNoExistingInvoiceForSelection(bookingId, invoiceMode, selectedOrderIds, selectedOrders = null) {
    // Lazy require: FinancialService laedt ueber BookingPaymentService auf diese Datei zurueck.
    const FinancialService = require('./financialService');
    const orderRefs = Array.isArray(selectedOrders) && selectedOrders.length > 0 ? selectedOrders : selectedOrderIds;
    if (invoiceMode !== 'order') {
      await FinancialService.assertBookingNotYetInvoiced(bookingId);
    }
    await FinancialService.assertOrdersNotYetInvoiced(orderRefs);
  }

  static async _resolveInvoiceDiscount({ booking, invoiceMode, selectedOrderIds, allInvoiceItems, selectedInvoiceItems }) {
    const bookingDiscount = Number(booking.discount || 0);
    if (bookingDiscount <= 0) return 0;

    const selectedGross = selectedInvoiceItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    if (selectedGross <= 0) return 0;

    const bookingOrderIds = BookingService._normalizeSelectedOrderIds(booking.orderIds || []);
    if (invoiceMode !== 'order' || selectedOrderIds.length === bookingOrderIds.length) {
      return Math.min(BookingService.roundCurrency(bookingDiscount), selectedGross);
    }

    const existingInvoices = await Invoice.find({ bookingId: booking._id })
      .select('discount repairOrderIds')
      .lean();

    const alreadyAppliedDiscount = BookingService.roundCurrency(
      existingInvoices.reduce((sum, invoice) => sum + Number(invoice.discount || 0), 0)
    );
    const remainingDiscount = Math.max(0, BookingService.roundCurrency(bookingDiscount - alreadyAppliedDiscount));
    if (remainingDiscount <= 0) return 0;

    const invoicedOrderIds = new Set(
      existingInvoices.flatMap((invoice) => BookingService._normalizeSelectedOrderIds(invoice.repairOrderIds || []))
    );
    const remainingOrderIds = bookingOrderIds.filter((orderId) => !invoicedOrderIds.has(orderId));
    const selectedOrderIdSet = new Set(selectedOrderIds);
    const coversAllRemainingOrders = remainingOrderIds.length === selectedOrderIds.length
      && remainingOrderIds.every((orderId) => selectedOrderIdSet.has(orderId));

    if (coversAllRemainingOrders) {
      return Math.min(remainingDiscount, selectedGross);
    }

    const bookingGross = allInvoiceItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    if (bookingGross <= 0) return 0;

    const proratedDiscount = BookingService.roundCurrency((bookingDiscount * selectedGross) / bookingGross);
    return Math.min(remainingDiscount, selectedGross, proratedDiscount);
  }

  // Compute invoice financial totals for gross-priced items (VAT is included in prices,
  // not added on top). Extracts the tax portion using the configured tax rate.
  static async _computeInvoiceTotals(invoiceItems, discount = 0, { taxRateOverride = null } = {}) {
    let taxRatePct;
    if (Number.isFinite(Number(taxRateOverride)) && taxRateOverride !== null) {
      taxRatePct = Number(taxRateOverride);
    } else {
      const config = await SystemConfiguration.findOne()
        .select('financialSettings.defaults.taxRate')
        .lean();
      taxRatePct = config?.financialSettings?.defaults?.taxRate ?? 19;
    }

    const itemsGrossTotal = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const grossAfterDiscount = Math.max(0, itemsGrossTotal - discount);

    // Prices are gross (inclusive of VAT) → extract tax: grossAfterDiscount × rate/(100+rate)
    const tax = Math.round(grossAfterDiscount * taxRatePct / (100 + taxRatePct) * 100) / 100;
    const subtotal = Math.round((grossAfterDiscount - tax) * 100) / 100;

    // taxRatePct wird MIT zurueckgegeben: der Beleg muss den tatsaechlich
    // verwendeten Satz tragen. Frueher stand hier fest 19 auf dem Dokument, waehrend
    // die Betraege mit dem konfigurierten Satz gerechnet wurden - bei einem Shop mit
    // 7% ergab das eine Rechnung, die rechnerisch nicht zu ihrem Steuersatz passt.
    return { subtotal, tax, discount, total: grossAfterDiscount, taxRate: taxRatePct };
  }

  /**
   * FIN-13 (Buchungsweg): Steuerbehandlung der Buchungsrechnung aus dem gespeicherten
   * Kunden-/Gruppenprofil, wie "Rechnungen aus Auftraegen" (buildRepairOrdersInvoice).
   * Eine ausdrueckliche Angabe invoiceData.isReverseCharge (true/false) gewinnt; sonst
   * reverse_charge => Reverse Charge (MwSt. 0 + Hinweis), tax_free => MwSt. 0.
   * Gespeicherte Auftragssteuersaetze werden nicht veraendert.
   */
  static async _resolveBookingInvoiceTax(booking, invoiceData = {}) {
    const explicit = invoiceData.isReverseCharge !== undefined && invoiceData.isReverseCharge !== null && invoiceData.isReverseCharge !== '';
    let taxMode = 'default';
    if (!explicit && booking?.customerId) {
      try {
        const FinancialService = require('./financialService');
        const profile = await FinancialService.resolveFinancialProfile({ customerId: booking.customerId?._id || booking.customerId });
        taxMode = String(profile?.taxMode || 'default');
      } catch (error) {
        console.error('BookingService: invoice tax profile could not be resolved:', error.message);
      }
    }
    const isReverseCharge = explicit
      ? (invoiceData.isReverseCharge === true || invoiceData.isReverseCharge === 'true')
      : taxMode === 'reverse_charge';
    const taxFree = !explicit && taxMode === 'tax_free';
    return { isReverseCharge, taxFree, taxMode, taxRateOverride: (isReverseCharge || taxFree) ? 0 : null };
  }

  // Preview invoice for a booking
  static async previewInvoice(bookingId, invoiceData = {}) {
    console.log('BookingService: Previewing invoice for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName name email phone invoiceAddress paymentAddress');

      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      const allOrders = await BookingService._loadInvoiceOrders(booking);
      const { invoiceMode, selectedOrders, selectedOrderIds } = BookingService._resolveInvoiceSelection(booking, allOrders, invoiceData);
      await BookingService._assertNoExistingInvoiceForSelection(booking._id, invoiceMode, selectedOrderIds, selectedOrders);

      const primaryOrder = selectedOrders[0]
        ? await Order.findById(selectedOrders[0]._id)
          .select('billingAddress shippingAddress guestInfo.billingAddress guestInfo.shippingAddress')
          .lean()
        : null;

      const customerPaymentAddress = booking.customerId?.paymentAddress;

      const billingAddress = this.pickFirstAddress(
        booking.customerId?.invoiceAddress,
        booking.billingAddress,
        booking.guestInfo?.billingAddress,
        primaryOrder?.billingAddress,
        primaryOrder?.guestInfo?.billingAddress,
        booking.customerId?.paymentAddress,
      );

      const shippingAddress = customerPaymentAddress?.sameAsInvoice === false
        ? this.pickFirstAddress(
          customerPaymentAddress,
          booking.shippingAddress,
          booking.guestInfo?.shippingAddress,
          primaryOrder?.shippingAddress,
          primaryOrder?.guestInfo?.shippingAddress,
        )
        : this.pickFirstAddress(
          booking.shippingAddress,
          booking.guestInfo?.shippingAddress,
          primaryOrder?.shippingAddress,
          primaryOrder?.guestInfo?.shippingAddress,
          booking.guestInfo?.billingAddress,
          booking.customerId?.invoiceAddress,
        );

      // Build invoice preview from current order data (not stale booking.items snapshot)
      const previewItems = BookingService._buildInvoiceItemsFromOrders(booking, selectedOrders);
      const previewDiscount = await BookingService._resolveInvoiceDiscount({
        booking,
        invoiceMode,
        selectedOrderIds,
        allInvoiceItems: BookingService._buildInvoiceItemsFromOrders(booking, allOrders),
        selectedInvoiceItems: previewItems,
      });
      const previewTax = await BookingService._resolveBookingInvoiceTax(booking, invoiceData);
      const previewTotals = await BookingService._computeInvoiceTotals(previewItems, previewDiscount, { taxRateOverride: previewTax.taxRateOverride });

      const invoicePreview = {
        invoiceMode,
        selectedOrderIds,
        customerName: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim() || booking.customerId?.name || `${booking.guestInfo?.firstName || ''} ${booking.guestInfo?.lastName || ''}`.trim() || 'N/A',
        customerEmail: booking.customerId?.email || booking.guestInfo?.email || 'N/A',
        billingAddress,
        shippingAddress,
        items: previewItems,
        subtotal: previewTotals.subtotal,
        tax: previewTotals.tax,
        discount: previewTotals.discount,
        total: previewTotals.total,
        taxRate: previewTotals.taxRate,
        isReverseCharge: previewTax.isReverseCharge,
        taxMode: previewTax.taxMode,
      };

      console.log('BookingService: Invoice preview generated successfully');
      return invoicePreview;
    } catch (error) {
      console.error('BookingService: Error previewing invoice:', error);
      throw error;
    }
  }

  // Create invoice from booking
  static async createInvoice(bookingId, invoiceData = {}) {
    console.log('BookingService: Creating invoice for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName name email phone invoiceAddress paymentAddress vatId country');

      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      const allOrders = await BookingService._loadInvoiceOrders(booking);
      const { invoiceMode, selectedOrders, selectedOrderIds } = BookingService._resolveInvoiceSelection(booking, allOrders, invoiceData);
      await BookingService._assertNoExistingInvoiceForSelection(booking._id, invoiceMode, selectedOrderIds, selectedOrders);

      const primaryOrderId = selectedOrders.length > 0 ? selectedOrders[0]._id : null;
      const primaryOrder = primaryOrderId
        ? await Order.findById(primaryOrderId)
          .select('billingAddress shippingAddress guestInfo.billingAddress guestInfo.shippingAddress')
          .lean()
        : null;

      // Extract customer information with safe fallbacks
      const customerName = (
        `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim()
        || String(booking.customerId?.name || '').trim()
        || `${booking.guestInfo?.firstName || ''} ${booking.guestInfo?.lastName || ''}`.trim()
        || 'N/A'
      );
      const customerEmail = String(booking.customerId?.email || booking.guestInfo?.email || 'N/A').trim();

      const customerPaymentAddress = booking.customerId?.paymentAddress;

      const billingAddress = this.pickFirstAddress(
        booking.customerId?.invoiceAddress,
        booking.billingAddress,
        booking.guestInfo?.billingAddress,
        primaryOrder?.billingAddress,
        primaryOrder?.guestInfo?.billingAddress,
        booking.customerId?.paymentAddress,
      );

      const shippingAddress = customerPaymentAddress?.sameAsInvoice === false
        ? this.pickFirstAddress(
          customerPaymentAddress,
          booking.shippingAddress,
          booking.guestInfo?.shippingAddress,
          primaryOrder?.shippingAddress,
          primaryOrder?.guestInfo?.shippingAddress,
        )
        : this.pickFirstAddress(
          booking.shippingAddress,
          booking.guestInfo?.shippingAddress,
          primaryOrder?.shippingAddress,
          primaryOrder?.guestInfo?.shippingAddress,
          booking.guestInfo?.billingAddress,
          booking.customerId?.invoiceAddress,
        );

      console.log('BookingService: Creating invoice with customer:', customerName, 'Email:', customerEmail);

      // Zahlungsziel aus DERSELBEN gespeicherten Bedingung wie alle anderen Rechnungswege
      // (Kunden-/Gruppenprofil, FinancialService.resolveFinancialProfile). Frueher stand
      // hier fest +30 Tage - daneben zeigte das Kundenprofil z.B. 7 Tage.
      // Lazy require: FinancialService laedt ueber BookingPaymentService auf diese Datei zurueck.
      let paymentDueDays = null;
      if (!invoiceData.dueDate) {
        const FinancialService = require('./financialService');
        let profile = null;
        try {
          profile = await FinancialService.resolveFinancialProfile({ customerId: booking.customerId?._id || null });
        } catch (profileError) {
          // Kundenprofil nicht lesbar: das Standardprofil OHNE Kunde - dieselbe Quelle
          // (Finanzeinstellungen) und dieselbe Normalisierung (normalizePaymentDueDays,
          // 1-14 Tage) wie jeder andere Rechnungsweg, statt des rohen Einstellungswerts
          // oder eines festen Werts. Datum und Text bleiben deckungsgleich.
          console.error('BookingService: payment terms profile could not be resolved:', profileError.message);
          try {
            profile = await FinancialService.resolveFinancialProfile({ customerId: null });
          } catch (defaultProfileError) {
            // Auch die Finanzeinstellungen sind nicht lesbar (z. B. Datenbankfehler): die
            // Rechnung trotzdem erstellen - mit der Standardfrist, die normalizePaymentDueDays
            // (financialService) ohne gueltige Angabe verwendet. Datum und Text bleiben deckungsgleich.
            console.error('BookingService: default payment terms could not be resolved:', defaultProfileError.message);
            profile = { paymentDueDays: BOOKING_INVOICE_FALLBACK_DUE_DAYS };
          }
        }
        const resolvedDueDays = Number(profile?.paymentDueDays);
        paymentDueDays = Number.isFinite(resolvedDueDays) && resolvedDueDays > 0 ? resolvedDueDays : null;
      }

      // Build invoice items from current order data and compute correct totals.
      // Prices are gross (VAT inclusive) – VAT is extracted, NOT added on top again.
      const invoiceItems = BookingService._buildInvoiceItemsFromOrders(booking, selectedOrders);
      const invoiceDiscount = await BookingService._resolveInvoiceDiscount({
        booking,
        invoiceMode,
        selectedOrderIds,
        allInvoiceItems: BookingService._buildInvoiceItemsFromOrders(booking, allOrders),
        selectedInvoiceItems: invoiceItems,
      });
      const invoiceTax = await BookingService._resolveBookingInvoiceTax(booking, invoiceData);
      const invoiceTotals = await BookingService._computeInvoiceTotals(invoiceItems, invoiceDiscount, { taxRateOverride: invoiceTax.taxRateOverride });

      console.log('BookingService: Created', invoiceItems.length, 'invoice items, gross total:', invoiceTotals.total);

      // FIN-13: frueher nur invoiceData.isReverseCharge - ein Reverse-Charge-Kunde bekam
      // ueber "Buchungen -> Rechnung erstellen" 19 % MwSt.
      const isReverseCharge = invoiceTax.isReverseCharge;
      const customerVatId = String(invoiceData.customerVatId || booking.customerId?.vatId || '').trim();
      const sellerVatId = String(invoiceData.sellerVatId || '').trim();
      const reverseChargeNotice = invoiceData.reverseChargeNotice || (isReverseCharge ? 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge' : undefined);

      // Create invoice
      const invoice = new Invoice({
        customerId: booking.customerId._id,
        customerName: customerName,
        customerEmail: customerEmail,
        customerVatId: customerVatId || undefined,
        sellerVatId: sellerVatId || undefined,
        isReverseCharge,
        reverseChargeNotice,
        zmRelevant: isReverseCharge,
        taxRate: isReverseCharge ? 0 : invoiceTotals.taxRate,
        billingAddress: billingAddress || undefined,
        shippingAddress: shippingAddress || undefined,
        orderId: primaryOrderId,
        repairOrderIds: selectedOrderIds,
        bookingId: booking._id,
        items: invoiceItems,
        subtotal: isReverseCharge ? invoiceTotals.total : invoiceTotals.subtotal,
        tax: isReverseCharge ? 0 : invoiceTotals.tax,
        discount: invoiceTotals.discount,
        total: invoiceTotals.total,
        status: 'sent',
        // Datum und Wortlaut leitet das Invoice-Modell gemeinsam aus paymentDueDays ab;
        // ein ausdruecklich gewaehltes Datum gewinnt (Text folgt dann dem Datum).
        dueDate: invoiceData.dueDate || (paymentDueDays ? new Date(Date.now() + paymentDueDays * 24 * 60 * 60 * 1000) : undefined),
        paymentDueDays: invoiceData.dueDate ? undefined : (paymentDueDays || undefined),
        notes: invoiceData.notes || '',
        sentAt: new Date(),
      });

      // FIN-3: atomarer Anspruch wie bei allen anderen Rechnungswegen (activeBillingKeys,
      // partieller Unique-Index): zwei gleichzeitige "Rechnung erstellen" ergeben genau
      // EINE Rechnung, der zweite Aufruf bekommt die deutsche 409. Eine Teilrechnung
      // (Modus 'order') beansprucht nur ihren Auftrag, nicht die ganze Buchung.
      const FinancialServiceForClaim = require('./financialService');
      await FinancialServiceForClaim.saveClaimedInvoice(invoice, {
        orders: selectedOrders,
        claimBooking: invoiceMode !== 'order',
      });
      const savedInvoice = invoice;
      console.log('BookingService: Invoice created successfully:', savedInvoice._id, 'Number:', savedInvoice.invoiceNumber);

      // Gemeinsamer Abschluss: bereits eingegangene Vorauszahlungen zuordnen und den
      // Zahlungsstand aus den Zahlungen ableiten. Der Belegstatus ('sent') wird
      // bewusst NICHT mehr nach booking.paymentStatus kopiert - er beschreibt den
      // Beleg, nicht die Zahlung.
      //
      // Lazy require: FinancialService laedt ueber BookingPaymentService wieder auf
      // diese Datei zurueck; ein Top-Level-Import erzeugte einen Ladezyklus.
      // Bewusst nicht fatal - der Beleg ist geschrieben, eine fehlgeschlagene
      // Zuordnung darf die Rechnungserstellung nicht nachtraeglich scheitern lassen.
      let finalizedInvoice = savedInvoice;
      try {
        const FinancialService = require('./financialService');
        finalizedInvoice = await FinancialService.finalizeInvoiceCreation(savedInvoice) || savedInvoice;
      } catch (finalizeError) {
        console.error('BookingService: finalizing invoice creation failed:', finalizeError.message);
      }

      // FIN-3: KEIN eigener Mailversand mehr. Frueher ging hier zusaetzlich eine
      // "invoice_created"-Mail ohne PDF raus (mit dem kompletten Auftragsobjekt als
      // "Auftragsnummer"), auch wenn "sofort senden" abgewaehlt war. Versendet wird
      // ausschliesslich ueber FinancialService.sendInvoice (PDF, Verlauf, Benachrichtigung).

      // Der frisch gelesene Beleg traegt den Zahlungsstand NACH der Zuordnung
      // (paidAmount/status), der Aufrufer bekommt also keine veraltete Sicht.
      return finalizedInvoice || savedInvoice;
    } catch (error) {
      console.error('BookingService: Error creating invoice:', error.message);
      console.error('BookingService: Full error details:', error);
      throw error;
    }
  }

  // Get all invoices for a booking
  /**
   * Rechnungen einer Buchung.
   *
   * @param {object} options
   * @param {boolean} options.includeDrafts  Entwuerfe mitliefern. Nur Admin/Staff;
   *   der Kunde sieht - wie in der Rechnungsuebersicht - keine Entwuerfe.
   */
  static async getBookingInvoices(bookingId, options = {}) {
    console.log('BookingService: Getting invoices for booking:', bookingId);

    try {
      // VOLLSTAENDIGE ABDECKUNG: Eine Rechnung kann auf die Buchung zeigen ODER nur
      // auf einen ihrer Auftraege (Altbestand ohne bookingId, Gutschriften, die vor
      // dem Kopieren der bookingId entstanden sind, Sammelrechnungen ueber
      // repairOrderIds). Nur nach bookingId zu suchen verliert genau diese Belege.
      const orderIds = await Order.find({ bookingId: bookingId }).distinct('_id');

      const query = {
        $or: [
          { bookingId: bookingId },
          ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
          ...(orderIds.length ? [{ repairOrderIds: { $in: orderIds } }] : [])
        ]
      };
      if (!options.includeDrafts) {
        query.status = { $ne: 'draft' };
      }

      const invoices = await Invoice.find(query)
        .sort({ createdAt: -1 });

      console.log('BookingService: Found', invoices.length, 'invoices for booking');

      // Zahlungsstand je Beleg aus DERSELBEN Berechnung wie GET /api/invoices
      // (PaymentService.getInvoiceBalances + FinancialService.toBalancePayload). Damit muss
      // die Oberflaeche nicht zusaetzlich die gesamte Rechnungsliste laden. Die Belegfelder
      // bleiben unveraendert (toJSON wie bisher bei res.json); ergaenzt werden nur
      // balance / paymentState. Faellt die Berechnung aus: balance null (unbekannt).
      let balances = null;
      try {
        const PaymentService = require('./paymentService');
        balances = await PaymentService.getInvoiceBalances(invoices);
      } catch (balanceError) {
        console.error('BookingService: invoice balances could not be computed:', balanceError.message);
      }
      const FinancialService = require('./financialService');
      return invoices.map((invoice) => {
        const plain = typeof invoice.toJSON === 'function' ? invoice.toJSON() : { ...invoice };
        const balance = balances ? balances.get(String(invoice._id)) : null;
        return {
          ...plain,
          balance: balance ? FinancialService.toBalancePayload(balance) : null,
          paymentState: balance ? (balance.paymentState || 'open') : null,
        };
      });
    } catch (error) {
      console.error('BookingService: Error getting invoices:', error);
      throw error;
    }
  }

  // Calculate and update booking progress and status based on orders
  static async updateBookingProgressAndStatus(bookingId) {
    console.log('BookingService: Updating booking progress and status:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      // Get all orders for this booking
      const allOrders = await Order.find({ bookingId: bookingId });

      if (allOrders.length === 0) {
        console.log('BookingService: No orders found for booking');
        return booking;
      }

      // Calculate overall progress from all orders
      let totalProgress = 0;
      let completedCount = 0;

      allOrders.forEach(order => {
        totalProgress += this.resolveOrderProgress(order);
        if (order.status === 'completed') {
          completedCount++;
        }
      });

      const averageProgress = Math.round(totalProgress / allOrders.length);
      booking.overallProgress = averageProgress;

      // Update booking status based on order statuses
      if (completedCount === allOrders.length) {
        booking.status = 'completed';
      } else if (completedCount > 0 || averageProgress > 0) {
        booking.status = 'processing';
      }

      const savedBooking = await booking.save();
      console.log('BookingService: Booking progress and status updated:', averageProgress, '%', 'Status:', booking.status);

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error updating booking progress:', error);
      throw error;
    }
  }
}

module.exports = BookingService;
