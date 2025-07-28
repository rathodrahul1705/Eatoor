import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  timeout: 10000,
});

API.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log("config===",config)
    return config;
  },
  error => Promise.reject(error)
);

API.interceptors.response.use(
  response => response,
  error => {
    console.log("error.response?.status",error.response?.status)

    if (error.response?.status === 401) {
      // handle token expiration or logout
    }
    return Promise.reject(error);
  }
);

export default API;
