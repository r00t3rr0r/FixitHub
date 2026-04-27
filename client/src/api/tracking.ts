// Frontend-Tracking-API
import { getSavedDeviceInfo } from '../utils/deviceDetection';

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
  platform?: string;
  device_model?: string;
  os_version?: string;
  browser_full?: string;
  country?: string;
  city?: string;
  custom_data?: any;
};

const TRACKING_SESSION_COOKIE = 'tracking_session_id';
const TRACKING_VISITOR_COOKIE = 'tracking_visitor_id';
const COOKIE_MAX_AGE_DAYS = 365;
const CSRF_COOKIE_NAME = 'csrf_token';

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (privacy mode / blocked storage).
  }
}

function getCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax${secure}`;
}

function getPersistentId(localStorageKey: string, cookieName: string): string {
  const localStorageValue = safeLocalStorageGet(localStorageKey);
  const cookieValue = getCookie(cookieName);

  const resolvedValue = localStorageValue || cookieValue;
  if (resolvedValue) {
    if (!localStorageValue) {
      safeLocalStorageSet(localStorageKey, resolvedValue);
    }
    if (!cookieValue) {
      setCookie(cookieName, resolvedValue, COOKIE_MAX_AGE_DAYS);
    }
    return resolvedValue;
  }

  const generated = Math.random().toString(36).substring(2) + Date.now().toString(36);
  safeLocalStorageSet(localStorageKey, generated);
  setCookie(cookieName, generated, COOKIE_MAX_AGE_DAYS);
  return generated;
}

function getSessionId() {
  return getPersistentId('tracking_session_id', TRACKING_SESSION_COOKIE);
}

function getVisitorId() {
  return getPersistentId('tracking_visitor_id', TRACKING_VISITOR_COOKIE);
}

function getBaseTrackingData(): Partial<TrackingEventData> {
  const savedDeviceInfo = getSavedDeviceInfo();
  const deviceType = savedDeviceInfo
    ? (savedDeviceInfo.isMobile ? 'mobile' : savedDeviceInfo.isTablet ? 'tablet' : 'desktop')
    : undefined;

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
    browser: savedDeviceInfo?.browser,
    browser_version: savedDeviceInfo?.browserVersion,
    os: savedDeviceInfo?.os,
    os_version: savedDeviceInfo?.osVersion,
    device_type: deviceType,
    device_model: savedDeviceInfo?.deviceModel,
    platform: savedDeviceInfo?.platform,
    browser_full: savedDeviceInfo ? `${savedDeviceInfo.browser} ${savedDeviceInfo.browserVersion}` : undefined,
    custom_data: savedDeviceInfo
      ? {
          current_device_info: savedDeviceInfo,
          device_info_source: 'localStorage.deviceInfo'
        }
      : undefined,
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
  const jsonPayload = JSON.stringify(payload);
  const csrfToken = getCookie(CSRF_COOKIE_NAME);

  const sendWithFetch = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    fetch(url, {
      method: 'POST',
      headers,
      body: jsonPayload,
      keepalive: true,
      credentials: 'same-origin',
    }).catch((error) => {
      console.error('[Tracking] Event send failed:', error);
    });
  };

  // sendBeacon cannot attach CSRF headers, so use fetch when CSRF token is present.
  if (navigator.sendBeacon && !csrfToken) {
    const blob = new Blob([jsonPayload], { type: 'application/json' });
    const beaconQueued = navigator.sendBeacon(url, blob);
    if (!beaconQueued) {
      sendWithFetch();
    }
  } else {
    sendWithFetch();
  }
}

// Automatisch page_view tracken
export function autoTrackPageView() {
  trackEvent('page_view');
}
