/**
 * Gast-Zugang ohne Anmeldung (Gast-Reparaturanfrage, Gast-Buchung/-Auftrag, Gast-Checkout).
 *
 * Zugangsschluessel (guestTrackingToken an Order, Booking, RepairRequest): seit Einfuehrung
 * crypto.randomBytes(32) als Hex (64 Zeichen, 256 Bit), Klartext in der DB, Nachschlagen per
 * Gleichheitsabfrage, zusaetzlich an die E-Mail-Adresse des Datensatzes gebunden. Das Link-
 * Format (?token=...&email=...) bleibt unveraendert, bestehende Links gelten weiter (keine
 * Ablaufzeit - siehe Richtlinie im technischen Bericht).
 *
 * Dieses Modul liefert
 *  - normalizeGuestToken / normalizeGuestEmail: nur Zeichenketten (kein ?token[$ne]=x,
 *    kein ?token=a&token=b als $in-Abfrage, kein leerer Token, der Buchungen ohne Token traefe),
 *  - guestEmailMatches: zeitkonstanter Vergleich der zweiten Pruefgroesse (E-Mail),
 *  - die Rate-Limits der Gast-Endpunkte (gemeinsame Zaehler je Prozess, Client-IP aus
 *    rateLimit.getClientIp - nicht ueber X-Forwarded-For faelschbar).
 */
const crypto = require('crypto');
const { createRateLimitMiddleware, getClientIp } = require('./rateLimit');

// Toleranter als das tatsaechliche Format (64 Hex-Zeichen), damit kein jemals ausgegebener
// Link durch die Formatpruefung ungueltig wird; schliesst nur Leerwerte, Objekte/Arrays,
// Steuer-/Sonderzeichen und Ueberlaenge aus. Die Sicherheit kommt aus den 256 Bit des
// gespeicherten Tokens (ein kurzer Wert trifft nur, wenn genau dieser gespeichert ist).
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

const normalizeGuestToken = (value) => {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return GUEST_TOKEN_PATTERN.test(token) ? token : null;
};

const normalizeGuestEmail = (value) => {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 320 ? email : '';
};

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

// Zeitkonstant (Hash gleicher Laenge), Gross-/Kleinschreibung egal, leere Werte passen nie.
const guestEmailMatches = (stored, supplied) => {
  const a = normalizeGuestEmail(String(stored || ''));
  const b = normalizeGuestEmail(String(supplied || ''));
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256(a), sha256(b));
};

// ---------------------------------------------------------------------------------------
// Rate-Limits (Bedrohungsmodell und Werte: technischer Bericht, Abschnitt Gast-Zugang)
// ---------------------------------------------------------------------------------------
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const ipKey = (req) => getClientIp(req);
const targetEmailOf = (req) => normalizeGuestEmail(req.body?.guestInfo?.email ?? req.body?.email);

const TOO_MANY_ACCESS = 'Zu viele fehlgeschlagene Zugriffe. Bitte prüfen Sie Link, Buchungsnummer und E-Mail-Adresse und versuchen Sie es in einigen Minuten erneut.';
const TOO_MANY_REQUESTS = 'Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.';
const TOO_MANY_CREATIONS = 'Zu viele Anfragen von diesem Anschluss oder für diese E-Mail-Adresse. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt.';

// Fehlgeschlagene Zugriffe (falscher/fehlender Token, falsche E-Mail, fremder Datensatz):
// zaehlt NUR 400/403/404 - die Aktualisierung einer geoeffneten Gastseite (alle 10-15 s)
// verbraucht nichts.
const isAccessFailure = (status) => status === 400 || status === 403 || status === 404;
const guestAccessFailureLimit = createRateLimitMiddleware({
  key: 'guest-access-failures',
  windowMs: 15 * MINUTE,
  maxRequests: 30,
  keyGenerator: ipKey,
  countWhen: isAccessFailure,
  message: TOO_MANY_ACCESS,
});

