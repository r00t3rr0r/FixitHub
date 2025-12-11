const axios = require('axios');
const SystemConfiguration = require('../models/SystemConfiguration');
const Order = require('../models/Order');

/**
 * DHL API Service
 * Handles shipment creation, tracking, and label generation via DHL API
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
   * Create a shipment and generate shipping label
   * @param {string} orderId - Order ID
   * @param {Object} shipmentData - Shipment details
   * @returns {Promise<Object>} Shipment creation result
   */
  static async createShipment(orderId, shipmentData) {
    console.log('DHLService: Creating shipment for order:', orderId);

    try {
      // Get DHL configuration
      const dhlConfig = await this.getDHLConfig();

      // Retrieve order details
      const order = await Order.findById(orderId).populate('customerId', 'name email phone');

      if (!order) {
        throw new Error('Order not found');
      }

      console.log('DHLService: Order found:', order.orderNumber);

      // Prepare shipment payload for DHL API
      const shipmentPayload = {
        plannedShippingDateAndTime: new Date().toISOString(),
        pickup: {
          isRequested: false
        },
        productCode: shipmentData.serviceType || dhlConfig.settings?.defaultServiceType || 'P',
        accounts: [{
          typeCode: 'shipper',
          number: dhlConfig.settings?.accountNumber || '123456789'
        }],
        customerDetails: {
          shipperDetails: {
            postalAddress: {
              postalCode: shipmentData.shipperPostalCode || '10115',
              cityName: shipmentData.shipperCity || 'Berlin',
              countryCode: shipmentData.shipperCountry || 'DE',
              addressLine1: shipmentData.shipperAddress || 'Company Street 1'
            },
            contactInformation: {
              email: shipmentData.shipperEmail || dhlConfig.settings?.defaultEmail || 'info@fixithub.com',
              phone: shipmentData.shipperPhone || '+49 30 1234567',
              companyName: shipmentData.shipperCompany || 'FixitHub',
              fullName: shipmentData.shipperName || 'FixitHub Logistics'
            }
          },
          receiverDetails: {
            postalAddress: {
              postalCode: order.shippingAddress?.zipCode || shipmentData.receiverPostalCode,
              cityName: order.shippingAddress?.city || shipmentData.receiverCity,
              countryCode: order.shippingAddress?.country || shipmentData.receiverCountry || 'DE',
              addressLine1: order.shippingAddress?.street || shipmentData.receiverAddress
            },
            contactInformation: {
              email: order.customerId?.email || 'customer@example.com',
              phone: order.customerId?.phone || '+49 30 9876543',
              fullName: order.customerId?.name || 'Customer'
            }
          }
        },
        content: {
          packages: [{
            weight: shipmentData.weight || 1.0,
            dimensions: {
              length: shipmentData.length || 20,
              width: shipmentData.width || 15,
              height: shipmentData.height || 10
            }
          }],
          isCustomsDeclarable: shipmentData.isCustomsDeclarable || false,
          description: `Repair Order ${order.orderNumber} - ${order.deviceBrand} ${order.deviceModel}`,
          incoterm: 'DAP',
          unitOfMeasurement: 'metric'
        },
        documentImages: [{
          typeCode: 'label',
          imageFormat: dhlConfig.settings?.labelFormat || 'PDF',
          encodingFormat: 'base64'
        }]
      };

      console.log('DHLService: Sending shipment request to DHL API');

      // Make API request to DHL
      const response = await axios.post(
        `${dhlConfig.endpoint || 'https://express.api.dhl.com'}/mydhlapi/shipments`,
        shipmentPayload,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${dhlConfig.apiKey}:${dhlConfig.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('DHLService: Shipment created successfully');

      // Extract tracking number and label from response
      const trackingNumber = response.data.shipmentTrackingNumber || response.data.trackingNumber;
      const labelData = response.data.documents?.[0]?.content || null;

      // Update order with shipping information
      order.trackingNumber = trackingNumber;
      order.carrier = 'DHL';
      order.shippingStatus = 'label-created';
      order.shippingLabelUrl = labelData ? `data:application/pdf;base64,${labelData}` : '';
      order.shippingCost = shipmentData.shippingCost || 0;
      order.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      // Add tracking event
      order.trackingEvents.push({
        timestamp: new Date(),
        location: shipmentData.shipperCity || 'Origin',
        status: 'label-created',
        description: 'Shipping label created successfully'
      });

      // Add timeline entry
      order.timeline.push({
        status: 'Shipping Label Created',
        description: `DHL shipping label created. Tracking number: ${trackingNumber}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'DHL Integration'
      });

      await order.save();

      console.log('DHLService: Order updated with tracking information');

      return {
        success: true,
        trackingNumber,
        labelUrl: order.shippingLabelUrl,
        estimatedDelivery: order.estimatedDelivery,
        shipmentId: response.data.shipmentId || trackingNumber
      };

    } catch (error) {
      console.error('DHLService: Error creating shipment:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || error.message || 'Failed to create shipment');
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
   * Test DHL API connection
   * @param {string} apiKey - DHL API key
   * @param {string} apiSecret - DHL API secret
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Test result
   */
  static async testConnection(apiKey, apiSecret, endpoint = 'https://express.api.dhl.com') {
    console.log('DHLService: Testing DHL API connection');

    try {
      // Try to authenticate with DHL API
      const response = await axios.get(
        `${endpoint}/mydhlapi/test/connectivity`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
          },
          timeout: 10000
        }
      );

      console.log('DHLService: Connection test successful');

      return {
        success: true,
        message: 'Successfully connected to DHL API',
        responseTime: response.headers['x-response-time'] || 'N/A'
      };

    } catch (error) {
      console.error('DHLService: Connection test failed:', error.message);

      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to connect to DHL API',
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
