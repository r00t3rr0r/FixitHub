const cspEnabled = () => process.env.ENABLE_CSP === 'true';

const applySecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (cspEnabled()) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.sandbox.paypal.com; connect-src 'self' https:; frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com; object-src 'none'; base-uri 'self'; form-action 'self';"
    );
  }

  next();
};

module.exports = { applySecurityHeaders };
