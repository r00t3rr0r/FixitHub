/**
 * Brand logo URLs (logo.dev).
 *
 * Centralised so seeds, migrations and runtime helpers all reference
 * the same source of truth. Keys are normalised to lower-case.
 */

const LOGO_DEV_TOKEN = 'pk_G3uaUGozTKi6aHDk9IlR5Q';

const buildLogoUrl = (name) =>
  `https://img.logo.dev/name/${encodeURIComponent(name)}?token=${LOGO_DEV_TOKEN}`;

const BRAND_LOGOS = {
  acer:        buildLogoUrl('Acer'),
  apple:       buildLogoUrl('Apple'),
  asus:        buildLogoUrl('Asus'),
  blackberry:  buildLogoUrl('Blackberry'),
  dell:        buildLogoUrl('Dell'),
  google:      buildLogoUrl('Google'),
  'hmd global': buildLogoUrl('HMD Global'),
  nokia:       buildLogoUrl('Nokia'),
  htc:         buildLogoUrl('HTC'),
  huawei:      buildLogoUrl('Huawei'),
  lg:          buildLogoUrl('LG'),
  lenovo:      buildLogoUrl('Lenovo'),
  microsoft:   buildLogoUrl('Microsoft'),
  windows:     buildLogoUrl('Microsoft'),
  motorola:    buildLogoUrl('Motorola'),
  oneplus:     buildLogoUrl('OnePlus'),
  samsung:     buildLogoUrl('Samsung'),
  sony:        buildLogoUrl('Sony'),
  toshiba:     buildLogoUrl('Toshiba'),
  xiaomi:      buildLogoUrl('Xiaomi')
};

/**
 * Resolve the logo URL for a given brand name.
 * Handles compound names like "HMD Global, Nokia" by checking each part.
 *
 * @param {string} name
 * @returns {string|null}
 */
function getBrandLogoUrl(name) {
  if (!name) return null;
  const normalized = String(name).trim().toLowerCase();

  if (BRAND_LOGOS[normalized]) {
    return BRAND_LOGOS[normalized];
  }

  // Try comma-separated compound names (first match wins).
  if (normalized.includes(',')) {
    for (const part of normalized.split(',').map((s) => s.trim())) {
      if (BRAND_LOGOS[part]) return BRAND_LOGOS[part];
    }
  }

  return null;
}

module.exports = {
  BRAND_LOGOS,
  LOGO_DEV_TOKEN,
  buildLogoUrl,
  getBrandLogoUrl
};
