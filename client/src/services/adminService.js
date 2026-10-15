import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const adminService = {
  // Admin Login
  async login(email, password) {
    const response = await api.post('/admin/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('cloudvault_token', response.data.token);
      localStorage.setItem('cloudvault_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Get Admin Overview Metrics
  async getOverview() {
    const response = await api.get('/admin/overview');
    return response.data;
  },

  // Get User List (Metadata)
  async getUsers() {
    const response = await api.get('/admin/users');
    return response.data;
  },

  // Suspend User
  async suspendUser(userId) {
    const response = await api.post(`/admin/users/${userId}/suspend`);
    return response.data;
  },

  // Terminate User
  async terminateUser(userId) {
    const response = await api.post(`/admin/users/${userId}/terminate`);
    return response.data;
  },

  // Reactivate User
  async reactivateUser(userId) {
    const response = await api.post(`/admin/users/${userId}/reactivate`);
    return response.data;
  },

  // Get Security Events
  async getSecurityEvents() {
    const response = await api.get('/admin/overview');
    return response.data;
  }
};

export default adminService;
