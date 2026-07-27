const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_STATUS = 429;

const stores = new Map();

const normalizeIp = (value) => {
  if (!value) return 'unknown';
  const ip = String(value).trim();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return normalizeIp(String(forwarded).split(',')[0]);
  }

  return normalizeIp(req.ip || req.socket?.remoteAddress || 'unknown');
};

const defaultKeyGenerator = (req) => getClientIp(req);

const cleanupStore = (store, now, windowMs) => {
  if (store.size <= 5000) {
    return;
  }

  for (const [key, entry] of store.entries()) {
    if (now - entry.firstSeenAt > windowMs * 2) {
      store.delete(key);
    }
  }
};

const createRateLimitMiddleware = ({
  key = 'global',
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  keyGenerator = defaultKeyGenerator,
  message = 'Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut.',
  statusCode = DEFAULT_STATUS,
} = {}) => {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }

  const store = stores.get(key);

  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = keyGenerator(req) || 'unknown';
    const current = store.get(bucketKey);

    if (!current || now - current.firstSeenAt > windowMs) {
      store.set(bucketKey, { count: 1, firstSeenAt: now });
      cleanupStore(store, now, windowMs);
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - current.firstSeenAt)) / 1000);
      res.set('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return res.status(statusCode).json({
        success: false,
        message,
      });
    }

    return next();
  };
};

module.exports = {
  getClientIp,
  createRateLimitMiddleware,
};
