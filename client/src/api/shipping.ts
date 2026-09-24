import api from './api';

// ── DHL products ─────────────────────────────────────────────────────────────
// Single authoritative list, shared by every shipping-label dialog. Add or remove
// entries HERE only – the dialogs must not hard-code their own lists again.

export interface DhlProduct {
  code: string;
  label: string;
}

export const DHL_PRODUCTS: readonly DhlProduct[] = [
  { code: 'V01PAK', label: 'DHL Paket (national)' },
  { code: 'V53WPAK', label: 'DHL Paket International' },
  { code: 'V54EPAK', label: 'DHL Europaket' },
] as const;

export const DEFAULT_DHL_PRODUCT = DHL_PRODUCTS[0].code;

/**
 * Legacy single-letter service types that older records and requests still use.
 * Mirrors `legacyServiceTypes` in server/services/dhlService.js so stored values
 * stay readable instead of rendering an empty Select.
 */
export const DHL_PRODUCT_ALIASES: Record<string, string> = {
  P: 'V01PAK',
  N: 'V53WPAK',
  Y: 'V54EPAK',
};

export const normalizeDhlProduct = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_DHL_PRODUCT;
  return DHL_PRODUCT_ALIASES[raw] || raw;
};

export const dhlProductLabel = (code?: string): string => {
  const normalized = normalizeDhlProduct(code);
  return DHL_PRODUCTS.find((product) => product.code === normalized)?.label || normalized;
};

/**
 * Mirror of DHLService.splitStreetAndHouse on the server. The checkout collects one
 * combined "Straße und Hausnummer" field while DHL needs the two parts separately.
 */
