// Frontend-Tracking-API
export type TrackingEventData = {
  event_name: string;
  page_url?: string;
  page_path?: string;
  page_title?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  session_id?: string;
  visitor_id?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  device_type?: string;
  language?: string;
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
  timezone?: string;
  country?: string;
  city?: string;
  custom_data?: any;
};

function getSessionId() {
  let sid = localStorage.getItem('tracking_session_id');
  if (!sid) {
    sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('tracking_session_id', sid);
  }
  return sid;
}

function getVisitorId() {
  let vid = localStorage.getItem('tracking_visitor_id');
  if (!vid) {
    vid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('tracking_visitor_id', vid);
  }
  return vid;
}

function getBaseTrackingData(): Partial<TrackingEventData> {
  return {
    page_url: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer,
    source: getUrlParam('utm_source'),
    medium: getUrlParam('utm_medium'),
    campaign: getUrlParam('utm_campaign'),
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    language: navigator.language,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function getUrlParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || undefined;
}

export function trackEvent(event_name: string, data: Partial<TrackingEventData> = {}) {
  const payload = {
    ...getBaseTrackingData(),
    ...data,
    event_name,
  };
  const url = '/api/track';
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  }
}

// Automatisch page_view tracken
export function autoTrackPageView() {
  trackEvent('page_view');
}
