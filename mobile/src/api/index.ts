import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
const DEV_API_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:4100/api' 
  : 'http://localhost:4100/api';

// You can override this with .env file
const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;

console.log('🌐 API URL:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry for login endpoints
      if (originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - user needs to login again
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// API Modules
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

export const walletApi = {
  getWallet: () => api.get('/wallet'),
  getHistory: (params?: any) => api.get('/wallet/history', { params }),
};

export const transactionApi = {
  getStats: () => api.get('/transactions/stats'),
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  createPayin: (data: any) => api.post('/transactions/payin', data),
  createPayout: (data: any) => api.post('/transactions/payout', data),
  transfer: (data: any) => api.post('/transactions/transfer', data),
};

export const userApi = {
  getUsers: (params?: any) => api.get('/users', { params }),
  getUser: (id: string) => api.get(`/users/${id}`),
  updateUser: (id: string, data: any) => api.put(`/users/${id}`, data),
};

export const bbpsApi = {
  fetchBill: (data: any) => api.post('/bbps/fetch', data),
  payBill: (data: any) => api.post('/bbps/pay', data),
};
