const TrackingEvent = require('../models/TrackingEvent');

async function createTrackingEvent(data) {
  return TrackingEvent.create(data);
}

async function getLiveStats() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const pipeline = [
    { $match: { occurred_at: { $gte: since } } },
    {
      $facet: {
        active_visitors_last_5m: [
          { $group: { _id: '$visitor_id', last: { $max: '$occurred_at' } } },
          { $count: 'count' }
        ],
        top_pages: [
          { $group: { _id: '$page_path', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ],
        top_referrers: [
          { $group: { _id: '$referrer', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ],
        top_browsers: [
          { $group: { _id: '$browser', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ],
        top_devices: [
          { $group: { _id: '$device_type', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]
      }
    }
  ];
  const [result] = await TrackingEvent.aggregate(pipeline);
  return {
    active_visitors_last_5m: result.active_visitors_last_5m[0]?.count || 0,
    top_pages: result.top_pages,
    top_referrers: result.top_referrers,
    top_browsers: result.top_browsers,
    top_devices: result.top_devices
  };
}

// Admin Live Tracking APIs
async function getAdminSummary(minutes = 30) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const since5m = new Date(Date.now() - 5 * 60 * 1000);

  const result = await TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since } } },
    {
      $facet: {
        active_visitors_5m: [
          { $match: { occurred_at: { $gte: since5m } } },
          { $group: { _id: '$visitor_id' } },
          { $count: 'count' }
        ],
        active_visitors_30m: [
          { $group: { _id: '$visitor_id' } },
          { $count: 'count' }
        ],
        page_views_5m: [
          { $match: { occurred_at: { $gte: since5m }, event_name: 'page_view' } },
          { $count: 'count' }
        ],
        new_sessions_30m: [
          { $group: { _id: '$session_id', first: { $min: '$occurred_at' } } },
          { $match: { first: { $gte: since } } },
          { $count: 'count' }
        ],
        conversions_30m: [
          { $match: { event_name: 'conversion' } },
          { $count: 'count' }
        ],
        errors_30m: [
          { $match: { event_name: 'error' } },
          { $count: 'count' }
        ]
      }
    }
  ]);

  const summary = result[0] || {};

  return {
    active_visitors_5m: summary.active_visitors_5m?.[0]?.count || 0,
    active_visitors_30m: summary.active_visitors_30m?.[0]?.count || 0,
    page_views_5m: summary.page_views_5m?.[0]?.count || 0,
    new_sessions_30m: summary.new_sessions_30m?.[0]?.count || 0,
    conversions_30m: summary.conversions_30m?.[0]?.count || 0,
    errors_30m: summary.errors_30m?.[0]?.count || 0
  };
}

async function getActiveSessions(minutes = 30) {
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const sessions = await TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since } } },
    { $sort: { occurred_at: 1 } },
    {
      $group: {
        _id: '$session_id',
        last_activity: { $max: '$occurred_at' },
        first_activity: { $min: '$occurred_at' },
        current_page: { $last: '$page_path' },
        landing_page: { $first: '$page_path' },
        referrer: { $first: '$referrer' },
        source: { $first: '$source' },
        medium: { $first: '$medium' },
        campaign: { $first: '$campaign' },
        browser: { $first: '$browser' },
        browser_version: {
          $first: {
            $ifNull: ['$browser_version', '$custom_data.current_device_info.browserVersion']
          }
        },
        device_type: { $first: '$device_type' },
        device_model: {
          $first: {
            $ifNull: ['$device_model', '$custom_data.current_device_info.deviceModel']
          }
        },
        os: { $first: '$os' },
        os_version: {
          $first: {
            $ifNull: ['$os_version', '$custom_data.current_device_info.osVersion']
          }
        },
        platform: {
          $first: {
            $ifNull: ['$platform', '$custom_data.current_device_info.platform']
          }
        },
        country: { $first: '$country' },
        event_count: { $sum: 1 },
        visitor_id: { $first: '$visitor_id' }
      }
    },
    { $sort: { last_activity: -1 } },
    { $limit: 100 }
  ]);

  return sessions;
}

async function getTopPages(minutes = 30, limit = 10) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since }, page_path: { $exists: true, $ne: null } } },
    { $group: { _id: '$page_path', count: { $sum: 1 }, title: { $last: '$page_title' } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getTopReferrers(minutes = 30, limit = 10) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since }, referrer: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$referrer', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getTopBrowsers(minutes = 30, limit = 10) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since }, browser: { $exists: true, $ne: null } } },
    { $group: { _id: '$browser', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getTopDevices(minutes = 30, limit = 10) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since }, device_type: { $exists: true, $ne: null } } },
    { $group: { _id: '$device_type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getTopCountries(minutes = 30, limit = 10) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.aggregate([
    { $match: { occurred_at: { $gte: since }, country: { $exists: true, $ne: null } } },
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
}

async function getRecentEvents(limit = 50, minutes = 30) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return TrackingEvent.find({ occurred_at: { $gte: since } })
    .sort({ occurred_at: -1 })
    .limit(limit)
    .select('event_name occurred_at page_path session_id referrer source custom_data')
    .lean();
}

async function getSessionDetail(sessionId) {
  const events = await TrackingEvent.find({ session_id: sessionId })
    .sort({ occurred_at: 1 })
    .lean();

  if (!events.length) return null;

  const first = events[0];
  const last = events[events.length - 1];

  return {
    session_id: sessionId,
    session_start: first.occurred_at,
    last_activity: last.occurred_at,
    landing_page: first.page_path,
    current_page: last.page_path,
    referrer: first.referrer,
    source: first.source,
    medium: first.medium,
    campaign: first.campaign,
    browser: first.browser,
    browser_version: first.browser_version,
    os: first.os,
    device_type: first.device_type,
    country: first.country,
    city: first.city,
    event_count: events.length,
    events: events.map(e => ({
      event_name: e.event_name,
      occurred_at: e.occurred_at,
      page_path: e.page_path,
      page_title: e.page_title,
      custom_data: e.custom_data
    }))
  };
}

module.exports = {
  createTrackingEvent,
  getLiveStats,
  getAdminSummary,
  getActiveSessions,
  getTopPages,
  getTopReferrers,
  getTopBrowsers,
  getTopDevices,
  getTopCountries,
  getRecentEvents,
  getSessionDetail
};
