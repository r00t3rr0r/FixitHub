const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_STATUS = 429;
// countWhen-Limiter: wie lange eine abgebrochene Anfrage als laufend gilt, wenn der Handler nie antwortet.
const HANDLER_GRACE_MS = 2 * 60 * 1000;

const stores = new Map();

const normalizeIp = (value) => {
  if (!value) return 'unknown';
  const ip = String(value).trim();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
};

/**
 * Client-IP fuer Rate-Limits. Frueher wurde der ERSTE Eintrag des vom Client frei setzbaren
 * X-Forwarded-For-Headers genommen - jede Anfrage mit neuem Header bekam einen neuen Zaehler
 * (Login- und Gast-Limits umgehbar). Jetzt gilt req.ip: Express wertet X-Forwarded-For nur
 * fuer vertrauenswuerdige Proxys aus (app.set('trust proxy', resolveTrustProxySetting(...))
 * in server.js). Ohne vertrauenswuerdigen Proxy ist req.ip die Socket-Adresse.
 */
const getClientIp = (req) => normalizeIp(req?.ip || req?.socket?.remoteAddress || 'unknown');

/**
 * Wert fuer app.set('trust proxy', ...). Standard 'loopback': die mitgelieferte Produktions-
 * konfiguration (scripts/setup-production*.sh) betreibt nginx auf demselben Host
 * (proxy_pass http://127.0.0.1:PORT, X-Forwarded-For $proxy_add_x_forwarded_for). Dann ist
 * req.ip die von nginx angehaengte echte Client-Adresse; wer den Node-Port direkt erreicht
 * (keine Loopback-Verbindung), kann req.ip ueber X-Forwarded-For nicht faelschen.
 * Frueher: 1 (= der unmittelbare Gegenueber wird IMMER als Proxy vertraut, auch ein
 * Internet-Client ohne nginx davor).
 * Abweichender Betrieb (Proxy/Load-Balancer auf einem anderen Host): Umgebungsvariable
 * TRUST_PROXY, z. B. "10.0.0.0/8" oder "loopback, 172.16.0.0/12" oder eine Hop-Anzahl ("1");
 * "false"/"0" = keinem Proxy vertrauen.
 */
const resolveTrustProxySetting = (value) => {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return 'loopback';
  if (/^(false|off|no|none)$/i.test(text) || text === '0') return false;
  if (/^(true|on|yes)$/i.test(text)) {
    // "Allen vertrauen" machte jede Client-IP faelschbar - bewusst nicht unterstuetzt.
    console.warn('TRUST_PROXY=true wird nicht unterstuetzt (X-Forwarded-For waere faelschbar); verwende "loopback".');
    return 'loopback';
  }
  if (/^\d+$/.test(text)) return Number(text);
  return text;
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

/**
 * In-Memory-Rate-Limit je Schluessel (pro Prozess).
 * Optionen zusaetzlich zu key/windowMs/maxRequests/keyGenerator/message/statusCode:
 *  - skip(req): true => diese Anfrage wird weder gezaehlt noch begrenzt.
 *  - countWhen(statusCode, req): gesetzt => es zaehlen nur Antworten, fuer die countWhen true
 *    liefert (z. B. fehlgeschlagene Gast-Zugriffe 400/403/404); erfolgreiche Zugriffe eines
 *    Kunden (Seitenaufruf, Nachrichten-Aktualisierung) verbrauchen dann nichts. Gesperrt wird,
 *    sobald maxRequests gezaehlte Antworten plus noch laufende Anfragen im Fenster erreicht sind.
 */
const createRateLimitMiddleware = ({
  key = 'global',
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  keyGenerator = defaultKeyGenerator,
  message = 'Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut.',
  statusCode = DEFAULT_STATUS,
  skip = null,
  countWhen = null,
} = {}) => {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }

  const store = stores.get(key);

  const reject = (res, entry, now) => {
    const retryAfterSeconds = Math.ceil((windowMs - (now - entry.firstSeenAt)) / 1000);
    res.set('Retry-After', String(Math.max(retryAfterSeconds, 1)));
    return res.status(statusCode).json({
      success: false,
      message,
      error: message,
      code: 'RATE_LIMITED',
    });
  };

  return (req, res, next) => {
    if (typeof skip === 'function' && skip(req)) {
      return next();
    }

    const now = Date.now();
    const bucketKey = keyGenerator(req) || 'unknown';

    if (typeof countWhen === 'function') {
      // Laufende Anfragen zaehlen mit: frueher wurde erst bei 'finish' gezaehlt, so dass ein
      // paralleler Schwall beliebig vieler Anfragen die Pruefung passierte, bevor die erste
      // gezaehlt war. Jetzt wird beim Start vorgemerkt und beim Ende zurueckgenommen, wenn die
      // Antwort nicht zaehlt (countWhen false) - count = gezaehlte + laufende Anfragen.
      let entry = store.get(bucketKey);
      if (!entry || now - entry.firstSeenAt > windowMs) {
        entry = { count: 0, firstSeenAt: now };
        store.set(bucketKey, entry);
        cleanupStore(store, now, windowMs);
      }
      if (entry.count >= maxRequests) {
        return reject(res, entry, now);
      }
      entry.count += 1;
      let settled = false;
      let graceTimer = null;
      const settle = (finalStatus) => {
        if (settled) return;
        settled = true;
        if (graceTimer) clearTimeout(graceTimer);
        if (countWhen(finalStatus, req)) return;
        // Nur am selben Eintrag zuruecknehmen (nicht an einem inzwischen neu begonnenen Fenster).
        if (store.get(bucketKey) !== entry || entry.count <= 0) return;
        entry.count -= 1;
        // count 0 = weder gezaehlte noch laufende Anfragen: Fenster beginnt mit dem naechsten Zugriff neu.
        if (entry.count === 0) store.delete(bucketKey);
      };
      // Entschieden wird nach dem Status, den der Handler tatsaechlich sendet (res.end), nicht nach
      // dem Socket: bricht der Client vorher ab, steht res.statusCode noch auf dem Express-Standard
      // 200 - ein abgebrochener 400er zaehlte sonst als "erfolgreiche Anlage" (Aussperren eines
      // Opfers/aller Gaeste mit billigen Anfragen). Der Handler laeuft nach dem Abbruch weiter und
      // ruft res.end trotzdem auf.
      const originalEnd = res.end;
      res.end = function rateLimitTrackedEnd(...args) {
        settle(res.statusCode);
        return originalEnd.apply(this, args);
      };
      res.on('close', () => {
        if (settled) return;
        if (res.writableEnded) {
          settle(res.statusCode);
          return;
        }
        // Verbindung weg, Handler noch nicht fertig: weiter als laufend zaehlen, bis res.end kommt.
        // Endet der Handler nie, bleibt die Anfrage gezaehlt (sichere Seite).
        graceTimer = setTimeout(() => { settled = true; }, HANDLER_GRACE_MS);
        if (typeof graceTimer.unref === 'function') graceTimer.unref();
      });
      return next();
    }

    const current = store.get(bucketKey);

    if (!current || now - current.firstSeenAt > windowMs) {
      store.set(bucketKey, { count: 1, firstSeenAt: now });
      cleanupStore(store, now, windowMs);
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      return reject(res, current, now);
    }

    return next();
  };
};

module.exports = {
  getClientIp,
  resolveTrustProxySetting,
  createRateLimitMiddleware,
};
