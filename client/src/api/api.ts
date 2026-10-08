import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import JSONbig from 'json-bigint';


const AUTH_MARKER_VALUE = 'cookie-authenticated';
const CSRF_COOKIE_NAME = 'csrf_token';
const isApiDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_API_DEBUG === 'true';

const logDebug = (...args: unknown[]) => {
  if (isApiDebugEnabled) {
    console.log(...args);
  }
};

const warnDebug = (...args: unknown[]) => {
  if (isApiDebugEnabled) {
    console.warn(...args);
  }
};

const readCookie = (name: string): string | null => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

/** CSRF header for raw `fetch` write requests that bypass the axios instance below. */
export const getCsrfHeaders = (): Record<string, string> => {
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
};

const shouldAttachCsrfToken = (method?: string) => {
  const normalizedMethod = (method || 'get').toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod);
};

const isJwtLike = (value: string | null) => {
  return Boolean(value && value.split('.').length === 3);
};


/**
 * Error thrown for any HTTP response with status >= 400.
 *
 * `validateStatus: () => true` makes axios resolve every response, so error statuses are
 * turned into rejections by the response interceptor below. Rejecting with the raw
 * AxiosResponse used to destroy the server message: callers read
 * `error.response.data.error || error.message`, and a plain response has neither - which
 * rendered as an empty "Fehler" toast. This carries `response`, `status` and `data` so both
 * the `error.response.data.*` and the `error.data.*` idiom used across client/src/api keep
 * working, and `message` always holds a usable text.
 *
 * Note: a rejection raised inside the interceptor's FULFILLED handler does not reach that
 * same interceptor's rejection handler, so the 401/403 refresh-and-retry logic below stays
 * exactly as (un)reachable for HTTP errors as it was before - verified against axios 1.18.1.
 */
export class ApiError extends Error {
  status?: number;
  data?: any;
  response?: any;
  config?: any;

  constructor(message: string, response: any) {
    super(message);
    this.name = 'ApiError';
    this.status = response?.status;
    this.data = response?.data;
    this.response = response;
    this.config = response?.config;
  }
}

const buildApiError = (response: any): ApiError => {
  const data = response?.data;
  // transformResponse below always yields an object for this instance, so a raw string
  // body can never reach here - the message comes from the server's German error/message
  // field, otherwise from the German HTTP fallback.
  const message =
    data?.error ||
    data?.message ||
    `Anfrage fehlgeschlagen (HTTP ${response?.status ?? '?'})`;

  return new ApiError(message, response);
};

const localApi = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  // Accept all status codes so interceptors can handle them properly
  // Especially important for 401/403 token refresh logic
  validateStatus: (status) => {
    return true;
  },
  transformResponse: [(data) => {
    // Handle empty responses
    if (!data || data.trim() === '') {
      warnDebug('API returned empty response');
      return {};
    }

    // Check if data is HTML (error page) instead of JSON
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      warnDebug('API returned HTML instead of JSON. This usually indicates a server error or the server is starting up.');
      // User-facing: this string ends up verbatim in the German "Fehler" toast.
      return {
        error: 'Server nicht erreichbar oder Serverfehler. Bitte später erneut versuchen.',
        errorCode: 'HTML_RESPONSE',
      };
    }

    try {
      return JSONbig.parse(data);
    } catch (error) {
      if (isApiDebugEnabled) {
        console.error('Failed to parse JSON response:', {
          error: error instanceof Error ? error.message : String(error),
          dataPreview: typeof data === 'string' ? data.substring(0, 200) : data,
          dataType: typeof data
        });
      }
      // Return empty object as fallback to prevent complete failure
      return {};
    }
  }]
});



const getApiInstance = (url: string) => {
  return localApi;
};

// Check if the URL is for the refresh token endpoint to avoid infinite loops
const isRefreshTokenEndpoint = (url: string): boolean => {
  return url.includes("/api/auth/refresh");
};

// Shared refresh promise — prevents parallel refresh calls when multiple requests get 401 simultaneously
let pendingRefresh: Promise<void> | null = null;

const doTokenRefresh = async (): Promise<void> => {
  logDebug('[API] Sending refresh token request');
  const response = await localApi.post(`/api/auth/refresh`, {});

  if (response.status >= 400) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  localStorage.setItem('accessToken', AUTH_MARKER_VALUE);
  logDebug('[API] Tokens refreshed successfully');
};

const setupInterceptors = (apiInstance: typeof axios) => {
  apiInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const accessToken = localStorage.getItem('accessToken');

      // If we have a token stored (either JWT or marker value), ensure Authorization header is set
      // If it's not a JWT, the browser will still send cookies with credentials: true
      // But we'll try to send it as Bearer token just in case
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined') {
        if (config.headers) {
          // Always set Authorization header if we have a token, regardless of whether it's JWT-like
          if (isJwtLike(accessToken)) {
            config.headers.Authorization = `Bearer ${accessToken}`;
            logDebug('[API] JWT token attached to Authorization header');
          } else if (accessToken === 'cookie-authenticated') {
            // For cookie-authenticated sessions, the Authorization header is not needed
            // The browser will send the cookie automatically with credentials: true
            logDebug('[API] Cookie-authenticated session - relying on HTTP-only cookie');
          }
        }
      }

      if (config.headers && shouldAttachCsrfToken(config.method)) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME);
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }

      return config;
    },
    (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
  );

  apiInstance.interceptors.response.use(
    (response) => {
      // Log successful responses (for debugging)
      logDebug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`);
      
      // Handle error status codes
      if (response.status >= 400) {
        warnDebug(`[API] Error response: ${response.status} from ${response.config.url}`, response.data);
        return Promise.reject(buildApiError(response));
      }
      return response;
    },
    async (error: AxiosError | any): Promise<any> => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const status = error.response?.status || error.status;

      warnDebug(`[API] Error: ${status} from ${originalRequest.url}`, error.response?.data || error.message);

      // Only refresh token when we get a 401/403 error (token is invalid/expired)
      if (status && [401, 403].includes(status) &&
          !originalRequest._retry &&
          originalRequest.url && !isRefreshTokenEndpoint(originalRequest.url)) {
        logDebug(`[API] Attempting token refresh for ${originalRequest.url}`);
        originalRequest._retry = true;

        try {
          // Reuse an in-flight refresh if one is already running (prevents parallel token rotations)
          if (!pendingRefresh) {
            pendingRefresh = doTokenRefresh().finally(() => { pendingRefresh = null; });
          }
          await pendingRefresh;
          logDebug(`[API] Retrying original request: ${originalRequest.url}`);
          return getApiInstance(originalRequest.url || '')(originalRequest);
        } catch (err) {
          if (isApiDebugEnabled) {
            console.error('[API] Token refresh failed:', err);
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          // Dispatch event so AuthContext can react
          window.dispatchEvent(new CustomEvent('auth-logout'));
          logDebug('[API] Redirecting to login');
          window.location.href = '/login';
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );
};

setupInterceptors(localApi);



const api = {
  request: (config: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(config.url || '');
    return apiInstance(config);
  },
  get: (url: string, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.get(url, config);
  },
  post: (url: string, data?: any, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.post(url, data, config);
  },
  put: (url: string, data?: any, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.put(url, data, config);
  },
  patch: (url: string, data?: any, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.patch(url, data, config);
  },
  delete: (url: string, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.delete(url, config);
  },
};

export default api;