// Zugriff mit Buchungsnummer + E-Mail (ohne Token): Buchungsnummern sind fortlaufend. Zusaetzlich
// zum IP-Zaehler je E-Mail-Adresse begrenzt, damit verteiltes Durchprobieren von Buchungsnummern
// fuer eine bekannte Adresse nicht skaliert. Der Token-Link des Kunden ist davon nicht betroffen.
// Ausgenommen nur Anfragen, die tatsaechlich per Token pruefen: sobald eine Buchungsnummer
// mitkommt, zaehlt die Anfrage (frueher schaltete ein beliebiger Parameter &token=x die Grenze
// auf /by-number ab, das den Token gar nicht liest).
// Schluessel und Token-Erkennung lesen dieselbe Quelle wie die Gast-Routen selbst: GET/HEAD die
// Query, POST/PUT den Body. Frueher zaehlte "query.email ?? body.email" - ein ?email=<zufall> in
// der URL verteilte die Fehlversuche auf Wegwerf-Schluessel, waehrend die Route die E-Mail des
// Opfers aus dem Body pruefte.
const guestParams = (req) => (['GET', 'HEAD'].includes(String(req.method || '').toUpperCase()) ? req.query : req.body) || {};
const hasParam = (req, name) => Boolean(guestParams(req)[name]);
const usesTokenAccess = (req) => hasParam(req, 'token') && !hasParam(req, 'bookingNumber');
const guestNumberAccessFailureLimit = createRateLimitMiddleware({
  key: 'guest-number-access-failures',
  windowMs: 15 * MINUTE,
  maxRequests: 10,
  keyGenerator: (req) => `email:${normalizeGuestEmail(guestParams(req).email) || '-'}`,
  skip: usesTokenAccess,
  countWhen: isAccessFailure,
  message: TOO_MANY_ACCESS,
});

// Lesen (auch erfolgreich): Obergrenze gegen Abgreifen/Last; 1 Anfrage je Sekunde im Mittel
// reicht fuer mehrere geoeffnete Gastseiten mit Aktualisierung.
const guestReadLimit = createRateLimitMiddleware({
  key: 'guest-read',
  windowMs: 10 * MINUTE,
  maxRequests: 600,
  keyGenerator: ipKey,
  message: TOO_MANY_REQUESTS,
});

// Schreiben (Nachricht, Rueckfrage-Antwort, Kostenvoranschlag, Aktion): jede Nachricht
// benachrichtigt das Team (In-App/E-Mail) - Spam-Schutz.
const guestWriteLimit = createRateLimitMiddleware({
  key: 'guest-write',
  windowMs: 10 * MINUTE,
  maxRequests: 30,
  keyGenerator: ipKey,
  message: TOO_MANY_REQUESTS,
});

const guestReadOrWriteLimit = (req, res, next) => (
  ['GET', 'HEAD'].includes(req.method) ? guestReadLimit(req, res, next) : guestWriteLimit(req, res, next)
);

/** Fuer jede Route, die einen Gast-Token oder Buchungsnummer + E-Mail prueft. */
const guestAccessLimits = [guestAccessFailureLimit, guestNumberAccessFailureLimit, guestReadOrWriteLimit];

