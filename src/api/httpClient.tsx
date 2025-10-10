import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ===== BASE URL DETECTION =====
let BASE_URL = '';

if (Platform.OS === 'android') {
  // Android emulator uses 10.0.2.2 for localhost
  BASE_URL = 'https://www.eatoor.com/api';
  // BASE_URL = "http://10.0.2.2:8000/api";

} else {
  // iOS simulator can use localhost directly
  BASE_URL = 'https://www.eatoor.com/api';
  // BASE_URL = 'http://127.0.0.1:8000/api';
}

// For real devices: change BASE_URL to your PC's local IP
// Example: BASE_URL = 'http://192.168.1.100:8000/api';

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ===== REQUEST INTERCEPTOR =====
API.interceptors.request.use(
  async (config) => {
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
  (error) => Promise.reject(error)
);

// ===== RESPONSE INTERCEPTOR =====
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No response = network or server unreachable
    if (!error.response) {
      console.error('Network Error:', error.message);
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Please check your internet connection.',
        originalError: error,
      });
    }

    const { status, data } = error.response;

    switch (status) {
      case 401:
        console.error('Unauthorized:', data);

        if (originalRequest.url.includes('/refresh-token')) {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
          return Promise.reject({
            code: 'REFRESH_TOKEN_FAILED',
            message: 'Session expired. Please log in again.',
            originalError: error,
          });
        }

        if (!originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            if (refreshToken) {
              const res = await axios.post(`${BASE_URL}/refresh-token`, { refreshToken });
              const { accessToken } = res.data;

              await AsyncStorage.setItem('accessToken', accessToken);
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return API(originalRequest);
            }
          } catch (refreshError) {
            await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
          }
        }
        return Promise.reject({
          code: 'UNAUTHORIZED',
          message: data.message || 'Authentication required.',
          originalError: error,
        });

      case 400:
        return Promise.reject({
          code: 'BAD_REQUEST',
          message: data.message || 'Invalid request parameters.',
          validationErrors: data.errors,
          originalError: error,
        });

      case 403:
        return Promise.reject({
          code: 'FORBIDDEN',
          message: data.message || 'No permission to access this resource.',
          originalError: error,
        });

      case 404:
        return Promise.reject({
          code: 'NOT_FOUND',
          message: data.message || 'Resource not found.',
          originalError: error,
        });

      case 422:
        return Promise.reject({
          code: 'VALIDATION_ERROR',
          message: data.message || 'Validation failed.',
          errors: data.errors,
          originalError: error,
        });

      case 429:
        return Promise.reject({
          code: 'RATE_LIMITED',
          message: data.message || 'Too many requests.',
          retryAfter: error.response.headers['retry-after'],
          originalError: error,
        });

      case 500:
        return Promise.reject({
          code: 'SERVER_ERROR',
          message: data.message || 'Server error.',
          originalError: error,
        });

      case 503:
        return Promise.reject({
          code: 'SERVICE_UNAVAILABLE',
          message: data.message || 'Service temporarily unavailable.',
          originalError: error,
        });

      default:
        return Promise.reject({
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred.',
          originalError: error,
        });
    }
  }
);

export default API;
