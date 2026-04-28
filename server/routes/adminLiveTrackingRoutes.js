const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const {
  getAdminSummary,
  getActiveSessions,
  getTopPages,
  getTopReferrers,
  getTopBrowsers,
  getTopDevices,
  getTopCountries,
  getRecentEvents,
  getSessionDetail
} = require('../services/trackingService');

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/live-tracking/summary
router.get('/summary', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    console.log('[Admin Live Tracking] Summary request - minutes:', minutes, 'user:', req.user?.email);
    const summary = await getAdminSummary(minutes);
    console.log('[Admin Live Tracking] Summary result:', summary);
    res.json(summary);
  } catch (error) {
    console.error('[Admin Live Tracking] Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/admin/live-tracking/active-sessions
router.get('/active-sessions', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    console.log('[Admin Live Tracking] Active sessions request - minutes:', minutes);
    const sessions = await getActiveSessions(minutes);
    console.log('[Admin Live Tracking] Active sessions count:', sessions.length);
    res.json(sessions);
  } catch (error) {
    console.error('[Admin Live Tracking] Active sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// GET /api/admin/live-tracking/top-pages
router.get('/top-pages', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const pages = await getTopPages(minutes, limit);
    res.json(pages);
  } catch (error) {
    console.error('Live tracking top pages error:', error);
    res.status(500).json({ error: 'Failed to fetch top pages' });
  }
});

// GET /api/admin/live-tracking/top-referrers
router.get('/top-referrers', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const referrers = await getTopReferrers(minutes, limit);
    res.json(referrers);
  } catch (error) {
    console.error('Live tracking top referrers error:', error);
    res.status(500).json({ error: 'Failed to fetch top referrers' });
  }
});

// GET /api/admin/live-tracking/top-browsers
router.get('/top-browsers', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const browsers = await getTopBrowsers(minutes, limit);
    res.json(browsers);
  } catch (error) {
    console.error('Live tracking top browsers error:', error);
    res.status(500).json({ error: 'Failed to fetch top browsers' });
  }
});

// GET /api/admin/live-tracking/top-devices
router.get('/top-devices', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const devices = await getTopDevices(minutes, limit);
    res.json(devices);
  } catch (error) {
    console.error('Live tracking top devices error:', error);
    res.status(500).json({ error: 'Failed to fetch top devices' });
  }
});

// GET /api/admin/live-tracking/top-countries
router.get('/top-countries', requireUser, requireAdmin, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const countries = await getTopCountries(minutes, limit);
    res.json(countries);
  } catch (error) {
    console.error('Live tracking top countries error:', error);
    res.status(500).json({ error: 'Failed to fetch top countries' });
  }
});

// GET /api/admin/live-tracking/events
router.get('/events', requireUser, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const minutes = parseInt(req.query.minutes) || 30;
    const events = await getRecentEvents(limit, minutes);
    res.json(events);
  } catch (error) {
    console.error('Live tracking events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/admin/live-tracking/session/:sessionId
router.get('/session/:sessionId', requireUser, requireAdmin, async (req, res) => {
  try {
    const sessionDetail = await getSessionDetail(req.params.sessionId);
    if (!sessionDetail) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(sessionDetail);
  } catch (error) {
    console.error('Live tracking session detail error:', error);
    res.status(500).json({ error: 'Failed to fetch session detail' });
  }
});

module.exports = router;
