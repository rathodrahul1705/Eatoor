import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API = axios.create({
  // baseURL: 'https://www.eatoor.com/api',
  baseURL: 'http://127.0.0.1:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor
API.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      console.log("config===",config)
      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  },
  error => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
API.interceptors.response.use(
  response => {
    // You can modify successful responses here if needed
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    if (!error.response) {
      // Network error or server not reachable
      console.error('Network Error:', error.message);
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your internet connection.',
        originalError: error
      });
    }

    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        // Bad Request
        console.error('Bad Request:', data);
        return Promise.reject({
          code: 'BAD_REQUEST',
          message: data.message || 'Invalid request parameters.',
          validationErrors: data.errors,
          originalError: error
        });

      case 401:
        // Unauthorized
        console.error('Unauthorized:', data);
        
        // If this is a token refresh request, don't try to refresh again
        if (originalRequest.url.includes('/refresh-token')) {
          // Clear tokens and redirect to login
          await AsyncStorage.removeItem('accessToken');
          await AsyncStorage.removeItem('refreshToken');
          
          // You might want to dispatch a logout action here if using Redux
          // or navigate to login screen if using React Navigation
          
          return Promise.reject({
            code: 'REFRESH_TOKEN_FAILED',
            message: 'Session expired. Please login again.',
            originalError: error
          });
        }
        
        // Try to refresh token if this is the first 401 for this request
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            if (refreshToken) {
              // Call your refresh token endpoint
              const response = await axios.post(
                'http://127.0.0.1:8000/api/refresh-token',
                { refreshToken }
              );
              
              const { accessToken } = response.data;
              await AsyncStorage.setItem('accessToken', accessToken);
              
              // Update the original request header
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              
              // Retry the original request
              return API(originalRequest);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Clear tokens and redirect to login
            await AsyncStorage.removeItem('accessToken');
            await AsyncStorage.removeItem('refreshToken');
            
            // You might want to dispatch a logout action here if using Redux
            // or navigate to login screen if using React Navigation
          }
        }
        
        return Promise.reject({
          code: 'UNAUTHORIZED',
          message: data.message || 'Authentication required.',
          originalError: error
        });

      case 403:
        // Forbidden
        console.error('Forbidden:', data);
        return Promise.reject({
          code: 'FORBIDDEN',
          message: data.message || 'You do not have permission to access this resource.',
          originalError: error
        });

      case 404:
        // Not Found
        console.error('Not Found:', data);
        return Promise.reject({
          code: 'NOT_FOUND',
          message: data.message || 'The requested resource was not found.',
          originalError: error
        });

      case 422:
        // Unprocessable Entity (validation errors)
        console.error('Validation Error:', data);
        return Promise.reject({
          code: 'VALIDATION_ERROR',
          message: data.message || 'Validation failed.',
          errors: data.errors,
          originalError: error
        });

      case 429:
        // Too Many Requests
        console.error('Rate Limited:', data);
        return Promise.reject({
          code: 'RATE_LIMITED',
          message: data.message || 'Too many requests. Please try again later.',
          retryAfter: error.response.headers['retry-after'],
          originalError: error
        });

      case 500:
        // Internal Server Error
        console.error('Server Error:', data);
        return Promise.reject({
          code: 'SERVER_ERROR',
          message: data.message || 'An unexpected server error occurred.',
          originalError: error
        });

      case 503:
        // Service Unavailable
        console.error('Service Unavailable:', data);
        return Promise.reject({
          code: 'SERVICE_UNAVAILABLE',
          message: data.message || 'Service is temporarily unavailable. Please try again later.',
          originalError: error
        });

      default:
        // Other errors
        console.error('Unhandled API Error:', error);
        return Promise.reject({
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred.',
          originalError: error
        });
    }
  }
);

export default API;