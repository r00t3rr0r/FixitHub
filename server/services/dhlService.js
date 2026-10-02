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

  /**
   * DHL-Produkte, die die Oberflaeche anbietet (client/src/api/shipping.ts DHL_PRODUCTS).
   * Ob die Liste reduziert wird (z. B. nur V01PAK), ist eine offene Geschaeftsentscheidung.
   */
  static OFFERED_PRODUCTS = ['V01PAK', 'V53WPAK', 'V54EPAK'];

  /** Deutsche Bezeichnungen fuer Meldungen (wie client/src/api/shipping.ts DHL_PRODUCTS). */
  static PRODUCT_LABELS = { V01PAK: 'DHL Paket – Inland', V53WPAK: 'DHL Paket International', V54EPAK: 'DHL Europaket' };

  /** Alte Kurzcodes aelterer Datensaetze/Dialoge (P/N/Y) -> heutige Produktcodes. */
  static LEGACY_PRODUCT_CODES = { P: 'V01PAK', N: 'V53WPAK', Y: 'V54EPAK' };

  static normalizeProductCode(value) {
    const code = String(value || '').trim().toUpperCase();
    return this.LEGACY_PRODUCT_CODES[code] || code;
  }

  /**
   * Produkt einer Sendung. Ohne Angabe gilt das in der Integration konfigurierte Produkt.
   * Eine Angabe wird normalisiert (alte Kurzcodes P/N/Y, Kleinschreibung) und muss eines der
   * angebotenen Produkte oder das konfigurierte Produkt sein. Ein anderer Code wird mit 400
   * abgelehnt - VOR jedem DHL-Aufruf. Er wird weder still durch ein anderes Produkt ersetzt
   * (der Kunde bekaeme ein Produkt, das niemand gewaehlt hat) noch ungeprueft an DHL gesendet.
   */
  static resolveShippingProduct(shipmentData, configuredProduct) {
    const data = shipmentData || {};
    const rawRequested = data.product !== undefined && data.product !== null && String(data.product).trim() !== ''
      ? data.product
      : data.serviceType;
    const configured = this.normalizeProductCode(configuredProduct);
    const requestedProduct = this.normalizeProductCode(rawRequested);
    if (!requestedProduct) {
      return configured || configuredProduct;
    }
    if (this.OFFERED_PRODUCTS.includes(requestedProduct) || (configured && requestedProduct === configured)) {
      return requestedProduct;
    }
    throw new ShippingLabelError(
      `Das DHL-Produkt „${String(rawRequested).trim()}“ wird nicht angeboten. `
      + `Bitte eines der angebotenen Produkte wählen: ${this.OFFERED_PRODUCTS.map((code) => `${code} (${this.PRODUCT_LABELS[code] || code})`).join(', ')}.`,
      { code: 'DHL_PRODUCT_NOT_OFFERED', status: 400, retryable: false, details: [requestedProduct] }
    );
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
    // Parcel DE Shipping v2: eine Strassenanschrift traegt `name1`, ein Locker (Packstation) `name`.
    const name = text(party.name1 || party.name);
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

  // ===========================================================================
  // VERSANDRICHTUNGEN
  // ===========================================================================
  //
  // Es gibt genau zwei physische Richtungen, und jede hat ihren EIGENEN Ablageort:
  //
  //   'inbound'  = Einsendung   - Kunde -> McRepair (der KUNDE ist Absender)
  //   'outbound' = Auslieferung - McRepair -> Kunde (der SHOP ist Absender)
  //
  // Am AUFTRAG:
  //   Auslieferung -> trackingNumber / shippingLabelUrl / shippingStatus / trackingEvents /
  //                   estimatedDelivery / actualDelivery / shippingLabelCreationInProgress
  //   Einsendung   -> return* (DHL-Retoure ueber DHLReturnsService - dort ist der Kunde der
  //                   Absender und die receiverId McRepair - oder ein Parcel-DE-Label mit dem
  //                   Kunden als Absender, z. B. das Reklamationslabel)
  // An der BUCHUNG:
  //   trackingNumber / shippingLabelUrl -> Einsendelabel der Buchung (Kunde -> McRepair);
  //                   Altbestand kann dort ein Rueckweg-Label tragen (Timeline-Marker)
  //   return*       -> DHL-Retoure (ebenfalls Kunde -> McRepair)
  //
  // Die DHL-RETOURE ist damit ausdruecklich KEIN Versand an den Kunden. Die Auslieferung
  // laeuft ausschliesslich ueber Parcel DE Shipping v2 (POST /parcel/de/shipping/v2/orders)
  // mit dem konfigurierten Shop als `shipper` und der Lieferadresse als `consignee`.

  static DIRECTION_LABELS = {
    inbound: 'Einsendung (Kunde → McRepair)',
    outbound: 'Auslieferung (McRepair → Kunde)'
  };

  /**
   * Auftragsstatus, ab denen das reparierte Geraet fuer den Versand vorbereitet werden darf.
   * 'completed' bleibt enthalten: der Status wird u. a. von der Abholbestaetigung gesetzt und
   * darf einen (erneuten) Versand nicht unmoeglich machen. Dieselbe Liste entscheidet ueber
   * die Anzeige im Frontend (ueber GET /api/orders/:id -> shipments.outboundAction).
   */
  static OUTBOUND_READY_STATUSES = ['quality-check', 'ready-for-pickup', 'completed'];

  static ORDER_STATUS_LABELS = {
    'pending': 'Ausstehend',
    'diagnostic-assessment': 'Diagnosebewertung',
    'in-progress': 'In Bearbeitung',
    'paused': 'Pausiert',
    'quality-check': 'Qualitätsprüfung',
    // Neutral: Reparatur fertig sagt nichts ueber Abholung/Versand (utils/returnMethod, HIST-17).
    'ready-for-pickup': 'Reparatur abgeschlossen',
    'completed': 'Abgeschlossen',
    'cancelled': 'Storniert'
  };

  static orderStatusLabel(status) {
    return this.ORDER_STATUS_LABELS[String(status || '')] || 'Unbekannt';
  }

  /**
   * Die Shop-Anschrift aus der aktiven DHL-Integration - EINE Quelle fuer alle Richtungen,
   * Strasse und Hausnummer immer als Paar. Es werden keine Werte erfunden: fehlt etwas,
   * scheitert die Payload-Pruefung mit einer deutschen Meldung.
   */
  static resolveConfiguredShopAddress(dhlConfig) {
    const settings = dhlConfig?.settings || {};
    const shipper = settings.shipper || {};
    const pair = this.resolveStreetAndHouse([
      {
        street: settings.shipperStreet || shipper.street,
        house: settings.shipperNumber || shipper.number,
        source: 'integration.settings'
      }
    ]);

    return {
      name: String(settings.shipperCompany || shipper.company || settings.shipperName || '').trim(),
      street: pair.street,
      house: pair.house,
      city: String(settings.shipperCity || shipper.city || '').trim(),
      postalCode: String(settings.shipperPostalCode || shipper.postalCode || '').trim(),
      country: String(settings.shipperCountry || shipper.country || 'DE').trim() || 'DE',
      email: String(settings.shipperEmail || shipper.email || '').trim(),
      phone: String(settings.shipperPhone || shipper.phone || '').trim()
    };
  }

  /**
   * Lieferadresse des Kunden fuer die Auslieferung - als GANZE Anschrift aus EINER Quelle.
   *
   * Reihenfolge: Adress-Snapshot am Auftrag (Checkout) -> Gast-Lieferadresse -> Gast-
   * Lieferadresse der Buchung -> abweichende Lieferadresse im Kundenprofil -> Rechnungsadresse
   * (= Lieferadresse, wenn keine abweichende hinterlegt ist) -> Gast-Rechnungsadresse.
   *
   * Es gewinnt die ERSTE Quelle, die ueberhaupt Adressdaten traegt. Ist sie unvollstaendig,
   * wird das ausdruecklich gemeldet und NICHT stillschweigend auf die Rechnungsadresse
   * ausgewichen - sonst ginge das Paket an die falsche Tuer.
   *
   * @returns {{ address: Object|null, missing: string[], source: string, name: string, email: string, phone: string }}
   */
  static resolveDeliveryAddress({ order = {}, customer = null, booking = null } = {}) {
    const text = (value) => String(value ?? '').trim();
    const guest = order?.guestInfo || {};
    const bookingGuest = booking?.guestInfo || {};

    const name = (
      `${text(customer?.firstName)} ${text(customer?.lastName)}`.trim()
      || text(customer?.name)
      || `${text(guest.firstName)} ${text(guest.lastName)}`.trim()
      || `${text(bookingGuest.firstName)} ${text(bookingGuest.lastName)}`.trim()
    );
    const email = text(customer?.email) || text(guest.email) || text(bookingGuest.email);
    const phone = text(customer?.phone) || text(guest.phone) || text(bookingGuest.phone);

    const normalize = (raw, source) => {
      if (!raw || typeof raw !== 'object') return null;
      const isPackstation = text(raw.deliveryType).toLowerCase() === 'packstation';
      const base = {
        source,
        postalCode: text(raw.zipCode || raw.postalCode),
        city: text(raw.city),
        country: text(raw.country) || 'DE'
      };
      if (isPackstation) {
        return {
          ...base,
          deliveryType: 'packstation',
          packstationNumber: text(raw.packstationNumber || raw.lockerID),
          postNumber: text(raw.postNumber)
        };
      }
      const pair = this.resolveStreetAndHouse([{ street: raw.street, house: raw.number || raw.house, source }]);
      return { ...base, deliveryType: 'address', street: pair.street, house: pair.house };
    };

    // "Traegt Adressdaten" - Land und Zustellart allein zaehlen nicht.
    const hasData = (address) => Boolean(address) && Boolean(
      address.postalCode || address.city ||
      (address.deliveryType === 'packstation'
        ? (address.packstationNumber || address.postNumber)
        : (address.street || address.house))
    );

    const profileDelivery = customer?.paymentAddress && customer.paymentAddress.sameAsInvoice === false
      ? customer.paymentAddress
      : null;

    const candidates = [
      normalize(order?.shippingAddress, 'order.shippingAddress'),
      normalize(guest.shippingAddress, 'order.guestInfo.shippingAddress'),
      normalize(bookingGuest.shippingAddress, 'booking.guestInfo.shippingAddress'),
      normalize(profileDelivery, 'customer.paymentAddress'),
      normalize(customer?.invoiceAddress, 'customer.invoiceAddress'),
      normalize(guest.billingAddress, 'order.guestInfo.billingAddress'),
      normalize(bookingGuest.billingAddress, 'booking.guestInfo.billingAddress')
    ];

    const address = candidates.find(hasData) || null;
    const missing = [];
    if (!name) missing.push('Name');

    if (!address) {
      missing.push('Lieferadresse');
      return { address: null, missing, source: '', name, email, phone };
    }

    if (address.deliveryType === 'packstation') {
      if (!/^\d{3}$/.test(address.packstationNumber)) missing.push('Packstationsnummer (3 Ziffern)');
      if (!/^\d{6,10}$/.test(address.postNumber)) missing.push('Postnummer (6 bis 10 Ziffern)');
    } else {
      if (!address.street) missing.push('Straße');
      if (!address.house) missing.push('Hausnummer');
    }
    if (!address.postalCode) missing.push('PLZ');
    if (!address.city) missing.push('Ort');

    return { address, missing, source: address.source, name, email, phone };
  }

  /** Lesbare Herkunft einer Anschrift (Versandkarten der Auftragsdetailseite, nur Team). */
  static PARTY_SOURCE_LABELS = {
    'integration.settings': 'DHL-Integration (Shop-Anschrift)',
    'order.shippingAddress': 'Lieferadresse des Auftrags',
    'order.guestInfo.shippingAddress': 'Lieferadresse (Gastangaben)',
    'booking.guestInfo.shippingAddress': 'Lieferadresse der Buchung (Gastangaben)',
    'customer.paymentAddress': 'abweichende Lieferadresse im Kundenprofil',
    'customer.invoiceAddress': 'Rechnungsadresse im Kundenprofil',
    'order.guestInfo.billingAddress': 'Rechnungsadresse (Gastangaben)',
    'booking.guestInfo.billingAddress': 'Rechnungsadresse der Buchung (Gastangaben)'
  };

  /**
   * K11 (NUR Team): Absender und Empfaenger je Richtung fuer die Versandkarten - aus DENSELBEN
   * Quellen wie die Label-Erstellung, ohne etwas zu ergaenzen:
   *  - McRepair: resolveConfiguredShopAddress (aktive DHL-Integration), beide Richtungen
   *  - Einsendung mit Buchung: BookingService.buildBookingShipmentData(..., 'inbound') - der Kunde
   *    ist Absender (Rechnungsadresse bzw. Gastangaben, wie das Buchungs-Einsendelabel)
   *  - Einsendung ohne Buchung und Auslieferung: resolveDeliveryAddress (wie createOutboundShipment)
   * Fehlende Angaben stehen in `missing`. Keine E-Mail/Telefonnummer. Bewusst NICHT Teil von
   * getOrderShipmentState, damit Kunden-/Gastprojektionen (toCustomerShipments) es nie enthalten.
   * Es sind die AKTUELLEN Stammdaten - ein bereits erstelltes Label speichert seine Anschriften nicht.
   */
  static async getShipmentPartiesForStaff(orderId) {
    const Booking = require('../models/Booking');
    const BookingService = require('./bookingService');
    const text = (value) => String(value ?? '').trim();

    const order = await Order.findById(orderId)
      .setOptions({ skipAutoPopulate: true })
      .select('orderNumber customerId guestInfo shippingAddress bookingId')
      .populate('customerId', 'name firstName lastName email phone invoiceAddress paymentAddress')
      .lean();
    if (!order) return null;
    const bookingQuery = order.bookingId
      ? Booking.findById(order.bookingId)
      : Booking.findOne({ $or: [{ orderIds: order._id }, { repairOrderIds: order._id }] });
    const booking = await bookingQuery.setOptions({ skipAutoPopulate: true }).select('bookingNumber guestInfo').lean();

    let dhlConfig = null;
    try {
      dhlConfig = await this.getDHLConfig();
    } catch (error) {
      dhlConfig = null;
    }

    const labelFor = (source) => this.PARTY_SOURCE_LABELS[source] || '';
    const shop = this.resolveConfiguredShopAddress(dhlConfig);
    const shopParty = {
      role: 'shop',
      name: shop.name,
      deliveryType: 'address',
      street: shop.street,
      house: shop.house,
      postalCode: shop.postalCode,
      city: shop.city,
      country: shop.country,
      source: 'integration.settings',
      sourceLabel: labelFor('integration.settings'),
      missing: dhlConfig
        ? [...(shop.name ? [] : ['Firmenname']), ...BookingService.missingShopAddressFields(shop)]
        : ['aktive DHL-Integration']
    };

    // Populiert = Objekt; eine nicht aufloesbare Referenz bleibt eine ObjectId (_bsontype).
    const customer = order.customerId && typeof order.customerId === 'object' && !order.customerId._bsontype
      ? order.customerId
      : null;
    // Wie createOutboundShipment: die Buchung zaehlt fuer die Lieferadresse nur ueber order.bookingId
    // (eine nur per orderIds gefundene Buchung wuerde eine Adresse zeigen, die das Label nicht nutzt).
    const delivery = this.resolveDeliveryAddress({ order, customer, booking: order.bookingId ? booking : null });
    const deliveryParty = {
      role: 'customer',
      name: delivery.name,
      deliveryType: delivery.address?.deliveryType || 'address',
      street: delivery.address?.street || '',
      house: delivery.address?.house || '',
      packstationNumber: delivery.address?.packstationNumber || '',
      postNumber: delivery.address?.postNumber || '',
      postalCode: delivery.address?.postalCode || '',
      city: delivery.address?.city || '',
      country: delivery.address?.country || '',
      source: delivery.source,
      sourceLabel: labelFor(delivery.source),
      missing: delivery.missing
    };

    // Auftrag ohne Buchung: Einsendelabel = DHLReturnsService.createReturnLabelForOrder. Gleiche Regel:
    // Lieferadresse des Auftrags (nie eine Packstation), sonst Rechnungsadresse des Kunden; Name vom Kunden.
    const returnShipping = order.shippingAddress && order.shippingAddress.deliveryType !== 'packstation' ? order.shippingAddress : {};
    const invoice = (customer && customer.invoiceAddress) || {};
    const returnStreetRaw = text(returnShipping.street) || text(invoice.street);
    const returnSplit = this.splitStreetAndHouse(returnStreetRaw);
    const returnHouse = returnSplit.house || text(text(returnShipping.street) ? returnShipping.number : invoice.number);
    const returnName = customer ? text([customer.firstName, customer.lastName].filter(Boolean).join(' ')) || text(customer.name) : '';
    let inboundSender = {
      role: 'customer',
      name: returnName,
      deliveryType: 'address',
      street: returnSplit.house ? text(returnSplit.street) : returnStreetRaw,
      house: returnHouse,
      // feldweise wie im Retourenlabel: Auftragsadresse, sonst Rechnungsadresse
      postalCode: text(returnShipping.zipCode) || text(invoice.zipCode),
      city: text(returnShipping.city) || text(invoice.city),
      country: text(returnShipping.country) || text(invoice.country),
      source: text(returnShipping.street) ? 'order.shippingAddress' : (text(invoice.street) ? 'customer.invoiceAddress' : ''),
      sourceLabel: labelFor(text(returnShipping.street) ? 'order.shippingAddress' : (text(invoice.street) ? 'customer.invoiceAddress' : '')),
      missing: customer
        ? [['Name', returnName], ['Straße', returnStreetRaw], ['Hausnummer', returnHouse],
          ['PLZ', returnShipping.zipCode || invoice.zipCode], ['Ort', returnShipping.city || invoice.city]]
          .filter(([, value]) => !text(value)).map(([field]) => field)
        : ['Kundenkonto (Einsendelabel ohne Buchung nur für registrierte Kunden)'],
    };
    if (booking) {
      // Gleiche Funktion wie das Buchungs-Einsendelabel; Quelle in derselben Reihenfolge benannt.
      const data = BookingService.buildBookingShipmentData(order, booking, dhlConfig, 'inbound');
      const source = (customer && customer.invoiceAddress && 'customer.invoiceAddress')
        || (order.guestInfo?.shippingAddress && 'order.guestInfo.shippingAddress')
        || (booking.guestInfo?.shippingAddress && 'booking.guestInfo.shippingAddress')
        || (booking.guestInfo?.billingAddress && 'booking.guestInfo.billingAddress')
        || '';
      // 'Customer' ist der technische Platzhalter von buildBookingShipmentData, kein Name.
      const name = text(data.shipperName) === 'Customer' ? '' : text(data.shipperName);
      inboundSender = {
        role: 'customer',
        name,
        deliveryType: 'address',
        street: text(data.shipperStreet),
        house: text(data.shipperNumber),
        postalCode: text(data.shipperPostalCode),
        city: text(data.shipperCity),
        country: text(data.shipperCountry),
        source,
        sourceLabel: labelFor(source),
        missing: [
          ['Name', name], ['Straße', data.shipperStreet], ['Hausnummer', data.shipperNumber],
          ['PLZ', data.shipperPostalCode], ['Ort', data.shipperCity]
        ].filter(([, value]) => !text(value)).map(([field]) => field)
      };
    }

    return {
      inbound: { direction: 'inbound', label: this.DIRECTION_LABELS.inbound, sender: inboundSender, recipient: shopParty },
      outbound: { direction: 'outbound', label: this.DIRECTION_LABELS.outbound, sender: shopParty, recipient: deliveryParty },
      fromCurrentData: true
    };
  }

  /** DHL-Referenz (refNo, 8-35 Zeichen) - erscheint auf dem Label und im Geschaeftskundenportal. */
  static buildShipmentReference(order = {}) {
    const base = String(order.orderNumber || order._id || '').replace(/[^\w\- ]/g, '').trim();
    const ref = base.length >= 8 ? base : `McRepair ${base}`.trim();
    return ref.padEnd(8, '0').slice(0, 35);
  }

  /**
   * Antwort, bei der NICHT feststeht, ob DHL das Label angelegt hat: die Anfrage ist
   * rausgegangen, aber es kam keine auswertbare Antwort zurueck. Ein blinder neuer Versuch
   * koennte ein zweites, bezahltes Label erzeugen.
   */
  static isIndeterminateTransportError(error) {
    if (!error || error instanceof ShippingLabelError) return false;
    const status = error?.response?.status;
    if (status === 502 || status === 504) return true;
    if (status) return false;
    const code = String(error?.code || '');
    if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ERR_SOCKET_CONNECTION_TIMEOUT', 'ERR_CANCELED'].includes(code)) return true;
    return /timeout|socket hang up/i.test(String(error?.message || ''));
  }

  /**
   * Richtung des BEREITS GESPEICHERTEN Buchungslabels (booking.trackingNumber traegt im
   * Altbestand beide Richtungen). Dauerhaft ist allein der Timeline-Eintrag der
   * Label-Erstellung; ohne Treffer gilt 'inbound' (automatisches Einsendelabel).
   */
  static resolveStoredBookingLabelDirection(booking) {
    const timeline = Array.isArray(booking?.timeline) ? booking.timeline : [];
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      const entry = timeline[index];
      if (String(entry?.status || '') !== 'Shipping Label Created') continue;
      const description = String(entry?.description || '').toLowerCase();
      if (description.includes('rückweg') || description.includes('rueckweg') || description.includes('outbound')) return 'outbound';
      if (description.includes('hinweg') || description.includes('inbound')) return 'inbound';
    }
    return 'inbound';
  }

  /**
   * Testlabel des Dummy-Modus (BookingService.createDummyShippingLabelForBooking): KEIN echtes
   * DHL-Label. Erkennbar ausschliesslich am Praefix der Sendungsnummer (Lesepfad, keine
   * Datenaenderung). Die Oberflaeche zeigt dafuer "Testlabel – nicht für den Versand verwenden".
   */
  static PLACEHOLDER_TRACKING_PREFIX = 'DHL-DUMMY-';

  static isPlaceholderTrackingNumber(trackingNumber) {
    return String(trackingNumber || '').startsWith(this.PLACEHOLDER_TRACKING_PREFIX);
  }

  /**
   * Sperre des Einsendelabels AN DER BUCHUNG (Booking.shippingLabelCreationInProgress, Beginn in
   * updatedAt). Eine Sperre ohne Abgleich-Vermerk gilt nach dieser Frist als verwaist.
   * EINE Regel fuer Lesemodell (getOrderShipmentState, Buchungs-Einsendestatus) und Abgleich
   * (BookingService.reconcileBookingInboundLabel).
   */
  static BOOKING_LABEL_LOCK_STALE_MS = 10 * 60 * 1000;

  /** Liegt nach dem letzten Abschluss (erstellt/abgeglichen) ein Vermerk "Abgleich erforderlich" vor? */
  static hasBookingReconciliationMarker(booking) {
    const timeline = Array.isArray(booking?.timeline) ? booking.timeline : [];
    const timeOf = (entry) => new Date(entry?.completedAt || entry?.createdAt || 0).getTime() || 0;
    const lastMarker = Math.max(0, ...timeline
      .filter((entry) => entry?.status === 'Shipping Label Reconciliation Required')
      .map(timeOf));
    const lastSettled = Math.max(0, ...timeline
      .filter((entry) => ['Shipping Label Created', 'Shipping Label Reconciled'].includes(entry?.status))
      .map(timeOf));
    return lastMarker > 0 && lastMarker >= lastSettled;
  }

  /**
   * Darf eine gesetzte Einsendelabel-Sperre der Buchung abgeglichen werden?
   *  - ja, wenn ein Vermerk "Abgleich erforderlich" nach dem letzten Abschluss vorliegt,
   *  - ja, wenn die Sperre aelter als BOOKING_LABEL_LOCK_STALE_MS ist (Prozessabbruch),
   *  - sonst nein: die Erstellung laeuft noch.
   */
  static isBookingLabelReconciliationAllowed(booking, now = Date.now()) {
    if (this.hasBookingReconciliationMarker(booking)) return true;
    const lockedSince = new Date(booking?.updatedAt || 0).getTime() || 0;
    return lockedSince > 0 && now - lockedSince > this.BOOKING_LABEL_LOCK_STALE_MS;
  }

  /** Zustand der Buchungssperre in derselben Form wie describeLabelLock (Auftragssperren). */
  static describeBookingLabelLock(booking, now = Date.now()) {
    if (!booking || booking.shippingLabelCreationInProgress !== true) {
      return this.describeLabelLock({ locked: false });
    }
    const lockedSince = new Date(booking.updatedAt || 0);
    const lockStartedAt = Number.isNaN(lockedSince.getTime()) || lockedSince.getTime() === 0 ? null : lockedSince;
    if (this.hasBookingReconciliationMarker(booking)) {
      return { inProgress: false, reconciliationRequired: true, lockStale: false, reconciliationReason: 'dhl-result-unknown', lockStartedAt };
    }
    if (this.isBookingLabelReconciliationAllowed(booking, now)) {
      return { inProgress: false, reconciliationRequired: true, lockStale: true, reconciliationReason: 'stale-lock', lockStartedAt };
    }
    return { inProgress: true, reconciliationRequired: false, lockStale: false, reconciliationReason: '', lockStartedAt };
  }

  /**
   * Verlaufsfelder der handelnden Person (HIST-16). Bisher stand bei jedem Label
   * 'DHL Parcel Integration' bzw. 'System' - jetzt die Person, die das Label ausgeloest hat;
   * 'source' haelt fest, dass der Eintrag aus der DHL-Anbindung stammt. Ohne Person (z. B.
   * automatisches Label beim Checkout) bleibt der bisherige Systemname.
   */
  static timelineActor(actor, fallbackName = 'DHL Parcel Integration') {
    // EINE Regel fuer Akteursfelder: OrderHistory.labelActorFields (Verlaufsvertrag). Ein
    // Kunde, der sein Einsendelabel selbst anfordert, wird als Quelle 'Kunde' vermerkt, damit
    // die Teamansicht ihn nicht als Mitarbeiter ausweist.
    // eslint-disable-next-line global-require
    const OrderHistory = require('../utils/orderHistory');
    const hasActor = Boolean(actor && (actor._id || actor.id));
    const isCustomer = hasActor && String(actor.role || '').toLowerCase() === 'customer';
    return OrderHistory.labelActorFields(hasActor ? actor : null, {
      fallbackName,
      source: isCustomer ? 'Kunde' : 'DHL',
    });
  }

  /**
   * Frist einer Label-Sperre. Eine DHL-Anfrage dauert hoechstens 30 s (Timeout) plus
   * Token-Abruf; eine Sperre, die deutlich laenger besteht, gehoert zu keiner laufenden
   * Anfrage mehr (Prozessabbruch, Altbestand). Sie wird NICHT still geloest - es kann trotzdem
   * ein Label bei DHL entstanden sein -, sondern als "Abgleich erforderlich" gemeldet.
   */
  static LABEL_LOCK_LEASE_MS = 5 * 60 * 1000;

  /**
   * Startzeitpunkt einer Sperre. Die Felder shippingLabelCreationStartedAt /
   * returnLabelCreationStartedAt sind (noch) nicht im Order-Schema deklariert und werden
   * deshalb mit { strict: false } geschrieben; gelesen werden sie ueber .lean().
   */
  static LOCK_WRITE_OPTIONS = { strict: false, strictQuery: false };

  /**
   * FENCING: jede Schreiboperation NACH einer Reservierung ist an genau diese Reservierung
   * gebunden (Startzeit im Filter). Hat inzwischen ein Abgleich die Reservierung aufgeloest
   * und eine neue Anfrage reserviert, trifft ein verspaeteter Schreibzugriff der alten Anfrage
   * nichts mehr - er kann weder ein Label ueberschreiben noch eine fremde Reservierung
   * freigeben oder als "Abgleich erforderlich" markieren.
   */
  static outboundClaimFence(orderId, claimedAt) {
    return { _id: orderId, shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: claimedAt };
  }

  static inboundClaimFence(orderId, claimedAt) {
    return { _id: orderId, returnShipmentStatus: 'pending', returnLabelCreationStartedAt: claimedAt };
  }

  /**
   * Frist durchsetzen, BEVOR ein bezahlter DHL-Aufruf rausgeht: die Reservierung muss noch
   * dieser Anfrage gehoeren und die Restfrist muss den DHL-Timeout (plus Reserve) abdecken.
   * Sonst koennte die Anfrage laenger leben als die Frist, nach der die Oberflaeche den
   * Abgleich anbietet. Es wurde dann noch NICHTS bei DHL angelegt.
   */
  static LABEL_REQUEST_RESERVE_MS = 15 * 1000;

  /**
   * HARTE Gesamtfrist des bezahlten Parcel-DE-Aufrufs (siehe postWithDeadline). Die Frist der
   * Reservierung rechnet mit genau diesem Wert - axios' 'timeout' allein reicht dafuer nicht.
   */
  static LABEL_REQUEST_TIMEOUT_MS = 30000;

  static async assertLabelClaimActive(fence, claimedAt, { requestTimeoutMs = this.LABEL_REQUEST_TIMEOUT_MS } = {}) {
    const remaining = new Date(claimedAt).getTime() + this.LABEL_LOCK_LEASE_MS - Date.now();
    if (remaining <= requestTimeoutMs + this.LABEL_REQUEST_RESERVE_MS) {
      throw new ShippingLabelError(
        'Die Reservierung für die Label-Erstellung ist abgelaufen, bevor DHL aufgerufen wurde. Es wurde KEIN Label bei DHL erstellt. '
        + 'Bitte die Seite neu laden und das Label erneut erstellen.',
        { code: 'LABEL_CLAIM_EXPIRED', status: 409, retryable: true }
      );
    }
    const stillOurs = await Order.findOne(fence)
      .setOptions({ skipAutoPopulate: true, strictQuery: false })
      .select('_id')
      .lean();
    if (!stillOurs) {
      throw new ShippingLabelError(
        'Diese Label-Erstellung wurde inzwischen abgeglichen oder von einer anderen Anfrage übernommen. Es wurde KEIN Label bei DHL erstellt. '
        + 'Bitte die Seite neu laden und den aktuellen Versandstand prüfen.',
        { code: 'LABEL_CLAIM_LOST', status: 409, retryable: false }
      );
    }
  }

  /**
   * Verspaetetes DHL-Ergebnis einer Anfrage, deren Reservierung nicht mehr besteht: NICHTS am
   * Auftrag ueberschreiben, aber die Sendungsnummer im Verlauf festhalten, damit das Label im
   * DHL-Portal gefunden und storniert werden kann. Eigener Verlaufsstatus - er ist bewusst
   * KEIN Abgleich-Marker, sonst wuerde eine neue, noch laufende Reservierung abgleichbar.
   */
  static async recordOrphanedLabel(orderId, { direction, trackingNumber = '', reference = '', product = '' } = {}) {
    const inbound = direction === 'inbound';
    const what = inbound ? `${product || 'Einsendelabel'} (Kunde → McRepair)` : 'Versandlabel der Auslieferung (McRepair → Kunde)';
    const description = trackingNumber
      ? `Eine abgelaufene bzw. bereits abgeglichene Anfrage hat bei DHL ein ${what} mit der Sendungsnummer ${trackingNumber} erstellt. `
        + 'Es wurde NICHT am Auftrag gespeichert, weil die Reservierung inzwischen einer anderen Anfrage gehört. '
        + 'Bitte im DHL-Geschäftskundenportal prüfen und das überzählige Label stornieren.'
      : `Eine abgelaufene bzw. bereits abgeglichene Anfrage für ein ${what} hat von DHL keine eindeutige Antwort erhalten. `
        + `Bitte im DHL-Geschäftskundenportal${reference ? ` nach der Referenz „${reference}“` : ''} prüfen, ob ein überzähliges Label entstanden ist.`;
    await Order.updateOne(
      { _id: orderId },
      {
        $push: {
          timeline: {
            status: inbound ? 'Inbound Label Orphaned' : 'Shipping Label Orphaned',
            description,
            completedAt: new Date(),
            staffId: 'system',
            staffName: 'DHL Parcel Integration'
          }
        }
      }
    );
  }

  /**
   * Verlaufstext "Abgleich erforderlich" - passend zur Ursache:
   *  'timeout'          keine (rechtzeitige) Antwort von DHL
   *  'label-missing'    DHL hat die Sendung angelegt, aber kein PDF geliefert
   *  'tracking-missing' DHL hat geantwortet, aber ohne Sendungsnummer
   *  'persist-failed'   Label bei DHL erstellt, Speichern am Auftrag fehlgeschlagen
   */
  static reconciliationMarkerText({ kind = 'timeout', what, trackingNumber = '', reference = '' } = {}) {
    const referenceHint = reference ? ` nach der Referenz „${reference}“` : '';
    const trackingHint = trackingNumber ? ` bzw. der Sendungsnummer ${trackingNumber}` : '';
    if (kind === 'persist-failed') {
      return `Das ${what} wurde bei DHL erstellt${trackingNumber ? ` (Sendungsnummer ${trackingNumber})` : ''}, konnte aber nicht am Auftrag gespeichert werden. `
        + 'Kein neues Label erstellen: bitte das PDF im DHL-Geschäftskundenportal abrufen und den Abgleich mit dieser Sendungsnummer abschließen.';
    }
    if (kind === 'label-missing') {
      return `DHL hat für das ${what} die Sendung${trackingNumber ? ` ${trackingNumber}` : ''} angelegt, aber kein PDF-Label zurückgegeben. `
        + 'Kein neues Label erstellen: bitte das PDF im DHL-Geschäftskundenportal abrufen und den Abgleich abschließen.';
    }
    if (kind === 'tracking-missing') {
      return `DHL hat auf die Anfrage für das ${what} geantwortet, aber keine Sendungsnummer zurückgegeben. Ob das Label angelegt wurde, ist unklar. `
        + `Vor einem neuen Versuch im DHL-Geschäftskundenportal${referenceHint} suchen und den Abgleich abschließen.`;
    }
    return `DHL hat auf die Anfrage für das ${what} nicht rechtzeitig bzw. nicht eindeutig geantwortet (Zeitüberschreitung oder Verbindungsabbruch). Ob das Label angelegt wurde, ist unklar. `
      + `Vor einem neuen Versuch im DHL-Geschäftskundenportal${referenceHint}${trackingHint} suchen und den Abgleich abschließen.`;
  }

  /** Ursache eines unklaren Ergebnisses aus sendParcelDeShipment (transportReason). */
  static reconciliationKindFor(sendError) {
    const reason = String(sendError?.transportReason || '');
    if (reason === 'label-missing') return 'label-missing';
    if (reason === 'tracking-missing') return 'tracking-missing';
    return 'timeout';
  }

  /** Steht am Auftrag ein offener Abgleich nach einer unklaren DHL-Antwort an? */
  static hasPendingOutboundReconciliation(order = {}) {
    if (order.shippingLabelCreationInProgress !== true) return false;
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      const status = String(timeline[index]?.status || '');
      if (status === 'Shipping Label Reconciliation Required') return true;
      if (status === 'Shipping Label Reconciled' || status === 'Shipping Label Created') return false;
    }
    return false;
  }

  /** Dasselbe fuer die Einsendung am Auftrag (return*, Reservierung = returnShipmentStatus 'pending'). */
  static hasPendingInboundReconciliation(order = {}) {
    if (String(order.returnShipmentStatus || '') !== 'pending') return false;
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      const status = String(timeline[index]?.status || '');
      if (status === 'Inbound Label Reconciliation Required') return true;
      if (status === 'Inbound Label Reconciled' || status === 'Inbound Label Created') return false;
    }
    return false;
  }

  /**
   * Zustand einer Label-Sperre - fuer beide Richtungen dieselbe Regel:
   *  - Marker "Abgleich erforderlich" (unklare DHL-Antwort, Speicherfehler) -> Abgleich
   *  - keine Startzeit (Altbestand) oder aelter als die Frist -> verwaist -> Abgleich
   *  - sonst laeuft die Anfrage noch -> inProgress (kein Abgleich, kein neuer Versuch)
   */
  static describeLabelLock({ locked, startedAt, markerPresent, now = Date.now() } = {}) {
    if (!locked) {
      return { inProgress: false, reconciliationRequired: false, lockStale: false, reconciliationReason: '', lockStartedAt: null };
    }
    const started = startedAt ? new Date(startedAt) : null;
    const startedValid = started && !Number.isNaN(started.getTime());
    const lockStartedAt = startedValid ? started : null;
    if (markerPresent) {
      return { inProgress: false, reconciliationRequired: true, lockStale: false, reconciliationReason: 'dhl-result-unknown', lockStartedAt };
    }
    if (!startedValid || now - started.getTime() > this.LABEL_LOCK_LEASE_MS) {
      return { inProgress: false, reconciliationRequired: true, lockStale: true, reconciliationReason: 'stale-lock', lockStartedAt };
    }
    return { inProgress: true, reconciliationRequired: false, lockStale: false, reconciliationReason: '', lockStartedAt };
  }

  static STALE_LOCK_REASON = 'Eine frühere Label-Erstellung wurde gestartet, aber nie abgeschlossen (z. B. Abbruch während der DHL-Anfrage). '
    + 'Ob bei DHL ein Label entstanden ist, ist unklar. Bitte im DHL-Geschäftskundenportal prüfen und den Abgleich abschließen.';

  /**
   * EINZIGE Entscheidung, ob "An Kunden versenden" moeglich ist. Der POST-Endpunkt setzt sie
   * durch, GET /api/orders/:id liefert sie als shipments.outboundAction an die Oberflaeche -
   * dadurch sind die Bedingungen in Frontend und Backend zwangslaeufig identisch.
   * (Die Rollenpruefung admin/staff liegt in der Route bzw. in isStaffOrAdmin.)
   */
  static evaluateOutboundEligibility(order = {}, state = {}) {
    const deny = (code, reason) => ({ allowed: false, code, reason });
    const status = String(order.status || '');

    if (status === 'cancelled') {
      return deny('OUTBOUND_ORDER_CANCELLED', 'Der Auftrag ist storniert. Eine Auslieferung an den Kunden ist nicht möglich.');
    }
    if (state.reconciliationRequired) {
      return deny(
        'LABEL_RECONCILIATION_REQUIRED',
        state.lockStale
          ? this.STALE_LOCK_REASON
          : 'Die letzte Label-Erstellung bei DHL hat keine eindeutige Antwort geliefert. Bitte zuerst im DHL-Geschäftskundenportal prüfen, ob die Sendung angelegt wurde, und den Abgleich abschließen.'
      );
    }
    if (state.inProgress) {
      return deny('LABEL_CREATION_IN_PROGRESS', 'Das Versandlabel wird gerade erstellt. Bitte kurz warten und die Seite neu laden.');
    }
    if (state.outboundLabelExists) {
      return deny('OUTBOUND_LABEL_EXISTS', 'Für diesen Auftrag wurde bereits ein Auslieferungslabel erstellt.');
    }
    if (!this.OUTBOUND_READY_STATUSES.includes(status)) {
      return deny(
        'OUTBOUND_STATUS_NOT_READY',
        `Die Auslieferung an den Kunden ist erst möglich, wenn die Reparatur abgeschlossen ist (ab Qualitätsprüfung). Aktueller Status: ${this.orderStatusLabel(status)}.`
      );
    }
    // Bestehende Geschaeftsregel (Reklamations-/Angebotsauftraege): Versand erst nach Zahlung.
    // Eine allgemeine Zahlungssperre je Zahlungsbedingung gibt es bewusst NICHT - ein
    // Haendler auf Rechnung wird nicht wie ein Barzahler blockiert.
    if (order.requiresPaymentBeforeCompletion === true && String(order.paymentStatus || '') !== 'paid') {
      return deny(
        'PAYMENT_REQUIRED_BEFORE_SHIPPING',
        'Für diesen Auftrag ist vor dem Versand eine Zahlung erforderlich. Das Versandlabel kann erst nach Zahlungseingang erstellt werden.'
      );
    }
    return {
      allowed: true,
      code: 'OK',
      reason: 'Erstellt ein DHL-Versandlabel: Absender ist McRepair, Empfänger die Lieferadresse des Kunden.'
    };
  }

  /**
   * Dieselben Bedingungen wie evaluateOutboundEligibility (Status, Zahlungspflicht) als
   * MongoDB-Filter - fuer die atomare Reservierung, damit zwischen Pruefung und Schreiben
   * nichts durchrutscht. 'cancelled' ist in OUTBOUND_READY_STATUSES nicht enthalten.
   */
  static outboundEligibilityFilter() {
    return {
      status: { $in: this.OUTBOUND_READY_STATUSES },
      $nor: [{ requiresPaymentBeforeCompletion: true, paymentStatus: { $ne: 'paid' } }]
    };
  }

  /**
   * Liest den Versandstand eines Auftrags GETRENNT nach Richtung. Grundlage fuer die
   * Detailansicht (Lesepfad) UND fuer die Label-Erstellung (Schreibpfad), damit
   * "Label vorhanden" an beiden Stellen dasselbe bedeutet - nicht nur "es gibt eine PDF-URL".
   */
  static async getOrderShipmentState(orderId) {
    const Booking = require('../models/Booking');
    const Complaint = require('../models/Complaint');

    const order = await Order.findById(orderId)
      .setOptions({ skipAutoPopulate: true })
      .select([
        'orderNumber status paymentStatus requiresPaymentBeforeCompletion bookingId isComplaintFollowup',
        'trackingNumber carrier shippingStatus shippingStatusDescription estimatedDelivery actualDelivery',
        'shippingLabelCreationInProgress shippingLabelCreationStartedAt trackingEvents',
        'returnTrackingNumber returnShipmentId returnShipmentStatus returnShipmentStatusDescription returnCreatedAt returnLabelCreationStartedAt',
        'timeline'
      ].join(' '))
      .lean();

    if (!order) {
      throw new ShippingLabelError('Auftrag wurde nicht gefunden.', { code: 'ORDER_NOT_FOUND', status: 404 });
    }

    const nonEmpty = { $exists: true, $nin: [null, ''] };
    // shippingLabelCreationInProgress + updatedAt: Sperre des Einsendelabels an der Buchung
    // (laufende Erstellung bzw. unklare DHL-Antwort) - sonst meldet die Auftragsansicht
    // "erstellen moeglich", waehrend der Server mit 409 ablehnt.
    const bookingSelect = 'bookingNumber trackingNumber shippingStatus shippingStatusDescription shippingLabelCreationInProgress updatedAt returnTrackingNumber returnShipmentStatus returnShipmentStatusDescription timeline';
    // bookingId wird beim Anlegen der Buchung gesetzt; aeltere Datensaetze sind nur ueber
    // die Auftragsliste der Buchung verknuepft.
    const bookingQuery = order.bookingId
      ? Booking.findById(order.bookingId)
      : Booking.findOne({ $or: [{ orderIds: order._id }, { repairOrderIds: order._id }] });
    const [outboundPdf, inboundPdf, booking] = await Promise.all([
      Order.exists({ _id: order._id, shippingLabelUrl: nonEmpty }),
      Order.exists({ _id: order._id, returnLabelUrl: nonEmpty }),
      bookingQuery.setOptions({ skipAutoPopulate: true }).select(bookingSelect).lean()
    ]);

    const [bookingParcelPdf, bookingRetourePdf] = booking
      ? await Promise.all([
        Booking.exists({ _id: booking._id, shippingLabelUrl: nonEmpty }),
        Booking.exists({ _id: booking._id, returnLabelUrl: nonEmpty })
      ])
      : [null, null];
    const bookingLabelDirection = booking ? this.resolveStoredBookingLabelDirection(booking) : 'inbound';

    // ALTBESTAND: bis zu diesem Fix wurden Einsendelabel (Buchung, Reklamation) zusaetzlich
    // in die Versandfelder des Auftrags geschrieben. Ein solcher Eintrag ist KEINE
    // Auslieferung und darf "An Kunden versenden" nicht blockieren.
    const orderTracking = String(order.trackingNumber || '').trim();
    let legacyInboundInOutboundSlot = false;
    if (orderTracking) {
      if (booking && String(booking.trackingNumber || '').trim() === orderTracking && bookingLabelDirection === 'inbound') {
        legacyInboundInOutboundSlot = true;
      } else if (order.isComplaintFollowup) {
        legacyInboundInOutboundSlot = Boolean(await Complaint.exists({
          newOrderId: order._id,
          'complaintLogs.metadata.trackingNumber': orderTracking
        }));
      }
    }

    const outboundLock = this.describeLabelLock({
      locked: order.shippingLabelCreationInProgress === true,
      startedAt: order.shippingLabelCreationStartedAt,
      markerPresent: this.hasPendingOutboundReconciliation(order)
    });
    const reconciliationRequired = outboundLock.reconciliationRequired;
    const outboundHasLabel = Boolean(outboundPdf) && !legacyInboundInOutboundSlot;
    const outboundTracking = legacyInboundInOutboundSlot ? '' : orderTracking;

    const outbound = {
      direction: 'outbound',
      label: this.DIRECTION_LABELS.outbound,
      hasLabel: outboundHasLabel,
      trackingNumber: outboundTracking,
      status: legacyInboundInOutboundSlot ? 'pending' : (order.shippingStatus || 'pending'),
      statusDescription: legacyInboundInOutboundSlot ? '' : (order.shippingStatusDescription || ''),
      estimatedDelivery: legacyInboundInOutboundSlot ? null : (order.estimatedDelivery || null),
      actualDelivery: legacyInboundInOutboundSlot ? null : (order.actualDelivery || null),
      inProgress: outboundLock.inProgress,
      reconciliationRequired,
      // 'dhl-result-unknown' (unklare DHL-Antwort / Speicherfehler) | 'stale-lock' (verwaiste Sperre)
      reconciliationReason: outboundLock.reconciliationReason,
      lockStale: outboundLock.lockStale,
      lockStartedAt: outboundLock.lockStartedAt,
      reconcileUrl: reconciliationRequired ? `/api/orders/${order._id}/shipping/reconcile` : '',
      reference: this.buildShipmentReference(order),
      downloadUrl: outboundHasLabel ? `/api/orders/${order._id}/shipping-label` : ''
    };

    // Alle Einsendelabel, die zu diesem Auftrag gehoeren - das erste vorhandene ist das
    // massgebliche fuer Anzeige und Sperre.
    const inboundLabels = [];
    if (inboundPdf || order.returnTrackingNumber || order.returnShipmentStatus) {
      inboundLabels.push({
        source: 'order',
        hasLabel: Boolean(inboundPdf),
        trackingNumber: order.returnTrackingNumber || '',
        status: order.returnShipmentStatus || '',
        statusDescription: order.returnShipmentStatusDescription || '',
        downloadUrl: inboundPdf ? `/api/orders/${order._id}/return-label` : ''
      });
    }
    if (booking && (bookingParcelPdf || booking.trackingNumber) && bookingLabelDirection === 'inbound') {
      inboundLabels.push({
        source: 'booking',
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber || '',
        hasLabel: Boolean(bookingParcelPdf),
        trackingNumber: booking.trackingNumber || '',
        status: booking.shippingStatus || '',
        statusDescription: booking.shippingStatusDescription || '',
        downloadUrl: bookingParcelPdf ? `/api/bookings/${booking._id}/shipping-label` : '',
        // Dummy-Modus: Testlabel, kein echtes DHL-Label (Lesepfad, keine Datenaenderung).
        placeholder: this.isPlaceholderTrackingNumber(booking.trackingNumber)
      });
    }
    if (booking && (bookingRetourePdf || booking.returnTrackingNumber)) {
      inboundLabels.push({
        source: 'booking-retoure',
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber || '',
        hasLabel: Boolean(bookingRetourePdf),
        trackingNumber: booking.returnTrackingNumber || '',
        status: booking.returnShipmentStatus || '',
        statusDescription: booking.returnShipmentStatusDescription || '',
        downloadUrl: bookingRetourePdf ? `/api/bookings/${booking._id}/return-label` : ''
      });
    }
    const primaryInbound = inboundLabels.find((entry) => entry.hasLabel) || inboundLabels[0] || null;
    // Sperre der Einsendung AM AUFTRAG (DHL-Retoure bzw. Parcel-DE-Einsendelabel, return*).
    const orderInboundLock = this.describeLabelLock({
      locked: String(order.returnShipmentStatus || '') === 'pending',
      startedAt: order.returnLabelCreationStartedAt,
      markerPresent: this.hasPendingInboundReconciliation(order)
    });
    // Sperre AN DER BUCHUNG (Checkout-Label, Einsendelabel per Mitarbeiter/Kunde, Buchungs-
    // Retoure): dieselbe Einsendung, also dieselbe Anzeige "wird erstellt"/"Abgleich".
    const bookingInboundLock = booking ? this.describeBookingLabelLock(booking) : this.describeLabelLock({ locked: false });
    const orderLockActive = orderInboundLock.inProgress || orderInboundLock.reconciliationRequired;
    const bookingLockActive = !orderLockActive && (bookingInboundLock.inProgress || bookingInboundLock.reconciliationRequired);
    const inboundLock = bookingLockActive ? bookingInboundLock : orderInboundLock;
    const inboundReconcileUrl = !inboundLock.reconciliationRequired
      ? ''
      : (bookingLockActive ? `/api/bookings/${booking._id}/shipping/reconcile` : `/api/orders/${order._id}/return-label/reconcile`);
    const inbound = {
      direction: 'inbound',
      label: this.DIRECTION_LABELS.inbound,
      hasLabel: Boolean(primaryInbound?.hasLabel),
      trackingNumber: primaryInbound?.trackingNumber || '',
      status: primaryInbound?.status || '',
      statusDescription: primaryInbound?.statusDescription || '',
      source: primaryInbound?.source || '',
      downloadUrl: primaryInbound?.downloadUrl || '',
      inProgress: inboundLock.inProgress,
      reconciliationRequired: inboundLock.reconciliationRequired,
      reconciliationReason: inboundLock.reconciliationReason,
      lockStale: inboundLock.lockStale,
      lockStartedAt: inboundLock.lockStartedAt,
      reconcileUrl: inboundReconcileUrl,
      // 'booking' = Sperre/Abgleich an der Buchung, 'order' = am Auftrag, '' = keine Sperre
      lockScope: (inboundLock.inProgress || inboundLock.reconciliationRequired) ? (bookingLockActive ? 'booking' : 'order') : '',
      placeholder: Boolean(primaryInbound?.placeholder),
      reference: this.buildShipmentReference(order)
    };

    const outboundAction = this.evaluateOutboundEligibility(order, {
      reconciliationRequired,
      lockStale: outboundLock.lockStale,
      inProgress: outbound.inProgress,
      outboundLabelExists: outboundHasLabel || Boolean(outboundTracking)
    });

    // Einsendelabel: mit Buchung an der Buchung (ein Paket fuer alle Geraete der Buchung),
    // ohne Buchung - oder wenn das Buchungsfeld ein altes Rueckweg-Label traegt - am
    // Auftrag per DHL-Retoure.
    const inboundAtBooking = Boolean(booking) && bookingLabelDirection !== 'outbound';
    const denyInbound = (code, reason) => ({ allowed: false, code, reason, target: '' });
    let inboundAction;
    if (inboundLock.reconciliationRequired) {
      inboundAction = denyInbound(
        'LABEL_RECONCILIATION_REQUIRED',
        inboundLock.lockStale
          ? this.STALE_LOCK_REASON
          : 'Die letzte Erstellung des Einsendelabels bei DHL hat keine eindeutige Antwort geliefert. Bitte zuerst im DHL-Geschäftskundenportal prüfen, ob die Sendung angelegt wurde, und den Abgleich abschließen.'
      );
    } else if (inboundLock.inProgress) {
      inboundAction = denyInbound('LABEL_CREATION_IN_PROGRESS', 'Das Einsendelabel wird gerade erstellt. Bitte kurz warten und die Seite neu laden.');
    } else if (inbound.hasLabel || inbound.trackingNumber) {
      inboundAction = denyInbound('INBOUND_LABEL_EXISTS', 'Für die Einsendung wurde bereits ein Label erstellt.');
    } else if (String(order.status || '') === 'cancelled') {
      inboundAction = denyInbound('INBOUND_ORDER_CANCELLED', 'Der Auftrag ist storniert.');
    } else {
      inboundAction = {
        allowed: true,
        code: 'OK',
        reason: inboundAtBooking
          ? 'Erstellt das Einsendelabel der Buchung: Absender ist der Kunde, Empfänger McRepair.'
          : 'Erstellt ein DHL-Retourenlabel für die Einsendung: Absender ist der Kunde, Empfänger McRepair.',
        target: inboundAtBooking ? 'booking' : 'order',
        bookingId: inboundAtBooking ? booking._id : null
      };
    }

    return {
      order,
      booking,
      legacyInboundTrackingNumber: legacyInboundInOutboundSlot ? orderTracking : '',
      shipments: {
        outbound,
        inbound,
        inboundLabels,
        outboundAction,
        inboundAction,
        legacy: {
          inboundInOutboundSlot: legacyInboundInOutboundSlot,
          bookingOutboundLabel: booking && bookingLabelDirection === 'outbound' && booking.trackingNumber
            ? { bookingId: booking._id, trackingNumber: booking.trackingNumber }
            : null
        }
      }
    };
  }

  /**
   * POST mit HARTER Gesamtfrist. axios' 'timeout' ist in Node nur ein Leerlauf-Timeout des
   * Sockets (req.setTimeout): eine tropfende oder stockende Antwort (grosses Base64-PDF) kann
   * ihn beliebig lange ueberleben - und damit die Frist der Label-Reservierung, nach der die
   * Oberflaeche den Abgleich anbietet. Hier bricht ein AbortController die Anfrage nach
   * totalTimeoutMs in jedem Fall ab (Verbindung wird geschlossen); die Frist gewinnt auch dann,
   * wenn der Transport den Abbruch nicht sofort meldet. Der Fehler traegt code 'ECONNABORTED'
   * und gilt damit als UNKLARES Ergebnis (isIndeterminateTransportError): die Anfrage war
   * bereits raus, ob DHL das Label angelegt hat, ist offen.
   */
  static async postWithDeadline(url, body, config = {}, totalTimeoutMs = this.LABEL_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`DHL-Anfrage nach Ablauf der Gesamtfrist von ${totalTimeoutMs} ms abgebrochen`);
        error.code = 'ECONNABORTED';
        error.deadlineExceeded = true;
        reject(error);
        controller.abort();
      }, totalTimeoutMs);
    });
    try {
      return await Promise.race([
        axios.post(url, body, { ...config, timeout: config.timeout || totalTimeoutMs, signal: controller.signal }),
        deadline
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sendet EINE Sendung an Parcel DE Shipping v2 und wertet die Antwort aus.
   * Wirft bei unklarem Ergebnis einen Fehler mit `indeterminate: true` (siehe
   * isIndeterminateTransportError) - der Aufrufer darf dann NICHT erneut senden.
   */
  static async sendParcelDeShipment(parcelDeConfig, shipmentPayload, { beforeSend } = {}) {
    console.log('DHLService: Sending shipment request to DHL Parcel DE Shipping API');
    console.log('DHLService: Endpoint:', `${parcelDeConfig.baseUrl}/parcel/de/shipping/v2/orders`);
    console.log('DHLService: Shipment payload:', JSON.stringify(shipmentPayload, null, 2));

    // Ein Fehler bis hierher (Token) ist eindeutig: es wurde noch nichts angelegt.
    const accessToken = await this.getAccessToken(parcelDeConfig, { context: 'label' });
    // Letzte Pruefung unmittelbar vor dem bezahlten Aufruf (z. B. Frist der Reservierung,
    // assertLabelClaimActive). Ein Fehler hier ist ebenfalls eindeutig: nichts angelegt.
    if (typeof beforeSend === 'function') {
      await beforeSend();
    }

    let response;
    try {
      // Harte Gesamtfrist (nicht nur Leerlauf-Timeout): die Reservierung rechnet damit.
      response = await this.postWithDeadline(
        `${parcelDeConfig.baseUrl}/parcel/de/shipping/v2/orders`,
        shipmentPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        },
        this.LABEL_REQUEST_TIMEOUT_MS
      );
    } catch (error) {
      if (this.isIndeterminateTransportError(error)) {
        const unknown = new ShippingLabelError(
          'DHL hat nicht rechtzeitig bzw. nicht eindeutig geantwortet. Ob das Label angelegt wurde, ist unklar. '
          + 'Bitte NICHT erneut erstellen, sondern zuerst im DHL-Geschäftskundenportal prüfen und den Abgleich abschließen.',
          { code: 'DHL_RESULT_UNKNOWN', status: 409, retryable: false, details: [String(error?.code || error?.message || '')] }
        );
        unknown.indeterminate = true;
        unknown.transportReason = String(error?.code || error?.response?.status || 'timeout');
        throw unknown;
      }
      throw error;
    }

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

    // Parcel DE Shipping v2 returns shipment identifiers directly in the order response.
    const trackingNumber =
      response.data.shipmentNo ||
      response.data.shipmentNumber ||
      response.data.trackingNumber ||
      response.data.items?.[0]?.shipmentNo ||
      response.data.items?.[0]?.shipmentNumber;
    const returnedShipmentId = response.data.shipmentId || response.data.shipmentNo || response.data.orderNo;
    const labelId = response.data.labelId || response.data.items?.[0]?.labelId;

    const base64Label =
      response.data?.label?.b64 ||
      response.data?.shipmentLabel?.b64 ||
      response.data?.items?.[0]?.label?.b64;
    const labelUrl = base64Label ? `data:application/pdf;base64,${base64Label}` : '';

    const resolvedTracking = trackingNumber || returnedShipmentId || '';
    if (!resolvedTracking || !labelUrl) {
      // DHL hat geantwortet, aber ohne Sendungsnummer bzw. ohne PDF. Die Sendung kann
      // trotzdem angelegt sein - ein neuer Versuch waere ein moegliches Doppel-Label.
      const unknown = new ShippingLabelError(
        resolvedTracking
          ? `DHL hat die Sendung ${resolvedTracking} angelegt, aber kein PDF-Label zurückgegeben. Bitte das Label im DHL-Geschäftskundenportal abrufen und den Abgleich abschließen.`
          : 'DHL hat keine Sendungsnummer zurückgegeben. Ob das Label angelegt wurde, ist unklar. Bitte im DHL-Geschäftskundenportal prüfen und den Abgleich abschließen.',
        { code: 'DHL_RESULT_UNKNOWN', status: 409, retryable: false }
      );
      unknown.indeterminate = true;
      unknown.trackingNumber = resolvedTracking;
      unknown.transportReason = resolvedTracking ? 'label-missing' : 'tracking-missing';
      throw unknown;
    }

    console.log('DHLService: Shipment created successfully:', resolvedTracking);
    return { trackingNumber: resolvedTracking, labelUrl, shipmentId: returnedShipmentId, labelId };
  }

  static buildParcelDeConsignee(delivery, contact = {}) {
    const address = delivery.address;
    const contactFields = {
      ...(this.sanitizeEmail(contact.email) ? { email: this.sanitizeEmail(contact.email) } : {}),
      ...(this.sanitizePhone(contact.phone) ? { phone: this.sanitizePhone(contact.phone) } : {})
    };

    if (address.deliveryType === 'packstation') {
      // Parcel DE Shipping v2, Schema "Locker": Pflichtfelder name, lockerID (Ganzzahl
      // 100-999), postNumber, postalCode, city - KEIN name1, keine Strasse.
      return {
        name: delivery.name,
        lockerID: Number(address.packstationNumber),
        postNumber: address.postNumber,
        postalCode: address.postalCode,
        city: address.city,
        country: this.countryCodeToIso3(address.country)
      };
    }

    return {
      name1: delivery.name,
      addressStreet: address.street,
      addressHouse: address.house,
      postalCode: address.postalCode,
      city: address.city,
      country: this.countryCodeToIso3(address.country),
      ...contactFields
    };
  }

  /**
   * Reservierung behalten und den Abgleich-Marker setzen - nur, solange die Reservierung
   * noch dieser Anfrage gehoert (claimedAt, siehe outboundClaimFence). Gehoert sie inzwischen
   * einer anderen Anfrage, wird nur die Sendungsnummer im Verlauf festgehalten.
   */
  static async markOutboundReconciliationRequired(orderId, { reference, trackingNumber = '', kind = 'timeout', claimedAt } = {}) {
    const result = await Order.updateOne(
      claimedAt ? this.outboundClaimFence(orderId, claimedAt) : { _id: orderId, shippingLabelCreationInProgress: true },
      {
        $set: {
          shippingStatusDescription: kind === 'persist-failed' || kind === 'label-missing'
            ? 'Label bei DHL erstellt, aber nicht vollständig gespeichert – Abgleich erforderlich'
            : 'Ergebnis der DHL-Labelerstellung unklar – Abgleich erforderlich'
        },
        $push: {
          timeline: {
            status: 'Shipping Label Reconciliation Required',
            description: this.reconciliationMarkerText({ kind, what: 'Versandlabel der Auslieferung (McRepair → Kunde)', trackingNumber, reference }),
            completedAt: new Date(),
            staffId: 'system',
            staffName: 'DHL Parcel Integration'
          }
        }
      },
      this.LOCK_WRITE_OPTIONS
    );
    if (claimedAt && (!result || result.matchedCount === 0)) {
      await this.recordOrphanedLabel(orderId, { direction: 'outbound', trackingNumber, reference });
      return false;
    }
    return true;
  }

  /**
   * Atomare Reservierung des EINSENDEplatzes am Auftrag (return*). Gemeinsam genutzt von der
   * DHL-Retoure (DHLReturnsService.createReturnLabelForOrder) und dem Parcel-DE-Einsendelabel
   * (createInboundShipment, z. B. Reklamation): frei ist der Platz nur ohne PDF, ohne
   * Sendungsnummer und ohne laufende/abgeschlossene Erstellung.
   */
  static inboundClaimFilter(orderId) {
    return {
      _id: orderId,
      returnLabelUrl: { $in: ['', null] },
      returnTrackingNumber: { $in: ['', null] },
      returnShipmentStatus: { $nin: ['pending', 'label-created', 'in-transit', 'delivered'] }
    };
  }

  /**
   * Reservierung nach einem EINDEUTIGEN Fehler freigeben (DHL hat nichts angelegt) - nur die
   * EIGENE Reservierung (claimedAt), nie die einer spaeteren Anfrage.
   */
  static async releaseInboundClaim(orderId, claimedAt) {
    return Order.updateOne(
      claimedAt ? this.inboundClaimFence(orderId, claimedAt) : { _id: orderId, returnShipmentStatus: 'pending' },
      { $set: { returnShipmentStatus: '', returnShipmentStatusDescription: '' }, $unset: { returnLabelCreationStartedAt: '' } },
      this.LOCK_WRITE_OPTIONS
    );
  }

  /**
   * Einsendung am Auftrag: Reservierung behalten und den Abgleich-Marker setzen - nur fuer die
   * eigene Reservierung (claimedAt); sonst nur die Sendungsnummer im Verlauf festhalten.
   */
  static async markInboundReconciliationRequired(orderId, { reference, trackingNumber = '', kind = 'timeout', product = 'Einsendelabel', claimedAt } = {}) {
    const result = await Order.updateOne(
      claimedAt ? this.inboundClaimFence(orderId, claimedAt) : { _id: orderId, returnShipmentStatus: 'pending' },
      {
        $set: {
          returnShipmentStatusDescription: kind === 'persist-failed' || kind === 'label-missing'
            ? 'Einsendelabel bei DHL erstellt, aber nicht vollständig gespeichert – Abgleich erforderlich'
            : 'Ergebnis der DHL-Labelerstellung unklar – Abgleich erforderlich'
        },
        $push: {
          timeline: {
            status: 'Inbound Label Reconciliation Required',
            description: this.reconciliationMarkerText({ kind, what: `${product} (Kunde → McRepair)`, trackingNumber, reference }),
            completedAt: new Date(),
            staffId: 'system',
            staffName: 'DHL Parcel Integration'
          }
        }
      },
      this.LOCK_WRITE_OPTIONS
    );
    if (claimedAt && (!result || result.matchedCount === 0)) {
      await this.recordOrphanedLabel(orderId, { direction: 'inbound', trackingNumber, reference, product });
      return false;
    }
    return true;
  }

  /** Gemeinsame Pruefung beider Abgleich-Endpunkte: nur bei Marker oder verwaister Sperre. */
  static assertReconcilable(view, { noneMessage }) {
    if (view.reconciliationRequired) return;
    if (view.inProgress) {
      const minutes = Math.round(this.LABEL_LOCK_LEASE_MS / 60000);
      throw new ShippingLabelError(
        `Die Label-Erstellung läuft gerade noch. Ein Abgleich ist erst möglich, wenn DHL geantwortet hat oder die Anfrage nach ${minutes} Minuten als abgebrochen gilt. Bitte die Seite später neu laden.`,
        { code: 'LABEL_CREATION_IN_PROGRESS', status: 409, retryable: true }
      );
    }
    throw new ShippingLabelError(noneMessage, { code: 'NO_RECONCILIATION_PENDING', status: 409 });
  }

  static normalizeReconcileTracking(trackingNumber) {
    const cleanTracking = String(trackingNumber || '').replace(/\s+/g, '');
    if (!/^[0-9A-Za-z]{8,40}$/.test(cleanTracking)) {
      throw new ShippingLabelError('Bitte die DHL-Sendungsnummer aus dem Geschäftskundenportal angeben (8 bis 40 Ziffern/Buchstaben).', {
        code: 'TRACKING_NUMBER_INVALID',
        status: 422
      });
    }
    return cleanTracking;
  }

  /**
   * Filter auf GENAU die beim Lesen beobachtete Sperre: dieselbe Startzeit bzw. - im
   * Altbestand ohne Startzeit - keine. Hat zwischen Lesen und Schreiben jemand anderes
   * abgeglichen und eine neue Anfrage reserviert, trifft der Abgleich diese NICHT
   * (matchedCount 0 -> 409 NO_RECONCILIATION_PENDING).
   */
  static observedLockFilter(field, startedAt) {
    return { [field]: startedAt === undefined || startedAt === null ? null : startedAt };
  }

  /**
   * Eine per Abgleich uebernommene Sendungsnummer darf nicht schon einem ANDEREN Auftrag oder
   * einer Buchung gehoeren (Einsendelabel/Rueckweg-Label/Retoure der Buchung, Sendungen anderer
   * Auftraege). Nur INNERHALB von withTrackingNumberLock aufrufen - sonst koennen zwei
   * gleichzeitige Abgleiche beide "frei" lesen.
   */
  static async assertTrackingNumberUnused(orderId, cleanTracking, { targetLabel }) {
    const Booking = require('../models/Booking');
    const [otherOrder, booking] = await Promise.all([
      Order.findOne({ _id: { $ne: orderId }, $or: [{ trackingNumber: cleanTracking }, { returnTrackingNumber: cleanTracking }] })
        .setOptions({ skipAutoPopulate: true })
        .select('orderNumber')
        .lean(),
      Booking.findOne({ $or: [{ trackingNumber: cleanTracking }, { returnTrackingNumber: cleanTracking }] })
        .setOptions({ skipAutoPopulate: true })
        .select('bookingNumber trackingNumber returnTrackingNumber timeline.status timeline.description')
        .lean()
    ]);
    if (!otherOrder && !booking) return;
    let owner;
    if (otherOrder) {
      owner = `dem Auftrag ${otherOrder.orderNumber || String(otherOrder._id)}`;
    } else {
      // Welches Label der Buchung? booking.trackingNumber traegt im Altbestand beide Richtungen.
      let bookingLabel = 'Retourenlabel (Kunde → McRepair)';
      if (String(booking.trackingNumber || '').replace(/\s+/g, '') === cleanTracking) {
        bookingLabel = this.resolveStoredBookingLabelDirection(booking) === 'outbound'
          ? 'Rückweg-Label (McRepair → Kunde)'
          : 'Einsendelabel (Kunde → McRepair)';
      }
      owner = `der Buchung ${booking.bookingNumber || String(booking._id)} als ${bookingLabel}`;
    }
    throw new ShippingLabelError(
      `Die Sendungsnummer ${cleanTracking} ist bereits ${owner} zugeordnet und kann nicht als ${targetLabel} dieses Auftrags übernommen werden.`,
      { code: 'TRACKING_NUMBER_ALREADY_USED', status: 422 }
    );
  }

  /**
   * SPERRE JE SENDUNGSNUMMER fuer den Abgleich 'created'. Pruefen (assertTrackingNumberUnused)
   * und Schreiben laufen unter dieser Sperre; zwei Admins, die dieselbe Nummer gleichzeitig an
   * zwei Auftraegen abgleichen, werden so nacheinander ausgefuehrt - der zweite sieht die Nummer
   * am ersten Auftrag und bekommt 422.
   *
   * Bewusst KEIN Unique-Index auf Order/Booking.trackingNumber: der Altbestand enthaelt doppelte
   * Nummern (u. a. Einsendelabel, die zusaetzlich im Auftrag stehen), ein solcher Index wuerde
   * beim Anlegen scheitern bzw. bestehende Datensaetze unspeicherbar machen. Die Sperre nutzt
   * stattdessen eine eigene, anfangs leere Sammlung, deren Eindeutigkeit allein das immer
   * vorhandene _id-Feld traegt (kein zusaetzlicher Index noetig). Ein Eintrag lebt nur fuer die
   * Dauer eines Abgleichs; ein verwaister Eintrag (Prozessabbruch) wird nach
   * TRACKING_NUMBER_LOCK_STALE_MS uebernommen.
   */
  static TRACKING_NUMBER_LOCK_COLLECTION = 'dhltrackingnumberlocks';

  static TRACKING_NUMBER_LOCK_STALE_MS = 60 * 1000;

  static TRACKING_NUMBER_LOCK_WAIT_MS = 5 * 1000;

  static async withTrackingNumberLock(cleanTracking, orderId, work) {
    const locks = Order.db.collection(this.TRACKING_NUMBER_LOCK_COLLECTION);
    const token = crypto.randomUUID();
    const waitUntil = Date.now() + this.TRACKING_NUMBER_LOCK_WAIT_MS;
    for (;;) {
      try {
        await locks.insertOne({ _id: cleanTracking, token, orderId, lockedAt: new Date() });
        break;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
      const stale = await locks.deleteOne({
        _id: cleanTracking,
        lockedAt: { $lt: new Date(Date.now() - this.TRACKING_NUMBER_LOCK_STALE_MS) }
      });
      if (stale?.deletedCount > 0) continue;
      if (Date.now() >= waitUntil) {
        throw new ShippingLabelError(
          `Die Sendungsnummer ${cleanTracking} wird gerade von einem anderen Abgleich übernommen. Bitte die Seite neu laden und prüfen, ob sie bereits zugeordnet ist.`,
          { code: 'TRACKING_NUMBER_BUSY', status: 409 }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 40 + Math.floor(Math.random() * 40)));
    }
    try {
      return await work();
    } finally {
      try {
        await locks.deleteOne({ _id: cleanTracking, token });
      } catch (releaseError) {
        // Nicht fatal: ein liegengebliebener Eintrag wird nach Ablauf uebernommen.
        console.error('DHLService: Could not release tracking number lock:', releaseError.message);
      }
    }
  }

  /**
   * Offenen Abgleich nach einer unklaren DHL-Antwort abschliessen (nur Administratoren).
   *  - resolution 'not-created': bei DHL keine Sendung vorhanden -> Sperre loesen.
   *  - resolution 'created' + trackingNumber: Sendung existiert -> Sendungsnummer uebernehmen
   *    (das PDF muss dann im DHL-Portal abgerufen werden).
   * Nur zulaessig, wenn ein Abgleich-Marker vorliegt oder die Sperre verwaist ist - eine noch
   * laufende Anfrage darf nicht "freigegeben" werden (sonst zweites bezahltes Label).
   */
  static async reconcileOutboundShipment(orderId, { resolution, trackingNumber } = {}, actor = {}) {
    const state = await this.getOrderShipmentState(orderId);
    if (state.order.shippingLabelCreationInProgress !== true) {
      throw new ShippingLabelError('Für diesen Auftrag ist kein Abgleich offen.', { code: 'NO_RECONCILIATION_PENDING', status: 409 });
    }
    this.assertReconcilable(state.shipments.outbound, { noneMessage: 'Für diesen Auftrag ist kein Abgleich offen.' });

    const actorName = String(actor.name || actor.email || 'Administrator');
    const normalizedResolution = String(resolution || '').trim();
    const staleNote = state.shipments.outbound.lockStale ? ' (verwaiste Sperre)' : '';
    const lockFilter = {
      _id: orderId,
      shippingLabelCreationInProgress: true,
      ...this.observedLockFilter('shippingLabelCreationStartedAt', state.order.shippingLabelCreationStartedAt)
    };
    let result;

    if (normalizedResolution === 'not-created') {
      result = await Order.updateOne(
        lockFilter,
        {
          $set: { shippingLabelCreationInProgress: false, shippingStatusDescription: '' },
          $unset: { shippingLabelCreationStartedAt: '' },
          $push: {
            timeline: {
              status: 'Shipping Label Reconciled',
              description: `Abgleich abgeschlossen${staleNote}: Bei DHL wurde keine Sendung angelegt (geprüft von ${actorName}). Das Versandlabel kann neu erstellt werden.`,
              completedAt: new Date(),
              staffId: String(actor._id || 'system'),
              staffName: actorName
            }
          }
        },
        this.LOCK_WRITE_OPTIONS
      );
    } else if (normalizedResolution === 'created') {
      const cleanTracking = this.normalizeReconcileTracking(trackingNumber);
      // Eine Sendungsnummer der EINSENDUNG darf nie als Auslieferung uebernommen werden.
      // booking.trackingNumber nur, wenn das gespeicherte Buchungslabel ein EINSENDElabel ist -
      // ein altes Rueckweg-Label der Buchung meldet assertTrackingNumberUnused als solches.
      const inboundNumbers = [
        state.order.returnTrackingNumber,
        state.booking && this.resolveStoredBookingLabelDirection(state.booking) === 'inbound' ? state.booking.trackingNumber : '',
        state.booking?.returnTrackingNumber,
        state.legacyInboundTrackingNumber
      ].map((value) => String(value || '').replace(/\s+/g, '')).filter(Boolean);
      if (inboundNumbers.includes(cleanTracking)) {
        throw new ShippingLabelError(
          `Die Sendungsnummer ${cleanTracking} gehört zur Einsendung (Kunde → McRepair) und kann nicht als Auslieferung übernommen werden.`,
          { code: 'TRACKING_NUMBER_WRONG_DIRECTION', status: 422 }
        );
      }
      // Pruefen und Schreiben unter der Sperre der Sendungsnummer (kein Doppel bei parallelen Abgleichen).
      // Das Auslieferungsfeld traegt danach NUR diese Sendung: kein PDF (das liegt im
      // DHL-Portal), keine Ereignisse/Zustellung einer frueheren Einsende-Kopie (Altbestand).
      result = await this.withTrackingNumberLock(cleanTracking, orderId, async () => {
        await this.assertTrackingNumberUnused(orderId, cleanTracking, { targetLabel: 'Auslieferung (McRepair → Kunde)' });
        return Order.updateOne(
          lockFilter,
          {
            $set: {
              shippingLabelCreationInProgress: false,
              trackingNumber: cleanTracking,
              carrier: 'DHL',
              shippingLabelUrl: '',
              shippingStatus: 'label-created',
              shippingStatusDescription: 'Sendung bei DHL angelegt (per Abgleich übernommen) – PDF-Label im DHL-Geschäftskundenportal abrufen',
              trackingEvents: [],
              actualDelivery: null,
              estimatedDelivery: null
            },
            $unset: { shippingLabelCreationStartedAt: '' },
            $push: {
              timeline: {
                status: 'Shipping Label Reconciled',
                description: `Abgleich abgeschlossen${staleNote}: Sendung ${cleanTracking} existiert bei DHL und wurde als Auslieferung (McRepair → Kunde) übernommen (geprüft von ${actorName}).`,
                completedAt: new Date(),
                staffId: String(actor._id || 'system'),
                staffName: actorName
              }
            }
          },
          this.LOCK_WRITE_OPTIONS
        );
      });
    } else {
      throw new ShippingLabelError('Unbekannte Abgleich-Entscheidung.', { code: 'RECONCILIATION_RESOLUTION_INVALID', status: 422 });
    }

    if (!result || result.matchedCount === 0) {
      throw new ShippingLabelError('Der Abgleich wurde bereits von einer anderen Person abgeschlossen. Bitte die Seite neu laden.', {
        code: 'NO_RECONCILIATION_PENDING',
        status: 409
      });
    }

    return (await this.getOrderShipmentState(orderId)).shipments;
  }

  /**
   * Abgleich der EINSENDUNG am Auftrag (return*: DHL-Retoure oder Parcel-DE-Einsendelabel,
   * z. B. Reklamation) nach unklarer DHL-Antwort oder verwaister Reservierung (nur Admins).
   * Gleiche Regeln wie reconcileOutboundShipment.
   */
  static async reconcileInboundShipment(orderId, { resolution, trackingNumber } = {}, actor = {}) {
    const state = await this.getOrderShipmentState(orderId);
    if (String(state.order.returnShipmentStatus || '') !== 'pending') {
      throw new ShippingLabelError('Für die Einsendung dieses Auftrags ist kein Abgleich offen.', { code: 'NO_RECONCILIATION_PENDING', status: 409 });
    }
    this.assertReconcilable(state.shipments.inbound, { noneMessage: 'Für die Einsendung dieses Auftrags ist kein Abgleich offen.' });

    const actorName = String(actor.name || actor.email || 'Administrator');
    const normalizedResolution = String(resolution || '').trim();
    const staleNote = state.shipments.inbound.lockStale ? ' (verwaiste Reservierung)' : '';
    const lockFilter = {
      _id: orderId,
      returnShipmentStatus: 'pending',
      ...this.observedLockFilter('returnLabelCreationStartedAt', state.order.returnLabelCreationStartedAt)
    };
    let result;

    if (normalizedResolution === 'not-created') {
      result = await Order.updateOne(
        lockFilter,
        {
          $set: { returnShipmentStatus: '', returnShipmentStatusDescription: '' },
          $unset: { returnLabelCreationStartedAt: '' },
          $push: {
            timeline: {
              status: 'Inbound Label Reconciled',
              description: `Abgleich der Einsendung abgeschlossen${staleNote}: Bei DHL wurde kein Einsendelabel angelegt (geprüft von ${actorName}). Das Einsendelabel kann neu erstellt werden.`,
              completedAt: new Date(),
              staffId: String(actor._id || 'system'),
              staffName: actorName
            }
          }
        },
        this.LOCK_WRITE_OPTIONS
      );
    } else if (normalizedResolution === 'created') {
      const cleanTracking = this.normalizeReconcileTracking(trackingNumber);
      // Die Auslieferung dieses Auftrags (auch eine noch nicht bereinigte Kopie im
      // Auslieferungsfeld) ist die falsche Richtung ...
      const outboundNumbers = [state.shipments.outbound.trackingNumber, state.order.trackingNumber]
        .map((value) => String(value || '').replace(/\s+/g, ''))
        .filter(Boolean);
      if (outboundNumbers.includes(cleanTracking) && cleanTracking === String(state.legacyInboundTrackingNumber || '').replace(/\s+/g, '')) {
        throw new ShippingLabelError(
          `Die Sendungsnummer ${cleanTracking} ist bereits als früheres Einsendelabel an diesem Auftrag gespeichert und kann nicht als neues Einsendelabel übernommen werden.`,
          { code: 'TRACKING_NUMBER_ALREADY_USED', status: 422 }
        );
      }
      if (outboundNumbers.includes(cleanTracking)) {
        throw new ShippingLabelError(
          `Die Sendungsnummer ${cleanTracking} gehört zur Auslieferung (McRepair → Kunde) und kann nicht als Einsendung übernommen werden.`,
          { code: 'TRACKING_NUMBER_WRONG_DIRECTION', status: 422 }
        );
      }
      // ... und eine Nummer der Buchung (Einsendelabel/Retoure) oder eines anderen Auftrags
      // ist bereits vergeben - so streng wie der Abgleich der Auslieferung.
      // Pruefen und Schreiben unter der Sperre der Sendungsnummer (kein Doppel bei parallelen Abgleichen).
      result = await this.withTrackingNumberLock(cleanTracking, orderId, async () => {
        await this.assertTrackingNumberUnused(orderId, cleanTracking, { targetLabel: 'Einsendung (Kunde → McRepair)' });
        return Order.updateOne(
          lockFilter,
          {
            $set: {
              returnTrackingNumber: cleanTracking,
              returnShipmentId: cleanTracking,
              returnLabelUrl: '',
              returnQRCodeUrl: '',
              returnShipmentStatus: 'label-created',
              returnShipmentStatusDescription: 'Einsendelabel bei DHL angelegt (per Abgleich übernommen) – PDF-Label im DHL-Geschäftskundenportal abrufen',
              returnCreatedAt: new Date()
            },
            $unset: { returnLabelCreationStartedAt: '' },
            $push: {
              timeline: {
                status: 'Inbound Label Reconciled',
                description: `Abgleich der Einsendung abgeschlossen${staleNote}: Sendung ${cleanTracking} existiert bei DHL und wurde als Einsendung (Kunde → McRepair) übernommen (geprüft von ${actorName}).`,
                completedAt: new Date(),
                staffId: String(actor._id || 'system'),
                staffName: actorName
              }
            }
          },
          this.LOCK_WRITE_OPTIONS
        );
      });
    } else {
      throw new ShippingLabelError('Unbekannte Abgleich-Entscheidung.', { code: 'RECONCILIATION_RESOLUTION_INVALID', status: 422 });
    }

    if (!result || result.matchedCount === 0) {
      throw new ShippingLabelError('Der Abgleich wurde bereits von einer anderen Person abgeschlossen. Bitte die Seite neu laden.', {
        code: 'NO_RECONCILIATION_PENDING',
        status: 409
      });
    }

    return (await this.getOrderShipmentState(orderId)).shipments;
  }

  /**
   * Create a shipment and generate a shipping label using DHL Parcel DE Shipping v2.
   *
   * @param {string} orderId
   * @param {Object} shipmentData  fachliche Angaben des Aufrufers (Gewicht, Produkt, bei
   *   Einsendungen die Parteien). Rohe DHL-Payloads werden NICHT mehr angenommen.
   * @param {Object} [options]     serverseitige Angaben, nie aus dem Request:
   *   options.direction 'outbound' | 'inbound' - verbindliche Richtung
   *   options.persist   false = nichts am Auftrag speichern (Buchungs-Einsendelabel; die
   *                     Buchung haelt Label, Sperre und Idempotenz selbst)
   */
  static async createShipment(orderId, shipmentData = {}, options = {}) {
    console.log('DHLService: Creating shipment for order:', orderId);
    const data = shipmentData && typeof shipmentData === 'object' ? shipmentData : {};

    let dhlConfig;
    try {
      dhlConfig = await this.getDHLConfig();
    } catch (error) {
      const dhlError = this.getDhlErrorDetails(error, { context: 'label' });
      throw new ShippingLabelError(dhlError.message || 'Versandlabel konnte nicht erstellt werden.', {
        code: dhlError.code,
        status: dhlError.status,
        retryable: dhlError.retryable,
        details: dhlError.details
      });
    }

    const direction = this.resolveShipmentDirection(data, options, dhlConfig);
    console.log('DHLService: Shipment direction:', direction);

    // options.actor (HIST-16): die Person, die das Label ausloest - fuer den Verlaufseintrag.
    return direction === 'outbound'
      ? this.createOutboundShipment(orderId, data, dhlConfig, options)
      : this.createInboundShipment(orderId, data, dhlConfig, options);
  }

  /**
   * Richtung einer Sendung. Verbindlich ist die serverseitige Angabe (options.direction),
   * danach eine ausdrueckliche Angabe des Aufrufers. Nur fuer Altaufrufer ohne Angabe
   * (z. B. das Reklamationslabel) entscheidet die tatsaechliche Absenderpartei: ist der
   * Absender NICHT der konfigurierte Shop, ist es keine Auslieferung.
   */
  static resolveShipmentDirection(shipmentData = {}, options = {}, dhlConfig = null) {
    const declared = String(options.direction || shipmentData.labelDirection || '').trim().toLowerCase();
    if (declared === 'inbound' || declared === 'outbound') return declared;
    if (shipmentData.shipperFromConfiguration === true) return 'outbound';
    if (shipmentData.receiverFromConfiguration === true) return 'inbound';

    const requestedShipperStreet = String(shipmentData.shipperStreet || shipmentData.shipperAddress || '').trim();
    if (!requestedShipperStreet) return 'outbound';

    const shop = this.resolveConfiguredShopAddress(dhlConfig);
    const requested = this.resolveStreetAndHouse([{ street: requestedShipperStreet, house: shipmentData.shipperNumber }]);
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
    const shipperIsShop = normalize(requested.street) === normalize(shop.street)
      && normalize(shipmentData.shipperPostalCode) === normalize(shop.postalCode);
    return shipperIsShop ? 'outbound' : 'inbound';
  }

  /** Auslieferung: McRepair (Absender) -> Lieferadresse des Kunden (Empfaenger). */
  static async createOutboundShipment(orderId, shipmentData, dhlConfig, options = {}) {
    let lockClaimed = false;
    let keepLock = false;
    // Startzeit DIESER Reservierung - bindet alle spaeteren Schreibzugriffe an sie (Fencing).
    let claimedAt = null;

    try {
      const state = await this.getOrderShipmentState(orderId);
      const { order, shipments } = state;

      // Wiederholte Anfrage (Doppelklick, Retry): vorhandenes Label zurueckgeben.
      if (shipments.outbound.hasLabel) {
        return {
          success: true,
          direction: 'outbound',
          trackingNumber: shipments.outbound.trackingNumber,
          labelUrl: '',
          labelDownloadUrl: shipments.outbound.downloadUrl,
          estimatedDelivery: shipments.outbound.estimatedDelivery,
          shipmentId: shipments.outbound.trackingNumber,
          alreadyExists: true
        };
      }

      if (shipments.outbound.trackingNumber && !shipments.outbound.reconciliationRequired && !shipments.outbound.inProgress) {
        throw new ShippingLabelError(
          `Die DHL-Sendung wurde bereits angelegt (Sendungsnummer ${shipments.outbound.trackingNumber}), aber das PDF-Label fehlt. Bitte das Label im DHL-Geschäftskundenportal abrufen, bevor ein neues erzeugt wird.`,
          { code: 'EXISTING_SHIPMENT_LABEL_MISSING', status: 409, retryable: false }
        );
      }

      const eligibility = shipments.outboundAction;
      if (!eligibility.allowed) {
        const conflict = ['LABEL_CREATION_IN_PROGRESS', 'LABEL_RECONCILIATION_REQUIRED'].includes(eligibility.code);
        throw new ShippingLabelError(eligibility.reason, {
          code: eligibility.code,
          status: conflict ? 409 : 422,
          retryable: eligibility.code === 'LABEL_CREATION_IN_PROGRESS'
        });
      }

      // Lieferadresse: Snapshot am Auftrag, Gast, Kundenprofil - nie die Adresse des Shops.
      const Booking = require('../models/Booking');
      const addressSource = await Order.findById(orderId)
        .setOptions({ skipAutoPopulate: true })
        .select('orderNumber customerId guestInfo shippingAddress bookingId')
        .populate('customerId', 'name firstName lastName email phone invoiceAddress paymentAddress')
        .lean();
      const bookingGuest = addressSource?.bookingId
        ? await Booking.findById(addressSource.bookingId).setOptions({ skipAutoPopulate: true }).select('guestInfo').lean()
        : null;
      const delivery = this.resolveDeliveryAddress({
        order: addressSource,
        customer: addressSource?.customerId && typeof addressSource.customerId === 'object' ? addressSource.customerId : null,
        booking: bookingGuest
      });

      if (delivery.missing.length > 0) {
        const where = delivery.source
          ? ` (verwendete Quelle: ${delivery.source === 'order.shippingAddress' ? 'Lieferadresse des Auftrags' : delivery.source.startsWith('customer.') ? 'Kundenprofil' : 'Gastangaben'})`
          : '';
        throw new ShippingLabelError(
          `Die Lieferadresse des Kunden ist unvollständig${where}. Es fehlt: ${delivery.missing.join(', ')}. Bitte die Lieferadresse ergänzen und das Label erneut erstellen.`,
          { code: 'DELIVERY_ADDRESS_MISSING', status: 422, retryable: false, details: delivery.missing }
        );
      }

      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);
      if (!parcelDeConfig.enabledApis.parcelDeShipping) {
        throw new ShippingLabelError(
          'Die DHL-Versand-API (Parcel DE Shipping) ist in den Integrationseinstellungen deaktiviert.',
          { code: 'DHL_SHIPPING_DISABLED', status: 503, retryable: false }
        );
      }

      // Abrechnungsnummer und Absender kommen AUSSCHLIESSLICH aus der Integration.
      const accountId = dhlConfig.settings?.accountId || dhlConfig.settings?.accountNumber || parcelDeConfig.accountNumber;
      if (!accountId) {
        throw new ShippingLabelError(
          'Die DHL Abrechnungsnummer (EKP) fehlt in den Integrationseinstellungen.',
          { code: 'DHL_BILLING_NUMBER_MISSING', status: 503, retryable: false }
        );
      }

      const shop = this.resolveConfiguredShopAddress(dhlConfig);
      const reference = this.buildShipmentReference(order);
      const shipperEmail = this.sanitizeEmail(shop.email);
      const shipperPhone = this.sanitizePhone(shop.phone);
      const singleShipment = {
        product: this.resolveShippingProduct(shipmentData, parcelDeConfig.product),
        billingNumber: accountId,
        refNo: reference,
        shipDate: /^\d{4}-\d{2}-\d{2}$/.test(String(shipmentData.shipmentDate || ''))
          ? shipmentData.shipmentDate
          : new Date().toISOString().slice(0, 10),
        shipper: {
          name1: shop.name,
          addressStreet: shop.street,
          addressHouse: shop.house,
          postalCode: shop.postalCode,
          city: shop.city,
          country: this.countryCodeToIso3(shop.country || 'DE'),
          ...(shipperEmail ? { email: shipperEmail } : {}),
          ...(shipperPhone ? { phone: shipperPhone } : {})
        },
        consignee: this.buildParcelDeConsignee(delivery, { email: delivery.email, phone: delivery.phone }),
        details: {
          weight: { uom: 'kg', value: Number(shipmentData.weight || 1) },
          ...this.buildParcelDeDimensions(shipmentData)
        }
      };

      const payloadProblems = this.validateParcelDeShipment(singleShipment, {
        consigneeIsLocker: delivery.address.deliveryType === 'packstation'
      });
      if (payloadProblems.length > 0) {
        console.error('DHLService: Outbound payload rejected by pre-flight validation:', payloadProblems);
        throw new ShippingLabelError(`Versanddaten unvollständig oder ungültig: ${payloadProblems[0]}`, {
          code: 'DHL_PAYLOAD_INVALID',
          status: 422,
          retryable: false,
          details: payloadProblems
        });
      }

      // Atomare Reservierung: zwei gleichzeitige Klicks koennen nicht beide DHL erreichen.
      // Die Eignung (Status, Zahlungspflicht) wird IM Filter erneut geprueft - zwischen der
      // Pruefung oben und diesem Schreibzugriff kann sich der Auftrag geaendert haben.
      //
      // Eine Einsendelabel-KOPIE aus dem Altbestand im Auslieferungsfeld blockiert nicht, sie
      // wird aber genau HIER - atomar mit der Reservierung - aus dem Auslieferungsfeld entfernt
      // (das Original liegt an der Buchung bzw. Reklamation). So kann weder ein spaeterer
      // Abgleich noch ein Fehlerpfad das alte Einsende-PDF als Auslieferung stehen lassen.
      const freeSlot = { shippingLabelUrl: { $in: ['', null] }, trackingNumber: { $in: ['', null] } };
      const legacyTracking = state.legacyInboundTrackingNumber;
      const claimFilter = {
        _id: orderId,
        shippingLabelCreationInProgress: { $ne: true },
        ...(legacyTracking ? { trackingNumber: legacyTracking } : freeSlot),
        ...this.outboundEligibilityFilter()
      };
      claimedAt = new Date();
      const claimUpdate = {
        $set: {
          shippingLabelCreationInProgress: true,
          shippingLabelCreationStartedAt: claimedAt,
          ...(legacyTracking ? {
            trackingNumber: '',
            shippingLabelUrl: '',
            shippingStatus: 'pending',
            shippingStatusDescription: '',
            trackingEvents: [],
            estimatedDelivery: null,
            actualDelivery: null
          } : {})
        },
        ...(legacyTracking ? {
          $push: {
            timeline: {
              status: 'Legacy Inbound Label Moved',
              description: `Einsendelabel aus dem Altbestand (Sendungsnummer ${legacyTracking}) stand im Auslieferungsfeld und wurde dort für die Auslieferung entfernt. `
                + 'Es bleibt an der Buchung bzw. Reklamation gespeichert.',
              completedAt: claimedAt,
              staffId: 'system',
              staffName: 'DHL Parcel Integration'
            }
          }
        } : {})
      };
      const claimed = await Order.findOneAndUpdate(
        claimFilter,
        claimUpdate,
        { new: true, projection: { _id: 1 }, ...this.LOCK_WRITE_OPTIONS }
      );
      if (!claimed) {
        // Warum nicht? Den aktuellen Stand neu bewerten, damit die Meldung stimmt (Status
        // geaendert, Zahlung erforderlich, parallele Erstellung ...).
        const current = await this.getOrderShipmentState(orderId);
        const recheck = current.shipments.outboundAction;
        if (!recheck.allowed) {
          const conflict = ['LABEL_CREATION_IN_PROGRESS', 'LABEL_RECONCILIATION_REQUIRED', 'OUTBOUND_LABEL_EXISTS'].includes(recheck.code);
          throw new ShippingLabelError(recheck.reason, {
            code: recheck.code,
            status: conflict ? 409 : 422,
            retryable: recheck.code === 'LABEL_CREATION_IN_PROGRESS'
          });
        }
        throw new ShippingLabelError('Das Versandlabel wird bereits erstellt. Bitte kurz warten und die Seite neu laden.', {
          code: 'LABEL_CREATION_IN_PROGRESS',
          status: 409,
          retryable: true
        });
      }
      lockClaimed = true;

      let result;
      try {
        result = await this.sendParcelDeShipment(parcelDeConfig, {
          profile: parcelDeConfig.profile,
          shipments: [singleShipment]
        }, {
          // Frist durchsetzen: nach dem Token-Abruf muss die Reservierung noch DIESER Anfrage
          // gehoeren und die Restfrist den DHL-Timeout abdecken - sonst kein bezahlter Aufruf.
          beforeSend: () => this.assertLabelClaimActive(this.outboundClaimFence(orderId, claimedAt), claimedAt)
        });
      } catch (sendError) {
        if (sendError?.indeterminate) {
          keepLock = true;
          await this.markOutboundReconciliationRequired(orderId, {
            reference,
            trackingNumber: sendError.trackingNumber || '',
            kind: this.reconciliationKindFor(sendError),
            claimedAt
          });
        }
        throw sendError;
      }

      // Ab hier existiert das Label bei DHL: gezielt NUR die Versandfelder schreiben, nie ein
      // volles save() mit Revalidierung fremder Altfelder, das das Label verwerfen koennte.
      const now = new Date();
      const trackingEvent = {
        timestamp: now,
        location: shop.city || 'McRepair',
        status: 'label-created',
        description: 'DHL-Versandlabel für die Auslieferung erstellt'
      };
      // Versandkosten nur bei gueltiger Angabe (Zahl >= 0) ueberschreiben, sonst bleibt der
      // gespeicherte Wert des Auftrags erhalten.
      const requestedCost = shipmentData.shippingCost;
      const costProvided = requestedCost !== undefined && requestedCost !== null && requestedCost !== '';
      const shippingCost = costProvided ? Number(requestedCost) : NaN;
      const estimatedDelivery = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const update = {
        $set: {
          trackingNumber: result.trackingNumber,
          carrier: 'DHL',
          shippingStatus: 'label-created',
          shippingStatusDescription: 'DHL-Versandlabel für die Auslieferung erstellt – noch nicht an DHL übergeben',
          shippingLabelUrl: result.labelUrl,
          ...(Number.isFinite(shippingCost) && shippingCost >= 0 ? { shippingCost } : {}),
          estimatedDelivery,
          shippingLabelCreationInProgress: false
        },
        $unset: { shippingLabelCreationStartedAt: '' },
        $push: {
          timeline: {
            status: 'Shipping Label Created',
            description: `DHL-Versandlabel für die Auslieferung (McRepair → Kunde) erstellt. Sendungsnummer: ${result.trackingNumber}`,
            completedAt: now,
            ...this.timelineActor(options.actor)
          },
          trackingEvents: trackingEvent
        }
      };

      try {
        // Nur schreiben, solange die Reservierung noch DIESER Anfrage gehoert (Fencing).
        const persisted = await Order.updateOne(this.outboundClaimFence(orderId, claimedAt), update, this.LOCK_WRITE_OPTIONS);
        if (!persisted || persisted.matchedCount === 0) {
          const lost = new Error('Die Reservierung gehört inzwischen einer anderen Anfrage bzw. wurde abgeglichen.');
          lost.claimLost = true;
          throw lost;
        }
      } catch (persistError) {
        keepLock = true;
        console.error('DHLService: Outbound label created at DHL but could not be stored:', persistError.message);
        // Eigene Sperre: sie bleibt, der Marker macht den Abgleich sofort moeglich (statt erst
        // nach Ablauf der Frist) und haelt die Sendungsnummer im Verlauf fest. Gehoert die
        // Sperre inzwischen einer anderen Anfrage, wird nur die Sendungsnummer protokolliert.
        await this.markOutboundReconciliationRequired(orderId, {
          reference,
          trackingNumber: result.trackingNumber,
          kind: 'persist-failed',
          claimedAt
        }).catch((markError) => {
          console.error('DHLService: Could not record outbound reconciliation marker:', markError.message);
        });
        throw new ShippingLabelError(
          persistError.claimLost
            ? `Das Versandlabel wurde bei DHL erstellt (Sendungsnummer ${result.trackingNumber}), aber nicht am Auftrag gespeichert, weil diese Label-Erstellung inzwischen abgeglichen bzw. von einer anderen Anfrage übernommen wurde. `
              + 'Bitte das überzählige Label im DHL-Geschäftskundenportal stornieren und den Vorgang NICHT wiederholen.'
            : `Das Versandlabel wurde bei DHL erstellt (Sendungsnummer ${result.trackingNumber}), konnte aber nicht am Auftrag gespeichert werden. `
              + 'Bitte die Sendungsnummer notieren und den Vorgang NICHT wiederholen.',
          { code: 'LABEL_PERSIST_FAILED', status: 500, retryable: false }
        );
      }
      lockClaimed = false;

      console.log('DHLService: Outbound shipment stored on order:', result.trackingNumber);
      return {
        success: true,
        direction: 'outbound',
        trackingNumber: result.trackingNumber,
        labelUrl: result.labelUrl,
        labelDownloadUrl: `/api/orders/${orderId}/shipping-label`,
        estimatedDelivery,
        shipmentId: result.shipmentId,
        labelId: result.labelId
      };
    } catch (error) {
      if (lockClaimed && !keepLock) {
        // Nur die EIGENE Sperre loesen, nie die einer spaeteren Anfrage.
        await Order.updateOne(
          this.outboundClaimFence(orderId, claimedAt),
          { $set: { shippingLabelCreationInProgress: false }, $unset: { shippingLabelCreationStartedAt: '' } },
          this.LOCK_WRITE_OPTIONS
        ).catch((releaseError) => {
          console.error('DHLService: Could not release label creation lock:', releaseError.message);
        });
      }
      console.error('DHLService: Error creating outbound shipment:', error?.message, error?.response?.data || '');
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
   * Einsendung: Kunde (Absender) -> McRepair (Empfaenger). Die Parteien liefert der Aufrufer
   * (Buchung, Reklamation); fehlt der Empfaenger, ist es der konfigurierte Shop.
   * Gespeichert wird im EINSENDEplatz des Auftrags (return*), nie im Auslieferungsfeld -
   * oder, mit options.persist === false, gar nicht (die Buchung speichert selbst).
   */
  static async createInboundShipment(orderId, shipmentData, dhlConfig, options = {}) {
    const persistOnOrder = options.persist !== false;
    let slotClaimed = false;
    let keepClaim = false;
    // Startzeit DIESER Reservierung - bindet alle spaeteren Schreibzugriffe an sie (Fencing).
    let claimedAt = null;

    try {
      const order = await Order.findById(orderId)
        .setOptions({ skipAutoPopulate: true })
        .select('orderNumber customerId shippingAddress returnTrackingNumber returnShipmentStatus returnShipmentId')
        .populate('customerId', 'name email phone invoiceAddress paymentAddress');

      if (!order) {
        throw new ShippingLabelError('Auftrag wurde nicht gefunden.', { code: 'ORDER_NOT_FOUND', status: 404 });
      }

      if (persistOnOrder) {
        const existing = await Order.findOne({ _id: orderId, returnLabelUrl: { $exists: true, $nin: [null, ''] } })
          .setOptions({ skipAutoPopulate: true })
          .select('returnLabelUrl returnTrackingNumber returnShipmentId')
          .lean();
        if (existing) {
          return {
            success: true,
            direction: 'inbound',
            trackingNumber: existing.returnTrackingNumber,
            labelUrl: existing.returnLabelUrl,
            shipmentId: existing.returnShipmentId || existing.returnTrackingNumber,
            alreadyExists: true
          };
        }
        // Sendung existiert (z. B. per Abgleich uebernommen), aber das PDF fehlt: das Label
        // EXISTIERT - kein zweites bezahltes Label, sondern Hinweis auf das DHL-Portal
        // (wie bei der DHL-Retoure, DHLReturnsService.createReturnLabelForOrder).
        if (order.returnTrackingNumber && String(order.returnShipmentStatus || '') !== 'pending') {
          throw new ShippingLabelError(
            `Das Einsendelabel wurde bei DHL bereits angelegt (Sendungsnummer ${order.returnTrackingNumber}), das PDF liegt aber nicht vor. `
            + 'Bitte das Label im DHL-Geschäftskundenportal abrufen, statt ein neues zu erstellen.',
            { code: 'EXISTING_SHIPMENT_LABEL_MISSING', status: 409, retryable: false }
          );
        }
      }

      const customer = order.customerId?.toObject ? order.customerId.toObject() : (order.customerId || {});
      const invoiceAddress = customer?.invoiceAddress || {};
      const paymentAddress = customer?.paymentAddress || {};
      const shop = this.resolveConfiguredShopAddress(dhlConfig);
      const parcelDeConfig = this.getParcelDEConfig(dhlConfig);

      if (!parcelDeConfig.enabledApis.parcelDeShipping) {
        throw new ShippingLabelError(
          'Die DHL-Versand-API (Parcel DE Shipping) ist in den Integrationseinstellungen deaktiviert.',
          { code: 'DHL_SHIPPING_DISABLED', status: 503, retryable: false }
        );
      }

      const accountId =
        shipmentData.accountNumber ||
        dhlConfig.settings?.accountId ||
        dhlConfig.settings?.accountNumber ||
        parcelDeConfig.accountNumber;
      if (!accountId) {
        throw new ShippingLabelError(
          'Die DHL Abrechnungsnummer (EKP) fehlt in den Integrationseinstellungen.',
          { code: 'DHL_BILLING_NUMBER_MISSING', status: 503, retryable: false }
        );
      }

      // Empfaenger ist McRepair: aus der Integration, wenn der Aufrufer ihn nicht liefert.
      const receiverFromShop = shipmentData.receiverFromConfiguration === true
        || !String(shipmentData.receiverAddress || '').trim();
      const receiverPair = receiverFromShop
        ? { street: shop.street, house: shop.house }
        : this.resolveStreetAndHouse([{ street: shipmentData.receiverAddress, house: shipmentData.receiverNumber, source: 'request' }]);
      const receiver = receiverFromShop
        ? { name: shop.name, city: shop.city, postalCode: shop.postalCode, country: shop.country, email: shop.email, phone: shop.phone }
        : {
          name: shipmentData.receiverName,
          city: shipmentData.receiverCity,
          postalCode: shipmentData.receiverPostalCode,
          country: shipmentData.receiverCountry || 'DE',
          email: shipmentData.receiverEmail,
          phone: shipmentData.receiverPhone
        };

      // Absender ist der Kunde, wie vom Aufrufer uebergeben; sonst seine Adresse als PAAR.
      const shipperPair = this.resolveStreetAndHouse([
        { street: shipmentData.shipperStreet || shipmentData.shipperAddress, house: shipmentData.shipperNumber, source: 'request' },
        { street: order.shippingAddress?.deliveryType === 'packstation' ? '' : order.shippingAddress?.street, house: order.shippingAddress?.number, source: 'order.shippingAddress' },
        { street: paymentAddress.deliveryType === 'packstation' ? '' : paymentAddress.street, house: paymentAddress.number, source: 'customer.paymentAddress' },
        { street: invoiceAddress.street, house: invoiceAddress.number, source: 'customer.invoiceAddress' }
      ]);
      const shipperAddressSource = {
        request: shipmentData,
        'order.shippingAddress': { shipperCity: order.shippingAddress?.city, shipperPostalCode: order.shippingAddress?.zipCode, shipperCountry: order.shippingAddress?.country },
        'customer.paymentAddress': { shipperCity: paymentAddress.city, shipperPostalCode: paymentAddress.zipCode, shipperCountry: paymentAddress.country },
        'customer.invoiceAddress': { shipperCity: invoiceAddress.city, shipperPostalCode: invoiceAddress.zipCode, shipperCountry: invoiceAddress.country }
      }[shipperPair.source] || {};

      const firstEmail = (...values) => values.map((value) => this.sanitizeEmail(value)).find(Boolean) || '';
      const firstPhone = (...values) => values.map((value) => this.sanitizePhone(value)).find(Boolean) || '';
      const shipperEmail = firstEmail(shipmentData.shipperEmail, customer?.email);
      const shipperPhone = firstPhone(shipmentData.shipperPhone, customer?.phone);
      const receiverEmail = firstEmail(receiver.email);
      const receiverPhone = firstPhone(receiver.phone);

      const singleShipment = {
        product: this.resolveShippingProduct(shipmentData, parcelDeConfig.product),
        billingNumber: accountId,
        refNo: this.buildShipmentReference(order),
        shipDate: /^\d{4}-\d{2}-\d{2}$/.test(String(shipmentData.shipmentDate || ''))
          ? shipmentData.shipmentDate
          : new Date().toISOString().slice(0, 10),
        shipper: {
          name1: String(shipmentData.shipperName || customer?.name || '').trim(),
          addressStreet: shipperPair.street,
          addressHouse: shipperPair.house,
          postalCode: String(shipperAddressSource.shipperPostalCode || '').trim(),
          city: String(shipperAddressSource.shipperCity || '').trim(),
          country: this.countryCodeToIso3(shipperAddressSource.shipperCountry || 'DE'),
          ...(shipperEmail ? { email: shipperEmail } : {}),
          ...(shipperPhone ? { phone: shipperPhone } : {})
        },
        consignee: {
          name1: String(receiver.name || '').trim(),
          addressStreet: receiverPair.street,
          addressHouse: receiverPair.house,
          postalCode: String(receiver.postalCode || '').trim(),
          city: String(receiver.city || '').trim(),
          country: this.countryCodeToIso3(receiver.country || 'DE'),
          ...(receiverEmail ? { email: receiverEmail } : {}),
          ...(receiverPhone ? { phone: receiverPhone } : {})
        },
        details: {
          weight: { uom: 'kg', value: Number(shipmentData.weight || 1) },
          ...this.buildParcelDeDimensions(shipmentData)
        }
      };

      const payloadProblems = this.validateParcelDeShipment(singleShipment, { consigneeIsLocker: false });
      if (payloadProblems.length > 0) {
        console.error('DHLService: Inbound payload rejected by pre-flight validation:', payloadProblems);
        throw new ShippingLabelError(`Versanddaten unvollständig oder ungültig: ${payloadProblems[0]}`, {
          code: 'DHL_PAYLOAD_INVALID',
          status: 422,
          retryable: false,
          details: payloadProblems
        });
      }

      if (persistOnOrder) {
        claimedAt = new Date();
        const claimed = await Order.findOneAndUpdate(
          this.inboundClaimFilter(orderId),
          { $set: { returnShipmentStatus: 'pending', returnShipmentStatusDescription: 'Einsendelabel wird erstellt', returnLabelCreationStartedAt: claimedAt } },
          { new: true, projection: { _id: 1 }, ...this.LOCK_WRITE_OPTIONS }
        );
        if (!claimed) {
          throw new ShippingLabelError('Das Einsendelabel wird bereits erstellt oder sein Ergebnis wird noch abgeglichen. Bitte kurz warten und die Seite neu laden.', {
            code: 'LABEL_CREATION_IN_PROGRESS',
            status: 409,
            retryable: false
          });
        }
        slotClaimed = true;
      }

      let result;
      try {
        result = await this.sendParcelDeShipment(parcelDeConfig, {
          profile: shipmentData.profile || parcelDeConfig.profile,
          shipments: [singleShipment]
        }, persistOnOrder ? {
          // Frist der Einsende-Reservierung durchsetzen (wie Auslieferung und DHL-Retoure).
          beforeSend: () => this.assertLabelClaimActive(this.inboundClaimFence(orderId, claimedAt), claimedAt)
        } : {});
      } catch (sendError) {
        if (sendError?.indeterminate && persistOnOrder) {
          keepClaim = true;
          await this.markInboundReconciliationRequired(orderId, {
            reference: singleShipment.refNo,
            trackingNumber: sendError.trackingNumber || '',
            kind: this.reconciliationKindFor(sendError),
            claimedAt
          });
        }
        throw sendError;
      }

      if (persistOnOrder) {
        try {
          // Nur schreiben, solange die Reservierung noch DIESER Anfrage gehoert (Fencing).
          const persisted = await Order.updateOne(
            this.inboundClaimFence(orderId, claimedAt),
            {
              $set: {
                returnLabelUrl: result.labelUrl,
                returnTrackingNumber: result.trackingNumber,
                returnShipmentId: result.shipmentId || result.trackingNumber,
                returnShipmentStatus: 'label-created',
                returnShipmentStatusDescription: 'DHL-Einsendelabel (Kunde → McRepair) erstellt',
                returnCreatedAt: new Date()
              },
              $unset: { returnLabelCreationStartedAt: '' },
              $push: {
                timeline: {
                  status: 'Inbound Label Created',
                  description: `DHL-Einsendelabel (Kunde → McRepair) erstellt. Sendungsnummer: ${result.trackingNumber}`,
                  completedAt: new Date(),
                  ...this.timelineActor(options.actor)
                }
              }
            },
            this.LOCK_WRITE_OPTIONS
          );
          if (!persisted || persisted.matchedCount === 0) {
            const lost = new Error('Die Reservierung gehört inzwischen einer anderen Anfrage bzw. wurde abgeglichen.');
            lost.claimLost = true;
            throw lost;
          }
        } catch (persistError) {
          keepClaim = true;
          await this.markInboundReconciliationRequired(orderId, {
            reference: singleShipment.refNo,
            trackingNumber: result.trackingNumber,
            kind: 'persist-failed',
            claimedAt
          }).catch((markError) => {
            console.error('DHLService: Could not record inbound reconciliation marker:', markError.message);
          });
          throw new ShippingLabelError(
            persistError.claimLost
              ? `Das Einsendelabel wurde bei DHL erstellt (Sendungsnummer ${result.trackingNumber}), aber nicht am Auftrag gespeichert, weil diese Label-Erstellung inzwischen abgeglichen bzw. von einer anderen Anfrage übernommen wurde. `
                + 'Bitte das überzählige Label im DHL-Geschäftskundenportal stornieren und den Vorgang NICHT wiederholen.'
              : `Das Einsendelabel wurde bei DHL erstellt (Sendungsnummer ${result.trackingNumber}), konnte aber nicht am Auftrag gespeichert werden. `
                + 'Bitte die Sendungsnummer notieren und den Vorgang NICHT wiederholen.',
            { code: 'LABEL_PERSIST_FAILED', status: 500, retryable: false }
          );
        }
        slotClaimed = false;
      }

      return {
        success: true,
        direction: 'inbound',
        trackingNumber: result.trackingNumber,
        labelUrl: result.labelUrl,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        shipmentId: result.shipmentId,
        labelId: result.labelId,
        shippingCost: Number(shipmentData.shippingCost) || 0
      };
    } catch (error) {
      if (slotClaimed && !keepClaim) {
        await this.releaseInboundClaim(orderId, claimedAt).catch((releaseError) => {
          console.error('DHLService: Could not release inbound label claim:', releaseError.message);
        });
      }
      console.error('DHLService: Error creating inbound shipment:', error?.message, error?.response?.data || '');
      const dhlError = this.getDhlErrorDetails(error, { context: 'label' });
      const wrapped = new ShippingLabelError(dhlError.message || 'Einsendelabel konnte nicht erstellt werden.', {
        code: dhlError.code,
        status: dhlError.status,
        retryable: dhlError.retryable,
        details: dhlError.details
      });
      if (error?.indeterminate) {
        wrapped.indeterminate = true;
        wrapped.trackingNumber = error.trackingNumber || '';
      }
      throw wrapped;
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

      // Altbestand: steht im Auslieferungsfeld nur die KOPIE des Einsendelabels, gehoert der
      // DHL-Status zur Einsendung - er darf nicht als Versandstatus der Auslieferung landen.
      const shipmentState = await this.getOrderShipmentState(orderId);
      if (shipmentState.legacyInboundTrackingNumber) {
        throw new ShippingLabelError(
          `Die hinterlegte Sendungsnummer ${shipmentState.legacyInboundTrackingNumber} gehört zur Einsendung (Kunde → McRepair, Altbestand) und wird nicht als Auslieferung verfolgt.`,
          { code: 'LEGACY_INBOUND_TRACKING', status: 409 }
        );
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
      try {
        await this.updateOrderTracking(order._id);
      } catch (updateError) {
        if (updateError?.code === 'LEGACY_INBOUND_TRACKING') {
          console.warn('DHLService: Webhook for legacy inbound copy ignored:', trackingNumber);
          return { success: false, message: 'Tracking number belongs to an inbound shipment (legacy copy)', orderId: order._id };
        }
        throw updateError;
      }

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
