const { CSRF_COOKIE_NAME, ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } = require('../../utils/authCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const requireCsrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const hasAuthCookie = Boolean(req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[REFRESH_COOKIE_NAME]);
  if (!hasAuthCookie) {
    return next();
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = req.get('X-CSRF-Token');

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      success: false,
      message: 'CSRF validation failed'
    });
  }

  return next();
};

module.exports = { requireCsrfProtection };