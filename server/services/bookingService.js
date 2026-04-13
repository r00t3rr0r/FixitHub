const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const DHLService = require('./dhlService');
const DHLReturnsService = require('./dhlReturnsService');
const SystemConfiguration = require('../models/SystemConfiguration');
const EmailService = require('./emailService');

class BookingService {
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

  static buildBookingOrdersSummary(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return 'Keine Auftraege enthalten';
    }

    const orderLabel = items.length === 1 ? 'Auftrag' : 'Auftraege';
    const lines = items.map((item, index) => {
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

      const deviceName = this.escapeHtml(item?.device || 'Geraet wird noch zugeordnet');
      const serviceNames = Array.isArray(item?.services)
        ? item.services
            .map((service) => service?.name)
            .filter(Boolean)
            .map((name) => this.escapeHtml(name))
        : [];

      const servicesDisplay = serviceNames.length > 0
        ? serviceNames.join(', ')
        : 'Leistungen werden fuer Sie vorbereitet';

      return [
        `<strong>Position ${index + 1}: Reparatur</strong>`,
        `Geraet: ${deviceName}`,
        `Gebuchte Leistungen: ${servicesDisplay}`,
        `Betrag: ${amount}`,
      ].join('<br />');
    });

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
      '(FixitHub DHL Dummy Shipping Label) Tj',
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
          location: 'FixitHub',
          status: 'label-created',
          description: 'Dummy DHL shipping label prepared for booking creation',
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
        throw new Error('At least one order is required to create a booking');
      }

      // Calculate totals from orders
      let totalCost = 0;
      let subtotal = 0;
      let tax = 0;
      let discount = bookingData.discount || 0;
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
        totalCost += order.totalCost;
        subtotal += order.totalCost;

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

      // Calculate tax (8% by default)
      tax = subtotal * 0.08;

      // Calculate final total
      const finalTotal = subtotal + tax - discount;

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

      // Automatically generate DHL outbound shipping label for the booking if DHL shipping is active
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

      let bookingToReturn = savedBooking;

      // Automatically generate DHL return label if enabled in configuration
      try {
        console.log('BookingService: Checking if automatic return label generation is enabled');
        const systemConfig = await SystemConfiguration.findOne({});

        if (systemConfig && systemConfig.integrations) {
          const dhlReturnsIntegration = systemConfig.integrations.find(
            integration => integration.name === 'DHL Returns' &&
                          integration.type === 'shipping' &&
                          integration.isActive
          );

          if (dhlReturnsIntegration && dhlReturnsIntegration.settings?.autoGenerateLabel) {
            console.log('BookingService: Automatic return label generation is enabled, creating return label...');

            try {
              const returnLabelResult = await DHLReturnsService.createReturnLabel(
                savedBooking._id.toString(),
                { labelType: dhlReturnsIntegration.settings.defaultLabelType || 'BOTH' }
              );

              console.log('BookingService: Return label created successfully:', returnLabelResult.returnId);

              // Reload booking to get updated return information
              const updatedBooking = await Booking.findById(savedBooking._id);
              if (updatedBooking) {
                bookingToReturn = updatedBooking;
              }
            } catch (labelError) {
              console.error('BookingService: Error creating return label (non-fatal):', labelError.message);
              console.error('BookingService: Booking created successfully but return label generation failed');
            }
          } else {
            console.log('BookingService: Automatic return label generation is disabled or integration not found');
          }
        }
      } catch (configError) {
        console.error('BookingService: Error checking DHL Returns configuration (non-fatal):', configError.message);
      }

      // Send booking created notification email asynchronously
      setImmediate(async () => {
        try {
          const isGuestBooking = Boolean(bookingData?.guestInfo?.isGuest);
          if (isGuestBooking) {
            return;
          }

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

          const itemSummary = this.buildBookingOrdersSummary(savedBooking.items);
          const shippingLabelUrl = savedBooking.shippingLabelUrl || bookingToReturn?.shippingLabelUrl || '';

          await EmailService.sendTriggerEmail('booking_created', customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName: customerName || customerEmail,
            bookingNumber: savedBooking.bookingNumber,
            bookingDate: new Date(savedBooking.createdAt || Date.now()).toLocaleDateString('de-DE'),
            itemSummary,
            totalAmount: this.formatCurrencyEUR(savedBooking.totalCost || 0),
            bookingStatus: savedBooking.status,
            bookingUrl: await EmailService.buildSystemUrl('/bookings'),
            shippingLabelUrl,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
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

    if (booking.shippingLabelUrl && booking.trackingNumber) {
      return booking;
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
      house: houseCandidate || streetInfo.house || '1',
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

  static buildBookingShipmentData(order, booking, dhlConfig) {
    const parcelDeConfig = DHLService.getParcelDEConfig(dhlConfig);
    const receiverAddress = this.resolveBookingReceiverAddress(order, booking);
    const shipper = dhlConfig?.settings?.shipper || {};

    const receiverName =
      `${order?.customerId?.firstName || ''} ${order?.customerId?.lastName || ''}`.trim() ||
      order?.customerId?.name ||
      `${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim() ||
      `${booking?.guestInfo?.firstName || ''} ${booking?.guestInfo?.lastName || ''}`.trim() ||
      'Customer';

    const receiverEmail =
      order?.customerId?.email ||
      order?.guestInfo?.email ||
      booking?.guestInfo?.email ||
      '';

    const receiverPhone =
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

    return {
      receiverName,
      receiverAddress: receiverAddress.street,
      receiverNumber: receiverAddress.house,
      receiverCity: receiverAddress.city,
      receiverPostalCode: receiverAddress.postalCode,
      receiverCountry: receiverAddress.country,
      receiverEmail,
      receiverPhone,
      shipperName: dhlConfig?.settings?.shipperCompany || shipper.company || 'FixitHub GmbH',
      shipperStreet: dhlConfig?.settings?.shipperStreet || shipper.street || 'Company Street',
      shipperNumber: dhlConfig?.settings?.shipperNumber || shipper.number || '1',
      shipperCity: dhlConfig?.settings?.shipperCity || shipper.city || 'Berlin',
      shipperPostalCode: dhlConfig?.settings?.shipperPostalCode || shipper.postalCode || '10115',
      shipperCountry: dhlConfig?.settings?.shipperCountry || shipper.country || 'DE',
      shipperEmail: dhlConfig?.settings?.shipperEmail || shipper.email || process.env.SUPPORT_EMAIL || 'info@fixithub.com',
      shipperPhone: dhlConfig?.settings?.shipperPhone || shipper.phone || '+49301234567',
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
      throw new Error('Booking not found after creation');
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
      description: `Dummy DHL shipping label prepared for booking. Tracking number: ${trackingNumber}`,
      completedAt: shippingCreatedAt,
      staffId: 'system',
      staffName: 'DHL Dummy Integration',
    });

    await refreshedBooking.save();
    return refreshedBooking;
  }

  static async createLiveShippingLabelForBooking(booking, options = {}) {
    const dhlConfig = await DHLService.getDHLConfig();
    if (!dhlConfig?.isActive) {
      throw new Error('DHL shipping integration is inactive');
    }

    const preferredOrderId = this.normalizeEntityId(options.preferredOrderId);
    const candidateOrderIds = [
      preferredOrderId,
      ...(Array.isArray(booking.repairOrderIds) ? booking.repairOrderIds.map((id) => this.normalizeEntityId(id)) : []),
      ...(Array.isArray(booking.orderIds) ? booking.orderIds.map((id) => this.normalizeEntityId(id)) : []),
    ].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);

    if (candidateOrderIds.length === 0) {
      throw new Error('No candidate orders found for live DHL shipping label generation');
    }

    let lastError = null;

    for (const orderId of candidateOrderIds) {
      try {
        const sourceOrder = await Order.findById(orderId)
          .setOptions({ skipAutoPopulate: true })
          .populate('customerId', 'name firstName lastName email phone invoiceAddress');

        if (!sourceOrder) {
          throw new Error(`Order not found for booking label generation: ${orderId}`);
        }

        const shipmentData = this.buildBookingShipmentData(sourceOrder, booking, dhlConfig);

        const missingReceiverFields = [
          ['receiverAddress', shipmentData.receiverAddress],
          ['receiverCity', shipmentData.receiverCity],
          ['receiverPostalCode', shipmentData.receiverPostalCode],
        ].filter(([, value]) => !String(value || '').trim());

        if (missingReceiverFields.length > 0) {
          throw new Error(`Missing required receiver fields for DHL booking label: ${missingReceiverFields.map(([field]) => field).join(', ')}`);
        }

        const missingShipperFields = [
          ['shipperStreet', shipmentData.shipperStreet],
          ['shipperCity', shipmentData.shipperCity],
          ['shipperPostalCode', shipmentData.shipperPostalCode],
          ['accountNumber', shipmentData.accountNumber],
        ].filter(([, value]) => !String(value || '').trim());

        if (missingShipperFields.length > 0) {
          throw new Error(`Missing required shipper fields for DHL booking label: ${missingShipperFields.map(([field]) => field).join(', ')}`);
        }

        const shipmentResult = await DHLService.createShipment(orderId, shipmentData);
        const refreshedBooking = await Booking.findById(booking._id);

        if (!refreshedBooking) {
          throw new Error('Booking not found after shipment creation');
        }

        refreshedBooking.trackingNumber = shipmentResult?.trackingNumber || refreshedBooking.trackingNumber;
        refreshedBooking.carrier = 'DHL';
        refreshedBooking.shippingStatus = 'label-created';
        refreshedBooking.shippingStatusDescription = 'DHL-Buchungsversandlabel wurde erstellt';
        refreshedBooking.shippingLabelUrl = shipmentResult?.labelUrl || refreshedBooking.shippingLabelUrl;
        refreshedBooking.shippingCost = shipmentResult?.shippingCost || refreshedBooking.shippingCost || 0;
        refreshedBooking.estimatedDelivery = shipmentResult?.estimatedDelivery || refreshedBooking.estimatedDelivery;
        refreshedBooking.shippingCreatedAt = new Date();
        refreshedBooking.timeline.push({
          status: 'Shipping Label Created',
          description: `Booking DHL shipping label created. Tracking number: ${refreshedBooking.trackingNumber || 'pending'}`,
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

    throw lastError || new Error('Failed to create live booking shipping label');
  }

  static async updateShippingStatus(bookingId) {
    console.log('BookingService: Updating shipping status for booking:', bookingId)

    const booking = await Booking.findById(bookingId)

    if (!booking) {
      throw new Error('Booking not found')
    }

    if (!booking.trackingNumber) {
      throw new Error('No tracking number found for this booking')
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
        description: `Booking shipment status: ${trackingInfo.description || newStatus}`,
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
        .populate('customerId', 'firstName lastName email phone avatar')
        .populate('orderIds')
        .populate('repairOrderIds')
        .populate('shopProductOrderId');

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

  // Get total count of bookings matching filters
  static async getBookingsCount(filters = {}) {
    console.log('BookingService: Getting bookings count with filters:', filters);

    try {
      const query = {};

      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply billing status filter if provided
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      // Apply customer filter if provided
      if (filters.customerId) {
        query.customerId = filters.customerId;
      }

      const count = await Booking.countDocuments(query);
      console.log('BookingService: Total bookings count:', count);

      return count;
    } catch (error) {
      console.error('BookingService: Error getting bookings count:', error);
      throw error;
    }
  }

  // Get all bookings (admin view)
  static async getAllBookings(filters = {}) {
    console.log('BookingService: Getting all bookings with filters:', filters);

    try {
      const query = {};

      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply billing status filter if provided
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      const bookings = await Booking.find(query)
        .populate('customerId', 'firstName lastName email phone avatar name')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      console.log('BookingService: Found', bookings.length, 'bookings on current page');

      // Calculate real-time progress for all bookings from their associated orders
      const bookingsWithProgress = await Promise.all(
        bookings.map(async (booking) => {
          try {
            // Get all orders for this booking
            const allOrders = await Order.find({ bookingId: booking._id });

            // Convert to plain object so we can attach computed fields freely
            const bookingPlain = booking.toObject({ virtuals: true });

            if (allOrders.length === 0) {
              if (bookingPlain.trackingNumber && !this.isDummyBookingTrackingNumber(bookingPlain.trackingNumber)) {
                try {
                  const trackingInfo = await DHLService.getTrackingInfo(bookingPlain.trackingNumber);
                  const mappedStatus = this.mapTrackingStatusToBookingStatus(trackingInfo.status || trackingInfo.statusCodeRaw);

                  if (mappedStatus) bookingPlain.shippingStatus = mappedStatus;
                  if (trackingInfo.description) bookingPlain.shippingStatusDescription = trackingInfo.description;
                  if (trackingInfo.estimatedDelivery) bookingPlain.estimatedDelivery = trackingInfo.estimatedDelivery;
                } catch (trackingError) {
                  console.error('BookingService: Failed to refresh shipping status in getAllBookings for booking:', booking._id, trackingError.message);
                }
              }

              return bookingPlain;
            }

            // Calculate overall progress from all orders
            let totalProgress = 0;
            allOrders.forEach(order => {
              totalProgress += this.resolveOrderProgress(order);
            });
            bookingPlain.overallProgress = Math.round(totalProgress / allOrders.length);

            // Check for complaint follow-up orders linked to any direct order of this booking
            const directOrderIds = allOrders.map(o => o._id);
            const complaintOrderCount = await Order.countDocuments({
              isComplaintFollowup: true,
              parentOrderId: { $in: directOrderIds }
            });
            bookingPlain.hasComplaintOrders = complaintOrderCount > 0;

            if (bookingPlain.trackingNumber && !this.isDummyBookingTrackingNumber(bookingPlain.trackingNumber)) {
              try {
                const trackingInfo = await DHLService.getTrackingInfo(bookingPlain.trackingNumber);
                const mappedStatus = this.mapTrackingStatusToBookingStatus(trackingInfo.status || trackingInfo.statusCodeRaw);

                if (mappedStatus) bookingPlain.shippingStatus = mappedStatus;
                if (trackingInfo.description) bookingPlain.shippingStatusDescription = trackingInfo.description;
                if (trackingInfo.estimatedDelivery) bookingPlain.estimatedDelivery = trackingInfo.estimatedDelivery;
              } catch (trackingError) {
                console.error('BookingService: Failed to refresh shipping status in getAllBookings for booking:', booking._id, trackingError.message);
              }
            }

            return bookingPlain;
          } catch (error) {
            console.error('BookingService: Error calculating progress for booking:', booking._id, error);
            return booking.toObject({ virtuals: true });
          }
        })
      );

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

      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply billing status filter if provided
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      const bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      const bookingsWithProgress = await Promise.all(
        bookings.map(async (booking) => {
          try {
            const allOrders = await Order.find({ bookingId: booking._id });
            const bookingPlain = booking.toObject({ virtuals: true });

            if (allOrders.length === 0) {
              if (bookingPlain.trackingNumber && !this.isDummyBookingTrackingNumber(bookingPlain.trackingNumber)) {
                try {
                  const trackingInfo = await DHLService.getTrackingInfo(bookingPlain.trackingNumber);
                  const mappedStatus = this.mapTrackingStatusToBookingStatus(trackingInfo.status || trackingInfo.statusCodeRaw);

                  if (mappedStatus) bookingPlain.shippingStatus = mappedStatus;
                  if (trackingInfo.description) bookingPlain.shippingStatusDescription = trackingInfo.description;
                  if (trackingInfo.estimatedDelivery) bookingPlain.estimatedDelivery = trackingInfo.estimatedDelivery;
                } catch (trackingError) {
                  console.error('BookingService: Failed to refresh shipping status in getByCustomer for booking:', booking._id, trackingError.message);
                }
              }

              return bookingPlain;
            }

            let totalProgress = 0;
            allOrders.forEach((order) => {
              totalProgress += this.resolveOrderProgress(order);
            });

            bookingPlain.overallProgress = Math.round(totalProgress / allOrders.length);

            if (bookingPlain.trackingNumber && !this.isDummyBookingTrackingNumber(bookingPlain.trackingNumber)) {
              try {
                const trackingInfo = await DHLService.getTrackingInfo(bookingPlain.trackingNumber);
                const mappedStatus = this.mapTrackingStatusToBookingStatus(trackingInfo.status || trackingInfo.statusCodeRaw);

                if (mappedStatus) bookingPlain.shippingStatus = mappedStatus;
                if (trackingInfo.description) bookingPlain.shippingStatusDescription = trackingInfo.description;
                if (trackingInfo.estimatedDelivery) bookingPlain.estimatedDelivery = trackingInfo.estimatedDelivery;
              } catch (trackingError) {
                console.error('BookingService: Failed to refresh shipping status in getByCustomer for booking:', booking._id, trackingError.message);
              }
            }

            return bookingPlain;
          } catch (error) {
            console.error('BookingService: Error calculating customer booking progress for booking:', booking._id, error);
            return booking.toObject({ virtuals: true });
          }
        })
      );

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
        throw new Error('One or more orders not found or do not belong to this customer');
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
        throw new Error('Booking not found');
      }

      const previousStatus = booking.status;
      booking.status = newStatus;

      // Add timeline entry
      booking.timeline.push({
        status: newStatus,
        description: description || `Status updated to ${newStatus}`,
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

          await EmailService.sendTriggerEmail(trigger, customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName,
            bookingNumber: populatedBooking.bookingNumber,
            bookingStatus: newStatus,
            statusNote: description || `Statuswechsel von ${previousStatus} auf ${newStatus}`,
            itemSummary: `${populatedBooking.items?.length || 0} Position(en)`,
            progressPercent: populatedBooking.overallProgress || 0,
            updatedAt: new Date().toLocaleDateString('de-DE'),
            bookingUrl: await EmailService.buildSystemUrl(`/bookings/${populatedBooking._id}`),
            pickupHours: process.env.PICKUP_HOURS || 'Mo-Fr 09:00-18:00',
            workshopAddress: process.env.WORKSHOP_ADDRESS || 'Service Center',
            readySince: new Date().toLocaleDateString('de-DE'),
            holdUntil: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
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
        throw new Error('Booking not found');
      }

      booking.billingStatus = billingStatus;
      if (paymentStatus) {
        booking.paymentStatus = paymentStatus;
      }

      // Add timeline entry
      booking.timeline.push({
        status: billingStatus,
        description: `Billing status updated to ${billingStatus}`,
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
        .populate('customerId', 'firstName lastName email phone')
        .populate('orderIds');

      if (!booking) {
        console.log('BookingService: Booking not found');
        return null;
      }

      const summary = {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customer: {
          name: `${booking.customerId.firstName} ${booking.customerId.lastName}`,
          email: booking.customerId.email,
          phone: booking.customerId.phone,
        },
        status: booking.status,
        billingStatus: booking.billingStatus,
        totalCost: booking.totalCost,
        itemsCount: booking.items.length,
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
        throw new Error('Booking not found');
      }

      booking.status = 'cancelled';
      booking.timeline.push({
        status: 'cancelled',
        description: 'Booking cancelled',
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
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
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
        throw new Error('Booking not found');
      }

      // Fetch all orders directly linked to booking
      const directOrders = await Order.find({ bookingId: bookingId })
        .populate('services.serviceId', 'name')
        .populate('shopProducts.productId', 'name');

      // Also include complaint follow-up orders that may not have bookingId set yet
      const directOrderIds = directOrders.map((order) => order._id);
      const followupOrders = directOrderIds.length
        ? await Order.find({
            isComplaintFollowup: true,
            parentOrderId: { $in: directOrderIds }
          })
            .populate('services.serviceId', 'name')
            .populate('shopProducts.productId', 'name')
        : [];

      const allOrdersById = new Map();
      [...directOrders, ...followupOrders].forEach((order) => {
        allOrdersById.set(order._id.toString(), order);
      });

      const orders = Array.from(allOrdersById.values());

      console.log('BookingService: Found', orders.length, 'orders for booking');

      // Transform orders to match expected structure with current repair progress status
      const transformedOrders = orders.map(order => {
        const orderProgress = this.resolveOrderProgress(order);
        let orderData = {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          isComplaintFollowup: Boolean(order.isComplaintFollowup),
          sourceComplaintId: order.sourceComplaintId ? order.sourceComplaintId.toString() : null,
          parentOrderId: order.parentOrderId ? order.parentOrderId.toString() : null,
          status: order.status || 'pending',
          progress: orderProgress,
          cost: order.totalCost,
        };

        if (order.deviceType === 'Shop Products') {
          // Shop product order
          orderData.products = order.shopProducts.map(product => ({
            name: product.productId?.name || 'Unknown Product',
            quantity: product.quantity,
            price: product.priceAtOrder,
            totalPrice: product.priceAtOrder * product.quantity,
          }));
          orderData.device = 'Shop Products';
        } else {
          // Repair order
          orderData.device = `${order.deviceBrand} ${order.deviceModel}`;
          orderData.services = order.services.map(service => ({
            name: service.serviceId?.name || 'Unknown Service',
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

  // Preview invoice for a booking
  static async previewInvoice(bookingId) {
    console.log('BookingService: Previewing invoice for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName email phone');

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Build invoice preview
      const invoicePreview = {
        customerName: `${booking.customerId.firstName} ${booking.customerId.lastName}`,
        customerEmail: booking.customerId.email,
        items: booking.items.map(item => ({
          description: item.type === 'repair' ? item.device : 'Shop Products',
          quantity: 1,
          unitPrice: item.cost,
          total: item.cost,
        })),
        subtotal: booking.subtotal || booking.totalCost,
        tax: booking.tax || 0,
        discount: booking.discount || 0,
        total: booking.totalCost,
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
        .populate('customerId', 'firstName lastName email phone');

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Extract customer information
      const customerFirstName = booking.customerId?.firstName || 'N/A';
      const customerLastName = booking.customerId?.lastName || 'N/A';
      const customerEmail = booking.customerId?.email || 'N/A';
      const customerName = `${customerFirstName} ${customerLastName}`.trim();

      console.log('BookingService: Creating invoice with customer:', customerName, 'Email:', customerEmail);

      // Build invoice items from booking with required type field
      const invoiceItems = booking.items.map(item => {
        // Determine item type based on booking item
        let itemType = 'service'; // default
        if (item.type === 'product') {
          itemType = 'product';
        } else if (item.type === 'repair') {
          itemType = 'service';
        }

        return {
          description: item.type === 'repair' ? `${item.device} Repair` : 'Shop Products',
          quantity: 1,
          unitPrice: item.cost,
          total: item.cost,
          type: itemType,
        };
      });

      console.log('BookingService: Created', invoiceItems.length, 'invoice items with types');

      const shouldSendImmediately = Boolean(invoiceData.sendImmediately);

      // Create invoice
      const invoice = new Invoice({
        customerId: booking.customerId._id,
        customerName: customerName,
        customerEmail: customerEmail,
        orderId: booking.orderIds && booking.orderIds.length > 0 ? booking.orderIds[0] : null, // Link to first order for reference
        bookingId: booking._id,
        items: invoiceItems,
        subtotal: booking.subtotal || booking.totalCost,
        tax: booking.tax || 0,
        discount: booking.discount || 0,
        total: booking.totalCost,
        status: shouldSendImmediately ? 'sent' : 'draft',
        dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        notes: invoiceData.notes || '',
        sentAt: shouldSendImmediately ? new Date() : undefined,
      });

      const savedInvoice = await invoice.save();
      console.log('BookingService: Invoice created successfully:', savedInvoice._id, 'Number:', savedInvoice.invoiceNumber);

      // Only send notification when invoice is explicitly sent to the customer.
      if (shouldSendImmediately && customerEmail && customerEmail !== 'N/A') {
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
              invoiceUrl: await EmailService.buildSystemUrl(`/invoices/${savedInvoice._id}`),
              supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
              supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
            });
          } catch (notificationError) {
            console.error('BookingService: Error sending invoice email:', notificationError.message);
          }
        });
      }

      return savedInvoice;
    } catch (error) {
      console.error('BookingService: Error creating invoice:', error.message);
      console.error('BookingService: Full error details:', error);
      throw error;
    }
  }

  // Get all invoices for a booking
  static async getBookingInvoices(bookingId) {
    console.log('BookingService: Getting invoices for booking:', bookingId);

    try {
      const invoices = await Invoice.find({ bookingId: bookingId })
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
        throw new Error('Booking not found');
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
