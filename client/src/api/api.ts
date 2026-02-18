import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig, AxiosInstance } from 'axios';
import JSONbig from 'json-bigint';



const localApi = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => {
    return status >= 200 && status < 300;
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



let accessToken: string | null = null;

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

      if (!accessToken) {
        accessToken = localStorage.getItem('accessToken');
      }
      // Only add Authorization header if token is valid (not null, undefined, or string "null")
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined' && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
  );

  apiInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError): Promise<any> => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Only refresh token when we get a 401/403 error (token is invalid/expired)
      if (error.response?.status && [401, 403].includes(error.response.status) &&
          !originalRequest._retry &&
          originalRequest.url && !isRefreshTokenEndpoint(originalRequest.url)) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') {
            throw new Error('No refresh token available');
          }

          const response = await localApi.post(`/api/auth/refresh`, {
            refreshToken,
          });

          if (response.data.data) {
            const newAccessToken = response.data.data.accessToken;
            const newRefreshToken = response.data.data.refreshToken;

            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            accessToken = newAccessToken;

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }
          } else {
            throw new Error('Invalid response from refresh token endpoint');
          }

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return getApiInstance(originalRequest.url || '')(originalRequest);
        } catch (err) {
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('accessToken');
          accessToken = null;
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
  delete: (url: string, config?: AxiosRequestConfig) => {
    const apiInstance = getApiInstance(url);
    return apiInstance.delete(url, config);
  },
};

export default api;
