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
   * Erstattet (einen Teil) einer PayPal-Capture.
   *
   * Offizielle API: POST /v2/payments/captures/{capture_id}/refund. Die Umgebung
   * (sandbox/live) kommt ausschliesslich aus der Gateway-Konfiguration - Standard ist
   * die Sandbox. `requestId` wird als PayPal-Request-Id gesendet: PayPal fuehrt einen
   * wiederholten Aufruf mit derselben ID nicht ein zweites Mal aus, sondern liefert das
   * Ergebnis des ersten Aufrufs (Idempotenz auch dann, wenn unsere Antwort unterwegs
   * verloren geht).
   *
   * Liefert die Refund-Ressource ({ id, status: COMPLETED | PENDING | FAILED | CANCELLED, amount }).
   * Nur COMPLETED ist tatsaechlich zurueckgezahltes Geld.
   *
   * FEHLER tragen `refundOutcome`:
   *  - 'rejected'      = PayPal hat die Erstattung ENDGUELTIG nicht ausgefuehrt (4xx mit
   *                      Antwort, oder der Aufruf wurde gar nicht erst gesendet). Es ist
   *                      kein Geld geflossen; ein neuer Versuch ist moeglich.
   *  - 'indeterminate' = Ergebnis UNKLAR (Zeitueberschreitung, keine Antwort, 5xx, 408/409):
   *                      PayPal kann die Erstattung ausgefuehrt haben. Nie als
   *                      "fehlgeschlagen" behandeln - nur mit derselben Request-ID
   *                      wiederholen oder per Webhook abgleichen.
   * `message` ist ein deutscher Satz ohne rohen PayPal-Code; der Code steht in
   * `providerCode` (und im Log).
   */
  static async refundCapture(captureId, amount, { requestId = '', currency = 'EUR', note = '' } = {}, auth = null) {
    const cleanCaptureId = String(captureId || '').trim();
    if (!cleanCaptureId) {
      const error = new Error('Keine PayPal-Capture-ID vorhanden.');
      error.code = 'PAYPAL_CAPTURE_MISSING';
      error.refundOutcome = 'rejected';
      throw error;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      const error = new Error('Ungültiger Erstattungsbetrag.');
      error.code = 'PAYPAL_INVALID_AMOUNT';
      error.refundOutcome = 'rejected';
      throw error;
    }

    // Zugang holen, BEVOR die Erstattung gesendet wird: scheitert das, ist sicher
    // nichts erstattet worden.
    let resolvedAuth = auth;
    if (!resolvedAuth) {
      try {
        resolvedAuth = await PaypalService.getAccessToken(await PaypalService.getActiveGateway());
      } catch (error) {
        console.error('PaypalService: PayPal-Zugang fuer Erstattung nicht verfuegbar:', error?.response?.data || error.message);
        const wrapped = new Error('Die Verbindung zu PayPal konnte nicht hergestellt werden (Zugangsdaten oder Konfiguration prüfen).');
        wrapped.code = 'PAYPAL_REFUND_FAILED';
        wrapped.statusCode = 502;
        wrapped.refundOutcome = 'rejected';
        wrapped.providerCode = error?.code || '';
        throw wrapped;
      }
    }
    const { accessToken, baseUrl } = resolvedAuth;
    try {
      const response = await axios.post(
        `${baseUrl}/v2/payments/captures/${encodeURIComponent(cleanCaptureId)}/refund`,
        {
          amount: { value: value.toFixed(2), currency_code: String(currency || 'EUR').toUpperCase() },
          ...(note ? { note_to_payer: String(note).slice(0, 255) } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...(requestId ? { 'PayPal-Request-Id': String(requestId).slice(0, 108) } : {}),
          },
          timeout: 20000,
        }
      );
      return response.data;
    } catch (error) {
      throw PaypalService.classifyRefundError(error);
    }
  }

  /**
   * Ordnet einen Fehler des Refund-Aufrufs ein (siehe refundCapture) und baut die
   * deutsche Meldung. Der rohe PayPal-Code landet nur in `providerCode` und im Log.
   */
  static classifyRefundError(error) {
    const status = Number(error?.response?.status) || 0;
    const details = error?.response?.data || {};
    const providerCode = String(details?.details?.[0]?.issue || details?.name || error?.code || '').trim();
    // Endgueltig nur, wenn PayPal geantwortet UND den Auftrag abgewiesen hat. 408
    // (Zeitueberschreitung) und 409 (dieselbe Request-ID wird noch verarbeitet) sind unklar.
    const rejected = status >= 400 && status < 500 && ![408, 409].includes(status);
    const outcome = rejected ? 'rejected' : 'indeterminate';
    console.error(`PaypalService: Erstattung ${outcome} (HTTP ${status || 'ohne Antwort'}, ${providerCode || 'ohne Code'})`);

    const wrapped = new Error(rejected
      ? PaypalService.describeRefundRejection(providerCode, status)
      : 'PayPal hat nicht eindeutig geantwortet (Zeitüberschreitung oder Störung beim Anbieter). Die Erstattung kann bereits ausgeführt worden sein.');
    wrapped.code = 'PAYPAL_REFUND_FAILED';
    wrapped.statusCode = 502;
    wrapped.refundOutcome = outcome;
    wrapped.providerCode = providerCode;
    wrapped.providerStatus = status || null;
    return wrapped;
  }

  static describeRefundRejection(providerCode, status = 0) {
    const messages = {
      REFUND_AMOUNT_EXCEEDED: 'Der Betrag übersteigt den bei PayPal noch erstattbaren Betrag dieser Zahlung.',
      CAPTURE_FULLY_REFUNDED: 'Die Zahlung wurde bei PayPal bereits vollständig erstattet.',
      REFUND_TIME_LIMIT_EXCEEDED: 'Die Frist für eine Erstattung über PayPal ist abgelaufen.',
      INSUFFICIENT_FUNDS: 'Das PayPal-Konto hat kein ausreichendes Guthaben für die Erstattung.',
      REFUND_FAILED_INSUFFICIENT_FUNDS: 'Das PayPal-Konto hat kein ausreichendes Guthaben für die Erstattung.',
      TRANSACTION_REFUSED: 'PayPal lässt für diese Zahlung keine Erstattung zu.',
      REFUND_NOT_ALLOWED: 'PayPal lässt für diese Zahlung keine Erstattung zu.',
      REFUND_NOT_PERMITTED_DUE_TO_CHARGEBACK: 'Für diese Zahlung läuft bei PayPal eine Rückbuchung (Chargeback); eine Erstattung ist nicht möglich.',
      PENDING_CAPTURE: 'Die Zahlung ist bei PayPal noch nicht abgeschlossen und kann noch nicht erstattet werden.',
      INVALID_RESOURCE_ID: 'Die Zahlung wurde bei PayPal nicht gefunden.',
      RESOURCE_NOT_FOUND: 'Die Zahlung wurde bei PayPal nicht gefunden.',
      CURRENCY_MISMATCH: 'Die Währung passt nicht zur PayPal-Zahlung.',
      DECIMAL_PRECISION: 'Der Betrag hat zu viele Nachkommastellen.',
      PERMISSION_DENIED: 'Die PayPal-Zugangsdaten erlauben keine Erstattung.',
      NOT_AUTHORIZED: 'Die PayPal-Zugangsdaten erlauben keine Erstattung.',
      AUTHENTICATION_FAILURE: 'Die Anmeldung bei PayPal ist fehlgeschlagen (Zugangsdaten prüfen).',
      RATE_LIMIT_REACHED: 'PayPal meldet zu viele Anfragen. Bitte in einigen Minuten erneut versuchen.',
    };
    if (messages[providerCode]) return messages[providerCode];
    if (status === 401) return messages.AUTHENTICATION_FAILURE;
    if (status === 403) return messages.PERMISSION_DENIED;
    if (status === 404) return messages.RESOURCE_NOT_FOUND;
    if (status === 429) return messages.RATE_LIMIT_REACHED;
    return 'PayPal hat die Erstattung abgelehnt.';
  }

  /**
   * Liest aus einem PAYMENT.CAPTURE.REFUNDED/REVERSED-Webhook die Refund-Daten.
   * Die Ressource ist dort die REFUND-Ressource: `id` ist die Refund-ID, die
   * Capture steht im Link mit rel "up" (…/v2/payments/captures/{id}).
   */
  static parseRefundWebhook(eventType, resource = {}) {
    const upLink = (resource.links || []).find((link) => link?.rel === 'up' && /\/captures\//.test(String(link?.href || '')));
    const captureFromLink = upLink ? String(upLink.href).split('/captures/')[1]?.split(/[/?]/)[0] : '';
    return {
      refundId: String(resource.id || '').trim(),
      captureId: String(captureFromLink || resource.supplementary_data?.related_ids?.capture_id || '').trim(),
      amount: Number(resource.amount?.value || resource.seller_payable_breakdown?.total_refunded_amount?.value || 0),
      // Ein REVERSED ohne eigenen Status ist eine abgeschlossene Rueckbuchung.
      status: String(resource.status || (eventType === 'PAYMENT.CAPTURE.REVERSED' ? 'COMPLETED' : '')).toUpperCase(),
      reason: resource.status_details?.reason || resource.note_to_payer || '',
    };
  }

  /**
   * Zielstatus einer Zahlung fuer einen CAPTURE-Webhook - oder null = nicht anfassen.
   *
   * Webhooks kommen wiederholt und in beliebiger Reihenfolge. Deshalb:
   *  - ein spaetes PENDING/DENIED setzt eine bereits abgeschlossene Zahlung NICHT
   *    zurueck (das Geld ist laut Capture-Antwort eingegangen),
   *  - ein wiederholtes COMPLETED hebt eine (teil-)erstattete Zahlung nicht wieder
   *    auf 'completed' an und ueberschreibt keinen Betrag,
   *  - REFUNDED/REVERSED veraendern den Status hier nie: Erstattungen laufen
   *    ausschliesslich ueber handleRefundWebhook (idempotent, kumulativ).
   */
  static resolveCaptureWebhookStatus(currentStatus, eventType) {
    const current = String(currentStatus || '');
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      return ['completed', 'refunded'].includes(current) ? null : 'completed';
    }
    if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      return ['completed', 'refunded', 'failed'].includes(current) ? null : 'processing';
    }
    if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
      return ['completed', 'refunded'].includes(current) ? null : 'failed';
    }
    return null;
  }

  /**
   * Service-Einstieg fuer den Webhook-Handler (checkoutRoutes): verbucht eine
   * Erstattung idempotent ueber FinancialService.applyGatewayRefundUpdate.
   */
  static async handleRefundWebhook(eventType, resource = {}) {
    const parsed = PaypalService.parseRefundWebhook(eventType, resource);
    return FinancialService.applyGatewayRefundUpdate({ provider: 'paypal', ...parsed });
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
