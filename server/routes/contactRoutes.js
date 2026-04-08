const express = require('express');
const router = express.Router();
const ContactService = require('../services/contactService');

const ALLOWED_SUBJECTS = new Set(['repair', 'status', 'business', 'complaint', 'other']);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MIN_SUBMIT_SECONDS = 3;
const MAX_LINK_COUNT = 3;
const ipRequestMap = new Map();

const stripHtml = (value = '') => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sanitizePhone = (value = '') => String(value)
  .replace(/[^0-9+()\-/.\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sanitizeOrderNumber = (value = '') => String(value)
  .replace(/[^a-zA-Z0-9\-/#\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const getSpamSignals = (req, payload) => {
  const now = Date.now();
  const ip = getClientIp(req);

  // Simple honeypot field (must stay empty in normal browsers)
  if (payload.website && String(payload.website).trim().length > 0) {
    return { isSpam: true, reason: 'honeypot' };
  }

  // Form should not be submitted immediately after rendering
  if (payload.formStartedAt) {
    const startedAt = new Date(payload.formStartedAt).getTime();
    if (Number.isFinite(startedAt)) {
      const elapsedSeconds = (now - startedAt) / 1000;
      if (elapsedSeconds < MIN_SUBMIT_SECONDS) {
        return { isSpam: true, reason: 'submitted-too-fast' };
      }
    }
  }

  // Block messages with too many links
  const linkCount = String(payload.message || '').match(/https?:\/\//gi)?.length || 0;
  if (linkCount > MAX_LINK_COUNT) {
    return { isSpam: true, reason: 'too-many-links' };
  }

  // Basic in-memory IP rate limit
  const state = ipRequestMap.get(ip) || { count: 0, firstSeenAt: now };
  if (now - state.firstSeenAt > RATE_LIMIT_WINDOW_MS) {
    state.count = 0;
    state.firstSeenAt = now;
  }

  state.count += 1;
  ipRequestMap.set(ip, state);

  if (state.count > RATE_LIMIT_MAX_REQUESTS) {
    return { isSpam: true, reason: 'rate-limit' };
  }

  // Opportunistic cleanup of stale entries
  if (ipRequestMap.size > 1000) {
    for (const [trackedIp, trackedState] of ipRequestMap.entries()) {
      if (now - trackedState.firstSeenAt > RATE_LIMIT_WINDOW_MS * 2) {
        ipRequestMap.delete(trackedIp);
      }
    }
  }

  return { isSpam: false, reason: null };
};

router.post('/', async (req, res) => {
  try {
    const spamCheck = getSpamSignals(req, req.body || {});
    if (spamCheck.isSpam) {
      return res.status(429).json({
        error: 'Zu viele oder ungueltige Anfragen. Bitte versuchen Sie es spaeter erneut.',
      });
    }

    const name = stripHtml(req.body?.name);
    const email = stripHtml(req.body?.email).toLowerCase();
    const phone = sanitizePhone(req.body?.phone);
    const orderNumber = sanitizeOrderNumber(req.body?.orderNumber);
    const subject = stripHtml(req.body?.subject).toLowerCase();
    const message = stripHtml(req.body?.message);
    const privacyAccepted = req.body?.privacyAccepted === true;

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Bitte geben Sie einen gueltigen Namen ein.' });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.' });
    }

    if (!ALLOWED_SUBJECTS.has(subject)) {
      return res.status(400).json({ error: 'Bitte waehlen Sie ein gueltiges Anliegen aus.' });
    }

    if (!message || message.length < 20) {
      return res.status(400).json({ error: 'Bitte beschreiben Sie Ihr Anliegen mit mindestens 20 Zeichen.' });
    }

    if (!privacyAccepted) {
      return res.status(400).json({ error: 'Bitte bestaetigen Sie die Verarbeitung Ihrer Angaben.' });
    }

    const result = await ContactService.submitInquiry({
      name,
      email,
      phone,
      orderNumber,
      subject,
      message,
      ipAddress: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 350),
    });

    res.status(201).json({
      success: true,
      message: 'Ihre Anfrage wurde erfolgreich uebermittelt.',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('ContactRoutes: Error submitting contact request:', error);
    res.status(500).json({
      error: error.message || 'Die Kontaktanfrage konnte nicht gesendet werden.',
    });
  }
});

module.exports = router;