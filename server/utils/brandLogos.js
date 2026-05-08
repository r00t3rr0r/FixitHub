/**
 * Brand Logos - LOCAL & FALLBACK
 *
 * Centralised brand logo management. Prefers local PNG files stored in
 * public/assets/brand-logos/, with fallback to logo.dev CDN if needed.
 * 
 * To download logos: node server/scripts/download-brand-logos.js
 * Keys are normalised to lower-case.
 */

const LOGO_DEV_TOKEN = 'pk_G3uaUGozTKi6aHDk9IlR5Q';
const { BRAND_LOGO_MAPPING } = require('./brandLogoMapping');

/**
 * Build a fallback URL to logo.dev (if local logos unavailable)
 */
const buildLogoUrl = (name) =>
  `https://img.logo.dev/name/${encodeURIComponent(name)}?token=${LOGO_DEV_TOKEN}`;

/**
 * Build complete logo URL - prefers local path, fallback to external CDN
 */
const buildCompleteLogoUrl = (localPath, fallbackName) => {
  // In production/client, local paths are served from /assets/
  // This returns the local path if available, else fallback URL
  if (localPath) {
    return localPath; // e.g., '/assets/brand-logos/apple.png'
  }
  return buildLogoUrl(fallbackName); // Fallback to logo.dev
};

const BRAND_LOGOS = {
  acer:        buildCompleteLogoUrl(BRAND_LOGO_MAPPING.acer, 'Acer'),
  apple:       buildCompleteLogoUrl(BRAND_LOGO_MAPPING.apple, 'Apple'),
  asus:        buildCompleteLogoUrl(BRAND_LOGO_MAPPING.asus, 'Asus'),
  blackberry:  buildCompleteLogoUrl(BRAND_LOGO_MAPPING.blackberry, 'Blackberry'),
  dell:        buildCompleteLogoUrl(BRAND_LOGO_MAPPING.dell, 'Dell'),
  google:      buildCompleteLogoUrl(BRAND_LOGO_MAPPING.google, 'Google'),
  'hmd global': buildCompleteLogoUrl(BRAND_LOGO_MAPPING['hmd global'], 'HMD Global'),
  nokia:       buildCompleteLogoUrl(BRAND_LOGO_MAPPING.nokia, 'Nokia'),
  htc:         buildCompleteLogoUrl(BRAND_LOGO_MAPPING.htc, 'HTC'),
  huawei:      buildCompleteLogoUrl(BRAND_LOGO_MAPPING.huawei, 'Huawei'),
  lg:          buildCompleteLogoUrl(BRAND_LOGO_MAPPING.lg, 'LG'),
  lenovo:      buildCompleteLogoUrl(BRAND_LOGO_MAPPING.lenovo, 'Lenovo'),
  microsoft:   buildCompleteLogoUrl(BRAND_LOGO_MAPPING.microsoft, 'Microsoft'),
  windows:     buildCompleteLogoUrl(BRAND_LOGO_MAPPING.microsoft, 'Microsoft'),
  motorola:    buildCompleteLogoUrl(BRAND_LOGO_MAPPING.motorola, 'Motorola'),
  oneplus:     buildCompleteLogoUrl(BRAND_LOGO_MAPPING.oneplus, 'OnePlus'),
  samsung:     buildCompleteLogoUrl(BRAND_LOGO_MAPPING.samsung, 'Samsung'),
  sony:        buildCompleteLogoUrl(BRAND_LOGO_MAPPING.sony, 'Sony'),
  toshiba:     buildCompleteLogoUrl(BRAND_LOGO_MAPPING.toshiba, 'Toshiba'),
  xiaomi:      buildCompleteLogoUrl(BRAND_LOGO_MAPPING.xiaomi, 'Xiaomi')
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
