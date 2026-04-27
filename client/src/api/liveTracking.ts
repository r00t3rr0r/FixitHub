import api from './api';

export type LiveTrackingSummary = {
  active_visitors_5m: number;
  active_visitors_30m: number;
  page_views_5m: number;
  new_sessions_30m: number;
  conversions_30m: number;
  errors_30m: number;
};

export type ActiveSession = {
  _id: string;
  last_activity: string;
  first_activity: string;
  current_page: string;
  landing_page: string;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  browser: string;
  device_type: string;
  os: string;
  country: string;
  event_count: number;
  visitor_id: string;
};

export type TopItem = {
  _id: string;
  count: number;
  title?: string;
};

export type TrackingEvent = {
  _id: string;
  event_name: string;
  occurred_at: string;
  page_path: string;
  session_id: string;
  referrer: string;
  source: string;
  custom_data: any;
};

export type SessionDetail = {
  session_id: string;
  session_start: string;
  last_activity: string;
  landing_page: string;
  current_page: string;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  browser: string;
  browser_version: string;
  os: string;
  device_type: string;
  country: string;
  city: string;
  event_count: number;
  events: Array<{
    event_name: string;
    occurred_at: string;
    page_path: string;
    page_title: string;
    custom_data: any;
  }>;
};

export const liveTrackingApi = {
  getSummary: async (minutes = 30): Promise<LiveTrackingSummary> => {
    console.log('[API] getSummary - minutes:', minutes);
    const response = await api.get(`/api/admin/live-tracking/summary?minutes=${minutes}`);
    console.log('[API] getSummary - response:', response.status, response.data);
    if (response.status !== 200 || !response.data || response.data.error) {
      console.warn('[API] getSummary - returning default values', response.data?.error);
      return {
        active_visitors_5m: 0,
        active_visitors_30m: 0,
        page_views_5m: 0,
        new_sessions_30m: 0,
        conversions_30m: 0,
        errors_30m: 0,
      };
    }
    return response.data;
  },

  getActiveSessions: async (minutes = 30): Promise<ActiveSession[]> => {
    console.log('[API] getActiveSessions - minutes:', minutes);
    const response = await api.get(`/api/admin/live-tracking/active-sessions?minutes=${minutes}`);
    console.log('[API] getActiveSessions - response:', response.status, 'data length:', Array.isArray(response.data) ? response.data.length : 'not array');
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      console.warn('[API] getActiveSessions - returning empty array', response.data?.error);
      return [];
    }
    return response.data;
  },

  getTopPages: async (minutes = 30, limit = 10): Promise<TopItem[]> => {
    const response = await api.get(`/api/admin/live-tracking/top-pages?minutes=${minutes}&limit=${limit}`);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      return [];
    }
    return response.data;
  },

  getTopReferrers: async (minutes = 30, limit = 10): Promise<TopItem[]> => {
    const response = await api.get(`/api/admin/live-tracking/top-referrers?minutes=${minutes}&limit=${limit}`);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      return [];
    }
    return response.data;
  },

  getTopBrowsers: async (minutes = 30, limit = 10): Promise<TopItem[]> => {
    const response = await api.get(`/api/admin/live-tracking/top-browsers?minutes=${minutes}&limit=${limit}`);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      return [];
    }
    return response.data;
  },

  getTopDevices: async (minutes = 30, limit = 10): Promise<TopItem[]> => {
    const response = await api.get(`/api/admin/live-tracking/top-devices?minutes=${minutes}&limit=${limit}`);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      return [];
    }
    return response.data;
  },

  getTopCountries: async (minutes = 30, limit = 10): Promise<TopItem[]> => {
    const response = await api.get(`/api/admin/live-tracking/top-countries?minutes=${minutes}&limit=${limit}`);
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      return [];
    }
    return response.data;
  },

  getEvents: async (limit = 50, minutes = 30): Promise<TrackingEvent[]> => {
    const response = await api.get(`/api/admin/live-tracking/events?limit=${limit}&minutes=${minutes}`);
    console.log('[API] getEvents - response:', response.status, 'data length:', Array.isArray(response.data) ? response.data.length : 'not array');
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.error) {
      console.warn('[API] getEvents - returning empty array', response.data?.error);
      return [];
    }
    return response.data;
  },

  getSessionDetail: async (sessionId: string): Promise<SessionDetail> => {
    const response = await api.get(`/api/admin/live-tracking/session/${sessionId}`);
    if (response.status !== 200 || !response.data) {
      throw new Error('Failed to load session detail');
    }
    return response.data;
  },
};
