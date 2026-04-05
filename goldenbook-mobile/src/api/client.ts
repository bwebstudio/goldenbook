import axios from 'axios';
import { getAuthToken } from '@/auth/tokenStorage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// Stable session ID for NOW anti-repetition tracking (persists until app restart)
const SESSION_ID = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-session-id'] = SESSION_ID;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized — auth store will handle session clear
    }
    return Promise.reject(error);
  }
);
