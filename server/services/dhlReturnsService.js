const axios = require('axios');
const SystemConfiguration = require('../models/SystemConfiguration');
const Booking = require('../models/Booking');

/**
 * DHL Parcel DE Returns Service
 * Handles return label generation and tracking for German domestic and international returns
 * API Documentation: https://developer.dhl.com/api-reference/dhl-parcel-de-returns-post-parcel-germany
 */
class DHLReturnsService {

  /**
   * Get DHL Returns configuration from system settings
   */
  static async getDHLReturnsConfig() {
    console.log('DHLReturnsService: Fetching DHL Returns configuration');

    try {
      const config = await SystemConfiguration.findOne();

      if (!config || !config.integrations) {
        console.error('DHLReturnsService: No system configuration found');
        throw new Error('System configuration not found');
      }

      const dhlReturns = config.integrations.find(
        integration => integration.name === 'DHL Returns' && integration.type === 'shipping'
      );

      if (!dhlReturns || !dhlReturns.isActive) {
        console.error('DHLReturnsService: DHL Returns integration not found or not active');
        throw new Error('DHL Returns integration not configured or inactive');
      }

      const { apiKey, apiSecret, apiEndpoint, accountId } = dhlReturns.credentials;

      // apiKey = username, apiSecret = password for OAuth2
      // accountId = receiverID (14-character billing number)
      // Additional credentials (client_id, client_secret) should be in metadata
      const clientId = dhlReturns.metadata?.clientId || '';
      const clientSecret = dhlReturns.metadata?.clientSecret || '';
      const environment = dhlReturns.metadata?.environment || 'sandbox';

      if (!apiKey || !apiSecret || !accountId) {
        console.error('DHLReturnsService: Missing required DHL Returns credentials');
        throw new Error('DHL Returns credentials incomplete - username, password, and receiverID required');
      }

      console.log('DHLReturnsService: Configuration loaded successfully');
      console.log('DHLReturnsService: Environment:', environment);
      console.log('DHLReturnsService: ReceiverID:', accountId);

      return {
        username: apiKey,
        password: apiSecret,
        receiverId: accountId,
        clientId,
        clientSecret,
        apiEndpoint: apiEndpoint || (environment === 'production'
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
      });

      console.log('DHLReturnsService: OAuth2 token obtained successfully');
      console.log('DHLReturnsService: Token type:', response.data.token_type);
      console.log('DHLReturnsService: Expires in:', response.data.expires_in, 'seconds');

      return response.data.access_token;
    } catch (error) {
      console.error('DHLReturnsService: Error obtaining OAuth2 token:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid DHL Returns credentials - check username and password');
      }

      throw new Error(`Failed to obtain DHL Returns access token: ${error.message}`);
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

    try {
      // Get booking details
      const booking = await Booking.findById(bookingId).populate('customerId');

      if (!booking) {
        console.error('DHLReturnsService: Booking not found:', bookingId);
        throw new Error('Booking not found');
      }

      console.log('DHLReturnsService: Booking found:', booking.bookingNumber);
      console.log('DHLReturnsService: Customer:', booking.customerId?.email);

      // Get customer address - use invoice address as shipper address for returns
      const customer = booking.customerId;
      const invoiceAddress = customer?.invoiceAddress || {};

      console.log('DHLReturnsService: Customer invoice address:', JSON.stringify(invoiceAddress, null, 2));

      // Validate address
      if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
        console.error('DHLReturnsService: Incomplete customer invoice address');
        throw new Error('Customer invoice address is incomplete. Street, city, and postal code are required.');
      }

      // Get DHL configuration
      const config = await this.getDHLReturnsConfig();

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
          addressStreet: invoiceAddress.street,
          addressHouse: invoiceAddress.number || '1',
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

      // Make API request
      const response = await axios.post(
        returnLabelEndpoint + queryParams,
        returnRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      console.log('DHLReturnsService: Return label created successfully');
      console.log('DHLReturnsService: Return ID:', response.data.returnId || response.data.shipmentNo);

      // Extract return information
      const returnData = response.data;
      const returnId = returnData.returnId || returnData.shipmentNo;

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

      // Update booking with return information
      booking.returnLabelUrl = labelUrl;
      booking.returnQRCodeUrl = qrCodeUrl;
      booking.returnTrackingNumber = returnId;
      booking.returnShipmentId = returnId;
      booking.returnShipmentStatus = 'label-created';
      booking.returnCreatedAt = new Date();
      booking.status = 'in-transit'; // Update booking status

      // Add timeline entry
      booking.timeline.push({
        status: 'Return Label Created',
        description: `DHL return label generated (Tracking: ${returnId})`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
      });

      await booking.save();

      console.log('DHLReturnsService: Booking updated with return information');

      return {
        success: true,
        returnId,
        returnTrackingNumber: returnId,
        labelUrl,
        qrCodeUrl,
        qrLink,
        message: 'Return label created successfully',
      };
    } catch (error) {
      console.error('DHLReturnsService: Error creating return label:', error.response?.data || error.message);

      if (error.response?.status === 400) {
        const errorDetails = error.response.data?.detail || error.response.data?.message || 'Invalid request parameters';
        throw new Error(`DHL Returns API error: ${errorDetails}`);
      }

      if (error.response?.status === 401) {
        throw new Error('Authentication failed - DHL Returns API credentials may be invalid');
      }

      if (error.response?.status === 404) {
        throw new Error('DHL Returns API endpoint not found - check configuration');
      }

      throw error;
    }
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
        throw new Error('Booking not found');
      }

      if (!booking.returnTrackingNumber) {
        throw new Error('No return tracking number found for this booking');
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
