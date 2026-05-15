const express = require('express');
const router = express.Router();
const axios = require('axios');
const DHLService = require('../services/dhlService');

const LOCATION_FINDER_URL = 'https://api.dhl.com/location-finder/v1/find-by-address';
const MAX_RESULTS = 50;
const DEFAULT_RADIUS = 5000; // metres

/**
 * GET /api/dhl/locations
 * Proxy for the DHL Location Finder – Unified API.
 * Query params:
 *   query        – free-text (PLZ, city, street …) – min 3 chars
 *   countryCode  – ISO-2 (default: DE)
 *   locationType – optional: "locker" | "postoffice" | "servicepoint"
 *   limit        – max results per service-type call (default 15, max 50)
 *
 * Open to any authenticated or unauthenticated caller because the
 * DHL API key must NOT be exposed to the browser.
 */
router.get('/locations', async (req, res) => {
  try {
    const {
      query,
      countryCode = 'DE',
      locationType,
      limit = '15',
    } = req.query;

    const cleanQuery = String(query || '').trim();
    if (cleanQuery.length < 3) {
      return res.status(400).json({ error: 'Bitte mindestens 3 Zeichen eingeben.' });
    }

    // Retrieve DHL configuration from SystemConfiguration
    let apiKey = process.env.DHL_LOCATION_API_KEY || '';

    if (!apiKey) {
      try {
        const dhlIntegration = await DHLService.getDHLConfig();
        const parcelConfig = DHLService.getParcelDEConfig(dhlIntegration);
        // Location Finder API uses the same subscription/consumer key (clientId)
        apiKey =
          dhlIntegration?.credentials?.locationApiKey ||
          dhlIntegration?.metadata?.locationApiKey ||
          parcelConfig.clientId ||
          '';
      } catch (_) {
        // Config not available – fall through; apiKey stays empty
      }
    }

    if (!apiKey) {
      return res.status(503).json({ error: 'DHL Location API nicht konfiguriert.' });
    }

    const country = String(countryCode || 'DE').toUpperCase();
    const limitNum = Math.min(parseInt(limit, 10) || 15, MAX_RESULTS);
    const isDE = country === 'DE';

    const baseParams = {
      countryCode: country,
      addressLocality: cleanQuery,
      radius: DEFAULT_RADIUS,
      limit: limitNum,
      providerType: 'parcel',
    };

    if (locationType) baseParams.locationType = locationType;

    const headers = { 'DHL-API-Key': apiKey };
    let locations = [];

    if (isDE && !locationType) {
      // Germany requires two separate calls:
      //   parcel:pick-up-registered  → Packstations (lockers, registered users)
      //   parcel:pick-up             → Postfilialen / Paketshops
      const [lockersResult, serviceResult] = await Promise.allSettled([
        axios.get(LOCATION_FINDER_URL, {
          params: { ...baseParams, serviceType: 'parcel:pick-up-registered' },
          headers,
          timeout: 8000,
        }),
        axios.get(LOCATION_FINDER_URL, {
          params: { ...baseParams, serviceType: 'parcel:pick-up' },
          headers,
          timeout: 8000,
        }),
      ]);

      if (lockersResult.status === 'fulfilled') {
        locations = locations.concat(lockersResult.value.data?.locations || []);
      } else {
        console.warn('DHL locker query failed:', lockersResult.reason?.message);
      }
      if (serviceResult.status === 'fulfilled') {
        locations = locations.concat(serviceResult.value.data?.locations || []);
      } else {
        console.warn('DHL service-point query failed:', serviceResult.reason?.message);
      }
    } else {
      // Outside Germany or specific type requested
      const serviceType =
        locationType === 'locker' ? 'parcel:pick-up-registered' : 'parcel:pick-up';
      const response = await axios.get(LOCATION_FINDER_URL, {
        params: { ...baseParams, serviceType },
        headers,
        timeout: 8000,
      });
      locations = response.data?.locations || [];
    }

    // Deduplicate by locationId and sort by distance
    const seen = new Set();
    const unique = locations.filter(loc => {
      const id = loc.location?.ids?.[0]?.locationId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    unique.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    // Normalise to a flat, predictable shape
    const normalised = unique.map(loc => ({
      locationId: loc.location?.ids?.[0]?.locationId || '',
      type: loc.location?.type || 'servicepoint',
      keyword: loc.location?.keyword || '',
      keywordId: loc.location?.keywordId || '',
      name: loc.name || '',
      distance: loc.distance || 0,
      address: {
        street: loc.place?.address?.streetAddress || '',
        city: loc.place?.address?.addressLocality || '',
        postalCode: loc.place?.address?.postalCode || '',
        countryCode: loc.place?.address?.countryCode || country,
      },
      openingHours: (loc.openingHours || []).map(h => ({
        dayOfWeek: h.dayOfWeek || [],
        opens: h.opens || '',
        closes: h.closes || '',
      })),
    }));

    return res.json({ locations: normalised });
  } catch (error) {
    const status = error?.response?.status;
    console.error('DHL Locations error:', error?.response?.data || error.message);

    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'DHL API-Schlüssel ungültig oder abgelaufen.' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'DHL Rate-Limit erreicht. Bitte einen Moment warten.' });
    }

    return res.status(503).json({
      error: 'DHL Standorte konnten nicht abgefragt werden.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
});

module.exports = router;
