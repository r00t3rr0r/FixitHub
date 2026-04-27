const express = require('express');
const router = express.Router();
const { createTrackingEvent, getLiveStats } = require('../services/trackingService');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');

// Simple payload validation (extend as needed)
function validateTrackingPayload(body) {
  if (!body.event_name || typeof body.event_name !== 'string') return false;
  if (!body.page_url) return false;
  return true;
}

function hashIp(ip) {
  // Remove last octet for IPv4, simple privacy measure
  let shortIp = ip;
  if (ip && ip.includes('.')) shortIp = ip.split('.').slice(0, 3).join('.') + '.0';
  // Add salt from env
  const salt = process.env.TRACKING_SALT || 'default_salt';
  return crypto.createHash('sha256').update(shortIp + salt).digest('hex');
}

function parseUserAgent(ua) {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: result.browser.name || '',
    browser_version: result.browser.version || '',
    os: result.os.name || '',
    device_type: result.device.type || 'desktop',
  };
}

router.post('/track', async (req, res) => {
  try {
    if (!validateTrackingPayload(req.body)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const ip_hash = hashIp(ip);
    const ua = req.headers['user-agent'] || '';
    const uaInfo = parseUserAgent(ua);
    const event = {
      ...req.body,
      ip_hash,
      occurred_at: new Date(),
      ...uaInfo
    };
    await createTrackingEvent(event);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Tracking failed' });
  }
});

router.get('/tracking/live', async (req, res) => {
  try {
    const stats = await getLiveStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Live stats failed' });
  }
});

module.exports = router;
