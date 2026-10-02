const axios = require('axios');
const SystemConfiguration = require('../models/SystemConfiguration');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const User = require('../models/User');
const DHLService = require('./dhlService');

/**
 * DHL Parcel DE Returns Service
 * Handles return label generation and tracking for German domestic and international returns
 *
 * RICHTUNG: Bei der DHL-Retoure ist der KUNDE der Absender (`shipper`) und McRepair der
 * Empfaenger (`receiverId`). Jedes hier erzeugte Label ist also eine EINSENDUNG
 * (Kunde -> McRepair) - niemals der Versand des reparierten Geraets an den Kunden. Die
 * Auslieferung (McRepair -> Kunde) erstellt DHLService.createShipment (Parcel DE Shipping v2).
 * API Documentation: https://developer.dhl.com/api-reference/dhl-parcel-de-returns-post-parcel-germany
 */
class DHLReturnsService {

  /**
   * Get DHL Returns configuration from system settings
   * Reuses the same active DHL shipping integration used for outbound (Einsendelabel) labels
   */
  static async getDHLReturnsConfig() {
    console.log('DHLReturnsService: Fetching DHL Returns configuration');

    try {
      const config = await SystemConfiguration.findOne();

      if (!config || !config.integrations) {
        console.error('DHLReturnsService: No system configuration found');
        throw new Error('Die Systemkonfiguration wurde nicht gefunden.');
      }

      // Prefer a dedicated "DHL Returns" profile if one is configured, otherwise fall back
      // to the same active DHL shipping integration used for outbound labels.
      const dhlIntegration = config.integrations.find(
        integration => integration.provider === 'DHL' && integration.type === 'shipping' && integration.isActive
          && String(integration.name || '').toLowerCase().includes('returns')
      ) || config.integrations.find(
        integration => integration.provider === 'DHL' && integration.type === 'shipping' && integration.isActive
      );

      if (!dhlIntegration) {
        console.error('DHLReturnsService: No active DHL integration found');
        throw new Error('Es ist keine aktive DHL-Rücksende-Integration konfiguriert. Bitte unter Systemkonfiguration → Integrationen → DHL prüfen.');
      }

      const credentials = dhlIntegration.credentials || {};
      const metadata = dhlIntegration.metadata || {};

      // apiKey/username and apiSecret/password are used for OAuth2, accountId is the receiverID (14-character billing number)
      const username = credentials.username || credentials.apiKey || dhlIntegration.apiKey || '';
      const password = credentials.password || credentials.apiSecret || dhlIntegration.apiSecret || '';
      const receiverId = credentials.accountId || dhlIntegration.settings?.accountNumber || dhlIntegration.settings?.accountId || '';
      const clientId = metadata.clientId || credentials.clientId || '';
      const clientSecret = metadata.clientSecret || credentials.clientSecret || '';
      const environment = metadata.environment || dhlIntegration.settings?.environment || 'sandbox';

      if (!username || !password || !receiverId) {
        console.error('DHLReturnsService: Missing required DHL credentials');
        throw new Error('Die DHL-Zugangsdaten für Rücksendungen sind unvollständig (Benutzername, Passwort, ReceiverID).');
      }

      console.log('DHLReturnsService: Configuration loaded successfully');
      console.log('DHLReturnsService: Environment:', environment);
      console.log('DHLReturnsService: ReceiverID:', receiverId);

      return {
        username,
        password,
        receiverId,
        clientId,
        clientSecret,
        apiEndpoint: credentials.apiEndpoint || dhlIntegration.endpoint || (environment === 'production'
          ? 'https://api.dhl.com'
          : 'https://api-sandbox.dhl.com'),
        environment,
      };
    } catch (error) {
      console.error('DHLReturnsService: Error getting DHL Returns config:', error.message);
      throw error;
    }
  }

  /**
   * Get OAuth2 access token for DHL Returns API
   * Uses Resource Owner Password Credentials (ROPC) grant type
   */
  static async getAccessToken() {
    console.log('DHLReturnsService: Obtaining OAuth2 access token');

    try {
      const config = await this.getDHLReturnsConfig();

      // Token endpoint
      const tokenEndpoint = `${config.apiEndpoint}/parcel/de/account/auth/ropc/v1/token`;

      console.log('DHLReturnsService: Token endpoint:', tokenEndpoint);

      // Prepare request
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', config.username);
      params.append('password', config.password);

      // Include client credentials if available
      if (config.clientId && config.clientSecret) {
        params.append('client_id', config.clientId);
        params.append('client_secret', config.clientSecret);
      }

      // Make token request
      const response = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // Ohne Timeout (axios-Standard: unendlich) koennte eine haengende Anmeldung die
        // Reservierungsfrist des Einsendelabels ueberdauern.
        timeout: 15000,
      });

      console.log('DHLReturnsService: OAuth2 token obtained successfully');
      console.log('DHLReturnsService: Token type:', response.data.token_type);
      console.log('DHLReturnsService: Expires in:', response.data.expires_in, 'seconds');

