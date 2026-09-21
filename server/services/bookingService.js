const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const InspectionCommunication = require('../models/InspectionCommunication');
const DHLService = require('./dhlService');
const SystemConfiguration = require('../models/SystemConfiguration');
const EmailService = require('./emailService');

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
    return `EUR ${numericValue.toFixed(2)}`;
  }

  static roundCurrency(amount) {
    return Math.round(Number(amount || 0) * 100) / 100;
  }

  static resolveBookingPricing({ orderGrossTotal, bookingData = {} }) {
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

    const subtotal = this.roundCurrency(orderGrossTotal);
    const discount = this.roundCurrency(bookingData.discount);
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
            name: service.serviceId?.name || 'Unknown Service',
            price: service.price,
            estimatedTime: service.estimatedTime,
          }));
        }

        items.push(itemData);
      }

      // Order prices are gross. Use the checkout calculation as the authoritative
      // financial snapshot so VAT is never added a second time during booking creation.
      const bookingPricing = this.resolveBookingPricing({
        orderGrossTotal,
        bookingData,
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
          console.error('BookingService: Error creating outbound shipping label for booking (non-fatal):', shippingLabelError.message);
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
                filename: `versandlabel-${savedBooking.bookingNumber || savedBooking._id}.pdf`,
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
            totalAmount: this.formatCurrencyEUR(savedBooking.totalCost || 0),
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

    // `booking.trackingNumber` / `booking.shippingLabelUrl` bedeuten im gesamten Produkt
    // das EINSENDELABEL (Kunde -> McRepair, "Versand an McRepair (Hinweg)"). Ein bereits
    // vorhandenes Label darf deshalb nur als Antwort auf eine Anfrage GLEICHER Richtung
    // zurueckgegeben werden - sonst meldet der Aufrufer Erfolg und zeigt die
    // Sendungsnummer der Gegenrichtung an.
    if (booking.shippingLabelUrl && booking.trackingNumber) {
      const existingDirection = 'inbound';
      const requestedDirection = this.resolveBookingLabelDirection(options.shipmentData || {});
      if (requestedDirection !== existingDirection) {
        throw new Error(
          'Für diese Buchung ist bereits ein Einsendelabel (Kunde an McRepair) hinterlegt. '
          + 'Ein Label für den Rückweg (McRepair an Kunde) kann an der Buchung nicht zusätzlich '
          + 'gespeichert werden – bitte das Versandlabel am zugehörigen Auftrag erstellen.'
        );
      }
      return booking;
    }

    const mode = await this.getBookingShippingLabelMode();
    if (mode === 'dummy') {
      return this.createDummyShippingLabelForBooking(booking);
    }
    return this.createLiveShippingLabelForBooking(booking, options);
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

  static resolveStoredShippingDirection(booking) {
    const timeline = Array.isArray(booking?.timeline) ? booking.timeline : [];

    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      const entry = timeline[index];
      if (String(entry?.status || '') !== 'Shipping Label Created') continue;
      // Neue Eintraege sind deutsch ('Rückweg'/'Hinweg'), Altbestand englisch
      // ('outbound'/'inbound') - beide muessen erkannt werden.
      const description = String(entry?.description || '').toLowerCase();
      if (description.includes('rückweg') || description.includes('rueckweg') || description.includes('outbound')) return 'outbound';
      if (description.includes('hinweg') || description.includes('inbound')) return 'inbound';
    }

    return 'inbound';
  }

  /**
   * Die Shop-Anschrift aus der aktiven DHL-Integration - EINE Quelle, Strasse und
   * Hausnummer immer als Paar. Wird gebraucht, weil der Endpunkt auch von Mitarbeitenden
   * aufgerufen wird, die die (nur fuer Administratoren lesbare) Integrationseinstellung
   * selbst nicht lesen koennen und deshalb nur ein Flag schicken.
   */
  static resolveConfiguredShopAddress(dhlConfig) {
    const settings = dhlConfig?.settings || {};
    const shipper = settings.shipper || {};
    const rawStreet = String(settings.shipperStreet || shipper.street || '').trim();
    const split = DHLService.splitStreetAndHouse(rawStreet);

    return {
      name: settings.shipperCompany || shipper.company || settings.shipperName || '',
      street: split.street || rawStreet,
      house: split.house || String(settings.shipperNumber || shipper.number || '').trim(),
      city: settings.shipperCity || shipper.city || '',
      postalCode: settings.shipperPostalCode || shipper.postalCode || '',
      country: settings.shipperCountry || shipper.country || 'DE',
      email: settings.shipperEmail || shipper.email || process.env.SUPPORT_EMAIL || 'info@mcrepair.de',
      phone: settings.shipperPhone || shipper.phone || '+49301234567',
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

  static async createDummyShippingLabelForBooking(booking) {
    const refreshedBooking = await Booking.findById(booking._id);

    if (!refreshedBooking) {
      throw new Error('Die Buchung wurde nach dem Anlegen nicht mehr gefunden.');
    }

    const trackingNumber = this.buildDummyBookingTrackingNumber(refreshedBooking);
    const shippingCreatedAt = new Date();

    refreshedBooking.trackingNumber = trackingNumber;
    refreshedBooking.carrier = 'DHL';
    refreshedBooking.shippingStatus = 'label-created';
    refreshedBooking.shippingStatusDescription = 'DHL-Dummy-Versandlabel wurde vorbereitet';
    refreshedBooking.shippingLabelUrl = this.buildDummyBookingLabelUrl(refreshedBooking, trackingNumber);
    refreshedBooking.shippingCost = refreshedBooking.shippingCost || 0;
    refreshedBooking.estimatedDelivery = refreshedBooking.estimatedDelivery || new Date(shippingCreatedAt.getTime() + (3 * 24 * 60 * 60 * 1000));
    refreshedBooking.shippingCreatedAt = shippingCreatedAt;
    refreshedBooking.timeline.push({
      status: 'Shipping Label Prepared',
      description: `DHL-Dummy-Versandlabel für die Buchung vorbereitet (Hinweg: Kunde an McRepair). Sendungsnummer: ${trackingNumber}`,
      completedAt: shippingCreatedAt,
      staffId: 'system',
      staffName: 'DHL Dummy Integration',
    });

    await refreshedBooking.save();
    return refreshedBooking;
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

    let lastError = null;

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
            throw new Error(
              `Die Shop-Adresse ist in der DHL-Integration nicht vollständig hinterlegt (${missingShopFields.join(', ')}). `
              + 'Bitte unter Systemkonfiguration → Integrationen → DHL Straße mit Hausnummer, PLZ und Ort eintragen.'
            );
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
          throw new Error(`Empfängeradresse unvollständig: ${missingReceiverFields.map(([field]) => field).join(', ')}.`);
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
          throw new Error(`Absenderdaten unvollständig: ${missingShipperFields.map(([field]) => field).join(', ')}.`);
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

        const shipmentResult = await DHLService.createShipment(orderId, shipmentData);
        const refreshedBooking = await Booking.findById(booking._id);

        if (!refreshedBooking) {
          throw new Error('Die Buchung wurde nach der Label-Erstellung nicht mehr gefunden.');
        }

        refreshedBooking.trackingNumber = shipmentResult?.trackingNumber || refreshedBooking.trackingNumber;
        refreshedBooking.carrier = 'DHL';
        refreshedBooking.shippingStatus = 'label-created';
        refreshedBooking.shippingStatusDescription = labelDirection === 'outbound'
          ? 'DHL-Versandlabel (Rückweg: McRepair an Kunde) wurde erstellt'
          : 'DHL-Einsendelabel (Hinweg: Kunde an McRepair) wurde erstellt';
        refreshedBooking.shippingLabelUrl = shipmentResult?.labelUrl || refreshedBooking.shippingLabelUrl;
        refreshedBooking.shippingCost = shipmentResult?.shippingCost || refreshedBooking.shippingCost || 0;
        refreshedBooking.estimatedDelivery = shipmentResult?.estimatedDelivery || refreshedBooking.estimatedDelivery;
        refreshedBooking.shippingCreatedAt = new Date();
        refreshedBooking.timeline.push({
          status: 'Shipping Label Created',
          description: `DHL-Versandlabel für die Buchung erstellt (${labelDirection === 'outbound' ? 'Rückweg: McRepair an Kunde' : 'Hinweg: Kunde an McRepair'}). Sendungsnummer: ${refreshedBooking.trackingNumber || 'noch offen'}`,
          completedAt: new Date(),
          staffId: 'system',
          staffName: 'DHL Parcel Integration',
        });

        await refreshedBooking.save();
        return refreshedBooking;
      } catch (error) {
        lastError = error;
        console.error(`BookingService: Failed to create live shipping label for order ${orderId}:`, error.message);
      }
    }

    throw lastError || new Error('Das DHL-Versandlabel für diese Buchung konnte nicht erstellt werden.');
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

  static async getCommunicationOrderIds(communication, userId) {
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

    return communications
      .filter((communicationThread) => communicationThread.messages.some((message) => {
        const readByCurrentUser = (message.readBy || []).some(
          (readEntry) => String(readEntry.userId || '') === String(userId)
        );
        const feedbackResponse = message.feedbackRequest?.status === 'responded'
          && message.feedbackRequest?.respondedAt;

        if (feedbackResponse) {
          return !(message.readBy || []).some((readEntry) => (
            String(readEntry.userId || '') === String(userId)
            && new Date(readEntry.readAt) >= new Date(message.feedbackRequest.respondedAt)
          ));
        }

        return message.senderType === 'customer' && !readByCurrentUser;
      }))
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
        query.$or = await BookingService.buildSearchClause(filters.search);
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
   */
  static async buildPaymentBalanceMap(bookings = []) {
    const result = new Map();
    if (!bookings || bookings.length === 0) return result;

    try {
      const PaymentService = require('./paymentService');
      const balances = await PaymentService.getBookingBalancesBulk(bookings.map((booking) => booking._id));

      bookings.forEach((booking) => {
        const key = String(booking._id);
        const entry = balances.get(key) || { invoicedTotal: 0, allocated: 0, open: 0, overpaid: 0, received: 0, unallocated: 0 };
        const orderValue = BookingService.roundCurrency(Number(booking.totalCost || 0));
        // Bezugsgroesse: ohne Rechnung ist es der Auftragswert.
        const reference = entry.invoicedTotal > 0.009 ? entry.invoicedTotal : orderValue;

        result.set(key, {
          total: reference,
          orderValue,
          invoicedTotal: entry.invoicedTotal,
          allocated: entry.allocated,
          received: entry.received,
          unallocated: entry.unallocated,
          open: BookingService.roundCurrency(Math.max(0, reference - entry.received)),
          invoiceOpen: entry.open,
          overpaid: BookingService.roundCurrency(Math.max(0, entry.received - reference)),
        });
      });
    } catch (error) {
      console.error('BookingService: Error computing payment balances:', error);
    }

    return result;
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

      const bookings = await Booking.find(query)
        .setOptions({ skipAutoPopulate: true })
        .select('customerId bookingNumber status billingStatus paymentStatus totalCost items createdAt updatedAt shippingStatus trackingNumber guestInfo')
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
            .select('_id bookingId status progress hasComplaint')
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
          bookingPlain.paymentBalance = balanceByBookingId.get(bookingKey)
            || { total: 0, invoicedTotal: 0, allocated: 0, received: 0, open: 0, overpaid: 0, unallocated: 0 };

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
      const allOrders = bookingIds.length
        ? await Order.find({ bookingId: { $in: bookingIds } })
            .setOptions({ skipAutoPopulate: true })
            .select('_id bookingId status progress')
            .lean()
        : [];

      const ordersByBookingId = new Map();
      allOrders.forEach((order) => {
        const bookingKey = String(order.bookingId);
        if (!ordersByBookingId.has(bookingKey)) {
          ordersByBookingId.set(bookingKey, []);
        }
        ordersByBookingId.get(bookingKey).push(order);
      });

      const balanceByBookingId = await BookingService.buildPaymentBalanceMap(bookings);

      const bookingsWithProgress = bookings.map((booking) => {
        try {
          const bookingPlain = {
            ...booking,
            customerId: customer || booking.customerId || null,
            // Gleicher Satz wie in der Adminliste, damit beide Oberflaechen dieselben
            // Zahlen zeigen.
            paymentBalance: balanceByBookingId.get(String(booking._id))
              || { total: 0, invoicedTotal: 0, allocated: 0, received: 0, open: 0, overpaid: 0, unallocated: 0 },
          };
          const bookingOrders = ordersByBookingId.get(String(booking._id)) || [];
          const orderById = new Map(bookingOrders.map((order) => [String(order._id), order]));

          bookingPlain.items = (booking.items || []).map((item) => {
            const currentOrder = item?.orderId ? orderById.get(String(item.orderId)) : null;
            return currentOrder
              ? {
                  ...item,
                  status: currentOrder.status,
                  progress: this.resolveOrderProgress(currentOrder),
                  hasComplaint: Boolean(currentOrder.hasComplaint),
                }
              : item;
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
  static async updateStatus(bookingId, newStatus, description = '') {
    console.log('BookingService: Updating booking status:', bookingId, 'to:', newStatus);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      const previousStatus = booking.status;
      booking.status = newStatus;

      // Add timeline entry
      booking.timeline.push({
        status: newStatus,
        description: description || `Status geändert auf „${BookingService.bookingStatusLabel(newStatus)}“`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
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

          const trigger = newStatus === 'completed' ? 'booking_ready_for_pickup' : 'booking_status_updated';

          const itemSummary = await this.buildBookingOrdersSummary(populatedBooking.items || []);

          const firstRepairItem = (populatedBooking.items || []).find((item) => item?.type !== 'product');
          const primaryDevice = this.parseDeviceLabel(firstRepairItem?.device || '');

          await EmailService.sendTriggerEmail(trigger, customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName,
            bookingNumber: populatedBooking.bookingNumber,
            bookingStatus: newStatus,
            statusNote: description || `Statuswechsel von ${previousStatus} auf ${newStatus}`,
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
  static async updateBillingStatus(bookingId, billingStatus, paymentStatus = null) {
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

      // Add timeline entry
      booking.timeline.push({
        status: billingStatus,
        description: `Zahlungsstatus geändert auf „${BookingService.billingStatusLabel(billingStatus)}“`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
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

  // Cancel booking (soft delete/status change)
  static async cancel(bookingId) {
    console.log('BookingService: Cancelling booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      booking.status = 'cancelled';
      booking.timeline.push({
        status: 'cancelled',
        description: 'Buchung storniert',
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
      });

      const savedBooking = await booking.save();
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
            refundInfo: 'Falls zutreffend wird die Erstattung automatisch veranlasst',
            refundAmount: `EUR ${(populatedBooking.totalCost || 0).toFixed(2)}`,
            cancelledAt: new Date().toLocaleDateString('de-DE'),
            cancelledBy: 'System',
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
        .select('orderNumber deviceType deviceBrand deviceModel status paymentStatus progress totalCost services shopProducts timeline hasComplaint isComplaintFollowup sourceComplaintId parentOrderId')
        .lean();

      // Also include complaint follow-up orders that may not have bookingId set yet
      const directOrderIds = directOrders.map((order) => order._id);
      const followupOrders = directOrderIds.length
        ? await Order.find({
            isComplaintFollowup: true,
            parentOrderId: { $in: directOrderIds }
          })
            .setOptions({ skipAutoPopulate: true })
            .select('orderNumber deviceType deviceBrand deviceModel status paymentStatus progress totalCost services shopProducts timeline hasComplaint isComplaintFollowup sourceComplaintId parentOrderId')
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
            name: serviceMap.get(String(service.serviceId))?.name || 'Unknown Service',
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
          const serviceName = svc.serviceId?.name || 'Reparaturservice';
          invoiceItems.push({
            serviceName,
            description: `${deviceLabel} – ${serviceName}`,
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
      throw BookingService._createInvoiceEligibilityError('Invoice creation requires at least one associated order.');
    }

    const orderById = new Map(orders.map((order) => [String(order._id), order]));
    const requestedOrderId = String(invoiceData.orderId || '').trim();
    const invoiceMode = requestedOrderId || invoiceData.invoiceMode === 'order' ? 'order' : 'booking';

    if (invoiceMode === 'order') {
      if (!requestedOrderId) {
        throw BookingService._createInvoiceEligibilityError('A completed order must be selected for a partial invoice.');
      }

      if (!bookingOrderIds.includes(requestedOrderId)) {
        throw BookingService._createInvoiceEligibilityError('The selected order does not belong to this booking.');
      }

      const selectedOrder = orderById.get(requestedOrderId);
      if (!selectedOrder) {
        throw BookingService._createInvoiceEligibilityError('The selected order could not be loaded.');
      }

      if (selectedOrder.status !== 'completed') {
        throw BookingService._createInvoiceEligibilityError(
          `Partial invoice is only allowed for completed orders. Order ${selectedOrder.orderNumber || requestedOrderId} is currently "${selectedOrder.status}".`
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
        .map((order) => `${order.orderNumber || order._id} (${order.status})`)
        .join(', ');

      throw BookingService._createInvoiceEligibilityError(
        `A booking invoice can only be created after all related orders are completed. Pending orders: ${incompleteOrderLabels}.`,
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

  static async _assertNoExistingInvoiceForSelection(bookingId, invoiceMode, selectedOrderIds) {
    const duplicateQuery = invoiceMode === 'order'
      ? { bookingId, repairOrderIds: { $in: selectedOrderIds } }
      : { bookingId };

    const existingInvoice = await Invoice.findOne(duplicateQuery)
      .select('_id invoiceNumber status repairOrderIds')
      .lean();

    if (!existingInvoice) return;

    const duplicateMessage = invoiceMode === 'order'
      ? `An invoice already exists for the selected order (${existingInvoice.invoiceNumber || existingInvoice._id}).`
      : `An invoice already exists for this booking (${existingInvoice.invoiceNumber || existingInvoice._id}).`;

    const duplicateError = new Error(duplicateMessage);
    duplicateError.statusCode = 409;
    duplicateError.code = 'INVOICE_ALREADY_EXISTS';
    duplicateError.existingInvoice = {
      _id: String(existingInvoice._id),
      invoiceNumber: existingInvoice.invoiceNumber || null,
      status: existingInvoice.status || null,
      repairOrderIds: Array.isArray(existingInvoice.repairOrderIds)
        ? existingInvoice.repairOrderIds.map((orderId) => String(orderId))
        : [],
    };
    throw duplicateError;
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
  static async _computeInvoiceTotals(invoiceItems, discount = 0) {
    const config = await SystemConfiguration.findOne()
      .select('financialSettings.defaults.taxRate')
      .lean();
    const taxRatePct = config?.financialSettings?.defaults?.taxRate ?? 19;

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
      await BookingService._assertNoExistingInvoiceForSelection(booking._id, invoiceMode, selectedOrderIds);

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
      const previewTotals = await BookingService._computeInvoiceTotals(previewItems, previewDiscount);

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
      await BookingService._assertNoExistingInvoiceForSelection(booking._id, invoiceMode, selectedOrderIds);

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
      const invoiceTotals = await BookingService._computeInvoiceTotals(invoiceItems, invoiceDiscount);

      console.log('BookingService: Created', invoiceItems.length, 'invoice items, gross total:', invoiceTotals.total);

      const isReverseCharge = Boolean(invoiceData.isReverseCharge);
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
        dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: invoiceData.notes || '',
        sentAt: new Date(),
      });

      const savedInvoice = await invoice.save();
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

      if (customerEmail && customerEmail !== 'N/A') {
        setImmediate(async () => {
          try {
            await EmailService.sendTriggerEmail('invoice_created', customerEmail, {
              companyName: process.env.COMPANY_NAME || 'McRepair.de',
              customerName,
              invoiceNumber: savedInvoice.invoiceNumber,
              orderNumber: booking.orderIds && booking.orderIds.length > 0 ? String(booking.orderIds[0]) : booking.bookingNumber,
              invoiceAmount: `EUR ${(savedInvoice.total || 0).toFixed(2)}`,
              dueDate: new Date(savedInvoice.dueDate).toLocaleDateString('de-DE'),
              paymentMethod: savedInvoice.paymentMethod || 'Ueberweisung',
              invoiceUrl: await EmailService.buildSystemUrl(`/invoices?invoiceId=${savedInvoice._id}`),
              supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
              supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
            });
          } catch (notificationError) {
            console.error('BookingService: Error sending invoice email:', notificationError.message);
          }
        });
      }

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
      return invoices;
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
