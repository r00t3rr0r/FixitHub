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

      // Find active DHL integration
      const dhlIntegration = config.integrations.find(
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
      const order = await Order.findById(orderId).populate('customerId', 'name email phone invoiceAddress');

      if (!order) {
        console.error('DHLService: Order not found:', orderId);
        throw new Error('Order not found');
      }

      console.log('DHLService: Order found:', order.orderNumber);

      // Use invoice address as fallback if shipping address is not complete
      // Convert Mongoose subdocument to plain object to access properties
      const customer = order.customerId?.toObject ? order.customerId.toObject() : order.customerId;
      const invoiceAddress = customer?.invoiceAddress || {};
      console.log('DHLService: Customer invoice address:', JSON.stringify(invoiceAddress, null, 2));

      // Validate shipping address is complete, fall back to invoice address if needed
      const receiverStreet = order.shippingAddress?.street || shipmentData.receiverAddress || invoiceAddress.street;
      const receiverCity = order.shippingAddress?.city || shipmentData.receiverCity || invoiceAddress.city;
      const receiverPostalCode = order.shippingAddress?.zipCode || shipmentData.receiverPostalCode || invoiceAddress.zipCode;
      const receiverCountry = order.shippingAddress?.country || shipmentData.receiverCountry || invoiceAddress.country || 'NL';

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

      // Get account ID from settings or use default
      const accountId = dhlConfig.settings?.accountId || dhlConfig.settings?.accountNumber;

      if (!accountId) {
        console.error('DHLService: Account ID not configured');
        throw new Error('DHL Account ID not configured in integration settings');
      }

      // Prepare shipment payload for DHL Parcel API
      // According to: https://api-gw.dhlparcel.nl/docs/guide/chapters/04-labels.html
      const customerName = customer?.name || 'Customer';
      const nameParts = customerName.split(' ');

      const shipmentPayload = {
        shipmentId: shipmentId,
        receiver: {
          name: {
            firstName: nameParts[0] || 'Customer',
            lastName: nameParts.slice(1).join(' ') || 'Customer'
          },
          address: {
            countryCode: receiverCountry,
            postalCode: receiverPostalCode,
            city: receiverCity,
            street: receiverStreet,
            number: order.shippingAddress?.number || shipmentData.receiverNumber || '1',
            isBusiness: false
          },
          email: customer?.email || shipmentData.receiverEmail,
          phoneNumber: customer?.phone || shipmentData.receiverPhone
        },
        shipper: {
          name: {
            firstName: 'FixitHub',
            lastName: 'Logistics'
          },
          address: {
            countryCode: shipmentData.shipperCountry || dhlConfig.settings?.shipperCountry || 'NL',
            postalCode: shipmentData.shipperPostalCode || dhlConfig.settings?.shipperPostalCode || '1012AB',
            city: shipmentData.shipperCity || dhlConfig.settings?.shipperCity || 'Amsterdam',
            street: shipmentData.shipperStreet || dhlConfig.settings?.shipperStreet || 'Company Street',
            number: shipmentData.shipperNumber || dhlConfig.settings?.shipperNumber || '1',
            isBusiness: true
          },
          email: shipmentData.shipperEmail || dhlConfig.settings?.shipperEmail || 'info@fixithub.com',
          phoneNumber: shipmentData.shipperPhone || dhlConfig.settings?.shipperPhone || '+31201234567'
        },
        accountId: accountId,
        returnLabel: false,
        options: shipmentData.options || []
      };

      // Add pieces array with parcel information
      shipmentPayload.pieces = [{
        parcelType: shipmentData.parcelType || 'SMALL',
        quantity: 1,
        weight: Math.round((shipmentData.weight || 1.0) * 1000), // Convert kg to grams
        dimensions: shipmentData.dimensions ? {
          length: shipmentData.dimensions.length || 20,
          width: shipmentData.dimensions.width || 15,
          height: shipmentData.dimensions.height || 10
        } : undefined
      }];

      console.log('DHLService: Sending shipment request to DHL Parcel API');
      console.log('DHLService: Endpoint:', dhlConfig.endpoint || 'https://api-gw.dhlparcel.nl');
      console.log('DHLService: Shipment payload:', JSON.stringify(shipmentPayload, null, 2));

      // Make API request to DHL Parcel API
      const response = await axios.post(
        `${dhlConfig.endpoint || 'https://api-gw.dhlparcel.nl'}/shipments`,
        shipmentPayload,
        {
          headers: {
            'Authorization': `Bearer ${dhlConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('DHLService: Shipment created successfully');
      console.log('DHLService: Response data:', JSON.stringify(response.data, null, 2));

      // Extract tracking number and label information from response
      const trackingNumber = response.data.shipmentTrackerCode || response.data.trackerCode;
      const returnedShipmentId = response.data.shipmentId;
      const pieces = response.data.pieces || [];

      // Get label ID from first piece
      const labelId = pieces[0]?.labelId;
      const pieceTrackerCode = pieces[0]?.trackerCode;

      console.log('DHLService: Tracking number:', trackingNumber);
      console.log('DHLService: Label ID:', labelId);
      console.log('DHLService: Piece tracker code:', pieceTrackerCode);

      // Fetch the label PDF if labelId is available
      let labelUrl = '';
      if (labelId) {
        try {
          console.log('DHLService: Fetching label PDF for labelId:', labelId);
          const labelResponse = await axios.get(
            `${dhlConfig.endpoint || 'https://api-gw.dhlparcel.nl'}/labels/${labelId}`,
            {
              headers: {
                'Authorization': `Bearer ${dhlConfig.apiKey}`,
                'Accept': 'application/pdf'
              },
              responseType: 'arraybuffer',
              timeout: 30000
            }
          );

          // Convert PDF buffer to base64
          const base64Label = Buffer.from(labelResponse.data).toString('base64');
          labelUrl = `data:application/pdf;base64,${base64Label}`;
          console.log('DHLService: Label PDF fetched successfully');
        } catch (labelError) {
          console.error('DHLService: Error fetching label PDF:', labelError.response?.data || labelError.message);
          // Continue without label URL - it can be fetched later
        }
      }

      // Update order with shipping information
      order.trackingNumber = trackingNumber || pieceTrackerCode || returnedShipmentId;
      order.carrier = 'DHL';
      order.shippingStatus = 'label-created';
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

      const errorMessage = error.response?.data?.message ||
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

      // Parse tracking events
      const trackingEvents = shipmentData.events?.map(event => ({
        timestamp: new Date(event.timestamp),
        location: `${event.location?.address?.addressLocality || ''}, ${event.location?.address?.countryCode || ''}`.trim(),
        status: event.statusCode,
        description: event.description || ''
      })) || [];

      return {
        success: true,
        trackingNumber,
        status: shipmentData.status?.statusCode || 'unknown',
        description: shipmentData.status?.description || 'No status available',
        estimatedDelivery: shipmentData.estimatedTimeOfDelivery,
        events: trackingEvents,
        origin: shipmentData.origin?.address,
        destination: shipmentData.destination?.address
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
  static async testConnection(apiKey, apiSecret, endpoint = 'https://api-gw.dhlparcel.nl') {
    console.log('DHLService: Testing DHL Parcel API connection');
    console.log('DHLService: Endpoint:', endpoint);

    try {
      // Try to authenticate with DHL Parcel API by accessing the shipments endpoint
      // The DHL Parcel API uses Bearer token authentication, not Basic Auth
      const response = await axios.get(
        `${endpoint}/parcel-shop-locations/NL/1012AB`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('DHLService: Connection test successful');
      console.log('DHLService: Response status:', response.status);

      return {
        success: true,
        message: 'Successfully connected to DHL Parcel API',
        responseTime: response.headers['x-response-time'] || 'N/A'
      };

    } catch (error) {
      console.error('DHLService: Connection test failed:', error.message);
      console.error('DHLService: Error response:', error.response?.data);
      console.error('DHLService: Error status:', error.response?.status);

      // If we get a 401, it means authentication failed
      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Authentication failed. Please check your API key.',
          errorCode: '401_UNAUTHORIZED'
        };
      }

      // If we get a 404, it might mean the endpoint is correct but the test query didn't work
      // Still consider this a partial success as it means we can reach the API
      if (error.response?.status === 404) {
        return {
          success: true,
          message: 'Successfully connected to DHL Parcel API (endpoint reachable)',
          errorCode: '404_NOT_FOUND'
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to connect to DHL Parcel API',
        errorCode: error.response?.status || 'NETWORK_ERROR'
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
