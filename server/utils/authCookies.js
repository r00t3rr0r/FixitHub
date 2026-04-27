const crypto = require('crypto');

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';
const CSRF_COOKIE_NAME = 'csrf_token';

const isProduction = () => process.env.NODE_ENV === 'production';

const getCookieOptions = () => ({
  access: {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  },
  refresh: {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
  csrf: {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  },
});

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const setAuthCookies = (res, { accessToken, refreshToken, csrfToken = generateCsrfToken() }) => {
  const options = getCookieOptions();
  res.cookie(ACCESS_COOKIE_NAME, accessToken, options.access);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, options.refresh);
  res.cookie(CSRF_COOKIE_NAME, csrfToken, options.csrf);
  return csrfToken;
};

const rotateCsrfCookie = (res, csrfToken = generateCsrfToken()) => {
  const options = getCookieOptions();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, options.csrf);
  return csrfToken;
};

const clearAuthCookies = (res) => {
  const options = getCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, { ...options.access, maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...options.refresh, maxAge: undefined });
  res.clearCookie(CSRF_COOKIE_NAME, { ...options.csrf, maxAge: undefined });
};

module.exports = {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  setAuthCookies,
  rotateCsrfCookie,
  clearAuthCookies,
};