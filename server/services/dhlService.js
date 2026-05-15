const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const SystemConfiguration = require('../models/SystemConfiguration');
const Order = require('../models/Order');

/**
 * DHL Parcel API Service
 * Handles shipment creation, tracking, and label generation via DHL Parcel API
 * API Documentation: https://api-gw.dhlparcel.nl/docs/
 */
class DHLService {
  static tokenCache = new Map();

  static maskValue(value = '', left = 2, right = 2) {
    const text = String(value || '');
    if (!text) return '';
    if (text.length <= left + right) return '*'.repeat(text.length);
    return `${text.slice(0, left)}${'*'.repeat(text.length - left - right)}${text.slice(-right)}`;
  }

  static countryCodeToIso3(countryCode = '') {
    const normalized = String(countryCode || '').trim().toUpperCase();

    if (!normalized) return 'DEU';
    if (normalized.length === 3) return normalized;

    const map = {
      DE: 'DEU',
      NL: 'NLD',
      AT: 'AUT',
      CH: 'CHE',
      BE: 'BEL',
      LU: 'LUX',
      FR: 'FRA',
      IT: 'ITA',
      ES: 'ESP',
      PL: 'POL',
      CZ: 'CZE',
      GB: 'GBR',
      IE: 'IRL',
      DK: 'DNK'
    };

    if (map[normalized]) return map[normalized];

    // Accept full country names too (forms sometimes send the label instead of the ISO code)
    const nameMap = {
      GERMANY: 'DEU',
      DEUTSCHLAND: 'DEU',
      NETHERLANDS: 'NLD',
      NIEDERLANDE: 'NLD',
      AUSTRIA: 'AUT',
      'OESTERREICH': 'AUT',
      'ÖSTERREICH': 'AUT',
      SWITZERLAND: 'CHE',
      SCHWEIZ: 'CHE',
      BELGIUM: 'BEL',
      BELGIEN: 'BEL',
      LUXEMBOURG: 'LUX',
      LUXEMBURG: 'LUX',
      FRANCE: 'FRA',
      FRANKREICH: 'FRA',
      ITALY: 'ITA',
      ITALIEN: 'ITA',
      SPAIN: 'ESP',
      SPANIEN: 'ESP',
      POLAND: 'POL',
      POLEN: 'POL',
      'CZECH REPUBLIC': 'CZE',
      TSCHECHIEN: 'CZE',
      'UNITED KINGDOM': 'GBR',
      GROSSBRITANNIEN: 'GBR',
      IRELAND: 'IRL',
      IRLAND: 'IRL',
      DENMARK: 'DNK',
      'DAENEMARK': 'DNK',
      'DÄNEMARK': 'DNK'
    };

    if (nameMap[normalized]) return nameMap[normalized];

    console.warn(`DHLService.countryCodeToIso3: Unknown country "${countryCode}" – passing through unchanged. DHL likely rejects this value.`);
    return normalized;
  }