export const splitStreetAndHouse = (rawStreet?: string): { street: string; house: string } => {
  const value = String(rawStreet || '').replace(/\s+/g, ' ').trim();
  if (!value) return { street: '', house: '' };

  // Trailing house number (DE/AT/CH notation)
  const trailing = value.match(/^(.*?[^\s,])[\s,]*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/);
  if (trailing && /[a-zA-ZäöüÄÖÜß]/.test(trailing[1])) {
    return { street: trailing[1].replace(/[\s,]+$/, '').trim(), house: trailing[2].replace(/\s+/g, '') };
  }

  // Leading house number (NL/US/FR notation)
  const leading = value.match(/^(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s+(.+)$/);
  if (leading && /[a-zA-ZäöüÄÖÜß]/.test(leading[2])) {
    return { street: leading[2].trim(), house: leading[1].replace(/\s+/g, '') };
  }

  return { street: value, house: '' };
};

/**
 * Direction of a booking shipping label. It is an explicit STATEMENT OF THE CALLER and
 * must never be inferred from which address blocks a request happens to contain.
 *
 * 'inbound'  = Einsendelabel: Kunde (Absender) → McRepair (Empfänger). This is what
 *              `booking.trackingNumber` means everywhere in the product
 *              ("Versand an McRepair (Hinweg)", "Sendung des Kunden an McRepair").
 * 'outbound' = McRepair (Absender) → Kunde (Empfänger), the repaired device going back.
 */
export type ShippingLabelDirection = 'inbound' | 'outbound';

export interface ShipmentData {
  /** Explicit label direction; the booking endpoint defaults to 'inbound'. */
  labelDirection?: ShippingLabelDirection;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  serviceType?: string;
  /** Resolved DHL product code (e.g. V01PAK). Wins over `serviceType` on the server. */
  product?: string;
  /**
   * Opt-in for the optional DHL `details.dim` block. Dimensions have never been part of
   * the payload this app sends; set this to true ONLY from a caller that has validated
   * length/width/height against DHL for the chosen product.
   */
  sendDimensions?: boolean;
  /**
   * "Use the shop address configured on the DHL integration and ignore every shipper
   * field in this request." Set it when the caller cannot read the configuration itself
   * (the integrations endpoint is admin-only) – the server then resolves the Absender,
   * and fails with a German message if nothing is configured.
   */
  shipperFromConfiguration?: boolean;
  /**
   * Mirror of `shipperFromConfiguration` for the other side: "the Empfänger is the shop –
   * take its address from the DHL integration and ignore every receiver field here."
   * Used by the booking (inbound) label dialog when the admin-only settings endpoint is
   * not readable for this user.
   */
  receiverFromConfiguration?: boolean;
  shipperAddress?: string;
  shipperStreet?: string;
  shipperNumber?: string;
  shipperCity?: string;
  shipperPostalCode?: string;
  shipperCountry?: string;
  shipperEmail?: string;
  shipperPhone?: string;
  shipperCompany?: string;
  shipperName?: string;
  receiverName?: string;
  receiverAddress?: string;
  receiverCity?: string;
  receiverPostalCode?: string;
  receiverCountry?: string;
  receiverEmail?: string;
  receiverPhone?: string;
  receiverNumber?: string;
  deliveryType?: 'address' | 'packstation';
  packstationNumber?: string;
  postNumber?: string;
  lockerID?: string;
  shippingCost?: number;
  isCustomsDeclarable?: boolean;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

export interface TrackingInfo {
  success: boolean;
  trackingNumber: string;
  status: string;
  description: string;
  estimatedDelivery?: string;
  events: TrackingEvent[];
  order?: {
    orderNumber: string;
    shippingStatus: string;
    estimatedDelivery?: string;
    actualDelivery?: string;
    trackingEvents: TrackingEvent[];
  };
}

export interface ShipmentResult {
  success: boolean;
  trackingNumber: string;
  labelUrl: string;
  estimatedDelivery: string;
  shipmentId: string;
  alreadyExists?: boolean;
  error?: string;
}

export type ShippingLabelError = Error & {
  code?: string;
  retryable?: boolean;
  details?: string[];
  status?: number;
};

type ApiFailure = {
  message?: string;
  response?: ApiResponseFailure;
  data?: ApiErrorPayload;
  status?: number;
};

type ApiResponseFailure = {
  data?: ApiErrorPayload;
  status?: number;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  retryable?: boolean;
  details?: string[];
};

const getApiFailure = (error: unknown) => {
  const failure = error as ApiFailure;
  const response = failure.response || failure;
  return { failure, response, payload: response.data || {} };
};

export const toShippingLabelError = (error: unknown): ShippingLabelError => {
  const { failure, response, payload } = getApiFailure(error);
  const apiError = new Error(
    payload.message || payload.error || failure.message || 'Das Versandlabel konnte nicht erstellt werden.'
  ) as ShippingLabelError;

  apiError.code = payload.code;
  apiError.retryable = payload.retryable === true;
  apiError.details = Array.isArray(payload.details) ? payload.details : [];
  apiError.status = response.status;
  return apiError;
};

// Description: Create shipping label for an order
// Endpoint: POST /api/orders/:id/shipping/create-label
// Request: { shipmentData: ShipmentData }
// Response: ShipmentResult
export const createShippingLabel = async (orderId: string, shipmentData: ShipmentData): Promise<ShipmentResult> => {
  try {
    const response = await api.post(`/api/orders/${orderId}/shipping/create-label`, { shipmentData });
    return response.data;
  } catch (error: unknown) {
    console.error('Create shipping label error:', error);
    throw toShippingLabelError(error);
  }
};

// Description: Get tracking information for an order
// Endpoint: GET /api/orders/:id/tracking
// Request: {}
// Response: TrackingInfo
export const getOrderTracking = async (orderId: string): Promise<TrackingInfo> => {
  try {
    const response = await api.get(`/api/orders/${orderId}/tracking`);
    return response.data;
  } catch (error: unknown) {
    console.error('Get tracking info error:', error);
    const { failure, payload } = getApiFailure(error);
    throw new Error(payload.error || payload.message || failure.message || 'Die Sendungsverfolgung konnte nicht geladen werden.');
  }
};

// Description: Update order tracking from DHL API
// Endpoint: PUT /api/orders/:id/tracking/update
// Request: {}
// Response: { success: boolean, order: Order, trackingInfo: TrackingInfo }
export const updateOrderTracking = async (orderId: string) => {
  try {
    const response = await api.put(`/api/orders/${orderId}/tracking/update`);
    return response.data;
  } catch (error: unknown) {
    console.error('Update tracking error:', error);
    const { failure, payload } = getApiFailure(error);
    throw new Error(payload.error || payload.message || failure.message || 'Die Sendungsverfolgung konnte nicht aktualisiert werden.');
  }
};

// ── DHL Location Finder ──────────────────────────────────────────────────────

export interface DhlLocationAddress {
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export interface DhlOpeningHours {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface DhlLocation {
  locationId: string;
  /** "locker" = Packstation, "postoffice" = Postfiliale, "servicepoint" = Paketshop, "postbank" */
  type: 'locker' | 'postoffice' | 'servicepoint' | 'postbank' | string;
  keyword: string;
  keywordId: string;
  name: string;
  distance: number;
  address: DhlLocationAddress;
  openingHours: DhlOpeningHours[];
}

// Description: Search for nearby DHL locations (Packstations, Postfilialen, Paketshops)
// Endpoint: GET /api/dhl/locations
// Request: { query, countryCode?, locationType? }
// Response: { locations: DhlLocation[] }
export const searchDhlLocations = async (
  query: string,
  countryCode = 'DE',
  locationType?: string,
): Promise<DhlLocation[]> => {
  const response = await api.get('/api/dhl/locations', {
    params: { query, countryCode, ...(locationType ? { locationType } : {}) },
  });
  if (response.status !== 200) {
    throw new Error(response.data?.error || 'Fehler beim Laden der DHL-Standorte');
  }
  return response.data?.locations ?? [];
};

// ── DHL shipper (Absender) settings ──────────────────────────────────────────
// The shop's own address is configuration, not a UI literal. It lives on the active
// DHL shipping integration (Systemkonfiguration → Integrationen) and is read by the
// server in DHLService.createShipment. The admin label dialogs prefill their Absender
// block from the same source so staff see and can correct the real address instead of
// a hard-coded placeholder.

export interface DhlShipperSettings {
  shipperCompany: string;
  shipperName: string;
  /** Combined "Straße und Hausnummer" as stored; the server splits it again. */
  shipperAddress: string;
  shipperNumber: string;
  shipperCity: string;
  shipperPostalCode: string;
  shipperCountry: string;
  shipperEmail: string;
  shipperPhone: string;
}

type IntegrationRecord = {
  name?: string;
  type?: string;
  provider?: string;
  isActive?: boolean;
  settings?: Record<string, unknown>;
};

const text = (value: unknown): string => String(value ?? '').trim();

/**
 * Mirror of DHLService.getDHLConfig's integration selection: the active DHL shipping
 * integration, preferring a non-returns profile.
 *
 * The predicate must match the server's EXACTLY (`provider === 'DHL' && type ===
 * 'shipping' && integration.isActive`). A looser `isActive !== false` made the dialog
 * prefill the Absender from an integration the server ignores, so staff saw one address
 * and DHL got another.
 */
const pickDhlIntegration = (integrations: IntegrationRecord[]): IntegrationRecord | undefined => {
  const active = integrations.filter(
    (integration) =>
      text(integration.provider) === 'DHL' &&
      text(integration.type) === 'shipping' &&
      Boolean(integration.isActive)
  );
  return (
    active.find((integration) => !text(integration.name).toLowerCase().includes('returns')) || active[0]
  );
};

/**
 * Outcome of reading the shipper settings. The caller MUST be able to tell "the shop
 * address is not configured" from "I was not allowed to read it": label creation is
 * open to admin AND staff while GET /api/system-config/integrations is admin-only, so a
 * staff user gets a 403 here. Swallowing that silently left the Absender block empty and
 * the label went out with whatever the server happened to resolve.
 */
export type DhlShipperSettingsResult =
  | { status: 'ok'; settings: DhlShipperSettings }
  | { status: 'not-configured' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

/** German text for every non-ok outcome, ready to show in a dialog. */
export const dhlShipperSettingsMessage = (result: DhlShipperSettingsResult): string => {
  switch (result.status) {
    case 'ok':
      return '';
    case 'not-configured':
      return 'Es ist keine aktive DHL-Versandintegration mit Absenderadresse hinterlegt. '
        + 'Bitte unter Systemkonfiguration → Integrationen → DHL die Shop-Adresse eintragen.';
    case 'forbidden':
      return 'Die hinterlegte Absenderadresse konnte nicht geladen werden: Für diese Einstellungen '
        + 'fehlt die Berechtigung (nur Administratoren). Bitte die Absenderdaten von einer '
        + 'Administratorin oder einem Administrator prüfen lassen.';
    default:
      return `Die hinterlegte Absenderadresse konnte nicht geladen werden: ${result.message}`;
  }
};

// Description: Read the configured DHL shipper (Absender) address
// Endpoint: GET /api/system-config/integrations (admin only – staff receive 403)
// Request: {}
// Response: DhlShipperSettingsResult
export const getDhlShipperSettings = async (): Promise<DhlShipperSettingsResult> => {
  try {
    const response = await api.get('/api/system-config/integrations');
    const integrations: IntegrationRecord[] = Array.isArray(response.data?.integrations)
      ? response.data.integrations
      : [];
    const settings = pickDhlIntegration(integrations)?.settings;
    if (!settings) return { status: 'not-configured' };

    const street = text(settings.shipperStreet);
    const houseNumber = text(settings.shipperNumber);

    return {
      status: 'ok',
      settings: {
        shipperCompany: text(settings.shipperCompany),
        // DHL's shipper.name1 – fall back to the company so the label is never nameless.
        shipperName: text(settings.shipperName) || text(settings.shipperCompany),
        shipperAddress: street,
        shipperNumber: houseNumber,
        shipperCity: text(settings.shipperCity),
        shipperPostalCode: text(settings.shipperPostalCode),
        shipperCountry: text(settings.shipperCountry) || 'DE',
        shipperEmail: text(settings.shipperEmail),
        shipperPhone: text(settings.shipperPhone),
      },
    };
  } catch (error: unknown) {
    console.error('Could not read DHL shipper settings:', error);
    const { failure, response, payload } = getApiFailure(error);
    if (response.status === 401 || response.status === 403) return { status: 'forbidden' };
    return {
      status: 'error',
      message: payload.message || payload.error || failure.message || 'Unbekannter Fehler.',
    };
  }
};

/** Drop empty/whitespace-only values so they never clobber a server-side default. */
export const withoutEmptyValues = <T extends Record<string, unknown>>(data: T): Partial<T> => {
  const result: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim() === '') return;
    if (value === null || value === undefined) return;
    result[key] = value;
  });
  return result as Partial<T>;
};

/**
 * Map the configured shop address onto the RECEIVER fields, for the inbound
 * (Einsendelabel) direction where McRepair is the Empfänger. Street and house number
 * travel together: they are split out of the same configured value instead of being
 * combined from two different sources.
 */
export const toReceiverFormValues = (settings: DhlShipperSettings) => {
  const parts = splitStreetAndHouse(settings.shipperAddress);
  const receiverAddress = parts.street || settings.shipperAddress.trim();
  const receiverNumber = parts.house || settings.shipperNumber.trim();

  return {
    receiverName: settings.shipperCompany || settings.shipperName,
    receiverAddress,
    receiverNumber,
    receiverCity: settings.shipperCity,
    receiverPostalCode: settings.shipperPostalCode,
    receiverCountry: settings.shipperCountry || 'DE',
    receiverEmail: settings.shipperEmail,
    receiverPhone: settings.shipperPhone,
  };
};

/**
 * Map the configured shipper settings onto the shipper form fields both label dialogs
 * use. The dialogs show ONE combined "Straße und Hausnummer" input (the server splits it
 * again), so a separately configured house number is appended when the configured street
 * does not already carry one.
 */
export const toShipperFormValues = (settings: DhlShipperSettings) => {
  const parts = splitStreetAndHouse(settings.shipperAddress);
  const shipperAddress =
    !parts.house && settings.shipperNumber
      ? `${settings.shipperAddress} ${settings.shipperNumber}`.trim()
      : settings.shipperAddress;

  return {
    shipperCompany: settings.shipperCompany,
    shipperName: settings.shipperName,
    shipperAddress,
    shipperCity: settings.shipperCity,
    shipperPostalCode: settings.shipperPostalCode,
    shipperCountry: settings.shipperCountry || 'DE',
    shipperEmail: settings.shipperEmail,
    shipperPhone: settings.shipperPhone,
  };
};

// ── Booking label: direction-driven payload ──────────────────────────────────
// The booking endpoint builds its own default shipper/receiver pair from the
// direction. A dialog that simply fills "shipper" with the shop and "receiver" with
// the customer therefore decided the direction by the ORDER of the address blocks –
// an inbound request came back as an outbound (shop → customer) label. The direction
// is now stated once and both parties are assigned from it.

export interface BookingLabelParty {
  name: string;
  /** Street, with or without the house number; the number is taken from here first. */
  street: string;
  /** Separately entered house number, used when the street carries none. */
  house: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
}

export interface BookingLabelPartyInput {
  direction: ShippingLabelDirection;
  customer: BookingLabelParty;
  shop: BookingLabelParty;
  /**
   * True when the shop address could not be READ here (the integrations endpoint is
   * admin-only). The shop's side is then left to the server, which resolves it from the
   * DHL integration and refuses in German when it is not configured.
   */
  shopFromConfiguration?: boolean;
}

/**
 * Street and house number of ONE party, resolved exactly like the server does
 * (DHLService.resolveStreetAndHouse): the number contained in the street text wins over
 * a separately entered one, so both sides always agree on what ends up on the label.
 */
export const resolveBookingLabelStreet = (party: BookingLabelParty) => {
  const parts = splitStreetAndHouse(party.street);
  return {
    street: parts.street || String(party.street || '').trim(),
    house: parts.house || String(party.house || '').trim(),
  };
};

/** German names of the address fields a party is still missing (empty = complete). */
export const missingBookingLabelFields = (party: BookingLabelParty): string[] => {
  const { street, house } = resolveBookingLabelStreet(party);
  return ([
    ['Name', party.name],
    ['Straße', street],
    ['Hausnummer', house],
    ['Ort', party.city],
    ['PLZ', party.postalCode],
    ['Land', party.country],
  ] as const)
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([field]) => field);
};

/**
 * Assign the two parties to Absender/Empfänger from the requested DIRECTION and return
 * the shipment fields for the booking endpoint.
 *
 * 'inbound'  (Einsendelabel, the meaning of booking.trackingNumber): Kunde → McRepair.
 * 'outbound' (Rückweg): McRepair → Kunde.
 */
export const buildBookingLabelParties = (input: BookingLabelPartyInput): Partial<ShipmentData> => {
  const shopFromConfiguration = input.shopFromConfiguration === true;
  const customerIsShipper = input.direction === 'inbound';

  const asShipper = (party: BookingLabelParty, fromConfiguration: boolean): Partial<ShipmentData> => {
    if (fromConfiguration) return { shipperFromConfiguration: true };
    const { street, house } = resolveBookingLabelStreet(party);
    return withoutEmptyValues({
      shipperName: party.name.trim(),
      shipperStreet: street,
      shipperNumber: house,
      shipperCity: party.city.trim(),
      shipperPostalCode: party.postalCode.trim(),
      shipperCountry: party.country.trim() || 'DE',
      shipperEmail: party.email.trim(),
      shipperPhone: party.phone.trim(),
    });
  };

  const asReceiver = (party: BookingLabelParty, fromConfiguration: boolean): Partial<ShipmentData> => {
    if (fromConfiguration) return { receiverFromConfiguration: true };
    const { street, house } = resolveBookingLabelStreet(party);
    return withoutEmptyValues({
      receiverName: party.name.trim(),
      receiverAddress: street,
      receiverNumber: house,
      receiverCity: party.city.trim(),
      receiverPostalCode: party.postalCode.trim(),
      receiverCountry: party.country.trim() || 'DE',
      receiverEmail: party.email.trim(),
      receiverPhone: party.phone.trim(),
    });
  };

  return {
    labelDirection: input.direction,
    ...(customerIsShipper
      ? { ...asShipper(input.customer, false), ...asReceiver(input.shop, shopFromConfiguration) }
      : { ...asShipper(input.shop, shopFromConfiguration), ...asReceiver(input.customer, false) }),
  };
};