      return response.data.access_token;
    } catch (error) {
      console.error('DHLReturnsService: Error obtaining OAuth2 token:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('DHL hat die Anmeldung für Rücksendungen abgelehnt. Bitte Benutzername und Passwort der DHL-Integration prüfen.');
      }

      throw new Error('Die Anmeldung an der DHL-Rücksende-API ist fehlgeschlagen. Bitte die Zugangsdaten und die Verbindung prüfen.');
    }
  }

  /**
   * Create return label for booking
   * @param {string} bookingId - Booking ID
   * @param {object} options - Optional parameters
   * @returns {object} - Return label information
   */
  static async createReturnLabel(bookingId, options = {}) {
    console.log('DHLReturnsService: Creating return label for booking:', bookingId);
    // DHL-3: dieselbe atomare Sperre wie das Parcel-DE-Einsendelabel der Buchung
    // (Booking.shippingLabelCreationInProgress) - zwei Klicks bzw. zwei Mitarbeiter erzeugen
    // nie zwei bezahlte Labels, und eine unklare DHL-Antwort haelt die Sperre bis zum Abgleich
    // (POST /api/bookings/:id/shipping/reconcile).
    let lockClaimed = false;
    let keepLock = false;
    const conflict = (code, message) => {
      const error = new Error(message);
      error.status = 409;
      error.code = code;
      error.retryable = false;
      return error;
    };

    try {
      // Get booking details
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        console.error('DHLReturnsService: Booking not found:', bookingId);
        const notFound = new Error('Buchung nicht gefunden.');
        notFound.status = 404;
        notFound.code = 'BOOKING_NOT_FOUND';
        throw notFound;
      }

      console.log('DHLReturnsService: Booking found:', booking.bookingNumber);
      console.log('DHLReturnsService: Customer ID:', booking.customerId);

      // Never create a second label at DHL for the same booking (mirrors the order path).
      if (booking.returnLabelUrl || booking.returnShipmentStatus === 'label-created') {
        console.log('DHLReturnsService: Return label already exists for booking:', booking.bookingNumber);
        return {
          success: true,
          returnId: booking.returnShipmentId,
          returnTrackingNumber: booking.returnTrackingNumber,
          labelUrl: booking.returnLabelUrl,
          qrCodeUrl: booking.returnQRCodeUrl,
          qrLink: '',
          alreadyExists: true,
          message: 'Für diese Buchung ist bereits ein Rücksendeetikett vorhanden.',
        };
      }

      // Die Buchung hat bereits ihr Einsendelabel (Parcel DE, Kunde -> McRepair): eine Retoure
      // waere ein ZWEITES bezahltes Einsendelabel. Ausnahme Altbestand: der Platz traegt ein
      // Rueckweg-Label (McRepair -> Kunde) - dann ist die Retoure die einzige Einsendung.
      const shippingSlotDirection = DHLService.resolveStoredBookingLabelDirection(booking);
      const shippingSlotUsed = Boolean(String(booking.shippingLabelUrl || '').trim() || String(booking.trackingNumber || '').trim());
      if (shippingSlotUsed && shippingSlotDirection !== 'outbound') {
        throw conflict(
          'INBOUND_LABEL_EXISTS',
          `Für diese Buchung existiert bereits ein DHL-Einsendelabel${booking.trackingNumber ? ` (Sendungsnummer ${booking.trackingNumber})` : ''}. Ein zusätzliches Retourenlabel wird nicht erstellt.`
        );
      }
      if (booking.shippingLabelCreationInProgress === true) {
        throw conflict('LABEL_CREATION_IN_PROGRESS', 'Das Einsendelabel dieser Buchung wird gerade erstellt oder sein Ergebnis wird noch abgeglichen. Bitte die Buchung neu laden.');
      }
      // Einsendung bereits am Auftrag (Retoure/Einsendelabel im return*-Platz eines Auftrags).
      const nonEmpty = { $exists: true, $nin: [null, ''] };
      const orderWithInbound = await Order.findOne({
        _id: { $in: Array.isArray(booking.orderIds) ? booking.orderIds : [] },
        $or: [
          { returnLabelUrl: nonEmpty },
          { returnTrackingNumber: nonEmpty },
          { returnShipmentStatus: { $in: ['pending', 'label-created', 'in-transit', 'delivered'] } },
        ],
      }).setOptions({ skipAutoPopulate: true }).select('orderNumber returnTrackingNumber').lean();
      if (orderWithInbound) {
        throw conflict(
          'INBOUND_LABEL_EXISTS',
          `Für den Auftrag ${orderWithInbound.orderNumber || ''} dieser Buchung existiert bereits ein Einsendelabel${orderWithInbound.returnTrackingNumber ? ` (Sendungsnummer ${orderWithInbound.returnTrackingNumber})` : ''}.`
        );
      }

      // Get full customer object directly from User model to ensure all fields are loaded
      const customer = await User.findById(booking.customerId).select('firstName lastName name email phone invoiceAddress');

      if (!customer) {
        console.error('DHLReturnsService: Customer not found for booking');
        throw new Error('Kundendaten nicht gefunden.');
      }

      console.log('DHLReturnsService: Customer:', customer.email);
      console.log('DHLReturnsService: Customer has invoiceAddress:', !!customer.invoiceAddress);

      // Get customer address - use invoice address as shipper address for returns
      const invoiceAddress = customer.invoiceAddress || {};

      console.log('DHLReturnsService: Customer invoice address:', JSON.stringify(invoiceAddress, null, 2));

      // Validate address
      if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
        console.error('DHLReturnsService: Incomplete customer invoice address');
        throw new Error('Die Rechnungsadresse des Kunden ist unvollständig. Straße, Ort und Postleitzahl werden benötigt.');
      }

      // DHL expects street and house number separately; the checkout stores them combined.
      // The number inside the street text wins - a separately stored number is only used
      // when the street carries none of its own (same rule as DHLService.resolveStreetAndHouse).
      const invoiceStreetParts = DHLService.splitStreetAndHouse(invoiceAddress.street);
      const invoiceHouseNumber = invoiceStreetParts.house || String(invoiceAddress.number || '').trim();

      // Never invent a house number: a made-up "1" produces an undeliverable label that
      // nobody notices until the parcel comes back.
      if (!invoiceHouseNumber) {
        console.error('DHLReturnsService: No house number in customer invoice address');
        throw new Error(
          'Die Hausnummer der Rechnungsadresse fehlt. Bitte die Hausnummer im Kundenprofil ergänzen ' +
          `(Rechnungsadresse, Straße: "${String(invoiceAddress.street).trim()}").`
        );
      }

      // Get DHL configuration
      const config = await this.getDHLReturnsConfig();

      // Atomare Reservierung (DHL-3): nur solange kein Einsendelabel in irgendeinem Platz der
      // Buchung existiert und keine andere Erstellung laeuft. Im Altbestand mit Rueckweg-Label
      // im Parcel-Platz muss dieser Platz unveraendert sein (er bleibt unangetastet).
      const claimFilter = {
        _id: booking._id,
        shippingLabelCreationInProgress: { $ne: true },
        returnLabelUrl: { $in: ['', null] },
        returnTrackingNumber: { $in: ['', null] },
        ...(shippingSlotUsed
          ? { trackingNumber: booking.trackingNumber || '' }
          : { shippingLabelUrl: { $in: ['', null] }, trackingNumber: { $in: ['', null] } }),
      };
      const claimed = await Booking.findOneAndUpdate(
        claimFilter,
        // updatedAt = Beginn der Sperre (Regel fuer verwaiste Sperren, DHLService.describeBookingLabelLock).
        { $set: { shippingLabelCreationInProgress: true, updatedAt: new Date() } },
        { new: true, projection: { _id: 1 } }
      ).setOptions({ skipAutoPopulate: true });
      if (!claimed) {
        throw conflict('LABEL_CREATION_IN_PROGRESS', 'Das Einsendelabel dieser Buchung wird bereits erstellt, ist schon vorhanden oder sein Ergebnis wird noch abgeglichen. Bitte die Buchung neu laden.');
      }
      lockClaimed = true;

      const markReconciliationRequired = async (detail) => {
        await Booking.updateOne(
          { _id: booking._id, shippingLabelCreationInProgress: true },
          {
            $set: { shippingStatusDescription: 'Ergebnis der DHL-Retoure unklar – Abgleich im DHL-Geschäftskundenportal erforderlich' },
            $push: {
              timeline: {
                status: 'Shipping Label Reconciliation Required',
                description: `DHL hat beim Retourenlabel (Einsendung, Kunde an McRepair) ${detail}. Bitte im DHL-Geschäftskundenportal nach der Buchung ${booking.bookingNumber || booking._id} suchen und den Abgleich abschließen, bevor erneut ein Label erstellt wird.`,
                completedAt: new Date(),
                staffId: 'system',
                staffName: 'DHL Returns Integration',
              },
            },
          }
        ).catch((markError) => {
          console.error('DHLReturnsService: Could not record booking reconciliation marker:', markError.message);
        });
      };

      // Get OAuth2 access token
      const accessToken = await this.getAccessToken();

      // Determine label type (default: both PDF and QR code)
      const labelType = options.labelType || 'BOTH';

      // Prepare return label request
      // The shipper is the customer (sender of the return)
      const returnRequest = {
        receiverId: config.receiverId,
        shipper: {
          name1: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer',
          addressStreet: invoiceStreetParts.street || invoiceAddress.street,
          addressHouse: invoiceHouseNumber,
          postalCode: invoiceAddress.zipCode,
          city: invoiceAddress.city,
        },
      };

      // Add optional fields if available
      if (customer.email) {
        returnRequest.shipper.email = customer.email;
      }

      if (customer.phone) {
        returnRequest.shipper.phone = customer.phone;
      }

      // Add country for international returns
      if (invoiceAddress.country && invoiceAddress.country !== 'DE' && invoiceAddress.country !== 'Deutschland') {
        returnRequest.shipper.country = invoiceAddress.country;

        // For international returns (UK, Switzerland), customs details might be required
        // This is a placeholder - actual implementation would need product details
        if (['GB', 'CH', 'UK'].includes(invoiceAddress.country.toUpperCase())) {
          console.log('DHLReturnsService: International return detected - customs details may be required');
        }
      }

      console.log('DHLReturnsService: Return request payload:', JSON.stringify(returnRequest, null, 2));

      // Create return label API endpoint
      const returnLabelEndpoint = `${config.apiEndpoint}/parcel/de/shipping/returns/v1/orders`;
      const queryParams = labelType !== 'PDF' ? `?labelType=${labelType}` : '';

      console.log('DHLReturnsService: Calling DHL Returns API:', returnLabelEndpoint + queryParams);

      // Make API request - mit Frist (frueher ohne Timeout) und Behandlung unklarer Antworten.
      let response;
      try {
        response = await axios.post(
          returnLabelEndpoint + queryParams,
          returnRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            timeout: this.RETURNS_REQUEST_TIMEOUT_MS,
          }
        );
      } catch (sendError) {
        if (DHLService.isIndeterminateTransportError(sendError)) {
          // Anfrage war raus, keine Antwort: Sperre halten, Abgleich verlangen, NICHT erneut senden.
          keepLock = true;
          await markReconciliationRequired('nicht rechtzeitig bzw. nicht eindeutig geantwortet');
          throw this.resultUnknownError();
        }
        throw sendError;
      }

      console.log('DHLReturnsService: Return label created successfully');
      console.log('DHLReturnsService: Return ID:', response.data?.returnId || response.data?.shipmentNo);

      // Extract return information
      const returnData = response.data || {};
      const returnId = returnData.returnId || returnData.shipmentNo;
      if (!returnId) {
        keepLock = true;
        await markReconciliationRequired('geantwortet, aber keine Sendungsnummer zurückgegeben');
        throw this.resultUnknownError();
      }

      // Save PDF label if available
      let labelUrl = '';
      if (returnData.label && returnData.label.b64) {
        // In a real implementation, you would save this to cloud storage (S3, etc.)
        // For now, we'll store it as a data URL
        labelUrl = `data:application/pdf;base64,${returnData.label.b64}`;
        console.log('DHLReturnsService: PDF label generated (length:', returnData.label.b64.length, 'chars)');
      }

      // Save QR code if available
      let qrCodeUrl = '';
      if (returnData.qrLabel && returnData.qrLabel.b64) {
        qrCodeUrl = `data:image/png;base64,${returnData.qrLabel.b64}`;
        console.log('DHLReturnsService: QR code generated (length:', returnData.qrLabel.b64.length, 'chars)');
      }

      // QR link for mobile app
      const qrLink = returnData.qrLink || '';
      if (qrLink) {
        console.log('DHLReturnsService: QR link for mobile app:', qrLink);
      }

      // Persist the return information.
      //
      // The label EXISTS at DHL from here on, so this step must not be able to throw the
      // whole call away. Two reasons it used to:
      //  - `booking.status = 'in-transit'` is not in Booking.status's enum
      //    ['pending','payment-pending','processing','completed','cancelled'], so
      //    booking.save() failed validation AFTER every successful DHL call and the
      //    caller saw a 500 while the label was already created. The return state lives
      //    in `returnShipmentStatus` ('label-created'), which IS a valid enum value -
      //    the fulfilment status of the booking is none of this function's business.
      //  - a full-document save() re-validates unrelated legacy fields of an old booking.
      // A targeted update writes only the return fields and never revalidates the rest.
      const returnUpdate = {
        returnLabelUrl: labelUrl,
        returnQRCodeUrl: qrCodeUrl,
        returnTrackingNumber: returnId,
        returnShipmentId: returnId,
        returnShipmentStatus: 'label-created',
        returnShipmentStatusDescription: 'DHL-Rücksendeetikett wurde erstellt',
        returnCreatedAt: new Date(),
      };

      const actorFields = DHLService.timelineActor(options.actor, 'DHL Returns Integration');
      let persisted;
      try {
        // Nur schreiben, solange DIESE Anfrage die Sperre haelt (ein Abgleich koennte sie
        // inzwischen geloest haben); die Sperre wird im selben Schreibzugriff freigegeben.
        persisted = await Booking.updateOne(
          { _id: booking._id, shippingLabelCreationInProgress: true },
          {
            $set: { ...returnUpdate, shippingLabelCreationInProgress: false },
            $push: {
              timeline: {
                status: 'Return Label Created',
                description: `DHL-Retourenlabel (Einsendung, Kunde an McRepair) erstellt. Sendungsnummer: ${returnId}`,
                completedAt: new Date(),
                staffId: actorFields.staffId,
                staffName: actorFields.staffName,
              },
            },
          }
        );
      } catch (persistError) {
        // Do NOT lose the label: it exists at DHL and its data is in this response.
        console.error(
          'DHLReturnsService: Return label was created at DHL but could not be stored on the booking:',
          persistError.message
        );
        keepLock = true;
        await markReconciliationRequired(`die Sendung ${returnId} angelegt, sie konnte aber nicht an der Buchung gespeichert werden`);
        const persistFailed = new Error(
          `Das Rücksendeetikett wurde bei DHL erstellt (Sendungsnummer ${returnId}), konnte aber nicht `
          + 'an der Buchung gespeichert werden. Bitte die Sendungsnummer notieren und den Vorgang nicht wiederholen.'
        );
        persistFailed.status = 500;
        persistFailed.code = 'LABEL_PERSIST_FAILED';
        throw persistFailed;
      }
      if (!persisted || persisted.matchedCount === 0) {
        // Die Sperre gehoert dieser Anfrage nicht mehr (Abgleich dazwischen): nichts
        // ueberschreiben, aber die Sendungsnummer im Verlauf festhalten (kein Abgleich-Marker).
        lockClaimed = false;
        await Booking.updateOne({ _id: booking._id }, {
          $push: {
            timeline: {
              status: 'Return Label Orphaned',
              description: `Eine bereits abgeglichene Anfrage hat bei DHL ein Retourenlabel mit der Sendungsnummer ${returnId} erstellt. Es wurde NICHT an der Buchung gespeichert. Bitte im DHL-Geschäftskundenportal prüfen und das überzählige Label stornieren.`,
              completedAt: new Date(),
              staffId: 'system',
              staffName: 'DHL Returns Integration',
            },
          },
        }).catch(() => {});
        throw conflict('LABEL_CLAIM_LOST', `Das Retourenlabel wurde bei DHL erstellt (Sendungsnummer ${returnId}), aber nicht gespeichert, weil die Erstellung inzwischen abgeglichen wurde. Bitte das überzählige Label im DHL-Geschäftskundenportal stornieren.`);
      }
      lockClaimed = false;
      Object.assign(booking, returnUpdate);
      console.log('DHLReturnsService: Booking updated with return information');

      return {
        success: true,
        returnId,
        returnTrackingNumber: returnId,
        labelUrl,
        qrCodeUrl,
        qrLink,
        message: 'Das DHL-Retourenlabel (Kunde → McRepair) wurde erstellt.',
      };
    } catch (error) {
      console.error('DHLReturnsService: Error creating return label:', error.response?.data || error.message);

      // Eindeutiger Fehler (keine Sendung bei DHL): die eigene Sperre wieder freigeben.
      if (lockClaimed && !keepLock) {
        await Booking.updateOne(
          { _id: bookingId, shippingLabelCreationInProgress: true },
          { $set: { shippingLabelCreationInProgress: false } }
        ).catch((releaseError) => {
          console.error('DHLReturnsService: Could not release booking label lock:', releaseError.message);
        });
      }

      const withStatus = (message, status, code) => {
        const mapped = new Error(message);
        mapped.status = status;
        mapped.code = code;
        mapped.retryable = false;
        return mapped;
      };

      // Die rohe DHL-Diagnose gehoert ins Log, nicht in die Oberflaeche.
      if (error.response?.status === 400) {
        const errorDetails = error.response.data?.detail || error.response.data?.message || 'Invalid request parameters';
        console.error('DHLReturnsService: DHL rejected the return order:', errorDetails);
        throw withStatus('DHL hat die Rücksendung abgelehnt. Bitte die Absenderadresse (Straße, Hausnummer, PLZ, Ort) prüfen.', 422, 'DHL_REJECTED');
      }

      if (error.response?.status === 401) {
        throw withStatus('DHL hat die Anmeldung für Rücksendungen abgelehnt. Bitte die Zugangsdaten der DHL-Integration prüfen.', 503, 'DHL_AUTH_FAILED');
      }

      if (error.response?.status === 404) {
        throw withStatus('Die DHL-Rücksende-Schnittstelle wurde nicht gefunden. Bitte die Endpunkt-Konfiguration der DHL-Integration prüfen.', 503, 'DHL_ENDPOINT_NOT_FOUND');
      }

      throw error;
    }
  }

  /**
   * Create return label for an order that has no linked booking
   * @param {string} orderId - Order ID
   * @param {object} options - Optional parameters
   * @returns {object} - Return label information
   */
  static async createReturnLabelForOrder(orderId, options = {}) {
    console.log('DHLReturnsService: Creating return label for order:', orderId);
    // Atomare Reservierung des Einsendeplatzes (siehe DHLService.inboundClaimFilter):
    // zwei gleichzeitige Klicks bzw. zwei Mitarbeiter erzeugen nie zwei bezahlte Retouren.
    let claimed = false;
    let keepClaim = false;
    // Startzeit DIESER Reservierung: jeder spaetere Schreibzugriff ist an sie gebunden
    // (DHLService.inboundClaimFence) - eine abgelaufene, inzwischen uebernommene Anfrage kann
    // so nichts mehr ueberschreiben, freigeben oder markieren.
    let claimedAt = null;

    try {
      const order = await Order.findById(orderId);

      if (!order) {
        console.error('DHLReturnsService: Order not found:', orderId);
        const notFound = new Error('Auftrag nicht gefunden.');
        notFound.status = 404;
        throw notFound;
      }

      // Sendung existiert (z. B. per Abgleich uebernommen), aber das PDF fehlt: kein neues,
      // zweites bezahltes Label erzeugen.
      if (!order.returnLabelUrl && order.returnTrackingNumber && order.returnShipmentStatus !== 'pending') {
        const missing = new Error(
          `Das Einsendelabel wurde bei DHL bereits angelegt (Sendungsnummer ${order.returnTrackingNumber}), das PDF liegt aber nicht vor. `
          + 'Bitte das Label im DHL-Geschäftskundenportal abrufen, statt ein neues zu erstellen.'
        );
        missing.status = 409;
        missing.code = 'EXISTING_SHIPMENT_LABEL_MISSING';
        throw missing;
      }

      if (order.returnLabelUrl || order.returnShipmentStatus === 'label-created') {
        return {
          success: true,
          returnId: order.returnShipmentId,
          returnTrackingNumber: order.returnTrackingNumber,
          labelUrl: order.returnLabelUrl,
          qrCodeUrl: order.returnQRCodeUrl,
          alreadyExists: true,
          message: 'Für diesen Auftrag ist bereits ein Einsendelabel vorhanden.',
          order,
        };
      }

      // 'pending' am Auftrag = ein anderes Einsendelabel (Parcel DE, z. B. Reklamation) wird
      // gerade erstellt oder wartet nach einer unklaren DHL-Antwort auf den Abgleich.
      if (order.returnShipmentStatus === 'pending') {
        const error = new Error('Für diesen Auftrag wird bereits ein Einsendelabel erstellt oder abgeglichen. Bitte den Auftrag neu laden.');
        error.status = 409;
        error.code = 'LABEL_CREATION_IN_PROGRESS';
        throw error;
      }

      console.log('DHLReturnsService: Order found:', order.orderNumber);
      console.log('DHLReturnsService: Customer ID:', order.customerId);

      const customer = await User.findById(order.customerId).select('firstName lastName name email phone invoiceAddress');

      if (!customer) {
        console.error('DHLReturnsService: Customer not found for order');
        throw new Error('Kundendaten nicht gefunden.');
      }

      // Prefer the order's own shipping address, fall back to the customer's invoice address.
      // A Packstation is never a valid RETURN sender address (the customer hands the parcel
      // in themselves), and mixing its PLZ/Ort with the invoice street produced a corrupt
      // address – so a Packstation delivery address is skipped entirely here.
      const orderShipping = order.shippingAddress || {};
      const invoiceAddress = customer.invoiceAddress || {};
      const shippingAddress = orderShipping.deliveryType === 'packstation' ? {} : orderShipping;
      const street = shippingAddress.street || invoiceAddress.street;
      const city = shippingAddress.city || invoiceAddress.city;
      const zipCode = shippingAddress.zipCode || invoiceAddress.zipCode;
      const country = shippingAddress.country || invoiceAddress.country;

      if (!street || !city || !zipCode) {
        console.error('DHLReturnsService: Incomplete address for order return label');
        throw new Error('Die Versand- bzw. Rechnungsadresse ist unvollständig. Straße, Stadt und Postleitzahl werden benötigt.');
      }

      // DHL expects street and house number separately; the checkout stores them combined.
      // A stored house number belonging to the SAME address wins over one parsed out of a
      // street that merely ends in digits; the splitter is the fallback.
      const orderStreetParts = DHLService.splitStreetAndHouse(street);
      const storedHouseNumber = shippingAddress.street
        ? String(shippingAddress.number || '').trim()
        : String(invoiceAddress.number || '').trim();
      const orderHouseNumber = orderStreetParts.house || storedHouseNumber;

      // Never invent a house number: a made-up "1" produces an undeliverable label that
      // nobody notices until the parcel comes back.
      if (!orderHouseNumber) {
        console.error('DHLReturnsService: No house number for order return label');
        throw new Error(
          'Die Hausnummer der Absenderadresse fehlt. Bitte die Hausnummer in der ' +
          `${shippingAddress.street ? 'Lieferadresse des Auftrags' : 'Rechnungsadresse des Kunden'} ` +
          `ergänzen (Straße: "${String(street).trim()}").`
        );
      }

      claimedAt = new Date();
      const claimResult = await Order.findOneAndUpdate(
        DHLService.inboundClaimFilter(order._id),
        {
          $set: {
            returnShipmentStatus: 'pending',
            returnShipmentStatusDescription: 'Einsendelabel (DHL-Retoure) wird erstellt',
            returnLabelCreationStartedAt: claimedAt,
          },
        },
        { new: true, projection: { _id: 1 }, ...DHLService.LOCK_WRITE_OPTIONS }
      );
      if (!claimResult) {
        const busy = new Error('Für diesen Auftrag wird bereits ein Einsendelabel erstellt oder abgeglichen. Bitte den Auftrag neu laden.');
        busy.status = 409;
        busy.code = 'LABEL_CREATION_IN_PROGRESS';
        throw busy;
      }
      claimed = true;

      const config = await this.getDHLReturnsConfig();
      const accessToken = await this.getAccessToken();
      const labelType = options.labelType || 'BOTH';

      const returnRequest = {
        receiverId: config.receiverId,
        shipper: {
          name1: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer',
          addressStreet: orderStreetParts.street || street,
          addressHouse: orderHouseNumber,
          postalCode: zipCode,
          city,
        },
      };

      if (customer.email) {
        returnRequest.shipper.email = customer.email;
      }

      if (customer.phone) {
        returnRequest.shipper.phone = customer.phone;
      }

      if (country && country !== 'DE' && country !== 'Deutschland') {
        returnRequest.shipper.country = country;
      }

      console.log('DHLReturnsService: Return request payload:', JSON.stringify(returnRequest, null, 2));

      const returnLabelEndpoint = `${config.apiEndpoint}/parcel/de/shipping/returns/v1/orders`;
      const queryParams = labelType !== 'PDF' ? `?labelType=${labelType}` : '';

      // Frist durchsetzen, BEVOR das bezahlte Label angefordert wird: die Reservierung muss
      // noch dieser Anfrage gehoeren und die Restfrist den DHL-Timeout abdecken. Sonst wurde
      // bei DHL nichts angelegt; die eigene Reservierung wird im catch freigegeben.
      await DHLService.assertLabelClaimActive(
        DHLService.inboundClaimFence(order._id, claimedAt),
        claimedAt,
        { requestTimeoutMs: this.RETURNS_REQUEST_TIMEOUT_MS }
      );

      let response;
      try {
        response = await axios.post(
          returnLabelEndpoint + queryParams,
          returnRequest,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            // Ohne Timeout koennte die Anfrage die Reservierungsfrist ueberdauern.
            timeout: this.RETURNS_REQUEST_TIMEOUT_MS,
          }
        );
      } catch (sendError) {
        if (DHLService.isIndeterminateTransportError(sendError)) {
          // Die Anfrage ist raus, eine Antwort kam nicht: ob DHL die Retoure angelegt hat,
          // ist unklar. Reservierung behalten, Abgleich verlangen, NICHT erneut senden.
          keepClaim = true;
          await DHLService.markInboundReconciliationRequired(order._id, {
            reference: order.orderNumber || String(order._id),
            kind: 'timeout',
            product: 'DHL-Retoure-Einsendelabel',
            claimedAt,
          });
          throw this.resultUnknownError();
        }
        throw sendError;
      }

      console.log('DHLReturnsService: Return label created successfully for order');

      const returnData = response.data || {};
      const returnId = returnData.returnId || returnData.shipmentNo;
      if (!returnId) {
        // DHL hat geantwortet, aber ohne Sendungsnummer: die Retoure kann trotzdem existieren.
        keepClaim = true;
        await DHLService.markInboundReconciliationRequired(order._id, {
          reference: order.orderNumber || String(order._id),
          kind: 'tracking-missing',
          product: 'DHL-Retoure-Einsendelabel',
          claimedAt,
        });
        throw this.resultUnknownError();
      }

      let labelUrl = '';
      if (returnData.label && returnData.label.b64) {
        labelUrl = `data:application/pdf;base64,${returnData.label.b64}`;
      }

      let qrCodeUrl = '';
      if (returnData.qrLabel && returnData.qrLabel.b64) {
        qrCodeUrl = `data:image/png;base64,${returnData.qrLabel.b64}`;
      }

      const qrLink = returnData.qrLink || '';

      // Same rule as the booking path: the label exists at DHL from here on, so persist
      // ONLY the return fields and never let a full-document revalidation discard it.
      const returnUpdate = {
        returnLabelUrl: labelUrl,
        returnQRCodeUrl: qrCodeUrl,
        returnTrackingNumber: returnId,
        returnShipmentId: returnId,
        returnShipmentStatus: 'label-created',
        returnShipmentStatusDescription: 'DHL-Retourenlabel (Kunde → McRepair) erstellt',
        returnCreatedAt: new Date(),
      };

      try {
        // Nur schreiben, solange die Reservierung noch DIESER Anfrage gehoert (Fencing):
        // ein verspaetetes Ergebnis ueberschreibt nie das Label einer spaeteren Anfrage.
        const persisted = await Order.updateOne(
          DHLService.inboundClaimFence(order._id, claimedAt),
          {
            $set: returnUpdate,
            $unset: { returnLabelCreationStartedAt: '' },
            $push: {
              timeline: {
                status: 'Inbound Label Created',
                description: `DHL-Retourenlabel für die Einsendung (Kunde → McRepair) erstellt. Sendungsnummer: ${returnId}`,
                completedAt: new Date(),
                // HIST-16: handelnde Person (options.actor kommt nur aus der Route, nie aus dem Body).
                ...DHLService.timelineActor(options.actor),
              },
            },
          },
          DHLService.LOCK_WRITE_OPTIONS
        );
        if (!persisted || persisted.matchedCount === 0) {
          const lost = new Error('Die Reservierung gehört inzwischen einer anderen Anfrage bzw. wurde abgeglichen.');
          lost.claimLost = true;
          throw lost;
        }
        claimed = false;
        Object.assign(order, returnUpdate);
        console.log('DHLReturnsService: Order updated with return information');
      } catch (persistError) {
        keepClaim = true;
        console.error(
          'DHLReturnsService: Return label was created at DHL but could not be stored on the order:',
          persistError.message
        );
        await DHLService.markInboundReconciliationRequired(order._id, {
          reference: order.orderNumber || String(order._id),
          trackingNumber: returnId,
          kind: 'persist-failed',
          product: 'DHL-Retoure-Einsendelabel',
          claimedAt,
        }).catch((markError) => {
          console.error('DHLReturnsService: Could not record reconciliation marker:', markError.message);
        });
        const persistFailed = new Error(
          persistError.claimLost
            ? `Das Rücksendeetikett wurde bei DHL erstellt (Sendungsnummer ${returnId}), aber nicht am Auftrag gespeichert, weil diese `
              + 'Label-Erstellung inzwischen abgeglichen bzw. von einer anderen Anfrage übernommen wurde. Bitte das überzählige Label '
              + 'im DHL-Geschäftskundenportal stornieren und den Vorgang nicht wiederholen.'
            : `Das Rücksendeetikett wurde bei DHL erstellt (Sendungsnummer ${returnId}), konnte aber nicht `
              + 'am Auftrag gespeichert werden. Bitte die Sendungsnummer notieren und den Vorgang nicht wiederholen.'
        );
        persistFailed.status = 500;
        persistFailed.code = 'LABEL_PERSIST_FAILED';
        throw persistFailed;
      }

      return {
        success: true,
        returnId,
        returnTrackingNumber: returnId,
        labelUrl,
        qrCodeUrl,
        qrLink,
        message: 'Das Einsendelabel (DHL-Retoure, Kunde → McRepair) wurde erstellt.',
        order,
      };
    } catch (error) {
      if (claimed && !keepClaim) {
        // Eindeutiger Fehler (Adresse, Anmeldung, DHL-400 ...): bei DHL wurde nichts angelegt.
        await DHLService.releaseInboundClaim(orderId, claimedAt).catch((releaseError) => {
          console.error('DHLReturnsService: Could not release return label claim:', releaseError.message);
        });
      }
      console.error('DHLReturnsService: Error creating return label for order:', error.response?.data || error.message);

      // Die rohe DHL-Diagnose gehoert ins Log, nicht in die Oberflaeche.
      if (error.response?.status === 400) {
        const errorDetails = error.response.data?.detail || error.response.data?.message || 'Invalid request parameters';
        console.error('DHLReturnsService: DHL rejected the return order:', errorDetails);
        const rejected = new Error('DHL hat die Rücksendung abgelehnt. Bitte die Absenderadresse (Straße, Hausnummer, PLZ, Ort) prüfen.');
        rejected.status = 422;
        rejected.code = 'DHL_VALIDATION_ERROR';
        throw rejected;
      }

      if (error.response?.status === 401) {
        throw new Error('DHL hat die Anmeldung für Rücksendungen abgelehnt. Bitte die Zugangsdaten der DHL-Integration prüfen.');
      }

      if (error.response?.status === 404) {
        throw new Error('Die DHL-Rücksende-Schnittstelle wurde nicht gefunden. Bitte die Endpunkt-Konfiguration der DHL-Integration prüfen.');
      }

      throw error;
    }
  }

  /** Timeout der DHL-Retouren-Anfrage (Teil der Fristpruefung vor dem Aufruf). */
  static RETURNS_REQUEST_TIMEOUT_MS = 30000;

  /** Unklares Ergebnis der DHL-Retoure: kein automatischer neuer Versuch, Abgleich noetig. */
  static resultUnknownError() {
    const unknown = new Error(
      'DHL hat nicht rechtzeitig bzw. nicht eindeutig geantwortet. Ob das Einsendelabel angelegt wurde, ist unklar. '
      + 'Bitte NICHT erneut erstellen, sondern zuerst im DHL-Geschäftskundenportal prüfen und den Abgleich abschließen.'
    );
    unknown.status = 409;
    unknown.code = 'DHL_RESULT_UNKNOWN';
    unknown.retryable = false;
    unknown.indeterminate = true;
    return unknown;
  }

  /**
   * Get tracking information for return shipment
   * Uses DHL Unified Tracking API
   * @param {string} trackingNumber - Return tracking number
   * @returns {object} - Tracking information
   */
  static async getReturnTracking(trackingNumber) {
    console.log('DHLReturnsService: Getting tracking info for:', trackingNumber);

    try {
      const config = await this.getDHLReturnsConfig();
      const accessToken = await this.getAccessToken();

      // Tracking API endpoint
      const trackingEndpoint = `${config.apiEndpoint}/track/shipments`;

      console.log('DHLReturnsService: Tracking endpoint:', trackingEndpoint);

      // Make tracking request
      const response = await axios.get(trackingEndpoint, {
        params: {
          trackingNumber,
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log('DHLReturnsService: Tracking info retrieved successfully');

      const shipment = response.data.shipments?.[0];

      if (!shipment) {
        console.log('DHLReturnsService: No tracking information available yet');
        return {
          success: true,
          trackingNumber,
          status: 'pending',
          statusDescription: 'No tracking information available yet',
          events: [],
        };
      }

      // Extract tracking information
      const status = shipment.status?.statusCode || 'unknown';
      const statusDescription = shipment.status?.description || '';
      const estimatedDelivery = shipment.estimatedTimeOfDelivery;
      const events = shipment.events || [];

      console.log('DHLReturnsService: Status:', status);
      console.log('DHLReturnsService: Events count:', events.length);

      return {
        success: true,
        trackingNumber,
        status,
        statusDescription,
        estimatedDelivery,
        events: events.map(event => ({
          timestamp: event.timestamp,
          location: event.location?.address?.addressLocality || '',
          statusCode: event.statusCode,
          description: event.description || '',
        })),
      };
    } catch (error) {
      console.error('DHLReturnsService: Error getting tracking info:', error.response?.data || error.message);

      // Return minimal tracking info on error
      return {
        success: false,
        trackingNumber,
        status: 'unknown',
        statusDescription: 'Unable to retrieve tracking information',
        events: [],
        error: error.message,
      };
    }
  }

  /**
   * Update return shipment status for booking
   * @param {string} bookingId - Booking ID
   * @returns {object} - Updated booking with tracking info
   */
  static async updateReturnStatus(bookingId) {
    console.log('DHLReturnsService: Updating return status for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new Error('Buchung nicht gefunden.');
      }

      if (!booking.returnTrackingNumber) {
        throw new Error('Für diese Buchung ist keine Rücksende-Sendungsnummer hinterlegt.');
      }

      // Get tracking information
      const trackingInfo = await this.getReturnTracking(booking.returnTrackingNumber);

      // Map DHL status codes to our booking statuses
      const statusMap = {
        'pre-transit': 'label-created',
        'transit': 'in-transit',
        'delivered': 'delivered',
        'failure': 'failed',
        'unknown': booking.returnShipmentStatus, // Keep current status
      };

      const newStatus = statusMap[trackingInfo.status] || booking.returnShipmentStatus;

      // Update booking if status changed
      if (newStatus !== booking.returnShipmentStatus) {
        console.log('DHLReturnsService: Status changed from', booking.returnShipmentStatus, 'to', newStatus);

        booking.returnShipmentStatus = newStatus;
        booking.returnShipmentStatusDescription = trackingInfo.statusDescription || newStatus;

        // Add timeline entry
        booking.timeline.push({
          status: 'Return Status Updated',
          description: `Return shipment status: ${trackingInfo.statusDescription || newStatus}`,
          completedAt: new Date(),
          staffId: 'system',
          staffName: 'System',
        });

        // If delivered, update returnReceivedAt
        if (newStatus === 'delivered' && !booking.returnReceivedAt) {
          booking.returnReceivedAt = new Date();
          console.log('DHLReturnsService: Return delivered at:', booking.returnReceivedAt);
        }

        await booking.save();
        console.log('DHLReturnsService: Booking updated with new status');
      }

      return {
        success: true,
        booking,
        trackingInfo,
      };
    } catch (error) {
      console.error('DHLReturnsService: Error updating return status:', error.message);
      throw error;
    }
  }

  /**
   * Test DHL Returns API connection
   * @returns {object} - Connection test result
   */
  static async testConnection() {
    console.log('DHLReturnsService: Testing DHL Returns API connection');

    try {
      // Try to get configuration
      const config = await this.getDHLReturnsConfig();
      console.log('DHLReturnsService: Configuration loaded successfully');

      // Try to get access token
      const accessToken = await this.getAccessToken();
      console.log('DHLReturnsService: OAuth2 authentication successful');

      return {
        success: true,
        message: 'DHL Returns API connection successful',
        environment: config.environment,
        receiverId: config.receiverId,
      };
    } catch (error) {
      console.error('DHLReturnsService: Connection test failed:', error.message);

      return {
        success: false,
        message: 'DHL Returns API connection failed',
        error: error.message,
      };
    }
  }
}

module.exports = DHLReturnsService;