  static getParcelDEConfig(dhlIntegration) {
    const metadata = dhlIntegration?.metadata || {};
    const settings = dhlIntegration?.settings || {};
    const credentials = dhlIntegration?.credentials || {};

    const inferredEnvironment = String(
      metadata.environment || settings.environment || (dhlIntegration?.endpoint || '').includes('sandbox') ? 'sandbox' : 'production'
    ).toLowerCase();

    const baseUrl =
      credentials.apiEndpoint ||
      dhlIntegration?.endpoint ||
      (inferredEnvironment === 'production' ? 'https://api.dhl.com' : 'https://api-sandbox.dhl.com');

    return {
      baseUrl,
      environment: inferredEnvironment,
      clientId:
        metadata.clientId ||
        credentials.clientId ||
        credentials.apiKey ||
        dhlIntegration?.apiKey ||
        '',
      clientSecret:
        metadata.clientSecret ||
        credentials.clientSecret ||
        credentials.apiSecret ||
        dhlIntegration?.apiSecret ||
        '',
      username:
        metadata.username ||
        credentials.username ||
        settings.username ||
        process.env.DHL_BC_USERNAME ||
        process.env.DHL_BUSINESS_CUSTOMER_USERNAME ||
        '',
      password:
        metadata.password ||
        credentials.password ||
        settings.password ||
        process.env.DHL_BC_PASSWORD ||
        process.env.DHL_BUSINESS_CUSTOMER_PASSWORD ||
        '',
      profile: settings.profile || metadata.profile || 'STANDARD_GRUPPENPROFIL',
      product: settings.product || metadata.product || 'V01PAK',
      accountNumber: settings.accountNumber || settings.accountId || credentials.accountId || '',
      pickup: {
        locationType: settings?.pickup?.locationType || metadata?.pickup?.locationType || 'branch',
        branchCode: settings?.pickup?.branchCode || metadata?.pickup?.branchCode || '',
        retailID: settings?.pickup?.retailID || metadata?.pickup?.retailID || '',
        preferNearest: settings?.pickup?.preferNearest !== false,
        maxResults: Number(settings?.pickup?.maxResults || metadata?.pickup?.maxResults || 10),
        countryCode: settings?.pickup?.countryCode || metadata?.pickup?.countryCode || 'DE',
        probePath: settings?.pickup?.probePath || metadata?.pickup?.probePath || '/parcel/de/shipping/v2/pickup'
      },
      enabledApis: {
        parcelDeShipping: settings?.dhlApis?.parcelDeShipping !== false,
        parcelDeTracking: settings?.dhlApis?.parcelDeTracking !== false,
        parcelDeReturns: settings?.dhlApis?.parcelDeReturns === true,
        parcelDePickup: settings?.dhlApis?.parcelDePickup === true
      }
    };
  }

  static normalizeApiPath(path = '') {
    const normalized = String(path || '').trim();
    if (!normalized) return '';
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  static buildApiUrl(baseUrl, path) {
    const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
    const normalizedPath = this.normalizeApiPath(path);
    return `${normalizedBase}${normalizedPath}`;
  }

  static async probeApiEndpoint({ baseUrl, apiPath, accessToken }) {
    const url = this.buildApiUrl(baseUrl, apiPath);

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      const reachableStatuses = new Set([200, 204, 400, 401, 403, 405]);
      const success = reachableStatuses.has(response.status);

      return {
        success,
        status: response.status,
        url,
        message: success
          ? `Endpoint reachable (${response.status})`
          : `Endpoint check failed (${response.status})`
      };
    } catch (error) {
      return {
        success: false,
        status: error?.response?.status || null,
        url,
        message: error?.message || 'Endpoint probe failed'
      };
    }
  }

  static getDhlErrorDetails(error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const title = data?.title || data?.error || data?.message || '';
    const detail = data?.detail || data?.description || '';
    const oauthError = data?.error || '';
    const oauthErrorDescription = data?.error_description || data?.errorDescription || '';

    if (status === 401) {
      if (oauthError === 'invalid_client') {
        return {
          message:
            'DHL authentication failed (401 invalid_client). client_id/client_secret are invalid for this environment or app.',
          code: 'DHL_401_INVALID_CLIENT'
        };
      }

      if (oauthError === 'invalid_grant') {
        return {
          message:
            'DHL authentication failed (401 invalid_grant). Business Customer username/password are invalid for the selected environment.',
          code: 'DHL_401_INVALID_GRANT'
        };
      }

      if (oauthError === 'unauthorized_client') {
        return {
          message:
            'DHL authentication failed (401 unauthorized_client). Your app is not authorized to request tokens for this API/environment.',
          code: 'DHL_401_UNAUTHORIZED_CLIENT'
        };
      }

      return {
        message:
          `DHL authentication failed (401). Verify client_id/client_secret, business customer username/password, and environment mapping. ${oauthErrorDescription || ''}`.trim(),
        code: 'DHL_401_AUTH'
      };
    }

    if (status === 403) {
      return {
        message:
          'DHL authorization failed (403). The app or user is not authorized for Parcel DE Shipping in the selected environment.',
        code: 'DHL_403_FORBIDDEN'
      };
    }

    if (status === 400) {
      const validationMessages = Array.isArray(data?.items)
        ? data.items
            .flatMap((item) => (Array.isArray(item?.validationMessages) ? item.validationMessages : []))
            .map((entry) => {
              if (typeof entry === 'string') return entry;
              return entry?.validationMessage || entry?.message || entry?.property || '';
            })
            .filter(Boolean)
        : [];

      const validationText = validationMessages.length > 0
        ? ` Validation details: ${validationMessages.join(' | ')}`
        : '';

      return {
        message: `${detail || title || 'DHL request validation failed (400).'}${validationText}`.trim(),
        code: 'DHL_400_BAD_REQUEST'
      };
    }

    if (`${title} ${detail}`.includes('RF-UndefinedResource')) {
      return {
        message:
          'DHL endpoint/path is invalid (RF-UndefinedResource). Use /parcel/de/shipping/v2/orders for shipping order creation.',
        code: 'DHL_UNDEFINED_RESOURCE'
      };
    }

    return {
      message: detail || title || error.message || 'DHL request failed',
      code: `DHL_${status || 'REQUEST_ERROR'}`
    };
  }

