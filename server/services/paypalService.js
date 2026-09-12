const axios = require('axios');
const FinancialService = require('./financialService');

const DAY_MS = 24 * 60 * 60 * 1000;
// PayPal's transaction search API rejects ranges longer than 31 days.
const MAX_WINDOW_DAYS = 31;
const MAX_WINDOWS = 12;

class PaypalService {
  static async getActiveGateway() {
    const gateways = await FinancialService.getPaymentGateways();
    const gateway = gateways.find((item) => item.provider === 'paypal' && item.isActive);
    if (!gateway) {
      const error = new Error('PayPal gateway is not configured or inactive.');
      error.code = 'PAYPAL_GATEWAY_UNAVAILABLE';
      error.statusCode = 400;
      throw error;
    }
    return gateway;
  }

  static async getAccessToken(gateway) {
    const config = gateway.configuration || {};
    const useLive = config.environment === 'live';
    const clientId = useLive ? config.live_client_id : config.sandbox_client_id;
    const clientSecret = useLive ? config.live_client_secret : config.sandbox_client_secret;
    const baseUrl = useLive
      ? (config.api_base_url_live || 'https://api-m.paypal.com')
      : (config.api_base_url_sandbox || 'https://api-m.sandbox.paypal.com');

    if (!clientId || !clientSecret) {
      const error = new Error('PayPal credentials are not configured.');
      error.code = 'PAYPAL_CREDENTIALS_MISSING';
      error.statusCode = 400;
      throw error;
    }

    const tokenResponse = await axios.post(
      `${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: clientId, password: clientSecret },
        timeout: 15000
      }
    );

    return {
      accessToken: tokenResponse.data.access_token,
      baseUrl,
      environment: useLive ? 'live' : 'sandbox'
    };
  }

  static async getOrder(orderId, auth) {
    if (!orderId) return null;
    const { accessToken, baseUrl } = auth || await PaypalService.getAccessToken(await PaypalService.getActiveGateway());

    try {
      const response = await axios.get(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      console.warn('PaypalService: Unable to load PayPal order', orderId, error?.response?.data?.name || error.message);
      return null;
    }
  }

  /**
   * Reads completed transactions from the PayPal reporting API.
   * Requires the "Transaction Search" permission on the REST app.
   */
  static async listTransactions({ startDate, endDate }, auth) {
    const resolvedAuth = auth || await PaypalService.getAccessToken(await PaypalService.getActiveGateway());
    const { accessToken, baseUrl } = resolvedAuth;

    const end = endDate instanceof Date ? new Date(endDate) : new Date();
    let start = startDate instanceof Date ? new Date(startDate) : new Date(end.getTime() - 30 * DAY_MS);
    if (start > end) start = new Date(end.getTime() - DAY_MS);

    const windows = [];
    let cursor = new Date(start);
    while (cursor < end && windows.length < MAX_WINDOWS) {
      const windowEnd = new Date(Math.min(cursor.getTime() + MAX_WINDOW_DAYS * DAY_MS, end.getTime()));
      windows.push({ from: new Date(cursor), to: windowEnd });
      cursor = new Date(windowEnd.getTime() + 1000);
    }

    const transactions = [];
    for (const window of windows) {
      let page = 1;
      let totalPages = 1;

      do {
        const response = await axios.get(`${baseUrl}/v1/reporting/transactions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            start_date: window.from.toISOString(),
            end_date: window.to.toISOString(),
            fields: 'transaction_info,payer_info,cart_info',
            page_size: 100,
            page
          },
          timeout: 30000
        });

        const details = response.data?.transaction_details || [];
        transactions.push(...details);
        totalPages = Number(response.data?.total_pages || 1);
        page += 1;
      } while (page <= totalPages && page <= 10);
    }

    return transactions;
  }
}

module.exports = PaypalService;
