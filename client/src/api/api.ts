import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig, AxiosInstance } from 'axios';
import JSONbig from 'json-bigint';



const localApi = axios.create({
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
      console.warn('API returned empty response');
      return {};
    }

    // Check if data is HTML (error page) instead of JSON
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      console.warn('API returned HTML instead of JSON. This usually indicates a server error or the server is starting up.');
      return { error: 'Server returned HTML response instead of JSON' };
    }

    try {
      return JSONbig.parse(data);
    } catch (error) {
      console.error('Failed to parse JSON response:', {
        error: error instanceof Error ? error.message : String(error),
        dataPreview: typeof data === 'string' ? data.substring(0, 200) : data,
        dataType: typeof data
      });
      // Return empty object as fallback to prevent complete failure
      return {};
    }
  }]
});



const getApiInstance = (url: string) => {
  return localApi;
};

const isAuthEndpoint = (url: string): boolean => {
  return url.includes("/api/auth");
};

// Check if the URL is for the refresh token endpoint to avoid infinite loops
const isRefreshTokenEndpoint = (url: string): boolean => {
  return url.includes("/api/auth/refresh");
};

const setupInterceptors = (apiInstance: typeof axios) => {
  apiInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {

      // Always read the latest token from localStorage to ensure auth persistence
      const accessToken = localStorage.getItem('accessToken');
      
      // Only add Authorization header if token is valid (not null, undefined, or string "null")
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined' && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
  );

  apiInstance.interceptors.response.use(
    (response) => {
      // Log successful responses (for debugging)
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
      
      // Handle error status codes
      if (response.status >= 400) {
        console.warn(`[API] Error response: ${response.status} from ${response.config.url}`, response.data);
        return Promise.reject(response);
      }
      return response;
    },
    async (error: AxiosError | any): Promise<any> => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const status = error.response?.status || error.status;

      console.warn(`[API] Error: ${status} from ${originalRequest.url}`, error.response?.data || error.message);

      // Only refresh token when we get a 401/403 error (token is invalid/expired)
      if (status && [401, 403].includes(status) &&
          !originalRequest._retry &&
          originalRequest.url && !isRefreshTokenEndpoint(originalRequest.url)) {
        console.log(`[API] Attempting token refresh for ${originalRequest.url}`);
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') {
            throw new Error('No refresh token available');
          }

          console.log('[API] Sending refresh token request');
          const response = await localApi.post(`/api/auth/refresh`, {
            refreshToken,
          });

          if (response.status >= 400) {
            throw new Error(`Token refresh failed: ${response.status}`);
          }

          if (response.data.data) {
            const newAccessToken = response.data.data.accessToken;
            const newRefreshToken = response.data.data.refreshToken;

            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            console.log('[API] Tokens refreshed successfully');

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }
          } else {
            throw new Error('Invalid response from refresh token endpoint');
          }

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
          }
          console.log(`[API] Retrying original request: ${originalRequest.url}`);
          return getApiInstance(originalRequest.url || '')(originalRequest);
        } catch (err) {
          console.error('[API] Token refresh failed:', err);
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          // Dispatch event so AuthContext can react
          window.dispatchEvent(new CustomEvent('auth-logout'));
          console.log('[API] Redirecting to login');
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