  static async getAccessToken(config) {
    const requiredFields = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length) {
      throw new Error(
        `DHL Parcel DE OAuth configuration incomplete. Missing: ${missingFields.join(', ')}`
      );
    }

    const cacheKey = `${config.baseUrl}|${config.clientId}|${config.username}`;
    const cachedToken = DHLService.tokenCache.get(cacheKey);
    const now = Date.now();

    if (cachedToken && cachedToken.expiresAt > now + 60000) {
      return cachedToken.token;
    }

    const form = new URLSearchParams();
    form.append('grant_type', 'password');
    form.append('username', config.username);
    form.append('password', config.password);
    form.append('client_id', config.clientId);
    form.append('client_secret', config.clientSecret);

    try {
      const response = await axios.post(
        `${config.baseUrl}/parcel/de/account/auth/ropc/v1/token`,
        form,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000
        }
      );

      const token = response.data?.access_token;
      const expiresInSeconds = Number(response.data?.expires_in || 3600);

      if (!token) {
        throw new Error('OAuth token response did not contain access_token');
      }

      DHLService.tokenCache.set(cacheKey, {
        token,
        expiresAt: now + expiresInSeconds * 1000
      });

      return token;
    } catch (error) {
      const dhlError = this.getDhlErrorDetails(error);
      throw new Error(dhlError.message);
    }
  }

  /**
   * Get active DHL integration configuration
   * @returns {Promise<Object>} DHL integration config
   */
  static async getDHLConfig() {
    console.log('DHLService: Retrieving DHL configuration');

    try {
      const config = await SystemConfiguration.findOne({});

      if (!config || !config.integrations) {
        console.error('DHLService: No system configuration found');
        throw new Error('System configuration not found');
      }

      // Prefer active DHL outbound shipping integrations and avoid returns profiles.
      const dhlIntegration = config.integrations.find(
        integration => integration.provider === 'DHL' &&
                      integration.type === 'shipping' &&
                      integration.isActive &&
                      !String(integration.name || '').toLowerCase().includes('returns')
      ) || config.integrations.find(
        integration => integration.provider === 'DHL' &&
                      integration.type === 'shipping' &&
                      integration.isActive
      );

      if (!dhlIntegration) {
        console.error('DHLService: No active DHL integration found');
        throw new Error('DHL integration not configured or inactive');
      }

      console.log('DHLService: DHL configuration retrieved successfully');
      return dhlIntegration;
    } catch (error) {
      console.error('DHLService: Error retrieving DHL configuration:', error);
      throw error;
    }
  }

  /**
   * Create a shipment and generate shipping label using DHL Parcel API
   * @param {string} orderId - Order ID
   * @param {Object} shipmentData - Shipment details
   * @returns {Promise<Object>} Shipment creation result
   */
  static async createShipment(orderId, shipmentData) {
    console.log('DHLService: Creating shipment for order:', orderId);

    try {
      // Get DHL configuration
      const dhlConfig = await this.getDHLConfig();

      // Retrieve order details with full customer profile including invoice address
      const order = await Order.findById(orderId).populate('customerId', 'name email phone invoiceAddress paymentAddress');

      if (!order) {
        console.error('DHLService: Order not found:', orderId);
        throw new Error('Order not found');
      }

      console.log('DHLService: Order found:', order.orderNumber);

      // Use invoice address as fallback if shipping address is not complete
      // Convert Mongoose subdocument to plain object to access properties
      const customer = order.customerId?.toObject ? order.customerId.toObject() : order.customerId;
      const invoiceAddress = customer?.invoiceAddress || {};
      const paymentAddress = customer?.paymentAddress || {};
      console.log('DHLService: Order shippingAddress:', JSON.stringify(order.shippingAddress || {}, null, 2));
      console.log('DHLService: Customer invoice address:', JSON.stringify(invoiceAddress, null, 2));
      console.log('DHLService: Customer payment address:', JSON.stringify(paymentAddress, null, 2));

      // Validate shipping address is complete, fall back to payment then invoice address if needed
      const receiverStreet = order.shippingAddress?.street || shipmentData.receiverAddress || paymentAddress.street || invoiceAddress.street;
      const receiverCity = order.shippingAddress?.city || shipmentData.receiverCity || paymentAddress.city || invoiceAddress.city;
      const receiverPostalCode = order.shippingAddress?.zipCode || shipmentData.receiverPostalCode || paymentAddress.zipCode || invoiceAddress.zipCode;
      const receiverCountry = order.shippingAddress?.country || shipmentData.receiverCountry || paymentAddress.country || invoiceAddress.country || 'NL';

      // Check if required address fields are missing or empty
      if (!receiverStreet || receiverStreet.trim() === '') {
        console.error('DHLService: Missing receiver street address');
        throw new Error('Shipping address is incomplete. Street address is required to create a shipping label.');
      }

      if (!receiverCity || receiverCity.trim() === '') {
        console.error('DHLService: Missing receiver city');
        throw new Error('Shipping address is incomplete. City is required to create a shipping label.');
      }

      if (!receiverPostalCode || receiverPostalCode.trim() === '') {
        console.error('DHLService: Missing receiver postal code');
        throw new Error('Shipping address is incomplete. Postal code is required to create a shipping label.');
      }

      console.log('DHLService: Shipping address validated successfully');

      // Generate unique shipment ID (UUID v4 as required by DHL Parcel API)
      const shipmentId = uuidv4();
      console.log('DHLService: Generated shipment ID:', shipmentId);

      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);

      if (!parcelDeConfig.enabledApis.parcelDeShipping) {
        throw new Error('DHL Parcel DE Shipping API is disabled in integration settings');
      }

      // Get account ID from settings or use default
      const accountId =
        shipmentData.accountNumber ||
        dhlConfig.settings?.accountId ||
        dhlConfig.settings?.accountNumber ||
        parcelDeConfig.accountNumber;

      if (!accountId) {
        console.error('DHLService: Account ID not configured');
        throw new Error('DHL Account ID not configured in integration settings');
      }

      // Use receiver name from shipmentData if provided, otherwise use customer name
      const receiverName = shipmentData.receiverName || customer?.name || 'Customer';
      const singleShipment = shipmentData?.parcelDeOrderPayload || {
        product: shipmentData.product || parcelDeConfig.product,
        billingNumber: accountId,
        shipDate: shipmentData.shipmentDate || new Date().toISOString().slice(0, 10),
        shipper: {
          name1: shipmentData.shipperName || dhlConfig.settings?.shipperCompany || 'FixitHub GmbH',
          addressStreet: shipmentData.shipperStreet || dhlConfig.settings?.shipperStreet || 'Company Street',
          addressHouse: shipmentData.shipperNumber || dhlConfig.settings?.shipperNumber || '1',
          postalCode: shipmentData.shipperPostalCode || dhlConfig.settings?.shipperPostalCode || '10115',
          city: shipmentData.shipperCity || dhlConfig.settings?.shipperCity || 'Berlin',
          country: this.countryCodeToIso3(shipmentData.shipperCountry || dhlConfig.settings?.shipperCountry || 'DE'),
          email: shipmentData.shipperEmail || dhlConfig.settings?.shipperEmail || 'info@fixithub.com',
          phone: (shipmentData.shipperPhone || dhlConfig.settings?.shipperPhone || '+49301234567').substring(0, 20)
        },
        consignee: {
          name1: receiverName,
          addressStreet: receiverStreet,
          addressHouse: order.shippingAddress?.number || shipmentData.receiverNumber || '1',
          postalCode: receiverPostalCode,
          city: receiverCity,
          country: this.countryCodeToIso3(receiverCountry),
          email: shipmentData.receiverEmail || customer?.email || '',
          phone: (shipmentData.receiverPhone || customer?.phone || '+49301234567').substring(0, 20) // DHL requires 1-20 chars
        },
        details: {
          weight: {
            uom: 'kg',
            value: Number(shipmentData.weight || 1)
          }
        }
      };

      // Wrap in shipments array as required by DHL Parcel DE Shipping v2 API
      const shipmentPayload = {
        profile: shipmentData.profile || parcelDeConfig.profile,
        shipments: [singleShipment]
      };

      if (parcelDeConfig.enabledApis.parcelDePickup) {
        const pickupPayload = shipmentData?.parcelDePickupPayload || shipmentData?.pickup;

        if (pickupPayload && typeof pickupPayload === 'object') {
          // Forward explicit pickup payload to DHL when provided by caller.
          shipmentPayload.pickup = pickupPayload;
        }
      }

      console.log('DHLService: Sending shipment request to DHL Parcel DE Shipping API');
      console.log('DHLService: Endpoint:', `${parcelDeConfig.baseUrl}/parcel/de/shipping/v2/orders`);
      console.log('DHLService: Shipment payload:', JSON.stringify(shipmentPayload, null, 2));

      const accessToken = await this.getAccessToken(parcelDeConfig);

      // Make API request to DHL Parcel API
      const response = await axios.post(
        `${parcelDeConfig.baseUrl}/parcel/de/shipping/v2/orders`,
        shipmentPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('DHLService: Shipment created successfully');
      console.log('DHLService: Response data:', JSON.stringify(response.data, null, 2));

      // Parcel DE Shipping v2 returns shipment identifiers directly in the order response.
      const trackingNumber =
        response.data.shipmentNo ||
        response.data.shipmentNumber ||
        response.data.trackingNumber ||
        response.data.items?.[0]?.shipmentNo ||
        response.data.items?.[0]?.shipmentNumber;
      const returnedShipmentId = response.data.shipmentId || response.data.shipmentNo || response.data.orderNo;
      const labelId = response.data.labelId || response.data.items?.[0]?.labelId;
      const pieceTrackerCode = response.data.items?.[0]?.shipmentNo;

      console.log('DHLService: Tracking number:', trackingNumber);
      console.log('DHLService: Label ID:', labelId);
      console.log('DHLService: Piece tracker code:', pieceTrackerCode);

      // Parcel DE Shipping v2 usually returns label data directly in response body.
      let labelUrl = '';
      const base64Label =
        response.data?.label?.b64 ||
        response.data?.shipmentLabel?.b64 ||
        response.data?.items?.[0]?.label?.b64;

      if (base64Label) {
        labelUrl = `data:application/pdf;base64,${base64Label}`;
      }

      // Update order with shipping information
      order.trackingNumber = trackingNumber || pieceTrackerCode || returnedShipmentId;
      order.carrier = 'DHL';
      order.shippingStatus = 'label-created';
      order.shippingStatusDescription = 'DHL-Versandlabel wurde erstellt';
      order.shippingLabelUrl = labelUrl;
      order.shippingCost = shipmentData.shippingCost || 0;
      order.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      // Add tracking event
      order.trackingEvents.push({
        timestamp: new Date(),
        location: shipmentData.shipperCity || dhlConfig.settings?.shipperCity || 'Origin',
        status: 'label-created',
        description: 'Shipping label created successfully with DHL Parcel'
      });

      // Add timeline entry
      order.timeline.push({
        status: 'Shipping Label Created',
        description: `DHL Parcel shipping label created. Tracking number: ${order.trackingNumber}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'DHL Parcel Integration'
      });

      await order.save();

      console.log('DHLService: Order updated with tracking information');

      return {
        success: true,
        trackingNumber: order.trackingNumber,
        labelUrl: order.shippingLabelUrl,
        estimatedDelivery: order.estimatedDelivery,
        shipmentId: returnedShipmentId,
        labelId: labelId
      };

    } catch (error) {
      console.error('DHLService: Error creating shipment:', error);
      console.error('DHLService: Error response data:', error.response?.data);
      console.error('DHLService: Error response status:', error.response?.status);
      console.error('DHLService: Error stack trace:', error.stack);

      const dhlError = this.getDhlErrorDetails(error);

      const errorMessage =
        dhlError.message ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Failed to create shipment';

      throw new Error(errorMessage);
    }
  }

  /**
   * Get tracking information for a shipment
   * @param {string} trackingNumber - DHL tracking number
   * @returns {Promise<Object>} Tracking information
   */
  static async getTrackingInfo(trackingNumber) {
    console.log('DHLService: Getting tracking info for:', trackingNumber);

    try {
      const dhlConfig = await this.getDHLConfig();
      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);

      if (!parcelDeConfig.enabledApis.parcelDeTracking) {
        throw new Error('DHL Parcel DE Tracking API is disabled in integration settings');
      }

      const response = await axios.get(
        `${dhlConfig.endpoint || 'https://api-eu.dhl.com'}/track/shipments`,
        {
          params: {
            trackingNumber: trackingNumber
          },
          headers: {
            'DHL-API-Key': dhlConfig.apiKey
          }
        }
      );

      console.log('DHLService: Tracking info retrieved successfully');

      const shipmentData = response.data.shipments?.[0];

      if (!shipmentData) {
        throw new Error('No tracking information found');
      }

      const rawStatus =
        shipmentData.status?.statusCode ||
        shipmentData.status?.status ||
        shipmentData.status ||
        '';

      const normalizedStatus = String(rawStatus || '').trim().toLowerCase();

      // Parse tracking events and keep raw payload fields for richer UI display
      const trackingEvents = shipmentData.events?.map(event => ({
        timestamp: event.timestamp ? new Date(event.timestamp) : null,
        location: [
          event.location?.address?.addressLocality,
          event.location?.address?.countryCode,
        ].filter(Boolean).join(', '),
        status: String(event.statusCode || event.status || '').toLowerCase(),
        statusCode: event.statusCode || event.status || '',
        description: event.description || event.remarks || '',
        raw: event,
      })) || [];

      return {
        success: true,
        trackingNumber,
        status: normalizedStatus || 'unknown',
        statusCodeRaw: rawStatus || 'unknown',
        description: shipmentData.status?.description || 'No status available',
        estimatedDelivery: shipmentData.estimatedTimeOfDelivery,
        events: trackingEvents,
        origin: shipmentData.origin?.address,
        destination: shipmentData.destination?.address,
        carrier: 'DHL',
        service: shipmentData.details?.product?.productName || shipmentData.details?.product?.productCode || '',
        shipmentId: shipmentData.id || shipmentData.shipmentNo || shipmentData.shipmentNumber || '',
        liveApi: {
          provider: 'DHL',
          source: 'track/shipments',
          raw: response.data,
        },
      };

    } catch (error) {
      console.error('DHLService: Error getting tracking info:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || error.message || 'Failed to retrieve tracking information');
    }
  }

  /**
   * Update order with latest tracking information
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Updated order
   */
  static async updateOrderTracking(orderId) {
    console.log('DHLService: Updating order tracking for:', orderId);

    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      if (!order.trackingNumber) {
        throw new Error('No tracking number found for this order');
      }

      // Get latest tracking info from DHL
      const trackingInfo = await this.getTrackingInfo(order.trackingNumber);

      // Update order shipping status
      const statusMapping = {
        'transit': 'in-transit',
        'delivered': 'delivered',
        'failure': 'failed',
        'out-for-delivery': 'out-for-delivery'
      };

      const newStatus = statusMapping[trackingInfo.status] || order.shippingStatus;
      const statusChanged = newStatus !== order.shippingStatus;

      order.shippingStatus = newStatus;
      order.shippingStatusDescription = trackingInfo.description || trackingInfo.status || order.shippingStatusDescription;

      // Add new tracking events
      if (trackingInfo.events && trackingInfo.events.length > 0) {
        const existingTimestamps = order.trackingEvents.map(e => e.timestamp.getTime());

        trackingInfo.events.forEach(event => {
          const eventTimestamp = new Date(event.timestamp).getTime();
          if (!existingTimestamps.includes(eventTimestamp)) {
            order.trackingEvents.push(event);
          }
        });
      }

      // If delivered, set actual delivery date
      if (newStatus === 'delivered' && !order.actualDelivery) {
        order.actualDelivery = new Date();
      }

      // Add timeline entry if status changed
      if (statusChanged) {
        order.timeline.push({
          status: `Shipping Status: ${newStatus}`,
          description: trackingInfo.description,
          completedAt: new Date(),
          staffId: 'system',
          staffName: 'DHL Integration'
        });
      }

      await order.save();

      console.log('DHLService: Order tracking updated successfully');

      return {
        success: true,
        order,
        trackingInfo
      };

    } catch (error) {
      console.error('DHLService: Error updating order tracking:', error);
      throw error;
    }
  }

  /**
   * Test DHL Parcel API connection
   * @param {string} apiKey - DHL API key (Bearer token)
   * @param {string} apiSecret - DHL API secret (not used for Parcel API)
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Test result
   */
  static async testConnection(apiKey, apiSecret, endpoint = 'https://api-sandbox.dhl.com', auth = {}, options = {}) {
    console.log('DHLService: Testing DHL Parcel DE Shipping API connection');
    console.log('DHLService: Endpoint:', endpoint);

    try {
      const isSandbox = String(endpoint).includes('sandbox');
      const usernameSource = auth.username
        ? 'integration-metadata'
        : ((process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing'));
      const passwordSource = auth.password
        ? 'integration-metadata'
        : ((process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing'));

      const tokenConfig = {
        baseUrl: endpoint,
        clientId: apiKey,
        clientSecret: apiSecret,
        username: auth.username || process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME || (isSandbox ? 'user-valid' : ''),
        password: auth.password || process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD || (isSandbox ? 'SandboxPasswort2023!' : '')
      };

      const debug = {
        environment: isSandbox ? 'sandbox' : 'production',
        endpoint,
        tokenEndpoint: `${endpoint}/parcel/de/account/auth/ropc/v1/token`,
        probeEndpoint: `${endpoint}/parcel/de/shipping/v2`,
        authFlow: 'oauth2-password-ropc',
        pickupEnabled: Boolean(options?.enabledApis?.parcelDePickup),
        hasClientId: Boolean(apiKey),
        hasClientSecret: Boolean(apiSecret),
        hasUsername: Boolean(tokenConfig.username),
        hasPassword: Boolean(tokenConfig.password),
        usernameSource,
        passwordSource,
        clientIdMasked: this.maskValue(apiKey),
        usernameMasked: this.maskValue(tokenConfig.username)
      };

      const accessToken = await this.getAccessToken(tokenConfig);

      const shippingProbe = await this.probeApiEndpoint({
        baseUrl: endpoint,
        apiPath: '/parcel/de/shipping/v2',
        accessToken
      });

      if (!shippingProbe.success) {
        return {
          success: false,
          message: `DHL Shipping endpoint probe failed (${shippingProbe.status || 'n/a'})`,
          errorCode: 'DHL_SHIPPING_PROBE_FAILED',
          debug: {
            ...debug,
            shippingProbe
          }
        };
      }

      const pickupEnabled = Boolean(options?.enabledApis?.parcelDePickup);
      let pickupProbe = null;

      if (pickupEnabled) {
        const pickupProbePath =
          options?.pickup?.probePath ||
          '/parcel/de/shipping/v2/pickup';

        pickupProbe = await this.probeApiEndpoint({
          baseUrl: endpoint,
          apiPath: pickupProbePath,
          accessToken
        });

        if (!pickupProbe.success) {
          return {
            success: false,
            message: `DHL Parcel DE Pickup API probe failed (${pickupProbe.status || 'n/a'}). Please verify the configured Pickup Probe Path.`,
            errorCode: 'DHL_PICKUP_PROBE_FAILED',
            debug: {
              ...debug,
              shippingProbe,
              pickupProbe
            }
          };
        }
      }

      console.log('DHLService: Connection test successful');
      console.log('DHLService: Shipping probe status:', shippingProbe.status);

      return {
        success: true,
        message: pickupEnabled
          ? 'Successfully connected to DHL Parcel DE Shipping + Pickup APIs'
          : 'Successfully connected to DHL Parcel DE Shipping API',
        responseTime: 'N/A',
        debug: {
          ...debug,
          shippingProbe,
          pickupProbe
        }
      };

    } catch (error) {
      console.error('DHLService: Connection test failed:', error.message);
      console.error('DHLService: Error response:', error.response?.data);
      console.error('DHLService: Error status:', error.response?.status);

      const dhlError = this.getDhlErrorDetails(error);
      const oauthError = error?.response?.data?.error || '';
      const oauthErrorDescription = error?.response?.data?.error_description || '';
      const isSandbox = String(endpoint).includes('sandbox');
      const username = auth.username || process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME || (isSandbox ? 'user-valid' : '');

      const debug = {
        environment: isSandbox ? 'sandbox' : 'production',
        endpoint,
        tokenEndpoint: `${endpoint}/parcel/de/account/auth/ropc/v1/token`,
        probeEndpoint: `${endpoint}/parcel/de/shipping/v2`,
        authFlow: 'oauth2-password-ropc',
        pickupEnabled: Boolean(options?.enabledApis?.parcelDePickup),
        hasClientId: Boolean(apiKey),
        hasClientSecret: Boolean(apiSecret),
        hasUsername: Boolean(username),
        hasPassword: Boolean(auth.password || process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD || (isSandbox ? 'SandboxPasswort2023!' : '')),
        clientIdMasked: this.maskValue(apiKey),
        usernameMasked: this.maskValue(username),
        oauthError,
        oauthErrorDescription
      };

      return {
        success: false,
        message: dhlError.message,
        errorCode: dhlError.code,
        debug
      };
    }
  }

  /**
   * Handle DHL webhook for automatic status updates
   * @param {Object} webhookData - Webhook payload from DHL
   * @returns {Promise<Object>} Processing result
   */
  static async handleWebhook(webhookData) {
    console.log('DHLService: Processing webhook:', JSON.stringify(webhookData));

    try {
      const trackingNumber = webhookData.trackingNumber || webhookData.shipmentTrackingNumber;

      if (!trackingNumber) {
        throw new Error('No tracking number in webhook payload');
      }

      // Find order by tracking number
      const order = await Order.findOne({ trackingNumber });

      if (!order) {
        console.warn('DHLService: No order found for tracking number:', trackingNumber);
        return {
          success: false,
          message: 'Order not found'
        };
      }

      console.log('DHLService: Found order:', order.orderNumber);

      // Update order with webhook data
      await this.updateOrderTracking(order._id);

      return {
        success: true,
        message: 'Webhook processed successfully',
        orderId: order._id
      };

    } catch (error) {
      console.error('DHLService: Error processing webhook:', error);
      throw error;
    }
  }
}

module.exports = DHLService;
