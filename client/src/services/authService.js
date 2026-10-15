import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth service
const authService = {
  // Register new user
  async register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password });
    if (response.data.token) {
      localStorage.setItem('cloudvault_token', response.data.token);
      localStorage.setItem('cloudvault_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Login user
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('cloudvault_token', response.data.token);
      localStorage.setItem('cloudvault_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Logout user
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('cloudvault_token');
      localStorage.removeItem('cloudvault_user');
    }
  },

  // Get current user profile
  async getProfile() {
    const response = await api.get('/auth/me');
    if (response.data.user) {
      localStorage.setItem('cloudvault_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Get stored token
  getToken() {
    return localStorage.getItem('cloudvault_token');
  },

  // Get stored user
  getUser() {
    const userJson = localStorage.getItem('cloudvault_user');
    return userJson ? JSON.parse(userJson) : null;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  },

  // Check if user is admin
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  }
};

export default authService;