// Anlegen ohne Anmeldung (Gast-Reparaturanfrage, Gast-Checkout, Konto im Checkout): jede
// Anlage verschickt eine E-Mail an die angegebene Adresse, speichert bis zu 8 MB Fotos bzw.
// erzeugt beim Checkout Auftraege und ein DHL-Einsendelabel.
// Ausgenommen (req.guestCreationLimitExempt, nur serverseitig gesetzt - checkoutRoutes
// markExemptGuestCompletion): Gast-Abschluss NACH erfasster PayPal-Zahlung dieser E-Mail bzw.
// Wiederholung eines bereits abgeschlossenen Bezahlversuchs. Frueher bekam ein zahlender Gast
// nach der Abbuchung 429 (Zahlung ohne Buchung), wenn Dritte die Zaehler gefuellt hatten.
const isCreationExempt = (req) => req.guestCreationLimitExempt === true;
const isSuccessfulCreation = (status) => status >= 200 && status < 300;
const guestCreateIpLimit = createRateLimitMiddleware({
  key: 'guest-create-ip',
  windowMs: HOUR,
  maxRequests: 20,
  keyGenerator: ipKey,
  skip: isCreationExempt,
  message: TOO_MANY_CREATIONS,
});
const guestCreateIpDayLimit = createRateLimitMiddleware({
  key: 'guest-create-ip-day',
  windowMs: 24 * HOUR,
  maxRequests: 60,
  keyGenerator: ipKey,
  skip: isCreationExempt,
  message: TOO_MANY_CREATIONS,
});
// Gegen E-Mail-Bombing einer fremden Adresse ueber wechselnde IPs. Zaehlt nur ERFOLGREICHE
// Anlagen (2xx - nur diese verschicken Mails): frueher zaehlte jede Anfrage, 5 billige
// 400-Anfragen Dritter sperrten die Adresse eines Kunden fuer eine Stunde.
const guestCreateEmailLimit = createRateLimitMiddleware({
  key: 'guest-create-email',
  windowMs: HOUR,
  maxRequests: 5,
  keyGenerator: (req) => `email:${targetEmailOf(req)}`,
  skip: (req) => isCreationExempt(req) || !targetEmailOf(req),
  countWhen: isSuccessfulCreation,
  message: TOO_MANY_CREATIONS,
});
// Schutzschalter ueber alle Absender: begrenzt verteilten Missbrauch (Labels, Mails, Speicher).
// Liegt weit ueber dem normalen Aufkommen eines Reparaturbetriebs. Zaehlt ebenfalls nur
// erfolgreiche Anlagen - ungueltige Anfragen von ein paar IPs sperrten frueher alle Gaeste.
const guestCreateGlobalLimit = createRateLimitMiddleware({
  key: 'guest-create-global',
  windowMs: HOUR,
  maxRequests: 200,
  keyGenerator: () => 'all',
  skip: isCreationExempt,
  countWhen: isSuccessfulCreation,
  message: TOO_MANY_CREATIONS,
});

const guestCreateLimits = [guestCreateIpLimit, guestCreateIpDayLimit, guestCreateEmailLimit, guestCreateGlobalLimit];

// PayPal-Gastzahlung: jeder Aufruf spricht die PayPal-API mit den Shop-Zugangsdaten an.
const guestPaymentLimit = createRateLimitMiddleware({
  key: 'guest-payment',
  windowMs: 10 * MINUTE,
  maxRequests: 30,
  keyGenerator: ipKey,
  message: TOO_MANY_REQUESTS,
});

// Bestaetigungsmail erneut senden (beliebige Adresse eines inaktiven Kontos).
const resendVerificationLimit = createRateLimitMiddleware({
  key: 'checkout-resend-verification',
  windowMs: 15 * MINUTE,
  maxRequests: 5,
  keyGenerator: (req) => `${getClientIp(req)}:${normalizeGuestEmail(req.body?.email)}`,
  message: TOO_MANY_REQUESTS,
});
const resendVerificationEmailLimit = createRateLimitMiddleware({
  key: 'checkout-resend-verification-email',
  windowMs: HOUR,
  maxRequests: 5,
  keyGenerator: (req) => `email:${normalizeGuestEmail(req.body?.email)}`,
  skip: (req) => !normalizeGuestEmail(req.body?.email),
  message: TOO_MANY_REQUESTS,
});

// Gutscheincode pruefen ohne Anmeldung (Durchprobieren von Codes).
const guestPromoLimit = createRateLimitMiddleware({
  key: 'guest-promo',
  windowMs: 10 * MINUTE,
  maxRequests: 30,
  keyGenerator: ipKey,
  skip: (req) => Boolean(req.user),
  message: TOO_MANY_REQUESTS,
});

module.exports = {
  GUEST_TOKEN_PATTERN,
  normalizeGuestToken,
  normalizeGuestEmail,
  guestEmailMatches,
  guestAccessLimits,
  guestCreateLimits,
  guestPaymentLimit,
  resendVerificationLimits: [resendVerificationLimit, resendVerificationEmailLimit],
  guestPromoLimit,
};
