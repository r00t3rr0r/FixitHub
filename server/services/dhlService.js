const axios = require('axios');
const crypto = require('crypto');
const SystemConfiguration = require('../models/SystemConfiguration');
const Order = require('../models/Order');

class ShippingLabelError extends Error {
  constructor(message, { code = 'LABEL_CREATION_FAILED', status = 500, retryable = false, details = [] } = {}) {
    super(message);
    this.name = 'ShippingLabelError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

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

  static resolveShippingProduct(shipmentData, configuredProduct) {
    const requestedProduct = String(shipmentData.product || shipmentData.serviceType || '').trim();
    const legacyServiceTypes = {
      P: 'V01PAK',
      N: 'V53WPAK',
      Y: 'V54EPAK'
    };

    return legacyServiceTypes[requestedProduct] || requestedProduct || configuredProduct;
  }

  /**
   * Split a combined "Straße und Hausnummer" input into the two separate fields the
   * DHL Parcel DE Shipping v2 API requires. The checkout only collects one combined
   * input, so without this the house number never reaches DHL.
   * Handles "Musterstraße 12", "Hauptstr.7", "Bahnhofstr. 12 b", "Musterstr. 12-14",
   * "Straße des 17. Juni 135" and leading-number notations such as "12 Main Street".
   */
  static splitStreetAndHouse(rawStreet = '') {
    const value = String(rawStreet || '').replace(/\s+/g, ' ').trim();
    if (!value) return { street: '', house: '' };

    // Trailing house number (DE/AT/CH notation)
    const trailing = value.match(/^(.*?[^\s,])[\s,]*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/);
    if (trailing && /[a-zA-ZäöüÄÖÜß]/.test(trailing[1])) {
      return {
        street: trailing[1].replace(/[\s,]+$/, '').trim(),
        house: trailing[2].replace(/\s+/g, '')
      };
    }

    // Leading house number (NL/US/FR notation)
    const leading = value.match(/^(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s+(.+)$/);
    if (leading && /[a-zA-ZäöüÄÖÜß]/.test(leading[2])) {
      return {
        street: leading[2].trim(),
        house: leading[1].replace(/\s+/g, '')
      };
    }

    return { street: value, house: '' };
  }

  /**
   * Resolve street AND house number as ONE pair from ONE address source.
   *
   * Falling back field by field pairs a street from one address with a house number
   * from another (the shop's street with the customer's house number, an invoice street
   * with the shipping address' number …) and produces a label that looks deliverable but
   * goes to the wrong door. Candidates are tried in order; the FIRST one that carries a
   * street wins and only that candidate's own house number is used. When it has none,
   * the house number stays empty so validateParcelDeParty fails with a precise German
   * message instead of the label silently going out.
   *
   * @param {Array<{street?: string, house?: string, source?: string}>} candidates
   * @returns {{street: string, house: string, source: string}}
   */
  static resolveStreetAndHouse(candidates = []) {
    for (const candidate of candidates) {
      const streetRaw = String(candidate?.street || '').trim();
      if (!streetRaw) continue;

      const split = this.splitStreetAndHouse(streetRaw);
      // The number that is part of the STREET TEXT wins: callers that store street and
      // house number combined ("Musterstraße 12") often pass a placeholder or stale
      // `house` alongside it, and letting that placeholder win silently replaces the real
      // number ("Musterstraße" + "1"). A separately supplied number is used only when the
      // street carries none of its own ("Straße des 17. Juni" + "135").
      const explicitHouse = String(candidate?.house || '').trim();

      return {
        street: split.street || streetRaw,
        house: split.house || explicitHouse,
        source: String(candidate?.source || '')
      };
    }

    return { street: '', house: '', source: '' };
  }

  /**
   * DHL validates ContactInformation.email against an e-mail pattern, so an empty or
   * malformed value must be omitted rather than sent as "".
   */
  static sanitizeEmail(value = '') {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';
  }

  static sanitizePhone(value = '') {
    const phone = String(value || '').trim().slice(0, 20);
    return /\d/.test(phone) ? phone : '';
  }

  /** 2-digit DHL "Verfahren" encoded in positions 11-12 of a 14-digit billing number. */
  static PRODUCT_PROCEDURES = {
    V01PAK: '01',
    V07PAK: '07',
    V53WPAK: '53',
    V54EPAK: '54',
    V62WP: '62',
    V66WPI: '66'
  };

  /**
   * Validate one party (shipper/consignee) of a Parcel DE shipment and return
   * German problem descriptions naming the offending field.
   */
  static validateParcelDeParty(party, label, options = {}) {
    const problems = [];
    if (!party || typeof party !== 'object') {
      problems.push(`${label}: Adressdaten fehlen vollständig.`);
      return problems;
    }

    const text = (value) => String(value ?? '').trim();
    const name = text(party.name1);
    const street = text(party.addressStreet);
    const house = text(party.addressHouse);
    const postalCode = text(party.postalCode);
    const city = text(party.city);
    const country = text(party.country);

    if (!name) problems.push(`${label}: Name fehlt.`);
    else if (name.length > 50) problems.push(`${label}: Name ist zu lang (maximal 50 Zeichen).`);

    // The delivery mode is a decision of the CALLER (deliveryType), not something to be
    // re-derived from the payload: a Packstation shipment whose numbers are still empty
    // carries lockerID:'' / postNumber:'' and would otherwise be validated as a street
    // address, complaining about a missing Straße/Hausnummer instead of the missing
    // Packstations-/Postnummer. Fall back to the payload shape only for callers that
    // do not state the mode (e.g. direct validateParcelDeShipment users).
    const isLocker = typeof options.isLocker === 'boolean'
      ? options.isLocker
      : Boolean(text(party.lockerID) || text(party.postNumber));
    if (isLocker) {
      if (!/^\d{3}$/.test(text(party.lockerID))) {
        problems.push(`${label}: Packstationsnummer fehlt oder ist ungültig (genau 3 Ziffern erwartet).`);
      }
      if (!/^\d{6,10}$/.test(text(party.postNumber))) {
        problems.push(`${label}: Postnummer fehlt oder ist ungültig (6 bis 10 Ziffern erwartet).`);
      }
    } else {
      if (!street) problems.push(`${label}: Straße fehlt.`);
      else if (street.length > 50) problems.push(`${label}: Straße ist zu lang (maximal 50 Zeichen).`);

      if (!house) {
        problems.push(`${label}: Hausnummer fehlt. Bitte die Hausnummer getrennt von der Straße angeben.`);
      } else if (house.length > 10) {
        problems.push(`${label}: Hausnummer ist zu lang (maximal 10 Zeichen).`);
      }
    }

    if (!postalCode) problems.push(`${label}: PLZ fehlt.`);
    if (!city) problems.push(`${label}: Ort fehlt.`);
    else if (city.length > 40) problems.push(`${label}: Ort ist zu lang (maximal 40 Zeichen).`);

    if (!country) {
      problems.push(`${label}: Land fehlt.`);
    } else if (!/^[A-Z]{3}$/.test(country)) {
      problems.push(`${label}: Land "${country}" ist ungültig. DHL erwartet einen dreistelligen ISO-Code (z. B. DEU).`);
    } else if (country === 'DEU' && postalCode && !/^\d{5}$/.test(postalCode)) {
      problems.push(`${label}: PLZ "${postalCode}" ist ungültig. In Deutschland werden genau 5 Ziffern erwartet.`);
    }

    return problems;
  }

  /**
   * Validate the assembled Parcel DE Shipping v2 shipment BEFORE calling DHL so staff
   * get a precise German message naming the missing/invalid field instead of an opaque
   * DHL 400 – or, worse, a silently wrong label.
   * @returns {string[]} German problem descriptions (empty when the payload is valid)
   */
  static validateParcelDeShipment(shipment = {}, options = {}) {
    const problems = [];
    const text = (value) => String(value ?? '').trim();
    const product = text(shipment.product).toUpperCase();
    const billingNumber = text(shipment.billingNumber);

    if (!product) {
      problems.push('DHL-Produkt fehlt. Bitte in den Integrationseinstellungen ein Produkt hinterlegen (z. B. V01PAK).');
    }

    if (!billingNumber) {
      problems.push('DHL Abrechnungsnummer (EKP) fehlt in den Integrationseinstellungen.');
    } else if (!/^\d{10,14}$/.test(billingNumber)) {
      problems.push(
        `DHL Abrechnungsnummer (EKP) ist ungültig: "${billingNumber}". Erwartet werden 14 Ziffern (10-stellige EKP + 2-stelliges Verfahren + 2-stellige Teilnahme).`
      );
    } else if (/^\d{14}$/.test(billingNumber) && product) {
      const procedure = billingNumber.slice(10, 12);
      const expected = DHLService.PRODUCT_PROCEDURES[product];
      if (expected && expected !== procedure) {
        problems.push(
          `Das DHL-Produkt "${product}" passt nicht zur Abrechnungsnummer (Verfahren ${procedure}, erwartet ${expected}). Bitte ein passendes Produkt wählen oder die Abrechnungsnummer korrigieren.`
        );
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(shipment.shipDate))) {
      problems.push('Versanddatum ist ungültig. Erwartet wird das Format JJJJ-MM-TT.');
    }

    // The shop never ships FROM a Packstation, so the shipper is always a street address.
    problems.push(...this.validateParcelDeParty(shipment.shipper, 'Absenderadresse', { isLocker: false }));
    problems.push(
      ...this.validateParcelDeParty(
        shipment.consignee,
        'Empfängeradresse',
        typeof options.consigneeIsLocker === 'boolean' ? { isLocker: options.consigneeIsLocker } : {}
      )
    );

    const weight = Number(shipment?.details?.weight?.value);
    if (!Number.isFinite(weight) || weight <= 0) {
      problems.push('Gewicht fehlt oder ist ungültig. Bitte ein Gewicht größer als 0 kg angeben.');
    } else if (weight > 31.5) {
      problems.push(`Gewicht ${weight} kg überschreitet das DHL-Maximum von 31,5 kg.`);
    }

    // `details.dim` is optional and only present when a caller opted in explicitly
    // (see buildParcelDeDimensions). When it IS present it must be complete and sane.
    const dim = shipment?.details?.dim;
    if (dim) {
      const edges = [
        ['Länge', dim.length],
        ['Breite', dim.width],
        ['Höhe', dim.height]
      ];
      edges.forEach(([edgeLabel, value]) => {
        const edge = Number(value);
        if (!Number.isFinite(edge) || edge <= 0) {
          problems.push(`Paketmaß ${edgeLabel} fehlt oder ist ungültig. Bitte einen Wert größer als 0 cm angeben.`);
        } else if (edge > DHLService.MAX_PARCEL_EDGE_CM) {
          problems.push(
            `Paketmaß ${edgeLabel} ${edge} cm überschreitet das DHL-Maximum von ${DHLService.MAX_PARCEL_EDGE_CM} cm.`
          );
        }
      });
      if (String(dim.uom || '').toLowerCase() !== 'cm') {
        problems.push('Paketmaße müssen in Zentimetern (cm) angegeben werden.');
      }
    }

    return problems;
  }

  /** Longest edge DHL accepts for a national parcel (V01PAK), in centimetres. */
  static MAX_PARCEL_EDGE_CM = 120;

  /**
   * Build the OPTIONAL `details.dim` block.
   *
   * Dimensions were never part of the Parcel DE payload this service sends
   * (server/DHL_API_INTEGRATION_DOCUMENTATION.md documents length/width/height only as
   * dialog inputs and its example request contains no `dim`), and both label dialogs
   * prefill 20/15/10 defaults that staff never consciously confirm. Sending those on
   * every label would be an unvalidated behaviour change towards DHL – it can be
   * rejected and it can change volumetric pricing. The block is therefore emitted ONLY
   * when a caller explicitly opts in with `sendDimensions: true` AND supplies three
   * usable edges. No UI sets that flag today, so the payload stays byte-for-byte the
   * one DHL has been accepting.
   *
   * @returns {{dim: Object}|{}} spreadable fragment for `details`
   */
  static buildParcelDeDimensions(shipmentData = {}) {
    if (shipmentData?.sendDimensions !== true) return {};

    const [length, width, height] = [shipmentData.length, shipmentData.width, shipmentData.height]
      .map((value) => Number(value));

    const usable = [length, width, height].every(
      (value) => Number.isFinite(value) && value > 0 && value <= DHLService.MAX_PARCEL_EDGE_CM
    );

    if (!usable) {
      throw new ShippingLabelError(
        'Paketmaße sind unvollständig oder ungültig. Bitte Länge, Breite und Höhe in Zentimetern angeben ' +
        `(größer als 0 und höchstens ${DHLService.MAX_PARCEL_EDGE_CM} cm).`,
        { code: 'PARCEL_DIMENSIONS_INVALID', status: 422, retryable: false }
      );
    }

    return { dim: { uom: 'cm', length, width, height } };
  }

  /**
   * DHL answers the Parcel DE Shipping v2 "orders" call with HTTP 207 when individual
   * shipments fail. Axios treats 207 as success, so the per-item status must be
   * inspected explicitly – otherwise DHL's real validation text is lost and the user
   * only sees "DHL hat keine Sendungsnummer zurückgegeben."
   * @returns {Object|null} an axios-style 400 body when a shipment failed, else null
   */
  static extractParcelDeFailure(data) {
    if (!data || typeof data !== 'object') return null;

    const items = Array.isArray(data.items) ? data.items : [];
    const itemStatus = (item) => Number(item?.sstatus?.statusCode ?? item?.status?.statusCode ?? 200);
    // Only hard failures – DHL uses 207 on an item for "weak validation", where the
    // label IS created and must not be rejected here.
    const failedItems = items.filter((item) => itemStatus(item) >= 400);
    const envelopeStatus = Number(data?.status?.statusCode ?? 200);

    if (failedItems.length === 0 && envelopeStatus < 400) return null;

    return {
      title: data?.status?.title || '',
      detail: data?.status?.detail || data?.status?.statusText || '',
      items: failedItems.length > 0 ? failedItems : items
    };
  }

  static getParcelDEConfig(dhlIntegration) {
    const metadata = dhlIntegration?.metadata || {};
    const settings = dhlIntegration?.settings || {};
    const credentials = dhlIntegration?.credentials || {};

    // A CONFIGURED environment wins. The previous expression
    //   `metadata.environment || settings.environment || endpoint.includes('sandbox') ? 'sandbox' : 'production'`
    // made the whole `||` chain the ternary condition, so an integration explicitly set
    // to 'production' resolved to 'sandbox' (and, without an endpoint, to the sandbox
    // base URL) – every "live" label would silently have been a sandbox label.
    const configuredEnvironment = String(metadata.environment || settings.environment || '')
      .trim()
      .toLowerCase();
    // Only the endpoint decides when nothing is configured (unchanged default).
    const endpointLooksLikeSandbox = `${credentials.apiEndpoint || ''} ${dhlIntegration?.endpoint || ''}`
      .toLowerCase()
      .includes('sandbox');

    let inferredEnvironment;
    if (['production', 'prod', 'live'].includes(configuredEnvironment)) {
      inferredEnvironment = 'production';
    } else if (configuredEnvironment) {
      // Any other explicit value (sandbox, test, staging …) is treated as non-live.
      inferredEnvironment = 'sandbox';
    } else {
      inferredEnvironment = endpointLooksLikeSandbox ? 'sandbox' : 'production';
    }

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
        credentials.username ||
        metadata.username ||
        settings.username ||
        process.env.DHL_BC_USERNAME ||
        process.env.DHL_BUSINESS_CUSTOMER_USERNAME ||
        '',
      password:
        credentials.password ||
        metadata.password ||
        settings.password ||
        process.env.DHL_BC_PASSWORD ||
        process.env.DHL_BUSINESS_CUSTOMER_PASSWORD ||
        '',
      shippingAuthUrl:
        credentials.shippingAuthUrl ||
        metadata.shippingAuthUrl ||
        '',
      shippingGrantType:
        credentials.shippingGrantType ||
        metadata.shippingGrantType ||
        'password',
      tracking: {
        baseUrl: credentials.trackingBaseUrl || metadata.trackingBaseUrl || '',
        username: credentials.trackingUsername || metadata.trackingUsername || '',
        password: credentials.trackingPassword || metadata.trackingPassword || '',
        authType: credentials.trackingAuthType || metadata.trackingAuthType || 'basic'
      },
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

  /** Error codes whose message is already German and user-facing. */
  static GERMAN_LABEL_CODES = new Set([
    'DHL_API_UNAVAILABLE',
    'PACKSTATION_INVALID',
    'POSTAL_CODE_INVALID',
    'SERVICE_TYPE_UNAVAILABLE',
    'RECIPIENT_ADDRESS_INVALID'
  ]);

  /**
   * German user-facing texts for the operator-oriented English diagnostics. The English
   * originals stay on the diagnostic/test-connection path (admins match them against
   * DHL's own documentation) and are carried in `details` on the label path.
   */
  static GERMAN_LABEL_MESSAGES = {
    DHL_401_INVALID_CLIENT:
      'DHL hat die Zugangsdaten abgelehnt (invalid_client). Bitte Client-ID und Client-Secret der DHL-Integration prüfen.',
    DHL_401_INVALID_GRANT:
      'DHL hat die Zugangsdaten abgelehnt (invalid_grant). Bitte Benutzername und Passwort des DHL-Geschäftskundenportals prüfen.',
    DHL_401_UNAUTHORIZED_CLIENT:
      'Die DHL-App ist für diese API bzw. Umgebung nicht freigeschaltet (unauthorized_client).',
    DHL_401_AUTH:
      'DHL hat die Anmeldung abgelehnt (401). Bitte Zugangsdaten und Umgebung der DHL-Integration prüfen.',
    DHL_403_FORBIDDEN:
      'DHL verweigert den Zugriff (403). Die App oder der Benutzer ist nicht für Parcel DE Shipping freigeschaltet.',
    DHL_UNDEFINED_RESOURCE:
      'Der konfigurierte DHL-Endpunkt ist ungültig. Erwartet wird /parcel/de/shipping/v2/orders.',
    // DHL answers a rejected payload with an ENGLISH title/detail plus English validation
    // messages. Those are operator diagnostics and belong in `details`, never in the text
    // shown to staff – hence a German message here instead of passing DHL's text through.
    DHL_400_BAD_REQUEST:
      'DHL hat die Versanddaten abgelehnt. Bitte Empfänger- und Absenderadresse sowie die Paketdaten prüfen.'
  };

  /**
   * @param {Error} error
   * @param {Object} [options]
   * @param {'diagnostic'|'label'} [options.context] 'label' guarantees a German,
   *   user-facing message and moves the technical text into `details`. The default
   *   'diagnostic' keeps the operator-facing English used by Test Connection.
   */
  static getDhlErrorDetails(error, { context = 'diagnostic' } = {}) {
    const classified = this.classifyDhlError(error);
    if (context !== 'label') return classified;
    return this.toGermanLabelError(classified, error);
  }

  static toGermanLabelError(classified, error) {
    if (error instanceof ShippingLabelError) return classified;
    if (this.GERMAN_LABEL_CODES.has(classified.code)) return classified;

    const german = this.GERMAN_LABEL_MESSAGES[classified.code];
    const technical = String(classified.message || error?.message || '').trim();
    const details = Array.isArray(classified.details) ? [...classified.details] : [];
    if (technical) details.push(technical);

    return {
      ...classified,
      message:
        german ||
        'Versandlabel konnte nicht erstellt werden. Bitte die DHL-Einstellungen und die Adressdaten prüfen.',
      details
    };
  }

  static classifyDhlError(error) {
    if (error instanceof ShippingLabelError) {
      return {
        message: error.message,
        code: error.code,
        status: error.status,
        retryable: error.retryable,
        details: error.details
      };
    }

    const status = error?.response?.status;
    const data = error?.response?.data;
    const title = data?.title || data?.error || data?.message || '';
    const detail = data?.detail || data?.description || '';
    const oauthError = data?.error || '';
    const oauthErrorDescription = data?.error_description || data?.errorDescription || '';

    if (!status && ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ERR_NETWORK'].includes(error?.code)) {
      return {
        message: 'DHL API nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.',
        code: 'DHL_API_UNAVAILABLE',
        status: 503,
        retryable: true
      };
    }

    if (status >= 500) {
      return {
        message: 'DHL API ist vorübergehend nicht verfügbar. Bitte erneut versuchen.',
        code: 'DHL_API_UNAVAILABLE',
        status: 503,
        retryable: true
      };
    }

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

      const combinedMessage = `${detail} ${title} ${validationMessages.join(' ')}`.toLowerCase();
      if (/packstation|locker/.test(combinedMessage)) {
        return {
          message: 'Packstationsnummer oder Postnummer ist ungültig.',
          code: 'PACKSTATION_INVALID',
          status: 422,
          retryable: false,
          details: validationMessages
        };
      }
      if (/postal|postcode|zip/.test(combinedMessage)) {
        return {
          message: 'Die PLZ fehlt oder ist ungültig.',
          code: 'POSTAL_CODE_INVALID',
          status: 422,
          retryable: false,
          details: validationMessages
        };
      }
      if (/product|service/.test(combinedMessage)) {
        return {
          message: 'Der gewählte DHL Service Type ist nicht verfügbar.',
          code: 'SERVICE_TYPE_UNAVAILABLE',
          status: 422,
          retryable: false,
          details: validationMessages
        };
      }
      if (/address|street|city|consignee/.test(combinedMessage)) {
        return {
          message: 'Die Empfängeradresse ist unvollständig oder ungültig.',
          code: 'RECIPIENT_ADDRESS_INVALID',
          status: 422,
          retryable: false,
          details: validationMessages
        };
      }

      return {
        message: `${detail || title || 'DHL hat die Versanddaten abgelehnt.'}${validationText}`.trim(),
        code: 'DHL_400_BAD_REQUEST',
        status: 422,
        retryable: false,
        details: validationMessages
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
      code: `DHL_${status || 'REQUEST_ERROR'}`,
      status: status || 500,
      retryable: status === 408 || status === 429
    };
  }

  static async getAccessToken(config, { context = 'diagnostic' } = {}) {
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
      throw new ShippingLabelError(
        `DHL-Zugangsdaten sind unvollständig. Fehlende Felder: ${missingFields.join(', ')}. Bitte unter Systemkonfiguration → Integrationen ergänzen.`,
        { code: 'DHL_CREDENTIALS_INCOMPLETE', status: 503, retryable: false, details: missingFields }
      );
    }

    const cacheKey = `${config.baseUrl}|${config.clientId}|${config.username}`;
    const cachedToken = DHLService.tokenCache.get(cacheKey);
    const now = Date.now();

    if (cachedToken && cachedToken.expiresAt > now + 60000) {
      return cachedToken.token;
    }

    const grantType = config.shippingGrantType || 'password';
    const form = new URLSearchParams();
    form.append('grant_type', grantType);
    form.append('username', config.username);
    form.append('password', config.password);
    form.append('client_id', config.clientId);
    form.append('client_secret', config.clientSecret);

    const tokenUrl = config.shippingAuthUrl ||
      `${config.baseUrl}/parcel/de/account/auth/ropc/v1/token`;

    try {
      const response = await axios.post(
        tokenUrl,
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
      const dhlError = this.getDhlErrorDetails(error, { context });
      throw new ShippingLabelError(dhlError.message, {
        code: dhlError.code,
        status: dhlError.status,
        retryable: dhlError.retryable,
        details: dhlError.details
      });
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
        throw new ShippingLabelError(
          'Die Systemkonfiguration wurde nicht gefunden. Bitte die DHL-Integration unter Systemkonfiguration → Integrationen einrichten.',
          { code: 'DHL_NOT_CONFIGURED', status: 503, retryable: false }
        );
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
        throw new ShippingLabelError(
          'Es ist keine aktive DHL-Versandintegration konfiguriert. Bitte unter Systemkonfiguration → Integrationen einrichten und aktivieren.',
          { code: 'DHL_NOT_CONFIGURED', status: 503, retryable: false }
        );
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
    let labelCreationClaimed = false;

    try {
      // Get DHL configuration
      const dhlConfig = await this.getDHLConfig();

      // Retrieve order details with full customer profile including invoice address
      const order = await Order.findById(orderId).populate('customerId', 'name email phone invoiceAddress paymentAddress');

      if (!order) {
        console.error('DHLService: Order not found:', orderId);
        throw new ShippingLabelError('Auftrag wurde nicht gefunden.', {
          code: 'ORDER_NOT_FOUND',
          status: 404
        });
      }

      console.log('DHLService: Order found:', order.orderNumber);

      // Repeated requests must reuse the existing shipment instead of creating another label.
      if (order.shippingLabelUrl) {
        return {
          success: true,
          trackingNumber: order.trackingNumber,
          labelUrl: order.shippingLabelUrl,
          estimatedDelivery: order.estimatedDelivery,
          shipmentId: order.trackingNumber,
          alreadyExists: true,
        };
      }

      if (order.trackingNumber || order.shippingStatus === 'label-created') {
        throw new ShippingLabelError(
          `Die DHL-Sendung wurde bereits angelegt${order.trackingNumber ? ` (Tracking: ${order.trackingNumber})` : ''}, aber das PDF-Label fehlt. Bitte DHL bzw. die Versandkonfiguration prüfen, bevor ein neues Label erzeugt wird.`,
          {
            code: 'EXISTING_SHIPMENT_LABEL_MISSING',
            status: 409,
            retryable: false
          }
        );
      }

      // Atomically reserve label creation so concurrent requests cannot both reach DHL.
      const claimedOrder = await Order.findOneAndUpdate(
        {
          _id: orderId,
          shippingLabelUrl: { $in: ['', null] },
          trackingNumber: { $in: ['', null] },
          shippingStatus: { $ne: 'label-created' },
          shippingLabelCreationInProgress: { $ne: true },
        },
        { $set: { shippingLabelCreationInProgress: true } },
        { new: true }
      );

      if (!claimedOrder) {
        throw new ShippingLabelError('Das Versandlabel wird bereits erstellt. Bitte kurz warten und erneut versuchen.', {
          code: 'LABEL_CREATION_IN_PROGRESS',
          status: 409,
          retryable: true
        });
      }
      labelCreationClaimed = true;

      // Use invoice address as fallback if shipping address is not complete
      // Convert Mongoose subdocument to plain object to access properties
      const customer = order.customerId?.toObject ? order.customerId.toObject() : order.customerId;
      const invoiceAddress = customer?.invoiceAddress || {};
      const paymentAddress = customer?.paymentAddress || {};
      console.log('DHLService: Order shippingAddress:', JSON.stringify(order.shippingAddress || {}, null, 2));
      console.log('DHLService: Customer invoice address:', JSON.stringify(invoiceAddress, null, 2));
      console.log('DHLService: Customer payment address:', JSON.stringify(paymentAddress, null, 2));

      // Validate shipping address is complete, fall back to payment then invoice address if needed
      const receiverCity = shipmentData.receiverCity || order.shippingAddress?.city || paymentAddress.city || invoiceAddress.city;
      const receiverPostalCode = shipmentData.receiverPostalCode || order.shippingAddress?.zipCode || paymentAddress.zipCode || invoiceAddress.zipCode;
      // The shop ships from Germany – never invent a foreign default country.
      const receiverCountry = shipmentData.receiverCountry || order.shippingAddress?.country || paymentAddress.country || invoiceAddress.country || 'DE';

      // Packstation delivery must be an explicit decision of the CALLER. Inbound labels
      // (customer -> shop, built by bookingService/complaintRoutes) supply their own
      // receiver address; deriving the locker flag from the order alone used to address
      // those labels to the CUSTOMER's Packstation with the SHOP's PLZ/Ort.
      const requestedDeliveryType = String(shipmentData.deliveryType || '').trim().toLowerCase();
      const callerSuppliedReceiverAddress = String(shipmentData.receiverAddress || '').trim() !== '';
      const isPackstation =
        requestedDeliveryType === 'packstation' ||
        (!requestedDeliveryType &&
          !callerSuppliedReceiverAddress &&
          order.shippingAddress?.deliveryType === 'packstation');

      // Explicitly supplied values win over the stored order so staff corrections take effect.
      const packstationNo = String(
        shipmentData.packstationNumber || shipmentData.lockerID || order.shippingAddress?.packstationNumber || ''
      ).trim();
      const postNo = String(shipmentData.postNumber || order.shippingAddress?.postNumber || '').trim();

      // DHL needs street and house number in separate fields. The checkout collects one
      // combined "Straße und Hausnummer" input, so it has to be split – but street and
      // house number are resolved as a PAIR from a single address: falling back field by
      // field used to pair one address' street with another address' house number.
      const receiverPair = this.resolveStreetAndHouse([
        { street: shipmentData.receiverAddress, house: shipmentData.receiverNumber, source: 'request' },
        { street: order.shippingAddress?.street, house: order.shippingAddress?.number, source: 'order.shippingAddress' },
        { street: paymentAddress.street, house: paymentAddress.number, source: 'customer.paymentAddress' },
        { street: invoiceAddress.street, house: invoiceAddress.number, source: 'customer.invoiceAddress' }
      ]);
      const receiverStreet = receiverPair.street;
      const receiverHouse = receiverPair.house;

      // Check if required address fields are missing or empty
      if (!isPackstation && (!receiverStreet || receiverStreet.trim() === '')) {
        console.error('DHLService: Missing receiver street address');
        throw new ShippingLabelError('Empfängeradresse unvollständig: Straße fehlt.', {
          code: 'RECIPIENT_STREET_REQUIRED',
          status: 422
        });
      }

      if (!receiverCity || receiverCity.trim() === '') {
        console.error('DHLService: Missing receiver city');
        throw new ShippingLabelError('Empfängeradresse unvollständig: Ort fehlt.', {
          code: 'RECIPIENT_CITY_REQUIRED',
          status: 422
        });
      }

      if (!receiverPostalCode || receiverPostalCode.trim() === '') {
        console.error('DHLService: Missing receiver postal code');
        throw new ShippingLabelError('Empfängeradresse unvollständig: PLZ fehlt.', {
          code: 'RECIPIENT_POSTAL_CODE_REQUIRED',
          status: 422
        });
      }

      if (isPackstation && !/^\d{3}$/.test(packstationNo)) {
        throw new ShippingLabelError('Packstationsnummer ungültig. Erwartet werden genau 3 Ziffern.', {
          code: 'PACKSTATION_NUMBER_INVALID',
          status: 422
        });
      }

      if (isPackstation && !/^\d{6,10}$/.test(postNo)) {
        throw new ShippingLabelError('Postnummer ungültig. Erwartet werden 6 bis 10 Ziffern.', {
          code: 'POST_NUMBER_INVALID',
          status: 422
        });
      }

      console.log('DHLService: Shipping address validated successfully');

      // Generate unique shipment ID (UUID v4 as required by DHL Parcel API)
      const shipmentId = crypto.randomUUID();
      console.log('DHLService: Generated shipment ID:', shipmentId);

      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);

      if (!parcelDeConfig.enabledApis.parcelDeShipping) {
        throw new ShippingLabelError(
          'Die DHL-Versand-API (Parcel DE Shipping) ist in den Integrationseinstellungen deaktiviert.',
          { code: 'DHL_SHIPPING_DISABLED', status: 503, retryable: false }
        );
      }

      // Get account ID from settings or use default
      const accountId =
        shipmentData.accountNumber ||
        dhlConfig.settings?.accountId ||
        dhlConfig.settings?.accountNumber ||
        parcelDeConfig.accountNumber;

      if (!accountId) {
        console.error('DHLService: Account ID not configured');
        throw new ShippingLabelError(
          'Die DHL Abrechnungsnummer (EKP) fehlt in den Integrationseinstellungen.',
          { code: 'DHL_BILLING_NUMBER_MISSING', status: 503, retryable: false }
        );
      }

      // Use receiver name from shipmentData if provided, otherwise use customer name
      const receiverName = shipmentData.receiverName || customer?.name || 'Customer';

      // `shipperFromConfiguration: true` means "use the configured shop address, ignore
      // every shipper field in this request". The admin-only integration settings are not
      // readable by staff, so a staff-facing dialog cannot send the shop address itself –
      // and the booking endpoint merges its OWN default shipper (the customer!) into every
      // request, which would otherwise produce a customer-to-customer label.
      const useConfiguredShipper = shipmentData.shipperFromConfiguration === true;
      const shipperSettings = dhlConfig.settings || {};

      // The dialog sends a single "Address" field (shipperAddress); older callers send the
      // already split shipperStreet/shipperNumber. Accept both – but, exactly like the
      // consignee, street and house number come from ONE source: a caller-supplied shop
      // street must never be completed with the CONFIGURED house number (or, through the
      // booking endpoint's field-by-field merge, with the CUSTOMER's house number).
      const shipperCandidates = [
        {
          street: shipperSettings.shipperStreet,
          house: shipperSettings.shipperNumber,
          source: 'integration.settings'
        }
      ];
      if (!useConfiguredShipper) {
        shipperCandidates.unshift({
          street: shipmentData.shipperStreet || shipmentData.shipperAddress,
          house: shipmentData.shipperNumber,
          source: 'request'
        });
      }
      const shipperPair = this.resolveStreetAndHouse(shipperCandidates);
      const shipperStreet = shipperPair.street;
      const shipperHouse = shipperPair.house;

      // Same rule for the remaining shipper fields: with the flag set, NOTHING from the
      // request is used, so no half of the shop address can come from somewhere else.
      const shipperFrom = (requestValue, settingsValue, fallback = '') =>
        String((useConfiguredShipper ? '' : requestValue) || settingsValue || fallback).trim();

      // Pick the first candidate that survives sanitising, so a blank override from the
      // dialog does not shadow a usable stored value (and "" is never sent to DHL).
      const firstEmail = (...values) => values.map((value) => this.sanitizeEmail(value)).find(Boolean) || '';
      const firstPhone = (...values) => values.map((value) => this.sanitizePhone(value)).find(Boolean) || '';

      const shipperContact = {
        email: useConfiguredShipper
          ? firstEmail(shipperSettings.shipperEmail)
          : firstEmail(shipmentData.shipperEmail, shipperSettings.shipperEmail),
        phone: useConfiguredShipper
          ? firstPhone(shipperSettings.shipperPhone)
          : firstPhone(shipmentData.shipperPhone, shipperSettings.shipperPhone)
      };
      const receiverContact = {
        email: firstEmail(shipmentData.receiverEmail, customer?.email),
        phone: firstPhone(shipmentData.receiverPhone, customer?.phone)
      };

      // Optional `details.dim`, only for callers that explicitly opt in – see
      // buildParcelDeDimensions for why this is not derived from the dialog defaults.
      const dimensionsFragment = this.buildParcelDeDimensions(shipmentData);

      const singleShipment = shipmentData?.parcelDeOrderPayload || {
        product: this.resolveShippingProduct(shipmentData, parcelDeConfig.product),
        billingNumber: accountId,
        shipDate: shipmentData.shipmentDate || new Date().toISOString().slice(0, 10),
        shipper: {
          // No hard-coded company name: an unconfigured shop must fail with
          // "Absenderadresse: Name fehlt." instead of shipping under someone else's name.
          name1: shipperFrom(shipmentData.shipperName, shipperSettings.shipperCompany),
          addressStreet: shipperStreet,
          addressHouse: shipperHouse,
          postalCode: shipperFrom(shipmentData.shipperPostalCode, shipperSettings.shipperPostalCode),
          city: shipperFrom(shipmentData.shipperCity, shipperSettings.shipperCity),
          country: this.countryCodeToIso3(shipperFrom(shipmentData.shipperCountry, shipperSettings.shipperCountry, 'DE')),
          ...(shipperContact.email ? { email: shipperContact.email } : {}),
          ...(shipperContact.phone ? { phone: shipperContact.phone } : {})
        },
        consignee: (() => {
          const contact = {
            ...(receiverContact.email ? { email: receiverContact.email } : {}),
            ...(receiverContact.phone ? { phone: receiverContact.phone } : {})
          };

          if (isPackstation) {
            // DHL Parcel DE Shipping v2 – Packstation delivery
            return {
              name1: receiverName,
              lockerID: packstationNo,
              postNumber: postNo,
              postalCode: receiverPostalCode,
              city: receiverCity,
              country: this.countryCodeToIso3(receiverCountry),
              ...contact
            };
          }

          // Regular address delivery
          return {
            name1: receiverName,
            addressStreet: receiverStreet,
            addressHouse: receiverHouse,
            postalCode: receiverPostalCode,
            city: receiverCity,
            country: this.countryCodeToIso3(receiverCountry),
            ...contact
          };
        })(),
        details: {
          weight: {
            uom: 'kg',
            value: Number(shipmentData.weight || 1)
          },
          ...dimensionsFragment
        }
      };

      // Fail with a precise German message BEFORE calling DHL – an invalid payload would
      // otherwise come back as an opaque DHL validation error (or a silently wrong label).
      // A caller supplying a raw `parcelDeOrderPayload` owns its shape and is not checked.
      const payloadProblems = shipmentData?.parcelDeOrderPayload
        ? []
        : this.validateParcelDeShipment(singleShipment, { consigneeIsLocker: isPackstation });
      if (payloadProblems.length > 0) {
        console.error('DHLService: Shipment payload rejected by pre-flight validation:', payloadProblems);
        throw new ShippingLabelError(
          `Versanddaten unvollständig oder ungültig: ${payloadProblems[0]}`,
          {
            code: 'DHL_PAYLOAD_INVALID',
            status: 422,
            retryable: false,
            details: payloadProblems
          }
        );
      }

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

      const accessToken = await this.getAccessToken(parcelDeConfig, { context: 'label' });

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

      console.log('DHLService: Response data:', JSON.stringify(response.data, null, 2));

      // DHL uses HTTP 207 for per-shipment failures; axios treats that as success, so the
      // envelope has to be inspected or DHL's real validation text would be lost.
      const itemFailure = this.extractParcelDeFailure(response.data);
      if (itemFailure) {
        const multiStatusError = this.getDhlErrorDetails(
          { response: { status: 400, data: itemFailure } },
          { context: 'label' }
        );
        throw new ShippingLabelError(multiStatusError.message, {
          code: multiStatusError.code,
          status: multiStatusError.status,
          retryable: multiStatusError.retryable,
          details: multiStatusError.details
        });
      }

      console.log('DHLService: Shipment created successfully');

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

      if (!trackingNumber && !pieceTrackerCode && !returnedShipmentId) {
        throw new ShippingLabelError('DHL hat keine Sendungsnummer zurückgegeben. Es wurde kein Label gespeichert.', {
          code: 'DHL_TRACKING_NUMBER_MISSING',
          status: 502,
          retryable: true
        });
      }

      if (!labelUrl) {
        throw new ShippingLabelError('DHL hat kein PDF-Label zurückgegeben. Es wurde kein Label gespeichert.', {
          code: 'DHL_LABEL_MISSING',
          status: 502,
          retryable: true
        });
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
        description: 'DHL-Versandlabel wurde erstellt'
      });

      // Add timeline entry
      order.timeline.push({
        status: 'Shipping Label Created',
        description: `DHL-Versandlabel erstellt. Sendungsnummer: ${order.trackingNumber}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'DHL Parcel Integration'
      });

      await order.save();

      // The document was loaded before the claim was written, so the flag has to be
      // released atomically – otherwise a restart leaves the order locked forever.
      await Order.updateOne(
        { _id: orderId, shippingLabelCreationInProgress: true },
        { $set: { shippingLabelCreationInProgress: false } }
      ).catch((releaseError) => {
        console.error('DHLService: Could not release label creation lock:', releaseError.message);
      });

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
      if (labelCreationClaimed) {
        await Order.updateOne(
          { _id: orderId, shippingLabelCreationInProgress: true },
          { $set: { shippingLabelCreationInProgress: false } }
        ).catch((releaseError) => {
          console.error('DHLService: Could not release label creation lock:', releaseError.message);
        });
      }
      console.error('DHLService: Error creating shipment:', error);
      console.error('DHLService: Error response data:', error.response?.data);
      console.error('DHLService: Error response status:', error.response?.status);
      console.error('DHLService: Error stack trace:', error.stack);

      const dhlError = this.getDhlErrorDetails(error, { context: 'label' });

      throw new ShippingLabelError(dhlError.message || 'Versandlabel konnte nicht erstellt werden.', {
        code: dhlError.code,
        status: dhlError.status,
        retryable: dhlError.retryable,
        details: dhlError.details
      });
    }
  }

  /**
   * Get tracking information for a shipment
   * @param {string} trackingNumber - DHL tracking number
   * @returns {Promise<Object>} Tracking information
   */
  /** Deutsche Bezeichnung eines Versandstatus - kein roher Enum-Wert im Verlauf. */
  static shippingStatusLabel(status) {
    const labels = {
      'pending': 'In Vorbereitung',
      'label-created': 'Label erstellt',
      'shipped': 'Versendet',
      'in-transit': 'In Zustellung',
      'out-for-delivery': 'Heute in Zustellung',
      'delivered': 'Zugestellt',
      'failed': 'Fehlgeschlagen',
    };
    return labels[String(status || '')] || String(status || 'Unbekannt');
  }

  static async getTrackingInfo(trackingNumber) {
    console.log('DHLService: Getting tracking info for:', trackingNumber);

    try {
      const dhlConfig = await this.getDHLConfig();
      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);

      if (!parcelDeConfig.enabledApis.parcelDeTracking) {
        // Diese Meldung wird von den Routen als error.message an die Oberflaeche
        // durchgereicht - sie muss deutsch sein.
        throw new Error('Die DHL-Sendungsverfolgung ist in den Integrationseinstellungen deaktiviert.');
      }

      const trackingCreds = parcelDeConfig.tracking || {};
      const trackingBaseUrl = trackingCreds.baseUrl || '';
      const trackingUsername = trackingCreds.username || '';
      const trackingPassword = trackingCreds.password || '';
      const trackingAuthType = (trackingCreds.authType || 'basic').toLowerCase();

      if (trackingBaseUrl && trackingUsername) {
        // cig.dhl.de – Basic Authentication
        const authHeader = trackingAuthType === 'basic'
          ? 'Basic ' + Buffer.from(`${trackingUsername}:${trackingPassword}`).toString('base64')
          : `Bearer ${trackingUsername}`;

        const response = await axios.get(trackingBaseUrl, {
          params: { xml: `<data appname="zt12345" password="${trackingPassword}" request="get-status-for-public-user" language-code="de"><data piece-code="${trackingNumber}"/></data>` },
          headers: { Authorization: authHeader },
          timeout: 15000,
          validateStatus: () => true
        });

        const rawXml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        return {
          success: response.status < 400,
          trackingNumber,
          status: response.status < 400 ? 'transit' : 'unknown',
          statusCodeRaw: String(response.status),
          description: rawXml.substring(0, 500),
          estimatedDelivery: null,
          events: [],
          carrier: 'DHL',
          liveApi: {
            provider: 'DHL',
            source: 'cig.dhl.de/sendungsverfolgung',
            status: response.status,
            raw: rawXml.substring(0, 2000)
          }
        };
      }

      // Fallback: Unified DHL Tracking API with API key header
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
        throw new Error('Zu dieser Sendungsnummer liegen bei DHL keine Sendungsdaten vor.');
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
        description: shipmentData.status?.description || 'Kein Status verfügbar',
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
      throw new Error(error.response?.data?.detail || error.message || 'Die Sendungsverfolgung konnte nicht abgerufen werden.');
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
        throw new Error('Auftrag wurde nicht gefunden.');
      }

      if (!order.trackingNumber) {
        throw new Error('Für diesen Auftrag ist keine Sendungsnummer hinterlegt.');
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
          status: `Versandstatus: ${DHLService.shippingStatusLabel(newStatus)}`,
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
        ? 'credentials'
        : ((process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing'));
      const passwordSource = auth.password
        ? 'credentials'
        : ((process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing'));

      const shippingAuthUrl = auth.shippingAuthUrl ||
        `${endpoint}/parcel/de/account/auth/ropc/v1/token`;
      const shippingGrantType = auth.shippingGrantType || 'password';

      const tokenConfig = {
        baseUrl: endpoint,
        clientId: apiKey,
        clientSecret: apiSecret,
        username: auth.username || process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME || (isSandbox ? 'user-valid' : ''),
        password: auth.password || process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD || (isSandbox ? 'SandboxPasswort2023!' : ''),
        shippingAuthUrl,
        shippingGrantType
      };

      const debug = {
        environment: isSandbox ? 'sandbox' : 'production',
        endpoint,
        tokenEndpoint: shippingAuthUrl,
        probeEndpoint: `${endpoint}/parcel/de/shipping/v2`,
        authFlow: `oauth2-ropc (grant_type=${shippingGrantType})`,
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
          message: `Die DHL-Versand-API ist nicht erreichbar (Status ${shippingProbe.status || 'n/a'}).`,
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
            message: `Die DHL-Abhol-API (Pickup) ist nicht erreichbar (Status ${pickupProbe.status || 'n/a'}). Bitte den konfigurierten Pickup-Probe-Pfad prüfen.`,
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
      const password = auth.password || process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD || (isSandbox ? 'SandboxPasswort2023!' : '');
      const resolvedShippingAuthUrl = auth.shippingAuthUrl || `${endpoint}/parcel/de/account/auth/ropc/v1/token`;
      const resolvedGrantType = auth.shippingGrantType || 'password';

      const debug = {
        environment: isSandbox ? 'sandbox' : 'production',
        endpoint,
        tokenEndpoint: resolvedShippingAuthUrl,
        probeEndpoint: `${endpoint}/parcel/de/shipping/v2`,
        authFlow: `oauth2-ropc (grant_type=${resolvedGrantType})`,
        pickupEnabled: Boolean(options?.enabledApis?.parcelDePickup),
        hasClientId: Boolean(apiKey),
        hasClientSecret: Boolean(apiSecret),
        hasUsername: Boolean(username),
        hasPassword: Boolean(password),
        clientIdMasked: this.maskValue(apiKey),
        usernameMasked: this.maskValue(username),
        usernameSource: auth.username ? 'credentials' : ((process.env.DHL_BC_USERNAME || process.env.DHL_BUSINESS_CUSTOMER_USERNAME) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing')),
        passwordSource: auth.password ? 'credentials' : ((process.env.DHL_BC_PASSWORD || process.env.DHL_BUSINESS_CUSTOMER_PASSWORD) ? 'environment-variable' : (isSandbox ? 'sandbox-default' : 'missing')),
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
